# DropLine: branching-analysis release

Task: `dropline-four-connect`; literal version: `1.0.0`.
Source: `projects/dropline-four-connect/`.
Upload: `dropline-four-connect.zip` in this folder.
SHA-256: `3fc002b83dcdd30b0348ae1c882b9f0809354a3ff954c5b3a493e5e5c569cc83`.

The ZIP contains exactly one `dropline-four-connect/` wrapper and 36 files.
Every member matches its source SHA-256; CRC verification passed. No databases,
node_modules, caches, authoring reports, baseline copies or credentials are
included. The required task.toml credential placeholder is not an embedded key.
Historical ZIP and the 32-file pre-hardening source snapshot are unchanged.

## What changed

The user approved new product features rather than simply harsher checks:

- Create private named analyses from any completed-match replay step.
- Freeze the source prefix; preserve sibling and nested continuation branches.
- Select nodes, Undo to parent, explicitly choose Redo branches, and reuse an
  existing same-parent/same-column edge instead of duplicating it.
- Compare any two positions, showing full boards, common opening length and
  coordinate-labelled, non-color-only cell differences.
- Keep practice results completely separate from competitive scores/history.
- Persist study names, source snapshots, nodes, current selection, revision
  and operation receipts through reload and server restart.
- Enforce ownership, cross-study node boundaries, optimistic concurrency,
  exact retry receipts and atomic rejection of invalid input on the server.

Golden additions: `solution/app/analysis.js`, `public/analysis.js` and
`public/analysis.css`; small server/HTML integration. No change to classic
game-rule functions, score calculation or seed workbooks. Comparison/branch
options include move paths so similar last-move labels are distinguishable.

Added the complete product contract in `instructions/analysis.md`; updated
the root request, overview, persistence instructions and APP_MANIFEST routes.
No hidden fixed API routes or JSON-field names are required by the rubric.
The comparison may run client-side over server-populated positions.

## Verifier/configuration preservation

All 30 previous criterion IDs, types and individual weights are retained.
There are now 42 criteria: Render 2, Constraints 2, Functional 27, Polish 5,
Visual 6. Eleven new Functional criteria test the new product behavior and
one new Polish criterion tests analysis keyboard actions/feedback. Existing
layout/labels/visual checks also cover the added required surfaces.

Functional criterion weights total 40.5 (previously 21.5), Polish 4
(previously 3), Visual 6. Dimension weights/formula remain 60/20/20, with
unchanged Render/Constraints zero gates. No previous requirement was removed
and no previous weight reduced to improve a model's score.

New criteria state bounded setup and numbered observations. They use fresh
studies and relative list counts, accept submitted route/field shapes, and
reserve controlled requests for explicit server rejection/retry checks.
Analysis setup does not mutate the competitive seed. Polish/Visual create
their own Jordan studies and never edit Functional's studies or play ordinary
matches. The existing single restart criterion and existing lifecycle helper
are reused; no duplicate restart criterion/helper was introduced.

Functional/Polish/Visual prompt revision markers are r2. Render/Constraints
remain unchanged at r1. Operational task.toml values, both Dockerfiles,
test.sh, reward.toml and lifecycle helper are unchanged from the baseline.
Agent and separate verifier are both public-network. Standard platform
environment selects Codex, `gpt-5.6-luna`, reasoning `max`; no individual
judge/model keys were added to judge.toml. No API key is mentioned in either
Dockerfile or test.sh.

Budgets remain agent 7200, environment build 600, verifier 13200 seconds;
judge budgets 600+600+9000+900+900 = 12000, serial wrapper 12600. These nest
correctly; paid judge wall-clock sufficiency is not established locally.

## Fresh unpaid evidence

- `standard-check.json`: all 121 shared-format checks passed.
- `regressions.json`: all 27 groups passed on final source (attempt 3).
- JavaScript syntax: server.js, analysis backend, analysis frontend, embedded
  HTML script and both regression scripts passed Node checks.
