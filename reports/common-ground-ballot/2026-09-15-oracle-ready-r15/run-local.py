"""Unpaid regression driver, outside the upload task. No provider calls."""
import argparse
import ast
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import tomllib
import urllib.request

APP = Path('/app')
OUT = Path('/results')


def provision():
    APP.mkdir(exist_ok=True)
    seed = Path('/assets/artifacts')
    seed.mkdir(parents=True, exist_ok=True)
    shutil.copyfile('/task/environment/assets/artifacts/common_ground_seed.json', seed / 'common_ground_seed.json')
    subprocess.run(['bash', '/golden/solve.sh'], check=True)
    shutil.rmtree('/assets')
    if Path('/instructions').exists(): shutil.rmtree('/instructions')
    subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)


def browser(gate_only=False, session_only=False, script=None):
    provision()
    if os.environ.get('LOCAL_CSS_MUTATION') == 'ignore_reduced_motion':
        style=APP/'public/styles.css'
        content=style.read_text()
        assert '@media (prefers-reduced-motion: reduce)' in content
        style.write_text(content.replace('@media (prefers-reduced-motion: reduce)','@media (prefers-reduced-motion: reduce) and (width: 1px)'))
    mutation = os.environ.get('LOCAL_MUTATION')
    if mutation:
        source = APP / 'server.js'
        content = source.read_text()
        variants = {
            'session_current_survives': ('db.prepare("DELETE FROM sessions WHERE user_id = ?").run(request.user.id);', 'db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(request.user.id, request.user.token_hash);'),
            'member_identified_leak': ('view.participated = Boolean', 'view.turnout = {members:staffTurnout(ballot.id)};\n    view.participated = Boolean'),
            'approval_order_sensitive': ('choiceIds: [...choiceIds].sort()', 'choiceIds: [...choiceIds]'),
            'permissive_password': ('if (!user || !passwordMatches(password, user.password_salt, user.password_hash)) {', 'if (!user) {'),
            'public_collection': ('const user = currentUser(request);', 'const user = currentUser(request) || db.prepare("SELECT * FROM users WHERE id = ?").get("user-ruth");'),
            'denial_body_leaks': ('if (!user) return next(new ApiError(401, "Please sign in to continue."));', 'if (!user) return _response.status(401).json({error:"Please sign in.",ballots:db.prepare("SELECT id,title FROM ballots").all()});'),
            'staff_receipt_ignored': ('if (prior) {', 'if (prior && action === "ballot.vote") {'),
            'roster_revision_ignored': ('if (member.revision !== expectedRevision) {', 'if (false) {'),
            'refusal_receipt_forgotten': ('if (prior) {', 'if (prior && prior.status_code < 400) {'),
            'eligible_denominator': ('percentage: participationCount ? Math.round((row.votes / participationCount) * 100) : 0,', 'percentage: eligibleCount ? Math.round((row.votes / eligibleCount) * 100) : 0,'),
            'stale_edit_accepted': ('if (ballot.revision !== expectedRevision) {', 'if (false) {'),
            'open_edit_accepted': ('if (ballot.status !== "draft") throw new ApiError(409, "Only a draft ballot can be edited.");', ''),
            'vote_replay_rejected': ('if (prior) {', 'if (prior && action !== "ballot.vote") {'),
            'closed_vote_accepted': ('if (ballot.status !== "open") throw new ApiError(409, "This ballot is not accepting votes.");', 'if (ballot.status === "closed") return {statusCode:201, body:{participated:true}};\n        if (ballot.status !== "open") throw new ApiError(409, "This ballot is not accepting votes.");'),
            'closed_gate_missing': ('if (ballot.status !== "open") throw new ApiError(409, "This ballot is not accepting votes.");', 'if (ballot.status !== "open" && ballot.status !== "closed") throw new ApiError(409, "This ballot is not accepting votes.");'),
        }
        old, new = variants[mutation]
        assert old in content
        source.write_text(content.replace(old, new, 1))
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
        subprocess.run(['node', '/validation/' + script if script else '/validation/session-regression.cjs' if session_only else '/validation/auth-gate.cjs' if gate_only else '/validation/browser-regression.cjs'], check=True, timeout=450)
    finally:
        subprocess.run(['python3', '/tests/app-lifecycle.py', 'stop'], check=True)


