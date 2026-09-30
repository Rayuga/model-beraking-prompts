import ast, hashlib, json, re, subprocess, tempfile, tomllib, zipfile
from pathlib import Path

ROOT=Path('.qc-cache/coldwater-2026-09-29-round1/task')
OUT=Path('qc/runs/coldwater-2026-09-29-round1')
template=Path('.qc-cache/coldwater-2026-09-29-round1/rules/projects/webdev-task-template')
result={}
task=tomllib.loads((ROOT/'task.toml').read_text())
policy=tomllib.loads((ROOT/'tests/scoring.toml').read_text())
judges={p.relative_to(ROOT).as_posix():tomllib.loads(p.read_text()) for p in ROOT.glob('tests/*/*/judge.toml')}
assert task['verifier']['env']==tomllib.loads((template/'task.toml').read_text())['verifier']['env']
for p in ['tests/tools/score.py','tests/tools/restart_mcp.py','tests/Dockerfile','environment/Dockerfile','tests/test.sh','tests/scoring.toml']:
 assert (ROOT/p).read_bytes()==(template/p).read_bytes(),p
result['canonical']='Exact bytes match for verifier env value mapping, both tools, both Dockerfiles, test.sh and scoring.toml.'
for p,d in judges.items():
 j=d['judge']; cs=d['criterion']; prompt=(ROOT/p).with_name(j['prompt_template']).read_text()
 assert {'model','reasoning_effort','temperature','weight'}.isdisjoint(j)
 assert j['mode']=='batched' and j['judge']=='claude-code'
 assert len({c['id'] for c in cs})==len(cs)
 assert all(c['weight']>0 and c['description'] and c['type'] in ['binary','likert'] for c in cs)
 assert '{criteria}' in prompt and '{app_context}' in prompt and 'http://localhost:3000' in prompt
 assert any(s['name']=='playwright' for s in j['mcp_servers'])
 assert sum(s['name']=='verifier' for s in j['mcp_servers'])==int('/functional/' in p)
result['criteria_counts']={p:len(d['criterion']) for p,d in judges.items()}
assert policy['gates']=={'render':0.0,'constraints':0.0}
assert policy['weights']=={'functional':.6,'polish':.2,'visual':.2}
assert policy['floors']=={'functional':.05}
assert all(c['type']=='binary' for p,d in judges.items() if '/gates/' in p for c in d['criterion'])
result['arithmetic']='Sequential gates 600+600=1200<1500; scored 9000+900+900=10800<11100; suites 1500+11100=12600<13200. 366 estimated functional actions; no provider duration measurement.'
result['parsing']={'toml':len([tomllib.loads(p.read_text()) for p in ROOT.rglob('*.toml')]),'json':len([json.loads(p.read_text()) for p in ROOT.rglob('*.json')])}
for p in ROOT.rglob('*.sh'):
 assert b'\r' not in p.read_bytes()
 r=subprocess.run(['bash','-n',str(p)],capture_output=True,text=True); assert r.returncode==0,r.stderr
assert subprocess.run(['node','--check',str(ROOT/'solution/app/server.js')],capture_output=True).returncode==0
result['syntax']='bash -n both shell scripts and node --check server.js exit 0; shell files LF.'
textfiles=[p for p in ROOT.rglob('*') if p.is_file()]
patterns={'host_paths':r'/Users/\w+|C:\\Users\\|Documents and Settings','draft_markers':r'TODO|FIXME|CHANGE[_-]?ME|<placeholder>|lorem ipsum','secret_shapes':r'-----BEGIN .*PRIVATE KEY|sk-(?:live|proj)-[A-Za-z0-9]{16,}'}
result['scans']={name:[str(p.relative_to(ROOT)) for p in textfiles if re.search(pat,p.read_text(errors='ignore'))] for name,pat in patterns.items()}
brief='\n'.join(p.read_text() for p in [ROOT/'instruction.md',*ROOT.glob('environment/instructions/*.md')])
result['brief_words']=len((ROOT/'instruction.md').read_text().split())
result['brief_machinery']=re.findall(r'\b(?:judge|rubric|criterion|rewardkit|playwright|claude|glm)\b|/tests',brief,re.I)
probes=['QC Example Saved Copy','QC Save Alpha','QC Save Beta','QC Restart Primary','QC Restart Second','QC Concurrent Save','QC Title Source','cw-isolation-probe','theme-shared-preview','forbidden-nested-completion','auto-queued','scope-control-log']
result['pre_satisfied']={v:[str(p.relative_to(ROOT)) for p in [ROOT/'environment/assets/seed_data.json',*ROOT.glob('solution/app/**/*')] if p.is_file() and v in p.read_text(errors='ignore')] for v in probes}
result['scorer_cases']=[]
for name,g,s,want in [('golden',(1,1),(1,1,1),1),('partial',(1,1),(.5,.5,.5),.5),('floor-edge',(1,1),(.05,1,1),0),('gate-fail',(0,1),(1,1,1),0),('above-floor',(1,1),(.051,1,1),.4306),('invalid-nan',(1,1),(float('nan'),1,1),None)]:
 with tempfile.TemporaryDirectory(prefix='coldwater-reviewer3-') as tmp:
  d=Path(tmp); (d/'gates').mkdir(); (d/'scored').mkdir()
  (d/'gates/reward.json').write_text(json.dumps(dict(zip(['render','constraints'],g))))
  (d/'scored/reward.json').write_text(json.dumps(dict(zip(['functional','polish','visual'],s))))
  r=subprocess.run(['python',str(ROOT/'tests/tools/score.py'),str(d)],capture_output=True,text=True)
  v=json.loads((d/'reward.json').read_text()) if (d/'reward.json').exists() else None
  assert (v and v['reward']==want) if want is not None else r.returncode==2
  result['scorer_cases'].append({'name':name,'exit':r.returncode,'reward':v and v['reward'],'stderr':r.stderr.strip()})
z=zipfile.ZipFile('deliverables/colderwater-playground-devtools/last-attempt-repair-2026-09-28/review-candidate/colderwater-playground-devtools.zip')
files={str(p.relative_to(ROOT)).replace('\\','/'):p.read_bytes() for p in textfiles}
arch={n.split('/',1)[1]:z.read(n) for n in z.namelist() if not n.endswith('/')}
assert files==arch
result['archive']={'files':len(files),'byte_identical':True,'root':z.namelist()[0].split('/')[0]}
gold=json.loads(Path('deliverables/colderwater-playground-devtools/last-attempt-repair-2026-09-28/golden/run-golden-20260928-124124/RESULTS.json').read_text())
assert all(hashlib.sha256((ROOT/'solution/app'/k).read_bytes()).hexdigest()==v for k,v in gold['actual_app_files'].items())
assert hashlib.sha256((ROOT/'tests/scored/functional/judge.toml').read_bytes()).hexdigest()==gold['functional_sha256']
assert hashlib.sha256((ROOT/'tests/scored/functional/prompt.md').read_bytes()).hexdigest()==gold['prompt_sha256']
result['golden']={'app_files_matching':len(gold['actual_app_files']),'functional_and_prompt_hashes_match':True,'fresh_facts':len(gold['fresh_fact_keys']),'failed_facts':gold['failed_fact_keys'],'missing_facts':gold['missing_fact_keys'],'paid_provider':gold['paid_provider'],'driver':gold['browser_driver'],'oracle_score_claimed':gold['oracle_score_claimed']}
(OUT/'reviewer-3-mechanical.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
