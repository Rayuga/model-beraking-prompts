"""Independent mechanical observations, not the client's private checker suite."""
import ast
import hashlib
import json
import re
import subprocess
import sys
import time
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/coldwater-2026-10-01-history-hardening-r2'
CACHE = ROOT / '.qc-cache/coldwater-2026-10-01-history-hardening-r2'
TASK = CACHE / 'task'
OUT = Path(__file__).parent
TEMPLATE = CACHE / 'rules/projects/webdev-task-template'

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def run(name, args):
    start = time.monotonic()
    p = subprocess.run(args, text=True, encoding='utf-8', errors='replace', capture_output=True)
    obj = {'command': args, 'exit_code': p.returncode, 'elapsed_seconds': round(time.monotonic()-start,3), 'stdout': p.stdout, 'stderr': p.stderr}
    (OUT / (name+'.json')).write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8')
    print(name, 'exit',p.returncode,'seconds',obj['elapsed_seconds'])
    return obj

manifest=json.loads((RUN/'manifest.json').read_text())
mismatches=[]
for category in ('task','rules'):
    for rel,want in manifest['inputs'][category].items():
        p=CACHE/category/rel
        if not p.is_file() or sha(p)!=want:
            mismatches.append(category+'/'+rel)
for rel,want in manifest['engine_inputs'].items():
    p=ROOT/rel
    if not p.is_file() or sha(p)!=want:
        mismatches.append('engine:'+rel)
facts={'input_sha256':manifest['input_sha256'],'hash_mismatches':mismatches}
facts['file_inventory']=sorted(p.relative_to(TASK).as_posix() for p in TASK.rglob('*') if p.is_file())
config=tomllib.loads((TASK/'task.toml').read_text())
facts['config']=config
facts['shared_bytes']={rel:sha(TASK/rel)==sha(TEMPLATE/rel) for rel in ['environment/Dockerfile','tests/Dockerfile','tests/test.sh','tests/scoring.toml','tests/.dockerignore','tests/tools/score.py','tests/tools/restart_mcp.py']}
facts['shared_env']=config['verifier']['env']==tomllib.loads((TEMPLATE/'task.toml').read_text())['verifier']['env']
facts['toml_parsed']=[p.relative_to(TASK).as_posix() for p in TASK.rglob('*.toml') if tomllib.loads(p.read_text())]
facts['json_parsed']=[p.relative_to(TASK).as_posix() for p in TASK.rglob('*.json') if isinstance(json.loads(p.read_text()),(dict,list))]
facts['shell_crlf']={p.relative_to(TASK).as_posix(): b'\r' in p.read_bytes() for p in TASK.rglob('*.sh')}
judges={}
for p in TASK.glob('tests/*/*/judge.toml'):
    d=tomllib.loads(p.read_text()); j=d['judge']; cs=d['criterion']; prompt=(p.parent/j['prompt_template']).read_text()
    judges[p.relative_to(TASK).as_posix()]={'count':len(cs),'ids_unique':len(set(c['id'] for c in cs))==len(cs),'types':sorted(set(c['type'] for c in cs)),'positive_weights':all(c['weight']>0 for c in cs),'weight_sum':sum(c['weight'] for c in cs),'nonempty_descriptions':all(c['description'].strip() for c in cs),'required_judge_keys':all(k in j for k in ['mode','timeout','isolated','prompt_template']),'forbidden_judge_keys':sorted(set(j)&{'model','reasoning_effort','temperature','weight','files','target_claims'}),'timeout':j['timeout'],'aggregation':d['scoring']['aggregation'],'mcp_servers':j['mcp_servers'],'criteria_placeholder':prompt.count('{criteria}'),'app_context_placeholder':prompt.count('{app_context}'),'prompt_words':len(prompt.split())}
