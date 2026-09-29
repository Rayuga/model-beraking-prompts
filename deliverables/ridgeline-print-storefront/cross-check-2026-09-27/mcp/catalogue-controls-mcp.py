"""Live golden catalogue controls and optional-asset proof using installed MCP."""
import json
from pathlib import Path
import selectors
import subprocess
import time
import tomllib

root = Path('/evidence')
metadata = tomllib.loads(Path('/source-task/task.toml').read_text(encoding='utf-8'))
assert metadata['environment']['network_mode'] == 'public'
assert metadata['verifier']['environment']['network_mode'] == 'public'
integration = Path('/source-task/environment/instructions/integration.md').read_text(encoding='utf-8')
assert 'may load external fonts, scripts or CDN assets' in integration
assert "can't depend on an external backend or data service" in integration
command = ['playwright-mcp', '--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox']
stderr = (root / 'catalogue-controls-mcp-stderr.log').open('w', encoding='utf-8')
process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr, text=True, bufsize=1)
selector = selectors.DefaultSelector()
selector.register(process.stdout, selectors.EVENT_READ)


def call(number, method, params):
    process.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': number, 'method': method, 'params': params}) + '\n')
    process.stdin.flush()
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        assert selector.select(timeout=max(0, deadline-time.monotonic())), 'MCP response timeout'
        line = process.stdout.readline()
        assert line, 'MCP process ended'
        message = json.loads(line)
        if message.get('id') == number:
            assert 'error' not in message, message
            assert not message.get('result', {}).get('isError'), message
            return message['result']
    raise AssertionError('MCP response timeout')


