from pathlib import Path
import json, subprocess, uuid

root = Path(__file__).resolve().parents[4]
frozen = root / '.qc-cache/coldwater-editor-2026-10-02-r3/task/tests'
name = 'cw-r3-row21-' + uuid.uuid4().hex[:8]
image = 'sha256:f1bc0d7761559fb1b1e1126226ed3f37cce476beaf9103016124a60af019637a'
log = Path(__file__).with_suffix('.log')
records = []

def run(args):
    p = subprocess.run(args, capture_output=True, text=True, timeout=90)
    records.append({'command': args, 'returncode': p.returncode, 'stdout': p.stdout, 'stderr': p.stderr})
    if p.returncode: raise RuntimeError(p.stderr)
    return p.stdout

stub = '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
suite = Path(sys.argv[-1]).name
out = Path(sys.argv[sys.argv.index('--output') + 1])
mode = os.environ['STUB_MODE']
with open('/logs/verifier/stub-calls.txt', 'a') as f: f.write(suite + '\\n')
if mode == suite + '_error': sys.exit(7)
if suite == 'gates':
 data = {'render': 1.0, 'constraints': 0.0 if mode == 'gate_failure' else 1.0}
else:
 data = {'functional': .8, 'polish': .5, 'visual': .25}
if mode == 'malformed_gates' and suite == 'gates': data = {'render': 1.0}
out.write_text(json.dumps(data))
'''
app = '''const http = require('http');
console.log(JSON.stringify({uid:process.getuid(), port:process.env.PORT, db:process.env.DB_PATH, secret:process.env.ROW21_SECRET || null}));
http.createServer((req,res)=>{res.end('row21 fixture');}).listen(Number(process.env.PORT));
'''

try:
    run(['docker','run','-d','--name',name,'--network','none','--mount',f'type=bind,source={frozen},target=/frozen-tests,readonly',image,'sleep','infinity'])
    run(['docker','exec',name,'python3','-c',"import shutil,pathlib;shutil.copytree('/frozen-tests','/tests',dirs_exist_ok=True);pathlib.Path('/app').mkdir(exist_ok=True);pathlib.Path('/usr/local/bin/rewardkit').write_text("+repr(stub)+");pathlib.Path('/usr/local/bin/rewardkit').chmod(0o755)"])
    run(['docker','exec',name,'bash','-n','/tests/test.sh'])
    for mode in ['missing_env','missing_app','symlink_escape','gates_error','gate_failure','malformed_gates','scored_error','success']:
        setup = "import pathlib,shutil;shutil.rmtree('/logs/verifier',ignore_errors=True);pathlib.Path('/app/server.js').unlink(missing_ok=True);pathlib.Path('/app/escape').unlink(missing_ok=True);"
        if mode != 'missing_app': setup += "pathlib.Path('/app/server.js').write_text("+repr(app)+");"
        if mode == 'symlink_escape': setup += "pathlib.Path('/app/escape').symlink_to('/tests/tools/score.py');"
        run(['docker','exec',name,'python3','-c',setup])
        cmd = ['docker','exec','-e',f'STUB_MODE={mode}','-e','ROW21_SECRET=must-not-reach-app']
        if mode != 'missing_env':cmd += ['-e','REWARDKIT_JUDGE=fixture','-e','REWARDKIT_MODEL=fixture']
        run(cmd+[name,'bash','/tests/test.sh'])
        result = run(['docker','exec',name,'python3','-c',"import pathlib,json;p=pathlib.Path('/logs/verifier');print(json.dumps({'reward':json.loads((p/'reward.json').read_text()),'reward_txt':(p/'reward.txt').read_text(),'calls':(p/'stub-calls.txt').read_text() if (p/'stub-calls.txt').exists() else '', 'app_log':(p/'app.log').read_text() if (p/'app.log').exists() else ''}))"])
        print(mode, result.strip())
        records.append({'mode':mode,'result':json.loads(result)})
        observed = json.loads(result)
        expected_calls = '' if mode in ['missing_env','missing_app','symlink_escape'] else 'gates\nscored\n' if mode in ['scored_error','success'] else 'gates\n'
        assert observed['calls'] == expected_calls, (mode,observed)
        assert observed['reward']['reward'] == (.63 if mode == 'success' else 0), (mode,observed)
        if observed['app_log']:
            runtime = json.loads(observed['app_log'])
            assert runtime == {'uid':65534,'port':'3000','db':'/app/app.db','secret':None}, runtime
finally:
    subprocess.run(['docker','rm','-f',name], capture_output=True, text=True)
    log.write_text(json.dumps({'scope':'Isolated no-provider fixture of frozen test.sh orchestration; fake RewardKit, not configured judge grading.', 'image':image, 'records':records},indent=2)+'\n',encoding='utf-8')
