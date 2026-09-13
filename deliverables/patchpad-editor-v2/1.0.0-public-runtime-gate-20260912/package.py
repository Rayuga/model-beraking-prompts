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
BASE = OUT.parent/'1.0.0-bounded-interactions-20260912/patchpad-editor-v2.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
assert sha(BASE.read_bytes()) == '4612c76f2dcdb15f933b498987a1a9164e2cbf93798bd79a180146060cafd3a3'
with zipfile.ZipFile(BASE) as z:
    old = {n.split('/',1)[1]:z.read(n) for n in z.namelist() if not n.endswith('/')}
files = {p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files) == 32 and files.keys() == old.keys()
dims = ('render','constraints','functional','polish','visual')
changed = sorted(n for n in files if files[n] != old[n])
assert changed == sorted(['environment/assets/instructions/overview.md','tests/constraints/judge.toml']+[f'tests/{d}/prompt.md' for d in dims]), changed
counts = {}
for dim in dims:
    name = f'tests/{dim}/judge.toml'
    before, after = (tomllib.loads(x[name].decode()) for x in (old,files))
    counts[dim] = len(after['criterion'])
    restored = copy.deepcopy(after)
    if dim == 'constraints':
        a,b = before['criterion'][0], after['criterion'][0]
        assert a['id'] == 'same_origin_application_shell' and b['id'] == b['name'] == 'local_application_entry'
        for field in ('id','name','description'):restored['criterion'][0][field] = a[field]
    assert restored == before, 'Unexpected criterion, configuration or weight change: '+dim
    prompt = files[f'tests/{dim}/prompt.md'].decode()
    previous = old[f'tests/{dim}/prompt.md'].decode()
    revision = 5 if dim in ('functional','polish') else 4
    assert f'Prompt version: patchpad-editor-v2-{dim}-v1.0.0-r{revision}' in prompt
    def block(text,heading):return text.split(heading,1)[1].split('\n\n',1)[0]
    assert block(prompt,'Working-content prerequisite:') == block(previous,'Working-content prerequisite:')
assert counts == dict(render=2,constraints=2,functional=27,polish=3,visual=5)
custom = 'Required custom-document-surface gate:'
assert files['tests/constraints/prompt.md'].decode().split(custom)[1] == old['tests/constraints/prompt.md'].decode().split(custom)[1]
policies = [files[f'tests/{dim}/prompt.md'].decode().split('Runtime network policy:',1)[1].split('\n\n',1)[0] for dim in dims]
assert len(set(policies)) == 1
for text in [files[f'tests/{dim}/prompt.md'].decode() for dim in dims]+[files['tests/constraints/judge.toml'].decode(),files['environment/assets/instructions/overview.md'].decode()]:
    assert not any(banned in text for banned in ('same-origin application requests without','required off-origin runtime assets or APIs fail','Fail for\na required public-internet','Serve runtime resources locally.'))
cfg = tomllib.loads(files['task.toml'].decode())
assert cfg['task']['version'] == '1.0.0'
assert cfg['environment']['network_mode'] == cfg['verifier']['environment']['network_mode'] == 'public'
standard = json.loads((OUT/'standard-checks.json').read_text())
runtime = json.loads((OUT/'runtime-check.json').read_text())
regressions = json.loads((OUT/'regression-results.json').read_text())['results']
bounded = json.loads((OUT/'bounded-results.json').read_text())['results']
attempt_paths = sorted((p for p in OUT.glob('network-attempt-*.json') if p.stem.removeprefix('network-attempt-').isdigit()),key=lambda p:int(p.stem.split('-')[-1]))
assert attempt_paths
network = json.loads(attempt_paths[-1].read_text())
assert network['passed'] and network['browser']['passed']
assert network['script_sha256'] == sha((OUT/'network-policy.cjs').read_bytes())
for key in ('externalStylesScriptFontAndAuxiliaryApiLoaded','entryAndReloadWork','customGoldenInteractionWorks','staticCloneFailsWorkingContent','interactiveTextareaFailsCustomSurface','fullPersistedSnapshotUnchanged'):
    assert network['browser'][key], key
assert not network['browser']['applicationWrites'] and not network['browser']['actualInternetUsed']
assert len(regressions) == 4 and all(r['passed'] for r in regressions[1:])
assert len(bounded) == 13 and all(r['passed'] for r in bounded)
assert standard['passed'] and len(standard['checks']) == 118 and standard['scoped_policy_update']['replacement_public_runtime_policy_checks'] == 5
assert runtime['passed'] and runtime['valid_reward_cases'] == 27 and runtime['invalid_reward_cases_rejected'] == 40
provenance = json.loads((OUT/'prompt-provenance.json').read_text())
for dim,item in provenance['judges'].items():
    assert item['prompt_sha256'] == sha(files[f'tests/{dim}/prompt.md'])
    assert item['judge_sha256'] == sha(files[f'tests/{dim}/judge.toml'])
archive = OUT/'patchpad-editor-v2.zip'
assert not archive.exists(), 'Do not overwrite a historical ZIP'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        assert not any(x in Path(name).parts for x in ('node_modules','.git','__pycache__','.cache'))
        assert not name.endswith(('.db','.sqlite','.pyc','.zip','.log'))
        info = zipfile.ZipInfo('patchpad-editor-v2/'+name,(2026,9,12,0,0,0))
        info.create_system = 3
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert all(n.startswith('patchpad-editor-v2/') for n in z.namelist())
    assert {n.split('/',1)[1]:z.read(n) for n in z.namelist()} == files
report = dict(version='1.0.0',file_count=32,criteria=counts,changed_files=changed,
              all_27_functional_criteria_byte_identical=True,all_weights_and_judge_configs_preserved=True,
              renamed_constraint=dict(before='same_origin_application_shell',after='local_application_entry'),
              working_content_and_custom_surface_gates_unchanged=True,identical_runtime_policy_in_all_dimensions=True,
              golden_seed_runner_reward_dockerfiles_and_task_toml_unchanged=True,
              agent_network='public',verifier_network='public',standard_checks_retained=113,public_runtime_policy_checks=5,
              preserved_browser_pass_labels=sum(len(r['pass_labels']) for r in regressions[1:]),
              bounded_diagnostic_groups=13,final_network_attempt=network['attempt'],
              initial_fixture_failure_preserved=True,network_validation_uses_second_loopback_origin=True,
              synthetic_reward_cases=27,invalid_reward_cases_rejected=40,
              archive_crc_wrapper_and_all_source_hashes_verified=True,zip_sha256=sha(archive.read_bytes()),
              full_platform_qc=False,full_oracle=False,exact_new_docker_build=False,
              source_hashes={n:sha(data) for n,data in files.items()})
(OUT/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n')
(OUT/'source-changes.diff').write_text(''.join(''.join(difflib.unified_diff(old[n].decode().splitlines(True),files[n].decode().splitlines(True),fromfile='before/'+n,tofile='after/'+n)) for n in changed))
print(json.dumps({k:v for k,v in report.items() if k != 'source_hashes'},indent=2))
