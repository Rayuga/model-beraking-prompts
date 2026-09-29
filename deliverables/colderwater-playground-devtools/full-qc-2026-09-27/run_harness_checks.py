from pathlib import Path
import json
import subprocess

root=Path.cwd()
out=Path(__file__).resolve().parent
results=[]
for case in ('relative_cwd','golden','gate_failure','missing_app'):
    command=['docker','run','--rm','--network','none',
       '--mount',f'type=bind,source={root / "projects/colderwater-playground-devtools"},target=/source-task,readonly',
       '--mount',f'type=bind,source={out},target=/local-evidence,readonly',
       '-e',f'HARNESS_CASE={case}','-e','HARNESS_SECRET=must-not-reach-app',
       '-e','REWARDKIT_JUDGE=local-harness-stub','-e','REWARDKIT_MODEL=not-a-real-model',
       'colderwater-verifier:20260927-fullqc','bash','/local-evidence/harness_boot.sh']
    p=subprocess.run(command,text=True,capture_output=True,timeout=180)
    (out/f'harness_{case}.log').write_text(p.stdout+p.stderr,encoding='utf-8')
    results.append({'case':case,'exit_code':p.returncode,'log':f'harness_{case}.log','paid_judge_exercised':False})
    print(case,p.returncode,flush=True)
(out/'harness_results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
assert all(r['exit_code']==0 for r in results),results
