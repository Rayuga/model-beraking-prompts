from pathlib import Path
import concurrent.futures,json,subprocess,time
OUT=Path(__file__).resolve().parent
def build(kind):
    started=time.monotonic()
    with (OUT/(kind+'-build.log')).open('w') as log:
        proc=subprocess.Popen(['docker','build','--pull=false','-t','gambit-full-preflight-'+kind+':1.0.0',str(OUT/'extracted/gambit-hollow-cribbage'/kind)],stdout=log,stderr=subprocess.STDOUT)
        try:
            code=proc.wait(timeout=180);status='passed' if code==0 else 'failed'
        except subprocess.TimeoutExpired:
            subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            proc.wait(timeout=15);code=proc.returncode;status='timeout'
        result={'image':kind,'status':status,'exit_code':code,'elapsed_seconds':round(time.monotonic()-started,1),'context':'exact archive extraction'}
        (OUT/(kind+'-build-result.json')).write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result),flush=True)
        return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(build,('environment','tests')))
(OUT/'build-results.json').write_text(json.dumps(results,indent=2)+'\n')
