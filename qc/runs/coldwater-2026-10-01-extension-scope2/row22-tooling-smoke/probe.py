import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import urllib.request


def run(argv):
    result = subprocess.run(argv, capture_output=True, text=True, timeout=30)
    observation = {"argv": argv, "returncode": result.returncode,
                   "stdout": result.stdout, "stderr": result.stderr}
    assert result.returncode == 0, observation
    return observation


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


results = {
    "provider_invoked": False,
    "configured_judge_invoked": False,
    "scope": "Offline image tooling/browser/app smoke only; no grade or full verifier run.",
    "frozen_dockerfile_sha256": sha('/task/tests/Dockerfile'),
    "rewardkit_version": importlib.metadata.version('harbor-rewardkit'),
}
results['binding_limit'] = 'Image identity bound by host command; Dockerfile is excluded from /tests in image. Frozen Dockerfile hash alone does not prove exact image build provenance.'
results['commands'] = [run(c) for c in [
    ['node', '--version'], ['python3', '--version'], ['claude', '--version'],
    ['playwright-mcp', '--version'], ['rewardkit', '--help'],
    ['node', '-e', "console.log(JSON.stringify({express:require('express/package.json').version,sqlite:require('better-sqlite3/package.json').version,sqliteLoad:new (require('better-sqlite3'))(':memory:').prepare('select 1 as ok').get()}))"]
]]
Path('/evidence/tooling-observations.json').write_text(json.dumps(results, indent=2) + '\n')
shutil.copytree('/task/solution/app', '/app')
for root, dirs, files in os.walk('/app'):
    os.chown(root, 65534, 65534)
    os.chmod(root, 0o755)
    for name in files:
        target = Path(root) / name
        os.chown(target, 65534, 65534)
        os.chmod(target, 0o644)
app_log = open('/evidence/app.log', 'w')
app = subprocess.Popen(['node', '/app/server.js'], cwd='/tmp',
    env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'NODE_PATH': '/usr/local/lib/node_modules',
         'HOME': '/app', 'PORT': '3000', 'DB_PATH': '/app/app.db'},
    user=65534, group=65534, extra_groups=[], start_new_session=True,
    stdout=app_log, stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=1) as response:
                results['app_health'] = {'status': response.status, 'json': json.load(response)}
            break
        except Exception:
            if app.poll() is not None:
                raise RuntimeError('app exited before readiness')
            time.sleep(0.1)
    else:
        raise RuntimeError('app did not become ready')
    browser_js = r"""
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'/usr/local/bin/chromium', args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.goto('http://127.0.0.1:3000/');
    await page.getByRole('button', {name:/^Run(?:\s|$)/}).waitFor({state:'visible'});
    const app = {title:await page.title(), url:page.url(), run_button_visible:await page.getByRole('button',{name:/^Run(?:\s|$)/}).isVisible()};
    await page.setContent('<button onclick="this.textContent=\'worked\'">click</button>');
    await page.getByRole('button',{name:'click',exact:true}).click();
    if (await page.getByRole('button').textContent() !== 'worked') throw new Error('browser interaction failed');
    console.log(JSON.stringify({chromium:browser.version(), app, synthetic_click:'worked'}));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
"""
    results['browser'] = run(['node', '-e', browser_js])
finally:
    os.killpg(app.pid, signal.SIGTERM)
    try:
        app.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(app.pid, signal.SIGKILL)
        app.wait(timeout=5)
    app_log.close()
results['passed'] = True
Path('/evidence/observations.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
