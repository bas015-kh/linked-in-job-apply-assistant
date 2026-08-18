import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import type { Database } from "./db.js";
import type { N8nAdapter } from "./n8n.js";

const SESSION_COOKIE = "applypilot_session";
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(10).max(128);
const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema });
const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  targetRoles: z.array(z.string().trim().min(1).max(100)).max(20),
  targetCountries: z.array(z.string().trim().min(1).max(100)).max(20),
  salaryExpectation: z.string().trim().max(100).default(""),
  workAuthorization: z.string().trim().max(300).default(""),
});
const cvSchema = z.object({ cvText: z.string().trim().min(100).max(100_000), fileName: z.string().trim().max(255).optional() });
const jobSchema = z.object({
  title: z.string().trim().min(2).max(200), company: z.string().trim().max(200).default(""), location: z.string().trim().max(200).default(""),
  sourceUrl: z.string().url().max(2_000).refine((value) => ["https:", "http:"].includes(new URL(value).protocol), "Only HTTP(S) URLs are allowed"),
});
const decisionSchema = z.object({ decision: z.enum(["approved", "rejected"]) });
const statusSchema = z.object({ status: z.enum(["saved", "preparing", "applied", "interview", "offer", "rejected", "withdrawn"]), note: z.string().trim().max(1_000).default("") });

type AuthedRequest = Request & { userId?: string };

export function createApp(options: { db: Database; n8n: N8nAdapter; frontendOrigin: string; cookieSecure: boolean }) {
  const { db, n8n, frontendOrigin, cookieSecure } = options;
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: frontendOrigin, credentials: true, methods: ["GET", "POST", "PUT"] }));
  app.use(express.json({ limit: "120kb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => console.log(JSON.stringify({ level: "info", method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - started })));
    next();
  });

  const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
  const apiLimit = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });
  app.use("/api", apiLimit);

  app.get("/health", async (_req, res, next) => {
    try { await db.query("SELECT 1"); res.json({ status: "ok", n8nMode: n8n.mode }); } catch (error) { next(error); }
  });

  app.post("/api/auth/register", authLimit, asyncRoute(async (req, res) => {
    const input = credentialsSchema.parse(req.body);
    const existing = await db.query("SELECT id FROM users WHERE email=$1", [input.email]);
    if (existing.rowCount) throw httpError(409, "Email is already registered");
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(input.password, 12);
    await db.query("INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)", [userId, input.email, passwordHash]);
    await createSession(db, res, userId, cookieSecure);
    res.status(201).json({ user: { id: userId, email: input.email } });
  }));

  app.post("/api/auth/login", authLimit, asyncRoute(async (req, res) => {
    const input = credentialsSchema.parse(req.body);
    const result = await db.query("SELECT id,email,password_hash FROM users WHERE email=$1", [input.email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) throw httpError(401, "Invalid email or password");
    await createSession(db, res, user.id, cookieSecure);
    res.json({ user: { id: user.id, email: user.email } });
  }));

  app.post("/api/auth/logout", asyncRoute(async (req, res) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await db.query("DELETE FROM sessions WHERE token_hash=$1", [hashToken(token)]);
    res.clearCookie(SESSION_COOKIE, cookieOptions(cookieSecure));
    res.status(204).end();
  }));

  app.get("/api/auth/me", requireAuth(db), asyncRoute(async (req: AuthedRequest, res) => {
    const result = await db.query("SELECT id,email FROM users WHERE id=$1", [req.userId]);
    res.json({ user: result.rows[0] });
  }));

  app.get("/api/profile", requireAuth(db), asyncRoute(async (req: AuthedRequest, res) => {
    const [profile, cv] = await Promise.all([
      db.query("SELECT full_name,target_roles,target_countries,salary_expectation,work_authorization FROM candidate_profiles WHERE user_id=$1", [req.userId]),
      db.query("SELECT id,file_name,created_at FROM cv_records WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1", [req.userId]),
    ]);
    res.json({ profile: profile.rows[0] ?? null, cv: cv.rows[0] ?? null });
  }));

  app.put("/api/profile", requireAuth(db), asyncRoute(async (req: AuthedRequest, res) => {
    const input = profileSchema.parse(req.body);
    const id = randomUUID();
    const result = await db.query(`INSERT INTO candidate_profiles(id,user_id,full_name,target_roles,target_countries,salary_expectation,work_authorization)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET full_name=EXCLUDED.full_name,target_roles=EXCLUDED.target_roles,target_countries=EXCLUDED.target_countries,salary_expectation=EXCLUDED.salary_expectation,work_authorization=EXCLUDED.work_authorization,updated_at=NOW()
      RETURNING full_name,target_roles,target_countries,salary_expectation,work_authorization`, [id, req.userId, input.fullName, input.targetRoles, input.targetCountries, input.salaryExpectation, input.workAuthorization]);
    await n8n.syncProfile({ userId: req.userId, profile: input });
    res.json({ profile: result.rows[0] });
  }));

  app.post("/api/cv", requireAuth(db), asyncRoute(async (req: AuthedRequest, res) => {
    const input = cvSchema.parse(req.body);
    const result = await db.query("INSERT INTO cv_records(id,user_id,file_name,cv_text) VALUES($1,$2,$3,$4) RETURNING id,file_name,created_at", [randomUUID(), req.userId, input.fileName ?? null, input.cvText]);
    res.status(201).json({ cv: result.rows[0] });
  }));

  app.get("/api/jobs", requireAuth(db), asyncRoute(async (req: AuthedRequest, res) => {
    const result = await db.query(`SELECT j.id,j.title,j.company,j.location,j.source_url,j.status,j.created_at,e.match_score,e.strengths,e.gaps,e.summary,d.tailored_cv,d.cover_letter
      FROM job_opportunities j LEFT JOIN job_evaluations e ON e.opportunity_id=j.id AND e.user_id=j.user_id LEFT JOIN tailored_documents d ON d.opportunity_id=j.id AND d.user_id=j.user_id
      WHERE j.user_id=$1 ORDER BY j.created_at DESC`, [req.userId]);
    res.json({ jobs: result.rows, n8nMode: n8n.mode });
  }));

  app.post("/api/jobs", requireAuth(db), asyncRoute(async (req: AuthedRequest, res) => {
    const input = jobSchema.parse(req.body);
    const profile = await db.query("SELECT full_name,target_roles,target_countries FROM candidate_profiles WHERE user_id=$1", [req.userId]);
    const cv = await db.query("SELECT cv_text FROM cv_records WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1", [req.userId]);
    if (!profile.rowCount || !cv.rowCount) throw httpError(409, "Complete your profile and CV before adding a job");
    const jobId = randomUUID();
    await db.query("INSERT INTO job_opportunities(id,user_id,title,company,location,source_url) VALUES($1,$2,$3,$4,$5,$6)", [jobId, req.userId, input.title, input.company, input.location, input.sourceUrl]);
    const evaluation = await n8n.evaluate({ userId: req.userId, opportunityId: jobId, job: input, profile: profile.rows[0], cvText: cv.rows[0].cv_text });
    await db.query("INSERT INTO job_evaluations(id,user_id,opportunity_id,match_score,strengths,gaps,summary) VALUES($1,$2,$3,$4,$5,$6,$7)", [randomUUID(), req.userId, jobId, evaluation.matchScore, JSON.stringify(evaluation.strengths), JSON.stringify(evaluation.gaps), evaluation.summary]);
    await db.query("INSERT INTO tailored_documents(id,user_id,opportunity_id,tailored_cv,cover_letter) VALUES($1,$2,$3,$4,$5)", [randomUUID(), req.userId, jobId, evaluation.tailoredCv, evaluation.coverLetter]);
    res.status(201).json({ id: jobId, n8nMode: n8n.mode });
  }));

  app.post("/api/jobs/:id/decision", requireAuth(db), asyncRoute(async (req: AuthedRequest, res) => {
    const input = decisionSchema.parse(req.body);
    const owned = await ownedJob(db, String(req.params.id), req.userId!);
    await db.query("INSERT INTO approval_decisions(id,user_id,opportunity_id,decision) VALUES($1,$2,$3,$4)", [randomUUID(), req.userId, owned.id, input.decision]);
    await n8n.notifyApproval({ userId: req.userId, opportunityId: owned.id, decision: input.decision });
    res.status(201).json({ decision: input.decision, n8nMode: n8n.mode });
  }));

  app.post("/api/jobs/:id/status", requireAuth(db), asyncRoute(async (req: AuthedRequest, res) => {
    const input = statusSchema.parse(req.body);
    const owned = await ownedJob(db, String(req.params.id), req.userId!);
    await db.query("UPDATE job_opportunities SET status=$1 WHERE id=$2 AND user_id=$3", [input.status, owned.id, req.userId]);
    await db.query("INSERT INTO application_history(id,user_id,opportunity_id,status,note) VALUES($1,$2,$3,$4,$5)", [randomUUID(), req.userId, owned.id, input.status, input.note]);
    res.status(201).json({ status: input.status });
  }));

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) });
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    if (status >= 500) console.error(JSON.stringify({ level: "error", event: "request_failed", errorType: error instanceof Error ? error.name : "UnknownError" }));
    res.status(status).json({ error: status >= 500 ? "Internal server error" : error instanceof Error ? error.message : "Request failed" });
  });
  return app;
}

