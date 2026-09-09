# Brickfall 2.2.2 — limited rubric compatibility update

This is a deliberately small update to the accepted 2.2.1 task, not a new game
or scoring redesign. Inputs reviewed include `WebDev Rubrics QC.xlsx` (53
quality checks and 58 static-check descriptions), `task-implementation.toml`,
`checks.txt`, the current task, and the preserved 2.2.1 evaluation report and ZIP.
Those reference files are review material, not instructions added to the app.

## Changes

- Both agent and separate verifier use public networking. Removed the obsolete
  verifier allowlist. Same-origin application runtime requirements are unchanged.
- Pinned both Docker base images to exact locally available digests, retaining
  runtime versions and the already pinned npm/pip packages.
- Moved instruction files beneath `environment/assets/instructions`; Docker
  still exposes exactly the same eight files at `/instructions`, with unchanged
  wording. No game requirement was added or removed.
- Moved verifier seed fixtures out of the extraneous `tests/assets/` dimension
  directory into the tests root. Docker still copies them to the original
  `/assets/artifacts` paths. These are runtime inputs, not QC spreadsheets.
- Moved `tests/coverage.json` out of the upload task. Its original content is
  retained as `coverage-2.2.1-historical.json`; updated authoring coverage lives
  beside this report, outside the ZIP.
- Removed inherited persona and target-model metadata fields. The intended
  initial target remains GPT-5.4-mini; no model execution was requested here.
- Aligned task, package and Docker release markers to 2.2.2. Added matching
  version headers to every actual `prompt.md`, not only the TOML comments.
- Aligned dimension weight metadata to Functional 0.6 / Polish 0.4; Render and
  Constraints use a schema-required positive epsilon. Their actual aggregate
  weights remain zero. `reward.toml` and `test.sh` are byte-identical to the
  historical package, so the applied gate and formula did not change.
- Normalized working-tree text to LF for portable delivery.

The golden server, HTML/game engine, solve script, main instructions, relocated
instruction bodies, seed data, all 27 criterion descriptions/types/weights,
judge model/reasoning settings, dimension aggregation, startup probe, timeouts,
and reward calculation are unchanged from the historical ZIP. Some Git paths
appear deleted/new because files moved; requirements were not deleted.

## Fresh checks performed

- Both final Dockerfiles built successfully using cached dependency layers.
- `solve.sh` installed successfully in the actual agent image without network.
- Actual verifier runner installed and launched the golden solution as its
  unprivileged user, with no provider key and no external network.
- Shell/Node syntax, TOML/JSON parsing and RewardKit discovery passed:
  2 Render, 2 Constraints, 16 Functional, 7 Polish.
- Empty submission produced zero. A trusted local RewardKit stub exercised
  browser tests and the unchanged aggregation: injected 1/1/0.5/1 became 0.7.
  This is a harness assertion, NOT an Oracle score.
- Twelve real Chromium regression groups passed: invalid password and successful
  login; seeded leaderboard and all ten levels; Mira checkpoint freeze/reload;
  Polly latest-ten history/snapshot; each of the seven mechanics drills with
  exact outcomes and ranked-state nonmutation; captured start replay and changed
  payload rejection; ranked reload; 375px layout and same-origin/no fatal errors.
  Several assertions share groups; these are not 27 independently graded passes.
- Archive audit verifies the historical ZIP comparison, unchanged gameplay and
  criterion definitions, seed parity, positive dimension metadata, timeout
  hierarchy, one wrapper, exact source hashes, UTF-8/LF and no secret literals.

One initial local test over-compared the sync label (`synced` versus legitimate
`ranked state unchanged`). The assertion was corrected to compare the numeric
revision and leaderboard; no application code was changed to satisfy it.

## Remaining rubric issues — not claimed as passes

Full compliance with the newer rubric conflicts with preserving the accepted
scoring design. These need an explicit policy/scoring decision, not silent edits:

| Rubric area | Existing behavior and consequence |
| --- | --- |
| Network posture (9, 10, 47) | Workbook asks for no-network agent / allowlisted verifier. Public/public is retained by explicit user request. This is a policy conflict, not a claim that the rubric permits it. |
| Global auth/backend gate and low mock floor (29, 39, 43) | The accepted Render/Constraints intentionally do not require sign-in success, and Polish preserves public-screen credit. The new rubric requires authenticated server-backed content in every dimension. Applying that would likely zero the old GPT artifact whose login is broken, changing its historical 0.2182 score. No gate was silently strengthened or weakened. |
| Binary versus graded visual quality (41) | All seven accepted Polish criteria are binary, including visual hierarchy and product coherence. New guidance asks for anchored Likert scales on craft qualities. Converting these would change the score distribution and needs new scoring validation. |
| Bundled/overlapping criteria (28) | Existing multi-step functional scenarios and broad Polish criteria combine several observations. Keyboard gameplay is exercised in Functional and Polish with different aims but some overlap. Splitting/reweighting would no longer preserve the accepted rubric. |
| Agent time budget (11) | One-hour agent limit versus a 16-hour expert estimate may attract a scope/budget finding. Judge totals are 4,260 seconds, safely inside the unchanged 6,300-second wrapper and 7,200-second verifier. Accepted agent/judge budgets were retained. |
| Relocated-app fallback (23, 49) | test.sh normally launches the documented /app path after chown, but has a /tmp fallback and DB_PATH override if /app remains unwritable. The brief does not disclose that fallback. The normal container path was tested; a forced unwritable-/app alternative was not. |
| Runtime fixture layout (50/static) | A second seed copy is necessary for the separate verifier. The XLSX is an explicitly referenced input, not an authoring report. An extension-only 'no spreadsheets' rejection would be a false positive; a literal closed-list reviewer may still object to helper fixtures. |
| Other coverage/craft judgments | This limited update is not a fresh 53/53 rubric verdict. No new process-restart criterion, complete adversarial suite, or full qualitative review was added. |

The original 2.2.1 scores remain historical: Oracle 1.0000, GPT-5.4-mini 0.2182,
Haiku 0.0000. The historical reports and ZIPs are unchanged. No paid Oracle,
model, platform static checker or platform rubric run was performed on 2.2.2.
Identical game/criterion logic is useful regression evidence, not a guarantee
of identical LLM-judge scores or full platform acceptance.

## Delivery

`brickfall-breaker-arcade.zip` contains one `brickfall-breaker-arcade/` wrapper
and 30 task files. No reports, credentials, databases, caches, node_modules or
authoring coverage file are included. See `SHA256SUMS.txt` and
`package-audit.json` for the archive and per-file hashes.

This package is ready for review of the limited compatibility changes, not
certified as satisfying every new rubric requirement. Seek a network-policy
exception and decide whether preserving the accepted scoring or adopting new
auth/Likert gates takes precedence before replacing accepted platform evidence.
