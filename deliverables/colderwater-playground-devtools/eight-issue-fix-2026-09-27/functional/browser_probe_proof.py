import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.request

OUT = Path('/evidence')
TASK = Path('/source-task')
APP = Path('/tmp/cw-probe-app')
shutil.copytree(TASK / 'solution/app', APP)
prompt = (TASK / 'tests/scored/functional/prompt.md').read_text()
recipes = re.findall(r'```javascript\n(.*?)\n```', prompt, flags=re.S)
assert len(recipes) == 3, len(recipes)
report = {
    'paid_provider': False,
    'network': 'none; app, browser and trusted HTTP fixtures in one disposable container',
    'prompt_sha256': hashlib.sha256(prompt.encode()).hexdigest(),
    'judge_sha256': hashlib.sha256((TASK / 'tests/scored/functional/judge.toml').read_bytes()).hexdigest(),
    'source_binding': {str(p.relative_to(APP)): hashlib.sha256(p.read_bytes()).hexdigest() for p in APP.rglob('*') if p.is_file()},
    'recipes': [{'index': i, 'sha256': hashlib.sha256(code.encode()).hexdigest()} for i, code in enumerate(recipes)],
    'observations': [],
    'raw_tool_results': [],
    'started': time.time(),
    'mcp_version': subprocess.check_output(['playwright-mcp', '--version'], text=True).strip(),
    'chromium_version': subprocess.check_output(['/usr/local/bin/chromium', '--version'], text=True).strip(),
}
log = (OUT / 'browser-probe-server.log').open('w')
env = dict(os.environ, DB_PATH=str(APP / 'probe.db'), NODE_PATH='/usr/local/lib/node_modules')
server = subprocess.Popen(['node', 'server.js'], cwd=APP, env=env, stdout=log, stderr=subprocess.STDOUT)
for _ in range(100):
    try:
        assert urllib.request.urlopen('http://localhost:3000/api/health', timeout=1).status == 200
        break
    except Exception:
        time.sleep(.1)
else:
    raise RuntimeError('Golden failed to start')


