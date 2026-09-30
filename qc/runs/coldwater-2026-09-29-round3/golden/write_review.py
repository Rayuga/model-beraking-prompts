import json,importlib.util
from pathlib import Path
out=Path(__file__).resolve().parent
run=out.parent
root=out.parents[3]
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
report=read(run/'reviewer-3.template.json')
task='.qc-cache/coldwater-2026-09-29-round3/task/'
gold='qc/runs/coldwater-2026-09-29-round3/golden/'
result=read(out/'run-golden-20260929-064533/RESULTS.json')
assert result['passed'] and len(result['fresh_fact_keys'])==58 and not result['reused_fact_keys']
assert result['restart']['actual_calls']==1
Q={
1:('Pass','instruction.md: paragraphs 1-5 ask for a useful local browser playground in first-person prose, including preserving working previews and saved work; no acceptance table or build recipe.'),
2:('Pass','instruction.md: "The annoying part with playgrounds is losing something that was working" and environment/instructions/behaviour.md: "I might leave it there for a while" retain a consistent practical voice across the six notes.'),
3:('Pass','instruction.md and all six environment/instructions notes were read; no contradictory clock/accounts/runtime facts or unfinished text. golden/review-source-checks.json: draft/host scans empty.'),
4:('Pass','environment/instructions/integration.md states /app/server.js, node, 0.0.0.0:3000, public/index.html, /api/health, DB_PATH and local SQLite. instruction.md names six notes and /assets/seed_data.json; behaviour/security describe the exact bounded code/run and library promises. No calendar-clock or account fixture is required.'),
5:('Pass','instruction.md plus environment/instructions/*.md contain product language; fresh machinery scan found no judge/rubric/RewardKit/Playwright/model/test-path leakage. Exact fixture literals occur only in tests, not the public ask.'),
6:('Pass','environment/instructions/security.md bounds literal source, callbacks and unsupported execution; behaviour.md permits static rollback and candidate display. Current golden executes all 58 outcome probes successfully; frontend choice, labels and route shapes remain free. This establishes reference feasibility, not target-builder timing.'),
7:('Pass','behaviour.md and security.md require real execution, deadlines, isolated previews, exact persistence and stale revision refusal; tests/gates/render and constraints require authored execution and independent-context retrieval, excluding a static shell.'),
8:('Pass','task.toml:[task]/[metadata] consistently name Colderwater playground and its isolation/conflict challenges. Logical delivery slug colderwater-playground-devtools has three tokens; the frozen cache directory named task is a QC wrapper, not a new task slug.'),
9:('Pass','task.toml:[environment] specifies public network, 2 CPUs and 4096 MB; no docker_image or allow_internet key. Both credential values are empty/template under verifier.env, not an agent secret.'),
10:('Pass','task.toml:[verifier] is separate/public; verifier.env equals the frozen template. tests/Dockerfile pins CLI/MCP/RewardKit packages; all judge.toml files use claude-code fallback with no model override. Credentials are structurally templated; provider authentication was not exercised.'),
11:('Not exercised','task.toml and tests/test.sh: 600+600=1200<1500 gate budget, 9000+900+900=10800<11100 scored budget, 1500+11100=12600<13200 verifier. Functional prompt totals 370 planned UI actions across 23 protocols. Fresh scripted 96.9166s is not model judge time; no hash-bound full provider timing, target-builder run or cold-build measurement establishes production fit.'),
12:('Pass','task.toml:[environment] has active environment/Dockerfile and no docker_image field; no prebuilt tag shadows those steps.'),
13:('Pass','instruction.md references six /instructions notes and /assets/seed_data.json; environment/Dockerfile COPY instructions/assets stages them readably. Seed says no implementation/user records and app-authored examples, consistent with public overview and tests/app_context.md.'),
14:('Pass','environment/assets/seed_data.json is valid JSON with product, empty snippets array and scope note; no identifiers to orphan, credentials, persons or injection payload. Fresh parser checks cover all four JSON files.'),
15:('Pass','environment/Dockerfile uses canonical node:22-bookworm-slim, installs express@5.1.0 and better-sqlite3@12.4.1, exports NODE_PATH, stages inputs and initializes empty /app. Canonical byte comparison passes. Cold build duration remains unmeasured under Q11.'),
16:('Pass','environment/Dockerfile copies only instructions/ and assets/ and creates .gitkeep. Seed is scope-only, notes contain no schema/routes or partial implementation; solution and tests are not copied into the agent world.'),
17:('Pass','solution/app/src/app.tsx implements CodeMirror workspace, examples, New/Save, conflict draft recovery, console tree and theme; runtime.ts implements preview isolation, deadline and rollback; server.js implements revisioned local persistence. src/style.css supplies narrow layout and focus treatment. Current golden provides 58 functional observations.'),
18:('Pass','tests/scored/functional/judge.toml has 58 outcomes; fresh run-golden-20260929-064533/RESULTS.json records all 58 passing facts without reuse. app.tsx/style.css plausibly satisfy all seven usability and six visual criteria; these craft judgments were source-reviewed, not scored by a provider.'),
19:('Pass','solution/solve.sh installs static app files into /app and refuses reinstall over open DB handles; no test/log writes, pkill, startup install or production env override. server.js honors DB_PATH, PORT and required health/UI paths. Fresh container starts the app unprivileged and restarts over its same fresh DB.'),
20:('Pass','solution is a frozen 23-file static input bound in frozen_round3_inputs.json; no startup fetch or regenerating reference. server.js creates tables idempotently without inserting duplicate examples. IDs and write timestamps are runtime data, not pinned graded calendar values; canonical golden restart preserved records.'),
21:('Pass','tests/test.sh: write_zero_reward before grading, EXIT cleanup/ensure_reward, symlink checks, sanitized env and UID65534, readiness before gates, gates then scored with score.py. No shell exec replaces the trap. Source/manual checks and scorer edge cases pass; full provider failure-path integration is unmeasured under Q22.'),
22:('Not exercised','tests/Dockerfile and fresh image launch provide app runtime, actual Chromium/MCP and canonical restart. golden/tooling-smoke.json proves configured browser_run_code_unsafe clean-context/routing capabilities. No complete hash-bound test.sh + RewardKit + claude-code/OpenRouter grading run was performed; required full grading evidence remains absent.'),
23:('Pass','tests/test.sh launch/readiness/DB_PATH/PORT/NODE_PATH match environment/instructions/integration.md. App assets required after development reside in /app; solution server has no /assets runtime dependence. Gate retrieval uses actual observed application data, with no fixed save route/schema or forced same-origin restriction.'),
24:('Pass','All five judge.toml parse with unique positive typed criteria; counts 1 render, 1 constraints, 58 functional, 7 polish, 6 visual. All have browser MCP; only functional has restart_mcp.py with $APP_RESTART_HELPER. test.sh exports it and substitutes app_context; prompts retain {criteria}; scoring.toml defines the staged policy.'),
25:('Pass','Every tests/*/*/prompt.md opens localhost:3000 with Playwright, requires actual UI evidence, and forbids implementation/bundle inspection. Functional allows entered source as product data but explicitly says reading it does not prove execution. MCP smoke confirms the named unsafe-code tool exists and supports required contexts/routes.'),
26:('Note','Product mapping: overview/startup/examples -> S01; execution/CSS/deadlines/errors/isolation -> S02-S13/S36; console/auto/editor -> S14-S19; durable shared library/title/revisions -> gates/Constraints and S21-S24; themes -> S34/Visual; keyboard/mobile -> Polish. Remaining assurance conflict: integration.md mandates Express/better-sqlite3/Node-only backend, inherited from frozen template integration.md; browser-only judges explicitly cannot prove engines or all server implementation restrictions. This shared-policy limitation is unresolved, not a new task-added frontend mandate.'),
27:('Pass','Public six-note requirements support current outcome descriptors. prompts accept arbitrary labels/routes/layout, optional frontend, either theme, native editor escape, current library state and sensible console history. Supported extensions do not require rejection of all others. S22 new write is directly supported by durable saved changes; fallback grades no new product feature.'),
28:('Pass','Functional ownership is separated across dispatch/CSS state, errors/lines/rollback, refusal/draft recovery, theme switching/preservation, and S22 survival versus post-restart write. S22 prompt preserves durability before later write and allows independent fresh-record fallback; current facts emit durability first. Polish keyboard names/reach/focus/navigation and Visual mobile composition vs Polish operability are expressly separated. No demonstrated duplicate or incompatible full-credit bar.'),
29:('Pass','tests/gates/render requires one new authored DOM/log Run; constraints requires successful UI save and independent clean-context server read/reload. All scored prompts restate current browser/server prerequisite and zero on observed failure (Visual anchor1). Empty library, server-rendered data, app CDNs and no account are explicitly valid.'),
30:('Pass','Functional S02 actual working script/button/timer precede inertness; S04 exact A callback fires before supersede/Stop baselines; S07 clean fetch/image controls precede no delivery; S08 harmless successful control/fallback; S17 automatic execution before off outcomes; S23/S24 valid current writes and recovery before refusal; S36 working nested timers. Fresh results include matching control facts, not absence-only passes.'),
31:('Pass','S05 checks all four parent/storage operations; S08 all five separately attempted families; S09 both loop syntaxes and Promise callback; S24 exact/padded/empty/whitespace titles independently; S22 snapshots complete library and exact target fields/revisions, preserving unrelated entries during later write. P02 covers every requested enabled control; no fixed total record count.'),
32:('Pass','All 58 functional descriptors name browser-visible DOM/log, line, timer, data or field outcomes. S22 uses canonical restart tool plus ordinary read/write; context recipes and local network controls work in actual MCP smoke. No source classifier, hidden realm probe, guessed route or required private storage inspection appears.'),
33:('Pass','tests/scored/functional/judge.toml and protocols provide one named bar per key; successful controls support that bar without inheriting sibling scores. S22 durability is exact pre-restart record survival, weight2.0; write is valid current save/readback, weight0.5 with a bounded fallback. Descriptors do not waive their required observations.'),
34:('Pass','Functional S03 waits two six-second idle intervals then click/key/input; S04/S09/S36 measure actual deadlines; S17 batches edits and delay windows; S34 toggles twice. Polish resizes to roughly390x844 and actually traverses keyboard controls; Visual compares views/themes. These are required actions, not first-paint guesses.'),
35:('Pass','Gates require execution and server-backed independent clean-context retrieval. S21 reload and S22 one actual restart establish durable identities/source/revisions; fresh run observes both S22 survival and subsequent writable readback. S23 exercises real simultaneous dirty editors, not only an old API payload.'),
36:('Pass','environment/assets/seed_data.json has no saved records. Fresh probe scans found no named QC Save/Restart/Title or runtime marker in seed/reference. Runtime logs show new fixtures created by UI; title/identity values are not pre-satisfied.'),
37:('Pass','tests/app_context.md: Library and state preserves unknown CW gate records; Functional reads current state and uses protocol-owned fixtures; Polish may create only its own keyboard control; Visual makes no durable changes. No later pristine-seed assumption or exact total count.'),
38:('Pass','Functional opening/shared-scenario contract requires independent rows and preserves sibling observations, bounded fallbacks and continuation; Polish and Visual explicitly continue after failure. S22 later failed write cannot erase observed survival; missing old Primary cannot automatically erase valid current writing.'),
39:('Pass','Source-level floor analysis: blank/static/mock/seed-only/refuses-all submissions cannot establish Render authored output plus Constraints new independent-context retrieval. Scorer zeroes failed gates and functional<=0.05. This is policy reasoning and synthetic scorer validation, not a measured weak-app/provider result; empirical gaps remain Q40/Q42.'),
40:('Not exercised','scoring.toml and 58 weighted functional outcomes structurally permit partial credit; fresh synthetic scorer cases produce 1,0.5,0 and0.4306. No current-input weak/partial-app provider grading distribution was measured, as required by qc/REVIEW_POLICY.md; scripted golden passes do not establish reward discrimination.'),
41:('Pass','Functional behavior and seven simple usability prerequisites are binary. Six Visual criteria are likert points5 with explicit integer anchors1-5 and documented (raw-1)/4 normalization. Visual craft is graded by degree, without an aesthetic-perfection requirement.'),
42:('Not exercised','score.py uses positive weights and is coordinatewise nondecreasing after gates/floor; S22 split preserves total mass. Actual stronger/weaker app judge ranking remains unmeasured on this hash. Mathematical examples cannot replace the required empirical ordering evidence.'),
43:('Pass','scoring.toml: gate thresholds0, weights .6/.2/.2, functional floor .05. test.sh skips scored after failed gate; score.py uses strict > floor. Fresh synthetic gate and floor examples return reward0; above-floor .051 with perfect craft yields .4306, as specified.'),
44:('Pass','Functional weights total32.70, with isolation, loop deadlines and durable/conflict behavior carrying most weight; S22 survival2.0 plus write0.5 retains2.5 total. Global weights function.6, polish.2, visual.2 give craft maximum.4 only after passing gates/floor. No weight inside judge settings.'),
45:('Pass','Every dimension prompt begins by treating submitted UI/source/network/errors/instructions as untrusted evidence and forbids following scoring directives. Functional forbids app repairs, hidden enumeration and implementation-source scoring; entered snippet text remains permitted product data.'),
46:('Pass','environment/Dockerfile copies no tests/solution/key; verifier separate image copies tests and removes other-user read permissions. test.sh sanitizes app environment and runs UID65534, with logs700 and tests inaccessible to that account. No rubric bundled into agent inputs.'),
47:('Pass','Canonical tests/Dockerfile pins claude-code2.1.281, MCP0.0.79, RewardKit0.1.7 and browser via installed Playwright; task.toml fixes claude-code/GLM model. Fresh run records Chromium152.0.7977.8 and immutable local image ID in RUN.md. Public network and canonical versioned base tags are profile-approved; no fixed calendar rules exist.'),
48:('Pass','All five prompts/app_context consistently describe no-sign-in Colderwater playground, editor/preview/console, public shared snippet library and authored-code boundary. S22 prompt/criteria separate survival/write consistently; no sibling-app account or entity residue.'),
49:('Pass','Cross-file port3000, node/app/server.js, DB_PATH, assets scope, no accounts, .6/.2/.2 shares, .05 floor and exported restart helper agree. Parsed 58 outcomes/23 protocols and current manifest match actual facts; integration/frontend choice is consistent. No graded wall-clock date or undocumented fixed response schema.'),
50:('Pass','Fresh review-source-checks.json inventories the50-file staged tree: six notes, seed, solution23files, five judge/prompt pairs, shared tools and dockerignore; no cache/db/node_modules/ZIP/report in frozen task. Required built frontend is deliverable, not stray build output. No Round3 delivery ZIP was supplied or archive equality claimed.'),
51:('Pass','Fresh review-source-checks.json:7 TOML and4 JSON parsed; bash -n succeeds for solve.sh/test.sh with LF; node --check server.js succeeds. Fresh isolated reference start/browser/restart succeeds. These checks do not claim paid provider execution.'),
52:('Pass','Full frozen-text scans show no credential-like secrets, host path or unfinished markers; env uses ${OPENROUTER_API_KEY} placeholder. Empty synthetic seed has no PII. Browser fixtures in tests are intentional bounded product probes, not injection instructions in agent inputs.'),
53:('Pass','instruction.md and six notes focus on code execution snapshots/deadlines and conflict-safe snippets. Compared projects/patchpad-editor/instruction.md: custom incident-document editing/revision-history ask has different constraints and core flows; this task is not a nouns-swapped clone.')
}
assert len(Q)==53
for n,row in enumerate(report['quality'],1):
 verdict,evidence=Q[n]
 row.update(verdict=verdict,evidence=task+evidence,risk=n in {11,22,26,40,42})
