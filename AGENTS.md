<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Overview

Tournament Hub (`tourney-app`) — a Next.js 16 / React 19 / TypeScript full-stack app for youth sports tournaments. Uses Prisma ORM with PostgreSQL, NextAuth v5 for auth, Tailwind CSS v4 for styling.

### Git / deploy workflow

- **Day-to-day work** happens on the **`staging`** Git branch (pushes deploy the **staging** Vercel project, e.g. `royal-orange.goure.ca`).
- **Production** (`royalorange.ca`) updates only when **`staging` is merged into `main`** (the production Vercel project tracks **`main`**).
- Do not assume **`main`** has the latest changes until that merge; treat **`staging`** as the integration branch for new work.

### Staging vs Production Auth checklist

Copy-paste verify for **each** Vercel project (staging and production) after env changes or a new domain:

1. **`AUTH_URL`** and **`NEXTAUTH_URL`** both equal that project’s public origin (no trailing slash):
   - Staging: `https://royal-orange.goure.ca`
   - Production: `https://royalorange.ca`
2. If either URL still points at the **other** environment, Google OAuth finishes on the wrong host and sessions/cookies won’t match (“can’t sign in”).
3. Fallback: remove both URL vars on that project so Auth.js uses `trustHost: true` + Vercel’s `x-forwarded-host`, then redeploy.
4. Google Cloud OAuth client **Authorized redirect URIs** must include every callback you use, e.g.:
   - `https://royalorange.ca/api/auth/callback/google`
   - `https://royal-orange.goure.ca/api/auth/callback/google`
5. Confirm `AUTH_SECRET` is set (same value can be shared; rotating it signs everyone out).
6. Smoke-test: open the project origin → Login → Google → land back on **that** origin with `/admin` accessible for a staff user.

JWT sessions refresh `User.role` from the DB about once per minute (`src/auth.ts`); demotions take effect without a full sign-out within that window.

### Prerequisites

PostgreSQL 16 must be running locally. The VM environment has it installed; start it with `sudo pg_ctlcluster 16 main start` if it's not already running. The database `tourney_dev` (user `tourney`/password `tourney`) must exist.

A `.env` file must exist at the repo root with at minimum: `DATABASE_URL`, `AUTH_SECRET`, and `NEXTAUTH_URL`. See `.env.example` for the full template.

### Key commands

- **Install deps:** `npm install` (runs `prisma generate` via postinstall)
- **Migrate DB:** `npx prisma migrate deploy`
- **Seed DB:** `npm run db:seed`
- **Dev server:** `npm run dev` (port 3000)
- **Lint:** `npm run lint`
- **Tests:** `npm test` (runs standings, bracket, and email test suites via `tsx --test`)
- **Build:** `npx next build`

### Gotchas

- Google OAuth credentials are optional. Without them, auth falls back to a no-op credentials provider — the admin portal won't be fully testable without real OAuth or a manual DB user insertion.
- The `"middleware"` file convention is deprecated in Next.js 16; the build emits a warning about migrating to `"proxy"`. This is non-blocking.
- Prisma `package.json#prisma` seed config triggers a deprecation warning about migrating to `prisma.config.ts`. This is also non-blocking.
- The Resend email API key and Open-Meteo weather API are optional; the app degrades gracefully without them.
