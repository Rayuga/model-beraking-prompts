from pathlib import Path
import argparse,json,re,tomllib

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--run',required=True)
args=parser.parse_args()
run=(root/args.run).resolve()
assert run.is_relative_to(root/'qc/runs')
out=run/'per-row-review'
manifest=json.loads((run/'manifest.json').read_text())
t=root/manifest['cache']/'task'
catalog=json.loads((run/'checklist.json').read_text())['deterministic']
read=lambda p:(t/p).read_text(encoding='utf-8')
conf=tomllib.loads(read('task.toml'))
sources={p.relative_to(t).as_posix():p.read_text(encoding='utf-8') for p in t.rglob('*') if p.is_file()}
public=read('instruction.md')+'\n'+'\n'.join(v for k,v in sources.items() if k.startswith('environment/instructions/'))
scripts='\n'.join(sources[p] for p in ['environment/Dockerfile','tests/Dockerfile','tests/test.sh','solution/solve.sh'])
assert 'allow_internet' not in conf['environment'] and 'gpu_types' not in conf['environment']
assert not list(t.rglob('*compose*.yaml')) and not list(t.rglob('*compose*.yml'))
assert not re.search(r'FROM\s+--platform',scripts)
assert not re.search(r'\bnproc\b(?!\s+--all)',scripts)
assert not re.search(r'\b(TODO|FIXME|CHANGE[_-]ME|XXX)\b|<placeholder>|lorem ipsum','\n'.join(sources.values()),re.I)
assert not re.search(r'-----BEGIN .*PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{20,}|sk-or-v1-[a-zA-Z0-9]+','\n'.join(sources.values()))
assert not re.search(r'/Users/\w+|C:\\Users|Documents and Settings','\n'.join(sources.values()))
assert len(read('instruction.md').split())>40 and len(Path(manifest['task']).name.split('-'))<=3
assert all(json.loads((out/name).read_text())['passed'] for name in ['fresh-preflight.json','fresh-guards.json'])
parsers=json.loads((out/'parser-results.json').read_text())
assert sum(p.get('exit_code')==0 for p in parsers)==3
notes={
'check-allowlist-matches-provider.py':'Public network is declared; no allowed_hosts allowlist. Expected NOTE-only profile pass.',
'check-app-manifest.py':'Staged task: fixed node /app/server.js contract replaces legacy APP_MANIFEST parsing.',
'check-canary.sh':'WebDev profile explicitly overrides the canary convention.',
'check-dockerfile-sanity.sh':'Profile delegates Docker pinning to check-dockerfiles.py; unpinned apt is not a defect here.',
'check-instruction-states-offline-constraint.py':'Network is public in both phases; no app-wide offline requirement.',
'check-no-cdn-or-remote-assets.py':'External browser assets are expressly permitted by the public-network profile; entered-snippet restrictions are separate.',
'check-package-manifest-deps-preinstalled.py':'express5.1.0/better-sqlite3 12.4.1 runtime deps are installed in both images. TypeScript/Vite are build-time dependencies; public setup permits installing them.',
'check-reward-schema.py':'No reward.toml; retired layout check is a no-op on this staged task.',
'check-reward-weights.py':'No reward.toml; staged scoring.toml owns the 0.6/0.2/0.2 weights.',
'check-rubric-segments.py':'No retired browser/segments.json structure; staged dimension files used.'}
na={'check-demo-accounts-agree.py':'Public brief explicitly has no sign-in or accounts; no login fixture to reconcile.',
'check-compose-host-binds.sh':'No compose files exist in task.',
'check-gpu-types.sh':'No GPU request or gpu_types values.',
'check-pytest-version.sh':'Neither pytest nor pytest-json-ctrf is used or pinned; RewardKit drives grading.'}
evidence={
'check-assets-referenced.py':'instruction.md and six notes reference /assets/seed_data.json and /instructions notes; these exist and environment/Dockerfile COPYs both directories with read permissions.',
'check-batched-independence-wording.py':'All three scored prompts direct independent outcomes and continuation; functional prompt separates shared protocols from row verdicts. Gates are all_pass and exempt.',
'check-canonical-shared-files.py':'fresh-preflight.json confirms unchanged verifier.env, tests/tools/score.py and restart_mcp.py plus canonical harness/settings.',
'check-dockerfile-references.sh':'Agent Dockerfile COPY instructions/ and assets/ only; no solution/tests COPY/ADD.',
'check-dockerfiles.py':'Both Dockerfiles match frozen template. Versioned Node/Python bases; exact npm versions and harbor-rewardkit==0.1.7. Verifier copies its own /tests. Public-network apt policy is applicable.',
'check-fixtures.py':'seed_data.json parses as empty snippet library with product scope note. Both COPY source directories exist; all shipped JSON/TOML parse in fresh preflight.',
'check-instruction-content.py':'instruction.md exceeds40 words and contains no TODO/FIXME/unfinished template markers.',
'check-instruction-hygiene.py':'fresh-preflight public-ID/grader-term scans and fresh regression guards pass. Main request and all6notes inspected; criterion IDs and authored test markers stay out of public prose.',
'check-instruction-suffix.sh':'No terminal-bench time-limit/anti-cheating suffix; WebDev override applied.',
'check-no-host-paths.py':'Read/search of shipped text found no author-specific host paths; /app,/assets,/instructions,/tests paths are declared container paths.',
'check-no-literal-secrets.py':'No private-key/provider-key patterns found. verifier.env contains ${OPENROUTER_API_KEY} template and empty ANTHROPIC_API_KEY; no literal credential printed.',
'check-no-placeholders.sh':'Fresh scan of every shipped text file found no TODO,FIXME,CHANGE_ME,XXX,<placeholder>,lorem ipsum markers.',
'check-no-stray-files.py':'50-file source inventory matches frozen manifest. No QC artifacts, caches, databases or ZIPs in task. Built frontend is an expressly required app deliverable. No new archive was prepared for this review.',
'check-no-trialforge-judge-keys.py':'Five judge files have staged schema; no files/target_claims sibling keys, tests/expected or legacy check.py dimensions.',
'check-probe-not-in-seed.py':'Empty user-snippet seed; cancellation/latest-good/reverse-save fixture strings are in tests only. Distinctive probe search and fresh guards corroborate no presatisfied reference values.',
'check-required-files.py':'Fresh preflight confirms closed tests list, all5dimensions, tools, app_context and exact shared files; solution/server and solve.sh present.',
'check-rubric-prompt.py':'All5prompts open localhost3000, reference Playwright, treat submissions as untrusted, resolve app_context/criteria. Scored prompts restate global gate; app_context supplies honest evidence-failure handling.',
'check-rubric-schema.py':'TOML parse and fresh preflight:64functional,7polish,6visual,1render,1constraints; positive weights, unique IDs, valid binary/Likert types and anchors; canonical judge headers/MCP wiring.',
'check-runtime-contract-strings.py':'integration.md declares node /app/server.js,0.0.0.0:3000,/app/app.db andDB_PATH,/api/health. test.sh,prompts and solve.sh agree; no /app working-directory guarantee is assumed.',
'check-runtime-deps-in-both-images.py':'express@5.1.0 and better-sqlite3@12.4.1 are installed globally in both images with matching NODE_PATH; source app package.json uses these exact runtime deps.',
'check-scoring-policy.py':'Canonical gates0/0,weights.6/.2/.2,floor.05. Typed gates; scripts run gates then scored and score.py after each. Timeouts600+600<1500,9000+900+900<11100,12600<13200; arithmetic is not judge workload evidence.',
'check-solve-contract.py':'Fresh bash -n passes; shebang/LF checks pass. solve.sh copies app into /app, verifies database not open before reset, no grading-dir writes/pkill/NODE_ENV production/install.',
'check-task-name.py':'task.toml name is turing/colderwater-playground-devtools matching source directory and organization.',
'check-verifier-contract.py':'Fresh bash -n and byte equality with template pass. Canonical initial zero,exit trap,liveness,unprivileged app,exported single-use restart helper,gates/scored sequence preserved.',
'check-allow-internet.sh':'environment.allow_internet is absent; public network configured.',
'check-dockerfile-platform.sh':'No FROM --platform CPU pin in either Dockerfile.',
'check-no-allow-internet-true.sh':'allow_internet key is omitted, rather than redundantly true.',
'check-nproc.sh':'No nproc call in Dockerfiles,test.sh or solve.sh.',
'check-pip-pinning.sh':'Only pip install is harbor-rewardkit==0.1.7 in tests/Dockerfile; no trial-time pip/uv installs.',
'check-task-absolute-path.sh':'Public filesystem handoffs use absolute /app,/instructions,/assets paths; node /app/server.js starts independently of cwd.',
'check-task-slug.sh':'colderwater-playground-devtools has3hyphen-separated tokens.',
'check-test-file-references.sh':'Runtime output paths /app/server.js,/app/public/index.html,/app/app.db are declared in integration.md; snippets used in tests are user-entered product data, not hidden delivery filenames.',
'check-trial-network-fetch.sh':'Canonical test.sh only probes local app using Python urllib; no raw remote curl/wget/git-clone/install pipeline. Paid judge communication is supplied by baked toolchain.',
'check-verifier-tooling-baked.sh':'RewardKit,judge CLIs,Playwright/browser and runtime dependencies are built into tests/Dockerfile; test.sh installs no pytest or grading tooling.'}
rows=[]
for c in catalog:
 n=c['name']; status='Note' if n in notes else ('N-A' if n in na else 'Pass')
 ev=notes.get(n,na.get(n,evidence.get(n)))
 assert ev,n
 rows.append({'name':n,'status':status,'output':ev,'note':'Manual application of workbook checker behavior, supported by fresh local scripts/parsers. Private portal checker executable was not available.'})
assert len(rows)==48
(out/'deterministic.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
print('48 deterministic workbook entries recorded from manual application plus fresh local preflight, guards and parsers. Not private portal execution.')