report = {'started_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'command': command, 'policy_assertions': {'agent_network': 'public', 'verifier_network': 'public', 'external_frontend_assets_allowed': True, 'external_backend_disallowed': True}, 'scope': 'Five separate live UI catalogue controls plus a locally routed external-style script control; no actual internet request or paid call.'}
try:
    initialized = call(1, 'initialize', {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'ridgeline-catalogue-followup', 'version': '1'}})
    process.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': 'notifications/initialized'}) + '\n'); process.stdin.flush()
    names = [tool['name'] for tool in call(2, 'tools/list', {})['tools']]
    assert 'browser_run_code_unsafe' in names
    call(3, 'tools/call', {'name': 'browser_navigate', 'arguments': {'url': 'http://localhost:3000/'}})
    result = call(4, 'tools/call', {'name': 'browser_run_code_unsafe', 'arguments': {'code': r'''async (page) => {
      function require(value, message) { if (!value) throw new Error(message); }
      const observations = { browserVersion: page.context().browser().version(), criteria: [] };
      const titles = () => page.locator('.print-card h2').allTextContents();
      const expected = ['Allotment','Harbour Mouth','Kiln','Long Field','Night Ferry','Nine Windows','Slack Water','Two Weathers'];
      const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
      const stocks = () => page.evaluate(async () => { const data = await (await fetch('/api/prints')).json(); return Object.fromEntries(data.prints.flatMap(print => print.sizes.map(size => [`${print.sku}/${size.size}`, size.in_stock]))); });
      const search = page.getByRole('searchbox', { name: 'Search prints' });
      const size = page.getByLabel('Size', { exact: true });
      const paper = page.getByLabel('Paper', { exact: true });
      const sort = page.getByLabel('Sort', { exact: true });
      await page.locator('.print-card').first().waitFor();
      observations.initialStock = await stocks();
      await search.fill(''); await size.selectOption(''); await paper.selectOption('');
      require(same((await titles()).sort(), expected), 'Independent all-eight catalogue starting state');
      await search.fill('hArBoUr');
      require(same(await titles(), ['Harbour Mouth']), 'Case-insensitive search membership');
      const searchResult = await titles();
      await page.screenshot({ path: '/evidence/search-membership.png', fullPage: true });
      await search.fill(''); require(same((await titles()).sort(), expected), 'Search clearing restores all eight');
      observations.criteria.push({ name: 'title search membership and clearing', result: searchResult, cleared: await titles(), passed: true });
      await size.selectOption('A2');
      const sizeResult = (await titles()).sort();
      require(same(sizeResult, ['Harbour Mouth','Long Field','Night Ferry','Slack Water','Two Weathers']), 'Exact A2 membership, including sold-out Harbour variant');
      await page.screenshot({ path: '/evidence/size-membership.png', fullPage: true });
      await size.selectOption(''); require(same((await titles()).sort(), expected), 'Size clearing restores all eight');
      observations.criteria.push({ name: 'size membership and clearing', result: sizeResult, cleared: await titles(), passed: true });
      await paper.selectOption({ label: 'Munken Pure Rough 240gsm' });
      const paperResult = (await titles()).sort();
      require(same(paperResult, ['Harbour Mouth','Slack Water','Two Weathers']), 'Exact paper membership');
      await page.screenshot({ path: '/evidence/paper-membership.png', fullPage: true });
      await paper.selectOption(''); require(same((await titles()).sort(), expected), 'Paper clearing restores all eight');
      observations.criteria.push({ name: 'paper membership and clearing', result: paperResult, cleared: await titles(), passed: true });
      const prices = () => page.locator('.print-name > span').allTextContents().then(values => values.map(value => Number(value.replace(/[^0-9.]/g, ''))));
      await sort.selectOption('price_asc');
      const ascendingPrices = await prices();
      require(same(ascendingPrices, [37.95,37.95,37.95,37.95,37.95,42.5,42.5,42.5]), 'Ascending complete regular-price groups');
      await sort.selectOption('price_desc');
      const descendingPrices = await prices();
      require(same(descendingPrices, [42.5,42.5,42.5,37.95,37.95,37.95,37.95,37.95]), 'Descending complete regular-price groups');
      observations.criteria.push({ name: 'price ordering', ascending: ascendingPrices, descending: descendingPrices, passed: true });
      await sort.selectOption('title_asc'); const ascendingTitles = await titles(); require(same(ascendingTitles, expected), 'Exact title ascending order');
      await sort.selectOption('title_desc'); const descendingTitles = await titles(); require(same(descendingTitles, [...expected].reverse()), 'Exact title descending order');
      observations.criteria.push({ name: 'title ordering', ascending: ascendingTitles, descending: descendingTitles, passed: true });
      await sort.selectOption('title_asc');

      const assetURL = 'https://ridgeline-qc-cdn.invalid/asset-' + Date.now() + '.js';
      const marker = 'local-routed-cdn-proof-' + Date.now();
      const delivered = [];
      const handler = async route => { delivered.push(route.request().url()); await route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' }, body: 'globalThis.__ridgelineCdnProof=' + JSON.stringify(marker) + ';' }); };
      await page.context().route(assetURL, handler);
      const control = await page.context().newPage();
      try {
        require(control.url() === 'about:blank', 'Independent unprotected control');
        await control.addScriptTag({ url: assetURL });
        require(await control.evaluate(() => globalThis.__ridgelineCdnProof) === marker, 'Locally routed script works on control');
        const inserted = await page.addScriptTag({ url: assetURL });
        require(await page.evaluate(() => globalThis.__ridgelineCdnProof) === marker, 'Golden accepts optional external-style frontend script');
        require(delivered.length === 2, 'Both script resource requests reached local route handler');
        require(same(await titles(), expected), 'Catalogue remains intact with optional script loaded');
        await search.fill('hArBoUr'); require(same(await titles(), ['Harbour Mouth']), 'Live app action still works with optional script loaded'); await search.fill('');
        observations.optionalFrontendAsset = { url: assetURL, marker, unprotectedControlLoaded: true, goldenLoaded: true, delivered, appActionStillWorks: true };
        await inserted.evaluate(element => element.remove()); await page.evaluate(() => { delete globalThis.__ridgelineCdnProof; });
      } finally { await control.close(); await page.context().unroute(assetURL, handler); }
      observations.finalStock = await stocks(); require(same(observations.finalStock, observations.initialStock), 'Catalogue/control checks never change durable stock');
      await page.screenshot({ path: '/evidence/catalogue-final.png', fullPage: true });
      return observations;
    }'''}})
    report['probe'] = result
    call(5, 'tools/call', {'name': 'browser_close', 'arguments': {}})
    report.update(passed=True, server=initialized['serverInfo'], tool='browser_run_code_unsafe')
except Exception as error:
    report.update(passed=False, error=str(error))
    raise
finally:
    report['finished_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    (root / 'catalogue-controls-mcp-results.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    process.terminate(); process.wait(timeout=10); stderr.close()
    print(json.dumps({'passed': report.get('passed'), 'server': report.get('server'), 'tool': report.get('tool'), 'error': report.get('error')}, indent=2), flush=True)
