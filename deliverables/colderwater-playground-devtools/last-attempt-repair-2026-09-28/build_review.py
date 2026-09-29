import json,re,tomllib,openpyxl
from pathlib import Path
root=Path(__file__).resolve().parents[3];out=Path(__file__).resolve().parent
task=root/'projects/colderwater-playground-devtools'
workbook=openpyxl.load_workbook(root/'WebDev Rubrics QC.xlsx',data_only=True)
manifest=json.loads((out/'review-candidate/candidate_manifest.json').read_text())
audit=json.loads((out/'audit.json').read_text());assert audit['passed']
notes={
1:'instruction.md opens with a personal request for a code playground; operational details live in six product notes.',
2:'Read the reduced brief and all six notes. Contractions and concrete frustrations remain. Naturalness is subjective; no hosted language review was run.',
3:'Public ID/grader-term scans pass. Removed workflows are removed from the public request as well as their criteria.',
4:'integration.md states Node22, node /app/server.js, 0.0.0.0:3000, /api/health, /app/app.db and DB_PATH. Runtime contract is unchanged.',
5:'No public criterion IDs, grader terms, probe filenames, internal scores or title fixtures. audit.json records fresh scans.',
6:'Run budget covers literal loops/timers/Promises; after-idle click handlers remain supported. Removed the separate pending-interaction deadline contract and private-file classification requirement. Local core fixtures are achievable; evaluator interpretation remains unmeasured.',
7:'Working isolated execution, last-good rollback, durable server saves and stale-edit conflict recovery cannot be satisfied by a static page.',
8:'task.toml names turing/colderwater-playground-devtools, describes this product and marks hard. No judge/admin history in description or provenance.',
9:'Agent and verifier settings match the public-network template, with2CPUs/4096MiB and no prebuilt agent image.',
10:'Frozen verifier env and judge headers match template. Local configured-provider credential was previously rejected; no new paid judge was run and portal-injected credentials are not verified here.',
11:'Judges: gates600+600<1500; scored9000+900+900=10800<11100; suites12600<13200. Work reduced37->23 protocols,93->57 outcomes, about715->366 estimated UI actions. Local scripted run95.4s is NOT judge timing. The 9000s completion risk remains unmeasured.',
12:'No environment.docker_image; Dockerfile remains authoritative.',
13:'Six notes and seed_data.json exist. Agent Dockerfile COPYs instructions and assets. All named paths resolve in audit.json.',
14:'Seed JSON parses, names this product, has empty snippets, and contains no credentials, people or implementation.',
15:'Both Dockerfiles match template. Existing verifier image runs this golden offline. Agent Dockerfile copies only notes/assets; a new clean image build was not run in this pass.',
16:'Reviewed environment tree/Dockerfile: public ask and empty-library metadata only; no solution, schemas, routes or rubric copied into agent world.',
17:'All23 golden files are unchanged. Fresh browser run exercises retained execution, storage, error, console, Auto-run and title flows; separate keyboard/mobile run passes. Optional old golden features remain ungraded.',
18:'All57 local functional assertions, two gate checks and seven usability checks pass. Desktop/mobile screenshots reviewed. This is not a configured-judge Oracle1.0 measurement or a guarantee of six Likert ratings.',
19:'solve.sh installs prebuilt app without packages; focused test starts node /app/server.js from /tmp. Full run launches unprivileged from /tmp and exercises actual canonical process restart and preserved DB. App uses absolute/__dirname paths.',
20:'Candidate is frozen by all50 file hashes and ZIP extraction hashes; golden bytes unchanged. These working-tree changes have not been committed/pushed in this pass.',
21:'test.sh now byte-identical to template; removed custom validate_suite and incomplete-prefix zeroing. Standard zero fallback/trap remains. A whole RewardKit process failure can still zero the run under the required shared harness.',
22:'Existing pinned verifier image ran Chromium, actual restart MCP and golden runtime. No new full RewardKit/provider session was possible; end-to-end grading remains unexercised.',
23:'integration.md gives absolute launch/DB/health contract and no /app-working-directory promise. Fresh non-app-CWD launch/restart succeeds.',
24:'Parsed five judges and scoring; template judge headers, all_pass gates, weighted_mean scored dimensions, Playwright and Functional-only restart server match. No extra model/weight keys.',
25:'Every prompt opens localhost3000 with Playwright; untrusted submission and implementation-source bans retained. Product snippets are allowed evidence, app implementation is not.',
26:'REQUIREMENT_MAP.md maps retained public behavior to the23 protocols plus gates/Polish/Visual. Removed CRUD/file/pane/privacy/hidden-CSS requirements have no remaining scored owner. Framework/source packaging are runtime deliverables, not inferred from UI.',
27:'No exact UI labels, fixed undocumented routes, during-loop responsiveness, private-file classifiers or documented-editor-escape requirement. New deadline fixture measures the stated five-second total.',
28:'Polish names/reachability/focus/navigation split. Functional outcomes keep separate messages/lines/rollback and server-refusal/draft-recovery credit. Shared working controls do not inherit another verdict.',
29:'Render requires new authored DOM/log output; Constraints requires actual new save and read from clean independent context. Scored prompts restate healthy workspace/server backing, without replaying gate identities.',
30:'Auto-run OFF requires prior automatic execution; CSS inert copy requires real prior script/handler plus retained clickable button; network uses locally fulfilled controls; title refusals have valid writes/recovery; stale Save has a newer successful write.',
31:'All four console levels, three dispatch/syntax languages, five unsupported execution families, four parent-boundary operations and every requested enabled control are covered. Full exact saved fields/revisions are compared.',
32:'Removed hidden CSS execution-realm probing and nine file-classifier probes. Nested-timer control now uses observable completion/noncompletion markers instead of8vs9second judge timestamps. Browser/tool compatibility is demonstrated locally, not for every conforming architecture.',
33:'No conflicting EVALUATION_INCOMPLETE rules. CSS inert content/handler outcome has one boundary with its positive control; colour is separate. Auto-run windows follow measured debounce. Shared timer deadline has an explicit positive control.',
34:'Fresh local tests click/type after six-second idle, switch themes, await timeouts and Auto-run, and resize390x844. Prompts request those actions explicitly.',
35:'Save/load and restart prove durable server records/revisions; actual canonical restart tool changesPID once. Concurrent dirty editor refusal/reapply is exercised. Source text alone cannot prove execution.',
36:'New probe literals are absent from empty seed and unchanged golden; actual gate test generates a fresh marker. Functional titles are scenario-owned, not initial examples.',
37:'Shared context leaves gate/unknown records alone. Functional owns new title fixtures; Polish prepares only one control record; Visual uses current state and performs no writes.',
38:'Functional collects23 protocols once for57 outcomes; failures remain local, use independent fallback, and every row needs a result. Other scored prompts also continue independently.',
39:'Static/no-op execution fails Render; client-only saving fails independent-context Constraints. Basic editor/theme-only weight1.2/32.7=3.67%, below fixed5% floor even if gates passed. No new full adversarial model evaluation was run.',
40:'Actual canonical scorer synthetic fixtures return0,.55,.85,1 as expected; losing one0.2-weight row yields.9963 rather than0. This proves arithmetic only, not configured-judge error recovery or model-score spread.',
41:'Functional/Polish behaviors are binary; all six visual criteria use five complete Likert anchors. No new aesthetic demands.',
42:'Positive weights and standard gates/floor make coordinate-wise reward monotone. Semantic ranking across actual target-model builds remains unmeasured.',
43:'Template gates precede scored suite and carry no final weight. Unchanged5% floor; synthetic gate/floor cases zero correctly.',
44:'Fixed60/20/20. Functional32.70 total; cheap editor/theme1.20, with primary weight in real execution/recovery/storage. Removing workflows changes normalization, so target-model score cannot be inferred from old runs.',
45:'All prompts treat submitted content/payloads as untrusted and forbid implementation-source grading. Browser scripts are trusted probe bookkeeping, not submission instructions.',
46:'Separate verifier image; agent COPY only notes/assets. Canonical script sanitizes/unprivileges app and isolates copied app from tests. No new live exploit attempt in this pass.',
47:'Canonical pinned tools/model/header settings retained. Public network is allowed by profile. Model interpretation and scheduling are not deterministic; this report does not claim identical repeated hosted QC results.',
48:'Prompts describe Colderwater and current accounts/screens; constraints explanatory text updated to Save/title rules after scope trim. Core protocol IDs remain stable rather than renumbered.',
49:'Absolute paths,3000,DB_PATH,one restart,model wiring and60/20/20 match.23 protocol headings cover57 unique evidence keys, no dangling scenario references.',
50:'Closed50-file task and exact tests tree; no reports, DB, archives, caches or node_modules inside task. ZIP CRC and extraction hashes pass.',
51:'All JSON/TOML parse; both scripts bash -n/LF; server node --check; real local app/browser/restart runs pass. Actual rewardkit/provider grade not run.',
52:'Literal provider/private-key and host-path scan passes; seed empty/synthetic. Credential remains placeholder in canonical verifier env. No task files added to public served app.',
53:'Authored playground execution/recovery/conflict task, not Ridgeline commerce or another reference renamed. Metadata matches the reduced scope.'}
note_ids={2,6,10,11,15,18,20,21,22,26,32,39,40,42,44,46,47,51}
checks=[]
for number,block,ident,description,*_ in list(workbook['Quality Checks'].values)[1:]:
 if not ident:continue
 n=int(number);checks.append({'id':ident,'verdict':'Note' if n in note_ids else 'Pass','severity':'','evidence':notes[n],'finding':'See evidence for remaining limits.' if n in note_ids else '', 'action':'Do not label this a hosted QC or Oracle pass.' if n in note_ids else '', 'run_verdict':'PARTIAL' if n in note_ids else 'CONFIRMED'})