def harness():
    # Test doubles isolate score composition and launch behavior, not LLM quality.
    bin_dir = Path('/tmp/local-harness-bin')
    bin_dir.mkdir(mode=0o700)
    stub = bin_dir / 'rewardkit'
    stub.write_text('#!/usr/local/bin/python3\nimport os, pathlib\n'
                    'pathlib.Path("/tmp/judge-entered").write_text("yes")\n'
                    'pathlib.Path("/logs/verifier/reward.json").write_text(os.environ["LOCAL_TEST_SCORES"])\n'
                    'if os.environ.get("LOCAL_HARNESS_TERM"): os.kill(os.getppid(), 15)\n'
                    'raise SystemExit(int(os.environ.get("LOCAL_HARNESS_EXIT", "0")))\n')
    stub.chmod(0o700)
    results = []
    cases = [
        ('all-one composition', dict(render=1,constraints=1,functional=1,polish=1,visual=1),1),
        ('graded composition', dict(render=1,constraints=1,functional=.25,polish=.75,visual=.5),.4),
        ('partial positive render gate',dict(render=.5,constraints=1,functional=1,polish=1,visual=1),1),
        ('failed constraints gate',dict(render=1,constraints=0,functional=1,polish=1,visual=1),0),
        ('boolean is not a dimension',dict(render=True,constraints=1,functional=1,polish=1,visual=1),0),
        ('zero functional floor',dict(render=1,constraints=1,functional=0,polish=1,visual=1),.4),
        ('nan dimension',dict(render=1,constraints=1,functional=float('nan'),polish=1,visual=1),0),
        ('out of range',dict(render=1,constraints=1,functional=2,polish=1,visual=1),0),
        ('missing dimension',dict(render=1,constraints=1,functional=1),0),
    ]
    for name, scores, expected in cases:
        provision()
        env = dict(os.environ, PATH=str(bin_dir)+':'+os.environ['PATH'], LOCAL_TEST_SCORES=json.dumps(scores))
        result = subprocess.run(['bash','/tests/test.sh'],env=env,capture_output=True,text=True,timeout=130)
        actual = float(Path('/logs/verifier/reward.txt').read_text())
        if result.returncode != 0 or actual != expected:
            shutil.copytree('/logs/verifier', OUT/'harness-failure', dirs_exist_ok=True)
        assert result.returncode == 0 and actual == expected, (name,result.stdout,result.stderr,actual)
        dims=json.loads(Path('/logs/verifier/reward.json').read_text())
        assert set(['render','constraints','functional','polish','visual']) <= dims.keys()
        ctrf=json.loads(Path('/logs/verifier/ctrf.json').read_text())
        assert ctrf['summary']['total'] in [0,5]
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
        env=dict(os.environ,PATH=str(bin_dir)+':'+os.environ['PATH'],LOCAL_TEST_SCORES=json.dumps(dict(render=1,constraints=1,functional=1,polish=1,visual=1)))
        start=time.monotonic()
        result=subprocess.run(['bash','/tests/test.sh'],env=env,capture_output=True,text=True,timeout=130)
        assert result.returncode==0, result.stderr
        assert marker.exists()==expect_judge,name
        assert float(Path('/logs/verifier/reward.txt').read_text()) == (1 if expect_judge else 0)
        results.append(dict(name=name,passed=True,elapsed_seconds=round(time.monotonic()-start,2)))
        print('PASS',name,flush=True)
    for name,target,expected in [
        ('in-app symlink accepted','/app/public/styles.css',True),
        ('preinstalled dependency symlink accepted','/usr/local/lib/node_modules/express',True),
        ('verifier-path symlink rejected','/tests/test.sh',False),
    ]:
        provision()
        link=APP/'local-link-check'
        if link.is_symlink(): link.unlink()
        link.symlink_to(target)
        marker=Path('/tmp/judge-entered')
        marker.unlink(missing_ok=True)
        env=dict(os.environ,PATH=str(bin_dir)+':'+os.environ['PATH'],LOCAL_TEST_SCORES=json.dumps(dict(render=1,constraints=1,functional=1,polish=1,visual=1)))
        result=subprocess.run(['bash','/tests/test.sh'],env=env,capture_output=True,text=True,timeout=130)
        assert result.returncode==0,result.stderr
        assert marker.exists()==expected,name
        assert float(Path('/logs/verifier/reward.txt').read_text())==(1 if expected else 0),name
        link.unlink()
        results.append(dict(name=name,passed=True))
        print('PASS',name,flush=True)
    for name, missing_seed, content, extra in [
        ('missing embedded seed is not restored', True, json.dumps(dict(render=1,constraints=1,functional=1,polish=1,visual=1)), {}),
        ('malformed judge JSON fails closed', False, '{', {}),
        ('judge crash cannot retain intermediate positive score', False, json.dumps(dict(render=1,constraints=1,functional=1,polish=1,visual=1,reward=1)), {'LOCAL_HARNESS_EXIT':'9'}),
        ('termination cannot retain intermediate positive score', False, json.dumps(dict(render=1,constraints=1,functional=1,polish=1,visual=1,reward=1)), {'LOCAL_HARNESS_TERM':'1'}),
    ]:
        provision()
        marker=Path('/tmp/judge-entered');marker.unlink(missing_ok=True)
        if missing_seed: (APP/'common_ground_seed.json').unlink()
        env=dict(os.environ,PATH=str(bin_dir)+':'+os.environ['PATH'],LOCAL_TEST_SCORES=content,**extra)
        result=subprocess.run(['bash','/tests/test.sh'],env=env,capture_output=True,text=True,timeout=130)
        assert result.returncode==0,(name,result.stderr)
        score=json.loads(Path('/logs/verifier/reward.json').read_text())
        assert score['reward']==0 and score['graded']==0 and score['no_op']==1,(name,score)
        if missing_seed: assert not marker.exists() and not (APP/'common_ground_seed.json').exists()
        results.append(dict(name=name,passed=True))
        print('PASS',name,flush=True)
    shutil.copyfile('/logs/verifier/prompt-provenance.json', OUT/'prompt-provenance.json')
    OUT.joinpath('harness-results.json').write_text(json.dumps({'type':'unit tests with an explicit local RewardKit test double; not an Oracle score','results':results},indent=2)+'\n')


