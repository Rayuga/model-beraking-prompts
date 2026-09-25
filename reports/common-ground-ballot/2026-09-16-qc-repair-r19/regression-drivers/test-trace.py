import json, os, signal, subprocess, sys, tempfile, time
from pathlib import Path

results = []
wrapper = '/opt/common-ground-verifier/codex-trace.py'
prompt = 'Task version: 1.0.0\nPrompt version: common-ground-ballot-functional-v1.0.0-r18\nObserve the app.'
with tempfile.TemporaryDirectory(prefix='trace-regression-') as temporary:
    root = Path(temporary)
    env = dict(os.environ, CODEX_TRACE_REAL_COMMAND=json.dumps([sys.executable,'/validation/fake-codex.py']),
               VERIFIER_LOG_DIR=str(root/'logs'), CODEX_HOME=str(root/'codex'), LOCAL_TEST_SECRET='trace-test-secret-72d65f')
    version = subprocess.run([sys.executable,wrapper,'--version'],env=env,capture_output=True,text=True,timeout=10)
    assert version.returncode == 0 and version.stdout.strip() == 'fake-codex-version' and not (root/'logs').exists()
    results.append({'name':'non-exec calls pass through without trace or argument changes','passed':True})
    for name, mode, extra, expected in [
        ('success','success',[],0),('caller-output','success',['-o',str(root/'caller.json')],0),
        ('equals-output','success',['--output-last-message='+str(root/'equals.json')],0),
        ('explicit-json','success',['--json'],0),('failed','failed',[],7),('missing','missing',[],65),
    ]:
        caseenv = dict(env, LOCAL_TRACE_MODE=mode)
        proc = subprocess.run([sys.executable,wrapper,'exec','--skip-git-repo-check',prompt]+extra,env=caseenv,capture_output=True,text=True,timeout=15)
        assert proc.returncode == expected, (name,proc.returncode,proc.stderr)
        if name == 'explicit-json': assert json.loads(proc.stdout.splitlines()[0])['type'] == 'thread.started'
        elif mode != 'missing': assert json.loads(proc.stdout)['check']['score'] == 'yes'
        else: assert proc.stdout == ''
        directory = sorted((root/'logs/judges/functional').iterdir())[-1]
        timing = json.loads((directory/'timing.json').read_text())
        assert timing['returncode'] == expected and timing['elapsed_sec'] >= 0 and timing['finished_at']
        assert timing['prompt_sha256'] and len(timing['rollouts']) == 1
        for file in directory.iterdir():
            text = file.read_text()
            assert env['LOCAL_TEST_SECRET'] not in text and 'DO-NOT-EXPORT-AUTH-FILE' not in text, file
        assert (directory/'events.jsonl').stat().st_size and (directory/'stderr.log').stat().st_size
        results.append({'name':name+' preserves verdict/exit and private trace contract','passed':True})
    caseenv = dict(env, LOCAL_TRACE_MODE='signal')
    proc = subprocess.Popen([sys.executable,wrapper,'exec',prompt],env=caseenv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    deadline = time.monotonic()+8
    while time.monotonic()<deadline:
        dirs=sorted((root/'logs/judges/functional').iterdir())
        if len(dirs)==7 and (dirs[-1]/'events.jsonl').exists() and (dirs[-1]/'events.jsonl').stat().st_size: break
        time.sleep(.05)
    else: raise AssertionError('Signal test child did not start')
    proc.terminate(); proc.communicate(timeout=10)
    assert proc.returncode == -signal.SIGTERM
    timing=json.loads((dirs[-1]/'timing.json').read_text())
    assert timing['status']=='terminated' and timing['received_signals']==[signal.SIGTERM]
    results.append({'name':'termination propagates and records final timing','passed':True})
report={'passed':len(results),'failed':0,'scored_oracle':False,'checks':results}
Path('/results/trace-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
