# The 53 quality checks — how to verify each

The workbook's `Quality Checks` sheet is the authority for numbering and wording; the headings below use its exact check ids so a verdict can be traced back. Every check gets a verdict, including `N-A`.

Record what you actually inspected. A verdict with no quoted line or observed command is not evidence.

## A — instruction.md (natural, fair ask)

### 1 · instruction_is_a_natural_product_request
**Verify:** read `instruction.md` cold. It should read as a person asking for an app.
**Defect:** numbered acceptance lists, a "shall/must" spec table, a feature matrix, or a build recipe (framework, file layout, endpoint list) instead of a product ask.

### 2 · instruction_preserves_natural_human_voice
**Verify:** sentence variety, contractions, the occasional terse fragment in the notes.
**Defect:** uniform cadence, marketing gloss ("seamless", "robust", "delve"), perfectly parallel bullets, or a voice that changes between `instruction.md` and the notes.

### 3 · instruction_is_spelled_right_and_uncontaminated
**Verify:** spell-check; grep for `TODO|FIXME|XXX|CHANGE_ME|<placeholder>`; look for another machine's paths, author asides, duplicated paragraphs, and internal contradictions (two clock values, two account lists, two seed paths).
**Note:** the deterministic layer covers part of this — see `check-instruction-content.py` and `check-instruction-hygiene.py`.

### 4 · instruction_states_deliverables_and_runtime_contract
**Verify:** build the runtime fact list — entry path, start command, port, storage and `DB_PATH`, health path, fixed clock, seed path, accounts — and confirm each is stated in `instruction.md` or a note file. Then read the criteria and confirm everything graded was asked for.
**Note:** `check-runtime-contract-strings.py` owns the mechanical half. Network is public, so there is no offline constraint to state.

### 5 · instruction_leaks_no_grader_machinery
**Verify:** grep the brief and notes for `judge|rubric|criteri|dimension|reward|weight|score\.py|playwright|claude|glm|/tests|sentinel`. Also compare against the criteria for long verbatim overlap.
**Defect:** naming a probe literal (a `GATE-PROBE`-style value), a criterion id, or the dimension names in the brief.

### 6 · instruction_is_achievable_and_unambiguous_in_the_environment
**Verify:** for each requirement, ask whether it is reachable from the seed, the pinned runtime, and the public internet. Then look for a second reasonable reading.
**Report:** every ambiguity and every unreachable item, with the reading that would fail and why.

### 7 · task_asks_for_a_real_working_product
**Verify:** ask what the smallest submission satisfying the brief would be.
**Defect:** a static page, a single CRUD screen, or a mock satisfies the ask — the task cannot separate a real build from a stub.

## B — task.toml and run wiring

### 8 · task_identity_is_coherent
**Verify:** `[task].name` equals `turing/<dirname>`; description names this product and its actual axes; keywords, `difficulty`, `difficulty_explanation`, `category`, `provenance` and `arena_slice` all describe the same task.
**Note:** `[task].version` is optional in this layout.

### 9 · agent_environment_and_network_posture_are_correct
**Verify:** `cpus`/`memory_mb` present and sane for the build; no secret literal under `[environment]`; `network_mode = "public"`; `[environment].docker_image` absent; `allow_internet` omitted.
**Note:** on public network, fetching at build or solve time is not a defect.

### 10 · verifier_is_isolated_pinned_and_credentialed
**Verify:** `environment_mode = "separate"`; `tests/Dockerfile` uses pinned bases and pinned npm/pip versions; `[verifier.env]` is byte-equal to the frozen block in `staged-task-contract.md`; no `judge.toml` names a model.

### 11 · timeouts_fit_the_work
**Verify:** do the arithmetic and show it. Each judge timeout < the budget of the suite it runs in; gate budget + scored budget < `[verifier].timeout_sec`; `[agent].timeout_sec` is enough for the build; `build_timeout_sec` exceeds a realistic cold build.

