from pathlib import Path
import asyncio, hashlib, json, os, subprocess, sys, tempfile
os.environ['LITELLM_LOCAL_MODEL_COST_MAP']='True'
os.environ['REWARDKIT_JUDGE']='codex'
os.environ['REWARDKIT_MODEL']='gpt-5.6-luna'
from rewardkit.runner import discover, _run_all
from rewardkit.models import Likert
import rewardkit.reward as reward_module

out=Path('/results'); dims=('render','constraints','functional','polish','visual')
rewards=discover('/tests'); counts={r.name:len(r.criteria) for r in rewards}
assert counts==dict(render=2,constraints=2,functional=22,polish=5,visual=6),counts
assert sum(isinstance(c.output_format,Likert) for r in rewards for c in r.criteria)==6
order=[];active=0
async def fake_agent(judge,criteria,weights,**kwargs):
    global active
    active+=1;assert active==1
    order.append(next(r.name for r in rewards if r.judge is judge))
    await asyncio.sleep(.005)
    active-=1
    return [],'',[]
real_agent=reward_module.arun_agent;reward_module.arun_agent=fake_agent
try:asyncio.run(_run_all(rewards,max_concurrent_agent=1))
finally:reward_module.arun_agent=real_agent
assert order==['constraints','functional','polish','render','visual'],order
for script in ['/solution/solve.sh','/tests/test.sh']:subprocess.run(['bash','-n',script],check=True)
subprocess.run(['node','--check','/solution/app/server.js'],check=True)
html=Path('/solution/app/public/index.html').read_text();js=html.split('<script>')[1].split('</script>')[0]
Path('/tmp/brickfall-client.js').write_text(js);subprocess.run(['node','--check','/tmp/brickfall-client.js'],check=True)
noop=subprocess.run(['bash','/tests/test.sh'],check=True,capture_output=True,text=True)
assert json.loads(Path('/logs/verifier/reward.json').read_text())['no_op']==1
record=json.loads(Path('/logs/verifier/prompt-provenance.json').read_text())
assert 'Prompt provenance:' in noop.stdout and len(record['judges'])==5
for dim,item in record['judges'].items():
    assert item['prompt_version']==f'brickfall-breaker-arcade-{dim}-v1.0.0-r1'
    for key,name in [('prompt_sha256','prompt.md'),('judge_sha256','judge.toml')]:assert item[key]==hashlib.sha256(Path('/tests',dim,name).read_bytes()).hexdigest()
for key,name in [('runner_sha256','test.sh'),('reward_config_sha256','reward.toml')]:assert record[key]==hashlib.sha256(Path('/tests',name).read_bytes()).hexdigest()
(out/'prompt-provenance.json').write_text(json.dumps(record,indent=2)+'\n')
subprocess.run(['bash','/solution/solve.sh'],check=True)
stubdir=Path(tempfile.mkdtemp(prefix='brickfall-review-stub-'));stub=stubdir/'rewardkit'
stub.write_text('''#!/usr/bin/env python3
import json,subprocess
from pathlib import Path
for file in ['gate-regression.cjs','browser-regression.cjs','targeted.cjs','presentation.cjs']:
    subprocess.run(['node','/results/'+file],check=True,timeout=180)
Path('/logs/verifier/reward.json').write_text(json.dumps(dict(render=1,constraints=1,functional=.5,polish=.8,visual=.6)))
''');stub.chmod(0o700)
run=subprocess.run(['bash','/tests/test.sh'],timeout=650,env=dict(os.environ,PATH=str(stubdir)+':'+os.environ['PATH']),capture_output=True,text=True)
(out/'runner-stdout.txt').write_text(run.stdout);(out/'runner-stderr.txt').write_text(run.stderr)
log=Path('/logs/verifier/rewardkit.log').read_text();(out/'browser-output.txt').write_text(log);print(log,flush=True)
r=json.loads(Path('/logs/verifier/reward.json').read_text());assert run.returncode==0 and r['graded']==1 and r['reward']==.58,r
assert json.loads(Path('/logs/verifier/ctrf.json').read_text())['summary']['total']==5
runner=Path('/tests/test.sh').read_text();block=runner[runner.index('import json\nimport math'):].split('\nPY\n')[0]
jp=Path('/tmp/math.json');tp=Path('/tmp/math.txt');cp=Path('/tmp/ctrf.json');cases=0
for g in [(1,1),(0,1),(1,0),(0,0),(.5,.5)]:
    for f in [0,.5,1]:
        for p in [0,.5,1]:
            for v in [0,.5,1]:
                scores=dict(zip(dims,[*g,f,p,v]));jp.write_text(json.dumps(scores));subprocess.run([sys.executable,'-c',block,str(jp),str(tp),str(cp)],check=True)
                expected=round(.6*f+.2*p+.2*v,4) if all(g) else 0
                assert json.loads(jp.read_text())['reward']==expected;cases+=1
invalid=0
for key in dims:
    for value in [None,True,'1',-1,1.01,float('nan'),float('inf'),'MISSING']:
        scores=dict.fromkeys(dims,1)
        if value=='MISSING':scores.pop(key)
        else:scores[key]=value
        jp.write_text(json.dumps(scores));res=subprocess.run([sys.executable,'-c',block,str(jp),str(tp),str(cp)],capture_output=True)
        assert res.returncode!=0;invalid+=1
(out/'local-checks.json').write_text(json.dumps(dict(passed=True,criteria=counts,serial_order=order,syntax=True,noop_zero=True,provenance=True,runner_stub_aggregate=.58,reward_cases=cases,invalid_scores_rejected=invalid,likert_normalization=[Likert(points=5).normalize(i) for i in range(1,6)],scope='Unpaid current-source checks with cached tools, not Oracle or platform QC'),indent=2)+'\n')
print('PASS current runner, five dimensions, scheduling order, provenance, browser suites, 135 score cases and 40 invalid scores')
