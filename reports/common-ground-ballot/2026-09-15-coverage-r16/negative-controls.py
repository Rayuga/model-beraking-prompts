from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess

OUT = Path(__file__).resolve().parent
TASK = OUT / 'frozen/common-ground-ballot'
cases = {'observer_setup_hidden':'observer_ballot_setup_access',
    'observer_results_hidden':'observer_published_results_access',
    'observer_members_denied':'observer_members_access',
    'observer_audit_denied':'observer_audit_access',
    'color_only_status':'status_text_without_color',
    'unexplained_draft_publish':'unavailable_action_guidance'}


def check(case):
    name, expected = case
    dest = OUT / ('mutant-' + name)
    dest.mkdir(exist_ok=True)
    command=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1',
             '--env','no_proxy=localhost,127.0.0.1,::1','--env','COVERAGE_MUTATION='+name]
    for source,target,readonly in [(TASK/'solution','/golden',True),(TASK,'/task',True),(OUT,'/validation',True),(dest,'/results',False)]:
        command+=['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
    command+=['ballot-verifier:20260915-r16-local','python3','/validation/run-local.py','coverage']
    result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=210)
    (dest/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
    data=json.loads((dest/'coverage-results.json').read_text(encoding='utf-8'))['results']
    assert len(data)==6 and result.returncode!=0,(name,data)
    failed=[r['name'] for r in data if not r['passed']]
    assert failed==[expected],(name,failed)
    print('PASS mutant',name,'fails only',expected,flush=True)
    return {'variant':name,'expected_failed_criterion':expected,'actual_failed_criteria':failed,'other_new_criteria_passed':5,'passed':True}


with ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(check,cases.items()))
(OUT/'negative-control-results.json').write_text(json.dumps({'scope':'Local browser tests against intentionally defective app variants, not LLM verdicts','results':results},indent=2)+'\n',encoding='utf-8')
