# Brickfall 1.0.0: prepared five-dimension release

Completed local preparation September 12, 2026, after the interrupted September
11 migration. Upload only [brickfall-breaker-arcade.zip](brickfall-breaker-arcade.zip).
The editable source is `projects/brickfall-breaker-arcade/`; original v0,
historical reports and all previous ZIPs remain untouched.

SHA-256: `471d8f11b260fa9b4e8b33c7574b2da55b701274bee8dafdf1c91601a8ee312a`

## Current configuration

- Task name `brickfall-breaker-arcade`, version `1.0.0`, 32 packaged files.
- Public agent and separate public verifier. Platform-provided native OpenAI
  credential reference, Codex judge, `gpt-5.6-luna`, reasoning effort `max`.
  No provider-key setup/remapping in the runner or Dockerfiles.
- Bazaarbridge commerce task key structure and operational settings;
  Docketlight top judge weights. Required XLSX libraries/assets retained.
- Five dimensions: 2 Render, 2 Constraints, 22 Functional, 5 interaction Polish,
  6 appearance-only Visual. Final gated reward remains 60%/20%/20%.
- Build/agent/verifier budgets 600/7200/13200 seconds. Serial dimension budgets
  sum to 12000 inside the 12600-second wrapper. No paid runs launched locally.

## Completed source work

The previously saved migration standardized both Dockerfiles/task.toml and split
interaction Polish from six Visual axes. All 22 Functional definitions and their
weights, original Render/Constraints definitions, instructions and seed data
are preserved exactly against the pre-migration snapshot. See the earlier
`1.0.0-reference-standard/verifier-changes.json` for the presentation split.

This completion adds plain-text r1 prompt identifiers in all dimensions and
runner SHA-256 provenance logging. Functional guidance clarifies snapshot
evidence without adding extra visible telemetry requirements. Functional and
Polish describe the pinned runner's verified serial order and preserve later
dimensions' ability to use already-mutated Polly state. Gate contexts are closed
without signing out/revoking other sessions or changing ranked state.

One genuine golden presentation bug was fixed: the mobile ready-overlay card
clipped its Launch button. Four mobile-only CSS declarations now compact the
card and contain overflow. The source server, client gameplay JavaScript,
physics, scoring, authentication and persistence logic are unchanged. Before:
`attempt-5/arcade-mobile.png`; after: `attempt-6/arcade-mobile.png`.

## Fresh validation on final source

Authoritative successful evidence is **attempt-6/**. Earlier attempts are retained
as diagnostics, not presented as final validation.

- 116 local standard checks, including exact operational configuration and
  judge settings, five prompt identifiers, nested budgets and reward formula.
- 36 real-browser groups: 5 global-gate groups, 12 general gameplay groups,
  8 focused mechanics/terminal groups, 3 coordination/security groups,
  8 interaction/presentation groups. Names are in passed-browser-groups.json.
- All seven real-engine drills, ten independently derived manifest hashes,
  Mira freeze/terminal/receipt/refresh/R restart, Dev extra-life/unlock/progress
  receipt, Polly records, stale-write nonmutation, distinct bearer sessions,
  account-wide revocation and profile isolation were exercised locally.
- Desktop and 375px checks: labels/focus, six HUD values, pointer/keyboard,
  actual browser touch input, Assist/manual takeover, reduced motion, history
  preview and mobile action visibility. The overlay button's bottom edge is
  verified hittable and contained by the stage. Screenshots were inspected.
- A genuine process restart preserved every row in all 13 SQLite tables;
  the restart did not run solve.sh, clear the database or reseed it.
- Bash/Node syntax; RewardKit discovery of 37 criteria; real pinned scheduling
  order Constraints, Functional, Polish, Render, Visual; no-op zero handling;
  prompt/runner hashes; five-dimension CTRF; 135 reward combinations and 40
  malformed score values tested. A trusted local judge stub produced .58 for
  injected scores solely to test arithmetic; .58 is not an Oracle result.
- ZIP CRC and per-file source hashes match exactly, with one
  `brickfall-breaker-arcade/` wrapper and no reports, credentials, databases,
  caches or node_modules. See package-audit.json.

## Limitations and handover

Exact agent and verifier Docker builds were attempted but did not complete:
the agent build encountered corporate-proxy DNS failures; the verifier build
encountered package-download read timeouts. Logs and build-results.json retain
the failures. We did not alter proxy/TLS settings or claim successful builds.
Local runtime tests used cached `brickfall-preflight-verifier:2.0.4` tooling
with the final source mounted read-only in disposable offline containers.
The packaged networking settings are both public.

No full paid Oracle/model or platform 53-point semantic QC run was performed.
The local regressions are not all natural-language observations being scored
by the judge. In particular, the rapid-double-activation subcheck and every
possible animation trajectory were not independently re-executed. Visual
quality has not received a new LLM score. The previous accepted-task scores
belong to earlier packages and do not validate this ZIP.

See QC_REVIEW.md for coverage, fairness and remaining policy risks. Next step:
upload this ZIP for fresh platform QC, then Oracle/model runs if QC permits.
Do not promise Oracle 1.0 or treat the cached-image tests as exact-image proof.

## Reproduction

`python local.py 7` creates a new evidence directory rather than replacing
attempt-6. `python package.py` validates and packages the current source using
attempt-6 evidence and preserved-baseline comparisons. If source changes,
update the validation/evidence reference before making another release.
