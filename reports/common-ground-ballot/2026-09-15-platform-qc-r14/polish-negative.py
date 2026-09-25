from pathlib import Path
import json
import subprocess

out=Path(__file__).resolve().parent
task=out/'frozen/common-ground-ballot'
dest=out/'mutant-reduced-motion'
dest.mkdir(exist_ok=True)
args=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','LOCAL_CSS_MUTATION=ignore_reduced_motion']
for source,target,ro in [(task/'solution','/golden',True),(task,'/task',True),(out,'/validation',True),(dest,'/results',False)]:
    args+=['--mount',f'type=bind,source={source},target={target}'+(',readonly' if ro else '')]
args+=['ballot-verifier:20260915-r14-local','python3','/validation/run-local.py','polish']
result=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=180)
(dest/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
data=json.loads((dest/'polish-results.json').read_text(encoding='utf-8'))
assert result.returncode!=0
assert {row['name'] for row in data['results'] if not row['passed']}=={'reduced_motion_preference'}
(out/'polish-negative-results.json').write_text(json.dumps({'passed':True,'failed_criteria':['reduced_motion_preference'],'unaffected_criteria':['theme_switch_preserves_workspace','comfortable_touch_targets']},indent=2)+'\n',encoding='utf-8')
print('PASS negative control: only reduced_motion_preference fails; theme and touch pass')
