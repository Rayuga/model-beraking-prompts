"""Offline controls for extracted source in an isolated Linux container, no judge calls."""
from pathlib import Path
import hashlib
import json
import os
import shlex
import shutil
import signal
import subprocess
import threading
import time
import urllib.request

INPUT = Path('/proposal')
OUT = Path('/evidence')
WORK = Path('/tmp/harness-proposal-controls')
WORK.mkdir()
OUT.mkdir(exist_ok=True)
results = []
sources = {v: (INPUT / (v+'-test.sh')).read_text() for v in ['original', 'proposed']}

def write(path, text):
    path.write_text(text)
    return path

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def base_functions(text):
    return text[text.index('write_zero_reward() {'):text.index('probe_ready() {')]

def helper(text, work, server):
    # Execute the actual helper-generation segment, including declare -f serialization.
    fragment = text[text.index('cat > "$LOG_DIR/app-restart.sh"'):text.index('\npython3 - <<\'PY\'\nfrom pathlib import Path')]
    script = '#!/bin/bash\nset -euo pipefail\n'+base_functions(text)
    script += text[text.index('probe_ready() {'):text.index('write_zero_reward\ntrap cleanup EXIT')]
    script += '\n'.join(k+'='+shlex.quote(str(v)) for k, v in {'LOG_DIR':work, 'APP_COPY':work, 'APP_ENTRY':server, 'APP_DB':work/'app.db'}.items())+'\n'+fragment
    path = write(work/'generate-helper.sh', script)
    subprocess.run(['bash', str(path)], check=True, capture_output=True, text=True, timeout=5)
    return work/'app-restart.sh'

def http(path='/'):
    with urllib.request.urlopen('http://127.0.0.1:3000'+path, timeout=1) as response:
        return json.load(response)

def ready():
    for _ in range(100):
        try:
            return http()
        except Exception:
            time.sleep(.05)
    raise RuntimeError('Fixture not listening')

def kill_group(pid):
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass

fixture = '''const http=require('node:http'),fs=require('node:fs');
let memory='empty';
__SIGNAL__
http.createServer((q,s)=>{if(q.url==='/set')memory='volatile-marker';s.end(JSON.stringify({pid:process.pid,memory,durable:fs.readFileSync(__DATA__,'utf8')}));}).listen(3000,'0.0.0.0');
'''

