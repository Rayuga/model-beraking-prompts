import json
from pathlib import Path

root = Path(__file__).parent
report = json.loads((root / 'reviewer-2.template.json').read_text())
report['read_sources'] = dict(workbook=True, skill=True, template=True)
report['scope'] = 'Independent full source review of frozen a6a5219e candidate. All 53 quality and 48 deterministic rows considered. Deterministic procedures applied manually, with TOML/JSON parsers, node --check, bash -n, byte comparisons and supplied preflight logs; private portal checker executables and configured provider grading were not run. No other reviewer findings read.'
q = [
('instruction.md:opening paragraphs', 'Personal playground request explains lost working previews and multi-editor overwrites; notes carry product detail.'),
('instruction.md and environment/instructions/behaviour.md', 'Conversational contractions and short explanations; new lifecycle and repeated-conflict sentences fit the surrounding product voice.'),
('instruction.md; environment/instructions/*.md', 'Read all seven public files and scanned task text: no draft markers, foreign paths or contradictory product names.'),
('environment/instructions/integration.md; behaviour.md:Preview and Saved snippets', 'Entry, bind port, public UI path, health, DB_PATH, built frontend, seed and restart are stated. Cancelled errors, latest successful rollback and repeated conflicts are now explicit public requirements.'),
('instruction.md; environment/instructions/*.md', 'Public terms/criterion-ID scans are empty and no QC fixture literals or reward instructions appear in these files.'),
('environment/instructions/behaviour.md; security.md', 'Five-second pending-source budget is separated from later completed-preview interaction; static rollback and candidate display are permitted. Both editors may win the next revision; no hidden recovery control is mandated.'),
('instruction.md; environment/instructions/behaviour.md', 'Execution, isolation, callback termination, restoration and durable conflict-aware storage require a working product.'),
('task.toml:[task],[metadata]', 'turing/colderwater-playground-devtools matches source slug and coherent playground metadata; hard difficulty describes actual execution/conflict work.'),
('task.toml:[environment],[verifier.environment]', 'Public network, 2 CPUs and 4096 MB, separate verifier; no prebuilt image, allow_internet key or environment secret literal.'),
('task.toml:[verifier.env]; tests/Dockerfile; five judge headers', 'Frozen env and headers match template; versioned CLI/RewardKit packages and Playwright browser installation are retained. This is wiring evidence, not a successful provider authentication run.'),
('tests/scored/functional/judge.toml:timeout; tests/test.sh:run_suite', '600+600 < 1500; 9000+900+900 = 10800 < 11100; 1500+11100 = 12600 < 13200. Current 23 protocols estimate 396 actions, but no configured LLM duration for this candidate proves workload fits.'),
('task.toml:[environment]; environment/Dockerfile', 'docker_image absent; active build steps are not shadowed.'),
('environment/Dockerfile:COPY; environment/assets/seed_data.json; environment/instructions/', 'Seed and all six instruction notes exist and are copied with readable permissions; no promised starter implementation is missing.'),
('environment/assets/seed_data.json', 'Parsed synthetic product metadata and empty snippets; no foreign keys, personal records, credentials or instructions to grader.'),
('environment/Dockerfile', 'Template-exact image declares Node22, global Express5.1.0/better-sqlite3 12.4.1, readable assets/notes and empty git-initialized /app. Static build feasibility reviewed; no fresh cold build performed by this reviewer.'),
('environment/Dockerfile; environment/assets/seed_data.json', 'COPY includes only notes and seed; no solution, tests, schema implementation or starter code enters agent image.'),
('solution/app/server.js; src/app.tsx; src/runtime.ts; src/style.css', 'Source plausibly implements all requested editor, console, library, theme, isolation, lifecycle and durability features. Source coverage is not an Oracle score.'),
('solution/app/src/runtime.ts:PreviewRunner; src/app.tsx:save/loadLatest; server.js:matchingRevision', 'Cancellation ignores obsolete frame/token messages, lastGood advances on completion, failures restore rollback; revision/draft paths are repeatable. No source contradiction with hardened S04/S10/S23 identified; fresh scripted evidence is separate and full five-dimension judge unmeasured.'),
('solution/solve.sh; solution/app/server.js', 'bash -n passes, LF verified; solve copies static app, checks closed database then resets only installation DB; server uses __dirname and DB_PATH. Process restart does not invoke solve or reset DB.'),
('solution/app/public/; starters/; server.js:database initialization', 'Static compiled baseline and authored examples; empty initial user library, idempotent CREATE TABLE. Wall-clock write timestamps/random console IDs are not pinned graded figures.'),
('tests/test.sh:write_zero_reward/trap/run_suite; tests/tools/score.py', 'Template-exact entry writes zero before launches, traps cleanup, rejects symlink escapes, sanitizes unprivileged app launch and applies gates then scoring. Source confirms reward on ordinary exit paths; no candidate-specific validate_suite zeroing remains.'),
('tests/Dockerfile; tests/test.sh', 'Pinned tooling/runtime is declared and canonical bytes match. No actual provider-enabled full launch/grading log for this input; source and scripted browser runs cannot establish this row.'),
('environment/instructions/integration.md; tests/test.sh:APP_ENTRY/APP_DB', 'Absolute node /app/server.js, PORT3000, DB_PATH, health and local runtime agree. No promised /app working directory or npm-start assumption; golden uses __dirname.'),
('tests/scoring.toml; tests/gates/*/judge.toml; tests/scored/*/judge.toml', 'All seven TOML files parse; five dimensions, 73 unique criterion IDs, correct aggregations, 58 functional rows total32.70,7 polish,6 visual; functional alone has restart MCP.'),
('tests/*/*/prompt.md:opening and implementation-evidence restrictions', 'All five require live browser at localhost3000 and forbid app-source scoring. Functional permits only authored product snippet data, observed UI/data requests and bounded instrumented controls.'),
('environment/instructions/integration.md; tests/gates/constraints/judge.toml; functional prompt S22', 'All task-added behavior maps to named functional/polish/visual outcomes. Exact Express/better-sqlite3/SQLite mandate is inherited shared runtime policy: browser persistence/restart proves durability but cannot distinguish a conforming file store; no source-reading tool permitted. Shared assurance gap, not justification to alter frozen harness.'),
('behaviour.md:Preview/Saved snippets; functional prompt S04/S10/S23; polish P02', 'New late-error cancellation, newest-good rollback and repeated editor conflict requirements are public. Exact labels/routes/styles, mandatory escape hint, fixed frontend package and hidden realm probes are not required.'),
('functional judge:S04,S10,S22,S23; polish judge:P02 rows', 'Cancellation, rollback, message/line, saved refusal, dirty recovery and restart read/write are separately owned; repeated role-reversal trials exercise the same properties. P02 names/reachability/focus/navigation have separate verdicts. No new bundled unrelated outcome found.'),
('tests/gates/{render,constraints}/judge.toml; scored prompts:Global browser gate', 'Render requires authored live output; Constraints requires real newly saved source retrieved in independent clean context. Scored gates tolerate different schemas, public assets, empty library and previous mutations; no health-only or static-JSON bypass.'),
('functional prompt S02/S03/S04/S07/S08/S17/S23/S24/S36', 'Observed button/timer, uncancelled delayed mutation/log/error, matching transport, valid source, working auto-run and successful current writes precede negative probes. S04 baseline distinguishes retained errors from new stale errors; dead timer cannot earn cancellation.'),
('functional prompt S08/S19/S23/S24; polish P02', 'All five forbidden families, three syntax languages, both role-reversal conflicts and named title cases are enumerated; complete saved fields/revisions checked and unrelated records protected.'),
('functional prompt:tool recipes and S04/S10/S23/S36', 'Judgment uses authored DOM/logs, real UI states and observed request replay; no hidden global-state retrieval/source classifier or one-second timing distinction. Transient synchronous S04 DOM mutation explicitly does not require a screenshot between statements.'),
('functional prompt:Shared-scenario scoring contract; app_context.md:Evidence failures', 'One named outcome per row with actual shared controls, independently preserved observations, no EVALUATION_INCOMPLETE prefix or whole-protocol verdict. S23 recovery fallback does not erase first-cycle facts.'),
('functional prompt S03/S04/S09/S17/S34/S36; polish responsive_layout; visual prompt', 'Explicit waits, actual timed action batches, keyboard events, theme switches and 390x844 comparison; not first-paint-only instructions.'),
('constraints gate; functional prompt S21/S22/S23', 'Independent-context saved read, browser reload, one actual process restart and repeated conflict/readbacks prove observable server persistence rather than client storage alone.'),
('environment/assets/seed_data.json; solution/app/starters; functional prompt authored markers', 'Empty supplied records and authored generic starters do not contain QC Concurrent/Reverse/Restart titles or cancellation/latest-good markers; no expected postmutation records are preshipped.'),
('tests/app_context.md:Library and state; scored prompts', 'Continuing DB explicit; gate record untouched, scenario-owned titles, actual revision refresh, no pristine library requirement. Polish makes its own harmless saved record; Visual mutates none.'),
('functional prompt:Shared-scenario scoring contract; polish/visual prompt endings', 'Independent verdict and continue-after-failure language present; no sibling pass flags or blanket all-legs score; mandatory controls establish evidence rather than separate feature inheritance.'),
('render/constraints gates; tests/scoring.toml', 'Blank/dead-Run and client-only saves logically fail gates, unlike old shell bypass. No actual current-candidate weak/mocked-app grading establishes achieved floor/discrimination; do not equate reasoning with a measured result.'),
('tests/scoring.toml; functional 58 outcomes; app_context.md:Evidence failures', 'Canonical weighted_mean and local outcomes support partial credit in design; no configured full-verifier weak/partial/golden score spread for these exact inputs.'),
('tests/scored/functional/judge.toml; polish/judge.toml; visual/judge.toml', 'Observable behaviors are binary; visual craft has six five-point Likert scales with all anchors and correct (raw-1)/4 explanation.'),
('tests/scoring.toml; functional judge weights', 'Fixed positive .6/.2/.2 weights are monotone for componentwise improvements; empirical weak/strong ranking through the configured judge is absent. A target Luna score cannot be inferred from this change.'),
('tests/test.sh:gate branch; tests/tools/score.py; tests/scoring.toml', 'Zero-mass gates run first; any failed gate stops scored suite; functional must exceed .05 before shape contributes. Canonical implementation unchanged.'),
('functional judge weights; tests/scoring.toml', '32.70 total with2.0 mass moved toward cancellation/latest-good/conflicts; required basics retain positive credit. Functional60% outweighs combined40% presentation. Shift is modest, not proof of target model grade.'),
('tests/*/*/prompt.md:untrusted-evidence openings', 'All dimensions explicitly reject submission scoring directives across UI, payloads, code and errors; source is excluded as scoring evidence.'),
('environment/Dockerfile; task.toml:separate; tests/test.sh:sanitized launch', 'Agent image has no tests/judge/RewardKit; app runs uid65534 without provider env and /tests is protected. Structural isolation reviewed, not hostile-app runtime penetration testing.'),
('task.toml:verifier.env; tests/Dockerfile; canonical tools', 'Current shared model/CLI/RewardKit/browser installation retained; no task date-dependent expected values. Public network and lack of temperature/version marker are allowed profile choices; no promise identical LLM judgments.'),
('tests/app_context.md; all five prompt.md', 'Names, no-auth public library, screens and current semantic scope agree; no marketplace, Docketlight or private-file-classifier residue. Actual earlier records tolerated.'),
('task.toml; integration.md; test.sh; app_context.md; five judge.toml', 'Node entry/port/DB_PATH/health/seed, shared model, dimension shares, restart helper and58/23 protocol inventory agree across files. Parsed judge headers match frozen template.'),
('frozen task tree; preflight.json:closed tests file list', 'Exactly50 task files under allowed roots, source plus built golden only; no reports/ZIP/db/node_modules/cache shipped; all tests entries expected.'),
('task.toml; tests/*.toml; five judge.toml; seed and package JSON; shell scripts/server.js', 'Independent tomllib/json parsing succeeds, node --check server.js and bash -n both scripts succeed, LF checked. This is syntax/source feasibility, not measured full provider execution.'),
('public files; seed; task.toml:env; solution/server.js', 'No live credentials/host paths/draft markers found; env token is a template. Seed has no identities or PII. Public app networking is allowed; snippet networking separately restricted.'),
('instruction.md; behaviour.md; task.toml; frozen template', 'Product-specific source is clearly authored beyond template placeholders. Full sibling task corpus/domain-plan uniqueness was not supplied in frozen inputs, so broad suite-distinctness cannot be established.')
]
assert len(q) == 53
for row,(path,evidence) in zip(report['quality'],q):
    row.update(verdict='Pass', evidence=f'{path}: {evidence}', risk=False)
