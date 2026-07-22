# Competition JSON API (`/api/v1`)

Versioned JSON surface for Expo and other mobile clients. Web admin continues to use Server Actions.

## Auth

1. Sign in on the web (Google / credentials) so the Auth.js session cookie is set, **or**
2. `POST /api/v1/auth/session` while authenticated to mint an opaque Bearer token (`th_…`).
3. Send `Authorization: Bearer th_…` on staff write routes.

```bash
# Who am I (cookie session)
curl -s -b cookies.txt https://example.com/api/v1/auth/session

# Mint Expo token
curl -s -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{"name":"Expo"}' https://example.com/api/v1/auth/session
```

## Public reads

```bash
curl -s https://example.com/api/v1/tournaments/my-slug
curl -s https://example.com/api/v1/tournaments/my-slug/schedule
curl -s https://example.com/api/v1/tournaments/my-slug/standings
curl -s https://example.com/api/v1/tournaments/my-slug/brackets
```

## Staff write — score

Same RBAC as admin (`game:update` + division scope for POWER_USER / SCOREKEEPER).

```bash
curl -s -X POST \
  -H "Authorization: Bearer th_…" \
  -H "Content-Type: application/json" \
  -d '{"homeRuns":5,"awayRuns":2,"status":"FINAL"}' \
  https://example.com/api/v1/tournaments/my-slug/games/GAME_ID/score
```
