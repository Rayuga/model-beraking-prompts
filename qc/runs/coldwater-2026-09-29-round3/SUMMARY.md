# Three-review QC result

**BLOCKED** — 3/3 valid independent reports.

Local review only; no verification of portal model, full judge duration, Oracle or target-model score is inferred.

Unresolved findings/evidence gaps: 17. Verdict disagreements: 4.

- reward_is_graded_not_binary_and_discriminates: missing hash-bound measured runtime record
- reward_ranking_is_monotone: missing hash-bound measured runtime record
- timeouts_fit_the_work: missing hash-bound measured runtime record
- verifier_image_can_launch_and_grade: missing hash-bound measured runtime record
## reviewer-1:quality:timeouts_fit_the_work

Not exercised: Frozen task root .qc-cache/coldwater-2026-09-29-round3/task/; task.toml:18,27 and tests/test.sh:213,224 numerically nest1200 gate seconds within1500,10800 scored within11100, and12600 suite seconds within13200. No current canonical LLM judge/builder timing records demonstrate the58-outcome workload. Scripted browser duration cannot establish this per qc/REVIEW_POLICY.md. Fresh qc/runs/coldwater-2026-09-29-round3/golden/run-golden-20260929-064533/RESULTS.json reports96.9166 seconds with direct pinned Playwright, paid_provider=false and oracle_score_claimed=false; it does not fill the LLM workload gap.

## reviewer-1:quality:verifier_image_can_launch_and_grade

Not exercised: Frozen task root .qc-cache/coldwater-2026-09-29-round3/task/; tests/Dockerfile:16-41 structurally includes pinned judge/MCP/browser/RewardKit/runtime; tests/test.sh:203-227 wires both suites. No current full RewardKit judge launch+grading record proves successful completion and every dimension output. A scripted Playwright/reference-app run does not exercise the full canonical grading path. Fresh qc/runs/coldwater-2026-09-29-round3/golden/run-golden-20260929-064533/RESULTS.json uses direct pinned Playwright and canonical restart MCP, with paid_provider=false and oracle_score_claimed=false; it still does not execute the full RewardKit judge.

## reviewer-1:quality:floor_is_low_for_shells_mocks_and_stuffing

Not exercised: Frozen task root .qc-cache/coldwater-2026-09-29-round3/task/; Render/Constraints source requirements structurally reject convincing static and client-local shells through fresh execution/write/clean-context readback, and scoring.toml zeroes failed gates. No current weak-app grading records establish actual near-zero scores for blank/static/mock/seed-copy/stuffed/refusing submissions. Golden-only observations cannot prove this empirical floor.

## reviewer-1:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: Frozen task root .qc-cache/coldwater-2026-09-29-round3/task/; scoring.toml and58/7/6 positive criterion weights allow fractional outcomes, but no current-input partial-quality app grading records establish a measured spread. qc/REVIEW_POLICY.md requires separate discrimination logs; a reference-app scripted pass is not a RewardKit score.

## reviewer-1:quality:reward_ranking_is_monotone

Not exercised: Frozen task root .qc-cache/coldwater-2026-09-29-round3/task/; score.py:40-48 is mathematically monotone for fixed dimension scores, but actual worse/better app outcomes are unmeasured on round3. No current ordered-variant grading logs prove the rubric preserves product-quality ranking; this requires independent runtime evidence under qc/REVIEW_POLICY.md.

## reviewer-2:quality:timeouts_fit_the_work

Not exercised: Functional prompt contains23 protocols/370 nominal UI actions, plus bounded conditional fallbacks. Arithmetic nests1200<1500,10800<11100,and12600<13200; no current measured LLM judge workload evidence establishes sufficiency. Scripted browser time cannot answer that policy requirement.

## reviewer-2:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile,test.sh and tools source provide coherent launch/grading wiring, but no current full RewardKit launch and all-dimension grading log was exercised. Scripted browser/restart evidence does not substitute under REVIEW_POLICY.md.

## reviewer-2:quality:dimensions_cover_every_graded_requirement

Note: integration.md:11 and policy.md:7 retain shared Express/better-sqlite3/SQLite policy. Constraints explicitly proves browser-observable shared records rather than storage-engine identity; browser evidence cannot establish SQLite. This is the documented shared-policy limitation, not permission to add source-reading.

## reviewer-2:quality:criteria_are_outcome_based_and_browser_decidable

Note: Product rows are browser-observable using actual DOM/log/fields/requests and bounded timing. Exact shared backend technology in integration.md:11 remains unobservable; same policy conflict as Q26, with no hidden source classifier added.

## reviewer-2:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: Positive weighted outcomes and split S22 allow partial credit algebraically, but no hash-bound weak/partial/full app RewardKit scores establish actual reward spread for this candidate. REVIEW_POLICY.md requires separate measured discrimination evidence.

## reviewer-2:quality:reward_ranking_is_monotone

Not exercised: No current hash-bound reward-ordering experiment was exercised. Positive weights and sensible gates do not prove actual judge ranking; required runtime evidence remains missing.

## reviewer-2:quality:task_is_distinct_and_authored

Not exercised: Current instruction/reference are clearly authored for a playground, but no corpus-level sibling/domain comparison was exercised in this bounded frozen task/template review. Broad distinctness/provenance remains unverified.

## reviewer-3:quality:timeouts_fit_the_work

Not exercised: .qc-cache/coldwater-2026-09-29-round3/task/task.toml and tests/test.sh: 600+600=1200<1500 gate budget, 9000+900+900=10800<11100 scored budget, 1500+11100=12600<13200 verifier. Functional prompt totals 370 planned UI actions across 23 protocols. Fresh scripted 96.9166s is not model judge time; no hash-bound full provider timing, target-builder run or cold-build measurement establishes production fit.

## reviewer-3:quality:verifier_image_can_launch_and_grade

Not exercised: .qc-cache/coldwater-2026-09-29-round3/task/tests/Dockerfile and fresh image launch provide app runtime, actual Chromium/MCP and canonical restart. golden/tooling-smoke.json proves configured browser_run_code_unsafe clean-context/routing capabilities. No complete hash-bound test.sh + RewardKit + claude-code/OpenRouter grading run was performed; required full grading evidence remains absent.

## reviewer-3:quality:dimensions_cover_every_graded_requirement

Note: .qc-cache/coldwater-2026-09-29-round3/task/Product mapping: overview/startup/examples -> S01; execution/CSS/deadlines/errors/isolation -> S02-S13/S36; console/auto/editor -> S14-S19; durable shared library/title/revisions -> gates/Constraints and S21-S24; themes -> S34/Visual; keyboard/mobile -> Polish. Remaining assurance conflict: integration.md mandates Express/better-sqlite3/Node-only backend, inherited from frozen template integration.md; browser-only judges explicitly cannot prove engines or all server implementation restrictions. This shared-policy limitation is unresolved, not a new task-added frontend mandate.

## reviewer-3:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: .qc-cache/coldwater-2026-09-29-round3/task/scoring.toml and 58 weighted functional outcomes structurally permit partial credit; fresh synthetic scorer cases produce 1,0.5,0 and0.4306. No current-input weak/partial-app provider grading distribution was measured, as required by qc/REVIEW_POLICY.md; scripted golden passes do not establish reward discrimination.

## reviewer-3:quality:reward_ranking_is_monotone

Not exercised: .qc-cache/coldwater-2026-09-29-round3/task/score.py uses positive weights and is coordinatewise nondecreasing after gates/floor; S22 split preserves total mass. Actual stronger/weaker app judge ranking remains unmeasured on this hash. Mathematical examples cannot replace the required empirical ordering evidence.

