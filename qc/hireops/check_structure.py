"""Reproducible local source/seed probes; NOT the private48 checker suite."""
from pathlib import Path
import argparse, calendar, collections, datetime as dt, hashlib, json, re, shutil, subprocess, sys, tomllib
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
import qc_pipeline as qp
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,x): p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--task',default='projects/hireops-recruiting-operations/hireops-recruiting-operations');ap.add_argument('--output',default='qc/runs/hireops-2026-09-30-development/structure');a=ap.parse_args()
 task=ROOT/a.task;out=ROOT/a.output;out.mkdir(parents=True,exist_ok=True)
 before=qp.hashes(task);inventory=qp.inventory(ROOT/'WebDev Rubrics QC.xlsx')
 save(out/'inventory.json',inventory)
 preflight=qp.preflight(task,ROOT/'projects/webdev-task-template')
 save(out/'preflight.json',preflight)
 commands=[]
 def run(label,cmd):
  p=subprocess.run([str(x) for x in cmd],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',errors='replace')
  record={'label':label,'command':[str(x) for x in cmd],'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
  commands.append(record);return p.returncode==0
 for name in ['check_public_criterion_ids.py','check_public_grader_terms.py','check_public_network_policy.py']:
  run(name,[sys.executable,ROOT/'scripts'/name,task])
 bash=Path('C:/Users/00518507/AppData/Local/Programs/Git/bin/bash.exe')
 for rel in ['tests/test.sh','solution/solve.sh']:run('bash-n:'+rel,[bash,'-n',task/rel])
 node=ROOT/'.tools/hireops/node.exe'
 if not node.is_file():
  node=shutil.which('node') or node
 for p in sorted((task/'solution/app').rglob('*.js')):run('node-check:'+p.relative_to(task).as_posix(),[node,'--check',p])
 run('python-ast-check',[sys.executable,'-c',"import ast,sys;[ast.parse(open(p,encoding='utf-8').read(),filename=p) for p in sys.argv[1:]]",task/'tests/tools/score.py',task/'tests/tools/restart_mcp.py'])
 save(out/'commands.json',commands)
 sources={p.relative_to(task).as_posix():p.read_text(encoding='utf-8') for p in task.rglob('*') if p.is_file()}
 checks=[]
 def check(name,ok,detail):checks.append({'name':name,'passed':bool(ok),'evidence':detail})
 conf=tomllib.loads(sources['task.toml']);seed=json.loads(sources['environment/assets/seed_data.json']);goldseed=json.loads(sources['solution/app/src/seed_data.json'])
 check('seed-copy',seed==goldseed,'Public and golden seed parsed JSON compared')
 check('seed-no-credentials','password_for_all_accounts' not in seed and all('password' not in u for u in seed['users']),'Demo credential is specified in the public brief, not seed records')
 for kind in ['users','employees','requisitions','offers']:
  ids=[r['id'] for r in seed[kind]];check('unique:'+kind,len(ids)==len(set(ids)),str(len(ids))+' records')
 users={r['id']:r for r in seed['users']};reqs={r['id']:r for r in seed['requisitions']};offers={r['id']:r for r in seed['offers']};employees={r['id']:r for r in seed['employees']}
 for o in offers.values():
  check('offer-refs:'+o['id'],o['req_id'] in reqs and all(o.get(k) is None or o[k] in users for k in ['raised_by','approved_by']) and (not o.get('referred_by') or o['referred_by'] in employees),'Requisition,user,referrer foreign keys')
 # Independent integer arithmetic; does not import golden rules.js.
 c=seed['constants'];half=lambda n,d:(2*n+d)//(2*d)
 documented_constants={'equity_annualization_years':4,'band_edges_cents':{'II_floor':20000000,'III_floor':35000000},'signing_clawback_vesting':{'cliff_months':12,'cliff_bp':4000,'monthly_bp':500,'full_months':24},'equity_vesting':{'cliff_months':12,'cliff_bp':2000,'monthly_bp':400,'full_months':32},'referral_bonus_cents':1000000,'referral_at_hire_bp':5000,'referral_retention_cliff_months':6}
 check('seed-constants-public-contract',c==documented_constants,'Compare every seed constant with explicit rules sections2,3,6,7; update reviewed expectations if public contract changes')
 check('seed-reference-public-contract',seed['reference_moment']=='2026-08-01T00:00:00Z','Fixed reference from public rules1')
 figures={}
 for o in offers.values():
  intrinsic=o['equity_units']*max(0,o['equity_fair_cents']-o['equity_strike_cents'])
  annual=half(intrinsic,c['equity_annualization_years']);runrate=o['base_salary_cents']+annual;basis=runrate+half(o['signing_bonus_cents'],2)
  tier=1 if basis<c['band_edges_cents']['II_floor'] else 2 if basis<c['band_edges_cents']['III_floor'] else 3
  figures[o['id']]={'status':o['status'],'intrinsic_cents':intrinsic,'annual_cents':annual,'runrate_cents':runrate,'basis_cents':basis,'tier':tier}
 def group(rows,key):
  d=collections.defaultdict(list)
  for r in rows:d[r[key]].append(r)
  return d
 commitments=group(seed['seed_commitments'],'offer_id');grants=group(seed['seed_equity_grants'],'offer_id');payments=group(seed['seed_remittances'],'offer_id');refs=group(seed['seed_referral_accruals'],'offer_id')
 for kind,table in [('commitments',commitments),('grants',grants),('payments',payments),('referrals',refs)]:
  check('economic-foreign-keys:'+kind,all(k in offers for k in table),'All offer references exist')
 for o in offers.values():
  oid=o['id'];committed=o['status']=='COMMITTED'
  expected=-figures[oid]['runrate_cents'] if committed else 0
  actual=sum(x['movement_cents'] for x in commitments[oid])
  check('commitment:'+oid,actual==expected and len(commitments[oid])==(1 if committed else 0) and all(x['req_id']==o['req_id'] for x in commitments[oid]),{'expected':expected,'actual':actual})
  gs=grants[oid];want=committed and o['equity_units']>0
  check('grant:'+oid,len(gs)==int(want) and all((g['units'],g['fair_cents'],g['strike_cents'],g['grant_date'])==(o['equity_units'],o['equity_fair_cents'],o['equity_strike_cents'],o['start_date']) for g in gs),{'expected_rows':int(want),'actual':gs})
  ps=payments[oid];want=committed and o['signing_bonus_cents']>0
  check('signing:'+oid,len(ps)==int(want) and all(p['kind']=='SIGNING' and p['amount_cents']==o['signing_bonus_cents'] for p in ps),{'expected_rows':int(want),'actual':ps})
  rs=refs[oid];want=committed and bool(o['referred_by'])
  check('referral:'+oid,len(rs)==int(want) and all((r['referrer_id'],r['candidate'],r['referred_hire_start'])==(o['referred_by'],o['candidate'],o['referred_hire_start']) for r in rs),{'expected_rows':int(want),'actual':rs})
 headroom={r['id']:r['budget_cents']+sum(x['movement_cents'] for x in seed['seed_commitments'] if x['req_id']==r['id']) for r in reqs.values()}
 def instant(s):return dt.datetime.fromisoformat(s.replace('Z','+00:00'))
 def addmonths(s,n):
  d=instant(s);y,m=divmod(d.year*12+d.month-1+n,12);m+=1
  return d.replace(year=y,month=m,day=min(d.day,calendar.monthrange(y,m)[1]))
 referralfig=[]
 for r in seed['seed_referral_accruals']:
  cliff=addmonths(r['referred_hire_start'],c['referral_retention_cliff_months'])
  at=half(c['referral_bonus_cents']*c['referral_at_hire_bp'],10000)
  referralfig.append({'offer':r['offer_id'],'cliff':cliff.isoformat(),'at_hire_cents':at,'contingent_cents':c['referral_bonus_cents']-at,'vested_cents':c['referral_bonus_cents'] if instant(seed['reference_moment'])>=cliff else at})
 public=sources['instruction.md']+'\n'+ '\n'.join(v for k,v in sources.items() if k.startswith('environment/instructions/'))
 context=sources['tests/app_context.md']
 emails=set(re.findall(r'[A-Za-z0-9_.+-]+@hireops\.example',public))
 expected={u['email'] for u in users.values()}
 check('demo-account-public-match',emails==expected,{'public':sorted(emails),'seed':sorted(expected)})
 check('demo-account-context-match',set(re.findall(r'[A-Za-z0-9_.+-]+@hireops\.example',context))==expected,'Context email set compared to all seeded users')
 check('public-password-agreement','Hireops!2026' in public and 'Hireops!2026' in context,'Demo password appears in public request and judge context')
 check('no-compose',not any('compose' in k and k.endswith(('.yaml','.yml')) for k in sources),'No Compose files')
 check('no-gpu-request','gpu_types' not in conf.get('environment',{}),'No GPU allocation')
 check('no-allow-internet','allow_internet' not in conf.get('environment',{}),'Public network profile omits legacy flag')
 text='\n'.join(sources.values())
 for name,pattern in [('placeholders',r'\b(?:CHANGE[_-]?ME|TODO|FIXME|XXX)\b|<placeholder>|lorem ipsum'),('host-paths',r'C:\\Users|/Users/[A-Za-z]|Documents and Settings'),('private-keys',r'-----BEGIN .*PRIVATE KEY-----|sk-or-v1-[A-Za-z0-9]{20,}|\bsk-[A-Za-z0-9_-]{30,}')]:
  hits=[{'path':k,'line':v[:m.start()].count('\n')+1} for k,v in sources.items() for m in re.finditer(pattern,v,re.I)]
  check('scan:'+name,not hits,{'hits_locations_only':hits,'limitation':'Bounded pattern scan, not proof of absence'})
 docker='\n'.join(sources[k] for k in ['tests/Dockerfile','environment/Dockerfile'])
 check('no-platform-pin',not re.search(r'FROM\s+--platform',docker),'Docker FROM platform scan')
 check('no-bare-nproc',not re.search(r'\bnproc\b(?!\s+--all)',docker+sources['tests/test.sh']+sources['solution/solve.sh']),'No CPU host-count call')
 pkg=json.loads(sources['solution/app/package.json'])
 check('runtime-deps-images',all((name+'@'+str(version)) in sources['tests/Dockerfile'] and (name+'@'+str(version)) in sources['environment/Dockerfile'] for name,version in pkg.get('dependencies',{}).items()),pkg.get('dependencies',{}))
 check('no-probe-presatisfied',not any(token in sources['environment/assets/seed_data.json'] for token in [' req /?# ',' offer /?# ','hro_competing','hro_revision_lineage']),'Named authored identity strings/internal IDs absent from seed; semantic probe review still manual')
 save(out/'source-probes.json',checks)
 save(out/'seed-recomputed.json',{'constants':c,'offers':figures,'headroom_cents':headroom,'referrals':referralfig,'checks':[x for x in checks if x['name'].startswith(('commitment:','grant:','signing:','referral:','offer-refs:','unique:','economic-'))]})
 # Enumerate all48 without inventing a private-checker invocation or verdict.
 mapping={
 'check-required-files.py':'preflight.json closed tests file list, parsed task and required shared files',
 'check-canonical-shared-files.py':'preflight.json exact canonical bytes',
 'check-rubric-schema.py':'preflight.json judge headers, types, unique IDs and visual anchors',
 'check-scoring-policy.py':'preflight.json canonical policy and budget arithmetic; actual workload unmeasured',
 'check-demo-accounts-agree.py':'source-probes.json public/context/seed account and password set checks',
 'check-instruction-content.py':'preflight.json parser plus source-probes.json placeholder scan; natural wording needs review',
 'check-instruction-hygiene.py':'commands.json public ID and grader-term guards; overlap/natural-voice analysis remains manual',
 'check-no-host-paths.py':'source-probes.json bounded host-path scan',
 'check-no-literal-secrets.py':'source-probes.json redacted location-only scan; demo password and env references intentional',
 'check-no-placeholders.sh':'source-probes.json bounded placeholder scan',
 'check-runtime-deps-in-both-images.py':'source-probes.json manifest dependencies present with exact versions in both Dockerfiles',
 'check-dockerfile-platform.sh':'source-probes.json no-platform-pin',
 'check-nproc.sh':'source-probes.json no-bare-nproc',
 'check-allow-internet.sh':'source-probes.json no-allow-internet',
 'check-no-allow-internet-true.sh':'source-probes.json no-allow-internet',
 'check-task-name.py':'preflight.json logical task identity',
 'check-task-slug.sh':'task directory has three kebab-separated components',
 'check-fixtures.py':'seed-recomputed.json exact independent all-row recomputation; preflight parses JSON',
 'check-probe-not-in-seed.py':'source-probes.json finite authored ID scan; comprehensive probe semantics remain manual',
 'check-solve-contract.py':'commands.json bash syntax, preflight LF; installation/active-db safety still manual/runtime',
 'check-verifier-contract.py':'commands.json bash syntax and preflight canonical test.sh; runtime remains unmeasured',
 }
 profile={'check-canary.sh','check-dockerfile-sanity.sh','check-instruction-states-offline-constraint.py','check-allowlist-matches-provider.py','check-no-cdn-or-remote-assets.py','check-package-manifest-deps-preinstalled.py','check-reward-schema.py','check-reward-weights.py','check-rubric-segments.py','check-app-manifest.py'}
 absent={'check-compose-host-binds.sh':'No compose files','check-gpu-types.sh':'No GPU request','check-pytest-version.sh':'No pytest pins in task'}
 manual_notes={
 'check-assets-referenced.py': 'instruction.md names /assets/seed_data.json and /instructions/hireops_rules.md plus integration.md; those exact files exist; environment/Dockerfile COPY assets/ and instructions/ supplies them. Generic /assets directory mentions are not filenames.',
 'check-batched-independence-wording.py': 'All three scored prompts explicitly demand independent row judgment and continuation; Functional adds equivalent fallback setup and prohibits inheriting sibling pass flags. Gates use all_pass.',
 'check-dockerfile-references.sh': 'Read actual agent Dockerfile: only COPY instructions/ and assets/; no solution/tests COPY or ADD.',
 'check-dockerfiles.py': 'Both files match current template bytes. node:22-bookworm-slim and python:3.12-slim, npm packages versioned, harbor-rewardkit==0.1.7; verifier COPY . /tests and canonical MCP Python invocation. Actual image build/content execution remains unmeasured.',
 'check-instruction-suffix.sh': 'Public request ends with demo accounts, not a terminal-bench time-limit/anti-cheating suffix; WebDev override applies.',
 'check-no-stray-files.py': 'Preflight closed tests file set and no-runtime-residue checks plus full source_files manifest give exact inventory. App source/public assets are legitimate deliverables; not all built assets are automatically stray.',
 'check-no-trialforge-judge-keys.py': 'Five judge TOMLs use judge/scoring/criterion; no files or target_claims keys, tests/expected, or dimension check.py in enumerated source manifest.',
 'check-rubric-prompt.py': 'Every prompt has localhost3000, untrusted submission/source ban, app_context and criteria placeholders. Scored prompts repeat global browser gate and independent continuation. Constraints/Functional/Polish explicitly identify missing-tool evidence limits; Render and Visual rely on observed positive product prerequisite rather than invented success.',
 'check-runtime-contract-strings.py': 'instruction and integration specify /app/server.js, node start, port3000, DB_PATH,/api/health,/assets/seed_data.json; canonical test.sh and five prompt URLs agree. solve.sh copies app into /app; golden server entry exists. No browser measurement proves SQLite or database-free health.',
 'check-pip-pinning.sh': 'Only task pip install is harbor-rewardkit==0.1.7 in canonical tests/Dockerfile; test.sh/solve.sh contain no trial pip installation.',
 'check-task-absolute-path.sh': 'Public handoff uses /app,/app/server.js,/app/app.db,/assets/seed_data.json and /instructions paths. node /app/server.js is absolute; product routes/layout otherwise free.',
 'check-test-file-references.sh': 'Shared delivery/runtime handoffs are declared /app/server.js and /app/app.db; no criterion reads hidden app files or requires a private output filename. Browser source inspection is prohibited; internal golden JS layout is not a graded delivery demand.',
 'check-trial-network-fetch.sh': 'Canonical test.sh probes local app using Python urllib and invokes baked RewardKit; no curl-pipe-shell, raw remote fetch, git clone or dependency installation at trial time. Provider judge communication is intentional.',
 'check-verifier-tooling-baked.sh': 'Canonical verifier Dockerfile bakes RewardKit, Claude/Codex, Playwright MCP and Chromium; test.sh installs no grader tooling. This is source evidence, not successful image execution.'
 }
 rows=[]
 for r in inventory['deterministic']:
  n=r['name'];exe=shutil.which(n)
  mode='local_partial_evidence' if n in mapping else 'profile_note' if n in profile else 'not_applicable_inspected' if n in absent else 'manual_review_remaining'
  rows.append({'name':n,'workbook_procedure':r['what'],'private_executable':exe,'mode':mode,'evidence':mapping.get(n,absent.get(n,'Apply staged/public-network interpretation in deterministic-checks.md' if n in profile else 'No dedicated equivalent script result; inspect current source using the workbook procedure.')),'manual_guidance_from_authoring_inspection_not_reexecuted':manual_notes.get(n),'verdict':'Not exercised' if mode=='manual_review_remaining' else 'Not a private checker verdict'})
 save(out/'deterministic-inventory-status.json',rows)
 after=qp.hashes(task)
 result={'task':a.task,'scope':'Source/mechanical probes and independent seed math, not formal48/53 review or runtime verification','input_sha256':qp.canonical_digest(before),'source_unchanged_during_run':before==after,'commands_passed':all(c['exit_code']==0 for c in commands),'probe_failures':[c for c in checks if not c['passed']],'private_checkers_found':[r['name'] for r in rows if r['private_executable']],'deterministic_modes':dict(collections.Counter(r['mode'] for r in rows)),'source_files':before,'artifacts':{p.name:sha(p) for p in out.glob('*.json') if p.name!='summary.json'}}
 result['preflight_passed']=preflight['passed']
 save(out/'summary.json',result)
 print(json.dumps({k:result[k] for k in ['input_sha256','source_unchanged_during_run','commands_passed','probe_failures','private_checkers_found','deterministic_modes']},indent=2))
 return 0 if preflight['passed'] and result['commands_passed'] and not result['probe_failures'] and result['source_unchanged_during_run'] else 1
if __name__=='__main__':raise SystemExit(main())

