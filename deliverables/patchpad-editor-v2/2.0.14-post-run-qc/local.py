"""Unpaid isolated browser diagnostics of unchanged exported apps."""
from pathlib import Path
import json,subprocess,sys
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
data=json.loads((OUT/'evidence.json').read_text())
kind=sys.argv[1]
r=next(r for r in data['trials'] if r['model']==kind)
app=ROOT/'run-outputs/patchpad-editor-v2'/r['run']/r['trial']/'artifacts/app'
tag='patchpad-postrun-'+('oracle' if kind=='oracle' else 'gemini')
cmd=['docker','run','--name',tag,'--network','none','--read-only','--tmpfs','/tmp','--tmpfs','/app','--tmpfs','/logs/verifier','--tmpfs','/results',
     '--mount',f'type=bind,source={app},target=/artifact,readonly',
     '--mount',f'type=bind,source={OUT},target=/review,readonly',
     '--mount',f'type=bind,source={ROOT / "projects/patchpad-editor-v2/tests"},target=/tests,readonly',
     'patchpad-preflight-tests:2.0.9','python3','/review/runtime.py',kind]
with (OUT/(tag+'.log')).open('w') as log:p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=240)
for line in (OUT/(tag+'.log')).read_text(encoding='utf-8').splitlines():
    if line.startswith('{"kind":'):
        (OUT/(tag+'-browser.json')).write_text(json.dumps(json.loads(line),indent=2,ensure_ascii=True)+'\n')
# /results is a disposable tmpfs: screenshots are not retained after exit.
print(kind,'local diagnostic exit',p.returncode)
raise SystemExit(p.returncode)
