# GridForge 2.0.10 — supplied DOCX review

Reviewed 10 September 2026. Local document-based assessment, not an official platform pass. No task source, frozen final delivery or recorded score was changed. No paid run was started.

## What these documents mean

`Task QC - platform.docx` defines 19 source-decidable criteria, excluding 11 measurement/run-dependent scorecard rows. It explicitly says flat pass/fail, not a weighted score. It is distinct from the 53-row WebDev review. Its own note says the source scorecard self-labels 34 but contains 30 rows; do not invent a 34-row grade.

`upload-checks-README.md.docx` defines 26 Rules-stage checks. An error stops later stages; warning/off does not. Most severities/configuration are project-configurable, and three correctness checks are locked. We have the document defaults, not live project settings or the official checker implementations. No policy-changing API request was made.

Statuses below are local evidence labels. REVIEW, N/A, POLICY CONFLICT and OFF BY DEFAULT are not platform PASS values. Source-only reviews are kept separate from existing run evidence.

## Important qualifications

- Public networking matches the upload guide default and explicit user direction, but conflicts with older source-QC E3 offline/allowlist wording. Do not silently claim both policies pass.
- Current baked judge tooling matches check-verifier-tooling-baked, while the newer lead says Harbor provides it. This confirms a documentation/template policy conflict; verify the current separate-verifier tool contract before deleting dependencies.
- Optional metadata defaults request persona while newer WebDev guidance rejects borrowed persona metadata. The optional rule is off in the supplied defaults; do not reintroduce it blindly.
- The total timeout is exactly the documented six-hour cap. It satisfies the numeric inequality but provides no cap margin if live sandbox accounting differs.
- The brief does not establish real-traffic provenance or preservation of an original prompt. The injection defense exists as text, but the DOCX additionally requests a tested injection; none was performed.
- Previously reported golden keyboard and verifier-fairness findings remain. The source-QC ambiguity failure is supported by instructions/verifier inspection; the measured keyboard failure remains post-run evidence, not evidence available to a source-only platform judge.

## Source document fingerprints

- `Task QC - platform.docx` SHA-256 `cdf6b22bb9874abfe8046195e1c68ec49393405fbe44ce58d9825bc85ad60933`
- `upload-checks-README.md.docx` SHA-256 `744161548a8ff4e64f7174912385cc1a6d7b89b4def156e1060073b05f54e6bd`

## 19 source-review criteria

### derived_from_real_traffic_not_synthesised

REVIEW — A2: task.toml provenance describes a v2 restructuring, not a traceable arena/product log. No original real-traffic source is established by the packaged files; do not invent provenance.

### natural_voice_preserved

REVIEW — A3: the brief is natural first-person product prose, but the original source is unavailable, so preservation of original typos/terseness cannot be verified. Clean prose alone does not prove model generation.

### prompt_is_unambiguous_and_achievable_in_the_environment

FAIL — A6: F03/F05 in the main report identify mandatory redundant identity fields and initial Find Next ordering not fixed by the brief. Source inspection alone establishes these alternate reasonable readings.

### every_explicit_requirement_maps_to_1_assertion

REVIEW — B1: broad coverage exists, including a restart criterion and manifest-route criterion. Exhaustive clause-by-clause completeness is not proven; the DOCX demands a complete requirement/assertion matrix, not just feature-family coverage.

### liveness_render_gate_present

PASS — B3: all four prompts require the live localhost workbook and a same-origin data response. test.sh probes readiness before RewardKit; tests are not string-only.

### plural_all_every_asks_checked_across_all_matches

PASS — B4: written range/multi-formula checks enumerate every cell/result; restart and rejection checks compare complete saved collections. No first-match-only projection found. This is a source assessment, not proof the judge executed every row.

### expected_types_values_match_what_is_actually_stored

PASS — C4: seed raw cells are strings; numeric display equivalence is explicit. Seed title, identities, anchors and baseline formulas match. F03 separately concerns requiring a redundant field, not a seed type mismatch.

### no_dead_or_malformed_assertions

PASS — C5: all TOML criteria and prompts parse, {criteria} is present, and checks are executable browser/API descriptions, not malformed JSONPath. No syntactically dead assertion found; semantic fairness remains separately flagged.

### no_unresolved_placeholders_at_runtime

REVIEW — C6: each prompt has {criteria}, and credentials use ${OPENROUTER_API_KEY}, not a secret. The template substitution is declared; platform secret/resolver injection cannot be proven from task source alone.

