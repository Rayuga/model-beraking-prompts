"""Unpaid regression driver, outside the upload task. No provider calls."""
import argparse
import ast
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

APP = Path('/app')
OUT = Path('/results')


def provision():
    APP.mkdir(exist_ok=True)
    seed = Path('/assets/artifacts')
    seed.mkdir(parents=True, exist_ok=True)
    shutil.copyfile('/tests/assets/artifacts/common_ground_seed.json', seed / 'common_ground_seed.json')
    subprocess.run(['bash', '/golden/solve.sh'], check=True)
    subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)


def browser():
    provision()
    subprocess.run(['python3', '/tests/app-lifecycle.py', 'start', '--entry', '/app/server.js',
                    '--database', '/app/commonground.db', '--seed', '/app/common_ground_seed.json'], check=True)
    try:
        for _ in range(60):
            try:
                if urllib.request.urlopen('http://localhost:3000/api/health', timeout=1).status == 200:
                    break
            except OSError:
                time.sleep(.25)
        else:
            raise RuntimeError('Golden app not ready')
        subprocess.run(['node', '/validation/browser-regression.cjs'], check=True, timeout=300)
    finally:
        subprocess.run(['python3', '/tests/app-lifecycle.py', 'stop'], check=True)


def harness():
    # Test doubles isolate score composition and launch behavior, not LLM quality.
    bin_dir = Path('/tmp/local-harness-bin')
    bin_dir.mkdir(mode=0o700)
    stub = bin_dir / 'rewardkit'
    stub.write_text('#!/usr/local/bin/python3\nimport os, pathlib\n'
                    'pathlib.Path("/tmp/judge-entered").write_text("yes")\n'
                    'pathlib.Path("/logs/verifier/reward.json").write_text(os.environ["LOCAL_TEST_SCORES"])\n')
    stub.chmod(0o700)
    results = []
    cases = [
        ('all-one composition', dict(render=1,constraints=1,functional=1,polish=1),1),
        ('graded composition', dict(render=1,constraints=1,functional=.25,polish=.75),.45),
        ('partial render gate',dict(render=.5,constraints=1,functional=1,polish=1),0),
        ('failed constraints gate',dict(render=1,constraints=0,functional=1,polish=1),0),
        ('boolean is not a dimension',dict(render=True,constraints=1,functional=1,polish=1),0),
        ('missing dimension',dict(render=1,constraints=1,functional=1),0),
    ]
    for name, scores, expected in cases:
        provision()
        env = dict(os.environ, PATH=str(bin_dir)+':'+os.environ['PATH'], LOCAL_TEST_SCORES=json.dumps(scores))
        result = subprocess.run(['bash','/tests/test.sh'],env=env,capture_output=True,text=True,timeout=130)
        actual = float(Path('/logs/verifier/reward.txt').read_text())
        assert result.returncode == 0 and actual == expected, (name,result.stdout,result.stderr,actual)
        results.append(dict(name=name,passed=True,reward=actual))
        print('PASS',name,actual,flush=True)
    for name, script, expect_judge in [
        ('missing entrypoint', None, False),
        ('HTTP 500 never becomes ready', "const h=require('http');h.createServer((q,s)=>{s.writeHead(500);s.end('no');}).listen(3000,'0.0.0.0');",False),
        ('delayed successful health', "const h=require('http');setTimeout(()=>h.createServer((q,s)=>{s.writeHead(200);s.end('ok');}).listen(3000,'0.0.0.0'),1500);",True),
    ]:
        provision()
        marker = Path('/tmp/judge-entered')
        marker.unlink(missing_ok=True)
        if script is None:
            (APP/'server.js').unlink()
        else:
            (APP/'server.js').write_text(script)
        env=dict(os.environ,PATH=str(bin_dir)+':'+os.environ['PATH'],LOCAL_TEST_SCORES=json.dumps(dict(render=1,constraints=1,functional=1,polish=1)))
        start=time.monotonic()
        result=subprocess.run(['bash','/tests/test.sh'],env=env,capture_output=True,text=True,timeout=130)
        assert result.returncode==0, result.stderr
        assert marker.exists()==expect_judge,name
        assert float(Path('/logs/verifier/reward.txt').read_text()) == (1 if expect_judge else 0)
        results.append(dict(name=name,passed=True,elapsed_seconds=round(time.monotonic()-start,2)))
        print('PASS',name,flush=True)
    OUT.joinpath('harness-results.json').write_text(json.dumps({'type':'unit tests with an explicit local RewardKit test double; not an Oracle score','results':results},indent=2)+'\n')


def runtime():
    os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'
    from rewardkit.runner import discover
    results = []
    dimensions = {d.name: len(d.criteria) for d in discover('/tests')}
    assert dimensions == dict(render=2, constraints=2, functional=19, polish=5), dimensions
    results.append(dict(name='RewardKit discovers all 28 criteria', passed=True))
    for p in Path('/task').rglob('*'):
        if not p.is_file():
            continue
        if p.suffix == '.sh':
            assert b'\r\n' not in p.read_bytes(), p
            subprocess.run(['bash', '-n', str(p)], check=True)
        elif p.suffix == '.js':
            subprocess.run(['node', '--check', str(p)], check=True)
        elif p.suffix == '.py':
            ast.parse(p.read_text())
    results.append(dict(name='All shipped shell, JavaScript and Python parse', passed=True))
    deps = subprocess.check_output(['node','-e',
        "const db=require('better-sqlite3')(':memory:');console.log(JSON.stringify({express:require('express/package.json').version,sqlite:require('better-sqlite3/package.json').version,native:db.prepare('SELECT 1 as ok').get().ok,playwright:require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright/package.json').version}));db.close();"],text=True)
    deps = json.loads(deps)
    assert deps['express']=='5.1.0' and deps['sqlite']=='12.4.1' and deps['native']==1
    results.append(dict(name='Pinned runtime dependencies and native SQLite load',passed=True))
    Path('/logs/verifier').mkdir(parents=True,exist_ok=True,mode=0o700)
    Path('/logs/verifier').chmod(0o700)
    for p in ['/tests/test.sh','/root/.codex/config.toml','/logs/verifier']:
        r=subprocess.run(['setpriv','--reuid=65534','--regid=65534','--clear-groups','test','-r',p])
        assert r.returncode!=0,p
    results.append(dict(name='Submission UID cannot read verifier tests, judge config or score directory',passed=True))
    version=subprocess.check_output(['codex','--version'],text=True).strip()
    OUT.joinpath('runtime-results.json').write_text(json.dumps(dict(results=results,dimensions=dimensions,dependencies=deps,codex=version),indent=2)+'\n')
    print(json.dumps(results))


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('mode',choices=['browser','harness','runtime'])
    args=parser.parse_args()
    OUT.mkdir(exist_ok=True)
    if args.mode=='browser':
        browser()
    elif args.mode=='harness':
        harness()
    else:
        runtime()
