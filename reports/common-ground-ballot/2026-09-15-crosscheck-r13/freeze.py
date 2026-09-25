from pathlib import Path
import difflib
import hashlib
import importlib.util
import json
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / 'projects/common-ground-ballot'
DELIVERY = ROOT / 'deliverables/common-ground-ballot/2026-09-15-crosscheck-r13'
BASE = ROOT / 'deliverables/common-ground-ballot/2026-09-14-oracle-repair-r12/common-ground-ballot.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
files = {p.relative_to(SOURCE).as_posix():p.read_bytes() for p in sorted(SOURCE.rglob('*')) if p.is_file()}
with zipfile.ZipFile(BASE) as z:
    previous = {name.removeprefix('common-ground-ballot/'):z.read(name) for name in z.namelist() if not name.endswith('/')}
assert set(files) == set(previous)
changed = [name for name,data in files.items() if data != previous[name]]
assert changed == ['tests/functional/prompt.md'], changed
judges = {dim:tomllib.loads(files[f'tests/{dim}/judge.toml'].decode()) for dim in ['render','constraints','functional','polish','visual']}
assert len(judges['functional']['criterion']) == 22
assert sum(c['weight'] for c in judges['functional']['criterion']) == 34
DELIVERY.mkdir(parents=True,exist_ok=True)
archive_path = DELIVERY / 'common-ground-ballot.zip'
assert not archive_path.exists(), 'Do not overwrite a frozen archive'
with zipfile.ZipFile(archive_path,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in files.items():
        info = zipfile.ZipInfo('common-ground-ballot/'+name,(2026,9,15,0,0,0))
        info.create_system = 3
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644)<<16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info,data)
with zipfile.ZipFile(archive_path) as z:
    assert z.testzip() is None
    assert {n.removeprefix('common-ground-ballot/'):z.read(n) for n in z.namelist()} == files
    z.extractall(OUT/'frozen')
for name in ['check-standard','check-upload']:
    spec=importlib.util.spec_from_file_location(name,ROOT/f'references/task-templates/{name}.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    result=module.validate(OUT/'frozen/common-ground-ballot') if name=='check-standard' else module.audit(archive_path)
    (OUT/(name+'.json')).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
(OUT/'source-hashes.json').write_text(json.dumps({name:sha(data) for name,data in files.items()},indent=2)+'\n',encoding='utf-8')
(OUT/'changes.diff').write_text(''.join(''.join(difflib.unified_diff(previous[name].decode().splitlines(True),files[name].decode().splitlines(True),fromfile='r12/'+name,tofile='r13/'+name)) for name in changed),encoding='utf-8')
manifest={'archive':archive_path.relative_to(ROOT).as_posix(),'sha256':sha(archive_path.read_bytes()),'baseline_sha256':sha(BASE.read_bytes()),'file_count':len(files),'changed_files':changed,'all_criteria_and_weights_unchanged':True,'golden_unchanged':True,'scored_oracle_run':False}
(OUT/'freeze-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
(DELIVERY/'SHA256SUMS.txt').write_text(manifest['sha256']+'  common-ground-ballot.zip\n',encoding='utf-8')
print(json.dumps(manifest,indent=2))
