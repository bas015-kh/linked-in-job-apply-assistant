import { createApp } from "./app.js";
import { createPool, migrate } from "./db.js";
import { createN8nAdapter } from "./n8n.js";

const port = Number(process.env.PORT ?? 3001);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const db = createPool(databaseUrl);
await migrate(db);

const app = createApp({
  db,
  n8n: createN8nAdapter(process.env),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  cookieSecure: process.env.COOKIE_SECURE === "true",
});

app.listen(port, "0.0.0.0", () => console.log(JSON.stringify({ level: "info", message: "ApplyPilot API ready", port })));
