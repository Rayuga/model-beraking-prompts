from pathlib import Path
import subprocess

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
cmd=['docker','run','--rm','--name','patchpad-rubric-provenance-check','--network','none','--tmpfs','/app','--tmpfs','/logs/verifier','--shm-size','512m']
for src,dst,readonly in [
    (ROOT/'projects/patchpad-editor-v2/tests','/tests',True),
    (ROOT/'projects/patchpad-editor-v2/solution','/solution',True),
    (ROOT/'projects/patchpad-editor-v2/environment/assets','/assets',True),
    (OUT,'/results',False),
]:
    cmd+=['--mount',f'type=bind,source={src},target={dst}'+(',readonly' if readonly else '')]
cmd+=['patchpad-preflight-tests:2.0.9','python3','/results/check-runtime.py']
result=subprocess.run(cmd,timeout=150)
raise SystemExit(result.returncode)