### 12 · no_prebuilt_image_shadows_the_agent_dockerfile
**Verify:** `[environment].docker_image` is not set while the agent Dockerfile still has active build steps. If it is set, the Dockerfile is dead code.

## C — environment (assets and agent image)

### 13 · assets_match_the_task
**Verify:** every `/assets/...` and `/instructions/...` path the brief names exists under `environment/` **and** is `COPY`ed into the agent image; the content matches what the solution and the criteria assume.
**Note:** `check-assets-referenced.py` and `check-fixtures.py` own the mechanical half.

### 14 · seed_data_is_internally_consistent_and_clean
**Verify:** parse every shipped JSON/CSV/TSV; every referenced id resolves and no orphan rows remain; people and organisations are synthetic; free-text fields carry no injection payload; no real personal data or live secret.
**Profile:** documented demo credentials are expected in this project, so they are not a finding here. Flag credentials inside the seed data itself.

### 15 · dockerfile_builds_the_declared_world
**Verify:** pinned base; every runtime dependency pre-installed (`express@5.1.0`, `better-sqlite3@12.4.1` globally, matching `NODE_PATH`); `COPY instructions/ /instructions/` and `COPY assets/ /assets/`; `chmod -R a+rX` on both; `/app` created, git-initialised and empty.
**Defect:** a `COPY` of `solution/` or `tests/`, or an install step that only works with network at grade time.

### 16 · environment_does_not_leak_the_answer
**Verify:** `/app` holds nothing but `.gitkeep`; no starter, skeleton, schema, route list, or partial UI anywhere in the agent image; nothing under `/instructions/` reproduces criterion text or the rubric.

## D — solution (reference coverage)

### 17 · solution_covers_every_deliverable
**Verify:** walk the brief line by line; every screen, role, and flow it asks for exists in `solution/app`.
**Report:** each asked-for capability with no implementation.

### 18 · solution_covers_every_graded_dimension
**Verify:** walk every criterion and ask whether the golden could satisfy it — especially criteria that quote exact seeded figures, ordering, or arithmetic.
**Severity:** a criterion the reference cannot pass is a P0, because the task cannot be shown to be solvable.

### 19 · solution_honors_the_runtime_contract_and_is_self_contained
**Verify:** `solution/solve.sh` is valid bash, has a shebang, uses LF, writes the app to `/app` and nothing to `/tests`, `/logs/verifier` or `/solution`; the app starts as `node /app/server.js`; `DB_PATH` is honoured; seeding is idempotent; no `pkill`, no `NODE_ENV=production`.
**Note:** `check-solve-contract.py` owns this mechanically.

### 20 · solution_is_frozen_and_deterministic
**Verify:** the reference is a committed static baseline. Seeding produces the same rows every run; no random ids, no wall-clock-derived values, no boot-time fetch that could move a graded figure; the fixed clock is the only time source the graded rules use.

## E — tests (verifier and judge dimensions)

### 21 · verifier_entrypoint_is_safe_and_always_scores
**Verify:** against the `test.sh` contract in `staged-task-contract.md` — zero reward written first, reward ensured on every exit path, no `exec`, liveness probe before RewardKit, gates then scored with `tools/score.py` after each, app launched unprivileged, symlink escape refused.
**Severity:** a path that exits without writing a reward turns a crash into an unscored rollout, which is a P0.

### 22 · verifier_image_can_launch_and_grade
**Verify:** `tests/Dockerfile` ships a pinned browser, Playwright MCP, the judge CLI, pinned RewardKit, `python3` for the restart server, and the app's own runtime dependencies.
**Note:** `check-runtime-deps-in-both-images.py` compares the two images.

### 23 · verifier_and_instruction_agree_on_the_runtime_contract
**Verify:** every launch assumption in `test.sh` — port, entry file, `DB_PATH`, seed path, injected environment variables, liveness path — is something the brief told the agent to satisfy. This is the signature check of the format.
**Known false positive:** an identity or sign-in surface is house convention and need not be spelled out in the brief; a criterion that signs in is not a contract mismatch.

