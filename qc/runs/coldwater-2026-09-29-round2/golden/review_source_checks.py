import hashlib,json,re,subprocess,tomllib,tempfile
from pathlib import Path

out=Path(__file__).resolve().parent
root=out.parents[3]
t=root/'.qc-cache/coldwater-2026-09-29-round2/task'
r=root/'.qc-cache/coldwater-2026-09-29-round2/rules/projects/webdev-task-template'
read=lambda p:p.read_text(encoding='utf-8')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
allfiles=[p for p in t.rglob('*') if p.is_file()]
data={'round_input_sha256':'f7258ff3b83e02bd781bc1d4ed013f8b125d0a31cf246ef3b6193a3410020fe2','manual_not_private_checkers':True}
task=tomllib.loads(read(t/'task.toml'))
data['canonical']={x:(t/x).read_bytes()==(r/x).read_bytes() for x in ['tests/test.sh','tests/scoring.toml','tests/Dockerfile','environment/Dockerfile','tests/tools/score.py','tests/tools/restart_mcp.py']}
data['canonical']['verifier.env']=task['verifier']['env']==tomllib.loads(read(r/'task.toml'))['verifier']['env']
assert all(data['canonical'].values())
data['files']=[p.relative_to(t).as_posix() for p in allfiles]
data['toml_parsed']=len([tomllib.loads(read(p)) for p in t.rglob('*.toml')])
data['json_parsed']=len([json.loads(read(p)) for p in t.rglob('*.json')])
data['syntax']=[]
for p in t.rglob('*.sh'):
 assert b'\r' not in p.read_bytes()
 cmd=['bash','-n',str(p)];c=subprocess.run(cmd,text=True,capture_output=True)
 data['syntax'].append({'command':cmd,'exit':c.returncode,'output':c.stdout+c.stderr});assert c.returncode==0
cmd=['node','--check',str(t/'solution/app/server.js')];c=subprocess.run(cmd,text=True,capture_output=True)
data['syntax'].append({'command':cmd,'exit':c.returncode,'output':c.stdout+c.stderr});assert c.returncode==0
js={p.relative_to(t).as_posix():tomllib.loads(read(p)) for p in t.glob('tests/*/*/judge.toml')}
data['criteria_counts']={p:len(x['criterion']) for p,x in js.items()}
for p,d in js.items():
 j=d['judge'];cs=d['criterion'];prompt=read((t/p).with_name(j['prompt_template']))
 assert j['mode']=='batched' and j['judge']=='claude-code'
 assert not {'model','reasoning_effort','temperature','weight'}&set(j)
 assert len(cs)==len({c['id'] for c in cs})
 assert all(c['weight']>0 and c['description'] and c['type'] in ['binary','likert'] for c in cs)
 assert all(x in prompt for x in ['{criteria}','{app_context}','http://localhost:3000'])
 assert any(s['name']=='playwright' for s in j['mcp_servers'])
 assert sum(s['name']=='verifier' for s in j['mcp_servers'])==int('/functional/' in p)
policy=tomllib.loads(read(t/'tests/scoring.toml'))
assert policy=={'gates':{'render':0.,'constraints':0.},'weights':{'functional':.6,'polish':.2,'visual':.2},'floors':{'functional':.05}}
assert all(c['type']=='binary' for p,d in js.items() if '/gates/' in p for c in d['criterion'])
data['timeouts']={'gate_judge_sum':1200,'gate_suite':1500,'scored_judge_sum':10800,'scored_suite':11100,'total_suites':12600,'verifier':13200,'functional_action_estimate':sum(map(int,re.findall(r'About (\d+) UI actions',read(t/'tests/scored/functional/prompt.md'))))}
data['scans']={name:[p.relative_to(t).as_posix() for p in allfiles if re.search(pat,read(p))] for name,pat in {'draft':r'TODO|FIXME|CHANGE[_-]?ME|<placeholder>|lorem ipsum','host':r'/Users/\w+|C:\\Users\\|Documents and Settings','secrets':r'-----BEGIN .*PRIVATE KEY|sk-(?:live|proj)-[A-Za-z0-9]{16,}'}.items()}
brief='\n'.join(read(p) for p in [t/'instruction.md',*t.glob('environment/instructions/*.md')])
data['brief_words']=len(read(t/'instruction.md').split())
data['brief_machinery']=re.findall(r'\b(?:judge|rubric|criterion|rewardkit|playwright|claude|glm)\b|/tests',brief,re.I)
markers=['QC Example Saved Copy','QC Save Alpha','QC Save Beta','QC Restart Primary','QC Restart Second','QC Concurrent Save','QC Title Source','cw-isolation-probe','theme-shared-preview','forbidden-nested-completion','cancel-A-delayed','scope-control-log']
data['pre_satisfied']={m:[p.relative_to(t).as_posix() for p in [t/'environment/assets/seed_data.json',*(t/'solution/app').rglob('*')] if p.is_file() and m in read(p)] for m in markers}
data['scorer']=[]
for name,g,s,want in [('full',(1,1),(1,1,1),1),('partial',(1,1),(.5,.5,.5),.5),('floor',(1,1),(.05,1,1),0),('gate',(0,1),(1,1,1),0),('above-floor',(1,1),(.051,1,1),.4306),('nan',(1,1),(float('nan'),1,1),None)]:
 with tempfile.TemporaryDirectory(dir=out,prefix='score-case-') as tmp:
  p=Path(tmp);(p/'gates').mkdir();(p/'scored').mkdir()
  (p/'gates/reward.json').write_text(json.dumps(dict(zip(['render','constraints'],g))))
  (p/'scored/reward.json').write_text(json.dumps(dict(zip(['functional','polish','visual'],s))))
  c=subprocess.run(['python',str(t/'tests/tools/score.py'),str(p)],text=True,capture_output=True)
  value=json.loads((p/'reward.json').read_text()) if (p/'reward.json').exists() else None
  assert (value and value['reward']==want) if want is not None else c.returncode==2
  data['scorer'].append({'case':name,'exit':c.returncode,'reward':value and value['reward'],'stderr':c.stderr.strip()})
manifest=json.loads(read(out.parent/'manifest.json'))
data['frozen_task_unchanged']={p.relative_to(t).as_posix():sha(p) for p in allfiles}==manifest['inputs']['task']
assert data['frozen_task_unchanged']
(out/'review-source-checks.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps({k:v for k,v in data.items() if k not in ['files','pre_satisfied','syntax']},indent=2))
