from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
subjects={'gpt':'run-149f45ce-844e-48d0-87ea-2c5704af7773/common-ground-ballot__dD7G3yM',
          'haiku':'run-063fe8ed-7448-49ad-98e8-2c0158c421bb/common-ground-ballot__XM5sBfb'}
def run(name):
    dest=HERE/('diagnostic-'+name);dest.mkdir(exist_ok=True)
    app=ROOT/'run-outputs/common-ground-ballot'/subjects[name]/'artifacts/app'
    cmd=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1',
         '--mount',f'type=bind,source={app},target=/submission,readonly',
         '--mount',f'type=bind,source={HERE},target=/analysis,readonly',
         '--mount',f'type=bind,source={dest},target=/results',
         'ballot-verifier:20260917-r27-runtime-validation','python3','/analysis/diagnose-container.py',name]
    proc=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=160)
    (dest/'runner.log').write_text(proc.stdout+'\n'+proc.stderr,encoding='utf-8')
    print(name,proc.returncode,proc.stdout,proc.stderr,flush=True)
    return {'subject':name,'completed':proc.returncode==0}
rows=[run('gpt')]
(HERE/'diagnostic-results.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
assert all(r['completed'] for r in rows)
