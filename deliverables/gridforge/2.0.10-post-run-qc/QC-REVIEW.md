# GridForge — individual local QC reviews

Not an official platform verdict. Missing QC skill/platform scripts; see main report.

## 1. instruction_is_a_natural_product_request

Guideline: The prompt reads like a real person asking for an app, not a spec sheet, checklist, or build recipe.

Local verdict: **PASS**

instruction.md is a first-person operations-team request with a reason for collaboration and recovery; linked notes describe product behavior rather than a file-by-file implementation.

## 2. instruction_preserves_natural_human_voice

Guideline: Keeps an authentic human voice (casual/terse is good); not robotic, over-polished, or LLM-generated prose.

Local verdict: **PASS**

The brief and five notes keep a consistent team/product voice. No grading-directed prose was found in the agent-facing material.

## 3. instruction_is_spelled_right_and_uncontaminated

Guideline: No real spelling errors and nothing pasted in by mistake (author notes, TODOs, stray paths, contradictions).

Local verdict: **PASS**

Read instruction.md and all five shipped notes; no author TODOs, accidental grading text or spelling defect identified.

## 4. instruction_states_deliverables_and_runtime_contract

Guideline: Everything the judges grade is asked for, and the runtime contract (path, start command, port, storage, seed, accounts, no-network) is stated.

Local verdict: **PASS**

instruction.md and overview.md specify /app, npm start, port 3000, local runtime resources, SQLite path/extensions, seed, and manifest routes. collaboration.md defines seeded-user entry without passwords.

## 5. instruction_leaks_no_grader_machinery

Guideline: The prompt never names the judge, rubric, dimensions, weights, test paths, or grader sentinels.

Local verdict: **PASS**

No judge names, weights, verifier paths or probe-marker values in the agent brief. The seed's row anchors are product data, not hidden answers.

## 6. instruction_is_achievable_and_unambiguous_in_the_environment

Guideline: One reasonable reading, and every capability is reachable from the seed + runtime with no network. Reports every ambiguity/unreachable item.

Local verdict: **FAIL**

F03/F05: session identity solely derived from a session credential is a reasonable implementation, but the verifier requires a separate claimed-user value. Familiar live-search can select J50 as the query is typed, while the verifier assumes the first subsequent Next selects J50. These choices change scoring without a clear brief anchor.

## 7. task_asks_for_a_real_working_product

Guideline: Real build work is required; a stub or trivial tweak can't earn the reward.

Local verdict: **PASS**

Custom grid editing, formulas, SQLite revisions and live collaboration require substantial implementation; the product is not a static page task.

## 8. task_identity_is_coherent

Guideline: Name, directory slug, description, keywords, and metadata all describe THIS task and agree.

Local verdict: **PASS**

Source folder, task name, package names and ZIP wrapper agree on gridforge-spreadsheet-v2, version 2.0.10. Prompt markers remain 2.0.9 intentionally because the 2.0.10 change was bootstrap-only.

## 9. agent_environment_and_network_posture_are_correct

Guideline: Agent image is no-network with sane CPU/memory, no secret literals, and nothing that secretly needs an install.

Local verdict: **POLICY OVERRIDE**

Public agent networking and development installs match the latest explicit user/lead direction and instruction.md. The workbook's no-network wording is superseded; do not claim literal workbook compliance. Resources are 2 CPUs/4096 MB.

## 10. verifier_is_isolated_pinned_and_credentialed

Guideline: Verifier runs separately on a pinned image + allowlist, with the judge model and API key fully wired.

Local verdict: **REVIEW**

Separate verifier, digest-pinned base images, explicit Codex/Luna and placeholder credentials are present and four paid exports completed. Public networking is explicitly authorized. F08: the extra OPENAI_API_KEY alias/provider setup remains unlike the newest lead convention.

## 11. timeouts_fit_the_work

Guideline: Agent, verifier, liveness, and judge timeouts are long enough and nest properly (inner < outer, sum of judges < verifier).

Local verdict: **PASS**

