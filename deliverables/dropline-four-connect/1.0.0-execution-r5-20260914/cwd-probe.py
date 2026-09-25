import json
from pathlib import Path
import subprocess
import urllib.request

entry=Path('/logs/verifier/app-entry').read_text().strip()
expected=str(Path(entry).parent)
def get(path='/'):
    with urllib.request.urlopen('http://localhost:3000'+path) as r:
        return json.load(r)
def check(data,n):
    assert data==dict(cwd=expected,counter=n,page='Relative-path fixture'),data
check(get(),0)
check(get('/increment'),1)
for _ in range(2):
    subprocess.run(['bash','/tests/app-lifecycle.sh','restart'],check=True)
    check(get(),1)
Path('/logs/verifier/reward.json').write_text(json.dumps(dict(render=1,constraints=1,functional=.5,polish=.8,visual=.6)))
Path('/evidence/cwd-'+('relocated' if expected.startswith('/tmp/') else 'normal')+'.json').write_text(json.dumps(dict(passed=True,entry=entry,initial_relative_path=True,two_restarts_relative_path_and_persistence=True)))
