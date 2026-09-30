from pathlib import Path
import hashlib,json,re,tomllib
out=Path(__file__).resolve().parent
root=out.parents[3]
task=root/'.qc-cache/coldwater-2026-09-30-hardening/task'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
text=(task/'tests/scored/functional/prompt.md').read_text(encoding='utf-8')
headers=list(re.finditer(r'^### (S\d{2})[^\n]*$',text,re.M))
criteria=[]
for row in tomllib.loads((task/'tests/scored/functional/judge.toml').read_text(encoding='utf-8'))['criterion']:
 keys=list(dict.fromkeys(re.findall(r'\bS\d{2}\.[a-z0-9_]+',row['description'])))
 assert keys
 criteria.append({**row,'evidence_keys':keys})
scenarios={}
for i,h in enumerate(headers):
 end=headers[i+1].start() if i+1<len(headers) else text.index('\n## Binary outcome descriptors',h.start())
 protocol=text[h.start():end]
 scenarios[h[1]]={'heading':h[0],'protocol':protocol,'protocol_sha256':hashlib.sha256(protocol.encode()).hexdigest(),'evidence_keys':list(dict.fromkeys(k for c in criteria for k in c['evidence_keys'] if k.startswith(h[1]+'.')))}
files={p.relative_to(task/'solution').as_posix():sha(p) for p in (task/'solution').rglob('*') if p.is_file()}
assert len(criteria)==58 and len(scenarios)==23 and len(files)==23
manifest={'freeze_confirmed':True,'round_input_sha256':'a6a5219e9c5aa5e19c2b30acb01ca3a1719938a02ea09674cd18e08987bf43a9','provider_or_platform':False,'functional_sha256':sha(task/'tests/scored/functional/judge.toml'),'prompt_sha256':sha(task/'tests/scored/functional/prompt.md'),'context_sha256':sha(task/'tests/app_context.md'),'restart_script_sha256':sha(task/'tests/test.sh'),'restart_mcp_sha256':sha(task/'tests/tools/restart_mcp.py'),'solution_files':files,'criteria':criteria,'scenarios':scenarios,'scope':'Fresh frozen hardening scripted reference behavior; not an Oracle or provider score.'}
(out/'frozen_hardening_inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'criteria':len(criteria),'protocols':len(scenarios),'solution_files':len(files)}))
