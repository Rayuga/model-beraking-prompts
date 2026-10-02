from pathlib import Path
import hashlib, json, re, tomllib, sys

root = Path.cwd()
here = Path(__file__).resolve().parent
task = root / 'projects/colderwater-playground-devtools'
sys.path.insert(0, str(root / 'scripts'))
from check_colderwater_current import check_task
from qc_pipeline import preflight

prompt = (task/'tests/scored/functional/prompt.md').read_text(encoding='utf-8')
criteria = tomllib.loads((task/'tests/scored/functional/judge.toml').read_text(encoding='utf-8'))['criterion']
scenarios = {m[1]: {'protocol': m[0]} for m in re.finditer(r'^### (S\d+)\b.*?(?=^### S|^## Binary outcome)', prompt, re.S|re.M)}
payload = {'binding_note': 'Current full-install scripted proof inputs; not configured judge evidence', 'criteria': criteria, 'scenarios': scenarios,
           'source_hashes': {f.relative_to(task).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest() for f in task.rglob('*') if f.is_file()}}
(here/'proof-inputs.json').write_text(json.dumps(payload, indent=2), encoding='utf-8')
guards = check_task(task)
checks = preflight(task, root/'projects/webdev-task-template')
(here/'source-guards.json').write_text(json.dumps(guards, indent=2), encoding='utf-8')
(here/'preflight.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
print(json.dumps({'source_guards_passed': guards['passed'], 'preflight': checks}))

driver = here/'drivers/runtime_flow.cjs'
text = driver.read_text(encoding='utf-8')
old = "assert(observed.preview_note_visible,'Completed Preview note must be visible');"
new = old + "await d.preview().getByRole('button',{name:'Paint picture',exact:true}).click();await d.completed();observed.canvas_pixel=await d.preview().locator('#saved-picture').evaluate(c=>[...c.getContext('2d').getImageData(50,30,1,1).data]);assert.deepEqual(observed.canvas_pixel,[224,36,36,255]);"
assert text.count(old) == 1
text = text.replace(old, new)
old = "preview_note_visible:hasNote?await note.isVisible():false"
new = old + ",canvas_pixel:await d.preview().locator('#saved-picture').count()?await d.preview().locator('#saved-picture').evaluate(c=>[...c.getContext('2d').getImageData(50,30,1,1).data]):null"
assert text.count(old) == 1
text = text.replace(old, new)
old = "x.preview_note===lastGood.preview_note&&x.preview_note_visible"
assert text.count(old) == 1
text = text.replace(old, old + "&&JSON.stringify(x.canvas_pixel)===JSON.stringify(lastGood.canvas_pixel)")
driver.write_text(text, encoding='utf-8', newline='\n')
