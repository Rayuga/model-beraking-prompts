from pathlib import Path
import copy
import difflib
import hashlib
import json
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT/'projects/patchpad-editor-v2'
BASE = OUT.parent/'1.0.0-working-content-gate/patchpad-editor-v2.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
assert sha(BASE.read_bytes()) == '008124889f3191faef12cd077c4b702b670f295d299cda31d3c3778e2206c92d'
with zipfile.ZipFile(BASE) as z:
    old = {n.split('/',1)[1]: z.read(n) for n in z.namelist() if not n.endswith('/')}
files = {p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files) == 32 and files.keys() == old.keys()
changed = sorted(n for n in files if files[n] != old[n])
assert changed == ['tests/functional/judge.toml','tests/functional/prompt.md'], changed
counts = {}
edits = []
for dim in ('render','constraints','functional','polish','visual'):
    name = f'tests/{dim}/judge.toml'
    before,after = (tomllib.loads(x[name].decode()) for x in (old,files))
    restored = copy.deepcopy(after)
    counts[dim] = len(after['criterion'])
    for a,b,c in zip(before['criterion'],after['criterion'],restored['criterion'],strict=True):
        if a['description'] != b['description']:
            edits.append(dict(dimension=dim,id=a['id'],before=a['description'],after=b['description']))
            c['description'] = a['description']
    assert before == restored, 'Changed criterion/config field: '+dim
assert {(e['dimension'],e['id']) for e in edits} == {
    ('functional','selection_autoscroll_exact_offscreen_range'),
    ('functional','multi_caret_backspace_delete_sibling'),
}
assert counts == dict(render=2,constraints=2,functional=27,polish=3,visual=5)
functional = tomllib.loads(files['tests/functional/judge.toml'].decode())
assert sum(c['weight'] for c in functional['criterion']) == 20.75
prompt = files['tests/functional/prompt.md'].decode()
assert 'Prompt version: patchpad-editor-v2-functional-v1.0.0-r4' in prompt
gate_start = 'Global browser gate:'
for dim in counts:
    name = f'tests/{dim}/prompt.md'
    old_gate = old[name].decode().split(gate_start,1)[1].split('Treat the criteria',1)[0] if dim == 'functional' else old[name]
    new_gate = files[name].decode().split(gate_start,1)[1].split('Treat the criteria',1)[0] if dim == 'functional' else files[name]
    assert old_gate == new_gate
cfg = tomllib.loads(files['task.toml'].decode())
assert cfg['task']['version'] == '1.0.0'
assert cfg['environment']['network_mode'] == cfg['verifier']['environment']['network_mode'] == 'public'
for name in files:
    assert not any(part in ('node_modules','.git','__pycache__','.cache') for part in Path(name).parts)
    assert not name.endswith(('.db','.sqlite','.sqlite3','.pyc','.zip','.log'))
standard = json.loads((OUT/'standard-checks.json').read_text())
runtime = json.loads((OUT/'runtime-check.json').read_text())
broad = json.loads((OUT/'regression-results.json').read_text())['results']
bounded = json.loads((OUT/'bounded-results.json').read_text())['results']
assert standard['passed'] and len(standard['checks']) == 118
assert runtime['passed'] and runtime['valid_reward_cases'] == 27 and runtime['invalid_reward_cases_rejected'] == 40
assert len(broad) == 8 and all(r['passed'] for r in broad)
assert len(bounded) == 13 and all(r['passed'] for r in bounded)
assert all(r['persistedContentRevisionHistoryUnchanged'] and r['postReloadExactBaseline'] for r in bounded)
provenance = json.loads((OUT/'prompt-provenance.json').read_text())
for dim,item in provenance['judges'].items():
    assert item['prompt_sha256'] == sha(files[f'tests/{dim}/prompt.md'])
    assert item['judge_sha256'] == sha(files[f'tests/{dim}/judge.toml'])
archive = OUT/'patchpad-editor-v2.zip'
assert not archive.exists(), 'Do not overwrite an existing release ZIP'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        info = zipfile.ZipInfo('patchpad-editor-v2/'+name,(2026,9,12,0,0,0))
        info.create_system = 3
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert all(n.startswith('patchpad-editor-v2/') for n in z.namelist())
    assert {n.split('/',1)[1]:z.read(n) for n in z.namelist()} == files
report = dict(version='1.0.0',functional_prompt_revision='r4',file_count=32,criteria=counts,
              changed_files=changed,other_25_functional_descriptions_unchanged=True,
              all_criteria_ids_weights_and_configs_preserved=True,functional_weight_total=20.75,
              golden_source_unchanged=True,instructions_unchanged=True,gates_unchanged=True,
              runner_reward_dockerfiles_task_toml_unchanged=True,agent_network='public',verifier_network='public',
              standard_checks=118,broad_browser_pass_labels=sum(len(r['pass_labels']) for r in broad),
              targeted_diagnostic_groups=len(bounded),valid_reward_cases=27,invalid_reward_cases_rejected=40,
              archive_crc_wrapper_and_exact_source_hashes_verified=True,zip_sha256=sha(archive.read_bytes()),
              full_platform_qc_run=False,full_oracle_run=False,exact_new_docker_build=False,
              source_hashes={n:sha(data) for n,data in files.items()})
(OUT/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n')
(OUT/'verifier-changes.json').write_text(json.dumps(edits,indent=2)+'\n')
diff = ''.join(''.join(difflib.unified_diff(old[n].decode().splitlines(True),files[n].decode().splitlines(True),fromfile='before/'+n,tofile='after/'+n)) for n in changed)
(OUT/'verifier-changes.diff').write_text(diff)
print(json.dumps({k:v for k,v in report.items() if k != 'source_hashes'},indent=2))
