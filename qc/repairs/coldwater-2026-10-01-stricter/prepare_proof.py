from pathlib import Path
import json,re,tomllib,hashlib
here=Path(__file__).resolve().parent
task=here.parents[2]/'projects/colderwater-playground-devtools'
p=(task/'tests/scored/functional/prompt.md').read_text()
scenarios={}
for m in re.finditer(r'^### (S\d+)\b.*?(?=^### S|^## Binary outcome)',p,re.S|re.M):scenarios[m[1]]={'protocol':m[0]}
criteria=tomllib.loads((task/'tests/scored/functional/judge.toml').read_text())['criterion']
(here/'proof-inputs.json').write_text(json.dumps({'freeze_confirmed':True,'binding_note':'Fixtures frozen for scripted proof; not QC clearance','criteria':criteria,'scenarios':scenarios,'source_hashes':{str(f.relative_to(task)):hashlib.sha256(f.read_bytes()).hexdigest() for f in task.rglob('*') if f.is_file() and 'node_modules' not in f.parts}},indent=2))
d=here/'drivers'
f=d/'runtime_flow.cjs';s=f.read_text();s=s.replace("observed.preview_note=await note.inputValue();", "await note.fill('user-edited-preview-741');await d.completed();observed.preview_note=await note.inputValue();").replace("observed.preview_note,'changed'", "observed.preview_note,'user-edited-preview-741'")
f.write_text(s)
f=d/'fairness_flow.cjs';s=f.read_text().replace("name:'Try later action',exact:true","name:/^Try later action/" )
s=s.replace("JSON.stringify(before.counts)===JSON.stringify(after.counts)","JSON.stringify(before.counts)===JSON.stringify(after.counts)&&await d.body()===retainedPicture")
f.write_text(s)
f=d/'workspace_flow.cjs';s=f.read_text().replace(", ['colour.css', 'body { color: red; margin: 2px; }']",'')
a=s.index("    const brackets = await attempt(");b=s.index("\n  }\n",a);s=s[:a]+s[b:];f.write_text(s)
