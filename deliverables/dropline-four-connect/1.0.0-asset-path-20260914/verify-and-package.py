import hashlib
import json
import re
import subprocess
import tomllib
import zipfile
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/dropline-four-connect'
OLD = OUT.parent / '1.0.0-harder-20260913/dropline-four-connect.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
old_sha = '3fc002b83dcdd30b0348ae1c882b9f0809354a3ff954c5b3a493e5e5c569cc83'
assert sha(OLD.read_bytes()) == old_sha
with zipfile.ZipFile(OLD) as z:
    previous = {i.filename:z.read(i) for i in z.infolist()}
files = sorted(p for p in TASK.rglob('*') if p.is_file())
current = {'dropline-four-connect/'+p.relative_to(TASK).as_posix():p.read_bytes() for p in files}
assert current.keys() == previous.keys()
changed = [name for name in current if current[name] != previous[name]]
assert changed == ['dropline-four-connect/instruction.md'], changed
expected = previous[changed[0]].decode('utf-8').replace('`/instructions/analysis.md`','`/assets/instructions/analysis.md`').replace('under `/instructions`','under `/assets/instructions`')
assert current[changed[0]].decode('utf-8').replace('\r\n','\n') == expected.replace('\r\n','\n')
brief = (TASK/'instruction.md').read_text(encoding='utf-8')
references = re.findall(r'`(/assets/[^`]+)`',brief)
assert '/assets/instructions/analysis.md' in references
for reference in references:
    assert (TASK/'environment'/reference.lstrip('/')).exists(), reference
dockerfile = (TASK/'environment/Dockerfile').read_text(encoding='utf-8')
probe = (OUT/'AssetPath.Dockerfile').read_text(encoding='utf-8')
assert [line for line in probe.splitlines() if line.startswith('COPY ')] == [line for line in dockerfile.splitlines() if line.startswith('COPY ')]
config = tomllib.loads((TASK/'task.toml').read_text(encoding='utf-8'))
assert config['environment']['network_mode'] == config['verifier']['environment']['network_mode'] == 'public'
assert config['task']['version'] == '1.0.0'
image = 'dropline-asset-path-check:20260914'
with (OUT/'asset-copy-build.log').open('w',encoding='utf-8') as log:
    subprocess.run(['docker','build','--network=none','--progress=plain','-t',image,'-f',str(OUT/'AssetPath.Dockerfile'),str(TASK/'environment')],stdout=log,stderr=subprocess.STDOUT,check=True)
script = "const f=require('fs'),c=require('crypto');let paths=['/instructions/analysis.md','/assets/instructions/analysis.md'];for(let p of paths){f.accessSync(p,f.constants.R_OK);console.log(p+' '+c.createHash('sha256').update(f.readFileSync(p)).digest('hex'));}if(!f.readFileSync(paths[0]).equals(f.readFileSync(paths[1])))process.exit(1);"
result = subprocess.run(['docker','run','--rm','--network=none','--user','65534:65534',image,'node','-e',script],capture_output=True,text=True,check=True)
expected_asset = sha((TASK/'environment/assets/instructions/analysis.md').read_bytes())
assert result.stdout.count(expected_asset) == 2
(OUT/'container-path-check.txt').write_text(result.stdout,encoding='utf-8')
archive = OUT/'dropline-four-connect.zip'
assert not archive.exists(), 'Do not overwrite a release'
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as z:
    for name,data in current.items():
        assert not any(part in ('.git','node_modules','__pycache__','reports') for part in Path(name).parts)
        assert Path(name).suffix not in ('.db','.sqlite','.log','.pyc','.zip')
        info=zipfile.ZipInfo(name,date_time=(2026,9,14,0,0,0)); info.create_system=3
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        info.compress_type=zipfile.ZIP_DEFLATED; z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {i.filename.split('/')[0] for i in z.infolist()} == {'dropline-four-connect'}
    assert {i.filename:sha(z.read(i)) for i in z.infolist()} == {name:sha(data) for name,data in current.items()}
report=dict(zip=str(archive),sha256=sha(archive.read_bytes()),files=len(current),changed_files=changed,
    previous_zip_preserved=True,all_other_source_bytes_unchanged=True,public_network_both=True,
    referenced_assets_exist=True,docker_copy_mapping_test_passed=True,unprivileged_asset_read_passed=True,
    full_dependency_image_build_tested=False,platform_static_checker_run=False,oracle_run=False,
    source_hashes={name:sha(data) for name,data in current.items()})
(OUT/'package-verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='source_hashes'},indent=2))
