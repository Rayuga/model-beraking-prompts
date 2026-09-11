"""Runs in disposable verifier image with trusted stub, never a paid judge."""
import json,os,subprocess,sys,tempfile
from pathlib import Path
os.environ['LITELLM_LOCAL_MODEL_COST_MAP']='True'
from rewardkit.runner import discover
from rewardkit.models import Likert
dimensions=discover('/tests');counts={d.name:len(d.criteria) for d in dimensions}
assert counts==dict(render=2,constraints=2,functional=22,polish=7),counts
polish=next(d for d in dimensions if d.name=='polish')
assert sum(isinstance(c.output_format,Likert) for c in polish.criteria)==5
assert [Likert(points=5).normalize(x) for x in range(1,6)]==[0,.25,.5,.75,1]
for s in ['/solution/solve.sh','/tests/test.sh']:subprocess.run(['bash','-n',s],check=True)
subprocess.run(['node','--check','/solution/app/server.js'],check=True)
html=Path('/solution/app/public/index.html').read_text();js=html.split('<script>')[1].split('</script>')[0]
Path('/tmp/golden-client.js').write_text(js);subprocess.run(['node','--check','/tmp/golden-client.js'],check=True)
subprocess.run(['bash','/tests/test.sh'],check=True);assert json.loads(Path('/logs/verifier/reward.json').read_text())['no_op']==1
subprocess.run(['bash','/solution/solve.sh'],check=True)
stubdir=Path(tempfile.mkdtemp(prefix='brickfall-trusted-stub-'));stub=stubdir/'rewardkit'
stub.write_text('''#!/usr/bin/env python3
import json,subprocess
from pathlib import Path
for file in ['/gate/gate-regression.cjs','/reference/browser-regression.cjs','/results/targeted.cjs']:
    subprocess.run(['node',file],check=True,timeout=180)
Path('/logs/verifier/reward.json').write_text(json.dumps(dict(render=1,constraints=1,functional=.5,polish=1)))
''');stub.chmod(0o700)
result=subprocess.run(['bash','/tests/test.sh'],timeout=400,env=dict(os.environ,PATH=str(stubdir)+':'+os.environ['PATH']))
print(Path('/logs/verifier/rewardkit.log').read_text(),flush=True)
r=json.loads(Path('/logs/verifier/reward.json').read_text());assert result.returncode==0 and r['graded']==1 and r['reward']==.7,r
# Execute the exact runner aggregation on a grid of injected scores.
runner=Path('/tests/test.sh').read_text();block=runner[runner.index('import json\nimport math'):].split('\nPY\n')[0]
cases=0
for render,constraints in [(1,1),(0,1),(1,0),(0,0)]:
    for f in [0,.25,.5,.75,1]:
        for p in [0,.25,.5,.75,1]:
            jp=Path('/tmp/math.json');tp=Path('/tmp/math.txt');jp.write_text(json.dumps(dict(render=render,constraints=constraints,functional=f,polish=p)))
            subprocess.run([sys.executable,'-c',block,str(jp),str(tp)],check=True)
            expected=round(.6*f+.4*p,4) if render and constraints else 0
            assert json.loads(jp.read_text())['reward']==expected;cases+=1
invalid=0
for key in ['render','constraints','functional','polish']:
    for value in [None,True,'1',-1,1.01,float('nan')]:
        scores=dict(render=1,constraints=1,functional=1,polish=1);scores[key]=value
        jp.write_text(json.dumps(scores));p=subprocess.run([sys.executable,'-c',block,str(jp),str(tp)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        assert p.returncode!=0;(invalid:=invalid+1)
Path('/results/local-checks.json').write_text(json.dumps(dict(criteria=counts,syntax=True,noop_zero=True,runner_stub_aggregate=.7,discovered_likert=5,likert_normalization=[0,.25,.5,.75,1],reward_cases=cases,invalid_scores_rejected=invalid,scope='Unpaid local tests, not Oracle/platform QC'),indent=2)+'\n')
print('PASS discovery, syntax, no-op, current-source browser suite, 100 reward cases, 24 invalid scores and Likert normalization')
