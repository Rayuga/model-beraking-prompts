from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
TASK=OUT/'frozen/common-ground-ballot'
variants={'session_current_survives':'sessions-1-revocation','member_identified_leak':'one-participant','approval_order_sensitive':'approval-open-reordered'}


def run(kind):
    target=OUT/('mutant-'+kind)
    target.mkdir(exist_ok=True)
    command=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','LOCAL_MUTATION='+kind]
    for source,destination,ro in [(TASK/'solution','/golden',True),(TASK,'/task',True),(OUT,'/validation',True),(target,'/results',False)]:
        command+=['--mount',f'type=bind,source={source},target={destination}'+(',readonly' if ro else '')]
    command+=['ballot-verifier:20260915-r13-local','python3','/validation/run-local.py','mcp']
    if '--review-only' not in sys.argv:
        result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=450)
        (target/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
        assert result.returncode != 0,kind
    evidence=json.loads((target/'mcp-results.json').read_text(encoding='utf-8'))
    assert evidence['results'][-1]['passed'] is False,kind
    path=target/('mcp-'+variants[kind]+'.json')
    raw=json.loads(path.read_text(encoding='utf-8'))
    assert not raw.get('error') and not raw['result'].get('isError'),kind
    text='\n'.join(c['text'] for c in raw['result']['content'] if c['type']=='text')
    data=json.loads(text.split('### Result\n')[1].split('\n###')[0])
    if kind=='session_current_survives':
        assert [r['status'] for r in data['immediate']]==[401,401]
        assert [r['status'] for r in data['replayed']]==[200,401]
        observed='Initiating credential replay retained protected 200 despite local sign-out; second ended credential correctly refused with 401.'
    elif kind=='member_identified_leak':
        ballots=data['leila']['collection']['body']['ballots']
        courtyard=next(b for b in ballots if b['title']=='Courtyard closing time')
        assert any(m['id']=='user-owen' and m['participated'] for m in courtyard['turnout']['members'])
        observed='Leila received identified Owen participation in protected ballot data.'
    else:
        assert data['result']['status']==409
        observed='Reordered equivalent approval selections incorrectly received mismatch 409.'
    print('DETECTED',kind,flush=True)
    return {'variant':kind,'detected':True,'observed':observed,'evidence':path.relative_to(ROOT).as_posix()}


with ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(run,variants))
(OUT/'mcp-variant-results.json').write_text(json.dumps({'results':results},indent=2)+'\n',encoding='utf-8')
