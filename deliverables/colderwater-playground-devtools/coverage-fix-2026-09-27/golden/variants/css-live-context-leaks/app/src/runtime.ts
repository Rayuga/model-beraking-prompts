import { parse, fullWalk } from './vendor.js';

export const emptyDocument = '<!doctype html><html><head><style>body{font:16px system-ui;padding:24px;color:#1d3044;background:#f6f8fa}pre{white-space:pre-wrap}button{padding:8px 12px;margin:4px;border:1px solid #a6b9c8;border-radius:5px;background:#fff;color:#193848}</style></head><body><h1>Your preview</h1><pre id="out">Run a snippet to begin.</pre></body></html>';
const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";
function staticDocument(document: string) { return `<meta http-equiv="Content-Security-Policy" content="${policy.replace("script-src 'unsafe-inline'", "script-src 'none'")}">${document}`; }
export function language(filename: string) { return filename.toLowerCase().match(/\.(js|html|css)$/)?.[1] || ''; }
function instrument(code: string, guard: string) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const edits = [];
  const guarded = new Set();
  const blocked = new Set(['eval', 'Function', 'WebAssembly', 'Worker', 'SharedWorker', 'importScripts']);
  const add = (at, text, order = 0) => edits.push({ at, text, order });
  function body(node) {
    if (guarded.has(node.start)) return;
    guarded.add(node.start);
    if (node.type === 'BlockStatement') add(node.start + 1, `${guard}();`);
    else { add(node.start, `{${guard}();`); add(node.end, '}', 2); }
  }
  fullWalk(ast, node => {
    if (node.type === 'ImportExpression' || (node.type === 'Identifier' && blocked.has(node.name)) || (node.type === 'MemberExpression' && node.computed && node.property.type === 'Literal' && blocked.has(node.property.value))) {
      throw Object.assign(new Error('Dynamic evaluation, imports, WebAssembly and workers are outside this playground’s supported execution modes.'), { loc: node.loc.start });
    }
    if (['WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement'].includes(node.type)) body(node.body);
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      if (node.body.type === 'BlockStatement') body(node.body);
      else { add(node.body.start, `(${guard}(),`); add(node.body.end, ')', 1); }
    }
    if (node.type === 'CatchClause') body(node.body);
    if (node.type === 'TryStatement' && node.finalizer) body(node.finalizer);
  });
  let result = code.replace(/\/\/[#@]\s*source(?:Mapping)?URL[^\n]*/g, value => ' '.repeat(value.length));
  for (const edit of edits.sort((a, b) => b.at - a.at || b.order - a.order)) result = result.slice(0, edit.at) + edit.text + result.slice(edit.at);
  return result;
}

function sandboxBootstrap(token, key) {
  const now = performance.now.bind(performance);
  const sendNative = parent.postMessage.bind(parent);
  const timeoutNative = setTimeout.bind(window);
  const clearNative = clearTimeout.bind(window);
  const intervalNative = setInterval.bind(window);
  const clearIntervalNative = clearInterval.bind(window);
  const thenNative = Promise.prototype.then;
  const microtaskNative = queueMicrotask.bind(window);
  const timers = new Set();
  let started = now(), deadline = started + 4900, failed = false, initialDone = false, settled = false, callbacks = 0, settleTimer = null;
  const send = (kind, data = {}) => sendNative({ token, kind, ...data }, '*');
  function check() { if (failed || now() > deadline) { failed = true; throw new Error('Execution stopped: five-second time limit'); } }
  Object.defineProperty(globalThis, key, { value: check });
  const serialize = (value, seen = new WeakSet(), depth = 0) => {
    if (value === undefined) return 'undefined';
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (typeof value === 'bigint') return `${value}n`;
    if (typeof value === 'function') return '[Function]';
    if (typeof value === 'symbol') return String(value);
    if (depth > 6) return '[Depth limit]';
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (value instanceof Error) return { name: value.name, message: value.message };
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Element) return value.outerHTML;
    try { return Array.isArray(value) ? value.slice(0, 150).map(item => serialize(item, seen, depth + 1)) : Object.fromEntries(Object.keys(value).slice(0, 150).map(name => [name, serialize(value[name], seen, depth + 1)])); }
    catch { return '[Uninspectable]'; }
  };
  for (const level of ['log', 'warn', 'error', 'info']) console[level] = (...values) => { check(); send('console', { level, values: values.map(value => serialize(value)) }); };
  function snapshot() {
    if (failed) return;
    const copy = document.documentElement.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('script,meta[http-equiv]').forEach(element => element.remove());
    copy.querySelectorAll('*').forEach(element => Array.from(element.attributes).forEach(attribute => { if (attribute.name.startsWith('on') || attribute.name.startsWith('data-cw-')) element.removeAttribute(attribute.name); }));
    send('snapshot', { html: '<!doctype html>' + copy.outerHTML });
  }
  function settleSoon() {
    if (settleTimer) clearNative(settleTimer);
    settleTimer = timeoutNative(() => {
      settleTimer = null;
      if (failed || !initialDone || timers.size || callbacks) return;
      snapshot(); settled = true;
      send('complete', { duration: now() - started });
    }, 0);
  }
  function fail(error, line = 0) {
    if (failed && !String(error?.message || error).includes('time limit')) return;
    failed = true;
    if (settleTimer) clearNative(settleTimer);
    for (const id of timers) { clearNative(id); clearIntervalNative(id); }
    timers.clear();
    const stack = String(error?.stack || '');
    const location = stack.match(/cw-user-[^\s:]+:(\d+):\d+/);
    send('error', { message: String(error?.message || error), line: location ? Number(location[1]) : line, duration: now() - started });
  }
  addEventListener('error', event => { fail(event.error || event.message, event.lineno || 0); event.preventDefault(); });
  addEventListener('unhandledrejection', event => { fail(event.reason); event.preventDefault(); });
  function wrap(fn) { return (...args) => { try { check(); return fn(...args); } catch (error) { fail(error); throw error; } finally { microtaskNative(snapshot); settleSoon(); } }; }
  window.setTimeout = (fn, delay, ...args) => {
    if (typeof fn !== 'function') throw new Error('String timers are unsupported. Pass a function.');
    const id = timeoutNative(() => { timers.delete(id); wrap(fn)(...args); }, delay);
    timers.add(id); send('pending', { count: timers.size + callbacks }); return id;
  };
  window.clearTimeout = id => { timers.delete(id); clearNative(id); settleSoon(); };
  window.setInterval = (fn, delay, ...args) => {
    if (typeof fn !== 'function') throw new Error('String timers are unsupported. Pass a function.');
    const id = intervalNative(wrap(fn), delay, ...args); timers.add(id); send('pending', { count: timers.size + callbacks }); return id;
  };
  window.clearInterval = id => { timers.delete(id); clearIntervalNative(id); settleSoon(); };
  Promise.prototype.then = function(onFulfilled, onRejected) {
    callbacks++; send('pending', { count: timers.size + callbacks });
    const handler = (fn, reject) => value => {
      try { check(); if (typeof fn === 'function') return fn(value); if (reject) throw value; return value; }
      finally { callbacks--; microtaskNative(snapshot); settleSoon(); }
    };
    return thenNative.call(this, handler(onFulfilled, false), handler(onRejected, true));
  };
  window.queueMicrotask = fn => { callbacks++; microtaskNative(() => { try { wrap(fn)(); } finally { callbacks--; settleSoon(); } }); };
  for (const name of ['click', 'input', 'change', 'keydown']) document.addEventListener(name, () => {
    if (settled) { settled = false; started = now(); deadline = started + 4900; send('interaction'); }
    microtaskNative(snapshot); settleSoon();
  }, true);
  new MutationObserver(() => microtaskNative(snapshot)).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
  Object.defineProperty(globalThis, key + 'done', { value: () => { initialDone = true; snapshot(); settleSoon(); } });
  // Disposable mutant: CSS keeps the old live realm, including globals/timers/handlers.
  addEventListener('message', event => {
    if (event.source !== parent || event.data?.token !== token || event.data?.kind !== 'cw-proof-css-live') return;
    if (failed) return;
    settled = false; started = now(); deadline = started + 4900;
    const style = document.createElement('style');style.textContent = event.data.code;document.head.append(style);
    send('started'); snapshot(); settleSoon();
  });
  send('started');
}

