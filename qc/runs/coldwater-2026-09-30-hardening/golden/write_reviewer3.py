from pathlib import Path
import json,hashlib,tomllib,re
run=Path(__file__).resolve().parent.parent
root=run.parents[2]
task=root/'.qc-cache/coldwater-2026-09-30-hardening/task'
template=root/'.qc-cache/coldwater-2026-09-30-hardening/rules/projects/webdev-task-template'
report=json.loads((run/'reviewer-3.template.json').read_text())
report['read_sources']={'workbook':True,'skill':True,'template':True}
gold='golden/run-golden-20260930-070504/RESULTS.json'
q={
1:'instruction.md: opening personal request for a small code playground; product problems lead, integration details delegated to notes.',
2:'instruction.md and environment/instructions/behaviour.md: contractions, short product explanations and concrete frustrations; no pass/fail checklist voice.',
3:'instruction.md and all six environment/instructions notes read; no TODO/CHANGE_ME, copied sibling identity or conflicting seed path.',
4:'instruction.md final paragraph plus environment/instructions/integration.md: /app, node /app/server.js, 0.0.0.0:3000, /api/health, DB_PATH, SQLite, built/source frontend; behavior/security notes support strengthened cancellation/latest rollback/repeated saves.',
5:'instruction.md and environment/instructions/*.md: no criterion IDs, fixture markers, judges or reward language; examples Sketch/sketch describe a product title rule.',
6:'environment/instructions/behaviour.md preview and saves: cancellation includes delayed errors; restoration means most recent successful run; either editor may win next time. security.md limits literal source/native blocking; no new hidden event-loop requirement.',
7:'instruction.md plus behaviour.md: executable JS/HTML/CSS, real library, isolated execution, errors and revision conflicts require working code and state.',
8:'task.toml task.name turing/colderwater-playground-devtools, hard metadata, concise playground description/provenance; optional TS/React preferences do not become scored mandates.',
9:'task.toml environment: public,2CPU,4096MB; verifier separate/public; no literal credentials, prebuilt image or allow_internet.',
10:'task.toml verifier.env matches frozen template parsed values; tests/Dockerfile, headers and shared tools match template; no judge model overrides.',
11:'tests/scored/functional/judge.toml timeout9000; render+constraints600+600<1500; scored9000+900+900=10800<11100; suites12600<13200. Functional has58 outcomes/23 protocols with about396 actions; fresh scripted98.027s is not full LLM timing. No configured judge completion measurement.',
12:'task.toml environment has no docker_image; environment/Dockerfile remains effective.',
13:'instruction.md names /instructions and /assets/seed_data.json; six note files and scope seed exist; environment/Dockerfile COPY and chmod statements stage them.',
14:'environment/assets/seed_data.json: synthetic product, empty snippets and scope note; no orphan references, credentials or pre-satisfied probes.',
15:'environment/Dockerfile: Node22 base, Express5.1.0 and better-sqlite3 12.4.1 installed, instructions/assets copied readable, /app git initialized only .gitkeep. Template exact match.',
16:'environment/Dockerfile copies instructions/assets only; scope seed has no implementation, schema or starter solution.',
17:'solution/app/src/App.tsx, runtime.ts, server.js implement required surfaces/state. Fresh scripted functional evidence in '+gold+' covers58 outcomes; source review is plausibility for remaining polish/visual, not an Oracle score.',
18:gold+' and post-results.json:58/58 fresh functional facts, strengthened S04/S10/S23 passed; style.css/App.tsx provide required controls/themes/mobile arrangement. Full configured visual/polish judge not run; this row is reference plausibility, not measured all-dimension1.',
19:'solution/solve.sh validates closed database before reset and copies own app to /app; server.js uses __dirname and DB_PATH. Fresh nonroot network-none launch and actual restart passed in '+gold+'.',
20:'manifest.json hashes23 static solution files. server.js seeds no user data; generated IDs/revisions and timestamps are observed state, not pinned expected values. Build scripts/styles already shipped.',
21:'tests/test.sh byte-identical template: write_zero_reward before grading, EXIT cleanup ensure_reward, unprivileged sanitized launch, symlink restrictions, gate-before-score. No custom validate_suite or EVALUATION_INCOMPLETE guard. Canonical whole-process failure zero policy remains shared.',
22:'tests/Dockerfile pins tool dependencies; direct Chromium/Playwright and canonical restart launched successfully in '+gold+'. Full RewardKit/provider grading has not run on these inputs; cannot certify launch-and-grade.',
23:'environment/instructions/integration.md and tests/test.sh: same entry/port/health/DB_PATH; no current-working-directory assumption. Fresh launch from /tmp succeeded.',
24:'Parsed all5 judge files:58functional/7polish/6visual/1render/1constraints, positive criterion weights, required templates, Playwright every dimension and restart MCP only functional. scoring.toml exact frozen policy.',
25:'All5 prompt.md files require live localhost Playwright, ban implementation/source scoring; functional observes source text only as user product data, not evidence of execution.',
26:'Product map covers examples/startup S01,dispatch/freshness S02,interactions S03,cancellation S04,isolation S05/network S07/scope S08,timeouts S09/S36,errors S10-13,console S14-16,autorun S17,editor S19,library S21-24,themes S34,usability P02/visual. Exact Express/SQLite and physical built-file paths in integration.md cannot be established by browser-only probes; shared runtime-policy evidence limitation remains.',
27:'All58 functional descriptors mapped to behaviour/security/ui/overview notes. New delayed errors/latest-B and reverse-editor probes exercise stated behavior. Stop notice applies actual Stop; supersession notice optional; no mandated labels/editor package/API shape.',
28:'tests/scored/functional/judge.toml independently owns error message/line/rollback, Save server refusal/draft recovery, restart durability/later write. S04 and S23 repeated cases exercise same state property. Polish names/reach/focus/navigation separate; visual/mobile avoids regrading operability.',
29:'Render actual authored DOM+console; Constraints new UI save and clean-context server read/reload. All scored prompts restate usable surfaces and observed backing; no same-origin/CDN veto.',
30:'S04 actual four-second callback/error control; S02 live handler and callback controls; S07 matching transport delivery; S08 valid control; S17 observed autorun before off silence; S23 actual current saves before stale attempts. '+gold+' observes these controls.',
31:'S05 all4 parent operations; S08 all5 unsupported families; S09 braced/unbraced/Promise loops; S19 all3 syntax modes; S23 all3 dirty fields both cycles; S24 exact/padded/empty/case titles; P02 every requested enabled purpose. Scope bounded explicitly.',
32:'Functional uses rendered preview/log/status and actual observed request shapes. S36 nested marker replaces one-second discrimination; no hidden execution realm/private source classifier. Browser context and route recipes use available Playwright API; fresh scripted observations prove product interactions, not full LLM usability.',
33:'Shared contract says evidence keys own independent outcomes; no special incomplete prefix; app_context evidence failures agrees all prompts. S04 error counts use positive baseline; S23 describes both cycles consistently.',
34:'S03 actual waits+click/key, S17 timed edits, S34 two theme switches, polish viewport resize and keyboard route, visual both widths/themes; no first-paint-only interaction credit.',
35:'Render authored execution, Constraints independent-context source retrieval, S21 reload, S22 actual restart, S23 durable revision conflict. Fresh regression actual-restart.json proves one process restart and retained records.',
36:'Distinct cancel-A/error/latest-good-B/QC Reverse markers occur in tests only; seed and delivered examples contain no probe-specific values. Source scan recorded in reviewer3-audit.json.',
37:'app_context.md Library and state and each prompt: gate identity unknown, current database reused, scenario-owned distinct records, no total empty-library assumption, later visual no mutation.',
38:'functional prompt shared-scenario contract: continue independent outcomes, fallbacks, no inherited verdict; polish and visual independently score after ordinary failure. Fresh S23 corrected fixture was not treated as a product zero.',
39:'Render rejects a static editor/dead Run; Constraints rejects localStorage-only mock; difficult scored behavior stays outside gates. Near-zero reasoning holds for named shells, but no full weak-app configured-judge measurement exists.',
40:'58 independent weighted functional rows and six5-anchor visual rows allow gradation; canonical scoring floor>.05. No current hash-bound partial-app configured judge scores establish empirical discrimination.',
41:'Gates/functional objective outcomes binary; polish objective reachability/feedback/layout binary; visual craft uses5 Likert anchors normalized(raw-1)/4 with no invented raw0.',
42:'scoring.toml fixed .6/.2/.2 with positive32.70 functional mass; core cancellation/rollback/conflicts strengthened fairly. No controlled weaker/stronger app score pair on current configured judge, so empirical ranking remains unmeasured.',
43:'tests/tools/score.py requires gates>0 then functional>.05 before weighted reward; tests/test.sh skips scored suite on gate fail. gates zero mass in policy.',
44:'Functional total32.70; increased cancellation1.4/1.2,latest rollback.9,conflicts1.8/2.0 retain other positive outcome weights. Scripted golden satisfies additions; weight priorities match defining lifecycle/state problems. No claimed target-model score.',
45:'All dimension prompts begin with untrusted submitted UI/code/payload/error guidance and forbid following scoring directives; product source and runtime output are evidence only.',
46:'Agent Dockerfile excludes tests/solution; separate verifier COPY/tests with go-rwx; unprivileged app env omits provider secrets. No frontend criteria or evaluator sentinels shipped.',
47:'task.toml fixed shared model; pinned npm/pip/browser installation and shared tools; no task-local randomness in expected outcomes. Measured elapsed durations relative to Run rather than calendar dates; public network allowed.',
48:'All prompts/app_context describe Colderwater public playground/no accounts/shared library; no marketplace/other-product residues; roles A/B and preview lifecycle agree public notes.',
49:'task.toml/integration.md/test.sh/app_context agree port3000,entryserver.js,DB_PATH,seed,public assets,model,shares.58functional/23protocol count derived; template-controlled settings unchanged.',
50:'Frozen task manifest has50 files in permitted layout; no DB,node_modules,ZIP,QC report or legacy reward.toml; golden evidence lives outside task.',
51:'reviewer3-audit.json TOML/JSON parse and canonical comparisons; Docker bash -n both shell scripts,node --check server.js,Python compile both tools passed with cache redirected /tmp; fresh browser workflow started/ran.',
52:'Environment/seed/task text reviewed for actual keys,private paths and PII; only frozen ${OPENROUTER_API_KEY} substitution. Synthetic empty seed, no task credentials or evaluator instructions in served app.',
53:'Product-specific playground protocols/source differ from local Ridgeline commerce flow. Full assigned sibling corpus was not supplied to this review, so suite-wide clone exclusion remains unmeasured.'}
unmeasured={11,22,40,42,53}
risky_notes={26,39}
for i,row in enumerate(report['quality'],1):
 row.update(verdict='Not exercised' if i in unmeasured else ('Note' if i in risky_notes else 'Pass'),evidence=q[i],risk=i in unmeasured|risky_notes)
