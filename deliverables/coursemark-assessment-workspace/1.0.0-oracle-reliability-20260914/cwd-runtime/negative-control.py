import json
import shutil
import subprocess
from pathlib import Path

rows=[]
Path('/tmp/verifier-cwd').mkdir(exist_ok=True)
for directory in ['/app','/tmp/coursemark-submission']:
    shutil.copytree('/evidence/cwd-runtime/fixture',directory,dirs_exist_ok=True)
    result=subprocess.run(['env','-i','PATH=/usr/local/bin:/usr/bin:/bin','NODE_PATH=/usr/local/lib/node_modules','HOME=/tmp/coursemark-submission','PORT=3000','DB_PATH='+directory+'/coursemark.db','setpriv','--reuid=65534','--regid=65534','--clear-groups','node',directory+'/server.js'],cwd='/tmp/verifier-cwd',capture_output=True,text=True,timeout=10)
    rows.append({'entry':directory+'/server.js','cwd':'/tmp/verifier-cwd','exit_code':result.returncode,'relative_seed_error':"ENOENT" in result.stderr and 'seed_data.json' in result.stderr,'passed':result.returncode!=0 and "ENOENT" in result.stderr and 'seed_data.json' in result.stderr,'stderr':result.stderr})
report={'fixture_only':True,'model_evaluation':False,'description':'Pre-fix launch shape inherits verifier cwd and cannot load relative seed data.','assertions':rows,'passed':all(row['passed'] for row in rows)}
Path('/evidence/cwd-runtime/negative-control.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
assert report['passed']
