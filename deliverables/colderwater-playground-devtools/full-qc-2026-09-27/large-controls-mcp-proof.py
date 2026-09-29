import json,selectors,subprocess,time
from pathlib import Path
root=Path('/evidence')
err=(root/'large-controls-mcp-stderr.log').open('w',encoding='utf-8')
command=['playwright-mcp','--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox']
process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True,bufsize=1)
selector=selectors.DefaultSelector();selector.register(process.stdout,selectors.EVENT_READ)
def call(i,method,params):
 process.stdin.write(json.dumps({'jsonrpc':'2.0','id':i,'method':method,'params':params})+'\n');process.stdin.flush()
 end=time.monotonic()+100
 while time.monotonic()<end:
  assert selector.select(max(0,end-time.monotonic())),'MCP timeout'
  line=process.stdout.readline();assert line,'MCP ended'
  reply=json.loads(line)
  if reply.get('id')==i:
   assert 'error' not in reply,reply
   assert not reply.get('result',{}).get('isError'),reply
   return reply['result']
 raise AssertionError('timeout')
report={'started_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'command':command,'paid_provider':False}
try:
 report['server']=call(1,'initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'colderwater-full-qc','version':'1'}})
 process.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n');process.stdin.flush()
 report['tool']=next(t for t in call(2,'tools/list',{})['tools'] if t['name']=='browser_run_code_unsafe')
 call(3,'tools/call',{'name':'browser_navigate','arguments':{'url':'http://localhost:3000'}})
 code=(root/'large-controls-mcp-probe.js').read_text().replace('/* CLASSIFIER */',(root/'exposure-classifier.js').read_text())
 report['probe']=call(4,'tools/call',{'name':'browser_run_code_unsafe','arguments':{'code':code}})
 report['snapshot_after_cleanup']=call(5,'tools/call',{'name':'browser_snapshot','arguments':{}})
 call(6,'tools/call',{'name':'browser_close','arguments':{}})
 report['passed']=True
except Exception as error:
 report['passed']=False;report['error']=str(error);raise
finally:
 report['finished_at']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
 (root/'large-controls-mcp-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
 process.terminate();process.wait(timeout=10);err.close();print(json.dumps({'passed':report.get('passed'),'error':report.get('error')},indent=2),flush=True)