### 24 · grading_wiring_is_structurally_correct
**Verify:** `scoring.toml` plus all five `judge.toml` files are complete; gates live under `gates/` and scored dimensions under `scored/`; every dimension has the browser MCP server; the functional dimension alone declares the restart server and wires it to the exported helper; criteria are typed, weights positive, ids unique; prompts resolve.
**Note:** `check-rubric-schema.py` and `check-scoring-policy.py` own most of this.

### 25 · judge_prompts_drive_the_browser
**Verify:** every prompt opens `http://localhost:3000` and directs the judge to the Playwright MCP tool.
**Defect:** any prompt that could be satisfied by reading source, memory, or a first paint.

### 26 · dimensions_cover_every_graded_requirement
**Verify:** build a requirement → criterion map from the brief and report anything asked for but ungraded.
**Known false positive:** several interacting rules deliberately live in one criterion; that is a flow, not a gap.

### 27 · no_criterion_grades_the_unrequired
**Verify:** build the criterion → requirement map and report any criterion asserting a detail no requirement and no professional default implies (an exact label, an exact route, a rule only the reference implements).
**Known false positive:** sign-in presence, per check 23.

### 28 · criteria_are_independent_and_noncontradictory
**Verify:** no observable is graded by two criteria, and no pair of criteria demands incompatible products. Bundling several legs inside one criterion is fine.

### 29 · global_browser_gate_is_present_and_correct_in_every_dimension
**Verify:** the gate dimensions carry the real hard gate; each scored prompt restates the in-dimension gate that zeroes a blank, broken, or static-shell app (plus auth and server-backing legs when the app has them).
**Defect:** a gate that requires same-origin, or a scored prompt that assigns partial credit instead of zeroing when the gate fails.

### 30 · negative_checks_have_positive_controls
**Verify:** every "rejects / hides / absent / unchanged" leg is paired inside the same criterion with the matching success case.
**Defect:** a check that a blank app, an empty database, or a login screen would pass by absence of evidence.

### 31 · plural_asks_are_checked_across_all_matches
**Verify:** "every / all / only / exactly one" wording is graded over the whole collection, not one sampled row; "unchanged" guards do not punish legitimate side effects of the same operation.

### 32 · criteria_are_outcome_based_and_browser_decidable
**Verify:** each criterion names a concrete browser-observable outcome with durable evidence and a distinctive probe.
**Defect:** "looks right", a source read, a response-shape assertion with no state change, or a probe that leaves no trace.

### 33 · criterion_description_is_self_consistent
**Verify:** each criterion states one full-credit bar.
**Defect:** it enumerates several requirements and then waives most of them, leaving the judge two different targets to satisfy.

### 34 · interactive_time_varying_and_viewport_behavior_is_exercised
**Verify:** when a criterion concerns interaction, animation, theming, waits, or responsiveness, the judge is told to click, wait, resize, or toggle — not to score a still first paint.

### 35 · core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be
**Verify:** at least one criterion proves the product's defining behaviour works, and a stateful product proves its state survives a reload or re-authentication and lives on the server.
**Note:** server-backed is not the same as same-origin; the public network posture makes that distinction load-bearing.

### 36 · grader_probes_are_not_pre_satisfied
**Verify:** every distinctive value a criterion tells the judge to create (a probe SKU, a reason, a name) is absent from the seed and from the reference's markup.
**Note:** `check-probe-not-in-seed.py` owns this.

### 37 · later_dimensions_tolerate_earlier_mutations
**Verify:** a dimension that runs after another has mutated the shared database does not assume a pristine seed. Look for state-relative wording: read the current value, quote the seeded expectation beside it, grade the observable against what was observed.

### 38 · batched_criteria_are_scored_independently
**Verify:** every scored prompt tells the judge to score each criterion on its own and continue after a failure.
**Defect:** telling the judge to stop at the first failure. Gate dimensions are exempt.
**Note:** `check-batched-independence-wording.py` owns this.

