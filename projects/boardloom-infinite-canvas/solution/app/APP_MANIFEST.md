# APP_MANIFEST — Boardloom

## Start command
```bash start
cd /app && bash start.sh
```

## Base URLs
- Frontend: http://127.0.0.1:5173
- Backend API: http://127.0.0.1:4000
- Health: `GET /health` → `{"ok":true,"db":true}`

The frontend (Vite) proxies `/api` and `/health` to the backend.

## Auth
Sign in / Register required. Token in
`localStorage["bl_token"]` as `Authorization: Bearer`. Register and sign-in
open an Untitled board.

## Layout
Theme-matched infinite canvas (dark canvas in dark theme, light canvas in
light theme). Left **Workspace** sidebar (`Hide sidebar` / `Show sidebar`)
holds New board / Save / Export image / Download image / Share / Upload /
the boards on this account. Floating icon dock for drawing.
Share creates a view link (`/s/<token>`) and can email it.

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | `{ok:true, db:true}` |
| POST | `/api/auth/register` | `{email, password, displayName}` → token |
| POST | `/api/auth/signin` | `{email, password}` → token |
| GET | `/api/me` | Current user |
| GET | `/api/boards` | Caller's boards |
| GET | `/api/boards/:id` | Full board graph |
| POST | `/api/ops` | Apply a mutation `{type, boardId, payload, opId}` |
| GET | `/api/boards/:id/export` | JSON export |
| POST | `/api/share/link` | `{boardId}` → `{url, token}` |
| GET | `/api/s/:token` | Public read-only graph |
| POST | `/api/share` | `{email, boardId, image}` link + optional PNG |
| GET | `/api/admin/snapshot` | Full dump for grading |
| POST/GET | `/api/admin/reset` | Empty DB when `BOARDLOOM_ADMIN_RESET=1` |