facts['judges']=judges
public=[TASK/'instruction.md',*TASK.glob('environment/instructions/*.md')]
public_text='\n'.join(p.read_text() for p in public)
all_text={p.relative_to(TASK).as_posix():p.read_text(encoding='utf-8') for p in TASK.rglob('*') if p.is_file()}
patterns={'draft':r'\b(?:CHANGE[_-]?ME|TODO|FIXME|XXX)\b|<placeholder>|lorem ipsum','host_paths':r'/Users/[^/\s]+|/home/(?!agent|node|user|runner)[^/\s]+|[A-Za-z]:[\\/](?:Users|Documents and Settings)|Documents and Settings','provider_shapes':r'sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----','bare_nproc':r'\bnproc\b(?!\s+--all)','terminal_suffix':r'You have \d+ seconds'}
facts['scan_hits']={key:[{'path':rel,'line':txt[:m.start()].count('\n')+1} for rel,txt in all_text.items() for m in re.finditer(pattern,txt,re.I)] for key,pattern in patterns.items()}
facts['public_grader_terms']=[{'path':p.relative_to(TASK).as_posix(),'line':n,'text':line} for p in public for n,line in enumerate(p.read_text().splitlines(),1) if re.search(r'judge|rubric|criteri|dimension|reward|weight|score\.py|playwright|claude|glm|/tests|sentinel',line,re.I)]
ids=[c['id'] for p in TASK.glob('tests/*/*/judge.toml') for c in tomllib.loads(p.read_text())['criterion']]
facts['public_criterion_ids']=[x for x in ids if re.search(r'(?<![\w-])'+re.escape(x)+r'(?![\w-])',public_text)]
facts['instruction_words']=len((TASK/'instruction.md').read_text().split())
paths=sorted(set(re.findall(r'/(?:assets|instructions)(?:/[\w.-]+)*',public_text)))
facts['public_asset_paths']={s:(TASK/'environment'/s.lstrip('/')).exists() for s in paths}
facts['runtime_packages']=json.loads((TASK/'solution/app/package.json').read_text())
probes='\n'.join(p.read_text() for p in TASK.glob('tests/*/*/prompt.md'))+'\n'+'\n'.join(c['description'] for p in TASK.glob('tests/*/*/judge.toml') for c in tomllib.loads(p.read_text())['criterion'])
tokens=sorted(set(re.findall(r'\b[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+){1,}\b',probes)))
corpus={rel:s for rel,s in all_text.items() if rel.startswith('solution/app/') or rel=='environment/assets/seed_data.json'}
facts['probe_tokens_checked']=tokens
facts['probe_token_hits']={t:[rel for rel,s in corpus.items() if re.search(r'(?<![\w-])'+re.escape(t)+r'(?![\w-])',s)] for t in tokens}
facts['probe_token_hits']={k:v for k,v in facts['probe_token_hits'].items() if v}
facts['scoring']=tomllib.loads((TASK/'tests/scoring.toml').read_text())
facts['runtime_budget_arithmetic']={'gate_judges':sum(v['timeout'] for k,v in judges.items() if '/gates/' in k),'gates_suite':1500,'scored_judges':sum(v['timeout'] for k,v in judges.items() if '/scored/' in k),'scored_suite':11100,'suite_sum':12600,'verifier':config['verifier']['timeout_sec'],'meaning':'Arithmetic only; no full judge duration measurement.'}
assert not mismatches,mismatches
(OUT/'source-observations.json').write_text(json.dumps(facts,indent=2)+'\n',encoding='utf-8')
print('source observations saved; files',len(facts['file_inventory']))

if '--docker' in sys.argv:
    verifier='colderwater-verifier:postrepair-audit-20260930'
    common=['docker','run','--rm','--network','none','--mount',f'type=bind,source={TASK},target=/frozen,readonly','--mount',f'type=bind,source={OUT},target=/evidence,readonly']
    run('verifier-image-inspect',['docker','image','inspect',verifier,'qc-coldwater-history:r2'])
    run('shell-syntax',common+[verifier,'bash','-c','bash -n /frozen/tests/test.sh && bash -n /frozen/solution/solve.sh && node --check /frozen/solution/app/server.js && printf "shell and server syntax accepted\\n"'])
    run('rewardkit-loader',common+[verifier,'python3','-B','/evidence/loader.py'])
    for role,img in [('agent','qc-coldwater-history:r2'),('verifier',verifier)]:
        run(role+'-dependencies',['docker','run','--rm','--network','none',img,'node','-e',"for (const name of ['express','better-sqlite3']) {const p=require(name+'/package.json'); console.log(name,p.version,require.resolve(name));} const Database=require('better-sqlite3'); const db=new Database(':memory:'); console.log('sqlite',db.prepare('select 6*7 as answer').get().answer); db.close();"])
    run('verifier-zero-no-env',common+[verifier,'bash','-c','cp -a /frozen/tests/. /tests/; env -u REWARDKIT_JUDGE -u REWARDKIT_MODEL bash /tests/test.sh; cat /logs/verifier/reward.json'])
    run('verifier-zero-missing-entry',common+[verifier,'bash','-c','cp -a /frozen/tests/. /tests/; REWARDKIT_JUDGE=claude-code REWARDKIT_MODEL=z-ai/glm-5.3-flashx bash /tests/test.sh; cat /logs/verifier/reward.json'])
