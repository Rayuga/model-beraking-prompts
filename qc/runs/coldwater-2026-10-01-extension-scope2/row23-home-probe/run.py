from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import time

root=Path(__file__).resolve().parents[4]
out=Path(__file__).resolve().parent
task=root/'.qc-cache/coldwater-2026-10-01-extension-scope2/task'
image='sha256:46fefc505dbcabf0d6cb4e54fea8f0880acde2f7896587750af967427598977d'
argv=['docker','run','--pull','never','--rm','--name','coldwater-scope2-row23-home','--network','none','--mount',f'type=bind,source={task},target=/task,readonly','--mount',f'type=bind,source={out},target=/evidence','-e','PYTHONDONTWRITEBYTECODE=1',image,'python3','-B','/evidence/container.py']
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
binding={'input_sha256':'ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8','image_id':image,'files':{str(p.relative_to(root)).replace('\\','/'):sha(p) for p in [task/'tests/test.sh',task/'environment/instructions/integration.md',task/'tests/Dockerfile',task/'solution/app/server.js',task/'solution/app/public/index.html',out/'container.py',out/'run.py']}}
(out/'source-binding.json').write_text(json.dumps(binding,indent=2)+'\n')
(out/'command.json').write_text(json.dumps({'argv':argv,'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'network':'none','published_ports':[],'provider_calls':False},indent=2)+'\n')
start=time.monotonic()
proc=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8',timeout=180)
(out/'stdout.log').write_text(proc.stdout,encoding='utf-8')
(out/'stderr.log').write_text(proc.stderr,encoding='utf-8')
host={'exit_code':proc.returncode,'seconds':time.monotonic()-start}
(out/'host-result.json').write_text(json.dumps(host,indent=2)+'\n')
hashes={str(p.relative_to(root)).replace('\\','/'):sha(p) for p in out.rglob('*') if p.is_file() and p.name!='artifact-hashes.json'}
(out/'artifact-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
print(json.dumps(host))
print(proc.stderr)
print(proc.stdout[-12000:])
