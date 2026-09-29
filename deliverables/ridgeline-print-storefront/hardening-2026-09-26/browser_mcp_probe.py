import json
import selectors
import subprocess
import time

p=subprocess.Popen(['playwright-mcp','--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
selector=selectors.DefaultSelector()
selector.register(p.stdout,selectors.EVENT_READ)
def call(i,method,params):
    p.stdin.write(json.dumps({'jsonrpc':'2.0','id':i,'method':method,'params':params})+'\n');p.stdin.flush()
    deadline=time.monotonic()+50
    while time.monotonic()<deadline:
        assert selector.select(timeout=max(0,deadline-time.monotonic())),'MCP response timed out'
        line=p.stdout.readline()
        assert line,'MCP process ended'
        message=json.loads(line)
        if message.get('id')==i:
            assert 'error' not in message,message
            assert not message.get('result',{}).get('isError'),message
            return message['result']
    raise AssertionError('MCP timeout')

try:
    initialized=call(1,'initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'local-qc','version':'1'}})
    p.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n');p.stdin.flush()
    listing=call(2,'tools/list',{})
    tools=[x['name'] for x in listing['tools']]
    print(json.dumps({'available_tools':tools}),flush=True)
    call(3,'tools/call',{'name':'browser_navigate','arguments':{'url':'http://localhost:3000'}})
    check=call(4,'tools/call',{'name':'browser_run_code_unsafe','arguments':{'code':'''async (page) => {
      await page.getByRole('heading', { name: 'Find your print' }).waitFor();
      const count = await page.locator('.print-card').count();
      if (count !== 8) throw new Error('Expected eight prints, got ' + count);
      await page.setViewportSize({width:390,height:844});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw new Error('Mobile overflow');
      let intercepted = false;
      await page.route('**/api/health', async route => { intercepted = true; await route.continue(); });
      const health = await page.evaluate(async () => { const r = await fetch('/api/health'); return { status:r.status, body:await r.json() }; });
      await page.unroute('**/api/health');
      if (!intercepted || health.status !== 200) throw new Error('Browser request interception failed');
      return {cards:count, mobileOverflow:overflow, intercepted, health, browser:await page.evaluate(() => navigator.userAgent)};
    }'''}})
    call(5,'tools/call',{'name':'browser_close','arguments':{}})
    print(json.dumps({'passed':True,'server':initialized['serverInfo'],'tools':tools,'browser_probe':check,'paid_judge_exercised':False},indent=2))
finally:
    p.terminate()
    p.wait(timeout=10)
