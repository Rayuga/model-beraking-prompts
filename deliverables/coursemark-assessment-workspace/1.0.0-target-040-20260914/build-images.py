import json,subprocess,sys,time
from pathlib import Path
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
kind=sys.argv[1]
context=ROOT/'projects/coursemark-assessment-workspace'/('environment' if kind=='environment' else 'tests')
started=time.monotonic()
with (OUT/(kind+'-build.log')).open('w',encoding='utf-8') as f:
    proc=subprocess.Popen(['docker','build','--progress','plain','-t','coursemark-'+kind+':target040-20260914',str(context)],stdout=f,stderr=subprocess.STDOUT)
    try:code=proc.wait(timeout=180);status='passed' if code==0 else 'failed'
    except subprocess.TimeoutExpired:
        subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        proc.wait();code=proc.returncode;status='local build attempt stopped after 180 seconds'
result={'kind':kind,'status':status,'exit_code':code,'elapsed_seconds':round(time.monotonic()-started,1),'task_build_timeout_unchanged':600}
(OUT/(kind+'-build-result.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
