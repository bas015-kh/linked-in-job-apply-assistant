# ApplyPilot

ApplyPilot is a CV-driven, LinkedIn-focused job-search dashboard. It lets a user open the existing n8n profile form, choose target countries and preferences, and review an application pipeline. The dashboard currently displays safe zero-state/mock data; it does not scrape LinkedIn or submit job applications.

## Architecture

- Node.js 22 (`>=22.13.0`) and npm
- React 19 with vinext/Vite
- One frontend service on port `3000`
- No separate backend service
- No active database; optional Cloudflare D1/R2 bindings remain disabled in `.openai/hosting.json`
- The existing OpenAI Sites deployment configuration is preserved

## GitHub Codespaces

1. Open [the GitHub repository](https://github.com/bas015-kh/linked-in-job-apply-assistant).
2. Click **Code**.
3. Open the **Codespaces** tab.
4. Select **Create codespace on main**.
5. Wait for `npm ci` to complete automatically.
6. Add any future required values under repository **Settings → Secrets and variables → Codespaces**. ApplyPilot currently requires none.
7. In the Codespaces terminal, run `npm run dev -- --hostname 0.0.0.0` or `docker compose up --build`.
8. Open the forwarded **ApplyPilot website** port (`3000`). It is configured as private during testing.

The local/Codespaces server does not require ChatGPT sign-in. The separately hosted private OpenAI Sites version still uses its existing access policy.

## Local development

Requirements: Node.js 22.13 or newer and npm.

```bash
npm ci
npm run dev -- --hostname 0.0.0.0
```

Open `http://localhost:3000`.

## Docker development

Docker Compose runs only the frontend because the current application has no backend or PostgreSQL dependency.

```bash
docker compose up --build
```

Open `http://localhost:3000`. Stop it with `docker compose down`. The named `applypilot_node_modules` volume keeps container dependencies separate from the host checkout.

## Environment variables and secrets

No runtime variables are required by the current frontend. `.env.example` records this intentionally. If integrations are added later:

- put variable names with empty placeholder values in `.env.example`;
- store real values as GitHub Codespaces secrets or in an untracked local `.env`;
- keep OpenAI, n8n, database, and authentication secrets server-side;
- never prefix secrets with `NEXT_PUBLIC_` or expose them in browser code.

Do not paste secrets into issues, commits, pull requests, or chat messages.

## Validation commands

```bash
npm ci
npm run build
npm run lint
docker compose config
```

The repository includes a Docker health check against the website root. The dashboard remains review-only: it does not submit real applications, and the production n8n workflow remains inactive until an authorized job source and valid credentials are deliberately configured outside this repository.
