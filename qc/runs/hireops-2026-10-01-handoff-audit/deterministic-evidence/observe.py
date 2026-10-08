"""Fresh, read-only deterministic-review observations; never emits checker verdicts."""
from pathlib import Path
import ast
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[4]
RUN = ROOT / 'qc/runs/hireops-2026-10-01-handoff-audit'
CACHE = ROOT / '.qc-cache/hireops-2026-10-01-handoff-audit'
TASK = CACHE / 'task'
TEMPLATE = CACHE / 'rules/projects/webdev-task-template'
OUT = Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding='utf-8')
files = sorted(p for p in TASK.rglob('*') if p.is_file())
texts = {str(p.relative_to(TASK)).replace('\\', '/'): p.read_text(encoding='utf-8') for p in files}
obs = {'method': 'Fresh manual-review supporting probes, not private checkers or configured judges', 'files': list(texts)}
manifest = json.loads((RUN / 'manifest.json').read_text())
mismatches = []
for scope in ('task', 'rules'):
    for name, expected in manifest['inputs'][scope].items():
        p = CACHE / scope / name
        actual = hashlib.sha256(p.read_bytes()).hexdigest()
        if actual != expected: mismatches.append({'scope': scope, 'file': name, 'actual': actual, 'expected': expected})
obs['frozen_hashes'] = {'checked': sum(len(manifest['inputs'][s]) for s in ('task','rules')), 'mismatches': mismatches}
obs['private_checker_on_path'] = {n: shutil.which(n) for n in ['check-required-files.py','check-rubric-prompt.py','check-verifier-contract.py','check-dockerfiles.py']}
obs['parsing'] = []
tomls = {}
for p in files:
    rel = p.relative_to(TASK).as_posix()
    if p.suffix == '.toml':
        tomls[rel] = tomllib.loads(texts[rel]); obs['parsing'].append({'file': rel, 'parser': 'tomllib', 'result': 'parsed'})
    elif p.suffix == '.json':
        json.loads(texts[rel]); obs['parsing'].append({'file': rel, 'parser': 'json', 'result': 'parsed'})
    elif p.suffix == '.py':
        ast.parse(texts[rel]); obs['parsing'].append({'file': rel, 'parser': 'ast', 'result': 'parsed'})
    elif p.suffix in ('.sh', '.js'):
        args = [shutil.which('bash'), '-n', str(p)] if p.suffix == '.sh' else [shutil.which('node'), '--check', str(p)]
        result = subprocess.run(args, capture_output=True, text=True)
        obs['parsing'].append({'file': rel, 'command': args, 'returncode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr, 'contains_CR': b'\r' in p.read_bytes()})
obs['canonical_comparisons'] = {}
for name in ['environment/Dockerfile','tests/Dockerfile','tests/test.sh','tests/scoring.toml','tests/.dockerignore','tests/tools/score.py','tests/tools/restart_mcp.py']:
    obs['canonical_comparisons'][name] = {'same_bytes': (TASK/name).read_bytes() == (TEMPLATE/name).read_bytes(), 'sha256': hashlib.sha256((TASK/name).read_bytes()).hexdigest()}
cfg = tomls['task.toml']
basecfg = tomllib.loads((TEMPLATE/'task.toml').read_text())
obs['configuration'] = cfg
obs['canonical_env_same'] = cfg['verifier']['env'] == basecfg['verifier']['env']
obs['judges'] = []
all_criteria = []
for name, data in tomls.items():
    if not name.endswith('/judge.toml'): continue
    criteria = data['criterion']; all_criteria.extend(criteria)
    prompt_path = str(Path(name).parent / data['judge']['prompt_template']).replace('\\','/')
    prompt = texts[prompt_path]
    ids = [c['id'] for c in criteria]
    obs['judges'].append({'file':name,'judge':data['judge'],'scoring':data['scoring'],'criterion_count':len(criteria),'ids_unique':len(ids)==len(set(ids)), 'type_counts': {t:sum(c['type']==t for c in criteria) for t in sorted({c['type'] for c in criteria})},'bad_criteria':[c['id'] for c in criteria if c['type'] not in ['binary','likert'] or not isinstance(c['weight'],(int,float)) or c['weight']<=0 or not c['description'].strip()], 'forbidden_judge_keys': sorted(set(data['judge']) & {'model','reasoning_effort','temperature','weight','files','target_claims'}), 'prompt_path':prompt_path,'prompt_words':len(prompt.split()),'criteria_placeholder':'{criteria}' in prompt,'app_context_placeholder':'{app_context}' in prompt,'localhost':'http://localhost:3000' in prompt})
def scan(pattern, selected=None, flags=0):
    out=[]
    for name, text in texts.items():
        if selected is not None and name not in selected: continue
        for n,line in enumerate(text.splitlines(),1):
            if re.search(pattern,line,flags): out.append({'file':name,'line':n,'text':line})
    return out
public = ['instruction.md']+[n for n in texts if n.startswith('environment/instructions/')]
obs['scans'] = {
 'placeholders': scan(r'CHANGE[_-]?ME|\bTODO\b|\bFIXME\b|\bXXX\b|<placeholder>|lorem ipsum',flags=re.I),
 'host_paths': scan(r'/Users/[^ /]+|/home/(?!agent\b|node\b|user\b|runner\b)[^ /]+|[A-Za-z]:[\\/]Users[\\/]|Documents and Settings'),
 'secrets': scan(r'-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{30,})'),
 'public_grader_terms': scan(r'\b(?:judge|rubric|criterion|criteria|dimension|reward|playwright|glm|claude)\b|score\.py|/tests',public,re.I),
 'public_criterion_ids': [{'file':n,'id':c['id']} for n in public for c in all_criteria if c['id'] in texts[n]],
 'remote_urls': scan(r'https?://'),
 'nproc': scan(r'\bnproc\b'),
 'pip_installs': scan(r'\b(?:pip3?|uv pip|uvx)\b'),
 'trial_fetch_commands':scan(r'\b(?:curl|wget|git\s+clone|npm\s+install|pip3?\s+install)\b',['tests/test.sh']),
 'shell_exec':scan(r'^\s*exec\s',['tests/test.sh']),
 'runtime_requires':scan(r'(?:require\(|\bfrom )',[n for n in texts if n.startswith('solution/app/') and n.endswith('.js')]),
 'docker_copy_add':scan(r'^\s*(?:COPY|ADD)\s',[n for n in texts if n.endswith('Dockerfile')]),
 'docker_platform':scan(r'^\s*FROM\s+--platform=',[n for n in texts if n.endswith('Dockerfile')]),
 'common_policy_keys': scan(r'\ballow_internet\b|\bgpu_types\b|\ballowed_hosts\b',['task.toml']),
}
obs['instruction_words']=len(texts['instruction.md'].split())
obs['assets_references'] = []
for name in public:
    for match in sorted(set(re.findall(r'/(?:assets|instructions)/[A-Za-z0-9_./-]+',texts[name]))):
        rel='environment'+match
        obs['assets_references'].append({'source':name,'path':match,'exists': (TASK/rel).is_file()})
email_pattern = r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
seed=json.loads(texts['environment/assets/seed_data.json'])
obs['demo_accounts']={'brief':sorted(set(re.findall(email_pattern,texts['instruction.md']))),'context':sorted(set(re.findall(email_pattern,texts['tests/app_context.md']))),'seed':sorted(u['email'] for u in seed['users']),'password_occurrences':scan(r'Hireops!2026')}
obs['seed_counts'] = {k:len(v) for k,v in seed.items() if isinstance(v,list)}
obs['seed_copies_equal'] = texts['environment/assets/seed_data.json']==texts['solution/app/src/seed_data.json']
probes=[' req /?# ', ' offer /?# ', ' chain req /?# ', ' chain offer /?# ', '90071992547409.91', '70368744177664.01', '199999.97', '349999.98', '2024-02-29T12:34:56.789Z', '2026-02-01T00:00:00.001Z']
seed_and_markup=[n for n in texts if n.startswith('environment/assets/') or n.startswith('solution/app/')]
obs['new_probe_hits'] = {probe:scan(re.escape(probe),seed_and_markup) for probe in probes}
obs['source_criterion_overlaps_18_words']=[]
for name in public:
    tokens=re.findall(r'\w+',texts[name].lower())
    ngrams={' '.join(tokens[i:i+18]) for i in range(max(0,len(tokens)-17))}
    for c in all_criteria:
        ct=re.findall(r'\w+',c['description'].lower())
        hits=[ ' '.join(ct[i:i+18]) for i in range(max(0,len(ct)-17)) if ' '.join(ct[i:i+18]) in ngrams]
        if hits:obs['source_criterion_overlaps_18_words'].append({'public_file':name,'id':c['id'],'overlaps':hits})
obs['manifest_dependencies']=json.loads(texts['solution/app/package.json'])['dependencies']
obs['compose_files']=[n for n in texts if 'docker-compose' in n]
obs['forbidden_layout_files']=[n for n in texts if Path(n).name in ['NOTES.md','SOLUTION.md','.env','APP_MANIFEST.md','reward.toml','check.py','segments.json'] or '/expected/' in n or re.search(r'\.(zip|xlsx|db|db-wal|pyc)$',n) or 'node_modules' in n]
obs['score_probes']=[]
cases=[('gates_fail',{'render':0,'constraints':1},{'functional':1,'polish':1,'visual':1}),('gates_only',{'render':1,'constraints':1},None),('all_one',{'render':1,'constraints':1},{'functional':1,'polish':1,'visual':1}),('weighted_partial',{'render':1,'constraints':1},{'functional':.5,'polish':.75,'visual':.25}),('floor_equal',{'render':1,'constraints':1},{'functional':.05,'polish':1,'visual':1}),('boolean_rejected',{'render':True,'constraints':1},None),('nan_rejected',{'render':float('nan'),'constraints':1},None)]
for label,gates,scored in cases:
    with tempfile.TemporaryDirectory(prefix='hireops-deterministic-score-') as tmp:
        folder=Path(tmp); (folder/'gates').mkdir(); (folder/'gates/reward.json').write_text(json.dumps(gates))
        if scored is not None:(folder/'scored').mkdir();(folder/'scored/reward.json').write_text(json.dumps(scored))
        args=[sys.executable,str(TASK/'tests/tools/score.py'),str(folder)]
        result=subprocess.run(args,capture_output=True,text=True)
        obs['score_probes'].append({'case':label,'input':{'gates':gates,'scored':scored},'returncode':result.returncode,'stdout':result.stdout,'stderr':result.stderr,'reward':json.loads((folder/'reward.json').read_text()) if (folder/'reward.json').exists() else None})
obs['evidence_index_present']=(RUN/'raw-evidence-index.json').exists()
result_path=OUT/'observations.json'
result_path.write_text(json.dumps(obs,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({'artifact':str(result_path),'sha256':hashlib.sha256(result_path.read_bytes()).hexdigest(),'files':len(files),'hash_mismatches':mismatches,'parser_probes':len(obs['parsing']),'score_cases':len(obs['score_probes'])},indent=2))
