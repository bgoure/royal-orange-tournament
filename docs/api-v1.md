# `/api/v1` — JSON API for the Expo app

Versioned, mobile-friendly JSON endpoints layered on top of the existing public site and admin
Server Actions (`src/app/admin/_actions/*`). Nothing under `src/app/(site)` or `src/app/admin`
changes — these routes read from (and, for scoring, write through) the same Prisma models and
services those already use.

All responses are JSON. Errors are always `{ "error": "<message>" }` with a non-2xx status.

## Auth

`resolveApiUser()` (`src/lib/api/v1/auth.ts`) checks, in order:

1. **`Authorization: Bearer th_...`** — an opaque, DB-backed token (`ApiBearerToken`) minted by
   `POST /api/v1/auth/token`. This is the token an Expo app should store in SecureStore and send
   on every request — it's revocable (delete the row) and has its own expiry, independent of the
   web session.
2. **`Authorization: Bearer <jwt>`** — the *raw Auth.js session JWT*, i.e. the exact value of the
   `authjs.session-token` (or `__Secure-authjs.session-token` over https) cookie. Decoded with
   `getToken()` from `next-auth/jwt` using `AUTH_SECRET` (or `NEXTAUTH_SECRET`) — no cookie needed.
   Useful for a quick manual test with a cookie copied out of the browser, without minting a
   token first. Because decoding this way skips NextAuth's `jwt` callback (which is what refreshes
   `role` from the DB roughly once a minute — see `ROLE_REFRESH_MS` in `src/auth.ts`), the API
   re-checks the caller's current role directly against the `User` table on every request instead
   of trusting whatever role was embedded when the JWT was issued.
3. **NextAuth session cookie** — if there's no usable `Authorization` header, falls back to
   `auth()` from `@/auth`. This is what the existing web app already sends; it keeps working with
   zero changes.

Missing/invalid credentials → `401 { "error": "Unauthorized" }`.
Authenticated but missing permission → `403 { "error": "..." }`.

**Typical Expo flow:** sign in once via Google in a browser/webview (there's no native
credentials flow — the app's `Credentials` provider is a disabled no-op unless Google OAuth env
vars are unset, see `src/auth.config.ts`), grab the session cookie value, then:

```bash
# 1. Exchange the session cookie (or its raw JWT as a bearer token) for a stable opaque token.
curl -s https://royalorange.ca/api/v1/auth/token \
  -X POST \
  -H "Cookie: authjs.session-token=<cookie-value>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My iPhone"}'
# { "token": "th_...", "expiresAt": "2026-10-19T...", "user": { "id": "...", "email": "...", "role": "POWER_USER" } }

# 2. Store `token` and use it on every subsequent request.
curl -s https://royalorange.ca/api/v1/auth/session \
  -X POST \
  -H "Authorization: Bearer th_..."
# { "user": { "id": "...", "email": "...", "role": "POWER_USER" } }
```

`POST /api/v1/auth/token` with `{ email, password }` was **not** added — there's no real password
check to perform (see above), so a bearer-token-minted-from-an-existing-session is the supported
flow instead.

## Endpoints

Tournament-scoped routes take the tournament's `slug` (same slug as the public site,
`https://.../{slug}`) and only resolve **live, published** tournaments — archived
(`/past/{archiveFolder}/{slug}`) events aren't in scope for v1.

### `GET /api/v1/tournaments/:slug`

Public. Tournament summary: `id`, `name`, `slug`, `startDate`, `endDate`, `timezone`,
`locationLabel`, optional tournament-level `latitude` / `longitude`, `locations[]` (with
`latitude` / `longitude` per venue when set), plus `organization` branding (if any).

```bash
curl -s https://royalorange.ca/api/v1/tournaments/summer-classic-2026
```

### `GET /api/v1/tournaments/:slug/schedule`

