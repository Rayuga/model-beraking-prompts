"""Independent deterministic source observations, not private checker execution."""
from pathlib import Path
import ast, collections, difflib, hashlib, json, re, shutil, subprocess, tomllib

ROOT = Path(__file__).resolve().parents[4]
RUN = ROOT / 'qc/runs/coldwater-2026-10-01-extension-scope2'
SNAP = ROOT / '.qc-cache/coldwater-2026-10-01-extension-scope2'
TASK = SNAP / 'task'
TEMPLATE = SNAP / 'rules/projects/webdev-task-template'
texts = {str(p.relative_to(TASK)).replace('\\','/'): p.read_text(encoding='utf-8') for p in TASK.rglob('*') if p.is_file()}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
obs = {'scope': 'Independent source/manual evidence; not private checker suite or configured judge execution.', 'input_sha256':'ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8', 'file_count':len(texts), 'file_inventory': sorted(texts)}
obs['parsed'] = {k: 'ok' for k,v in texts.items() if (k.endswith('.toml') and tomllib.loads(v)) or (k.endswith('.json') and json.loads(v) is not None)}
task = tomllib.loads(texts['task.toml'])
obs['task'] = task
obs['template_identical'] = {name: texts[name].encode() == (TEMPLATE/name).read_bytes() for name in ['environment/Dockerfile','tests/Dockerfile','tests/test.sh','tests/.dockerignore','tests/tools/score.py','tests/tools/restart_mcp.py','tests/scoring.toml']}
obs['template_verifier_env_identical'] = task['verifier']['env'] == tomllib.loads((TEMPLATE/'task.toml').read_text())['verifier']['env']
obs['shared_sha256'] = {name:sha(TASK/name) for name in obs['template_identical']}
judges = {k:tomllib.loads(v) for k,v in texts.items() if k.endswith('/judge.toml')}
obs['judges'] = {}
all_ids=[]
for k,j in judges.items():
 cs=j['criterion']; all_ids.extend(c['id'] for c in cs)
 prompt = texts[str(Path(k).parent/'prompt.md').replace('\\','/')]
 checks = {'unique_ids':len({c['id'] for c in cs})==len(cs),'valid_criteria':all(c['type'] in ['binary','likert'] and isinstance(c['weight'],(int,float)) and c['weight']>0 and c['description'].strip() for c in cs),'prompt_has_criteria':'{criteria}' in prompt,'prompt_has_context':'{app_context}' in prompt,'prohibited_judge_keys':sorted(set(j['judge'])&{'model','reasoning_effort','temperature','weight','files','target_claims'})}
 obs['judges'][k]={'judge':j['judge'],'scoring':j['scoring'],'count':len(cs),'total_weight':sum(c['weight'] for c in cs),'types':dict(collections.Counter(c['type'] for c in cs)), 'checks': checks}
obs['globally_unique_ids'] = len(all_ids)==len(set(all_ids))
public = {k:v for k,v in texts.items() if k=='instruction.md' or k.startswith('environment/instructions/')}
obs['instruction_word_count'] = len(texts['instruction.md'].split())
patterns={
 'host_paths':r'/Users/[^\s/]+|/home/(?!agent(?:/|\b)|node(?:/|\b)|user(?:/|\b)|runner(?:/|\b))[^\s/]+|[A-Z]:[\\/]Users[\\/]|Documents and Settings',
 'draft_markers':r'\bCHANGE[_-]?ME\b|\bTODO\b|\bFIXME\b|\bXXX\b|<placeholder>|lorem ipsum',
 'secret_shapes':r'sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}',
 'public_grader_words':r'\b(?:judge|rubric|criteria|criterion|reward|playwright|glm|claude|dimension)\b|/tests\b|score\.py',
 'bare_nproc':r'\bnproc\b(?!\s+--all)',
}
obs['matches']={}
for name,pattern in patterns.items():
 selected=public if name=='public_grader_words' else ({k:v for k,v in texts.items() if k.endswith(('Dockerfile','.sh'))} if name=='bare_nproc' else texts)
 hits=[]
 for k,v in selected.items():
  for m in re.finditer(pattern,v,re.I if name in ['draft_markers','public_grader_words'] else 0):
   hits.append({'path':k,'line':v.count('\n',0,m.start())+1,'match':m.group(),'context':v[max(0,m.start()-45):m.end()+65]})
 obs['matches'][name]=hits
