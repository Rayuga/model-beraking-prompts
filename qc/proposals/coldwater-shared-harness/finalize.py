"""Record exact executed commands and verify immutable sources; proposal writes only."""
from pathlib import Path
import hashlib
import json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
bindings=json.loads((HERE/'source-bindings.json').read_text())
changed=[name for name,digest in bindings.items() if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest]
assert not changed, changed
commands=[
 {'command': "& 'C:/Users/00518507/AppData/Local/Programs/Python/Python312/python.exe' qc/proposals/coldwater-shared-harness/prepare.py",'exit_code':0,'purpose':'Generate unapplied patch and original/proposed source snapshots'},
 {'command': "docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}'",'exit_code':0,'purpose':'Inspect cached local images; sandbox access denied initially, allowed through require_escalated'},
 {'command': "New-Item -ItemType Directory -Path qc/proposals/coldwater-shared-harness/evidence -ErrorAction Stop | Out-Null; docker run --rm --network none --pull never --mount 'type=bind,source=F:/Documents/turing-workspace/model-beraking-prompts/qc/proposals/coldwater-shared-harness,target=/proposal,readonly' --mount 'type=bind,source=F:/Documents/turing-workspace/model-beraking-prompts/qc/proposals/coldwater-shared-harness/evidence,target=/evidence' --entrypoint python3 sha256:46fefc505dbcabf0d6cb4e54fea8f0880acde2f7896587750af967427598977d /proposal/probe.py",'exit_code':0,'purpose':'Run bounded offline controls; all 11 proposed cases pass; original 6 pass/5 fail'},
 {'command': "git -c safe.directory='F:/Documents/turing-workspace/model-beraking-prompts' apply --check qc/proposals/coldwater-shared-harness/shared-test-sh.patch",'exit_code':0,'purpose':'Read-only patch applicability check against canonical bytes'}
]
(HERE/'commands.json').write_text(json.dumps({'commands':commands,'source_count':len(bindings),'sources_changed_after_test':changed},indent=2)+'\n')
files={p.relative_to(HERE).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(HERE.rglob('*')) if p.is_file() and p.name!='evidence-manifest.json'}
(HERE/'evidence-manifest.json').write_text(json.dumps({'scope':'Unapplied canonical-harness proposal and offline mechanism controls','sha256':files},indent=2)+'\n')
print(json.dumps({'source_count':len(bindings),'changed_sources':changed,'artifact_count':len(files),'proposed_sha256':files['proposed-test.sh'],'patch_sha256':files['shared-test-sh.patch']}))