assert len(checks)==53
manual={
'check-assets-referenced.py':'All named note/asset files resolve; template Dockerfile COPY sources exist and stage both folders.',
'check-batched-independence-wording.py':'Read all scored prompts: independent results and continuation after failures; gate all_pass exemption.',
'check-canonical-shared-files.py':'Byte comparisons pass for7 frozen files; parsed verifier env/judge headers match template.',
'check-dockerfile-references.sh':'Actual agent COPY lines are instructions/ and assets/ only.',
'check-dockerfiles.py':'Both files template-identical; npm/pip tooling versioned. Existing verifier runtime exercised; no new clean build.',
'check-fixtures.py':'COPY sources exist; seed JSON parses and contains no snippets.',
'check-instruction-content.py':'Finished multi-paragraph request exceeds40words; no draft markers.',
'check-instruction-hygiene.py':'Fresh public-ID and grader-term scanners pass; manually read reduced notes for probe leakage and overlap.',
'check-instruction-suffix.sh':'No terminal-bench deadline/cheating suffix.',
'check-no-host-paths.py':'Current task text scan found no author home paths.',
'check-no-literal-secrets.py':'Fresh literal-key scan passes; only template credential references.',
'check-no-placeholders.sh':'No unresolved task placeholders in public ask or authored task settings; canonical substitutions remain deliberate.',
'check-no-stray-files.py':'Exact closed tests tree and50 task files; archive CRC/extraction hashes pass.',
'check-no-trialforge-judge-keys.py':'Parsed all five TOMLs: only staged judge/scoring/criterion keys; no legacy tests/expected or check.py.',
'check-probe-not-in-seed.py':'Empty snippet seed and static golden; distinctive authored probe markers absent; fresh gate marker generated at test time.',
'check-required-files.py':'All staged files present, app_context nonempty; five prompt/judge pairs. No reward.toml.',
'check-rubric-prompt.py':'All five substantial browser prompts contain correctURL,context/criteria substitutions and untrusted/failure guidance; scored gates reviewed.',
'check-rubric-schema.py':'All TOMLs parse, unique positive typed rows, template header/MCP/aggregation checks pass.',
'check-runtime-contract-strings.py':'Brief integration note: absolute app/server/DB/health paths and port match script. Startup from /tmp passes.',
'check-runtime-deps-in-both-images.py':'Both template Dockerfiles globally install Express5.1.0 and better-sqlite3 12.4.1; golden server executes offline.',
'check-scoring-policy.py':'Template-identical0.6/0.2/0.2,zero-weight gates,.05floor;7 synthetic actual score.py fixtures pass; budgets nest.',
'check-solve-contract.py':'bash-n/LF passes; solve.sh writes /app, checks open DB before reset, copies static app; focused offline install succeeds.',
'check-task-name.py':'turing/colderwater-playground-devtools equals org/directory.',
'check-verifier-contract.py':'Canonical test.sh byte match, bash-n, zero/trap/liveness/gates/scored/helper flow reviewed; restart tool used once.',
'check-allow-internet.sh':'No allow_internet; public network in both environments.',
'check-compose-host-binds.sh':'No compose file.',
'check-dockerfile-platform.sh':'No FROM --platform.',
'check-gpu-types.sh':'No GPU declaration.',
'check-no-allow-internet-true.sh':'No allow_internet key.',
'check-nproc.sh':'No nproc in shipped Dockerfiles or shell scripts.',
'check-pip-pinning.sh':'Template verifier pins harbor-rewardkit==0.1.7; no trial-time installs.',
'check-pytest-version.sh':'No pytest or pytest-json-ctrf dependency in this browser task.',
'check-task-absolute-path.sh':'Runtime app/DB/notes/assets paths absolute; no required launch CWD.',
'check-task-slug.sh':'colderwater-playground-devtools has3 hyphen-separated tokens.',
'check-test-file-references.sh':'Authored fixture filenames are entered product data, not hidden required deliverables; server.js/app.db/health declared in integration.md.',
'check-trial-network-fetch.sh':'Canonical test.sh contains no remote install/download; local health probes only.',
'check-verifier-tooling-baked.sh':'Pinned RewardKit/browser/MCP/judge baked into template image; no test-time installation.'}
overrides={'check-allowlist-matches-provider.py','check-app-manifest.py','check-canary.sh','check-dockerfile-sanity.sh','check-instruction-states-offline-constraint.py','check-no-cdn-or-remote-assets.py','check-package-manifest-deps-preinstalled.py','check-reward-schema.py','check-reward-weights.py','check-rubric-segments.py'}
det=[]
for name,source,description in list(workbook['Deterministic Checks'].values)[1:]:
 if not name:continue
 if name in overrides:status='Note';text='Profile/legacy override applies: public network and staged layout; no contrary restriction introduced.'
 elif name=='check-demo-accounts-agree.py':status='N-A';text='No accounts/sign-in.'
 else:status='Pass';text=manual[name]
 det.append({'name':name,'source':source,'status':status,'output':text,'note':'Local manual equivalent and/or audit.json evidence; private portal checker executable was not run.'})