D=[
('Note','task.toml verifier.environment network_mode=public and no allowed_hosts; allowlist intentionally unnecessary.'),
('Note','Staged tests/gates+scored and fixed /app/server.js entry; APP_MANIFEST.md legacy checker is a documented no-op.'),
('Pass','instruction.md names seed and six notes; environment/Dockerfile COPY instructions/assets sources exist and stages those exact paths.'),
('Pass','All three scored prompts explicitly require independent verdicts and continuation; gate all_pass exception applies.'),
('Note','Skill deterministic references override common canary convention for full webdev app solutions; no GUID required.'),
('Pass','golden/review-source-checks.json canonical comparisons: score.py, restart_mcp.py, test.sh, both Dockerfiles, scoring.toml and verifier.env match frozen template exactly.'),
('N-A','instruction.md and app_context explicitly state no accounts; no sign-in emails/passwords to reconcile.'),
('Pass','environment/Dockerfile real COPY lines include only instructions/ and assets/; no solution/tests. Verifier copies its own tests context as intended.'),
('Note','Skill override delegates Docker policy to check-dockerfiles; canonical apt packages lack individual pins, permitted by profile.'),
('Pass','Both Dockerfiles match canonical: versioned node/python bases, npm @versions, harbor-rewardkit==0.1.7; no solution in agent image; functional restart command uses /usr/local/bin/python3.'),
('Pass','Docker COPY sources exist; seed JSON parses; readonly fixtures align with scope-only product description.'),
('Pass','instruction.md has232 words and fresh scan no TODO/FIXME/CHANGE_ME/placeholder; read as a finished product request.'),
('Pass','Brief/six-note manual comparison and machinery scan: no criterion IDs/probe sentinels/model names or grading instructions; product rules overlap semantically, not leaked rubric prose.'),
('Note','task.toml public development/verifier network; no offline restriction to state.'),
('Pass','instruction.md ends with product/runtime asset guidance, no terminal-bench timed/anti-cheating suffix.'),
('Note','App-level external fonts/scripts/CDNs are publicly allowed; snippet-authored networking is a separate stated product boundary. Public network is no CDN defect.'),
('Pass','Fresh complete-text host-path scan empty; absolute /app,/assets,/instructions,/tests paths are container contracts.'),
('Pass','Fresh full-text secret scan empty; verifier authentication uses environment placeholder and empty API_KEY, no literal key.'),
('Pass','Fresh complete-text draft-marker scan empty; {criteria}/{app_context} and restart substitution tokens are live harness templates, not unfinished task text.'),
('Pass','50-file inventory fits staged contract and compiled app deliverable; no scratch/report/ZIP/DB/cache files inside frozen task.'),
('Pass','All five judge TOMLs manually inspected: no files/target_claims or TrialForge keys; inventory contains no legacy check.py/expected folder.'),
('Note','package.json runtime express/better-sqlite3 versions are preinstalled in both images; frontend build dependencies need not be globally preinstalled on public network, compiled app already supplied.'),
('Pass','Fresh golden source-check marker scans have no pre-satisfied seed/reference hits; actual current run creates distinctive records and runtime markers.'),
('Pass','50-file tree has every staged required file, nonempty app_context and five prompts; no reward.toml/.env/NOTES/SOLUTION or stray tests entry.'),
('Note','No retired tests/reward.toml; staged scoring.toml owns schema and passes fresh parser/policy assertions.'),
('Note','Retired reward weights checker is a staged no-op; current scoring.toml sums positive weights to1.'),
('Pass','All prompts substantial, localhost:3000/browser-driven, submission-untrusted and honest evidence-failure language; scored gates present; app_context substituted by test.sh.'),
('Pass','Fresh parser/schema assertions all five judges: batched fallback, no model/temperature/reasoning/weight override, unique IDs/positive typed criteria, browser MCP all, restart MCP only functional, both placeholders valid.'),
('Note','No legacy browser segments manifest; staged judge criteria/prompt ownership applies.'),
('Pass','integration.md entry/port/DB_PATH/NODE_PATH/health/UI paths match test.sh launch, app_context URLs and solve.sh install.'),
('Pass','Both canonical Dockerfiles globally install express5.1.0/better-sqlite3 12.4.1 with NODE_PATH; runtime needs no frontend build tooling.'),
('Pass','Fresh policy checks enforce render/constraints thresholds0, .6/.2/.2, .05 functional floor, suites and timeout nesting; synthetic scorer edge cases pass.'),
('Pass','solve.sh has valid LF bash, installs only /app files, checks open DB before replacement, no pkill or production env, no writes to tests/logs/solution.'),
('Pass','task.toml logical name turing/colderwater-playground-devtools matches delivery slug; frozen task folder is a cache wrapper.'),
('Pass','test.sh bash parse passes; source confirms zero/trap, liveness before RewardKit, no replacing shell exec, staged suites, helper export and functional MCP argument.'),
('Pass','task.toml omits environment.allow_internet entirely; no false value.'),
('N-A','No docker-compose file in frozen50-file task inventory; no compose host bind to inspect.'),
('Pass','Both Dockerfiles FROM statements have no --platform restriction.'),
('N-A','No gpu_types or GPU request; canonical CPU environment.'),
('Pass','No environment.allow_internet=true; public network uses network_mode.'),
('Pass','Both Dockerfiles, test.sh and solve.sh have no nproc invocation.'),
('Pass','tests/Dockerfile pip3 install uses harbor-rewardkit==0.1.7; no unpinned pip/uv install in the other scripts.'),
('N-A','No pytest/pytest-json-ctrf version pinned or used; scorer uses RewardKit, not pytest.'),
('Pass','Public runtime/asset/note paths are absolute /app,/assets,/instructions; no assumed author working directory.'),
('Pass','Logical slug colderwater-playground-devtools has three hyphen-separated tokens; QC cache task name is not shipment slug.'),
('Pass','Shared required server.js/UI/database outputs and note/seed paths are stated in integration.md/instruction.md; tests-only helper/logs are harness-owned, not hidden agent deliverables.'),
('Pass','test.sh does no external fetch/install/clone at trial; readiness urllib is localhost and RewardKit provider interaction is intended.'),
('Pass','tests/Dockerfile bakes CLI/MCP/browser/RewardKit; test.sh installs nothing. No pytest-based verifier tooling requirement applies.')
]
assert len(D)==48
for row,(verdict,evidence) in zip(report['deterministic'],D):
 row.update(verdict=verdict,evidence=task+evidence+' Manually applied documented checker behavior; private portal checker was not run.',risk=False)