for variant, text in sources.items():
    check = subprocess.run(['bash', '-n', str(INPUT/(variant+'-test.sh'))], capture_output=True, text=True, timeout=5)
    results.append({'kind':'parse','variant':variant,'exit_code':check.returncode,'stderr':check.stderr,'pass':check.returncode == 0})
    for case in ['normal', 'term_ignored', 'unrelated_listener']:
        work = WORK/(variant+'-'+case)
        work.mkdir(); work.chmod(0o777)
        data = write(work/'durable.txt', 'durable-marker'); data.chmod(0o644)
        source = write(work/'server.js', fixture.replace('__SIGNAL__', "process.on('SIGTERM',()=>{});" if case == 'term_ignored' else '').replace('__DATA__',json.dumps(str(data))))
        source.chmod(0o644)
        stream = open(work/'fixture.log','w')
        old = subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(source)], start_new_session=True,stdout=stream,stderr=subprocess.STDOUT)
        reaper = threading.Thread(target=old.wait, daemon=True); reaper.start()
        new_pid = None
        start = time.monotonic()
        try:
            before = ready(); http('/set')
            write(work/'app.pid', str(old.pid if case != 'unrelated_listener' else 999999))
            if case == 'unrelated_listener':
                # The prospective replacement remains alive briefly but owns no listener.
                write(source, "setTimeout(()=>process.exit(23), 1200);\n")
            script = helper(text,work,source)
            generated_sha = sha(script)
            run = subprocess.run(['bash',str(script)],capture_output=True,text=True,timeout=15)
            new_pid = int((work/'app.pid').read_text())
            time.sleep(.2)
            after = http()
            old_alive = old.poll() is None
            expected = (run.returncode != 0) if case == 'unrelated_listener' else (run.returncode == 0 and not old_alive and after['pid'] == new_pid and after['memory']=='empty' and after['durable']=='durable-marker')
            result = {'kind':'restart','variant':variant,'case':case,'command':['bash',str(script)], 'generated_helper_sha256':generated_sha,'exit_code':run.returncode,'stdout':run.stdout,'stderr':run.stderr,'elapsed_seconds':round(time.monotonic()-start,3),'old_pid':old.pid,'new_pid':new_pid,'old_alive':old_alive,'before':before,'after':after,'restart_log':(work/'app-restart.log').read_text(),'pass':expected}
        except Exception as exc:
            result = {'kind':'restart','variant':variant,'case':case,'error':str(exc),'pass':False}
        finally:
            if (work/'app.pid').exists():
                candidate = int((work/'app.pid').read_text())
                if candidate != 999999:
                    new_pid = candidate
            for pid in {old.pid,new_pid}-{None}:
                kill_group(pid)
            old.wait(timeout=3); stream.close()
        shutil.copytree(work, OUT/work.name)
        results.append(result)

    # The extracted cleanup must finish even while its own direct child ignores TERM.
    work = WORK/(variant+'-cleanup-term-ignored'); work.mkdir(); work.chmod(0o777)
    source=write(work/'server.js', "require('node:fs').writeFileSync("+json.dumps(str(work/'started'))+",String(process.pid)); process.on('SIGTERM',()=>{});setInterval(()=>{},1000);\n")
    source.chmod(0o644)
    zero=next(line for line in text.splitlines() if line.startswith('ZERO_REWARD_JSON='))
    script=write(work/'cleanup.sh','#!/bin/bash\nset -euo pipefail\nLOG_DIR='+shlex.quote(str(work))+'\n'+zero+'\nAPP_PID=""\n'+base_functions(text)+'''
write_zero_reward
setsid setpriv --reuid=65534 --regid=65534 --clear-groups node '''+shlex.quote(str(source))+''' >"$LOG_DIR/app.log" 2>&1 &
APP_PID=$!
printf '%s\\n' "$APP_PID" > "$LOG_DIR/app.pid"
for _ in $(seq 1 100); do [[ -f "$LOG_DIR/started" ]] && break; sleep 0.02; done
trap cleanup EXIT
exit 0
''')
    start=time.monotonic(); timed_out=False
    driver=subprocess.Popen(['bash',str(script)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
    try:
        stdout,stderr=driver.communicate(timeout=10)
    except subprocess.TimeoutExpired:
        timed_out=True;kill_group(driver.pid);stdout,stderr=driver.communicate(timeout=3)
    pid=int((work/'app.pid').read_text())
    try:
        state=Path(f'/proc/{pid}/stat').read_text().rsplit(')',1)[1].split()[0]
        live=state not in ['Z','X']
    except FileNotFoundError:
        live=False
    kill_group(pid)
    result={'kind':'cleanup','variant':variant,'case':'direct-child-term-ignored','command':['bash',str(script)],'exit_code':driver.returncode,'timed_out':timed_out,'elapsed_seconds':round(time.monotonic()-start,3),'stdout':stdout,'stderr':stderr,'child_alive_at_completion':live,'reward':json.loads((work/'reward.json').read_text()),'pass':not timed_out and not live and driver.returncode==0}
    shutil.copytree(work, OUT/work.name);results.append(result)

    # Suite outputs/statuses are simulated; use the unchanged real scorer/policy.
    cases=[('scored_timeout',0,124,1,1,.5,1,1),('scored_error',0,2,1,1,.5,1,1),('gate_timeout',124,0,1,1,.5,1,1),('gate_product_failure',0,0,0,1,.5,1,1),('successful_grade',0,0,1,1,.5,1,1),('malformed_scored',0,0,1,1,'bad',1,1)]
    for name,gate_exit,score_exit,render,constraints,functional,polish,visual in cases:
        work=WORK/(variant+'-'+name);work.mkdir()
        scorer=work/'tools';scorer.mkdir()
        shutil.copyfile(INPUT/'score.py',scorer/'score.py');shutil.copyfile(INPUT/'scoring.toml',work/'scoring.toml')
        log=work/'logs';log.mkdir()
        tail=text[text.index('rm -rf "$LOG_DIR/scored"\nif ! run_suite gates 1500;'):].replace('/tests/tools/score.py',shlex.quote(str(scorer/'score.py')))
        funcs=text[text.index('write_zero_reward() {'):text.index('current_app_pid() {')]
        gates=json.dumps({'render':render,'constraints':constraints});scored=json.dumps({'functional':functional,'polish':polish,'visual':visual})
        script=write(work/'suite.sh','set -euo pipefail\nLOG_DIR='+shlex.quote(str(log))+'\n'+zero+'\n'+funcs+'''
write_zero_reward
trap ensure_reward EXIT
run_suite() {
  mkdir -p "$LOG_DIR/$1"
  printf 'diagnostic-%s\\n' "$1" > "$LOG_DIR/$1/rewardkit.log"
  if [[ "$1" == gates ]]; then
    printf '%s\\n' '''+shlex.quote(gates)+''' > "$LOG_DIR/gates/reward.json"
    return '''+str(gate_exit)+'''
  else
    printf '%s\\n' '''+shlex.quote(scored)+''' > "$LOG_DIR/scored/reward.json"
    return '''+str(score_exit)+'''
  fi
}
'''+tail)
        run=subprocess.run(['bash',str(script)],capture_output=True,text=True,timeout=5)
        reward=json.loads((log/'reward.json').read_text())
        scored_called=(log/'scored/rewardkit.log').exists()
        wanted_graded=int(name in ['successful_grade','gate_product_failure'])
        preserved=(log/'gates/rewardkit.log').read_text()=='diagnostic-gates\n' and (not scored_called or ((log/'scored/rewardkit.log').read_text()=='diagnostic-scored\n' and json.loads((log/'scored/reward.json').read_text())==json.loads(scored)))
        success=run.returncode==0 and reward['graded']==wanted_graded and reward['no_op']==1-wanted_graded and reward['reward']==(.7 if name=='successful_grade' else 0) and preserved and scored_called==(name not in ['gate_product_failure','gate_timeout'])
        results.append({'kind':'suite','variant':variant,'case':name,'command':['bash',str(script)],'exit_code':run.returncode,'stdout':run.stdout,'stderr':run.stderr,'reward':reward,'scored_called':scored_called,'diagnostics_preserved':preserved,'pass':success})
        shutil.copytree(work,OUT/work.name)

output={'scope':'Extracted helper-generation/restart and cleanup controls with synthetic Node fixtures; extracted suite tail with actual unchanged scorer and synthetic suite status/data. No configured judge, real task, provider, host port or external network.', 'source_sha256':{v:sha(INPUT/(v+'-test.sh')) for v in sources},'results':results,'all_proposed_controls_pass':all(r['pass'] for r in results if r['variant']=='proposed')}
write(OUT/'results.json',json.dumps(output,indent=2)+'\n')
print(json.dumps({'all_proposed_controls_pass':output['all_proposed_controls_pass'],'results':[{k:r.get(k) for k in ['kind','variant','case','pass','elapsed_seconds','exit_code','error']} for r in results]},indent=2))
raise SystemExit(0 if output['all_proposed_controls_pass'] else 1)