obs['public_id_leaks']=[{'path':k,'id':i} for k,v in public.items() for i in all_ids if re.search(r'(?<![A-Za-z0-9_])'+re.escape(i)+r'(?![A-Za-z0-9_])',v)]
obs['named_input_paths'] = sorted(set(s.rstrip('.') for s in re.findall(r'/(?:assets|instructions)(?:/[A-Za-z0-9_.-]+)*','\n'.join(public.values()))))
obs['named_inputs_exist'] = {s:(TASK/'environment'/s.lstrip('/')).exists() for s in obs['named_input_paths']}
obs['shell_syntax'] = []
for k in ['tests/test.sh','solution/solve.sh']:
 argv=['C:/Users/00518507/AppData/Local/Programs/Git/bin/bash.exe','-n',str(TASK/k)]
 p=subprocess.run(argv,capture_output=True,text=True)
 obs['shell_syntax'].append({'command':argv,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'crlf':b'\r\n' in (TASK/k).read_bytes(),'sha256':sha(TASK/k)})
obs['private_checkers_on_path']={name:shutil.which(name) for name in ['check-required-files.py','check-rubric-schema.py','check-verifier-contract.py']}
obs['pip_commands']=[{'path':k,'line':n,'text':l} for k,v in texts.items() if k.endswith(('Dockerfile','.sh')) for n,l in enumerate(v.splitlines(),1) if re.search(r'\b(?:pip3?|uvx|uv pip)\b',l)]
obs['from_copy_commands']=[{'path':k,'line':n,'text':l} for k,v in texts.items() if k.endswith('Dockerfile') for n,l in enumerate(v.splitlines(),1) if re.match(r'\s*(?:FROM|COPY|ADD)\b',l)]
obs['nonlocal_test_fetch']=[{'line':n,'text':l} for n,l in enumerate(texts['tests/test.sh'].splitlines(),1) if re.search(r'\b(?:curl|wget|git\s+clone|pip\s+install|npm\s+install)\b',l)]
obs['public_overlap_at_least_12_words']=[]
for k,v in public.items():
 words=re.findall(r"[A-Za-z0-9_]+",v.lower())
 for jk,j in judges.items():
  for c in j['criterion']:
   cw=re.findall(r"[A-Za-z0-9_]+",c['description'].lower())
   m=difflib.SequenceMatcher(None,words,cw,autojunk=False).find_longest_match()
   if m.size>=12: obs['public_overlap_at_least_12_words'].append({'path':k,'criterion':c['id'],'length':m.size,'text':' '.join(words[m.a:m.a+m.size])})
grade_text='\n'.join(v for k,v in texts.items() if k.startswith('tests/') and k.endswith(('.md','.toml')))
probe_values=sorted(set(re.findall(r'\b(?:QC|qc) [A-Za-z]+(?: [A-Z][A-Za-z]+)*',grade_text)+re.findall(r'(?<=["\x27])(?:[A-Z][A-Z0-9_]{5,}|[a-z][a-z0-9]*(?:-[a-z0-9]+){1,6})(?=["\x27])',grade_text)))
probe_values=[p.strip() for p in probe_values if p not in ['content-type','no-store','cache-control','access-control-allow-origin','claude-code','playwright-mcp']]
probe_values+=['CW gate ','qc title sibling','completed-stop-recovered','cancel-A-started','cancel-A-delayed','cancel-A-error','cancel-B-started','isolation-control','isolation-control-log','timeout-recovered','latest-good-B','latest-good-B-completed','failed-partial-dom','failed-partial-log','js-error-recovered','html-error-recovered','timer-error-recovered','promise-error-recovered','theme-shared-preview','auto-fired','auto-first','auto-final','shared-deadline-recovered','shared-deadline-recovered-log']
obs['probe_values'] = probe_values
reference={k:v for k,v in texts.items() if k.startswith(('environment/assets/','solution/app/'))}
obs['probe_seed_markup_hits']=[{'value':p,'paths':[k for k,v in reference.items() if p in v]} for p in probe_values if any(p in v for v in reference.values())]
idx=json.loads((RUN/'raw-evidence-index.json').read_text())
obs['raw_index_sha256']=sha(RUN/'raw-evidence-index.json')
obs['raw_artifacts_verified']={g:{'count':len(fs),'mismatches':[p for p,h in fs.items() if not (ROOT/p).is_file() or sha(ROOT/p)!=h]} for g,fs in idx['artifacts'].items()}
obs['raw_index_declared_gaps']=idx.get('not_measured',[])
manifest=json.loads((RUN/'manifest.json').read_text())
obs['frozen_input_mismatches']={group:[p for p,h in fs.items() if not (SNAP/group/p).is_file() or sha(SNAP/group/p)!=h] for group,fs in manifest['inputs'].items() if group in ['task','rules']}
out=RUN/'per-row-review/deterministic-observations.json'
out.write_text(json.dumps(obs,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in obs.items() if k not in ['file_inventory','task','judges','probe_values','probe_seed_markup_hits']},indent=2))
print('PROBES',json.dumps(obs['probe_values']))
print('PROBE_HITS',json.dumps(obs['probe_seed_markup_hits']))
print('JUDGES',json.dumps(obs['judges']))