report={'scope':'Fresh reduced-scope local review; no hosted QC/Oracle/model measurement. All rows dispositioned, not all unconditionally green.','candidate':manifest,'tasks':[{'name':task.name,'layout':'staged','checks':checks}],'deterministic':det}
(out/'qc_findings.json').write_text(json.dumps(report,indent=2)+'\n')
lines=['# Colderwater: all53 QC rows','',f'Candidate SHA256: `{manifest["sha256"]}`.','', 'Local source/browser review only. Pass describes the stated local evidence; Note records remaining limits. Private portal checkers and full configured-judge Oracle were not run.','','| # | QC row | Local verdict | Evidence / potential issue |','|---|---|---|---|']
for i,row in enumerate(checks,1):lines.append(f'| {i} | {row["id"]} | {row["verdict"]} | {row["evidence"].replace("|","/")} |')
(out/'QC_53_ROW_TABLE.md').write_text('\n'.join(lines)+'\n')
groups={'S01':'instruction.md and overview.md: ready startup, own examples, separate saved user copy','S02':'overview.md filename dispatch; behaviour.md preview CSS copy/fresh JS','S03':'behaviour.md completed preview interactions and Stop','S04':'behaviour.md superseding/Stop and last-good rollback','S05':'security.md parent document/storage isolation','S07':'security.md snippet-only networking boundary','S08':'security.md supported source/unsupported execution families','S09':'behaviour.md five-second runs, literal loops/Promise callbacks and recovery','S10':'behaviour.md JS error message/line/last-good','S11':'behaviour.md complete HTML error line/last-good','S12':'behaviour.md timer errors/last-good','S13':'behaviour.md unhandled Promise errors/last-good','S14':'behaviour.md four console levels/order','S15':'behaviour.md inspect objects/arrays','S16':'behaviour.md history/Clear/duration','S17':'behaviour.md Auto-run debounce/OFF/manual Run','S19':'ui.md mono/line numbers/three syntax modes','S21':'behaviour.md New/Save/load exact records; integration.md reload','S22':'integration.md process restart preserves identities/revisions','S23':'behaviour.md stale Save refusal, dirty draft recovery','S24':'behaviour.md trim/unique/nonempty/case-sensitive titles','S34':'ui.md themes','S36':'behaviour.md scheduled callbacks share original Run budget'}
rows=tomllib.loads((task/'tests/scored/functional/judge.toml').read_text())['criterion']
mapping=['# Retained requirement coverage','','Runtime packaging/framework declarations are checked by source/runtime audit, not inferred from a UI appearance. Removed workflows are explicitly out of the request.','','| Protocol | Public requirement | Scored outcomes |','|---|---|---|']
for key,text in groups.items():mapping.append(f'| {key} | {text} | '+', '.join(r['id'] for r in rows if r['description'].startswith(key+'.'))+' |')
mapping+=['','Render: basic authored preview/log execution. Constraints: independent-context server save/read. Polish: mobile usability, labels, keyboard reachability, focus, keyboard examples/library/editor route, feedback and organisation. Visual: six unchanged degree-of-quality axes.','', 'Removed from both request and rubric: internal-file privacy classification, CSS hidden-global inspection, pane-size persistence, bracket matching/indentation shortcuts, console autoscroll, native leave warning, custom Run/Save/Clear shortcuts, separate Rename/Duplicate/Delete workflows, import/export and their validation matrix, navigation discard-warning matrix, and pending-interaction deadline nonextension. Golden extras are not mandatory.']
(out/'REQUIREMENT_MAP.md').write_text('\n'.join(mapping)+'\n')
print('53 quality rows,48 manual-equivalent deterministic dispositions written')