export function buildRun(code: string, filename: string, lastDocument: string, token: string) {
  const kind = language(filename);
  if (!kind) throw new Error('Filename must end in .js, .html or .css.');
  const guard = '__cw_' + crypto.randomUUID().replaceAll('-', '');
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const doc = new DOMParser().parseFromString(kind === 'html' ? code : kind === 'css' ? lastDocument : emptyDocument, 'text/html');
  const scripts = [];
  let cursor = 0;
  if (kind === 'js') scripts.push({ text: code, line: 0 });
  if (kind === 'html') {
    for (const script of doc.querySelectorAll('script')) {
      if (script.src || (script.type && !['text/javascript', 'application/javascript'].includes(script.type.toLowerCase()))) throw new Error('Use local inline classic JavaScript; external and module scripts are unsupported.');
      const text = script.textContent || '';
      const at = code.indexOf(text, cursor); cursor = Math.max(cursor, at + text.length);
      scripts.push({ text, line: code.slice(0, Math.max(0, at)).split('\n').length - 1 });
    }
  }
  doc.querySelectorAll('script,meta[http-equiv],base,iframe,object,embed').forEach(element => element.remove());
  if (kind === 'css') { const style = doc.createElement('style'); style.textContent = code; doc.head.append(style); }
  for (const element of doc.querySelectorAll('*')) for (const attribute of Array.from(element.attributes)) {
    if (attribute.name.toLowerCase().startsWith('on')) {
      const id = 'handler-' + crypto.randomUUID(); element.setAttribute('data-cw-handler', id);
      const at = code.indexOf(attribute.value);
      scripts.push({ text: `document.querySelector('[data-cw-handler="${id}"]').addEventListener(${JSON.stringify(attribute.name.slice(2))}, function(event){${attribute.value}});`, line: kind === 'html' ? code.slice(0, Math.max(0, at)).split('\n').length - 1 : 0 });
      element.removeAttribute(attribute.name);
    }
    if (['href', 'src', 'action', 'formaction'].includes(attribute.name) && /^\s*(javascript:|https?:|\/\/)/i.test(attribute.value)) element.removeAttribute(attribute.name);
  }
  const prepared = scripts.map((script, index) => {
    let text;
    try { text = instrument(script.text, guard); }
    catch (error) { if (error.loc) error.loc.line += script.line; throw error; }
    return `<script nonce="${nonce}">${'\n'.repeat(script.line)}${text.replace(/<\/script/gi, '<\\/script')}\n//# sourceURL=cw-user-${index}-${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}\n</script>`;
  }).join('');
  const csp = policy.replace("script-src 'unsafe-inline'", `script-src 'nonce-${nonce}'`);
  const bootstrap = `(${sandboxBootstrap.toString()})(${JSON.stringify(token)},${JSON.stringify(guard)});document.currentScript.remove();`;
  doc.head.insertAdjacentHTML('afterbegin', `<meta http-equiv="Content-Security-Policy" content="${csp}"><script nonce="${nonce}">${bootstrap.replace(/<\/script/gi, '<\\/script')}</script>`);
  return '<!doctype html>' + doc.documentElement.outerHTML.replace('</body>', prepared + `<script nonce="${nonce}">document.currentScript.remove();globalThis[${JSON.stringify(guard + 'done')}]();</script></body>`);
}

