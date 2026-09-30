# Three-review QC result

**STALE_OR_INVALID** — 3/3 valid independent reports.

Local review only; no verification of portal model, full judge duration, Oracle or target-model score is inferred.

Unresolved findings/evidence gaps: 18. Verdict disagreements: 6.

- live task differs; prepare a new round
- reward_is_graded_not_binary_and_discriminates: missing hash-bound measured runtime record
- reward_ranking_is_monotone: missing hash-bound measured runtime record
- timeouts_fit_the_work: missing hash-bound measured runtime record
- verifier_image_can_launch_and_grade: missing hash-bound measured runtime record
## reviewer-1:quality:timeouts_fit_the_work

Not exercised: Frozen task root: .qc-cache/coldwater-2026-09-29-round2/task/ . task.toml:18,27 and tests/test.sh:213,224 nest 600+600 gate judges within1500, 9000+900+900 scored judges within11100, and suites within13200 seconds. qc/runs/coldwater-2026-09-29-round2/golden/run-golden-20260929-063444/RESULTS.json records a97.203-second direct Playwright run, not LLM execution. No current hash-bound canonical-judge or builder timing log establishes practical workload; qc/REVIEW_POLICY.md requires that separate evidence.

## reviewer-1:quality:verifier_image_can_launch_and_grade

Not exercised: Frozen task root: .qc-cache/coldwater-2026-09-29-round2/task/ . tests/Dockerfile:16-41 structurally includes pinned browser/MCP/CLIs/RewardKit/runtime and tests/test.sh:203-227 wires both suites. qc/runs/coldwater-2026-09-29-round2/golden/run-golden-20260929-063444/RESULTS.json records direct pinned Playwright plus canonical restart MCP, with paid_provider=false and oracle_score_claimed=false. No current full RewardKit judge launch/grading log proves the canonical verifier completes and emits all scored dimensions.

## reviewer-1:quality:floor_is_low_for_shells_mocks_and_stuffing

Not exercised: Frozen task root: .qc-cache/coldwater-2026-09-29-round2/task/ . tests/gates/render/judge.toml:22 and constraints/judge.toml:22-29 structurally exclude blank, static and local-storage-only shells by fresh authored execution/save plus clean-context readback; tests/scoring.toml:1-10 applies gates/floor. No round2 weak-app graded logs establish actual near-zero outcomes for static/mock/seed-copy/stuffed/refusing cases. Golden-only Playwright evidence is insufficient for this empirical floor claim.

## reviewer-1:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: Frozen task root: .qc-cache/coldwater-2026-09-29-round2/task/ . tests/scoring.toml:5-10 and functional/polish/visual criteria provide fractional weighted outcomes (57/7/6 criteria), but no current-hash partial-quality app grading records establish a measured reward spread. qc/runs/coldwater-2026-09-29-round2/golden/run-golden-20260929-063444/RESULTS.json is one successful golden browser exercise, explicitly not an Oracle score; qc/REVIEW_POLICY.md requires separate discrimination evidence.

## reviewer-1:quality:reward_ranking_is_monotone

Not exercised: Frozen task root: .qc-cache/coldwater-2026-09-29-round2/task/ . tests/tools/score.py:40-48 is a positive weighted sum behind gates and a functional floor, so the formula itself is monotone in fixed dimension scores. No round2 ordered app-quality variants were graded to test whether actual criteria/gate outcomes preserve product-quality ordering. qc/REVIEW_POLICY.md requires real ordering logs; a golden-only scripted pass cannot supply them.

## reviewer-2:quality:timeouts_fit_the_work

Not exercised: tests/scored/functional/prompt.md has23 protocols and370 estimated UI actions; timeout9000 fits arithmetic, and golden/RESULTS.json reports97.203 scripted seconds, but required hash-bound LLM workload/repetition evidence is absent. qc/REVIEW_POLICY.md explicitly rejects inferring it from scripted duration.

## reviewer-2:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile/test.sh source wiring is coherent and golden exercised actual restart MCP, but no current hash-bound full RewardKit verifier launch/grading log is available. Direct Playwright does not instantiate all scoring judges.

## reviewer-2:quality:dimensions_cover_every_graded_requirement

