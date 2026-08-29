# MedLedger — App Manifest

## Start

```bash start
npm start
```

The server listens on `0.0.0.0:${PORT:-3000}`. `GET /health` returns `{"ok": true}`.

## Persistence

- Engine: SQLite via `better-sqlite3` (Harbor image) with `node:sqlite` fallback for local dev.
- DB path: `/app/data/medledger.db`
- Schema + deterministic seed run automatically on startup; a fresh database is
  provisioned idempotently, and restarting is safe.

## Integrations (test-mode + offline twin)

| Integration | Live variable(s) | Offline switch |
| --- | --- | --- |
| Stripe (patient copay / statement) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | `STRIPE_OFFLINE=true` |
| DocuSeal (consent / attestation / credentialing) | `DOCUSEAL_API_KEY`, `DOCUSEAL_BASE_URL`, `DOCUSEAL_TEMPLATE_ID` | `DOCUSEAL_DRY_RUN=true` |

Patient payments use Stripe's real test-mode hosted Checkout (redirect + a
signature-verifying, idempotent `POST /api/stripe/webhook`), reconciling the
session server-side on the success redirect. Consent/attestation runs the
DocuSeal envelope state machine (SENT → EXECUTED). Any provider error degrades to
a deterministic offline twin producing the same rows. Test keys only.

## Demo identity

No password login. The header **Switch demo user** control sends `X-User-Id`;
the server validates the id on every request and rejects unknown/disabled users
(no fallback to the administrator). Default user: **Ada Admin**
(`ADMINISTRATOR`, `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`).

## Authorization

Site scope and record access are enforced server-side. Citywide roles
(administrator, billing clerk, compliance officer, transport dispatcher) reach
every site; others are scoped to their assigned site.

## Fixed clock

The clinical clock is `2026-08-17T10:00:00.000Z` so aging, expiry and HOS windows
are deterministic. `POST /api/admin/close-of-shift` runs the end-of-shift
sweep/age/flag/reconcile.