### nothing_else_changed_guards_have_teeth

PASS — C7: server rejection probes demand exact deep equality of workbook and revision lists after every rejection; restart covers complete saved snapshots; local edit checks name outside controls.

### app_side_effects_excluded_from_the_baseline

PASS — C8: restart explicitly excludes transient presence/session fields; persistence checks compare stored workbook/history, not whole browser state. Preview and restore specify when draft changes are legitimate and stored content must not change.

### llm_graded_facts_are_true_of_the_seed

PASS — C9: shipped seed facts and formula arithmetic agree (B2=3, C2=120, D2=360; named anchors and workbook title). Source scoring uses a gated 60/40 split. See existing literal/arithmetic audit; no historical reward used as source proof.

### gates_apply_before_shaping_terms

PASS — D2: test.sh hard-zeros final reward if either Render or Constraints is below 1; their epsilon metadata weights are excluded from final quality arithmetic. Polish also requires persisted server-backed editing.

### length_verbosity_band_encoded_where_it_matters

N/A — D5: no prose-length deliverable or measured verbosity reward is requested. Extra output length earns no criterion credit; this does not warrant inventing a text-length restriction on a spreadsheet.

### reference_baseline_artifacts_are_frozen_and_versioned

PASS — E2: solution and seed are static, source-versioned files; release 2.0.10 and unchanged prompt revision 2.0.9 are explicit. Current report records source/ZIP hashes. No regenerated baseline is used by the runner.

### verifier_runs_offline_or_on_a_pinned_allowlist

POLICY CONFLICT — E3: verifier network_mode is public, not offline or allowlisted. Packages are baked and test.sh does not download trial tooling; model judging still uses OpenRouter. Public mode follows explicit user/lead direction but is not literal compliance with this DOCX criterion.

### judge_model_temperature_and_prompt_are_pinned

PASS — E4: every judge declares openai/gpt-5.6-luna, temperature 0 and high effort with matching versioned prompts. Explicit model naming does not guarantee a provider never updates internals or eliminate LLM variance.

### judge_is_injection_resistant

REVIEW — F2: all prompts explicitly distrust submission content, but the DOCX additionally says tested with an injected directive. No such adversarial test was performed. That empirical clause is not source-decidable despite the document header.

### tests_and_rubric_are_not_readable_by_the_agent

PASS — F3: separate verifier, tests copied only into tests/Dockerfile, no solution/tests COPY in agent Dockerfile. This is the declared isolation design, not a live penetration-test claim.


## 26 upload-rule reviews

### check-task-timeout

PASS — Agent 7200s and verifier 12600s are positive and below 18000s each; build 1800 + agent 7200 + verifier 12600 = 21600s, exactly the documented total cap. No cap headroom; live project caps/age policy must agree.

### check-sandbox-resources

PASS — Agent 2 CPUs, 4096 MB RAM/disk fit documented 4 CPU, 8 GiB RAM, 10 GiB disk defaults; no GPU request.

### check-dockerfile-references

PASS — Agent image copies assets/instructions only, never solution or tests.

### check-network-mode

POLICY DEPENDENT — Both modes are public and match the guide default required_mode=public and user direction. Actual project overrides are not available; this is not a universal no-network rule.

### check-allowed-hosts

N/A — Neither phase uses allowlist, so an allowed_hosts declaration is not required by this rule.

### check-gpu-types

N/A — No GPU requested.

### check-dockerfile-platform

PASS — No FROM --platform pin.

### check-compose-host-binds

N/A — No Compose file in the task archive.

### check-base-image-pinned

PASS — Both Node and Python external FROM images use tags plus sha256 digests; the node-runtime stage reference is local.

### check-nproc

PASS — No bare nproc in task shell scripts or Dockerfiles.

### check-pip-pinning

PASS — The sole pip install pins pyyaml 6.0.2, openai 2.30.0, python-dotenv 1.0.1 and harbor-rewardkit 0.1.7 with ==; no uvx/tool trial install.

### check-dockerfile-sanity

PASS — Apt packages are not version-pinned; apt-get update and list cleanup are present. Do not reintroduce apt version pins to satisfy generic dependency-pinning language.

### check-pytest-version

N/A — No pytest or pytest-json-ctrf install; the runner is RewardKit.

### check-trial-network-fetch

PASS — test.sh uses curl only for localhost readiness. No curl-to-shell, wget or git clone; judge tools are not downloaded at trial time.

### check-canary

