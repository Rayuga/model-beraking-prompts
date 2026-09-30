from pathlib import Path
import hashlib,json,re,shutil,tomllib,sys
root=Path(__file__).resolve().parents[3]
run=root/'qc/runs'/sys.argv[1]
out=run/'golden';out.mkdir(exist_ok=True)
assert not (out/'frozen_repair_inputs.json').exists(), 'Do not overwrite a prepared or completed evidence directory; use a fresh frozen run'
m=json.loads((run/'manifest.json').read_text())
task=root/m['cache']/'task'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
shutil.copytree(Path(__file__).parent/'drivers',out/'drivers',dirs_exist_ok=True)
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
assert len(criteria)==64 and len(scenarios)==23
manifest={'freeze_confirmed':True,'round_input_sha256':m['input_sha256'],'provider_or_platform':False,'functional_sha256':sha(task/'tests/scored/functional/judge.toml'),'prompt_sha256':sha(task/'tests/scored/functional/prompt.md'),'context_sha256':sha(task/'tests/app_context.md'),'restart_script_sha256':sha(task/'tests/test.sh'),'restart_mcp_sha256':sha(task/'tests/tools/restart_mcp.py'),'solution_files':files,'criteria':criteria,'scenarios':scenarios,'scope':'Frozen repaired candidate scripted reference behavior; not an Oracle or provider score.'}
(out/'frozen_repair_inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'criteria':len(criteria),'protocols':len(scenarios),'solution_files':len(files),'input':m['input_sha256']}))