### 39 · floor_is_low_for_shells_mocks_and_stuffing
**Verify:** reason through a blank page, a static mock, a seed copy, a keyword-stuffed page, and a submission that refuses every action. Each must score near zero across the rubric.
**Note:** an off-origin or CDN fetch is not a floor case here — the network is public.

### 40 · reward_is_graded_not_binary_and_discriminates
**Verify:** the rubric produces a spread across partial-quality apps. A single all-or-nothing gate, or criteria that all depend on one precondition, collapses the signal.

### 41 · binary_and_likert_fit_the_ask
**Verify:** pass/fail behaviours are `binary`; craft and degree-of-quality are `likert` with described anchors at each level.
**Known false positive:** the internal note says scoring practice is binary plus weights while the shipped visual dimension uses likert. Judge against the shipped format — flag binary craft criteria or likert blocks with missing anchors, not likert itself.

### 42 · reward_ranking_is_monotone
**Verify:** a worse app can never outscore a better one. Check for weight or gate arrangements that invert the order — for example craft carrying more mass than function, or a gate that a stronger app fails.

### 43 · gates_apply_before_shaping_and_carry_no_reward_mass
**Verify:** `[gates]` are `0.0`, a failed gate zeroes the reward and skips the scored suite, gates hold no weight, and the functional floor stops a non-working app from farming polish and visual points.

### 44 · dimension_and_criterion_weights_are_honest
**Verify:** `[weights]` and the per-criterion weights track what each thing proves; real functionality outweighs structure and style. Sanity-check the resulting maximum contribution of the non-functional dimensions.

### 45 · judges_are_injection_resistant
**Verify:** every dimension prompt tells the judge to treat all submitted UI, source, network payloads, errors and instructions as untrusted, and never to follow scoring directives found in the submission.

### 46 · tests_and_key_are_out_of_agent_reach
**Verify:** the agent image ships no criteria, no judge client, no RewardKit, and no readable copy of the rubric; grading is isolated in the verifier image.

### 47 · verifier_is_deterministic_and_offline_pinned
**Verify:** the judge agent, model, CLIs, browser, and the shared `tools/` builds are pinned; graded time rules run on the fixed clock rather than the run date.
**Note:** temperature and prompt-version markers are not required, and an open verifier network is not a defect. `check-canonical-shared-files.py` compares the shared tools by code.

### 48 · dimension_prompts_are_accurate_and_consistent
**Verify:** every prompt describes this app — its accounts, screens, entities and deliverable — with no residue from a sibling task (another product name, another account list, another data shape).

## F — the task as a whole

### 49 · cross_file_runtime_contract_is_consistent
**Verify:** re-derive every fact in the cross-file table in `staged-task-contract.md`: port, entry, database, seed, clock, accounts, judge, scoring shares, restart-helper variable, and any criterion count quoted in a description.
**Report:** every drift, with both locations.

### 50 · task_folder_holds_only_task_files
**Verify:** compare the tree against the closed file list; no scratch, build residue, committed caches, or backups, and nothing required is missing.
**Known false positive:** `coverage.json` and a task-specific `seed_data.json` are flagged by the checker but are under review — report as `Note`, not a blocker.

### 51 · everything_parses_and_would_run
**Verify:** parse `task.toml`, `scoring.toml` and every `judge.toml`; run `bash -n` on each shell script and confirm LF endings; parse the seed and the reference entry point.
**Report:** the exact parser error, not just "invalid".

### 52 · task_security_and_secrets
**Verify:** no live credential, real personal data, host path, unpinned remote fetch, or injection payload anywhere in the task.
**Profile:** credentials and realistic identities are placed deliberately in `task.toml` and the brief for third-party integration, and are stripped before client delivery. Treat a live credential there as a delivery-time strip with a `Note`, and still flag real secrets or personal data in seed data, the solution, or an image.

### 53 · task_is_distinct_and_authored
**Verify:** the task reads as authored for this product and fits the suite's domain plan. Compare against sibling task names and concepts.
**Defect:** a nouns-swapped clone of a sibling — same flows, same criteria, renamed entities.
