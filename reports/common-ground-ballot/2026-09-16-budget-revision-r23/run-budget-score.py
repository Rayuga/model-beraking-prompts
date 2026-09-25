from pathlib import Path
import subprocess

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
destination=HERE/'budget-score';destination.mkdir(exist_ok=True)
command=['docker','run','--rm','--network','none','--env','LITELLM_LOCAL_MODEL_COST_MAP=True']
for source,target,readonly in [(ROOT/'projects/common-ground-ballot','/task',True),(HERE,'/validation',True),(destination,'/results',False)]:
    command+=['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
command+=['ballot-verifier:20260916-r23-runtime-validation','python3','/validation/check-budget-and-score.py']
result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',timeout=60)
(destination/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
print(result.stdout,result.stderr)
assert result.returncode==0
