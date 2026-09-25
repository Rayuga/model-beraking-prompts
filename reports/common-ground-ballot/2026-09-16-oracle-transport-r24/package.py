from pathlib import Path
import hashlib
import json
import re
import stat
import tomllib
import zipfile

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];TASK=ROOT/'projects/common-ground-ballot'
DEST=ROOT/'deliverables/common-ground-ballot/2026-09-16-oracle-transport-r24'
previous=ROOT/'deliverables/common-ground-ballot/2026-09-16-budget-revision-r23/common-ground-ballot.zip'
with zipfile.ZipFile(previous) as archive:
 old={info.filename.split('/',1)[1]:archive.read(info) for info in archive.infolist()}
current={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert old.keys()==current.keys() and len(current)==29
changes=sorted(name for name in current if current[name]!=old[name])
assert changes==['README.md','tests/functional/judge.toml','tests/functional/prompt.md','tests/test.sh'],changes
before=tomllib.loads(old['tests/functional/judge.toml'].decode());after=tomllib.loads(current['tests/functional/judge.toml'].decode())
assert after['judge'].pop('cwd')=='/opt/common-ground-verifier'
assert before==after,'Functional criteria, configuration and weights must otherwise be identical'
pattern=r"(cat > /opt/common-ground-verifier/browser-evidence.js <<'COMMON_GROUND_HELPER_1'\n)[\s\S]*?(\nCOMMON_GROUND_HELPER_1)"
assert re.sub(pattern,r'\1<HELPER>\2',old['tests/test.sh'].decode())==re.sub(pattern,r'\1<HELPER>\2',current['tests/test.sh'].decode()),'Only the evidence helper changed in the runner'
assert json.loads((HERE/'reproduction/reproduction.json').read_text())['reproduced']
assert all(row['passed'] for row in json.loads((HERE/'helper-check-results.json').read_text()))
assert all(row['passed'] for row in json.loads((HERE/'runtime-results.json').read_text()))
for file in ('resilience/resilience-results.json','helper-integration/helper-results.json','runtime-smoke/runtime-smoke-results.json'):
 assert json.loads((HERE/file).read_text())['failed']==0,file
DEST.mkdir(parents=True,exist_ok=True);target=DEST/'common-ground-ballot.zip'
assert not target.exists(),'Do not overwrite a delivered ZIP'
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
 for name,data in sorted(current.items()):
  info=zipfile.ZipInfo('common-ground-ballot/'+name,(2026,9,16,0,0,0));info.create_system=3
  info.external_attr=(stat.S_IFREG|(0o755 if name.endswith('.sh') else 0o644))<<16
  info.compress_type=zipfile.ZIP_DEFLATED;archive.writestr(info,data)
manifest={'archive':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
          'changed_from_r23':changes,'unchanged_files':25,'file_count':29,'all_criteria_and_weights_unchanged':True,
          'golden_unchanged':True,'brief_unchanged':True,'task_config_and_timeouts_unchanged':True,'score_formula_unchanged':True,
          'runner_changes_limited_to_embedded_browser_evidence_helper':True}
(HERE/'package-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(manifest,indent=2))
