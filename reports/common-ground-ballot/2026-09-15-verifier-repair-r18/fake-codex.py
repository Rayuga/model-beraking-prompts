import json, os, signal, sys, time
from pathlib import Path

args = sys.argv[1:]
if args == ['--version']:
    print('fake-codex-version')
    raise SystemExit(0)
assert args[0] == 'exec' and args.count('--json') == 1
output = None
for i, arg in enumerate(args):
    if arg in ('-o', '--output-last-message'): output = Path(args[i + 1])
    elif arg.startswith('--output-last-message='): output = Path(arg.split('=', 1)[1])
assert output is not None
thread = '12345678-1234-1234-1234-123456789abc'
secret = os.environ['LOCAL_TEST_SECRET']
print(json.dumps({'type':'thread.started','thread_id':thread}), flush=True)
print(json.dumps({'type':'item.completed','item':{'text':'private '+secret}}), flush=True)
print(json.dumps({'type':'item.completed','item':{'authorization':'Bearer '+secret,'cookie':'sid='+secret}}), flush=True)
print('diagnostic '+secret, file=sys.stderr, flush=True)
session = Path(os.environ['CODEX_HOME']) / 'sessions'
session.mkdir(parents=True, exist_ok=True)
(session / ('rollout-'+thread+'.jsonl')).write_text(json.dumps({'type':'test','secret':secret})+'\n')
(Path(os.environ['CODEX_HOME']) / 'auth.json').write_text('DO-NOT-EXPORT-AUTH-FILE')
mode = os.environ.get('LOCAL_TRACE_MODE','success')
if mode == 'signal':
    while True: time.sleep(.05)
if mode != 'missing':
    output.write_text(json.dumps({'check':{'score':'yes','reasoning':'Observed behavior.'}}))
raise SystemExit(7 if mode == 'failed' else 0)
