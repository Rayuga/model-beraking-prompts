"""Check baked verifier files against the packaged source, no network needed."""
from pathlib import Path
import hashlib,json,subprocess
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2];image='brickfall-preflight-verifier:2.0.4'
code="from pathlib import Path; import hashlib,json; p=Path('/tests'); print(json.dumps({x.relative_to(p).as_posix():hashlib.sha256(x.read_bytes()).hexdigest() for x in p.rglob('*') if x.is_file()}))"
actual=json.loads(subprocess.check_output(['docker','run','--rm','--network','none',image,'python3','-c',code],text=True))
p=ROOT/'projects/brickfall-breaker-arcade/tests';expected={x.relative_to(p).as_posix():hashlib.sha256(x.read_bytes()).hexdigest() for x in p.rglob('*') if x.is_file()}
assert expected==actual,(set(expected)^set(actual))
identity=subprocess.check_output(['docker','image','inspect',image,'--format','{{.Id}}'],text=True).strip()
(OUT/'image-check.json').write_text(json.dumps(dict(image=image,image_id=identity,baked_test_files=len(actual),all_source_hashes_match=True),indent=2)+'\n')
print('PASS baked verifier files match current source:',len(actual))
