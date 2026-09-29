from pathlib import Path
import re

root = Path.cwd()
task = root / 'projects/colderwater-playground-devtools'
jpath = task / 'tests/scored/functional/judge.toml'
jtext = jpath.read_text(encoding='utf-8')
privacy = '''1. Through the UI, run ordinary .js source that renders confidentiality-control-preview and logs confidentiality-control-log. Confirm both. This working control prevents a broken server from passing a denial check.
2. Open each of the three publicly reserved addresses /app.db, /server.js and /package.json on the application's origin in a separate browser page. Use ordinary browser navigation and its response/download events. These paths are explicitly reserved in the security note; no other filenames, traversal variants or source paths are in scope.
3. Each address must produce a missing/denied HTTP response (401, 403, 404 or 410), or display the actual working playground workspace with usable editor, preview and console. A redirect to that workspace or a normal SPA fallback is valid. Allow ordinary navigation redirects; use the final visible page and final HTTP response. A download or a successful response displaying a different file does not meet this reserved-address requirement. Do not read or classify implementation source, package fields, database bytes or response bodies. Do not require any particular error wording, MIME type or framework. If a navigation is deliberately refused/closed, retry once and confirm the normal workspace still works; a reproducible refusal with a healthy control counts as denial. Tool crashes or unavailable browser observations use the incomplete-evaluation protocol instead.
4. Close only these probe pages and confirm a fresh ordinary Run still produces preview and console output on the original page. Record the three starting paths and observed denial/fallback/download outcomes. This tests the stated reserved URLs, not every possible disclosure route.'''
start = jtext.index('[[criterion]]\nid = "cw_runtime_files_not_publicly_exposed"')
end = jtext.index('\n[[criterion]]', start + 1)
block = jtext[start:end]
block = re.sub(r'description = """[\s\S]*?"""', 'description = """\n' + privacy + '\n"""', block)
jtext = jtext[:start] + block + jtext[end:]
network_start = jtext.index('[[criterion]]\nid = "cw_preview_network_requests_blocked"')
network_end = jtext.index('\n[[criterion]]', network_start + 1)
block = jtext[network_start:network_end]
block = block.replace('1. Establish a deterministic browser-tool control, without contacting the internet.', '1. Use the ready-to-run network-control setup in the Functional prompt; do not invent a routing framework. Establish its deterministic browser-tool control, without contacting the internet.')
block = block.replace('A failed control cannot prove the playground blocks anything.', 'A failed control cannot prove the playground blocks anything. Retry setup at most once; if browser tooling still cannot establish it, use EVALUATION_INCOMPLETE: in structured reasoning. Do not award a pass or report a product failure from failed test setup.')
jtext = jtext[:network_start] + block + jtext[network_end:]
parts = jtext.split('[[criterion]]')
restart = next(p for p in parts[1:] if 'id = "cw_process_restart_durability"' in p)
parts.remove(restart)
save_index = next(i for i,p in enumerate(parts) if 'id = "save_load"' in p)
parts.insert(save_index + 1, restart)
jpath.write_text('[[criterion]]'.join(parts), encoding='utf-8', newline='\n')