class Fixture(BaseHTTPRequestHandler):
    mode = '404'

    def log_message(self, *_args):
        pass

    def do_GET(self):
        reserved = self.path.split('?', 1)[0] in ['/app.db', '/server.js', '/package.json']
        if reserved and self.mode in ['404', '403']:
            self.send_response(int(self.mode))
            self.end_headers()
            self.wfile.write(b'Not available')
            return
        if reserved and self.mode == 'redirect':
            self.send_response(302)
            self.send_header('Location', '/')
            self.end_headers()
            return
        if reserved and self.mode == 'download':
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', 'attachment; filename=synthetic-fixture.txt')
            self.end_headers()
            self.wfile.write(b'Trusted synthetic fixture; not application data.')
            return
        if reserved and self.mode == 'different-public-file':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Trusted unrelated public response, not the workspace.')
            return
        target_path = '/' if reserved and self.mode == 'spa' else self.path
        try:
            response = urllib.request.urlopen('http://127.0.0.1:3000' + target_path, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        self.send_response(response.status)
        for key, value in response.headers.items():
            if key.lower() not in {'connection', 'content-length', 'transfer-encoding'}:
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(response.read())


fixture = ThreadingHTTPServer(('0.0.0.0', 3001), Fixture)
thread = threading.Thread(target=fixture.serve_forever, daemon=True)
thread.start()
stderr = (OUT / 'browser-probe-mcp-stderr.log').open('w')
process = subprocess.Popen(['playwright-mcp', '--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr, text=True, bufsize=1)
selector = selectors.DefaultSelector()
selector.register(process.stdout, selectors.EVENT_READ)
sequence = 0


def call(method, params):
    global sequence
    sequence += 1
    process.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': sequence, 'method': method, 'params': params}) + '\n')
    process.stdin.flush()
    deadline = time.monotonic() + 100
    while time.monotonic() < deadline:
        assert selector.select(max(0, deadline - time.monotonic())), 'MCP timeout'
        line = process.stdout.readline()
        assert line, 'MCP ended'
        value = json.loads(line)
        if value.get('id') == sequence:
            assert 'error' not in value, value
            result = value['result']
            assert not result.get('isError'), result
            return result
    raise RuntimeError('MCP timeout')


def code(source):
    result = call('tools/call', {'name': 'browser_run_code_unsafe', 'arguments': {'code': source}})
    report['raw_tool_results'].append(result)
    text = '\n'.join(item.get('text', '') for item in result['content'])
    assert '### Result\n' in text, text
    return json.loads(text.split('### Result\n', 1)[1].split('\n### ', 1)[0])


def record(name, value, passed):
    report['observations'].append({'name': name, 'passed': bool(passed), 'evidence': value})
    assert passed, name + ': ' + json.dumps(value)


def run_source(source, expected=None):
    return code('''async (page) => {
      const source = %s;
      await page.getByRole('textbox', {name:'Filename', exact:true}).fill('network-proof.js');
      const editor = page.getByRole('textbox', {name:'Code editor', exact:true});
      await editor.click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText(source);
      if (await editor.innerText() !== source) throw new Error('Exact source entry failed');
      await page.getByRole('button', {name:'Clear console', exact:true}).click();
      await page.getByRole('button', {name:/^Run /}).click();
      await page.waitForFunction(() => /Complete|Failed|Error/.test(document.querySelector('[role=status]')?.textContent ?? ''), null, {timeout:10000});
      await page.waitForTimeout(200);
      return {logs:await page.getByRole('log').innerText(), preview:await page.frameLocator('iframe[title="Live preview"]').locator('body').innerText(), status:await page.getByRole('status').innerText()};
    }''' % json.dumps(source))


try:
    call('initialize', {'protocolVersion':'2025-06-18', 'capabilities':{}, 'clientInfo':{'name':'coldwater-probe-proof', 'version':'1'}})
    process.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'}) + '\n')
    process.stdin.flush()
    report['tool'] = next(t for t in call('tools/list', {})['tools'] if t['name'] == 'browser_run_code_unsafe')
    call('tools/call', {'name':'browser_navigate','arguments':{'url':'http://localhost:3000'}})
    code("async(page)=>{await page.getByRole('textbox',{name:'Code editor',exact:true}).waitFor(); await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete')); await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();return {ready:true};}")
    setup = code(recipes[0])
    record('exact_network_setup_control', setup, setup['controlPassed'] and setup['baseline'] == 2)
    control = run_source("document.body.innerHTML='<p>network-good</p>';console.log('network-good-log');")
    record('golden_positive_run_control', control, 'network-good' in control['preview'] and 'network-good-log' in control['logs'])
    fetched = run_source(setup['fetchSource'])
    count_fetch = code(recipes[1])
    record('golden_fetch_blocked', {'run': fetched, 'count':count_fetch}, count_fetch['delivered'] == 2 and 'EXTERNAL_FETCH_LOADED' not in fetched['logs'] and re.search(r'network.*(refus|block)|failed to fetch', fetched['logs'], re.I))
    imaged = run_source(setup['imageSource'])
    count_image = code(recipes[1])
    record('golden_image_blocked', {'run':imaged,'count':count_image}, count_image['delivered'] == 2 and 'EXTERNAL_IMAGE_LOADED' not in imaged['logs'] and re.search(r'network.*(refus|block)|image refused', imaged['logs'], re.I))
    recovered = run_source("document.body.innerHTML='<p>network-recovered</p>';console.log('network-recovered-log');")
    record('golden_network_recovery', recovered, 'network-recovered' in recovered['preview'] and 'network-recovered-log' in recovered['logs'])
    synthetic = code('''async(page)=>{
      const state=page.context().__cwNetworkProbe;
      const p=await page.context().newPage();const errors=[];
      p.on('pageerror',error=>errors.push(String(error)));p.on('console',message=>errors.push(message.type()+':'+message.text()));
      try {
        const sources=%s;
        await p.setContent('<!doctype html><html><body><p>Unrestricted source control</p></body></html>');
        await p.addScriptTag({content:sources.fetchSource});
        await p.addScriptTag({content:sources.imageSource});
        for(let i=0;i<100 && state.delivered<4;i++)await p.waitForTimeout(50);
        return {baseline:state.baseline,delivered:state.delivered,errors,frames:p.frames().map(f=>f.url())};
      }finally{await p.close();}
    }''' % json.dumps({'fetchSource':setup['fetchSource'], 'imageSource':setup['imageSource']}))
    record('synthetic_unrestricted_source_execution_detected', synthetic, synthetic['delivered'] == 4)
    cleanup = code(recipes[2])
    absent = code("async(page)=>({absent:page.context().__cwNetworkProbe===undefined})")
    record('exact_network_cleanup', {'cleanup':cleanup,'bookkeeping':absent}, cleanup['cleaned'] and absent['absent'])
    reserved_probe = '''async(page)=>{
      const result=[];
      for(const path of ['/app.db','/server.js','/package.json']){
        const p=await page.context().newPage();let download=false,status=null,error=null;
        p.on('download',()=>{download=true;});
        const downloadEvent=p.waitForEvent('download',{timeout:2000}).catch(()=>null);
        try{
          try{const response=await p.goto(%s+path,{waitUntil:'domcontentloaded',timeout:10000});status=response?.status()??null;}catch(e){error=String(e).split('\\n')[0];}
          if(error){const observed=await downloadEvent;download=download||Boolean(observed);}
          let working=false;
          if(status===200 && !download){
            try{await p.getByRole('textbox',{name:'Code editor',exact:true}).waitFor({timeout:2500});await p.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete'),null,{timeout:2500});working=await p.getByRole('log').isVisible()&&await p.frameLocator('iframe[title="Live preview"]').locator('body').innerText()!=='';}catch{}
          }
          result.push({path,status,download,workingWorkspace:working,outcome:download?'download':[401,403,404,410].includes(status)?'denied':working?'workspace':'not-allowed',error});
        }finally{await p.close();}
      }return result;
    }'''
    golden_reserved = code(reserved_probe % json.dumps('http://localhost:3000'))
    record('golden_reserved_urls', golden_reserved, all(v['outcome'] == 'denied' for v in golden_reserved))
    for mode, expected in [('404','denied'),('403','denied'),('spa','workspace'),('redirect','workspace'),('download','download'),('different-public-file','not-allowed')]:
        Fixture.mode = mode
        result = code(reserved_probe % json.dumps('http://localhost:3001'))
        record('reserved_url_fixture_' + mode, result, all(v['outcome'] == expected for v in result))
    final = run_source("document.body.innerHTML='<p>privacy-recovered</p>';console.log('privacy-recovered-log');")
    record('golden_reserved_probe_recovery', final, 'privacy-recovered' in final['preview'] and 'privacy-recovered-log' in final['logs'])
    report['passed'] = True
except Exception as error:
    report['passed'] = False
    report['error'] = str(error)
finally:
    report['finished'] = time.time()
    report['duration_seconds'] = report['finished'] - report['started']
    (OUT / 'browser_probe_results.json').write_text(json.dumps(report, indent=2) + '\n')
    try:
        call('tools/call', {'name':'browser_close','arguments':{}})
    except Exception:
        pass
    process.terminate()
    process.wait(timeout=10)
    fixture.shutdown()
    server.terminate()
    server.wait(timeout=10)
    stderr.close()
    log.close()
    print(json.dumps({k:report[k] for k in ['passed','observations','duration_seconds']} | {'error':report.get('error')}, indent=2), flush=True)
    if not report['passed']:
        raise SystemExit(1)