export class PreviewRunner {
  host; onEntry; onStatus; frame = null; token = ''; html = ''; lastGood = emptyDocument; rollback = emptyDocument; candidate = emptyDocument; timer = null; active = false; started = 0; listener;
  constructor(host, onEntry, onStatus) {
    this.host = host; this.onEntry = onEntry; this.onStatus = onStatus;
    this.listener = event => this.message(event); addEventListener('message', this.listener); this.restore();
  }
  clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  watchdog() { this.clearTimer(); this.timer = setTimeout(() => this.stop('Execution stopped: five-second time limit', 'error'), 5100); }
  restore() {
    this.frame?.remove(); this.frame = document.createElement('iframe'); this.frame.title = 'Live preview'; this.frame.sandbox = 'allow-scripts'; this.frame.srcdoc = staticDocument(this.lastGood); this.host.replaceChildren(this.frame);
  }
  stop(reason = 'Run cancelled', level = 'info') {
    if (this.active) this.lastGood = this.rollback;
    this.clearTimer(); this.active = false; this.token = ''; this.restore(); this.onEntry(level, [reason]); this.onStatus(reason, performance.now() - this.started);
  }
  run(code, filename) {
    if (language(filename) === 'css' && this.token && this.frame?.contentWindow) {
      this.clearTimer(); this.started = performance.now(); this.active = true;
      this.rollback = this.lastGood; this.candidate = this.lastGood;
      this.onStatus('Running CSS...', null); this.watchdog();
      this.frame.contentWindow.postMessage({ token: this.token, kind: 'cw-proof-css-live', code }, '*');return;
    }
    if (this.active) this.onEntry('info', ['Previous run cancelled']);
    this.clearTimer(); this.token = crypto.randomUUID(); this.started = performance.now(); this.active = true; this.rollback = this.lastGood; this.candidate = this.lastGood;
    try { this.html = buildRun(code, filename, this.lastGood, this.token); }
    catch (error) { this.active = false; this.token = ''; this.restore(); this.onEntry('error', [`${error.message}${error.loc ? ` · line ${error.loc.line}` : ''}`]); this.onStatus('Error — previous preview retained', performance.now() - this.started); return; }
    this.frame?.remove(); this.frame = document.createElement('iframe'); this.frame.title = 'Live preview'; this.frame.sandbox = 'allow-scripts';
    const runnerURL = new URL('/runner.html', location.href);
    if (location.hostname === 'localhost') runnerURL.hostname = '127.0.0.1';
    else if (location.hostname === '127.0.0.1') runnerURL.hostname = 'localhost';
    runnerURL.hash = this.token; this.frame.src = runnerURL.href; this.host.replaceChildren(this.frame);
    this.onStatus('Running…', null); this.watchdog();
  }
  message(event) {
    if (!this.token || event.source !== this.frame?.contentWindow || event.data?.token !== this.token) return;
    const data = event.data;
    if (data.kind === 'ready') { this.frame.contentWindow.postMessage({ token: this.token, html: this.html }, '*'); return; }
    if (data.kind === 'console') { this.onEntry(data.level, data.values || []); return; }
    if (data.kind === 'snapshot') { this.candidate = data.html; return; }
    if (data.kind === 'started' || data.kind === 'interaction') { if (data.kind === 'interaction') this.rollback = this.lastGood; this.active = true; this.started = performance.now(); this.watchdog(); this.onStatus('Running…', null); return; }
    if (data.kind === 'pending') { this.onStatus('Waiting for asynchronous work…', null); return; }
    if (data.kind === 'complete') { this.clearTimer(); this.active = false; this.lastGood = this.candidate; this.onStatus('Complete', data.duration); return; }
    if (data.kind === 'error') { this.clearTimer(); this.active = false; this.token = ''; this.lastGood = this.rollback; this.restore(); this.onEntry('error', [`${data.message}${data.line ? ` · line ${data.line}` : ''}`]); this.onStatus('Error — previous preview retained', data.duration); }
  }
  destroy() { this.clearTimer(); this.token = ''; this.frame?.remove(); removeEventListener('message', this.listener); }
}