report['read_sources']={'workbook':True,'skill':True,'template':True}
report['scope']={'frozen_task':task,'workbook':'All populated rows of all four frozen workbook sheets read, plus list_checks.py enumeration.','skill':'Frozen SKILL.md and all three references read.','template':'Frozen template instruction/integration/notes/task.toml read; canonical runtime sources read in task and exact-compared to frozen template.','independence':'No other reviewer report or prior verdict report read or copied; current input reviewed directly.','runtime':gold+'RUN.md; current RESULTS.json, pre/post facts, actual restart and actual MCP tooling smoke.','limits':'Scripted reference verification is not Oracle score, full provider grading, target-builder timing or empirical weak/partial reward discrimination. No current delivery ZIP supplied.'}
report['summary']='No demonstrated task-local grading defect. Fresh 58-outcome reference run and configured MCP capability smoke pass; five unresolved assurance risks remain: production workload, full verifier/provider grading, shared backend-technology policy coverage, empirical reward discrimination and empirical ordering. This report does not clear runtime requirements.'
report['policy_limitation']='Q26: mandatory backend technology comes from canonical integration policy, while judges must remain browser-only. Resolve upstream policy/assurance explicitly; do not silently add source inspection or rewrite frozen shared files.'
path=run/'reviewer-3.json'
path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
spec=importlib.util.spec_from_file_location('qc_pipeline',root/'scripts/qc_pipeline.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
errors=m.validate_report(report,'reviewer-3',read(run/'manifest.json'),read(run/'checklist.json'))
validation={'errors':errors,'quality':len(report['quality']),'deterministic':len(report['deterministic']),'risk_rows':[r['id'] for r in report['quality'] if r['risk']]}
(out/'report-validation.json').write_text(json.dumps(validation,indent=2)+'\n')
print(json.dumps(validation,indent=2));assert not errors