OFF BY DEFAULT — Guide has blank canary configuration. No configured project canary was supplied; cannot certify an enabled custom rule.

### check-task-fields

OFF BY DEFAULT — Guide default required_fields includes persona, which GridForge omits. It has category Software, subcategory and difficulty/solution explanations. Would need attention if that optional rule is enabled; do not add persona blindly because newer WebDev guidance rejects template residue.

### check-task-slug

PASS — gridforge-spreadsheet-v2 is kebab-case with 3 tokens, below the guide default 8 and within the user 3-token rule.

### check-task-version

PASS — Optional/off by default; [task].version is valid semver 2.0.10.

### check-task-package-name

PASS — turing/gridforge-spreadsheet-v2 equals default org plus exact folder.

### check-instruction-suffix

OFF BY DEFAULT — Blank default suffix template; unknown custom project sentence cannot be checked.

### check-task-absolute-path

OFF BY DEFAULT — Runtime roots /app, /instructions and /assets are absolute; filenames under those explained roots are relative in prose. Any enabled literal path checker needs its implementation/policy.

### check-test-file-references

REVIEW — instruction.md names /app, package.json, APP_MANIFEST.md and seed. The actual SQLite filename is intentionally manifest-discovered rather than fixed; golden uses /app/data/gridforge.db. The supplied guide does not define how its static intersection scanner treats this legitimate dynamic contract.

### check-test-sh-sanity

N/A — Guide applies to shared verifiers; this task uses separate mode.

### check-verifier-tooling-baked

PASS / POLICY CONFLICT — Current tests/Dockerfile bakes Codex, Playwright MCP, Chromium and RewardKit, matching this supplied upload rule. It contradicts the newer lead request not to install Harbor-supplied tools. Need authoritative current template/platform behavior before changing a working runner.

### check-artifact-paths

PASS — Top-level artifacts are absolute /app and /logs/verifier; no .., explicit destination collision, reserved manifest.json destination or sidecar entry. Source-form review only, not Harbor loader execution.

### check-separate-verifier

REVIEW / OFF BY DEFAULT — Separate mode, top-level artifacts and COPY . /tests are present. tests/Dockerfile does not explicitly mkdir /app and /logs/verifier artifact parents; test.sh creates logs at runtime. The documented optional strict image rule may require image-time parent creation if enabled.

## Fresh local checks

20 analogous local assertions: 20 passed. These are not the 26 platform scripts.

- PASS: Document inventories — Parsed all 19 source criteria and 26 upload IDs from DOCX text/tables.
- PASS: Phase timeout cap — Document defaults, not fetched platform policy.
- PASS: Total timeout cap — 21600 seconds exactly.
- PASS: Resource defaults — No GPU requested.
- PASS: Public in both phases — Preserved; no configuration changes.
- PASS: Separate verifier — Declared in task.toml.
- PASS: Name and wrapper — turing/gridforge-spreadsheet-v2
- PASS: No architecture pin — Both Dockerfiles inspected.
- PASS: No agent solution/test copies — Agent COPY assets and instructions only.
- PASS: No bare nproc — Task shell scripts and Dockerfiles.
- PASS: No trial download installers — Readiness curl is localhost only; tools baked in image.
- PASS: Readiness precedes grading — Bounded HTTP readiness loop.
- PASS: Explicit hard gate — Final formula hard-zeros gate failure.
- PASS: render judge contract — Model/temperature/effort, criteria interpolation and distrust instructions; not an adversarial test.
- PASS: constraints judge contract — Model/temperature/effort, criteria interpolation and distrust instructions; not an adversarial test.
- PASS: functional judge contract — Model/temperature/effort, criteria interpolation and distrust instructions; not an adversarial test.
- PASS: polish judge contract — Model/temperature/effort, criteria interpolation and distrust instructions; not an adversarial test.
- PASS: Archive source hashes unchanged — All 32 entries exactly match current source bytes.
- PASS: Archive CRC — Existing final ZIP; not repackaged.
- PASS: Same reviewed ZIP — 41bd62a738cfbadd79daedf2b8d9c85335e4c9e48e9304a3591252d7e9a0e8b0

Not run: official upload/static/source-QC stages; live-policy lookup; new image build; fresh Oracle/model run; adversarial prompt injection; exhaustive requirement-to-assertion proof. The prior local browser diagnostic is documented separately in the main report.

ZIP SHA-256 remains `41bd62a738cfbadd79daedf2b8d9c85335e4c9e48e9304a3591252d7e9a0e8b0`.
