from pathlib import Path
import hashlib
import json
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
TASK = ROOT/'projects/ridgeline-print-storefront'
FIXTURES = ROOT/'deliverables/ridgeline-print-storefront/cross-check-2026-09-27/harness'
source_hash = hashlib.sha256((TASK/'tests/test.sh').read_bytes()).hexdigest()
results = []
for case in ['relative_cwd','golden','gate_failure','missing_app']:
    command = ['docker','run','--rm','--name','ridgeline-second-harness-'+case.replace('_','-'),
               '--network','none','--mount',f'type=bind,source={TASK},target=/source-task,readonly',
               '--mount',f'type=bind,source={FIXTURES},target=/local-evidence,readonly',
               '-e',f'HARNESS_CASE={case}','-e','HARNESS_SECRET=must-not-reach-app',
               '-e','REWARDKIT_JUDGE=local-harness-stub','-e','REWARDKIT_MODEL=not-a-real-model',
               'ridgeline-verifier:20260927-crosscheck','bash','/local-evidence/harness_boot.sh']
    result = subprocess.run(command,text=True,capture_output=True,timeout=120)
    logfile = HERE/f'orchestration_{case}.log'
    logfile.write_text(result.stdout+result.stderr,encoding='utf-8')
    results.append({'case':case,'exit_code':result.returncode,'log':logfile.name,'paid_judge_exercised':False})
    print(case,result.returncode,flush=True)
report = {'passed':all(item['exit_code']==0 for item in results),'test_sh_sha256':source_hash,
          'scope':'Fresh four harness orchestration cases after bounded-cleanup repair. Real process/MCP restart and app state; synthetic RewardKit scores.',
          'fixture_source_hashes': {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in FIXTURES.iterdir() if p.is_file()}, 'results':results}
assert hashlib.sha256((TASK/'tests/test.sh').read_bytes()).hexdigest() == source_hash
(HERE/'orchestration_regression_results.json').write_text(json.dumps(report,indent=2)+'\n')
assert report['passed']