Judge budgets 450+600+6500+3000=10550s; wrapper 12000s; verifier 12600s; agent 7200s and build 1800s. Observed grader durations were 850.8-1272.1s. No exported timeout exception; this is not a guarantee about every pathological startup.

## 12. no_prebuilt_image_shadows_the_agent_dockerfile

Guideline: [environment].docker_image isn't set while the agent Dockerfile still has active build steps (which would skip it entirely).

Local verdict: **PASS**

No environment docker_image override shadows either Dockerfile.

## 13. assets_match_the_task

Guideline: Any shipped inputs exist at the expected path and match what the prompt, solution, and judges assume (or N/A if none needed).

Local verdict: **PASS**

Both seed copies are byte-identical; COPY sources exist. The title/sheet, B2/C2/D2 and A14/A40/A80 anchors agree with criteria and source.

## 14. seed_data_is_internally_consistent_and_clean

Guideline: Shipped data is self-consistent, synthetic (no real PII), and free of orphan references or injection payloads.

Local verdict: **PASS**

Seed JSON parses; synthetic Riley/Morgan/Priya users and operations workbook data are consistent in inspected inputs. No provider-key or injection payload detected.

## 15. dockerfile_builds_the_declared_world

Guideline: Agent image is pinned, pre-installs every runtime dependency (no run-time install), and stages the assets.

Local verdict: **PASS**

Agent Dockerfile pins the base digest and express@5.2.1, supplies the seed/notes and explicit ca-certificates/curl/coreutils. Historical 2.0.10 bootstrap report and completed model builds corroborate reachability; no fresh image rebuild in this audit.

## 16. environment_does_not_leak_the_answer

Guideline: The agent's world has the inputs and the ask, but no finished copy of the deliverable.

Local verdict: **PASS**

Agent Dockerfile copies only assets and instructions, not solution/ or tests/. Seed contains inputs, not a finished editor.

## 17. solution_covers_every_deliverable

Guideline: The reference plausibly implements every feature/screen the instruction asks for.

Local verdict: **REVIEW**

Golden contains the grid/formula engine, persistence, history and collaboration paths. F01 is a measured keyboard-navigation defect; reverse-drag has an unresolved exported failure. Not a blanket all-deliverables pass.

## 18. solution_covers_every_graded_dimension

Guideline: The reference plausibly satisfies every criterion the judges score, so the oracle can score high.

Local verdict: **FAIL**

F01/F02: Oracle passed 34/36 Functional criteria, not all. Fresh keyboard probes reproduce F3 Enter staying F3 and G3 Shift+Tab staying G3; these miss the requested F4/F3 destinations.

## 19. solution_honors_the_runtime_contract_and_is_self_contained

Guideline: solve.sh installs to the expected paths and the reference runs under the stated contract with no network / no run-time install.

Local verdict: **PASS**

solve.sh stages /app, copies preinstalled Express dependencies, seeds SQLite and uses the documented start path. Current-source syntax and localhost startup completed in an existing isolated local image; it did not execute a paid judge.

## 20. solution_is_frozen_and_deterministic

Guideline: The reference is a committed, static baseline - not regenerated, fetched, or nondeterministic on any pinned value.

Local verdict: **PASS**

Golden is checked-in static code; no external generated solution. Installed Oracle source matches current golden after LF normalization. Textual line endings differ, not implementation content.

## 21. verifier_entrypoint_is_safe_and_always_scores

Guideline: test.sh launches the app safely, gates on liveness, and writes a reward on every code path (including failures).

Local verdict: **PASS**

test.sh initializes zero outputs, uses an unprivileged clean-environment app launch, bounded readiness/rewardkit waits and cleanup. Model/Oracle exports all produced parseable scores; a blanket every-error-path live fault-injection test was not repeated.

## 22. verifier_image_can_launch_and_grade

Guideline: The verifier Dockerfile ships a pinned browser, Playwright, judge CLI, rewardkit, and the runtime to start the app.

Local verdict: **REVIEW**

Recorded runs prove the shipped verifier could launch and grade. F08: tests/Dockerfile still installs Codex/MCP/RewardKit and local provider configuration, contrary to the newest lead instruction. This is policy drift, not proof those historical runs were invalid.