notes={'check-allowlist-matches-provider.py':'Public verifier has no allowlist; correct profile.', 'check-app-manifest.py':'Legacy checker is no-op for staged entryserver.js.', 'check-canary.sh':'WebDev profile override, no canary requirement.', 'check-dockerfile-sanity.sh':'WebDev override; pinned packages handled by Dockerfile review.', 'check-instruction-states-offline-constraint.py':'Public network, no offline requirement.', 'check-no-cdn-or-remote-assets.py':'Public network allows browser CDN assets; snippets separate boundary.', 'check-package-manifest-deps-preinstalled.py':'Runtime dependencies Express/better-sqlite3 exact installed; build-only Vite/TS compiled already; public profile.', 'check-reward-schema.py':'Legacy reward.toml absent correctly.', 'check-reward-weights.py':'Legacy no-op; current scoring.toml owns policy.', 'check-rubric-segments.py':'Legacy segments absent correctly.'}
de={
'check-assets-referenced.py':'instruction.md paths map to six environment/instructions files and environment/assets/seed_data.json; Docker COPY stages both.',
'check-batched-independence-wording.py':'All three scored prompts state independent scoring/continue after ordinary failure; gates all_pass exempt.',
'check-canonical-shared-files.py':'reviewer3-audit.json byte equality for shared score.py/restart_mcp.py and parsed verifier.env.',
'check-demo-accounts-agree.py':'No accounts requested or used; app_context Accounts explicitly public.',
'check-dockerfile-references.sh':'environment/Dockerfile COPY only instructions/assets; no solution/tests.',
'check-dockerfiles.py':'Both Dockerfiles byte-equal template, pinned Node/Python tags and npm/pip versions; tests COPY own tests.',
'check-fixtures.py':'All environment COPY sources exist; seed_data.json parsed empty snippets.',
'check-instruction-content.py':'instruction.md finished personal request >40words,no TODO/FIXME.',
'check-instruction-hygiene.py':'Public instruction/notes read; no IDs/fixture strings, graders or machinery vocabulary.',
'check-instruction-suffix.sh':'No terminal-bench countdown suffix; profile override.',
'check-no-host-paths.py':'Shipped task text scan found no author-machine paths.',
'check-no-literal-secrets.py':'Only frozen env variable placeholder, no actual credential literal in task or seed.',
'check-no-placeholders.sh':'No unfinished CHANGE_ME/TODO/FIXME; intentional {app_context}/{criteria} retained.',
'check-no-stray-files.py':'50-file manifest limited to task structure; no report/archive/db/cache.',
'check-no-trialforge-judge-keys.py':'Parsed5 judge configs: no files/target_claims; no tests/expected/check.py.',
'check-probe-not-in-seed.py':'reviewer3-audit.json probe marker scan absent from solution and seed.',
'check-required-files.py':'manifest.json matches staged closed list including app_context,score/restart tools and all5 judges/prompts.',
'check-rubric-prompt.py':'All5 prompt templates have placeholders,liveURL,untrusted guidance; scored browser gates present.',
'check-rubric-schema.py':'Parsed judges: modes/timeouts/isolated/prompt_template,unique ids,positive weights,binary/likert; restart only functional.',
'check-runtime-contract-strings.py':'integration.md and test.sh agree server.js,3000,DB_PATH,/api/health,NODE_PATH; no cwd assumption.',
'check-runtime-deps-in-both-images.py':'Both install Express5.1.0 and better-sqlite3 12.4.1,Node22,NODE_PATH; reference no build needed at launch.',
'check-scoring-policy.py':'Parsed scoring.toml exact template gates0/0,shares.6/.2/.2,floor.05; serial10800<11100 and12600<13200.',
'check-solve-contract.py':'Docker bash -n solution/solve.sh passed; LF/shebang; writes/app only; no pkill or NODE_ENVproduction.',
'check-task-name.py':'turing/colderwater-playground-devtools matches real task slug (snapshot task is cache name).',
'check-verifier-contract.py':'Docker bash-n and template equality; zero first/EXIT ensure,unprivileged launch,liveness,gates/scored/restartexport.',
'check-allow-internet.sh':'task.toml omits allow_internet.',
'check-compose-host-binds.sh':'No compose files shipped.',
'check-dockerfile-platform.sh':'Neither Dockerfile has FROM--platform.',
'check-gpu-types.sh':'No GPU request.',
'check-no-allow-internet-true.sh':'task.toml omits allow_internet.',
'check-nproc.sh':'No bare nproc in Dockerfiles/solve/test.',
'check-pip-pinning.sh':'tests/Dockerfile harbor-rewardkit==0.1.7; no unpinned pip/uvx installs.',
'check-pytest-version.sh':'No pytest version in task; template tool stack uses RewardKit.',
'check-task-absolute-path.sh':'Public runtime/files paths absolute/app,/instructions,/assets; sample filenames are snippet data.',
'check-task-slug.sh':'colderwater-playground-devtools is three kebab words.',
'check-test-file-references.sh':'server.js, public entry, database,seed stated in integration; fixtures user snippets authored in browser,not hidden output files.',
'check-trial-network-fetch.sh':'Canonical test.sh local HTTP probes only,no trial install/curl|sh/gitclone.',
'check-verifier-tooling-baked.sh':'tests/Dockerfile bakes RewardKit/CLIs/Playwright; test.sh no tool install.'}
for row in report['deterministic']:
 key=row.get('id',row.get('name'))
 row.update(verdict='Note' if key in notes else 'Pass',evidence='Manual documented checker application; private portal executable unavailable. '+notes.get(key,de.get(key,'')),risk=False)
 assert notes.get(key,de.get(key,'')),key
