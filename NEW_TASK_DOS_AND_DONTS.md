# New WebDev task production guide

Prepared 25 September 2026 from the supplied `projects/webdev-task-template`,
local reference tasks, and recorded evaluation reviews.

Purpose: increase the number of accepted, reproducible tasks per authoring hour
by reducing scope churn, infrastructure failures, and unreliable judging.
This is an initial evidence-based guide, not a claim that a task category or
criterion count guarantees acceptance. New-template acceptance examples and
current model/score requirements still need to be supplied.

## 1. Use the current template, with historical references for product ideas

For new tasks, the user's supplied [webdev-task-template](projects/webdev-task-template/)
is the starting structure. Older BazaarBridge configuration rules in
`TASK_TEMPLATE_STANDARD.md` and `MODEL_BREAKING_PLAYBOOK.md` do not describe it.
Do not run an old checker and change a correct new package to satisfy obsolete
expectations. Preserve historical releases and their evidence.

The new template has:

- `tests/gates/render` and `tests/gates/constraints`, followed by
  `tests/scored/functional`, `polish`, and `visual`.
- `tests/scoring.toml` as the source of dimension weights, gates, and floors;
  `tests/tools/score.py` computes final reward. There is no `reward.toml`.
- A gate threshold of zero for Render/Constraints, and a Functional floor of
  0.05. Scores must be strictly above their thresholds. Gate failure skips
  the scored suite. Functional <=0.05 zeros final reward after scoring.
- Functional/Polish/Visual weights of 0.6/0.2/0.2. Criterion weights still
  belong inside each judge file; dimension weights do not.
- Claude Code as the judge runner with `z-ai/glm-5.3-flashx` through OpenRouter.
  `judge = "claude-code"` is present in each judge file. This is not an
  instruction to use a Claude model as the evaluator.
- Shared accounts/screens/URL in `tests/app_context.md`, injected into prompts.
- `/app` and `/assets` in the artifact list. Verify actual transfer during a
  run; an input file's presence in the agent container alone proves nothing.
- No `task.version` field or prompt-version/provenance logging in the supplied
  scaffold. Keep external release hashes; do not silently restore old fields.
- Node 22, Express and better-sqlite3; `/app/server.js`, port 3000,
  `/app/app.db`, `DB_PATH`, and `/api/health` in the integration instructions.
- Public network access and permitted external browser assets, but no external
  backend/data service. Read the integration contract when choosing a product.
- A single-use `restart_app` tool for the final Functional persistence check.
- The same overall timeouts: agent 7200, build 600, verifier 13200 seconds;
  judge budgets 600/600/9000/900/900. Suite wrappers are 1500 and 11100 seconds.

Pre-production harness issues to resolve once, not rediscover for every task:

1. Initial and restart launch currently execute the Node entry from `/tests`
   without changing into the app directory. Check a normal app using relative
   paths; align the launcher with the published runtime contract.
2. Confirm the current platform accepts nested judges, `scoring.toml`, missing
   task version, and the new judge settings. Existing local flat-layout QC
   scripts and historical platform messages are not proof either way.
3. Smoke-test the actual GLM judge, MCP browser, restart tool, asset transfer,
   and both Docker images before starting a batch. Static TOML parsing does
   not exercise provider/tool integration.
4. Confirm the native Visual score normalization. The new prompt describes
   0–5 anchors, while historical reports show 4/5 normalized to 0.75. Do not
   substitute hand-written normalization for actual RewardKit behavior.

## 2. What the existing evidence tells us

User-identified passed references are BazaarBridge, Docketlight, TorqueBay,
and Boardloom. Their local files are useful design evidence; this review has
not independently established their acceptance dates or matching platform runs.
They are not new-template/GLM acceptance evidence.

| Reference inspected | Functional criteria | Transferable pattern | Do not copy blindly |
| --- | ---: | --- | --- |
| BazaarBridge commerce | 24 | Reserve the last unit, reject another reservation, cancel and restore stock exactly once; invalidate approvals when underlying business state changes | Its old 4/3/2 judge weights, comments, and flat layout |
| Docketlight claims | 46 | Dedicated records for controls; newer reserve replaces older; payment retry cannot double-create or bind to another claim | Its full role/claims complexity or old offline/seed-copy contract |
| TorqueBay repair operations | 11 | Concrete operational rules: bay conflicts, compatible parts, qualified staff, approval separation, finished-work invoicing | Its legacy gate breadth and alternate app stack |
| Boardloom canvas | 29 | Judge visible outcomes: connectors stay attached, groups keep relative positions after moving and reloading | Four-dimension layout or exact canvas implementation choices |
| Ridgeline storefront | 12 | A narrow shopping journey with per-variant stock, per-line discounts and immutable order prices | Acceptance is unconfirmed here; four dimensions and older runtime restrictions |