## 23. verifier_and_instruction_agree_on_the_runtime_contract

Guideline: Every launch assumption in test.sh (probe URL, env vars, paths, seed, deps, same-origin) was told to the agent. Signature check of this format.

Local verdict: **PASS**

Manifest SQLite path, npm start, localhost:3000 and /assets/workbook_seed.json agree. Helper's SEED_PATH points to the already documented path, so it does not introduce an undisclosed required override.

## 24. grading_wiring_is_structurally_correct

Guideline: reward.toml and every judge.toml are structurally complete: pinned judge, browser MCP server, well-typed criteria with weights, valid aggregate.

Local verdict: **PASS**

Six TOMLs and all task JSON parse; four dimensions have proper positive weights, binary/Likert schemas, MCP settings and prompt substitution. All 44 exported criterion descriptions/IDs/weights match source.

## 25. judge_prompts_drive_the_browser

Guideline: Every dimension prompt sends the judge into the live app via the browser tool - not scoring from source, memory, or first paint.

Local verdict: **PASS**

All four prompts drive Playwright at localhost:3000, require live evidence and prohibit grading from submitted claims. Narrow manifest reads and the trusted restart helper are documented exceptions.

## 26. dimensions_cover_every_graded_requirement

Guideline: Every requirement the prompt states maps to at least one criterion (nothing asked-for goes ungraded). Reports every gap.

Local verdict: **REVIEW**

Major requirement families map to criteria: grid/input, formulas, clipboard/fill/find, session/presence/conflicts, history/save/restart, manifest and accessibility. Exhaustive equivalence of every clause has not been proved; do not label this a completed platform coverage pass.

## 27. no_criterion_grades_the_unrequired

Guideline: No criterion enforces something the prompt/professional default never required (no false-fail on correct apps). Reports every instance.

Local verdict: **FAIL**

F03: claimed-user and duplicate top-level workbook identity probes can punish a correct session-derived/URL-identified implementation. F05: fixed initial Find Next ordering can punish legitimate immediate query selection. The prompt's logical-field mapping does not solve an intentionally absent redundant field.

## 28. criteria_are_independent_and_noncontradictory

Guideline: No two criteria grade the same thing twice, subsume each other, or demand incompatible products.

Local verdict: **REVIEW**

Split persistence/seed/surface checks are preserved and the old D2=360-after-Undo contradiction is fixed. Large bundles remain in edit/delete/undo, Shift-click/reverse-drag and number/formula fill; Oracle/Gemini evidence shows successful sub-behaviors receiving zero when another fails. Decide against the current rubric, not by silently reducing weights.

## 29. global_browser_gate_is_present_and_correct_in_every_dimension

Guideline: Every dimension carries the browser gate that hard-zeros blank/static-shell/cross-origin apps (plus auth/backing checks when relevant).

Local verdict: **PASS**

All four global gates require a real workbook and same-origin server data, accept seeded-user entry screens, and zero failures. Password-auth checks are correctly absent for this passwordless seeded-user product. Polish additionally requires persisted edit/readback.

## 30. negative_checks_have_positive_controls

Guideline: Any 'rejects / hides / absent' check is paired with the matching success case, so a totally broken app can't earn it.

Local verdict: **PASS**

Negative save probes first capture a successful UI save; error/cycle cases have recovery controls; no-op save and restart create their own positive saved baseline.

## 31. plural_asks_are_checked_across_all_matches

Guideline: 'Every / all / only / exactly-one' criteria require the whole collection, and 'unchanged' guards don't punish legit side-effects. Reports every instance.

Local verdict: **PASS**

Range tests name all cells and outside controls; rejection matrices reread entire workbook/revision collections; restart excludes transient presence/session fields. No additional first-match-only loophole was established in this review.

## 32. criteria_are_outcome_based_and_browser_decidable

Guideline: Each criterion is a concrete, browser-observable outcome with durable evidence and distinctive probes. Reports every instance.

Local verdict: **REVIEW**

