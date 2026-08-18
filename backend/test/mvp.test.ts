import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import { newDb } from "pg-mem";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { Database } from "../src/db.js";
import type { N8nAdapter } from "../src/n8n.js";

const mockN8n: N8nAdapter = {
  mode: "mock",
  async syncProfile() {},
  async evaluate() { return { matchScore: 72, strengths: ["Profile available"], gaps: ["Mock only"], summary: "Mock evaluation", tailoredCv: "Mock tailored CV", coverLetter: "Mock cover letter" }; },
  async notifyApproval() {},
};

async function setup() {
  const memory = newDb();
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  const migrationPath = fileURLToPath(new URL("../migrations/001_initial.sql", import.meta.url));
  await pool.query(await readFile(migrationPath, "utf8"));
  const app = createApp({ db: pool as Database, n8n: mockN8n, frontendOrigin: "http://localhost:3000", cookieSecure: false });
  return { app, pool };
}

test("authentication, validation, ownership and application workflow", async () => {
  const { app, pool } = await setup();
  const alice = request.agent(app);
  const bob = request.agent(app);

  const health = await request(app).get("/health");
  assert.equal(health.status, 200);
  assert.equal(health.headers["x-content-type-options"], "nosniff");
  assert.equal((await request(app).get("/api/profile")).status, 401);
  const aliceRegistration = await alice.post("/api/auth/register").send({ email: "alice@example.test", password: "StrongPass123!" });
  assert.equal(aliceRegistration.status, 201);
  assert.match(aliceRegistration.headers["set-cookie"][0], /HttpOnly/);
  assert.equal((await bob.post("/api/auth/register").send({ email: "bob@example.test", password: "StrongPass456!" })).status, 201);
  assert.equal((await request(app).post("/api/auth/login").send({ email: "alice@example.test", password: "wrong-password" })).status, 401);

  const profile = { fullName: "Alice Example", targetRoles: ["Automation Engineer"], targetCountries: ["Jordan"], salaryExpectation: "Market rate", workAuthorization: "Authorized" };
  assert.equal((await alice.put("/api/profile").send(profile)).status, 200);
  const updated = { ...profile, targetCountries: ["Jordan", "UAE"] };
  assert.equal((await alice.put("/api/profile").send(updated)).status, 200);
  assert.deepEqual((await alice.get("/api/profile")).body.profile.target_countries, ["Jordan", "UAE"]);
  assert.equal((await alice.post("/api/cv").send({ cvText: "too short" })).status, 400);
  assert.equal((await alice.post("/api/cv").send({ fileName: "cv.txt", cvText: "Experienced automation engineer with workflow, integration, API, cloud, testing, operations, security, and delivery expertise. ".repeat(2) })).status, 201);

  const created = await alice.post("/api/jobs").send({ title: "Automation Engineer", company: "Example Co", location: "Remote", sourceUrl: "https://www.linkedin.com/jobs/view/123" });
  assert.equal(created.status, 201);
  const jobId = created.body.id;
  const jobs = await alice.get("/api/jobs");
  assert.equal(jobs.body.jobs.length, 1);
  assert.equal(jobs.body.jobs[0].match_score, 72);
  assert.match(jobs.body.jobs[0].tailored_cv, /Mock tailored CV/);

  assert.equal((await bob.get("/api/jobs")).body.jobs.length, 0);
  assert.equal((await bob.post(`/api/jobs/${jobId}/decision`).send({ decision: "approved" })).status, 404);
  assert.equal((await bob.post(`/api/jobs/${jobId}/status`).send({ status: "applied", note: "must fail" })).status, 404);
  assert.equal((await alice.post(`/api/jobs/${jobId}/decision`).send({ decision: "approved" })).status, 201);
  assert.equal((await alice.post(`/api/jobs/${jobId}/decision`).send({ decision: "rejected" })).status, 201);
  assert.equal((await alice.post(`/api/jobs/${jobId}/status`).send({ status: "applied", note: "Submitted manually" })).status, 201);

  const counts = await pool.query("SELECT (SELECT COUNT(*) FROM approval_decisions) approvals, (SELECT COUNT(*) FROM application_history) history");
  assert.equal(Number(counts.rows[0].approvals), 2);
  assert.equal(Number(counts.rows[0].history), 1);

  const restartedApp = createApp({ db: pool as Database, n8n: mockN8n, frontendOrigin: "http://localhost:3000", cookieSecure: false });
  const afterRestart = request.agent(restartedApp);
  assert.equal((await afterRestart.post("/api/auth/login").send({ email: "alice@example.test", password: "StrongPass123!" })).status, 200);
  assert.equal((await afterRestart.get("/api/jobs")).body.jobs.length, 1);

  assert.equal((await alice.post("/api/auth/logout")).status, 204);
  assert.equal((await alice.get("/api/jobs")).status, 401);

  const secureApp = createApp({ db: pool as Database, n8n: mockN8n, frontendOrigin: "https://example.test", cookieSecure: true });
  const secureRegistration = await request(secureApp).post("/api/auth/register").set("origin", "https://example.test").send({ email: "secure@example.test", password: "StrongPass789!" });
  assert.match(secureRegistration.headers["set-cookie"][0], /Secure/);
  assert.equal(secureRegistration.headers["access-control-allow-origin"], "https://example.test");
});
