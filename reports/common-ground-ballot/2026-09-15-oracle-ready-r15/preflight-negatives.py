import importlib.util
import json
import tempfile
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
ARCHIVE=ROOT/'deliverables/common-ground-ballot/2026-09-15-oracle-ready-r15/common-ground-ballot.zip'
spec=importlib.util.spec_from_file_location('upload',ROOT/'references/task-templates/check-upload.py');checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
with zipfile.ZipFile(ARCHIVE) as z:original={i.filename:z.read(i) for i in z.infolist()}
base='common-ground-ballot/'
cases=[
 ('empty aggregate','tests/reward.toml',lambda s:s[:s.index('[[reward]]')]+'reward = []\n'),
 ('missing aggregate name','tests/reward.toml',lambda s:s.replace('name = "reward"\n','')),
 ('wrong aggregate method','tests/reward.toml',lambda s:s.replace('weighted_mean','all_pass')),
 ('partial mandatory aggregation','tests/constraints/judge.toml',lambda s:s.replace('all_pass','weighted_mean')),
 ('zero judge weight','tests/constraints/judge.toml',lambda s:s.replace('weight = 1.0','weight = 0.0',1)),
 ('duplicate gate-only render','tests/render/judge.toml',lambda s:s.replace('workspace_navigation','public_page_loads')),
 ('unversioned prompt','tests/functional/prompt.md',lambda s:'\n'.join(x for x in s.splitlines() if not x.startswith('Prompt version:'))),
 ('missing global gate','tests/visual/prompt.md',lambda s:s.replace('Global browser gate:','Removed gate:')),
 ('missing scorer', 'tests/score.py',None),
 ('missing build seed','environment/assets/artifacts/common_ground_seed.json',None),
]
results=[]
with tempfile.TemporaryDirectory() as temp:
 for name,relative,mutation in cases:
  files=dict(original);path=base+relative
  if mutation:files[path]=mutation(files[path].decode('utf-8')).encode('utf-8')
  else:files.pop(path)
  zip_path=Path(temp)/(name.replace(' ','-')+'.zip')
  with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
   for n,b in files.items():
    i=zipfile.ZipInfo(n,(2026,9,15,0,0,0));i.create_system=3;i.external_attr=(0o100755 if n.endswith('.sh') else 0o100644)<<16;i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,b)
  try:checker.audit(zip_path)
  except (AssertionError,KeyError,ValueError) as e:results.append({'name':name,'passed':True,'rejected_for':str(e)})
  else:raise AssertionError('Malformed package accepted: '+name)
(OUT/'preflight-regressions.json').write_text(json.dumps({'results':results},indent=2)+'\n',encoding='utf-8')
print('PASS',len(results),'malformed archives rejected')