report['summary']='Independent complete53+48 source review. No demonstrated task-local source defect. Required full configured-judge timing/launch, weak-app discrimination/ranking and suite-wide distinctness evidence remain missing; exact server technology not browser-verifiable. Fresh scripted golden58/58 is product evidence only. No other reviewer outputs read.'
(run/'reviewer-3.json').write_text(json.dumps(report,indent=2)+'\n')
canon=['tests/test.sh','tests/Dockerfile','environment/Dockerfile','tests/.dockerignore','tests/scoring.toml','tests/tools/score.py','tests/tools/restart_mcp.py']
audit={'canonical':{s:(task/s).read_bytes()==(template/s).read_bytes() for s in canon},'parsed_toml':[str(p.relative_to(task)) for p in task.rglob('*.toml') if tomllib.loads(p.read_text()) is not None],'parsed_json':[str(p.relative_to(task)) for p in task.rglob('*.json') if json.loads(p.read_text()) is not None], 'task_file_count':sum(p.is_file() for p in task.rglob('*')),'env_equal':tomllib.loads((task/'task.toml').read_text())['verifier']['env']==tomllib.loads((template/'task.toml').read_text())['verifier']['env'],'syntax_command_exit':0}
needle=['cancel-A-late-dom','cancel-A-error','latest-good-B','QC Reverse Draft','QC Reverse Winner']
texts=[p for d in ['solution','environment/assets'] for p in (task/d).rglob('*') if p.is_file()]
audit['probe_hits']={n:[str(p.relative_to(task)) for p in texts if n in p.read_text(errors='ignore')] for n in needle}
(run/'golden/reviewer3-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
print(json.dumps({'quality':len(report['quality']),'deterministic':len(report['deterministic']),'risks':[r['id'] for r in report['quality'] if r['risk']]}))
