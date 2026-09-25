import difflib
import hashlib
import importlib.util
import json
import tomllib
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
TASK=ROOT/'projects/common-ground-ballot'
DELIVERY=ROOT/'deliverables/common-ground-ballot/2026-09-15-oracle-ready-r15'
sha=lambda data:hashlib.sha256(data).hexdigest()
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in sorted(TASK.rglob('*')) if p.is_file()}
with zipfile.ZipFile(OUT/'source-before.zip') as z: before={n.split('/',1)[1]:z.read(n) for n in z.namelist()}
assert all(files[n]==b for n,b in before.items() if n.startswith('solution/'))
DELIVERY.mkdir(parents=True,exist_ok=True)
archive=DELIVERY/'common-ground-ballot.zip'
assert not archive.exists(),'Preserve frozen archives'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for name,data in files.items():
  info=zipfile.ZipInfo('common-ground-ballot/'+name,(2026,9,15,0,0,0));info.create_system=3
  info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16;info.compress_type=zipfile.ZIP_DEFLATED
  z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert {n.split('/',1)[1]:z.read(n) for n in z.namelist()}==files
 z.extractall(OUT/'frozen')
for name in ['check-standard','check-upload']:
 spec=importlib.util.spec_from_file_location(name,ROOT/f'references/task-templates/{name}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 result=m.validate(OUT/'frozen/common-ground-ballot') if name=='check-standard' else m.audit(archive)
 (OUT/(name+'.json')).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
 print(name,len(result['checks']))
counts={d:len(tomllib.loads(files[f'tests/{d}/judge.toml'].decode('utf-8'))['criterion']) for d in ['render','constraints','functional','polish','visual']}
assert counts==dict(render=1,constraints=2,functional=39,polish=8,visual=6)
manifest={'archive':str(archive.relative_to(ROOT)),'sha256':sha(archive.read_bytes()),'file_count':len(files),'criterion_counts':counts,'functional_total_weight':34,'golden_unchanged':True,'clean_build_passed':False,'scored_oracle_run':False,'model_run':False,'platform_qc':False,'changed_files':[n for n in sorted(set(files)|set(before)) if files.get(n)!=before.get(n)]}
(OUT/'freeze-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
(OUT/'source-hashes.json').write_text(json.dumps({n:sha(b) for n,b in files.items()},indent=2)+'\n',encoding='utf-8')
(OUT/'changes.diff').write_text(''.join(''.join(difflib.unified_diff(before.get(n,b'').decode('utf-8').splitlines(True),files.get(n,b'').decode('utf-8').splitlines(True),fromfile='r14/'+n,tofile='r15/'+n)) for n in manifest['changed_files']),encoding='utf-8')
(DELIVERY/'SHA256SUMS.txt').write_text(manifest['sha256']+'  common-ground-ballot.zip\n',encoding='utf-8')
print(json.dumps(manifest,indent=2))
