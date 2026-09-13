import json
import subprocess
import time
from pathlib import Path

out = Path(__file__).resolve().parent
task = out.parents[2] / 'projects/common-ground-ballot'
report = {'oracle_run': False, 'platform_qc_run': False, 'builds': [], 'local_runs': []}
def save():
    (out / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')

for section, tag in [('environment','ballot-agent:20260912-judge-r3'),('tests','ballot-verifier:20260912-judge-r3')]:
    start = time.monotonic()
    print('Building ' + tag, flush=True)
    with (out / (section + '-build.log')).open('w') as log:
        r = subprocess.run(['docker','build','-t',tag,str(task / section)],stdout=log,stderr=subprocess.STDOUT,timeout=600)
    report['builds'].append({'section':section,'tag':tag,'exit_code':r.returncode,'seconds':round(time.monotonic()-start,2)})
    if r.returncode == 0:
        report['builds'][-1]['image_id'] = json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]['Id']
    save()
    assert r.returncode == 0, section
for mode in ['runtime','browser','harness']:
    print('Testing ' + mode, flush=True)
    args = ['docker','run','--rm','--network','none','-v',str(task)+':/task:ro',
            '-v',str(task/'solution')+':/golden:ro','-v',str(out)+':/validation:ro',
            '-v',str(out)+':/results','ballot-verifier:20260912-judge-r3','python3','/validation/run-local.py',mode]
    with (out / (mode + '.log')).open('w') as log:
        r = subprocess.run(args,stdout=log,stderr=subprocess.STDOUT,timeout=600)
    report['local_runs'].append({'mode':mode,'exit_code':r.returncode})
    save()
    assert r.returncode == 0, mode
print('PASS exact builds, runtime, browser workflow and synthetic runner tests',flush=True)
