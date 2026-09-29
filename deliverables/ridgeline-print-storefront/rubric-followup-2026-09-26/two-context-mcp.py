"""Proof using the exact installed MCP transport and isolated browser flags."""
import json
from pathlib import Path
import selectors
import subprocess
import time

root = Path('/evidence')
stderr = (root / 'two-context-mcp-stderr.log').open('w', encoding='utf-8')
command = ['playwright-mcp', '--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox']
process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr, text=True, bufsize=1)
selector = selectors.DefaultSelector()
selector.register(process.stdout, selectors.EVENT_READ)


def call(number, method, params):
    process.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': number, 'method': method, 'params': params}) + '\n')
    process.stdin.flush()
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        assert selector.select(timeout=max(0, deadline - time.monotonic())), 'MCP response timeout'
        line = process.stdout.readline()
        assert line, 'MCP process ended'
        message = json.loads(line)
        if message.get('id') == number:
            assert 'error' not in message, message
            assert not message.get('result', {}).get('isError'), message
            return message['result']
    raise AssertionError('MCP response timeout')


report = {'scope': 'Actual installed Playwright MCP proof: simultaneous independent browser contexts against fresh Ridgeline golden. No paid judge or external network.', 'command': command, 'started_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
try:
    initialized = call(1, 'initialize', {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'ridgeline-two-context-proof', 'version': '1'}})
    process.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': 'notifications/initialized'}) + '\n')
    process.stdin.flush()
    listed = call(2, 'tools/list', {})['tools']
    tool = next(item for item in listed if item['name'] == 'browser_run_code_unsafe')
    report['run_code_tool_schema'] = tool
    call(3, 'tools/call', {'name': 'browser_navigate', 'arguments': {'url': 'http://localhost:3000/'}})
    result = call(4, 'tools/call', {'name': 'browser_run_code_unsafe', 'arguments': {'code': r'''async (page) => {
      function require(value, message) { if (!value) throw new Error(message); }
      const contextA = page.context();
      const browser = contextA.browser();
      require(browser, 'The isolated MCP context must expose its browser');
      const observations = { browserVersion: browser.version(), originalContextCount: browser.contexts().length, purchaseRequests: 0 };
      const countPurchase = request => { if (request.method() === 'POST' && request.url().endsWith('/api/orders')) observations.purchaseRequests++; };
      contextA.on('request', countPurchase);
      async function stocks(target) {
        return target.evaluate(async () => { const data = await (await fetch('/api/prints')).json(); return Object.fromEntries(data.prints.flatMap(print => print.sizes.map(size => [`${print.sku}/${size.size}`, size.in_stock]))); });
      }
      async function add(target, title, size, qty) {
        await target.getByRole('button', { name: 'The prints', exact: true }).click();
        await target.getByRole('button', { name: `View ${title}`, exact: true }).click();
        await target.getByRole('button', { name: new RegExp('^' + size) }).click();
        await target.getByRole('spinbutton').fill(String(qty));
        await target.getByRole('spinbutton').press('Tab');
        await target.getByRole('button', { name: 'Add to basket', exact: true }).click();
        await target.getByRole('button', { name: 'View basket', exact: false }).click();
      }
      async function inspect(target, title, qty, total) {
        await target.locator('.basket-line').waitFor();
        require(await target.locator('.basket-line').count() === 1, 'Exactly one basket line required');
        require(await target.locator('.basket-line h2').innerText() === title, 'Exact product required');
        require(await target.getByRole('spinbutton').inputValue() === String(qty), 'Exact quantity required');
        await target.waitForFunction(expected => document.querySelector('.summary-total')?.textContent.includes(expected), total);
        return { line: await target.locator('.basket-line').innerText(), quantity: await target.getByRole('spinbutton').inputValue(), total: await target.locator('.summary-total').innerText() };
      }
      observations.initialStock = await stocks(page);
      await page.getByRole('button', { name: /Open basket/ }).click();
      require(await page.locator('.basket-line').count() === 0, 'Fresh A starts empty');
      await add(page, 'Night Ferry', 'A2', 2);
      observations.aBeforeReload = await inspect(page, 'Night Ferry', 2, '132.20');
      await page.reload();
      observations.aAfterInitialReload = await inspect(page, 'Night Ferry', 2, '132.20');
      require(JSON.stringify(observations.aBeforeReload) === JSON.stringify(observations.aAfterInitialReload), 'A full reload keeps exact basket');
      const contextB = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
      contextB.on('request', countPurchase);
      observations.bInitialStorageState = await contextB.storageState();
      require(JSON.stringify(observations.bInitialStorageState) === JSON.stringify({ cookies: [], origins: [] }), 'B must start with no imported storage');
      observations.simultaneousDistinctContexts = contextA !== contextB && browser.contexts().includes(contextA) && browser.contexts().includes(contextB);
      require(observations.simultaneousDistinctContexts, 'Both distinct contexts must remain open simultaneously');
      try {
        const pageB = await contextB.newPage();
        await pageB.goto('http://localhost:3000/');
        await pageB.getByRole('button', { name: /Open basket/ }).click();
        require(await pageB.locator('.basket-line').count() === 0, 'B must not inherit A basket');
        require(/empty/i.test(await pageB.locator('main').innerText()), 'B empty basket must be visible');
        observations.bStartedEmpty = true;
        await add(pageB, 'Long Field', 'A3', 1);
        observations.bBeforeReload = await inspect(pageB, 'Long Field', 1, '39.70');
        await page.bringToFront();
        await page.reload();
        observations.aAfterBWrites = await inspect(page, 'Night Ferry', 2, '132.20');
        require(JSON.stringify(observations.aAfterBWrites) === JSON.stringify(observations.aBeforeReload), 'B writes must not replace A basket');
        await pageB.bringToFront();
        await pageB.reload();
        observations.bAfterReload = await inspect(pageB, 'Long Field', 1, '39.70');
        require(JSON.stringify(observations.bAfterReload) === JSON.stringify(observations.bBeforeReload), 'B reload must keep only its own basket');
        observations.contextAStorage = await contextA.storageState();
        observations.contextBStorage = await contextB.storageState();
        await page.screenshot({ path: '/evidence/context-a-mcp-basket.png', fullPage: true });
        await pageB.screenshot({ path: '/evidence/context-b-mcp-basket.png', fullPage: true });
        await page.getByRole('button', { name: 'Remove Night Ferry A2', exact: true }).click();
        await page.locator('.basket-line').waitFor({ state: 'detached' });
        await pageB.getByRole('button', { name: 'Remove Long Field A3', exact: true }).click();
        await pageB.locator('.basket-line').waitFor({ state: 'detached' });
        observations.bothBasketsCleared = true;
        observations.finalStock = await stocks(page);
        require(JSON.stringify(observations.finalStock) === JSON.stringify(observations.initialStock), 'No durable stock may change');
        require(observations.purchaseRequests === 0, 'No order may be submitted');
      } finally {
        await contextB.close();
        contextA.off('request', countPurchase);
      }
      await page.bringToFront();
      await page.reload();
      require(await page.getByRole('button', { name: 'The prints', exact: true }).count() === 1, 'Original MCP page remains alive after B closes');
      observations.originalPageStillUsable = !page.isClosed();
      observations.contextCountAfterCleanup = browser.contexts().length;
      require(observations.contextCountAfterCleanup === observations.originalContextCount, 'Only added context must be closed');
      return observations;
    }'''}})
    report['probe'] = result
    snapshot = call(5, 'tools/call', {'name': 'browser_snapshot', 'arguments': {}})
    report['ordinary_mcp_snapshot_after_cleanup'] = snapshot
    call(6, 'tools/call', {'name': 'browser_close', 'arguments': {}})
    report.update(passed=True, server=initialized['serverInfo'], tool='browser_run_code_unsafe')
except Exception as error:
    report.update(passed=False, error=str(error))
    raise
finally:
    report['finished_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    (root / 'two-context-mcp-results.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    process.terminate()
    process.wait(timeout=10)
    stderr.close()
    print(json.dumps({'passed': report.get('passed'), 'server': report.get('server'), 'tool': report.get('tool'), 'error': report.get('error')}, indent=2), flush=True)