Public. All games (pool + bracket + consolation), same visibility rules the public Schedule page
uses (e.g. consolation games stay hidden until that division's bracket is published). Scores
(`homeRuns`/`awayRuns`) are included for `FINAL` games, and for `LIVE` games when runs are
already stored. Each game includes `updatedAt` for offline conflict checks.

Optional query params: `day` (`YYYY-MM-DD`), `teamId`, `fieldId`, `division` (division tab id),
`status` (`SCHEDULED` | `LIVE` | `FINAL` | …), `page` (default 1), `limit` (default 50, max 200).

Response includes pagination meta: `page`, `limit`, `total`.

```bash
curl -s "https://royalorange.ca/api/v1/tournaments/summer-classic-2026/schedule?day=2026-07-10&page=1&limit=20"
curl -s "https://royalorange.ca/api/v1/tournaments/summer-classic-2026/schedule?status=LIVE"
```

```json
{
  "games": [
    {
      "id": "clg...",
      "gameNumber": "12",
      "scheduledAt": "2026-07-10T14:00:00.000Z",
      "updatedAt": "2026-07-10T15:12:00.000Z",
      "status": "FINAL",
      "field": { "id": "clf...", "name": "Field 3", "location": "Sportsplex North" },
      "division": { "id": "cld...", "name": "12U" },
      "pool": { "id": "clp...", "name": "Pool A" },
      "homeTeam": { "id": "clt...", "name": "Thunder" },
      "awayTeam": { "id": "clt...", "name": "Lightning" },
      "homeRuns": 7,
      "awayRuns": 3
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 48
}
```

### `GET /api/v1/tournaments/:slug/live`

Public. Lightweight ticker: only games with `status = LIVE` (same consolation visibility rules).
Empty `games: []` when none are live. Shape matches schedule game objects (including `updatedAt`).

```bash
curl -s https://royalorange.ca/api/v1/tournaments/summer-classic-2026/live
```

### `GET /api/v1/tournaments/:slug/standings`

Public. Pool standings, teams already ordered by rank (auto tiebreakers or manual order —
whichever the pool uses).

```json
{
  "pools": [
    {
      "id": "clp...",
      "name": "Pool A",
      "division": { "id": "cld...", "name": "12U" },
      "standings": [
        {
          "rank": 1,
          "team": { "id": "clt...", "name": "Thunder" },
          "wins": 3, "losses": 0, "ties": 0, "points": 6,
          "runsFor": 21, "runsAgainst": 8, "displayOrder": 0
        }
      ]
    }
  ]
}
```

### `GET /api/v1/tournaments/:slug/brackets`

Public. **Published** playoff brackets only (matches the public Brackets page), including bye
slots (`homeIsBye`/`awayIsBye`) for byes in the first round.

```bash
curl -s https://royalorange.ca/api/v1/tournaments/summer-classic-2026/brackets
```

### `POST /api/v1/tournaments/:slug/games/:gameId/score`

**Staff write.** Requires `game:update` permission (`can()` in `src/lib/rbac/permissions.ts`) and
division scope for `POWER_USER` / `SCOREKEEPER` (`assertGameDivisionScope` — same checks as the
admin "Update scoring" Server Action). Recomputes that game's pool standings, and — once the game
is marked `FINAL` — advances the winner into the next bracket round, using the same services the
admin portal uses (`recomputePoolStandings`, `advanceBracketWinnerFromGame`).

Body:

```jsonc
{
  "homeRuns": 7,
  "awayRuns": 3,
  "status": "FINAL", // optional — omit to record an in-progress score without finalizing
  "expectedUpdatedAt": "2026-07-10T15:12:00.000Z" // optional — optimistic concurrency
}
```

Omitting `status` just updates the runs (e.g. for live, inning-by-inning scorekeeping) without
changing the game's status or touching the bracket. Pass `"status": "FINAL"` to close the game out
— that's the only accepted explicit value.

**Offline conflicts:** send `expectedUpdatedAt` from the last schedule/live fetch for that game.
If the server's `Game.updatedAt` is newer, the API responds **409** with
`{ "error": "...", "game": { "id", "updatedAt", "status", "homeRuns", "awayRuns" } }` so the
client can refresh and retry (or merge).

```bash
curl -s https://royalorange.ca/api/v1/tournaments/summer-classic-2026/games/clg123/score \
  -X POST \
  -H "Authorization: Bearer th_..." \
  -H "Content-Type: application/json" \
  -d '{"homeRuns": 7, "awayRuns": 3, "status": "FINAL", "expectedUpdatedAt": "2026-07-10T15:12:00.000Z"}'
```

```json
{
  "game": {
    "id": "clg123",
    "status": "FINAL",
    "homeRuns": 7,
    "awayRuns": 3,
    "updatedAt": "2026-07-10T15:20:00.000Z",
    "homeTeam": { "id": "clt...", "name": "Thunder" },
    "awayTeam": { "id": "clt...", "name": "Lightning" }
  }
}
```

Errors: `401` (no/invalid credentials), `403` (role/division scope denied), `404` (tournament or
game not found), `400` (bad body), `409` (stale `expectedUpdatedAt`).

### `POST /api/v1/user/push-tokens`

**Authenticated.** Registers an Expo push token for the current user (upsert by token string).
Does not send notifications yet.

```bash
curl -s https://royalorange.ca/api/v1/user/push-tokens \
  -X POST \
  -H "Authorization: Bearer th_..." \
  -H "Content-Type: application/json" \
  -d '{"token":"ExponentPushToken[xxxxxxxx]"}'
```

Notes / deliberate scope cuts:

- Innings, field-home swap, and forfeit `resultType` stay admin-portal-only for now — this
  endpoint only ever writes `homeRuns` / `awayRuns` / (optionally) `status`. Extend the body schema
  in `src/app/api/v1/tournaments/[slug]/games/[gameId]/score/route.ts` if the app needs those later.
- Both pool-play and bracket games can be scored through this one endpoint (bracket advancement is
  a no-op when the game has no `bracketId`).
