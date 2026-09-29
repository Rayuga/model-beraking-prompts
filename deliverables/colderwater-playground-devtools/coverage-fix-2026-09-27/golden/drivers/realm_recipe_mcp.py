import hashlib,json,os,re,selectors,shutil,signal,subprocess,time,urllib.request
from pathlib import Path

OUT=Path('/evidence');TASK=Path('/task');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
LOG=OUT/('run-realm-recipe-mcp-'+time.strftime('%Y%m%d-%H%M%S',time.gmtime()));LOG.mkdir()
manifest=OUT/'frozen_final_release_inputs.json';inputs=json.loads(manifest.read_text())
prompt_file=TASK/'tests/scored/functional/prompt.md';assert sha(prompt_file)==inputs['prompt_sha256']
for rel,digest in inputs['solution_files'].items():assert sha(TASK/'solution'/rel)==digest
prompt=prompt_file.read_text();blocks=re.findall(r'```javascript\n(.*?)\n```',prompt,re.S)
matched=[code for code in blocks if 'context.__cwAuthoredRealmProbe' in code];assert len(matched)==1
recipe=matched[0];(LOG/'exact_prompt_recipe.js').write_text(recipe)
APP=Path('/tmp/cw-realm-recipe-app');shutil.copytree(TASK/'solution/app',APP)
for p in [APP,*APP.rglob('*')]:os.chown(p,65534,65534);p.chmod(0o755 if p.is_dir() else 0o644)
command=['playwright-mcp','--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox']
report={'scope':'Exact final prompt authored-realm recipe through the actual installed Playwright MCP tool over stdio JSON-RPC','paid_provider':False,'platform_run':False,'network':'none','actual_mcp_tool_dispatch':True,'oracle_verdict':False,'archive_sha256':'f86708344b0861aad8a48049996c7b72266c29d6d68bf377358a0c5810aad6ae','prompt_sha256':sha(prompt_file),'recipe_sha256':hashlib.sha256(recipe.encode()).hexdigest(),'input_manifest_sha256':sha(manifest),'driver_sha256':sha(Path(__file__)),'solution_files':inputs['solution_files'],'mcp_command':command,'mcp_version':subprocess.check_output(['playwright-mcp','--version'],text=True).strip(),'chromium':subprocess.check_output(['/usr/local/bin/chromium','--version'],text=True).strip(),'steps':[],'started_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
app_log=(LOG/'app.log').open('w');mcp_log=(LOG/'mcp-stderr.log').open('w');start=time.monotonic();server=None;mcp=None
def call(method,params):
    global identifier
    identifier+=1;request={'jsonrpc':'2.0','id':identifier,'method':method,'params':params};sent=time.monotonic()
    mcp.stdin.write(json.dumps(request)+'\n');mcp.stdin.flush();deadline=time.monotonic()+35
    while time.monotonic()<deadline:
        assert selector.select(max(0,deadline-time.monotonic())),'MCP response timeout'
        line=mcp.stdout.readline();assert line,'MCP ended';reply=json.loads(line)
        if reply.get('id')==identifier:
            report['steps'].append({'request':request,'response':reply,'wall_seconds':time.monotonic()-sent})
            assert 'error' not in reply,reply;assert not reply.get('result',{}).get('isError'),reply
            return reply['result']
    raise AssertionError('MCP response timeout')
def run_code(code):
    result=call('tools/call',{'name':'browser_run_code_unsafe','arguments':{'code':code}})
    rendered='\n'.join(x.get('text','') for x in result['content']);assert '### Result\n' in rendered,rendered
    return json.loads(rendered.split('### Result\n',1)[1].split('\n### ',1)[0])
try:
    server=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(APP/'server.js')],cwd=APP,env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':str(APP),'DB_PATH':str(APP/'app.db'),'PORT':'3000'},start_new_session=True,stdout=app_log,stderr=subprocess.STDOUT)
    for _ in range(100):
        try:
            with urllib.request.urlopen('http://localhost:3000/api/health',timeout=1) as response:assert response.status==200
            break
        except Exception:time.sleep(.1)
    else:raise AssertionError('No disposable app health')
    mcp=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=mcp_log,text=True,bufsize=1,start_new_session=True);identifier=0
    selector=selectors.DefaultSelector();selector.register(mcp.stdout,selectors.EVENT_READ)
    report['initialize']=call('initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'colderwater-exact-authored-realm-recipe','version':'1'}})
    mcp.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n');mcp.stdin.flush()
    report['actual_tool']=next(t for t in call('tools/list',{})['tools'] if t['name']=='browser_run_code_unsafe')
    call('tools/call',{'name':'browser_navigate','arguments':{'url':'http://localhost:3000'}})
    html="<!doctype html><html><body><style>#dispatch-mark { background-color: rgb(1, 2, 3); }</style><h1 id=\"dispatch-mark\">html-dispatch-ok</h1><button id=\"dispatch-button\">Try handler</button><script>window.oldGlobal='do-not-carry'; console.log('html-once-marker'); document.getElementById('dispatch-button').addEventListener('click', () => console.log('dispatch-handler-marker'));</script></body></html>"
    setup="""async(page)=>{
      await page.getByRole('textbox',{name:'Code editor',exact:true}).waitFor();
      await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.startsWith('Complete'));
      await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();
      await page.getByRole('textbox',{name:'Filename',exact:true}).fill('dispatch.HTML');
      await page.getByRole('textbox',{name:'Code editor',exact:true}).click();await page.keyboard.press('Control+A');await page.keyboard.insertText(SOURCE);
      await page.getByRole('button',{name:/^Run(?:\\s|$)/}).click();await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.startsWith('Complete'));
      await page.frameLocator('iframe[title="Live preview"]').getByRole('button',{name:'Try handler',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[role="log"]')?.textContent.includes('dispatch-handler-marker'));
      await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.startsWith('Complete'));
      return {body:await page.frameLocator('iframe[title="Live preview"]').locator('body').innerText(),logs:await page.getByRole('log').innerText()};
    }""".replace('SOURCE',json.dumps(html))
    report['working_control']=run_code(setup);assert 'html-once-marker' in report['working_control']['logs'] and 'dispatch-handler-marker' in report['working_control']['logs']
    report['before_css_exact_recipe']=run_code(recipe)
    before=[r for r in report['before_css_exact_recipe'] if r.get('visible') and r.get('marker')=='html-dispatch-ok'];assert len(before)==1 and before[0]['assigned'] and not before[0]['absent'],before
    css_setup="""async(page)=>{
      await page.getByRole('textbox',{name:'Filename',exact:true}).fill('dispatch.CSS');
      await page.getByRole('textbox',{name:'Code editor',exact:true}).click();await page.keyboard.press('Control+A');await page.keyboard.insertText('#dispatch-mark { color: rgb(255, 0, 0); }');
      await page.getByRole('button',{name:/^Run(?:\\s|$)/}).click();await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.startsWith('Complete'));
      return await page.frameLocator('iframe[title="Live preview"]').locator('#dispatch-mark').evaluate(el=>({text:el.textContent,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
    }"""
    report['css_render']=run_code(css_setup);assert report['css_render']=={'text':'html-dispatch-ok','color':'rgb(255, 0, 0)','background':'rgb(1, 2, 3)'}
    report['during_css_exact_recipe']=run_code(recipe)
    after=[r for r in report['during_css_exact_recipe'] if r.get('visible') and r.get('marker')=='html-dispatch-ok'];assert len(after)==1 and after[0]['absent'] and not after[0]['assigned'],after
    report['positive_matched_realm']=before[0]['realm'];report['current_css_matched_realm']=after[0]['realm'];assert before[0]['realm']!=after[0]['realm']
    report['exact_recipe_same_source_twice']=all(step['request']['params']['arguments']['code']==recipe for step in report['steps'] if step['request']['method']=='tools/call' and step['request']['params'].get('name')=='browser_run_code_unsafe' and 'context.__cwAuthoredRealmProbe' in step['request']['params']['arguments'].get('code',''))
    assert sum(step['request']['method']=='tools/call' and step['request']['params'].get('name')=='browser_run_code_unsafe' and step['request']['params']['arguments'].get('code')==recipe for step in report['steps'])==2
    call('tools/call',{'name':'browser_snapshot','arguments':{}});call('tools/call',{'name':'browser_close','arguments':{}})
    report['passed']=True
except Exception as error:report['passed']=False;report['error']=str(error)
finally:
    for proc in [mcp,server]:
        if proc and proc.poll() is None:
            os.killpg(proc.pid,signal.SIGTERM)
            try:proc.wait(timeout=5)
            except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait(timeout=5)
    app_log.close();mcp_log.close();report['wall_seconds']=time.monotonic()-start;report['finished_at']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    report['limits']=['Only the exact supplied native-frame recipe and its working golden control were exercised.','No platform/provider/model call, full Functional judgement or virtual-realm alternative exercised.','The4earlier focused raw runs and summary/binding remain unchanged; this is separate supplemental MCP compatibility evidence.']
    (LOG/'RESULTS.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':report['passed'],'log_directory':LOG.name,'wall_seconds':report['wall_seconds'],'error':report.get('error')},indent=2),flush=True)
    if not report['passed']:raise SystemExit(1)
