"""Test the actual reward-writing block and observable custom-surface fixtures.
No paid judge is invoked; these fixtures do not certify an LLM verdict.
"""
from pathlib import Path
import json,re,subprocess,tempfile
source=Path('/tests/test.sh').read_text()
code=next(c for c in re.findall(r"<<'PY'\n(.*?)\nPY",source,re.S) if 'json_path = Path(sys.argv[1])' in c)
results=[]
with tempfile.TemporaryDirectory(prefix='patchpad-reward-check-') as temp:
    a=Path(temp)/'reward.json';b=Path(temp)/'reward.txt'
    cases=[dict(render=1,constraints=1,functional=f,polish=p) for f in (0,.25,.5,.9,1) for p in (0,.25,.5,.9,1)]
    cases += [dict(render=r,constraints=c,functional=1,polish=1) for r,c in [(0,1),(1,0),(.5,1),(1,.5),(0,0)]]
    for v in cases:
        a.write_text(json.dumps(v));subprocess.run(['python3','-c',code,str(a),str(b)],check=True)
        got=json.loads(a.read_text());expected=0 if v['render']<1 or v['constraints']<1 else round(.9*v['functional']+.1*v['polish'],4)
        assert got['reward']==expected and float(b.read_text())==expected and got['graded']==1
        results.append(dict(input=v,reward=got['reward'],passed=True))
    for key in ('render','constraints','functional','polish'):
        for invalid in (None,'1',-1,1.01):
            v=dict(render=1,constraints=1,functional=1,polish=1);v[key]=invalid;a.write_text(json.dumps(v))
            p=subprocess.run(['python3','-c',code,str(a),str(b)],capture_output=True,text=True)
            assert p.returncode!=0
            results.append(dict(invalid_dimension=key,value=invalid,rejected=True))
Path('/results/reward-regression.json').write_text(json.dumps({'cases':results,'scope':'Actual reward block with synthetic inputs, not real model scores','examples':{'half_functional_full_polish':.55,'almost_complete_plain':.81,'perfect':1,'failed_custom_surface_gate_even_if_other_scores_perfect':0}},indent=2)+'\n')
subprocess.run(['bash','/solution/solve.sh'],check=True)
subprocess.run(['chmod','-R','a+rX','/app'],check=True)
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
subprocess.run(['bash','/tests/app-lifecycle.sh','start'],check=True)
try:subprocess.run(['node','/results/surface-fixtures.cjs'],check=True,timeout=90)
finally:subprocess.run(['bash','/tests/app-lifecycle.sh','stop'],check=True)
print('PASS 30 reward cases, 16 invalid-value rejections and surface fixture diagnostics',flush=True)
