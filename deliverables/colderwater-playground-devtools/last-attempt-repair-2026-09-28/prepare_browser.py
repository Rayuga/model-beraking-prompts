import hashlib,json,re,shutil,tomllib
from pathlib import Path
root=Path(__file__).resolve().parents[3]; out=Path(__file__).resolve().parent/'golden';out.mkdir(exist_ok=True)
drivers=out/'drivers';assert not drivers.exists()
shutil.copytree(root/'deliverables/colderwater-playground-devtools/structural-review-2026-09-27/golden/drivers',drivers)
task=root/'projects/colderwater-playground-devtools'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
prompt=(task/'tests/scored/functional/prompt.md').read_text(encoding='utf-8')
criteria=tomllib.loads((task/'tests/scored/functional/judge.toml').read_text())['criterion']
scenarios={m[1]:{'protocol':m[0],'protocol_sha256':hashlib.sha256(m[0].encode()).hexdigest()} for m in re.finditer(r'^### (S\d{2}).*?(?=^### |^## Binary|\Z)',prompt,re.M|re.S)}
manifest={'freeze_confirmed':True,'functional_sha256':sha(task/'tests/scored/functional/judge.toml'),'prompt_sha256':sha(task/'tests/scored/functional/prompt.md'),'restart_mcp_sha256':sha(task/'tests/tools/restart_mcp.py'),'scenarios':scenarios,'criteria':[dict(c,evidence_keys=re.findall(r'\bS\d{2}\.[a-z0-9_]+',c['description'])) for c in criteria],'solution_files':{p.relative_to(task/'solution').as_posix():sha(p) for p in (task/'solution').rglob('*') if p.is_file()}}
(out/'frozen_inputs.json').write_text(json.dumps(manifest,indent=2))
def edit(name,fn):
 p=drivers/name;p.write_text(fn(p.read_text(encoding='utf-8')),encoding='utf-8',newline='\n')
edit('run_workflow.cjs',lambda s:s.replace("['S18'],",'').replace("['S20'],",'').replace("['S35','initial'],",'').replace("['S35','deferred'],",'').replace("['S37'],",'').replace("['S33'],",'').replace("['S32'],",'').replace("['S25'],",'').replace("['S26'],",'').replace("['S27'],",'').replace("['S28'],",'').replace("['S29'],",'').replace("['S30'],",'').replace("['S31'],",'').replace("['S06'],",'').replace("if(workspace.has(id))","if(['S24','S36'].includes(id))await require('./current_flow.cjs').runCurrent(id,driver,ledger,callInputs,emit,state);\n        else if(workspace.has(id))"))
edit('library_flow.cjs',lambda s:s.replace('await other.enter("console.log(\'stale-overwrite\');",base.filename);','await other.title().fill(\'QC Concurrent Save Draft\');await other.enter("console.log(\'stale-overwrite\');",\'qc-concurrent-draft.js\');'))
edit('runtime_flow.cjs',lambda s:s.replace("['before-unbraced-hang','while (true);']","['before-unbraced-hang','while (true);'],['before-promise-hang',\"Promise.resolve().then(() => { console.log('promise-loop-entered'); while (true) {} });\"]"))
edit('launch_workflow.py',lambda s:s.replace('cwd=APP','cwd=Path(\'/tmp\')'))
print(out)