Counts are observations, not difficulty rankings. A single long bundled
criterion can take more work than several independent short criteria.

Our recorded task results provide additional evidence:

| Task/release | Recorded Oracle | Recorded GPT-5.4-mini | Qualification |
| --- | ---: | ---: | --- |
| Brickfall current September 12 delivery | 0.9583 | 0.6094 | Oracle Functional 25/25; model deductions include evidence limitations |
| Patchpad v3 September 13 delivery | 1.0000 | 0.5605 | Oracle Functional 29/29; several model deductions lack valid checkpoints |
| DropLine September 14 delivery | 0.9917 | 0.1766 | Oracle Functional 42/42; missing/blocked model observations need separate treatment |
| Gambit September 15 delivery | 0.9833 | 0.6616 | Oracle Functional 40/40; interrupted Haiku attempts are not clean difficulty samples |
| Common Ground r27 September 17 rerun | 1.0000 | 0.5788 | 66 Functional checks; Oracle grading 65m44s, GPT grading 52m16s; some deductions are incomplete evidence |

These are recorded runs under the previous judging setup, not predicted GLM
results or a blanket statement of platform QC acceptance. Common Ground's
Oracle was reused in the later export, not a second independent Oracle pass.
The reviews do not provide authoring-hour or cost data sufficient to rank
domains by acceptance rate or productivity.

Sources:

- [Brickfall delivery](deliverables/brickfall-breaker-arcade/README.md)
- [Patchpad evidence review](deliverables/patchpad-editor-v3/run-review-20260913/RUN_REVIEW.md)
- [DropLine delivery](deliverables/dropline-four-connect/README.md)
- [Gambit run review](reports/gambit-hollow-cribbage/2026-09-15-run-review/README.md)
- [Common Ground rerun](reports/common-ground-ballot/2026-09-17-r27-rerun/README.md)
- [Earlier QC lessons](TASK_LEARNINGS_2026-09-12.md)

## 3. Initial scope and difficulty policy

Start with one coherent product, about 3–5 key screens, 2–3 connected workflows,
and roughly 15–25 focused Functional criteria. These are proposed planning
bounds, not platform rules or empirically proven optimum counts. Cover the
actual ask even if it needs fewer or more criteria. Use roles only when they
belong to the product; do not add accounts to every task for difficulty.

Choose two or three domain-specific sources of difficulty, for example:

- Reserving a scarce resource, cancelling, and restoring availability once.
- A decision that becomes invalid when the underlying record changes.
- Completing or undoing work updates several related records consistently.
- A finalized record preserves the values agreed at finalization.
- A scoped actor can perform their own valid action but cannot perform another's.
- A repeat or stale action cannot duplicate work or overwrite newer state.

Give each requirement a clear business reason and an observable outcome.
Do not give every app retries, races, multi-tab merging, approval chains and
complex receipts by default. Those systems increase both golden and judge work.

Suggested first candidates are reservation/allocation, repair/service desks,
and focused order/return workflows. These are design hypotheses based on the
references, not proven winners. Draw on domain mechanics without making
noun-swapped copies. Build-heavy editors/canvases and simulation-heavy games
can work, but defer them if equivalent discrimination is available with more
reliable form/table interactions.

Keep the old GPT 0.1–0.7 band and internal <=0.5 ambition labeled historical
until current requirements confirm the target model, reasoning setting, band,
and required comparison runs. Aim for Oracle 1.0 with every Functional check
passing; do not lower a legitimate bar to make a broken golden pass.

Do not chase an exact model score. With perfect Polish and Visual, final reward
is 0.4 + 0.6F once gates/floor pass. F must be <=0.5 for final <=0.7, and <=1/3 for
final <=0.6. A 4% or 5% Functional score zeros overall, but 6% with perfect style
scores 0.436. Thus a universal target around 0.4 is not sensible without looking
at the component scores. The new 5% floor alone does not prove a strong floor.

