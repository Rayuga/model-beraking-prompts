"""Exact installed MCP route/control capability proof against our permissive mock."""
import json
from pathlib import Path
import selectors
import subprocess
import time

out = Path('/evidence/network_probe_mcp_runtime.json')
process = subprocess.Popen(['playwright-mcp','--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
selector = selectors.DefaultSelector()
selector.register(process.stdout,selectors.EVENT_READ)

def call(number, method, params):
    process.stdin.write(json.dumps({'jsonrpc':'2.0','id':number,'method':method,'params':params})+'\n')
    process.stdin.flush()
    deadline=time.monotonic()+50
    while time.monotonic()<deadline:
        assert selector.select(timeout=max(0,deadline-time.monotonic())), 'MCP response timeout'
        line=process.stdout.readline()
        assert line, 'MCP process ended'
        message=json.loads(line)
        if message.get('id')==number:
            assert 'error' not in message, message
            assert not message.get('result',{}).get('isError'), message
            return message['result']
    raise AssertionError('MCP response timeout')

report={'scope':'Actual pinned MCP/Chromium capability and negative network witness. No paid judge, no internet, no golden/database touched.'}
try:
    initialized=call(1,'initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'independent-network-qc','version':'1'}})
    process.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n');process.stdin.flush()
    names=[t['name'] for t in call(2,'tools/list',{})['tools']]
    assert 'browser_run_code_unsafe' in names
    call(3,'tools/call',{'name':'browser_navigate','arguments':{'url':'http://localhost:3000/'}})
    result=call(4,'tools/call',{'name':'browser_run_code_unsafe','arguments':{'code':r'''async (page) => {
      const context=page.context();
      const marker='route-control-'+Date.now();
      const fetchURL='https://cw-qc-network.invalid/'+marker+'/fetch.txt';
      const imageURL='https://cw-qc-network.invalid/'+marker+'/image.svg';
      const pattern='https://cw-qc-network.invalid/**';
      const delivered=[];
      const handler=async route=>{
        delivered.push({url:route.request().url(),method:route.request().method()});
        const isImage=route.request().url()===imageURL;
        await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','cache-control':'no-store'},contentType:isImage?'image/svg+xml':'text/plain',body:isImage?'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="green"/></svg>':marker});
      };
      await context.route(pattern,handler);
      const control=await context.newPage();
      let observations;
      try {
        const positive=await control.evaluate(async ({fetchURL,imageURL})=>{
          const response=await fetch(fetchURL);const body=await response.text();
          const width=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth);image.onerror=()=>reject(new Error('Control image failed'));image.src=imageURL;});
          return {status:response.status,body,width};
        },{fetchURL,imageURL});
        if(positive.status!==200||positive.body!==marker||positive.width!==2||delivered.length!==2)throw new Error('Unprotected control did not establish both resources');
        const baseline=delivered.length;
        await page.getByRole('textbox',{name:'Source code'}).fill("document.body.textContent='network-good-control'; console.log('network-good-control');");
        await page.getByRole('button',{name:'Run',exact:true}).click();
        await page.frameLocator('#preview').getByText('network-good-control',{exact:true}).waitFor();
        const source="document.body.textContent='network-attempt-started'; console.log('network-attempt-started'); fetch("+JSON.stringify(fetchURL)+").then(r=>r.text()).then(t=>console.log('fetch-delivered '+t)).catch(()=>console.log('fetch-refused')); const image=new Image(); image.onload=()=>console.log('image-delivered'); image.onerror=()=>console.log('image-refused'); image.src="+JSON.stringify(imageURL)+"; document.body.appendChild(image);";
        await page.getByRole('textbox',{name:'Source code'}).fill(source);
        await page.getByRole('button',{name:'Run',exact:true}).click();
        await page.locator('#console').filter({hasText:'fetch-delivered '+marker}).waitFor();
        await page.locator('#console').filter({hasText:'image-delivered'}).waitFor();
        const previewDeliveries=delivered.slice(baseline);
        if(previewDeliveries.length!==2||!previewDeliveries.some(r=>r.url===fetchURL)||!previewDeliveries.some(r=>r.url===imageURL))throw new Error('Permissive mock should deliver both requests');
        await page.getByRole('textbox',{name:'Source code'}).fill("document.body.textContent='network-recovered'; console.log('network-recovered');");
        await page.getByRole('button',{name:'Run',exact:true}).click();
        await page.frameLocator('#preview').getByText('network-recovered',{exact:true}).waitFor();
        observations={unprotectedControl:positive,controlDeliveries:delivered.slice(0,baseline),previewDeliveries,recovery:true,newNetworkCriterionSatisfied:false,actualMcpCapabilityProved:true,browser:await page.evaluate(()=>navigator.userAgent)};
      } finally { await control.close(); await context.unroute(pattern,handler); }
      return observations;
    }'''}})
    call(5,'tools/call',{'name':'browser_close','arguments':{}})
    report.update(passed=True,server=initialized['serverInfo'],tool='browser_run_code_unsafe',probe=result)
except Exception as error:
    report.update(passed=False,error=str(error))
    raise
finally:
    out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    process.terminate();process.wait(timeout=10)
    print(json.dumps(report,indent=2),flush=True)
