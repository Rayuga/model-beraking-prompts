from pathlib import Path
import hashlib, importlib.util, json, re, tomllib, zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/gambit-hollow-cribbage'
BASE=OUT.parent/'1.0.0-criterion-review-20260914/gambit-hollow-cribbage.zip'
WRAPPER='gambit-hollow-cribbage/'
sha=lambda data:hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(BASE) as z:
    before={n.removeprefix(WRAPPER):z.read(n) for n in z.namelist()}
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
relocated={name: name.replace('environment/club/','environment/assets/club/',1) for name in before if name.startswith('environment/club/')}
assert len(relocated)==5,relocated
expected={relocated.get(name,name):data for name,data in before.items()}
expected['environment/Dockerfile']=expected['environment/Dockerfile'].replace(b'COPY club/ /assets/club/',b'COPY assets/ /assets/')
assert files==expected, 'Changes exceed the five asset relocations and Docker COPY correction'
assert len(files)==37
instruction=files['instruction.md'].decode()
refs=re.findall(r'`(/assets/[^`]+)`',instruction)
assert len(refs)==5
for ref in refs:
    asset='environment'+ref
    assert asset in files,asset
    assert files[asset]==files['tests'+ref],ref
    assert files[asset],ref
assert 'environment/assets/club/README.md' in files
assert not any(n.startswith('environment/club/') for n in files)
spec=importlib.util.spec_from_file_location('task_standard',ROOT/'references/task-templates/check-standard.py')
standard=importlib.util.module_from_spec(spec)
spec.loader.exec_module(standard)
checks=standard.validate(TASK)
(OUT/'standard-checks.json').write_text(json.dumps(checks,indent=2)+'\n')
archive=OUT/'gambit-hollow-cribbage.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo(WRAPPER+name,(2026,9,14,0,0,0))
        info.create_system=3
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {n.split('/')[0] for n in z.namelist()}=={'gambit-hollow-cribbage'}
    assert {n.removeprefix(WRAPPER):z.read(n) for n in z.namelist()}==files
    for ref in refs: assert WRAPPER+'environment'+ref in z.namelist()
audit={'passed':True,'file_count':len(files),'relocated_assets':relocated,'resolved_instruction_assets':refs,'only_content_change':'environment/Dockerfile: COPY assets/ /assets/','solution_and_verifiers_unchanged':True,'standard_checks':len(checks['checks']),'archive_crc_passed':True,'single_task_wrapper':True,'unix_shell_permissions':'0755','zip_sha256':sha(archive.read_bytes()),'files':{n:sha(data) for n,data in sorted(files.items())},'platform_static_checks_rerun':False}
(OUT/'package-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
print(json.dumps({k:v for k,v in audit.items() if k!='files'},indent=2))
