from pathlib import Path
import hashlib, json, zipfile, tomllib

out=Path(__file__).resolve().parent
task=Path.cwd()/'projects/ridgeline-print-storefront'
archive=out.parents[1]/'cross-check-2026-09-27/ridgeline-print-storefront.zip'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected='9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c'
assert sha(archive)==expected
target=out/'extracted'
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for item in z.infolist():assert (target/item.filename).resolve().is_relative_to(target.resolve())
 z.extractall(target)
extracted=target/'ridgeline-print-storefront'
solution=lambda p:{f.relative_to(p/'solution').as_posix():sha(f) for f in (p/'solution').rglob('*') if f.is_file()}
assert solution(task)==solution(extracted) and len(solution(task))==19
criteria=[]
for folder in ['gates/render','gates/constraints','scored/functional','scored/polish','scored/visual']:
 p=task/'tests'/folder/'judge.toml'
 for c in tomllib.loads(p.read_text(encoding='utf-8'))['criterion']:criteria.append({'dimension':folder,**c})
assert len(criteria)==37
assert sum(c['weight'] for c in criteria if c['dimension']=='scored/functional')==35
report={'archive_sha256':expected,'archive_crc_pass':True,'all_19_solution_hashes_match_current':True,'solution_hashes':solution(task),'rubric_hashes':{p.relative_to(task).as_posix():sha(p) for p in (task/'tests').rglob('judge.toml')},'criteria':criteria}
(out/'artifact-identity.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(out/'start.sh').write_text('#!/bin/bash\nset -euo pipefail\nbash /solution/solve.sh\ncd /app\nexec node server.js\n',encoding='utf-8',newline='\n')
print(json.dumps({'archive':expected,'solutionFiles':19,'criteria':37,'functionalWeight':35}))
