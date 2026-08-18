# ApplyPilot

ApplyPilot is a private, CV-driven job-search MVP. Users create independent accounts, maintain a candidate profile and CV text, add LinkedIn or employer job URLs manually, inspect match evidence and tailored documents, record approval decisions, and update an application pipeline. The application never submits a job application.

## Architecture

- `frontend` — React 19 with vinext/Vite on port `3000`
- `backend` — Node.js 22, Express, validation and session authentication on port `3001`
- `postgres` — PostgreSQL 17 on the internal Compose network only
- `n8n` — a server-only adapter; mock mode is the safe default

The browser uses same-origin `/api/*` routes. The frontend server proxies these calls to the private backend, so n8n webhook addresses and credentials never enter browser code.

## Start the complete application

Copy the environment template and replace the development database password:

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3000`. The API health endpoint is available at `http://localhost:3001/health`. PostgreSQL is deliberately not published to the host.

Stop containers without deleting data:

```bash
docker compose down
```

The `postgres_data` named volume preserves data across container restarts. Only `docker compose down --volumes` deletes it.

## GitHub Codespaces

1. Open [the repository](https://github.com/bas015-kh/linked-in-job-apply-assistant).
2. Select **Code → Codespaces → Create codespace on main**.
3. Wait for the automatic dependency installation.
4. Create an untracked `.env` from `.env.example`, or add values under **Settings → Secrets and variables → Codespaces**.
5. Use a strong `POSTGRES_PASSWORD`.
6. Set `FRONTEND_ORIGIN` to the exact forwarded port-3000 HTTPS origin and set `COOKIE_SECURE=true` when testing through Codespaces HTTPS.
7. Leave `N8N_MODE=mock` until all webhook settings have been configured and tested.
8. Run `docker compose up --build`.
9. Open forwarded port `3000`. Ports `3000` and `3001` are configured as private; the database port is not forwarded.

## Environment variables

Local values belong in the ignored `.env`. Repository or organization Codespaces secrets are appropriate for shared development. Never paste secret values into source files, issues, pull requests, or frontend variables.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER` | Local database user |
| `POSTGRES_PASSWORD` | Database password; replace the example |
| `POSTGRES_DB` | Database name |
| `FRONTEND_ORIGIN` | Exact origin permitted by backend CORS |
| `COOKIE_SECURE` | Set `true` on HTTPS environments |
| `N8N_MODE` | `mock` by default; change to `live` only after testing |
| `N8N_BASE_URL` | Private n8n base URL, backend only |
| `N8N_PROFILE_WEBHOOK_PATH` | Signed profile webhook path |
| `N8N_JOB_EVALUATION_WEBHOOK_PATH` | Signed evaluation webhook path |
| `N8N_APPROVAL_WEBHOOK_PATH` | Signed approval webhook path |
| `N8N_WEBHOOK_SECRET` | Shared HMAC secret, backend only |

The backend signs live n8n requests with an HMAC-SHA256 signature and timestamp. Mock mode creates clearly labeled deterministic scores and document placeholders without contacting n8n.

## Security model

- Passwords are hashed with bcrypt cost 12.
- Session tokens are random, stored only as SHA-256 hashes, expire after seven days, and use HTTP-only cookies.
- Cookies are Secure in HTTPS environments when `COOKIE_SECURE=true`.
- Helmet security headers, strict CORS, input schemas, body-size limits, and rate limits are enabled.
- Every profile, CV, job, evaluation, document, decision, and history query is scoped to the authenticated `user_id`.
- Structured request logs contain method, path, status, and duration only—never bodies, CV text, cookies, or secrets.
- Job approval records a decision; it does not submit anything.

## Database migrations

The backend runs `backend/migrations/001_initial.sql` safely at startup. It creates:

- `users`
- `sessions`
- `candidate_profiles`
- `cv_records`
- `job_opportunities`
- `job_evaluations`
- `tailored_documents`
- `approval_decisions`
- `application_history`

## Validation

```bash
npm ci
npm run build
npx eslint app db worker vite.config.ts next.config.ts drizzle.config.ts

cd backend
npm ci
npm run build
npm test

cd ..
docker compose config
docker compose up --build
```

The backend integration test creates two isolated users and verifies registration, invalid login, protected routes, profile create/update, CV validation, manual URL submission, score/documents, cross-user denial, approval/rejection, status history, and logout.

The existing OpenAI Sites configuration remains in the repository, and the previously created n8n production workflow must remain inactive until the live webhook contract is configured and tested deliberately.
