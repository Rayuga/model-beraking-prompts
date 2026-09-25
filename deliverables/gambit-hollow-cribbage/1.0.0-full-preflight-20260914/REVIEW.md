# Gambit final ZIP audit

Use `gambit-hollow-cribbage.zip` in this directory. The archive has 37 files and 45 criteria, with the required task-named outer folder, canonical `environment/assets/club/` layout and executable shell-script metadata.

## Findings fixed

1. Earlier upload: missing task wrapper and non-executable shell-script metadata. The archive checker now validates both explicitly.
2. Earlier platform static failures: provided files were outside `environment/assets/`. The checker now resolves references against actual ZIP members, validates local Docker COPY sources and rejects an absent asset directory before any traversal can silently pass.
3. This audit: corrupted viewport separators in the Polish prompt. Replaced with plain `1280 by 800` and `375 by 760`; Polish prompt revision is r4.
4. This audit: the runtime criterion assumed the database always lived at its default path, despite the documented DB_PATH relocation and the runner's read-only-app fallback. Functional now validates the active path recorded by the trusted runner. Functional prompt revision is r4. The read-only fallback was exercised with the actual runner and two process restarts.

Relative to the preceding asset-layout-fix ZIP, only the Functional judge description, Functional prompt and Polish prompt changed. The app, assets, Dockerfiles, reward formula, dimension weights, timeouts, criterion count and criterion weights are unchanged.

## Completed local checks

| Area | Result and evidence |
|---|---|
| Archive, provided paths and verifier structure | 361 checks passed in `archive-checks.json`; CRC, wrapper, case-sensitive references, COPY sources, UTF-8, required files, executable scripts, five dimensions, prompt markers, all 45 IDs, aggregation and anchors. |
| Exact reference configuration | 124 checks passed against the extracted final ZIP in `standard-checks.json`; task keys/operational values, verifier.env, 1.0.0, maximum effort, no forbidden overrides/key mentions, gate-first 60/20/20 reward and 12,000 < 12,600 < 13,200 timeout nesting. |
| Audit regressions | All 12 broken-archive cases rejected in `checker-regression.json`, including the original failed archives and isolated reproductions of misplaced assets, missing seed, missing prompt, wrong COPY source, lost executable permissions, CRLF script, missing version marker, duplicate JSON keys, case collisions and negative weights. |
| Browser behavior from final archive | All 22 scenario groups passed in `browser-results.json`; actual server/UI scoring, valid and invalid moves, both seat views, capped wins, show boundaries, repeated-action suppression, keyboard/mobile behavior, reload, saved-game chooser and two restarts. |
| Scoring/state-machine units | All 11 groups passed in `unit-results.json`, including all forty fixtures and all 960 hand permutations. |
| Independent fixture audit | A separate Python enumeration, which does not call the golden scoring implementation, reproduced all forty expected totals; `independent-fixture-audit.json`. |
| Runner failures and reward validation | Seven complete-runner negative/gating cases passed; 22 additional cases exercised the actual reward validator, including partial positive gates, invalid/missing dimensions, booleans, strings, nonfinite/out-of-range values and exact arithmetic. |
| Syntax, DOM and provenance | 72 additional checks passed in `extra-checks.json`; includes runtime tests above, JS/shell syntax, code/config comment-line scan, literal DOM references, and exact prompt/judge/runner/reward hashes matching the final ZIP. URLs and CSS selectors were distinguished from comments during manual review. |
| Read-only app fallback | Passed with `/app` mounted read-only and no database at `/app/gambit.db`. The runner used `/tmp/gambit-submission/gambit.db`, the SQLite signature was valid, scoring returned 29, both seat states and ladder survived two restarts, and the next discard worked. See `readonly-fallback-results.json`. |
| Visual/manual review | Reviewed desktop show and mobile populated bench screenshots, alongside the live/idle/win captures. All six visual anchors remain intact. No numerical LLM Visual score is claimed. |

The grader/brief review covered the forty fixture totals, invalid input, permutation invariance, fifteen/31/pairs/runs/go, discard/privacy, show order, immediate capped wins, alternating hands, seed/ladder updates, save/restart behavior, controls and presentation. Preset inputs are provided in the task; route schemas remain discoverable. The game is explicitly shared hot-seat without authentication. Public visual assets are permitted and game/scoring data stays local. Each dimension uses the same minimal working-table prerequisite and independent criterion verdict instructions. Review did not identify another concrete contradiction requiring a task change.

## What remains unverified

The platform's proprietary static/rubric scripts and paid Oracle judge were not run here. Local checks are not a claimed 45/45 platform static pass or 53/53 rubric pass, and cannot guarantee a first-attempt platform outcome.

Fresh image builds from the first extracted snapshot failed during package retrieval: the environment build could not resolve its configured proxy, and the verifier build hit PyPI connection/SSL failures. A direct-network probe with proxy variables cleared also failed. Final Dockerfiles and dependency-installation steps are byte-identical to that attempted snapshot; only later prompt/rubric text changed. No successful fresh build of the complete final images is asserted. Functional tests used the cached `brickfall-preflight-verifier:2.0.4` runtime with final extracted files.

`LOCAL_STUB_ONLY` rewards are injected inputs used to exercise the runner, not Oracle scores. The initial read-only diagnostic had two test-harness fetch errors (Response.ok property handling and a stale pooled connection after restart); the diagnostic was corrected without changing the app or relaxing persistence assertions. Final results passed.

## Preventing recurrence

`references/task-templates/check-upload.py` is now part of the task-making rules and checks the actual archive. Run it alongside `check-standard.py` on the archive's extracted task. The packager invokes both checks, and the regression tests demonstrate that the prior packaging failures are rejected. `final-summary.json` records the final checksum and current-source/ZIP equality. Historical audit snapshots are retained under `attempt-1/`.