Note: integration.md:11 and policy.md:7 retain shared Express/better-sqlite3/local SQLite requirements. Browser-only constraints gate proves shared server records but cannot identify the storage engine. Task-specific React/TypeScript mandate is removed (integration.md:3). This shared-policy observability gap remains; do not add source-reading to the browser judge.

## reviewer-2:quality:criteria_are_independent_and_noncontradictory

Fail: tests/scored/functional/judge.toml:347-351 makes exact persisted state AND a new successful post-restart write one binary2.5 outcome. prompt.md:363-368 explicitly records preservation and write separately, but no separate credit exists. Under qc/REVIEW_POLICY.md independent-credit rule these are distinct useful outcomes.

## reviewer-2:quality:criteria_are_outcome_based_and_browser_decidable

Note: Functional prompt uses UI and browser-observed server exchanges, opaque-frame inspection and exact authored lines rather than implementation classifiers. Browser can decide product rows, but cannot establish shared SQLite/Express policy (integration.md:11); same coverage limitation as Q26, not a new source-reading mandate.

## reviewer-2:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: scoring.toml gives continuous weighted credit and small binary outcomes, but no current hash-bound weak-app RewardKit scores establish discrimination. Golden scripted57/57 is not a reward experiment; required by qc/REVIEW_POLICY.md.

## reviewer-2:quality:reward_ranking_is_monotone

Not exercised: No hash-bound reward ordering runs for weak/partial/full candidates were supplied for this frozen manifest. Positive weights establish algebraic monotonicity only, not actual judge ranking; qc/REVIEW_POLICY.md requires runtime evidence.

## reviewer-2:quality:task_is_distinct_and_authored

Not exercised: Authored playground files and metadata are coherent, but this scoped review does not contain corpus-level comparison against sibling tasks or external originals. No broad uniqueness/provenance conclusion is established from frozen task+template alone.

## reviewer-3:quality:timeouts_fit_the_work

Not exercised: tests/test.sh:run_suite and all judge timeouts nest: 600+600=1200<1500 gates; 9000+900+900=10800<11100 scored; 12600<13200 outer. Current functional prompt estimates 370 UI actions across23 protocols. Fresh golden took97.203s, but direct Playwright is not GLM/claude-code timing. No hash-bound production judge completion, cold-build timing or target-builder duration record establishes these budgets fit actual work.

## reviewer-3:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile matches canonical and supplies runtime, Python, pinned MCP/browser/CLI/RewardKit. Fresh app launch/restart and real MCP context/route smoke passed. However no complete frozen tests/test.sh + RewardKit + configured claude-code/GLM provider grading run exists for this candidate; qc/REVIEW_POLICY.md explicitly requires separate full-verifier evidence before clearance.

## reviewer-3:quality:dimensions_cover_every_graded_requirement

Note: Product asks map to S01/S02 examples and languages, S03/S04 live/stop behavior, S05/S07/S08 boundaries, S09-S13/S36 errors/deadlines, S14-S19 console/editor, S21-S24 library and S34 plus Polish/Visual. integration.md:3 makes frontend technologies optional. Remaining Express/SQLite/local-server mandate at :11 is inherited from frozen template integration.md:3-13, yet Constraints explicitly says it cannot prove SQLite/Express and judges cannot read app implementation. This is a shared-policy coverage limitation, not a task-added technology defect; it remains unresolved and is not an inferred pass.

## reviewer-3:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: 57 weighted functional rows and six visual anchors plus7 usability outcomes permit partial scoring; synthetic scorer fixtures yield0,.5,1. But no current-input weak/partial app runs through actual judge establish reward discrimination. qc/REVIEW_POLICY.md requires hash-bound runtime discrimination records; golden correctness and injected dimension values cannot substitute.

## reviewer-3:quality:reward_ranking_is_monotone

Not exercised: score.py:_score/main has positive weights, gate/floor ordering and mathematical coordinatewise monotonicity; edge fixtures behave as expected. No hash-bound observed weak/partial/strong app reward ordering under configured judge exists for this candidate, as required by qc/REVIEW_POLICY.md. Synthetic dimension inputs and one golden are insufficient empirical ranking evidence.