function asyncRoute(handler: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>) { return (req: Request, res: Response, next: NextFunction) => void handler(req as AuthedRequest, res, next).catch(next); }
function httpError(status: number, message: string) { return Object.assign(new Error(message), { status }); }
function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function cookieOptions(secure: boolean) { return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 7 * 24 * 60 * 60_000 }; }
async function createSession(db: Database, res: Response, userId: string, secure: boolean) { const token = randomBytes(32).toString("base64url"); await db.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '7 days')", [randomUUID(), userId, hashToken(token)]); res.cookie(SESSION_COOKIE, token, cookieOptions(secure)); }
function requireAuth(db: Database) { return asyncRoute(async (req: AuthedRequest, _res, next) => { const token = req.cookies[SESSION_COOKIE]; if (!token) throw httpError(401, "Authentication required"); const result = await db.query("SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>NOW()", [hashToken(token)]); if (!result.rowCount) throw httpError(401, "Session expired"); req.userId = result.rows[0].user_id; next(); }); }
async function ownedJob(db: Database, id: string, userId: string) { if (!z.string().uuid().safeParse(id).success) throw httpError(404, "Job not found"); const result = await db.query("SELECT id FROM job_opportunities WHERE id=$1 AND user_id=$2", [id, userId]); if (!result.rowCount) throw httpError(404, "Job not found"); return result.rows[0]; }
