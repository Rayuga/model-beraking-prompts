import json,selectors,subprocess,time
from pathlib import Path
out=Path('/work')
command=['playwright-mcp','--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox']
stderr=(out/'mcp-stderr.log').open('w',encoding='utf-8')
process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=stderr,text=True,bufsize=1)
selector=selectors.DefaultSelector();selector.register(process.stdout,selectors.EVENT_READ)
def call(number,method,params):
 process.stdin.write(json.dumps({'jsonrpc':'2.0','id':number,'method':method,'params':params})+'\n');process.stdin.flush()
 deadline=time.monotonic()+180
 while time.monotonic()<deadline:
  assert selector.select(timeout=max(0,deadline-time.monotonic())),'MCP response timed out'
  line=process.stdout.readline();assert line,'MCP ended';message=json.loads(line)
  if message.get('id')==number:
   assert 'error' not in message,message
   return message['result']
 raise AssertionError('MCP response timed out')
report={'started_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'command':command,'scope':'Fresh continuous boundary flow through installed MCP; no LLM or hosted Oracle.'}
try:
 initialized=call(1,'initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'ridgeline-second-golden-crosscheck','version':'1'}})
 process.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n');process.stdin.flush()
 names=[t['name'] for t in call(2,'tools/list',{})['tools']];assert 'browser_run_code_unsafe' in names
 call(3,'tools/call',{'name':'browser_navigate','arguments':{'url':'http://localhost:3000'}})
 code=(out/'boundary-flow.js').read_text(encoding='utf-8')
 code=code.replace('__SEED_JSON__',Path('/solution/app/seed_data.json').read_text(encoding='utf-8'))
 result=call(4,'tools/call',{'name':'browser_run_code_unsafe','arguments':{'code':code}})
 report['probe']=result
 assert not result.get('isError'),result
 content='\n'.join(x.get('text','') for x in result.get('content',[]))
 marker='### Result\n';assert marker in content,content
 raw=content.split(marker,1)[1].split('\n###',1)[0].strip()
 observations=json.loads(raw)
 (out/'boundary-observations.json').write_text(json.dumps(observations,indent=2)+'\n',encoding='utf-8')
 assert observations.get('passed'),observations
 call(5,'tools/call',{'name':'browser_close','arguments':{}})
 report.update(passed=True,server=initialized['serverInfo'],tool='browser_run_code_unsafe')
except Exception as e:
 report.update(passed=False,error=str(e));raise
finally:
 report['finished_at']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
 (out/'boundary-mcp-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
 process.terminate();process.wait(timeout=10);stderr.close()
 print(json.dumps({k:report.get(k) for k in ['passed','server','tool','error']},indent=2),flush=True)
