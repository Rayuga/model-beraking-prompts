import hashlib
import json
import os
import subprocess
import urllib.request
from pathlib import Path

mode=os.environ['COURSEMARK_CWD_CASE']
log=Path(os.environ['VERIFIER_LOG_DIR'])
expected='/app' if mode=='app' else '/tmp/coursemark-submission'
assertions=[]
def check(name, condition, value):
    assertions.append({'name':name,'passed':bool(condition),'observed':value})
    if not condition:
        raise AssertionError(name+': '+str(value))
def read(path):
    with urllib.request.urlopen('http://127.0.0.1:3000'+path, timeout=5) as response:
        return response.read().decode()
result={'case':mode,'fixture_only':True,'model_evaluation':False,'assertions':assertions,'passed':False}
try:
    entry=log.joinpath('app-entry').read_text().strip()
    check('actual entry selection',entry==expected+'/server.js',entry)
    check('verifier cwd differs from app',str(Path.cwd())!=expected,str(Path.cwd()))
    initial=json.loads(read('/api/health'))
    check('initial launch cwd',initial['cwd']==expected,initial['cwd'])
    check('initial relative seed',initial['seed']=='relative-seed-resolved',initial['seed'])
    check('initial relative static root','Relative public root resolved' in read('/'),read('/'))
    check('initial startup count',initial['launches']==1,initial['launches'])
    old_pid=log.joinpath('app.pid').read_text().strip()
    subprocess.run(['bash','/tests/app-lifecycle.sh','restart'],check=True,cwd='/tmp/verifier-cwd')
    later=json.loads(read('/api/health'))
    check('restart changed process',log.joinpath('app.pid').read_text().strip()!=old_pid,log.joinpath('app.pid').read_text().strip())
    check('restart launch cwd',later['cwd']==expected,later['cwd'])
    check('restart relative seed',later['seed']=='relative-seed-resolved',later['seed'])
    check('restart relative static root','Relative public root resolved' in read('/'),read('/'))
    check('restart preserved runtime data',later['launches']==2,later['launches'])
    result['passed']=True
finally:
    result['source_hashes']={name:hashlib.sha256(Path('/tests/'+name).read_bytes()).hexdigest() for name in ['test.sh','app-lifecycle.sh']}
    Path('/evidence/cwd-runtime/'+mode+'-result.json').write_text(json.dumps(result,indent=2)+'\n')
if result['passed']:
    log.joinpath('reward.json').write_text(json.dumps({'render':1,'constraints':1,'functional':0,'polish':0,'visual':0,'fixture_only':True,'model_evaluation':False}))