- Shell syntax: solve.sh, test.sh and app-lifecycle.sh passed bash -n.
- All source TOML files parsed; all previous criterion IDs/types/weights
  preserved; workbook copies are byte-identical.
- `package-verification.json`: ten actual reward-postprocessor cases passed:
  all-one; each zero gate; partial positive gates; missing Visual; boolean;
  NaN; infinity; out-of-range; string. ZIP/member hashes and exclusions passed.
- The actual test.sh startup/manifest/readiness/lifecycle/post-processing ran
  with an explicitly unpaid RewardKit stub. Its synthetic 0.58 output tests
  the formula/CTRF only; it is NOT an Oracle or model score.

The 27 regression groups include all original exact seeded-state, eight
color/direction win, draw, history/branch, archive, authentication, keyboard,
stale-tab, duplicate-pending and revocation checks. Added groups exercise:

1. Exact frozen prefixes, creation counts, trimmed name, empty/terminal roots.
2. Sibling/nested paths, exact boards and stable child identities.
3. Comparison prefix 6, differing indices 28/38/39, symmetry, identical-node
   comparison and unchanged saved state.
4. Practice win/draw, root boundaries, terminal locks and competitive isolation.
5. Malformed-field rejection, full column and invalid Redo without partial writes.
6. Foreign account/source/node isolation and revoked sessions.
7. Accepted/rejected exact replay and changed-payload identifier conflicts.
8. Frozen studies surviving source unarchiving and a new competitive game.
9. Real-browser fork/tree/nesting/rename/reload/compare at desktop and mobile.
10. Real-browser arrow/Home/End/Enter/Space focus, stale recovery and delayed
    duplicate-pending activation.

The existing lifecycle group additionally snapshots both accounts' complete
analysis collections, names, edges, positions, selected cursor and revisions,
and verifies them plus accepted/rejected receipts across TWO actual restarts.
Desktop/mobile screenshots are included as evidence, not inside the task ZIP.

## Attempts, limitations and next step

Attempt 1 stopped because the cached image lacked `/usr/local/bin/chromium`.
The browser itself was already installed at
`/opt/playwright-browsers/chromium-1237/chrome-linux64/chrome`. A local container
symlink restored the path already supplied by the current verifier Dockerfile.
This was a test-environment problem, not a golden-solution pass/fail verdict.
Its failed log and partial regression result are retained. Attempt 2 passed
all 27 groups. After the branch-path label improvement, final attempt 3 again
passed all 27 groups and syntax checks. Earlier attempt logs are preserved.

Both fresh Docker builds FAILED because of this workstation's network:
agent apt requests could not resolve proxy `ioclrndwg2.ds.indianoil.in`;
verifier pip repeatedly timed out reaching PyPI before resolving pyyaml.
See `agent-build.log` and `verifier-build.log`. No proxy bypass or dependency
unpinning was performed. Local behavior used cached
`dropline-verifier-local:v6.0.3` with the browser-path shim, NOT a successful
build of the exact new images. Exact image build/install compatibility remains
unverified here.

No paid Oracle, model run, full platform static suite or 53-item semantic
rubric QC was run. Local checks do not establish future Oracle 1.0 or a GPT
score below 0.7. Some behavior was tested directly through the reference API
as well as browser flows, not by executing every natural-language judge step.
Visual appearance was inspected, not scored by a paid judge. Large-study
stress/performance and exhaustive keyboard traversal are not certified.

The uploaded BASELINE scored Oracle 1.0000, GPT 0.7721, Gemini 0.9442 and Haiku
0.2839. Those are historical results for the simpler task; none validate this
new package or predict scores after implementing the additional features.
All baseline attempts remain in RUN-REVIEW.md/run-review.json. Do not submit
old run exports as evidence for this checksum. Upload this ZIP for fresh QC,
then Oracle and all required target-model runs before calling it accepted.
