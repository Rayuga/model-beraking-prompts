# Dropline Four Connect — transplantation and tactical proofs

Prepared September 14, 2026. This is a new candidate, not a completed platform evaluation.

## Upload artifact

`dropline-four-connect.zip`

SHA-256: `b13f4f186f444996f08ce77f1bfc3cd44aa28c0802aeb32880926eb8f8e970b7`

Exactly one `dropline-four-connect/` wrapper and 39 task files. The archive was CRC-tested and every member compared with its current source SHA-256. No database, installed dependencies, caches, credentials, local reports or authoring notes are included. `package-verification.json` contains every member hash. Historical packages/reports were not replaced.

Active source: `projects/dropline-four-connect/`. Version remains `1.0.0`, as required by the shared template. Changed Functional, Polish and Visual prompt markers are revision r3; unchanged Render/Constraints remain r1. Operational configuration, both Dockerfiles, reward formula and lifecycle helper are unchanged from the pre-feature snapshot. Public agent and separate verifier networking remain enabled. The standard Codex / gpt-5.6-luna / max environment is retained; no individual judge/model settings were added to dimension files.

## Implemented

1. **Subtree transplantation:** select an owned source branch and destination position; preview every replayed edge, gravity/turn/terminal result and mapping; recursively reuse existing edges; reject the first illegal descendant in deterministic order; commit atomically with both source and destination revisions checked. Same-study/descendant transplantation uses a frozen source tree, not recursively created copies. Original nodes/cursors and competitive state stay intact. Valid previews and successful/rejected commit receipts survive restart.
2. **Bounded tactical analysis:** server-computed depth-1–4 adversarial search from an owned saved position; complete ordered reply tree; terminal-before-horizon rules; shortest winning and longest losing distance; full-column exclusion; exact board inspection at every proof path; deterministic repeated/restarted results without saved-state mutation. Unknown is distinct from draw.

The golden solution implements both, including pending-click guards, stale-preview recovery, report invalidation, accessible feedback, keyboard controls and narrow layouts. A savepoint also prevents controlled rejected analysis operations from leaving partial writes before their rejection receipt is stored.

The previous visual repairs are preserved. New tools use the same palette/components; desktop preview and proof boards sit beside their paths, mobile panels stack. Populated screenshots, not empty shells, were inspected.

## Verifier and fairness review

There are 60 app criteria: Render 2, Constraints 2, Functional 43, Polish 7, Visual 6. All 42 previous criterion IDs, types and weights remain. Added 16 Functional criteria (26 total weight) and 2 Polish workflow criteria (1.5 total weight). Functional is still 60% of reward; Polish and Visual are still 20% each, behind the original gates. No prior failure was removed or made an automatic pass.

The 16 new Functional criteria independently exercise replayed preview positions, atomic mapping, recursive identity reuse, same-study finite copying, illegal descendants, dual-revision conflicts, durable receipts, privacy/input validation, terminal/horizon distinction, forced forks, adversarial defence and resistance distances, full columns/draws, complete proof trees, read-only repeatability, report request boundaries and independent same-name studies. The last item checks an existing brief requirement that earlier runs did not specifically exercise.

Functional setup uses fresh studies and explicitly restores a completed source if an earlier criterion unarchived it. Only the existing final lifecycle criterion performs its two restarts; it now also checks preview/receipt/proof persistence. There is still one lifecycle helper. Polish/Visual create their own Jordan studies and do not change competitive games or Functional's studies.

Routes and payload names are discovered from the live UI, not hardcoded to the reference. Reports are explicitly required to be server-computed in the brief. Full proof data may be inspected through its actual response and lazy UI; an arbitrary implementation schema is not required. Pending-repeat checks require a second activation before the first response is delivered. Separate-login checks compare real responses from separate browser contexts. Static labels and dynamic tool workflows are distinguished to avoid awarding the same usability evidence twice. See `QC-ALIGNMENT.md`.

## Tests completed on this candidate

- **139 shared standard checks:** exact template key paths/operational values, five dimensions, TOML/runner wiring, timeout nesting, public networking, environment settings and supported judge configuration.
- **49 unpaid regression groups:** all original game and analysis regressions plus new transplant/search/browser cases. Exact names/results are in `regressions.json` and `runner-logs/rewardkit.log`.
- **12 tactical fixtures checked against a separately written Python solver:** empty depth-four tree (2,801 nodes), immediate win, shallow/deep fork, forced loss, blocking move, full column, final draw move, terminal win/draw, shortest win and longest resistance. The reference solver does not import the golden engine.
- **Real-browser tool checks:** preview/commit, mapping inspection, keyboard activation, complete depth-four path `[4,4,2,3]`, 42-cell inspected boards, pending response holds with exactly one request, stale conflict/re-preview recovery, report clearing after Undo, desktop/mobile populated layouts and reduced motion. These are included in the 49 groups, not additional groups.
- **Two actual runner-helper restarts:** competitive state, all saved study trees/cursors, original and new accepted/rejected receipts, tactical report and a previously uncommitted preview persisted. The preview was committed only after unchanged-state checks.
- **3 additional layout groups:** 1280px and 375px populated replay/analysis, 60-character titles, no horizontal overflow, consistent palette/42-cell boards; reduced motion.
- **Syntax/install checks:** actual `solution/solve.sh`, Node syntax for server/browser modules and embedded script, Bash syntax for solve/runner/lifecycle scripts, JSON/TOML parsing. The actual `tests/test.sh` launched the installed app with its readiness probe and unprivileged runtime.
- **12 reward postprocessor cases:** valid weighted/perfect/zero outcomes and render/constraints gates; missing, boolean, string, null, negative, above-one and nonfinite values reject. The local stand-in's synthetic 0.58 only tests formula/CTRF plumbing; it is NOT an Oracle score.
- **Package checks:** all original criterion IDs/types/weights preserved, current runner/judge/prompt provenance matches, one wrapper/39 exact files, no unwanted artifacts, source hashes/CRC verified, `git diff --check` clean (Git emitted only line-ending conversion warnings).

## Not established / remaining risks

- No paid Oracle or model run and no platform rubric run were launched. Local browser/regression success is not an LLM judge result. Oracle 1.0, a perfect Visual score and GPT-mini below 0.70 are not guaranteed. Previous platform results describe the older task, not this candidate.
- Fresh exact Docker builds were attempted. The agent build stalled contacting Debian and was cancelled; the verifier build failed after repeated PyPI read timeouts. This does not establish successful current-image builds. Local regressions used cached `dropline-verifier-local:v6.0.3`, a cached-image-only Chromium path symlink, current installed source and real runner with an unpaid RewardKit stand-in. No dependency/credential changes were made to work around the host's network issue.
- The full 60-criterion LLM journey has not been timed. Configured timeouts remain the reference values: agent 7,200s; dimension sum 12,000s; wrapper 12,600s; verifier 13,200s. Expanded setup/proof inspection may consume substantial judging time. Platform QC/Oracle must confirm feasibility under those budgets.
- The attached QC workbook contains older offline/allowlist wording that conflicts with the newer explicit public-network standard. This candidate follows the current standard and does not reintroduce an off-origin-asset failure gate.
- The model now must implement useful recursive data transformations and adversarial reasoning, not merely face tighter weights or hidden tests. Whether that is sufficient difficulty requires fresh measured runs.

Next: upload this ZIP, run platform static/rubric checks and Oracle, then evaluate the target models against the same package. No commit or push was made for this turn.