Most checks are observable UI/API outcomes with exact tables. F03 makes some mandatory probe rows unrepresentable for a legitimate payload design; missing judge action traces limit verification of executed gestures.

## 33. criterion_description_is_self_consistent

Guideline: Each criterion states ONE full-credit bar - it doesn't enumerate several things then waive most, leaving the judge two targets. Reports every instance.

Local verdict: **PASS**

Criteria use a stated all-or-nothing bar or anchored Likert. Equivalent labels, numeric formatting and logical field names are true equivalences, not permissions to skip required outcomes.

## 34. interactive_time_varying_and_viewport_behavior_is_exercised

Guideline: If interactive/animated/responsive/themed, the judges actually click, wait, resize, or toggle - not score a still first paint.

Local verdict: **PASS**

Written criteria exercise keys, real drags, clipboard, multiple tabs, five-second updates, browser reloads and a 1280x800 visual inspection. No mobile/theme requirement is invented for this brief.

## 35. core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be

Guideline: At least one criterion proves the defining behavior works, and (where stateful) state survives reload/re-auth and is server-backed where required.

Local verdict: **PASS**

36 Functional checks cover core editing/calculation and persisted state. Explicit two-restart seed-idempotence, fresh-context polish persistence and same-origin save/readback prevent relying solely on in-browser memory.

## 36. grader_probes_are_not_pre_satisfied

Guideline: Distinctive values the judge creates to prove a mutation aren't already in the seed or the reference's initial state.

Local verdict: **PASS**

Distinctive mutation markers (CUSTOM-GRID-PROOF, AUTOSAVE-F30, RESTART-Q70, RANGE-A, FIND-QC and forged-save sentinels) are not seed values. Fixed seed/formula checks are setup checks, not claimed mutations.

## 37. later_dimensions_tolerate_earlier_mutations

Guideline: A later dimension doesn't assume a pristine seed after an earlier dimension mutated the shared running app.

Local verdict: **PASS**

Render allows arbitrary saved state; Constraints does not save; Polish restores its prerequisite edit; Functional has independent setups and name-box Undo compares the actual prior snapshot rather than assuming original D2.

## 38. batched_criteria_are_scored_independently