## 4. Do and don't

| Do | Don't |
| --- | --- |
| Reuse one validated harness and presentation foundation | Rebuild grading infrastructure for each task or copy old configuration |
| Freeze a small product scope before implementing | Add a new subsystem after every disappointing model score |
| Map each requirement to golden behavior and an observable criterion | Add hidden API paths, column conventions, card colors, layout choices or explanatory text |
| Make a short natural brief point explicitly to the detailed instructions | Hide mandatory instructions in a directory the agent is never told to read |
| Use clean positive controls before negative checks | Treat a broken action, signed-out caller or stale revision as proof of an unrelated rule |
| Record a real successful browser request before replaying it | Guess routes or invent payload fields and grade the resulting refusal |
| Use dedicated records and capture evidence before transitions | Let one destructive test consume the setup needed for many later checks |
| Give each independently valuable behavior its own verdict | Inflate criteria by duplicating evidence or bundle unrelated features into one failure |
| Reserve multi-leg checks for one coherent invariant | Use huge chains to make a single small defect erase most of Functional |
| Keep gates limited to the supplied basic runtime/authentication contract | Promote a difficult product feature into a universal zero gate |
| Grade Visual appearance independently of feature correctness | Deduct the same functional bug again merely because Visual saw the affected screen |
| Use real browser acceptance checks during golden and model development | Stop at successful curl/API responses while buttons or cards remain broken |
| Stop the recorded app PID when restarting | Use broad `pkill -f` matching text also present in the agent command line |
| Diagnose judge/tool/budget failures separately from product defects | Celebrate a low score caused by termination, missing checkpoints or an ungraded run |
| Test the actual archive, assets, permissions and runtime handoff | Assume source-folder checks prove the uploaded package works |
| Freeze a qualifying task and move to the next | Keep changing fair weights or features to force one preferred score |

## 5. Workflow for producing more tasks with less rework

1. Validate the shared new-template harness on one small complete example.
   Resolve common blockers once and keep changes documented. Do not launch
   several task builds on an untested judge setup.
2. Write a one-page task outline: product, core journey, hard rules, seed
   boundaries, and how a browser judge can verify each. Reject ideas requiring
   substantial infrastructure or fragile input gestures before implementation.
3. Write the requirement/criterion map and build the golden together. Use a
   consistent visual foundation with task-specific screens and product identity.
   Check desktop, mobile, errors, empty states, and secondary detail surfaces.
4. Validate the final task archive and run the golden through the actual
   verifier. Check a no-op and one relevant partial implementation that violates
   an important rule; confirm the intended criterion actually catches it.
5. Inspect one target-model run early. If it is too easy, strengthen a real
   domain rule in the brief, golden and rubric together. If it zeros, determine
   whether the builder, runtime, gate, or judge failed before changing difficulty.
6. Run required QC and model/Oracle evidence on the frozen package. Prefer a
   second independent target-model sample when close to a limit or when judge
   behavior is inconsistent; budget it as a repeatability check, not a hunt for
   the lowest score. Retain every attempt and all limitations.
7. Package only the frozen task and required evidence. Record checksums and
   acceptance status, then stop tuning a task that meets the real requirements.

Track task, template/judge/model versions, QC status, Oracle and each model
score, gate results, failure causes, revision count, authoring time, verifier
time, and paid-run cost. Optimize accepted tasks per hour and cost using those
measurements. Do not equate many local assertions, low scores, or many files
with successful delivery.

## 6. Most useful additional downloads

Request 3–5 accepted tasks under this exact new template and GLM configuration,
preferably spanning a small workflow desk, a scheduling/resource task, and a
different interaction type. Also request 1–2 rejected or repeatedly revised
tasks with their QC findings so we can study failures as well as successes.
This is an initial learning sample, not enough to estimate category win rates.

For each, retain:

- The exact accepted/rejected task ZIP including golden and verifiers.
- The matching platform Static/Rubric result and final acceptance status.
- Oracle/no-op and required model run exports: dimension scores, criterion
  reasons, logs, model/settings, durations, and task checksum.
- Revision count and run cost/authoring time when available.

A screenshot saying passed can establish a reported status; it cannot explain
why the task worked or which behaviors separated implementations. Exact code
plus matching results is the useful comparison unit. Do not treat old judge
scores or a different ZIP as calibration evidence for the new template.
