// Load with browser_run_code_unsafe {"filename":"/opt/common-ground-verifier/browser-evidence.js"}.
// All retained objects belong to the evaluator's Playwright process, never the app.
async (page) => {
  const browser = page.context().browser();
  if (browser.__ballotEvidence) return {installed: true, version: browser.__ballotEvidence.version};
  const entries = new Map();
  const secret = {test: key => /^(authorization|proxyauthorization|cookie|cookies|setcookie|password|passwd|token|accesstoken|refreshtoken|sessiontoken|sessionid|apikey|xapikey|secret|credential|credentials|authtoken|csrftoken)$/.test(String(key).toLowerCase().replace(/[^a-z0-9]/g, ''))};
  const secrets = new Set();
  function clean(value, key = '') {
    if (secret.test(key)) {
      if (typeof value === 'string' && value.length >= 4) secrets.add(value);
      return '[REDACTED]';
    }
    if (Array.isArray(value)) return value.map(item => clean(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, clean(item, name)]));
    if (typeof value === 'string') {
      for (const token of secrets) value = value.split(token).join('[REDACTED]');
      return value.replace(/([?&](?:token|access_token|session_token|api_key|password)=)[^&#]*/gi, '$1[REDACTED]');
    }
    return value;
  }
  const parse = text => { try { return JSON.parse(text); } catch { return text; } };
  const bounded = (p, promise, ms = 15000) => Promise.race([
    promise,
    p.waitForTimeout(ms).then(() => { throw new Error(`Evidence operation exceeded ${ms}ms`); }),
  ]);
  function packet(request) {
    const headers = request.headers();
    for (const [key, value] of Object.entries(headers)) if (secret.test(key)) {
      secrets.add(value);
      for (const cookie of value.split(';')) {
        const at = cookie.indexOf('=');
        if (at >= 0 && cookie.slice(at + 1).trim().length >= 4) secrets.add(cookie.slice(at + 1).trim());
      }
    }
    return {url: request.url(), method: request.method(), body: request.postData(), headers};
  }
  function snapshot(entry) {
    const data = {label: entry.label, state: entry.state, startedAt: entry.startedAt, finishedAt: entry.finishedAt,
      mode: entry.mode, request: entry.request && {url: entry.request.url, method: entry.request.method, body: parse(entry.request.body)},
      response: entry.response, error: entry.error, actionError: entry.actionError};
    return JSON.parse(JSON.stringify(clean(data)));
  }
  function create(p, label, options) {
    if (!label || entries.has(label)) throw new Error('Each evidence label must be unique; do not overwrite an earlier exchange');
    if (typeof options.match !== 'function') throw new Error('Provide a matcher discovered from this UI action');
    let resolve;
    const entry = {page: p, label, state: 'armed', startedAt: new Date().toISOString(), mode: options.mode || 'observe',
      done: new Promise(done => { resolve = done; }), resolve: () => resolve(), cleanup: async () => {}};
    entries.set(label, entry);
    p.setDefaultTimeout(15000);
    return entry;
  }
  async function finish(entry, error) {
    if (entry.finishedAt) return;
    if (error) { entry.error = String(error); entry.state = 'evidence-missing'; }
    else entry.state = 'captured';
    entry.finishedAt = new Date().toISOString();
    try { await entry.cleanup(); } catch (cleanupError) { entry.cleanupError = String(cleanupError); }
    entry.resolve();
  }
  async function readResponse(entry, response) {
    const text = await bounded(entry.page, response.text());
    entry.response = {status: response.status(), body: parse(text)};
    const replay = response.headers()['x-idempotent-replay'];
    if (replay !== undefined) entry.response.replay = replay;
  }
  function matches(entry, options, request) {
    if (entry.finishedAt) return false;
    try {
      const result = options.match(request);
      if (result && typeof result.then === 'function') {
        Promise.resolve(result).catch(() => {});
        throw new Error('Capture matchers must return a synchronous boolean');
      }
      if (typeof result !== 'boolean') throw new Error('Capture matchers must return a boolean');
      return result;
    } catch (error) {
      // Playwright event callbacks execute outside the tool's request handler.
      // Never let an evaluator predicate exception terminate the MCP process.
      void finish(entry, new Error('Capture matcher failed: ' + String(error)));
      return false;
    }
  }
  async function arm(p, label, options) {
    const entry = create(p, label, options);
    if (entry.mode === 'observe') {
      const requestListener = request => {
        try {
          if (!entry.request && matches(entry, options, request)) {
            entry.request = packet(request); entry.actualRequest = request; entry.state = 'request-captured';
          }
        } catch (error) { void finish(entry, error); }
      };
      const responseListener = async response => {
        try {
          if (response.request() !== entry.actualRequest || entry.finishedAt) return;
          await readResponse(entry, response); await finish(entry);
        } catch (error) { await finish(entry, error); }
      };
      const failedListener = request => {
        try {
          if (request === entry.actualRequest) void finish(entry, request.failure()?.errorText || 'Request failed');
        } catch (error) { void finish(entry, error); }
      };
      entry.cleanup = async () => { p.off('request', requestListener); p.off('response', responseListener); p.off('requestfailed', failedListener); };
      p.on('request', requestListener); p.on('response', responseListener); p.on('requestfailed', failedListener);
    } else {
      if (!['drop', 'hold', 'hold-request', 'unreadable', 'server-error'].includes(entry.mode)) throw new Error('Unknown interruption mode');
      const glob = '**/*';
      let claimed = false;
      const handler = async route => {
        try {
          if (claimed || !matches(entry, options, route.request())) return await route.fallback();
          claimed = true;
          entry.request = packet(route.request());
          entry.state = 'request-captured';
          let requestedDelivery;
          if (entry.mode === 'hold-request') {
            entry.state = 'request-held';
            requestedDelivery = await bounded(p, new Promise(resolve => { entry.release = resolve; }), options.holdMs || 30000);
          }
          const response = await route.fetch({maxRetries: 0, timeout: 15000});
          await readResponse(entry, response);
          // The upstream outcome is retained before any delivery or assertion.
          entry.state = 'upstream-captured';
          let delivery = entry.mode === 'hold-request' ? requestedDelivery || 'deliver' : entry.mode;
          if (entry.mode === 'hold') {
            entry.state = 'response-held';
            delivery = await bounded(p, new Promise(resolve => { entry.release = resolve; }), options.holdMs || 30000);
          }
          if (delivery === 'drop') await route.abort('failed');
          else if (delivery === 'unreadable') await route.fulfill({status: response.status(), contentType: 'application/json', body: '{'});
          else if (delivery === 'server-error') await route.fulfill({status: 503, contentType: 'application/json', body: '{"error":"Temporarily unavailable"}'});
          else await route.fulfill({response});
          await finish(entry);
        } catch (error) { await route.abort('failed').catch(() => {}); await finish(entry, error); }
      };
      entry.cleanup = () => p.unroute(glob, handler);
      await p.route(glob, handler);
    }
    return {label, state: entry.state};
  }
  async function collect(label, timeout = 20000) {
    const entry = entries.get(label);
    if (!entry) throw new Error('Unknown evidence label');
    try { await bounded(entry.page, entry.done, timeout); }
    catch (error) { if (entry.release) entry.release('drop'); await finish(entry, error); }
    return snapshot(entry);
  }
  async function capture(p, label, action, options) {
    await arm(p, label, options);
    try { await bounded(p, Promise.resolve().then(action), 20000); } catch (error) { entries.get(label).actionError = String(error); }
    return collect(label);
  }
  function adaptJson(label, {set = {}, omit = [], url, method} = {}) {
    const original = entries.get(label)?.request;
    if (!original) throw new Error('An actual UI exchange is required before adapting a request');
    const body = JSON.parse(original.body);
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('Use an observed object payload or adapt its actual non-JSON encoding explicitly');
    for (const name of omit) {
      if (!Object.prototype.hasOwnProperty.call(body, name)) throw new Error(`Cannot omit unobserved field ${name}`);
      delete body[name];
    }
    Object.assign(body, set);
    for (const name of omit) if (Object.prototype.hasOwnProperty.call(body, name)) throw new Error('Omitted field was reintroduced');
    return {url: url || original.url, method: method || original.method, body: JSON.stringify(body)};
  }
  browser.__ballotEvidence = {version: 'r24', arm, capture, collect, adaptJson,
    peek: label => snapshot(entries.get(label)),
    release: (label, delivery = 'deliver') => {
      const entry = entries.get(label);
      if (!entry?.release) throw new Error('No held exchange is ready to release');
      entry.release(delivery); return {label, released: true};
    },
    dump: () => [...entries.values()].map(snapshot),
    note: (label, data) => {
      if (entries.has(label)) throw new Error('Duplicate evidence label');
      const entry = {label, state: 'observation', startedAt: new Date().toISOString(), response: {body: data}};
      entries.set(label, entry); return snapshot(entry);
    },
  };
  return {installed: true, version: 'r24', access: 'page.context().browser().__ballotEvidence'};
}