Guideline: Batched dimension prompts tell the judge to score each criterion on its own and continue after a failure (one miss can't zero the rest).

Local verdict: **REVIEW**

All prompts explicitly say continue and score independently. F04: Haiku has many 'not completed' outcomes, so wording compliance does not establish that the recorded judge independently exercised every criterion.

## 39. floor_is_low_for_shells_mocks_and_stuffing

Guideline: A blank / static / mock / seed-copy / keyword-stuffed / refusing submission scores near zero across the rubric.

Local verdict: **REVIEW**

NOP empirically scored zero; blank/cross-origin/client-only mocks fail the written gates, and read-only seed servers cannot pass Polish persistence. An exhaustive adversarial mock/stuffing battery was not run; no blanket empirical floor certification.

## 40. reward_is_graded_not_binary_and_discriminates

Guideline: The rubric produces a spread across partial-quality apps, not all-or-nothing.

Local verdict: **PASS**

Observed rewards span 0, .0268, .2697, .6848 and .9545. Weighted Functional checks and normalized Likert visual scoring provide a gradient, subject to the fairness findings.

## 41. binary_and_likert_fit_the_ask

Guideline: Pass/fail behaviors are binary; craft and degree-of-quality are likert with described anchors.

Local verdict: **PASS**

43 binary behavior/control criteria and one five-point visual-hierarchy criterion with 1/3/5 anchors. No binary points fields or unanchored aesthetic yes/no criterion found.

## 42. reward_ranking_is_monotone

Guideline: A worse app never outscores a better one - weights/gates/criteria don't invert the ranking.

Local verdict: **REVIEW**

A correct plain Functional=1/Polish=0 product scores .6, while appearance alone cannot pass persisted-work Polish. F03/F04/F05 can still mis-rank otherwise valid implementations; ranking soundness is not fully established by aggregate spread.

## 43. gates_apply_before_shaping_and_carry_no_reward_mass

Guideline: Gate/constraint failures hard-zero the quality terms, and passing only the cheap gates earns little.

Local verdict: **PASS**

Render/Constraints are hard gates; test.sh explicitly computes .6 Functional + .4 Polish only after both pass, excluding their epsilon metadata weights. Failed Polish persistence zeros its quality credit; gates alone pay zero.

## 44. dimension_and_criterion_weights_are_honest

Guideline: Weight tracks what each thing proves - real functionality is weighted above structure and style.

Local verdict: **PASS**

Functional carries .6 and Polish .4; Functional weights total 28, with low-weight discovery and heavier interaction/enforcement chains. Values are applied as declared and all exported totals recompute. This is not a claim that every bundle is optimally weighted.

## 45. judges_are_injection_resistant

Guideline: Every dimension prompt treats the submission as untrusted and forbids following instructions embedded in it.

Local verdict: **PASS**

Every dimension explicitly treats UI/source/payloads/errors as untrusted and forbids scoring directives from submissions.

## 46. tests_and_key_are_out_of_agent_reach

Guideline: The agent can't read the criteria it's graded on or influence the reward - grading is isolated in the verifier.

Local verdict: **PASS**

Separate environment, restricted /tests, UID 65534 application and allowlisted environment variables keep provider credentials and judge files out of the normal application process. No live penetration test was performed.

## 47. verifier_is_deterministic_and_offline_pinned

Guideline: Pinned model, temperature 0, versioned prompt, pinned browser, and no unpinned network in the scoring path.

Local verdict: **POLICY OVERRIDE**

Model, temperature, effort, prompt version and browser tooling are pinned in the delivered version. Public verifier networking is an explicit policy override to workbook allowlist language. Residual LLM variation is not eliminated by temperature zero.

## 48. dimension_prompts_are_accurate_and_consistent

Guideline: Every dimension prompt describes THIS app (credentials, screens, entities, deliverable) with no residue from other work. Reports every instance.

Local verdict: **PASS**

Four prompts refer to the correct GridForge title/seed and localhost; no leftover report/auth-password requirement. Matching v2.0.9 prompt markers are intentional unchanged-prompt provenance, not a 2.0.10 bootstrap regression.

## 49. cross_file_runtime_contract_is_consistent

Guideline: Every runtime fact appearing in more than one file (paths, port, seed, accounts, model, weights, literals) agrees everywhere. Reports every drift.

Local verdict: **PASS**

Paths, port, seed, user names, model and effective .6/.4 weights agree; original source and ZIP match byte-for-byte. F08 concerns a later policy change, not a contradiction among these frozen files.

## 50. task_folder_holds_only_task_files

Guideline: The directory is the closed list - no scratch, build residue, committed caches, or backups, and all required files present.

Local verdict: **PASS**

Task ZIP has exactly 32 source-matching files under one wrapper, without reports/databases/caches. F07 concerns separate final job directories, not the task ZIP.

## 51. everything_parses_and_would_run

Guideline: The gating files are well-formed: both TOML families, the shell scripts (bash -n, no CRLF), and the reference/app entry.

Local verdict: **PASS**

TOML/JSON parse, four shell scripts pass bash -n, JavaScript passes node --check; current golden started in a disposable offline local image. This is syntax/startup evidence, not a full Oracle rerun.

## 52. task_security_and_secrets

Guideline: No live credentials, real personal data, host paths, unpinned remote fetch, or injection payload anywhere in the task.

Local verdict: **PASS**

No provider-key/private-key/bearer-literal or Windows user-path patterns detected in final delivery, including ZIP/DOCX members. Task data is synthetic. F07 raw job databases remain a separate sanitization-policy issue.

## 53. task_is_distinct_and_authored

Guideline: The task reads as authored for this product, fits the suite's domain plan, and isn't a nouns-swapped clone of a sibling.

Local verdict: **REVIEW**

GridForge is domain-specific with custom formula/reference and concurrent-workbook workflows. An exhaustive novelty comparison across the full suite was not performed; no invented uniqueness score.