def runtime():
    os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'
    from rewardkit.runner import discover
    results = []
    dimensions = {d.name: len(d.criteria) for d in discover('/tests')}
    assert dimensions == dict(render=1, constraints=2, functional=39, polish=8, visual=6), dimensions
    results.append(dict(name='RewardKit discovers all 56 criteria', passed=True))
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
    config=tomllib.loads(Path('/root/.codex/config.toml').read_text())
    assert config['model_reasoning_effort']=='max' and 'model_provider' not in config
    version=subprocess.check_output(['codex','--version'],text=True).strip()
    assert '0.151.0' in version,version
    results.append(dict(name='Central max effort and pinned Codex load without a provider override',passed=True))
    OUT.joinpath('runtime-results.json').write_text(json.dumps(dict(results=results,dimensions=dimensions,dependencies=deps,codex=version),indent=2)+'\n')
    print(json.dumps(results))


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('mode',choices=['browser','harness','runtime','gate','session','mcp','qc','polish','roles'])
    args=parser.parse_args()
    OUT.mkdir(exist_ok=True)
    if args.mode=='browser':
        browser()
    elif args.mode=='qc':
        subprocess.run(['python3','/validation/qc-score-regression.py'],check=True)
    elif args.mode=='roles':
        browser(script='role-matrix.cjs')
    elif args.mode=='polish':
        browser(script='polish-regression.cjs')
    elif args.mode=='mcp':
        browser(script='mcp-crosscheck.cjs')
    elif args.mode=='session':
        browser(session_only=True)
    elif args.mode=='gate':
        browser(gate_only=True)
    elif args.mode=='harness':
        harness()
    else:
        runtime()
