import hashlib
import json
from pathlib import Path
import subprocess
import time

root = Path.cwd()
out = root / 'qc/runs/coldwater-2026-10-01-extension-scope2/row29-mcp-probe'
task = root / '.qc-cache/coldwater-2026-10-01-extension-scope2/task'
argv = ['docker','run','--pull','never','--rm','--name','coldwater-row29-mcp',
        '--network','none','--shm-size','1g','--mount',f'type=bind,source={task},target=/task,readonly',
        '--mount',f'type=bind,source={out},target=/evidence',
        'sha256:46fefc505dbcabf0d6cb4e54fea8f0880acde2f7896587750af967427598977d',
        'python3','/evidence/probe.py']
(out / 'command.json').write_text(json.dumps({'input_sha256':'ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8',
    'argv':argv,'provider_invoked':False,'configured_judge_invoked':False},indent=2)+'\n')
start=time.monotonic()
r=subprocess.run(argv,capture_output=True,text=True,encoding='utf8',timeout=180)
(out/'stdout.log').write_text(r.stdout,encoding='utf8')
(out/'stderr.log').write_text(r.stderr,encoding='utf8')
(out/'host-result.json').write_text(json.dumps({'exit_code':r.returncode,'elapsed_seconds':time.monotonic()-start},indent=2)+'\n')
hashes={str(p.relative_to(root)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file() and p.name!='artifact-hashes.json'}
(out/'artifact-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
print(r.stdout)
print(r.stderr)
raise SystemExit(r.returncode)
