# Tournament Hub (`tourney-app`)

Next.js app for youth baseball tournaments: schedules, scores, standings, brackets, announcements, and weather.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.
2. Apply migrations: `npx prisma migrate deploy`
3. Optional seed: `npm run db:seed`
4. Dev server: `npm run dev` → [http://localhost:3000](http://localhost:3000)

## Deploy

Connect the repo to Vercel, set the same env vars, run migrations against production Postgres, then deploy.

See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying).
