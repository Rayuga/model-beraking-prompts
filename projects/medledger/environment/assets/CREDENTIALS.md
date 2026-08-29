# Environment Variables

SQLite is local and needs no database credentials.

## Stripe (patient copay / statement payments) — REAL test mode

| Variable | Description |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe secret key — **`sk_test_…` test mode only, never `sk_live_`** |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` secret used to verify (and, for the twin, sign) `checkout.session.completed` events |
| `STRIPE_OFFLINE` | leave unset for real Checkout; `true` forces the offline twin |

Patient payments use Stripe's **real hosted Checkout** (test mode): the payer pays
on the Checkout screen with the Stripe **test card 4242 4242 4242 4242 (exp 12/34,
cvc 123, ZIP 42424)** and returns to the app, which reconciles the session
server-side on the redirect. A signature-verifying, idempotent
`POST /api/stripe/webhook` records the definitive settlement. **Any Stripe error
degrades to a deterministic offline twin** producing the same DB rows, so workflows
always complete. Test keys only — never a live key. Egress is required to
`checkout.stripe.com`, `api.stripe.com` and `*.stripe.com`. The verifier grades the
app's OWN `payments` / `charges` / `gl_lines` rows and the Checkout screen, never
the provider's word.

## DocuSeal (consent / attestation / credentialing) — twin by default

| Variable | Description |
| --- | --- |
| `DOCUSEAL_DRY_RUN` | `true` (default) runs the deterministic envelope twin |
| `DOCUSEAL_API_KEY` / `DOCUSEAL_BASE_URL` / `DOCUSEAL_TEMPLATE_ID` | supply all three to activate the real DocuSeal submissions API |

Consents and attestations are DocuSeal envelopes that walk `SENT → EXECUTED`. The
twin drives the same state machine and writes the same `envelopes` row and
downstream gate, so criteria pass identically in twin and live modes. The verifier
grades `envelopes.status` and the downstream claim/panel gate, never the provider.

## Application

- `PORT` — defaults to `3000`.
- `BASE_URL` / `APP_PUBLIC_URL` — browser origin, defaults to `http://localhost:3000`.
- `/assets/artifacts/roster_seed_data.json` — the health system's seed data: every record (patients,
  providers, dispenses, labs, studies, rigs, dispatches, SKUs, cycle counts,
  charges, claims, envelopes, panels) with its stable id, plus the ten staff
  sign-ins with their ids. **Load it on boot and seed exactly — do not invent
  parallel ids or identities.** It carries data only; the rules and the
  cross-domain wiring are in the brief, not here.

`OPENROUTER_API_KEY` is verifier-only and is supplied by the platform via
`${OPENROUTER_API_KEY}` — it is not placed in the agent environment.
