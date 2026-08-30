# Oriel Permitworks

Build the City of Oriel's internal desktop permit-operations application. It
must provide an authenticated, role-aware browser workspace for intake, plans
review, zoning assessment, fee-waiver approval, receipt entry, inspections,
certificate release, and audit review. Use Node.js, Express, and SQLite; serve
the UI and server from `0.0.0.0:3000`; and preserve state across restart.

The complete product contract is split across the five files in
`/instructions`. Public starting records are also supplied in
`/assets/artifacts/oriel_seed_data.json`. Implement the visible operating workflows and
their server-enforced authorization/integrity rules without assuming a
particular route, DOM structure, control label, or response envelope.
