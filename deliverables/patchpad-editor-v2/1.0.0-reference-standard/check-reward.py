"""Exercise the actual embedded postprocessor; these are synthetic inputs."""
from pathlib import Path
import itertools, json, subprocess, sys, tempfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
runner=(ROOT/'projects/patchpad-editor-v2/tests/test.sh').read_text(encoding='utf-8')
start=runner.index("<<'PY'",runner.index('if ! python3 - "$LOG_DIR/reward.json"'))+len("<<'PY'\n")
code=runner[start:runner.index('\nPY\n',start)]
results=[]
with tempfile.TemporaryDirectory() as tmp:
    tmp=Path(tmp); program=tmp/'postprocess.py';program.write_text(code,encoding='utf-8')
    def execute(scores):
        src=tmp/'reward.json';src.write_text(json.dumps(scores))
        result=subprocess.run([sys.executable,str(program),str(src),str(tmp/'reward.txt'),str(tmp/'ctrf.json')],capture_output=True,text=True)
        return result,src
    for render,constraints,values in itertools.product((0,.5,1),(0,.5,1),((0,0,0),(.25,.75,.5),(1,1,1))):
        f,p,v=values; scores=dict(render=render,constraints=constraints,functional=f,polish=p,visual=v)
        r,src=execute(scores);assert r.returncode==0,r.stderr
        actual=json.loads(src.read_text());expected=round(0 if render<=0 or constraints<=0 else .6*f+.2*p+.2*v,4)
        assert actual['reward']==expected and actual['graded']==1 and actual['no_op']==0
        assert float((tmp/'reward.txt').read_text())==expected
        ctrf=json.loads((tmp/'ctrf.json').read_text());assert ctrf['summary']['total']==len(ctrf['tests'])==5
        assert ctrf['summary']['passed']+ctrf['summary']['failed']==5
        results.append(dict(input=scores,reward=expected))
    invalid_count=0
    for dim,value in itertools.product(('render','constraints','functional','polish','visual'),(None,True,'1',-1,1.01,float('nan'),float('inf'))):
        scores=dict.fromkeys(('render','constraints','functional','polish','visual'),1);scores[dim]=value
        r,_=execute(scores);assert r.returncode!=0,(dim,value);invalid_count+=1
    for dim in ('render','constraints','functional','polish','visual'):
        scores=dict.fromkeys(('render','constraints','functional','polish','visual'),1);del scores[dim]
        r,_=execute(scores);assert r.returncode!=0;invalid_count+=1
OUT.joinpath('reward-checks.json').write_text(json.dumps(dict(scope='Synthetic postprocessor cases, not judge grades',valid_cases=results,invalid_cases_rejected=invalid_count),indent=2)+'\n')
print(f'PASS {len(results)} reward/CTRF cases and {invalid_count} rejected invalid inputs')
