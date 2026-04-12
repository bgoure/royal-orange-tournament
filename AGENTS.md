<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Overview

Tournament Hub (`tourney-app`) — a Next.js 16 / React 19 / TypeScript full-stack app for youth sports tournaments. Uses Prisma ORM with PostgreSQL, NextAuth v5 for auth, Tailwind CSS v4 for styling.

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
