from pathlib import Path
import subprocess

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];TASK=ROOT/'projects/common-ground-ballot'
destination=HERE/'reproduction';destination.mkdir(exist_ok=True)
command=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','no_proxy=localhost,127.0.0.1,::1']
for source,target,readonly in [(TASK/'solution','/golden',True),(TASK/'environment/assets/artifacts','/seed',True),(HERE,'/validation',True),(destination,'/results',False)]:
 command+=['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
command+=['ballot-verifier:20260916-r23-runtime-validation','python3','/validation/reproduce-container.py']
result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',timeout=180)
(destination/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
print(result.stdout,result.stderr)
assert result.returncode==0
