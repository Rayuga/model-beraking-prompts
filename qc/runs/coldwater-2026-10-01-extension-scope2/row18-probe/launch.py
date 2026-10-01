import json,subprocess,time
from pathlib import Path
root=Path.cwd();out=root/'qc/runs/coldwater-2026-10-01-extension-scope2/row18-probe';task=root/'.qc-cache/coldwater-2026-10-01-extension-scope2/task'
args=['docker','run','--pull','never','--rm','--name','coldwater-row18-theme-probe','--network','none','--shm-size','1g','--mount',f'type=bind,source={task},target=/task,readonly','--mount',f'type=bind,source={out},target=/evidence','sha256:46fefc505dbcabf0d6cb4e54fea8f0880acde2f7896587750af967427598977d','python3','/evidence/container.py']
(out/'command.json').write_text(json.dumps({'argv':args,'input_sha256':'ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8','provider':False,'published_ports':[]},indent=2))
start=time.monotonic();proc=subprocess.run(args,capture_output=True,text=True,timeout=100)
(out/'stdout.log').write_text(proc.stdout);(out/'stderr.log').write_text(proc.stderr)
(out/'result.json').write_text(json.dumps({'exit_code':proc.returncode,'wall_seconds':time.monotonic()-start},indent=2))
print(proc.stdout);print(proc.stderr);raise SystemExit(proc.returncode)
