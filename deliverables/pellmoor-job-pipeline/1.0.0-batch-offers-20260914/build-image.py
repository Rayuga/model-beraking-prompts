from pathlib import Path
import json, subprocess, sys, time

out=Path(__file__).resolve().parent
root=out.parents[2]
kind=sys.argv[1]
assert kind in ('environment','verifier')
context=root/'projects/pellmoor-job-pipeline'/('environment' if kind=='environment' else 'tests')
command=['docker','build','--progress','plain','-t',f'pellmoor-batch-{kind}:20260914',str(context)]
started=time.monotonic()
with (out/f'{kind}-build.log').open('wb') as log:
    process=subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        code=process.wait(timeout=600)
        status='passed' if code==0 else 'failed'
    except subprocess.TimeoutExpired:
        subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=log,stderr=subprocess.STDOUT,check=False,creationflags=subprocess.CREATE_NO_WINDOW)
        process.wait(timeout=15)
        code=process.returncode
        status='timed out after 600 seconds'
result=dict(kind=kind,status=status,exit_code=code,elapsed_seconds=round(time.monotonic()-started,2),command=command)
(out/f'{kind}-build-status.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
sys.exit(0 if status=='passed' else 1)