for n in [11,22,39,40,42]:
    report['quality'][n-1].update(verdict='Not exercised',risk=True)
for n in [26,53]:
    report['quality'][n-1].update(verdict='Note',risk=True)
d = [
('Note','task.toml: public verifier network, no allowlist; profile exemption applies.'),
('Note','Staged task; fixed server entry, no legacy APP_MANIFEST requirement.'),
('Pass','environment/Dockerfile COPY stages actual seed and six instruction notes named by public brief.'),
('Pass','All three scored prompts require independent verdicts and continuation after ordinary failure.'),
('Note','Skill explicitly overrides canary convention for staged WebDev.'),
('Pass','Independent byte comparison: both tools, scoring, test.sh and Dockerfiles match frozen template; task.toml verifier.env unchanged.'),
('N-A','instruction.md and app_context Accounts explicitly no sign-in; no demo account emails.'),
('Pass','environment/Dockerfile actual COPY lines are only instructions and assets.'),
('Note','WebDev profile override; image policy checked under check-dockerfiles.py.'),
('Pass','Canonical Node/Python bases, versioned npm/pip packages; tests image copies own /tests; agent image excludes tests/solution. Apt policy left as template.'),
('Pass','Every Docker COPY input exists; seed and all package JSON parse.'),
('Pass','instruction.md exceeds40 words; independent marker scan finds no TODO/FIXME/CHANGE_ME.'),
('Pass','Read public notes and inspected empty public criterion-ID/term scanner results in preflight.json; no test literals leaked.'),
('Note','task.toml public network; no offline mandate needed.'),
('Pass','instruction.md ends with product/runtime asset permission, not terminal-bench suffix.'),
('Note','Public browser network permits remote assets; snippet-network boundary is separate.'),
('Pass','Independent shipped-text scan and read found no author-machine absolute paths.'),
('Pass','task.toml contains only variable token template and empty API key; no PEM/provider key literal or seed credentials.'),
('Pass','Independent task-text scan found no CHANGE_ME/TODO/FIXME placeholder; full source paths reviewed.'),
('Pass','Frozen tree50files matches closed task roots/tests entries; built app is deliberate solution output.'),
('Pass','Parsed five judge structures contain no files/target_claims model keys; no legacy checks/expected directory.'),
('Note','package.json runtime dependencies Express5.1.0/better-sqlite3 12.4.1 installed in both images; Vite/TypeScript build-only and public-network profile.'),
('Pass','Empty seed and generic authored starters do not contain QC saved titles or authored cancellation/rollback probe markers.'),
('Pass','All staged files present including app_context.md and both tools; no reward.toml or stray tests entries.'),
('Note','Retired reward.toml schema is not used; staged scoring.toml parsed.'),
('Note','Retired reward.toml weights are not used; staged scoring policy unchanged.'),
('Pass','Five substantial prompts open localhost3000, inject app context/criteria, prohibit source scoring and carry evidence-failure rules; scored gates explicit.'),
('Pass','Five judge TOMLs parsed; headers equal frozen template, positive criterion weights, unique IDs, binary gates and only functional restart MCP.'),
('Note','No legacy browser segments; staged profile no-op.'),
('Pass','Public integration and verifier agree on absolute node entry, port, DB_PATH, health and seed; no CWD dependency asserted.'),
('Pass','Both Dockerfiles explicitly install Express5.1.0 and better-sqlite3 12.4.1 with common NODE_PATH.'),
('Pass','Parsed .6/.2/.2, gates0, floor.05; ordered gate/scored branches and600/9000/900 budgets nest under1500/11100/13200. Arithmetic only.'),
('Pass','bash -n solve.sh passes; LF/shebang present, copies into/app only, no pkill or NODE_ENV production; checked reset only during install.'),
('Pass','task.toml turing/colderwater-playground-devtools equals logical project slug (snapshot directory task is transport-only).'),
('Pass','bash -n test.sh passes; zero initial reward, EXIT trap, sanitized nonroot launch, liveness and helper export/wiring inspected.'),
('Pass','No environment.allow_internet=false; public network explicitly selected.'),
('N-A','No docker-compose file or host bind declaration ships.'),
('Pass','Both Dockerfile FROM lines omit --platform.'),
('N-A','task.toml has no GPU request.'),
('Pass','No redundant allow_internet=true key.'),
('Pass','Read Dockerfiles and shell scripts; rg shows no nproc call.'),
('Pass','Only pip install is harbor-rewardkit==0.1.7; no unpinned pip/uvx trial install.'),
('N-A','No pytest or pytest-json-ctrf pins are present or needed by configured RewardKit harness.'),
('Pass','Public integration names /app/server.js,/app/public/index.html,/app/app.db,/assets/seed_data.json and/instructions absolutely.'),
('Pass','Logical task slug colderwater-playground-devtools has exactly3 hyphen-separated tokens.'),
('Pass','Referenced runtime deliverables server.js/public index/db/seed appear in public notes; authored snippet filenames are product probe data, not hidden app output requirements.'),
('Pass','test.sh contains localhost urllib liveness only; no external fetch/install/git clone during trial.'),
('Pass','Tooling is baked into canonical tests/Dockerfile; test.sh installs none, pytest unused.')
]
assert len(d) == 48
for row,(verdict,evidence) in zip(report['deterministic'],d):
    row.update(verdict=verdict,evidence='Manual application of documented checker behavior; '+evidence,risk=False)
report['summary'] = 'No confirmed candidate-specific source Fail. Seven unresolved assurance rows: unmeasured judge workload/full grading/weak-app floor/discrimination/ranking, shared browser-only stack verification limit, and corpus-wide distinctness. Source hardening is fair and locally reviewable; this report does not clear release or promise Oracle/Luna scores.'
(root/'reviewer-2.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('Wrote reviewer-2.json: 53 quality, 48 deterministic rows')
