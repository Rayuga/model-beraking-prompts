from pathlib import Path
import subprocess
import json
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
command = ['docker','build','--network','none','--tag','ballot-verifier:20260916-r23-runtime-validation','--file',str(HERE/'Dockerfile.runtime-validation'),str(ROOT/'projects/common-ground-ballot/tests')]
with (HERE/'runtime-build.log').open('w',encoding='utf-8') as output:
    result = subprocess.run(command,stdout=output,stderr=subprocess.STDOUT,timeout=120)
(HERE/'runtime-build.json').write_text(json.dumps({'passed':result.returncode==0,'command':command,'scope':'cached dependency build of exact final tests bytes; shipped Dockerfile unchanged'},indent=2)+'\n',encoding='utf-8')
assert result.returncode == 0
print('Built exact r23 runner over cached verifier dependencies.')
