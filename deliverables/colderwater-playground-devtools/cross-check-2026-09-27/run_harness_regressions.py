from pathlib import Path
import hashlib
import json
import subprocess

root = Path.cwd()
out = Path(__file__).resolve().parent
task = root/'projects/colderwater-playground-devtools'
source_hash = hashlib.sha256((task/'tests/test.sh').read_bytes()).hexdigest()
results = []
for case in ['relative_cwd','golden','gate_failure','missing_app','golden_browser_restart']:
    actual = 'golden' if case == 'golden_browser_restart' else case
    fixtures = out/('restart-full' if case == 'golden_browser_restart' else 'harness')
    command = ['docker','run','--rm','--name','colderwater-crosscheck-'+case.replace('_','-'),
               '--network','none','--mount',f'type=bind,source={task},target=/source-task,readonly',
               '--mount',f'type=bind,source={fixtures},target=/local-evidence,readonly',
               '-e',f'HARNESS_CASE={actual}','-e','HARNESS_SECRET=must-not-reach-app',
               '-e','REWARDKIT_JUDGE=local-harness-stub','-e','REWARDKIT_MODEL=not-a-real-model',
               'colderwater-verifier:20260927-fullqc','bash','/local-evidence/harness_boot.sh']
    result = subprocess.run(command,text=True,capture_output=True,timeout=180)
    logfile = out/f'harness_{case}.log'
    logfile.write_text(result.stdout+result.stderr,encoding='utf-8')
    results.append({'case':case,'exit_code':result.returncode,'log':logfile.name,
                    'paid_judge_exercised':False})
    print(case,result.returncode,flush=True)
report = {'passed':all(item['exit_code']==0 for item in results),
          'test_sh_sha256':source_hash,
          'scope':'Four canonical orchestration cases plus actual Chromium and MCP restart witness. RewardKit outcomes are stubbed; no paid Oracle.',
          'results':results}
assert hashlib.sha256((task/'tests/test.sh').read_bytes()).hexdigest() == source_hash
(out/'harness_regression_results.json').write_text(json.dumps(report,indent=2)+'\n')
assert report['passed'], results
