"""Bounded isolated counterexample against the unchanged canonical restart helper."""
from pathlib import Path
import hashlib,json,os,signal,subprocess,time,urllib.request
task=Path('/task');out=Path('/evidence');work=Path('/tmp/cw-restart-counterexample')
work.mkdir();work.chmod(0o777)
source=work/'server.js'
source.write_text("const http=require('node:http');process.on('SIGTERM',()=>{});http.createServer((q,s)=>{s.setHeader('Content-Type','application/json');s.end(JSON.stringify({pid:process.pid}));}).listen(3000,'0.0.0.0');")
old=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(source)],start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
new_pid=None;report={'scope':'Isolated inherited restart counterexample, not golden app or Oracle','template_test_sha256':hashlib.sha256((task/'tests/test.sh').read_bytes()).hexdigest()}
def response():
 with urllib.request.urlopen('http://localhost:3000',timeout=2) as r:return json.load(r)
try:
 for _ in range(100):
  try:report['before']=response();break
  except Exception:time.sleep(.05)
 else:raise RuntimeError('Fixture listener unavailable')
 (work/'app.pid').write_text(str(old.pid))
 text=(task/'tests/test.sh').read_text()
 helper=text.split('cat > "$LOG_DIR/app-restart.sh" <<\'SH\'\n',1)[1].split('\nSH\n',1)[0]
 report['helper_original_sha256']=hashlib.sha256(helper.encode()).hexdigest()
 for key,value in {'__LOG_DIR__':str(work),'__APP_ENTRY__':str(source),'__APP_COPY__':str(work),'__APP_DB__':str(work/'app.db')}.items():helper=helper.replace(key,value)
 script=work/'restart.sh';script.write_text(helper+'\n');script.chmod(0o755)
 started=time.monotonic();result=subprocess.run(['bash',str(script)],capture_output=True,text=True,timeout=15)
 new_pid=int((work/'app.pid').read_text());time.sleep(.5)
 report.update(helper_returncode=result.returncode,helper_stdout=result.stdout,helper_stderr=result.stderr,elapsed_seconds=time.monotonic()-started,old_pid=old.pid,claimed_new_pid=new_pid,old_still_running=old.poll() is None,after=response(),restart_log=(work/'app-restart.log').read_text())
 report['counterexample_confirmed']=result.returncode==0 and report['old_still_running'] and report['after']['pid']==old.pid and 'EADDRINUSE' in report['restart_log']
except Exception as e:report['error']=str(e);report['counterexample_confirmed']=False
finally:
 for pid in {old.pid,new_pid}-{None}:
  try:os.killpg(pid,signal.SIGKILL)
  except ProcessLookupError:pass
 old.wait(timeout=5)
 (out/'inherited-restart-counterexample.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
