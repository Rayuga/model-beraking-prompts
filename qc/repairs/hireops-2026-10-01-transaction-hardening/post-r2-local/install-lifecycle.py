"""Golden install/reinstall and actual shared restart MCP; no LLM invocation."""
import hashlib,json,os,signal,subprocess,time,urllib.request
from pathlib import Path
out=Path('/evidence/install-lifecycle');out.mkdir(exist_ok=True)
def run(args,**kw):return subprocess.run(args,text=True,capture_output=True,timeout=40,**kw)
def api(url,body=None,cookie=None):
    h={'Content-Type':'application/json'}
    if cookie:h['Cookie']=cookie
    r=urllib.request.urlopen(urllib.request.Request('http://localhost:3000'+url,data=None if body is None else json.dumps(body).encode(),headers=h),timeout=5)
    return json.load(r),r.headers
def login():
    _,h=api('/api/auth/login',{'email':'rafael.costa@hireops.example','password':'Hireops!2026'})
    return h['Set-Cookie'].split(';')[0]
def wait():
    for _ in range(100):
        try:api('/api/health');return
        except Exception:time.sleep(.1)
    raise RuntimeError('not ready')
def start(log):
    return subprocess.Popen(['env','-i','PATH=/usr/local/bin:/usr/bin:/bin','NODE_PATH=/usr/local/lib/node_modules','HOME=/app','PORT=3000','DB_PATH=/app/app.db','setpriv','--reuid=65534','--regid=65534','--clear-groups','node','/app/server.js'],cwd='/tests',start_new_session=True,stdout=log,stderr=subprocess.STDOUT)
def kill(pid):
    try:os.killpg(pid,signal.SIGTERM)
    except ProcessLookupError:pass
results=[]; log=(out/'app.log').open('w'); proc=None;new_pid=None
try:
    x=run(['bash','/solution/solve.sh']);assert x.returncode==0,x.stderr
    results.append({'name':'fresh solve installs','exit':x.returncode})
    original={p.relative_to('/solution/app').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/solution/app').rglob('*') if p.is_file()}
    assert all(hashlib.sha256((Path('/app')/p).read_bytes()).hexdigest()==h for p,h in original.items())
    run(['chown','-R','65534:65534','/app'])
    proc=start(log);wait();cookie=login()
    before,_=api('/api/bootstrap',cookie=cookie)
    assert len(before['requisitions'])==7 and len(before['offers'])==13
    api('/api/requisitions',{'id':'lifecycle-new-req','title':'Local lifecycle','dept':'Engineering','budget_cents':100000},cookie)
    x=run(['bash','/solution/solve.sh']);assert x.returncode!=0,x
    saved,_=api('/api/requisitions/lifecycle-new-req',cookie=cookie);assert saved['title']=='Local lifecycle'
    results.append({'name':'active reinstall refused without losing saved record','exit':x.returncode,'stderr':x.stderr})
    case=out/'restart';case.mkdir(exist_ok=True);(case/'app.pid').write_text(str(proc.pid))
    helper=Path('/tests/test.sh').read_text().split('<<\'SH\'\n',1)[1].split('\nSH\n',1)[0]
    for token,value in [('__LOG_DIR__',str(case)),('__APP_COPY__','/app'),('__APP_DB__','/app/app.db'),('__APP_ENTRY__','/app/server.js')]:helper=helper.replace(token,value)
    hp=case/'app-restart.sh';hp.write_text(helper+'\n')
    req=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':'restart_app','arguments':{}}})+'\n'
    x=run(['python3','/tests/tools/restart_mcp.py',str(hp)],input=req)
    reply=json.loads(x.stdout);assert not reply['result']['isError'],reply
    new_pid=int((case/'app.pid').read_text());assert new_pid!=proc.pid
    proc.wait(timeout=5);cookie=login();after,_=api('/api/requisitions/lifecycle-new-req',cookie=cookie);assert after==saved
    results.append({'name':'actual MCP golden process replacement retains saved data','old_pid':proc.pid,'new_pid':new_pid,'reply':reply})
    x=run(['python3','/tests/tools/restart_mcp.py',str(hp)],input=req);assert json.loads(x.stdout)['result']['isError']
    results.append({'name':'actual MCP single-use refusal','reply':json.loads(x.stdout)})
    kill(new_pid);time.sleep(.5);new_pid=None
    x=run(['bash','/solution/solve.sh']);assert x.returncode==0,x.stderr
    run(['chown','-R','65534:65534','/app']);proc=start(log);wait();cookie=login();reset,_=api('/api/bootstrap',cookie=cookie)
    assert len(reset['requisitions'])==7 and len(reset['offers'])==13
    results.append({'name':'closed-workspace reinstall restores exact seed counts','requisitions':7,'offers':13})
    record={'scope':'Actual Linux golden installer, unprivileged sanitized launch from /tests, shared MCP normal restart. No configured judge score.', 'solution_app_sha256':original,'results':results}
    (out/'results.json').write_text(json.dumps(record,indent=2));print(json.dumps(record,indent=2))
finally:
    if new_pid:kill(new_pid)
    if proc and proc.poll() is None:kill(proc.pid);proc.wait(timeout=5)
    log.close()
