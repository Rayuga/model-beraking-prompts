# Credentials and environment

Signalworks has **no third-party integrations**. There is no payment provider, no
mapping service and no mail service, and the application needs no outbound
network access at all.

## Application accounts

Every seeded sign-in uses the password `password123`. The accounts are listed in
`/instructions/overview.md` and in the seed roster at
`/assets/artifacts/signalworks_seed_data.json`.

## Environment variables

| Variable | Meaning | Default |
|---|---|---|
| `PORT` | the port the single process listens on | `3000` |

No API keys are used, required, or injected.
