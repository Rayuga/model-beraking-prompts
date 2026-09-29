from pathlib import Path
import hashlib
import json
import re

out = Path(__file__).resolve().parent
root = out.parents[2]
log = (out/'harness_golden_browser_restart.log').read_text()
decoder = json.JSONDecoder()
objects = []
for match in re.finditer(r'(?m)^\{',log):
    value,_ = decoder.raw_decode(log[match.start():])
    objects.append(value)
phases = [obj for obj in objects if obj.get('phase') in ['prepare','verify']]
scored = next(obj for obj in objects if obj.get('suite')=='scored')
restart = next(event['actual_process_restart'] for event in scored['events'] if 'actual_process_restart' in event)
assert len(phases)==2 and all(item['passed'] for item in phases)
assert restart['old_pid']!=restart['new_pid'] and restart['old_state'] in (None,'Z','X')
assert restart['new_state'] not in ('Z','X')
task = root/'projects/ridgeline-print-storefront'
paths = ['tests/test.sh','tests/tools/restart_mcp.py','tests/scored/functional/judge.toml',
         'solution/app/server.js','solution/app/src/index.js','solution/app/src/db.js',
         'solution/app/src/pricing.js','solution/app/public/assets/app.js']
report = {'passed':True,'scope':'Fresh independent UI controls and actual MCP process restart; no paid judge and no other functional verdicts inferred.',
          'image':'ridgeline-verifier:20260926-followup','process_restart':restart,'phases':phases,
          'current_source_sha256':{p:hashlib.sha256((task/p).read_bytes()).hexdigest() for p in paths},
          'log_sha256':hashlib.sha256((out/'harness_golden_browser_restart.log').read_bytes()).hexdigest(),
          'probe_sha256':hashlib.sha256((out/'restart-full/browser-restart-check.cjs').read_bytes()).hexdigest()}
(out/'browser_restart_results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':True,'browser':phases[0]['browser'],'process_restart':restart,
                  'grouped_checks':sum(len(p['checks']) for p in phases)}))
