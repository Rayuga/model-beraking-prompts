import json,subprocess,select,time,hashlib
from pathlib import Path

out=Path('/evidence')
err=(out/'tooling-smoke-stderr.log').open('w')
command=['playwright-mcp','--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox']
p=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True,bufsize=1)
trace=[]
def request(n,method,params):
 message={'jsonrpc':'2.0','id':n,'method':method,'params':params}
 p.stdin.write(json.dumps(message)+'\n');p.stdin.flush()
 until=time.monotonic()+35
 while time.monotonic()<until:
  if not select.select([p.stdout],[],[],1)[0]:continue
  line=p.stdout.readline()
  if not line:raise RuntimeError('MCP exited')
  data=json.loads(line)
  if data.get('id')==n:
   trace.append({'request':message,'response':data})
   return data
 raise TimeoutError(method)
result={'command':command,'paid_provider':False,'app_or_score_claimed':False}
try:
 request(1,'initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'round2-qc','version':'1'}})
 p.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n');p.stdin.flush()
 listing=request(2,'tools/list',{})
 names=[t['name'] for t in listing['result']['tools']]
 assert 'browser_run_code_unsafe' in names
 code="""async (page) => {
 const clean=await page.context().browser().newContext();
 try { const fresh=await clean.newPage();
 const url='https://round2-tooling.invalid/probe';let delivered=0;
 const handler=async route=>{delivered++;await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'text/plain'},body:'route-control-ok'});};
 await clean.route(url,handler);
 const content=await fresh.evaluate(async url=>(await fetch(url)).text(),url);
 await clean.unroute(url,handler);
 return {independentContext:clean!==page.context(),delivered,content};
 } finally {await clean.close();await page.bringToFront();}
}"""
 response=request(3,'tools/call',{'name':'browser_run_code_unsafe','arguments':{'code':code}})
 assert not response.get('error') and not response['result'].get('isError'),response
 text=json.dumps(response['result'])
 assert 'route-control-ok' in text and 'independentContext' in text
 result.update(passed=True,tools=names)
except Exception as e:
 result.update(passed=False,error=str(e))
finally:
 p.terminate()
 try:p.wait(timeout=5)
 except subprocess.TimeoutExpired:p.kill();p.wait()
 err.close();result['trace']=trace
 (out/'tooling-smoke.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({k:v for k,v in result.items() if k not in ['trace','tools']}))
