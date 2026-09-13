# Pellmoor delivery — 13 September 2026

## Package

- Active source: `projects/pellmoor-job-pipeline`.
- Task identity remains `turing/pellmoor-job-pipeline`; ZIP wrapper is exactly
  `pellmoor-job-pipeline/`. The task version is `1.0.0` under the current shared
  standard, replacing the previous source's `2.0.12` marker.
- Upload only `pellmoor-job-pipeline.zip` from this delivery directory.
- SHA-256: `17844cb2c8c331c317881930fabea849869c0f9162121322d6638abf487f228f`.
- 32 task files; archive CRC and every entry's SHA-256 match the source.
- No databases, installed dependencies, credentials, caches, reports or authoring
  scripts in the ZIP. The intended demo password is retained.
- Original source is preserved in `source-before-standard/`; its hashes were
  checked against `migration.json`. Earlier deliveries were not overwritten.

## Configuration changes

Aligned the task and runner with `TASK_TEMPLATE_STANDARD.md`, using the
Bazaarbridge configuration and Docketlight dimension-weight standard. Both
agent and separate verifier have public networking. Native Codex uses
`gpt-5.6-luna` with `max` effort from the shared configuration. The only key
configuration is the platform placeholder in `task.toml`; neither Dockerfile
nor `tests/test.sh` mentions or remaps provider API keys.

Five dimensions now use the standard 60% Functional, 20% Polish, 20% Visual
formula with Render/Constraints gates. Budgets are 7200 seconds for the agent,
600 for the environment build, 13200 for the verifier, and 12600 for the serial
RewardKit wrapper. Judge budgets sum to 12000 seconds. These numbers match the
standard; sufficiency in a full paid run remains unmeasured.

The app is built before handoff. The verifier starts the documented server
directly, as an unprivileged user with an isolated environment, rather than
executing an arbitrary submission's build script as verifier root. A single
managed lifecycle helper provides the restart persistence check.

## Verifier and instruction changes

- All 36 previous criterion IDs and individual weights are retained.
- Counts: Render 2, Constraints 2, Functional 24, Polish 10, Visual 6: **44 total**.
- Moved worded-action feedback and pending-save checks from Polish to Functional
  so presentation judges no longer mutate the seed before Functional evaluates
  it. Their weights remain 1 each. Presentation dimensions use current state and
  read-only navigation rather than assuming the initial vacancy is still empty.
- Added the six standard anchored Visual axes, plus manifest-route coverage and
  backstep/terminal-loss coverage (0.5 each). Functional weight total is now 31.
  Historical four-dimension scores are not comparable to this package.
- Kept real server-backed authentication in every global gate, without blanket
  failure for public assets. Gates accept server-rendered data and discovered
  routes instead of mandating an undisclosed JSON read API.
- A forbidden action hidden by the UI can be negatively tested through its
  observed write route; the judge does not require a button that should be
  hidden. Worded server rejection evidence is valid for such probes.
- Specified prebuilt delivery, APP_MANIFEST.md, visual presentation and non-colour
  state markers in the brief. Documented chronological revisits in stage history.
- Retained seed-first Functional ordering, exact state comparisons, all role,
  panel, scoring, concurrency and retry checks. Extended successful-backstep
  and malformed-score observations; added a single late backstep-loss workflow.
- Extended the existing durable-audit criterion to restart the actual app and
  compare all saved state. No second restart helper or duplicate restart
  criterion was introduced.

`coverage-preservation.json` records every old and new criterion ID/weight.

## Golden-solution repairs

1. Boolean/array/object scores could pass numeric coercion and cause a SQLite
   binding error. The reproduced Boolean request returned HTTP 500. Scores now
   require actual integer numbers; the same request returns 400 without mutation.
2. Stage history discarded repeated visits. After interview → screening →
   withdrawn, the funnel incorrectly counted a loss at interview. History now
   retains each visit, so loss is at screening and reached totals stay unique.
   Only the latest history entry carries the current-step marker.
3. Vacancy sidebar totals/revisions now refresh with accepted/stale snapshots.
4. The selected vacancy has a visible worded marker, not colour alone.
5. The theme toggle follows the actually rendered theme, fixing an initial
   no-change click when the browser prefers dark mode but the app starts light.

Before/after evidence for the two backend defects is in
`edge-regressions-before-fix.json` and `edge-regressions.json`.

## Tests actually completed

- **123 local shared-standard checks**, all passed (`standard-check.json`).
- **19 local regression groups**, all passed (`regressions.json`): authentication
  and independent-session revocation; exact seed and funnel; browser login and
  reload; duplicate/cross-vacancy creation; role enforcement and legal moves;
  invalid/terminal moves; score boundaries and malformed types; full panel-to-offer
  UI workflow; append-only notes; stale UI refresh/retry; simultaneous writes;
  success/rejection receipt replay; malformed metadata/unknown IDs/forged fields;
  delayed-response duplicate prevention; read-only desktop/mobile/keyboard/theme
  behavior; OS-dark theme toggle; UI backstep/withdrawal; backend edge cases;
  actual process restart with exact state, session and receipt preservation.
- Node syntax checks for backend server/rules and the local test harness;
  `bash -n` for solve.sh, test.sh and app-lifecycle.sh; all TOML and embedded
  runner Python blocks parsed; golden TypeScript bundled successfully with esbuild.
- **10 reward-postprocessor cases** passed, including both zero gates, positive
  partial gates, mixed scores, missing dimension, Boolean, NaN, infinity,
  out-of-range and string inputs (`package-verification.json`).
- Executed the real runner, readiness probe, unprivileged app launch and managed
  restart. A local stub supplied synthetic dimensions to test reward wiring.
  Its **0.58 is a fixture result, not an Oracle or model score**.
- Archive hash/CRC, clean one-wrapper layout, seed consistency, preserved legacy
  weights, Linux line endings and prohibited-file/key scans passed.

The final behavioral run used cached image `pellmoor-tests:2.0.3` with current
source/tests copied into it. The local API harness uses fresh HTTP connections
so an intentional process restart cannot reuse a dead keep-alive socket.
Earlier local test mistakes (200 vs 201 for score saves, 405 vs 409 for
append-only rejection) were corrected without changing the app's valid statuses.

## Not established yet / remaining risks

- **Both exact new Docker builds were attempted but did not complete.** The agent
  build could not resolve the locally configured proxy
  `ioclrndwg2.ds.indianoil.in`. The verifier reached pinned package installation
  but timed out reaching PyPI. Logs are `docker-environment.log` and
  `docker-tests.log`. Cached-image regressions do not validate these new images.
- No paid Oracle/model run and no platform 53-item semantic rubric run were
  launched. The 123 local checks are not a claim that platform QC passed.
- No current Pellmoor platform run directory was found in `run-outputs`; no
  historical run is presented as validation of this checksum.
- Local browser checks exercise the major workflows, but do not replicate all
  future judge navigation choices or assign Visual/Polish scores. Full keyboard
  reachability of every control, all visual anchors and full-budget completion
  still require platform review.
- Legacy compound criteria were retained rather than removing coverage to obtain
  a score. A semantic reviewer may still request finer-grained scoring.

Next step: fresh platform upload checks and rubric QC, then Oracle and target
model runs on this exact ZIP. Oracle 1.0 and target score ranges are not guaranteed.