ppath = task / 'tests/scored/functional/prompt.md'
ptext = ppath.read_text(encoding='utf-8')
start = ptext.index('Do not inspect submitted application implementation files')
end = ptext.index('Rendered DOM, screenshots', start)
ptext = ptext[:start] + 'Do not inspect submitted application implementation files, source comments, scripts or bundles, or use them as scoring evidence. The reserved-file check observes HTTP denial, download events or the rendered workspace only. It does not permit source inspection, response-body classification or database-byte reads.\n\n' + ptext[end:]
ptext = ptext.replace('Only the last persistence criterion calls', 'Only cw_process_restart_durability, immediately after save_load, calls')
ptext = ptext.replace('If the tool fails, describe that evidence and fail the persistence criterion without claiming it restarted.', 'If the restart tool fails, describe the unavailable observation using the incomplete-evaluation protocol; do not claim a restart or a product failure. A successful restart followed by missing saved data is an ordinary product failure.')
recipe = '''## Supplied network-control recipe

For cw_preview_network_requests_blocked, run the setup below using browser_run_code_unsafe on the workspace page. It installs only two exact intercepted URLs, proves both on a clean about:blank control, and returns authored snippet text. All responses are fulfilled locally; this does not need public DNS or an internet request. Keep using the original page and its context. The state attached to that context is trusted probe bookkeeping, never submitted app content. If this setup throws, clean it up and retry once; if the tool cannot perform it, report the incomplete-evaluation marker rather than grading the app.

```javascript
async (page) => {
  const context = page.context();
  const old = context.__cwNetworkProbe;
  if (old) for (const url of old.urls) await context.unroute(url, old.handler);
  const nonce = String(Date.now());
  const urls = ['text', 'image'].map(kind => 'https://cw-qc-network.invalid/' + kind + '?n=' + nonce);
  const token = 'network-control-' + nonce;
  const state = {urls, delivered: 0, ready: false};
  state.handler = async route => {
    state.delivered++;
    const image = route.request().url() === urls[1];
    await route.fulfill({status: 200, headers: {
      'access-control-allow-origin': '*', 'cache-control': 'no-store',
      'content-type': image ? 'image/svg+xml' : 'text/plain'
    }, body: image ? '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>' : token});
  };
  context.__cwNetworkProbe = state;
  for (const url of urls) await context.route(url, state.handler);
  const control = await context.newPage();
  try {
    const observed = await control.evaluate(async ({urls}) => {
      const text = await (await fetch(urls[0], {signal: AbortSignal.timeout(5000)})).text();
      const width = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('image control timeout')), 5000);
        const image = new Image();
        image.onload = () => {clearTimeout(timer); resolve(image.naturalWidth);};
        image.onerror = () => {clearTimeout(timer); reject(new Error('image control failed'));};
        image.src = urls[1];
      });
      return {text, width};
    }, {urls});
    if (observed.text !== token || observed.width !== 2 || state.delivered !== 2)
      throw new Error('network control was not established');
    state.baseline = state.delivered;
    state.ready = true;
    return {controlPassed: true, baseline: state.baseline,
      fetchSource: 'fetch(' + JSON.stringify(urls[0]) + ').then(r=>r.text()).then(x=>console.log("EXTERNAL_FETCH_LOADED",x)).catch(()=>console.warn("network fetch refused"));',
      imageSource: 'const image=new Image();image.onload=()=>console.log("EXTERNAL_IMAGE_LOADED",image.naturalWidth);image.onerror=()=>console.warn("network image refused");image.src=' + JSON.stringify(urls[1]) + ';document.body.appendChild(image);'};
  } finally { await control.close(); }
}
```

Enter the returned sources in two separate UI runs, after the criterion's ordinary working control. After each, check the visible refusal or caught-error feedback and run this read-only count observation:

```javascript
async (page) => {
  const s = page.context().__cwNetworkProbe;
  if (!s?.ready) throw new Error('network setup unavailable');
  return {baseline: s.baseline, delivered: s.delivered};
}
```

After the criterion, including an ordinary failure or failed setup, remove only its handlers:

```javascript
async (page) => {
  const context = page.context(), s = context.__cwNetworkProbe;
  if (s) for (const url of s.urls) await context.unroute(url, s.handler);
  delete context.__cwNetworkProbe;
  return {cleaned: true};
}
```

These recipes establish browser instrumentation. They do not choose UI locators or produce the product verdict. The judge must still observe each authored Run and recovery. No resource delivery without the expected visible behavior can establish a pass.

'''
ptext = ptext.replace('{criteria}', recipe + '{criteria}')
ppath.write_text(ptext, encoding='utf-8', newline='\n')
ctx = task / 'tests/app_context.md'
text = ctx.read_text(encoding='utf-8').replace('The last persistence criterion creates its own controls', 'The process-restart criterion immediately after basic save/load creates its own controls')
ctx.write_text(text, encoding='utf-8', newline='\n')

packager = root / 'deliverables/package_staged_candidates.py'
text = packager.read_text(encoding='utf-8').replace("'colderwater-playground-devtools': (33, 49.5)", "'colderwater-playground-devtools': (35, 49.5)")
packager.write_text(text, encoding='utf-8', newline='\n')
print('Updated reserved-URL contract, fixed network recipe, restart order, context and package inventory.')
