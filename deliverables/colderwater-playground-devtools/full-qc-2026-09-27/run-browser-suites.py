from pathlib import Path
import subprocess,json,time
out=Path(__file__).resolve().parent
reports=[]
for name in ['golden','runtime','library','errors','budget','network','validation']:
    folder=out/'runtime'/name
    command=['docker','run','--rm','--name','colderwater-fullqc-browser-'+name+'-20260927','--network','container:colderwater-fullqc-20260927',
    '--mount',f'type=bind,source={folder},target=/work',
    '-e','PLAYWRIGHT_PACKAGE=/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright',
    '-e','CHROMIUM_PATH=/usr/local/bin/chromium','-e','COLDERWATER_URL=http://localhost:3000','-e','COLDERWATER_EVIDENCE=/work/browser-evidence',
    'colderwater-verifier:20260926-followup','node','/work/probe.cjs']
    start=time.monotonic()
    run=subprocess.run(command,text=True,capture_output=True,encoding='utf-8',timeout=230)
    (folder/'execution.log').write_text(run.stdout+run.stderr,encoding='utf-8')
    entry={'suite':name,'returncode':run.returncode,'elapsed_seconds':round(time.monotonic()-start,3),'command':command}
    reports.append(entry)
    (out/'runtime-executions.json').write_text(json.dumps(reports,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(entry),flush=True)
    if run.returncode:
        print(run.stdout+run.stderr,flush=True)
        raise SystemExit(run.returncode)
