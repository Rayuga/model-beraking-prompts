import { parse } from 'acorn';
import { full as fullWalk } from 'acorn-walk';
import { parser as htmlParser } from '@lezer/html';
import { IterMode } from '@lezer/common';

export const emptyDocument = '<!doctype html><html><head><style>body{font:16px system-ui;padding:24px;color:#1d3044;background:#f6f8fa}pre{white-space:pre-wrap}button{padding:8px 12px;margin:4px;border:1px solid #a6b9c8;border-radius:5px;background:#fff;color:#193848}</style></head><body><h1>Your preview</h1><pre id="out">Run a snippet to begin.</pre></body></html>';
const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";
function restoreFormState(doc: Document, states) {
  if (!Array.isArray(states)) return;
  const controls = doc.documentElement.querySelectorAll('input,textarea,select');
  const canvases = doc.documentElement.querySelectorAll('canvas');
  for (const state of states) {
    if (!Array.isArray(state) || !Number.isSafeInteger(state[0]) || state[0] < 0) continue;
    if (state[1] === 'canvas' && Number.isSafeInteger(state[2]) && state[2] > 0 && Number.isSafeInteger(state[3]) && state[3] > 0 && Array.isArray(state[4]) && state[4].length === state[2] * state[3] * 4) {
      const canvas = canvases[state[0]];
      if (canvas) canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(state[4]), state[2], state[3]), 0, 0);
      continue;
    }
    const control = controls[state[0]];
    if (state[1] === 'value' && typeof state[2] === 'string' && (control instanceof HTMLTextAreaElement || control instanceof HTMLInputElement && control.type !== 'file')) control.value = state[2];
    if (state[1] === 'indeterminate' && control instanceof HTMLInputElement) control.indeterminate = true;
    if (state[1] === 'unselected' && control instanceof HTMLSelectElement) control.selectedIndex = -1;
  }
}

function staticDocument(document: string, formState = []) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const csp = policy.replace("script-src 'unsafe-inline'", `script-src 'nonce-${nonce}'`);
  const state = JSON.stringify(formState).replace(/</g, '\\u003c');
  return `<meta http-equiv="Content-Security-Policy" content="${csp}">${document}<script nonce="${nonce}">(${restoreFormState.toString()})(document,${state});document.currentScript.remove();</script>`;
}
export function language(filename: string) { return filename.toLowerCase().match(/\.(js|html)$/)?.[1] || ''; }
function instrument(code: string, guard: string, lineOffset = 0) {
  const comments = [];
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true, onComment: comments });
  const edits = [];
  const guarded = new Set();
  const add = (at, text, order = 0) => edits.push({ at, text, order });
  function body(node) {
    if (guarded.has(node.start)) return;
    guarded.add(node.start);
    if (node.type === 'BlockStatement') add(node.start + 1, `${guard}();`);
    else { add(node.start, `{${guard}();`); add(node.end, '}', 2); }
  }
  fullWalk(ast, node => {
    if (node.type === 'ThrowStatement') {
      add(node.argument.start, `${guard}origin((`, -1);
      add(node.argument.end, `),${node.loc.start.line + lineOffset})`, 3);
    }
    if (node.type === 'ImportExpression') {
      throw Object.assign(new Error('Dynamic evaluation, imports, WebAssembly and workers are outside this playground’s supported execution modes.'), { loc: node.loc.start });
    }
    if (['WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement'].includes(node.type)) body(node.body);
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      if (node.body.type === 'BlockStatement') body(node.body);
      else { add(node.body.start, `(${guard}(),`); add(node.body.end, ')', 1); }
    }
    if (node.type === 'CatchClause') {
      body(node.body);
      if (node.param?.type === 'Identifier') add(node.body.start + 1, `${guard}caught(${node.param.name});`);
      else if (!node.param) {
        add(node.start + 5, `(${guard}caughtValue)`);
        add(node.body.start + 1, `${guard}caught(${guard}caughtValue);`);
      }
    }
    if (node.type === 'TryStatement' && node.finalizer) body(node.finalizer);
  });
  let result = code;
  for (const comment of comments) {
    if (comment.type === 'Line' && /^[#@]\s*source(?:Mapping)?URL/.test(comment.value)) {
      result = result.slice(0, comment.start) + ' '.repeat(comment.end - comment.start) + result.slice(comment.end);
    }
  }
  for (const edit of edits.sort((a, b) => b.at - a.at || b.order - a.order)) result = result.slice(0, edit.at) + edit.text + result.slice(edit.at);
  return result;
}

function sandboxBootstrap(token, key) {
  if (typeof globalThis.SharedWorker === 'function') {
    const refuseWorker = () => {
      const error = new Error('Dynamic evaluation, imports, WebAssembly and workers are outside this playground’s supported execution modes.');
      fail(error); throw error;
    };
    const guardedWorker = new Proxy(globalThis.SharedWorker, { construct: refuseWorker, apply: refuseWorker });
    globalThis.SharedWorker = guardedWorker;
    guardedWorker.prototype.constructor = guardedWorker;
  }
  const now = performance.now.bind(performance);
  const sendNative = parent.postMessage.bind(parent);
  const timeoutNative = setTimeout.bind(window);
  const clearNative = clearTimeout.bind(window);
  const intervalNative = setInterval.bind(window);
  const clearIntervalNative = clearInterval.bind(window);
  const thenNative = Promise.prototype.then;
  const PromiseNative = Promise;
  const rejectionLines = new WeakMap();
  const adoptedPromises = new WeakMap();
  const thrownLines = new Map();
  const lastThrownLine = reason => thrownLines.get(reason)?.at(-1) || 0;
  const consumeThrownLine = (reason, line) => {
    const lines = thrownLines.get(reason), index = lines?.indexOf(line) ?? -1;
    if (index >= 0) lines.splice(index, 1);
    if (!lines?.length) thrownLines.delete(reason);
  };
  const rejectionLine = promise => {
    const visited = new Set();
    while (promise && !visited.has(promise)) {
      if (rejectionLines.has(promise)) return rejectionLines.get(promise);
      visited.add(promise); promise = adoptedPromises.get(promise);
    }
    return 0;
  };
  const sourceLine = error => Number(String(error?.stack || '').match(/cw-user-[^\s:]+:(\d+):\d+/)?.[1] || 0);
  Object.defineProperty(globalThis, key + 'origin', { value: (reason, line) => { const lines = thrownLines.get(reason) || []; lines.push(line); thrownLines.set(reason, lines); return reason; } });
  Object.defineProperty(globalThis, key + 'caught', { value: reason => { const lines = thrownLines.get(reason); lines?.pop(); if (!lines?.length) thrownLines.delete(reason); } });
  globalThis.Promise = class extends PromiseNative {
    constructor(executor) {
      if (typeof executor !== 'function') throw new TypeError('Promise executor must be a function');
      let promise, adopted, line = 0, resolved = false;
      super((resolve, reject) => executor(value => {
        if (resolved) return;
        resolved = true;
        if (value instanceof PromiseNative) { adopted = value; if (promise) adoptedPromises.set(promise, value); }
        resolve(value);
      }, reason => {
        if (resolved) return;
        resolved = true;
        line = sourceLine(new Error()) || lastThrownLine(reason);
        if (promise && line) rejectionLines.set(promise, line);
        reject(reason);
      }));
      promise = this;
      if (line) rejectionLines.set(this, line);
      if (adopted) adoptedPromises.set(this, adopted);
    }
  } as PromiseConstructor;
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
    const styles = document.querySelectorAll('style');
    const copiedStyles = copy.querySelectorAll('style');
    const stylesheetText = (sheet: CSSStyleSheet) => Array.from(sheet.cssRules, rule => rule.cssText).join('\n').replace(/<\/style/gi, token => '\\3c ' + token.slice(1));
    styles.forEach((style, index) => {
      if (!style.sheet) return;
      copiedStyles[index].textContent = stylesheetText(style.sheet);
      copiedStyles[index].setAttribute('media', style.sheet.disabled ? 'not all' : style.sheet.media.mediaText);
    });
    for (const sheet of document.adoptedStyleSheets) {
      const style = document.createElement('style');
      style.textContent = stylesheetText(sheet);
      style.media = sheet.disabled ? 'not all' : sheet.media.mediaText;
      (copy.querySelector('body') || copy).appendChild(style);
    }
    const controls = document.documentElement.querySelectorAll('input,textarea,select');
    const copiedControls = copy.querySelectorAll('input,textarea,select');
    const formState = [];
    document.documentElement.querySelectorAll('canvas').forEach((canvas, index) => {
      const context = canvas.getContext('2d');
      if (context && canvas.width > 0 && canvas.height > 0) formState.push([index, 'canvas', canvas.width, canvas.height, Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)]);
    });
    controls.forEach((control, index) => {
      const copied = copiedControls[index];
      if (control instanceof HTMLInputElement) {
        if (control.type !== 'file') {
          copied.setAttribute('value', control.value);
          formState.push([index, 'value', control.value]);
        }
        copied.toggleAttribute('checked', control.checked);
        if (control.indeterminate) formState.push([index, 'indeterminate']);
      } else if (control instanceof HTMLTextAreaElement) {
        copied.textContent = control.value;
        formState.push([index, 'value', control.value]);
      } else if (control instanceof HTMLSelectElement) {
        Array.from(control.options).forEach((option, index) => (copied as HTMLSelectElement).options[index].toggleAttribute('selected', option.selected));
        if (control.selectedIndex === -1) formState.push([index, 'unselected']);
      }
    });
    copy.querySelectorAll('script,meta[http-equiv]').forEach(element => element.remove());
    copy.querySelectorAll('*').forEach(element => Array.from(element.attributes).forEach(attribute => { if (attribute.name.startsWith('on') || attribute.name.startsWith('data-cw-')) element.removeAttribute(attribute.name); }));
    send('snapshot', { html: '<!doctype html>' + copy.outerHTML, formState });
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
    let message = String(error?.message ?? error);
    if (/Content Security Policy|unsafe-eval/i.test(message)) message = 'Dynamic evaluation, imports, WebAssembly and workers are outside this playground’s supported execution modes.';
    send('error', { message, line: sourceLine(error) || line || lastThrownLine(error), duration: now() - started });
  }
  addEventListener('error', event => { fail(event.error || event.message, event.lineno || 0); event.preventDefault(); });
  addEventListener('securitypolicyviolation', event => {
    if (event.disposition === 'enforce' && (['eval', 'wasm-eval'].includes(event.blockedURI) || event.effectiveDirective === 'worker-src')) {
      fail(new Error('Dynamic evaluation, imports, WebAssembly and workers are outside this playground’s supported execution modes.'), event.lineNumber || 0);
    }
  });
  addEventListener('unhandledrejection', event => { fail(event.reason, rejectionLine(event.promise) || thrownLines.get(event.reason)?.[0] || 0); event.preventDefault(); });
  function wrap(fn) { return (...args) => { try { check(); return fn(...args); } catch (error) { fail(error); throw error; } finally { microtaskNative(snapshot); settleSoon(); } }; }
  window.setTimeout = (fn, delay, ...args) => {
    if (typeof fn !== 'function') throw new Error('String timers are unsupported. Pass a function.');
    const id = timeoutNative(() => { timers.delete(id); wrap(fn)(...args); }, delay);
    timers.add(id); settled = false; send('pending', { count: timers.size + callbacks }); return id;
  };
  window.clearTimeout = id => { timers.delete(id); clearNative(id); settleSoon(); };
  window.setInterval = (fn, delay, ...args) => {
    if (typeof fn !== 'function') throw new Error('String timers are unsupported. Pass a function.');
    const id = intervalNative(wrap(fn), delay, ...args); timers.add(id); settled = false; send('pending', { count: timers.size + callbacks }); return id;
  };
  window.clearInterval = id => { timers.delete(id); clearIntervalNative(id); settleSoon(); };
  PromiseNative.prototype.then = function(onFulfilled, onRejected) {
    callbacks++; settled = false; send('pending', { count: timers.size + callbacks });
    const parentPromise = this;
    let result;
    const handler = (fn, reject) => value => {
      try {
        check();
        if (typeof fn === 'function') {
          if (reject) consumeThrownLine(value, rejectionLine(parentPromise) || thrownLines.get(value)?.[0] || 0);
          const returned = fn(value);
          if (returned instanceof PromiseNative) adoptedPromises.set(result, returned);
          return returned;
        }
        if (reject) { adoptedPromises.set(result, parentPromise); throw value; }
        return value;
      } catch (error) {
        const line = sourceLine(error) || (typeof fn !== 'function' && reject ? rejectionLine(parentPromise) : lastThrownLine(error));
        if (line) rejectionLines.set(result, line);
        throw error;
      }
      finally { callbacks--; microtaskNative(snapshot); settleSoon(); }
    };
    result = thenNative.call(this, handler(onFulfilled, false), handler(onRejected, true));
    return result;
  };
  window.queueMicrotask = fn => { callbacks++; settled = false; microtaskNative(() => { try { wrap(fn)(); } finally { callbacks--; settleSoon(); } }); };
  // Capture at window before authored capture handlers, including events that
  // precede click. Only real input after completed work can start a new budget.
  const interactionEvents = [
    'pointerdown', 'pointerup', 'pointermove', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave', 'pointercancel',
    'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
    'click', 'dblclick', 'auxclick', 'contextmenu', 'wheel',
    'touchstart', 'touchmove', 'touchend', 'touchcancel',
    'keydown', 'keypress', 'keyup', 'beforeinput', 'input', 'change',
    'compositionstart', 'compositionupdate', 'compositionend', 'focus', 'blur', 'focusin', 'focusout'
  ];
  for (const name of interactionEvents) window.addEventListener(name, event => {
    if (!event.isTrusted || failed) return;
    if (settled && !timers.size && !callbacks) { settled = false; started = now(); deadline = started + 4900; send('interaction'); }
    microtaskNative(snapshot); settleSoon();
  }, true);
  new MutationObserver(() => microtaskNative(snapshot)).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
  Object.defineProperty(globalThis, key + 'done', { value: () => { initialDone = true; snapshot(); settleSoon(); } });
  send('started');
}

function locatedHtml(code: string, marker: string) {
  const locations = new Map();
  const edits = [];
  const tree = htmlParser.parse(code.replace(/[A-Z]/g, char => char.toLowerCase()));
  const cursor = tree.cursor(IterMode.IgnoreMounts);
  do {
    if (!['OpenTag', 'SelfClosingTag'].includes(cursor.name)) continue;
    const tag = cursor.node, name = tag.getChild('TagName');
    if (!name) continue;
    const handlers = new Map();
    for (const attribute of tag.getChildren('Attribute')) {
      const name = attribute.getChild('AttributeName');
      const value = attribute.getChild('AttributeValue') || attribute.getChild('UnquotedAttributeValue');
      if (!name || !value) continue;
      const key = code.slice(name.from, name.to).toLowerCase();
      if (key.startsWith('on') && !handlers.has(key)) handlers.set(key, value.from + (value.name === 'AttributeValue' ? 1 : 0));
    }
    const id = String(tag.from);
    locations.set(id, { script: tag.to, handlers });
    edits.push({ at: name.to, text: ` ${marker}="${id}"` });
  } while (cursor.next());
  let source = code;
  for (const edit of edits.reverse()) source = source.slice(0, edit.at) + edit.text + source.slice(edit.at);
  return { source, locations };
}

export function buildRun(code: string, filename: string, token: string) {
  const kind = language(filename);
  if (!kind) throw new Error('Filename must end in .js or .html.');
  const guard = '__cw_' + crypto.randomUUID().replaceAll('-', '');
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const locationAttribute = 'data-cw-source-' + nonce;
  const located = kind === 'html' ? locatedHtml(code, locationAttribute) : null;
  const doc = new DOMParser().parseFromString(located ? located.source : emptyDocument, 'text/html');
  const sourceLine = at => code.slice(0, at).split(/\r\n?|\n/).length - 1;
  const location = element => located?.locations.get(element.getAttribute(locationAttribute));
  const scripts = [];
  if (kind === 'js') scripts.push({ text: code, line: 0 });
  if (kind === 'html') {
    for (const script of doc.querySelectorAll('script')) {
      if (script.src || (script.type && !['text/javascript', 'application/javascript'].includes(script.type.toLowerCase()))) throw new Error('Use local inline classic JavaScript; external and module scripts are unsupported.');
      const text = script.textContent || '';
      scripts.push({ text, line: sourceLine(location(script)?.script || 0) });
    }
  }
  doc.querySelectorAll('script,meta[http-equiv],base,iframe,object,embed').forEach(element => element.remove());
  for (const element of doc.querySelectorAll('*')) {
    const handlerId = 'handler-' + crypto.randomUUID();
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith('on')) {
        element.setAttribute('data-cw-handler', handlerId);
        const at = location(element)?.handlers.get(attribute.name.toLowerCase()) || 0;
        scripts.push({ text: `document.querySelector('[data-cw-handler="${handlerId}"]').addEventListener(${JSON.stringify(attribute.name.slice(2))}, function(event){${attribute.value}});`, line: kind === 'html' ? sourceLine(at) : 0 });
        element.removeAttribute(attribute.name);
      }
      if (['href', 'src', 'action', 'formaction'].includes(attribute.name) && /^\s*(javascript:|https?:|\/\/)/i.test(attribute.value)) element.removeAttribute(attribute.name);
    }
  }
  const clearLocations = root => {
    for (const element of root.querySelectorAll('*')) {
      element.removeAttribute(locationAttribute);
      if (element instanceof HTMLTemplateElement) clearLocations(element.content);
    }
  };
  clearLocations(doc);
  const prepared = scripts.map((script, index) => {
    let text;
    try { text = instrument(script.text, guard, script.line); }
    catch (error) { if (error.loc) error.loc.line += script.line; throw error; }
    const source = '\n'.repeat(script.line) + text + `\n//# sourceURL=cw-user-${index}-${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}\n`;
    const payload = JSON.stringify(source).replace(/</g, '\\u003c');
    return `<script nonce="${nonce}">(() => { const script = document.createElement('script'); script.nonce = ${JSON.stringify(nonce)}; script.textContent = ${payload}; document.currentScript.replaceWith(script); })();</script>`;
  }).join('');
  // Scripts need the nonce; event-handler attributes that running code writes into
  // the page are allowed, while eval-style execution stays blocked.
  const csp = policy.replace("script-src 'unsafe-inline'", `script-src 'nonce-${nonce}'`) + "; script-src-attr 'unsafe-inline'";
  const bootstrap = `(${sandboxBootstrap.toString()})(${JSON.stringify(token)},${JSON.stringify(guard)});document.currentScript.remove();`;
  doc.head.insertAdjacentHTML('afterbegin', `<meta http-equiv="Content-Security-Policy" content="${csp}"><script nonce="${nonce}">${bootstrap.replace(/<\/script/gi, '<\\/script')}</script>`);
  return '<!doctype html>' + doc.documentElement.outerHTML.replace('</body>', () => prepared + `<script nonce="${nonce}">document.currentScript.remove();globalThis[${JSON.stringify(guard + 'done')}]();</script></body>`);
}

export class PreviewRunner {
  host; onEntry; onStatus; frame = null; token = ''; html = ''; lastGood = emptyDocument; rollback = emptyDocument; candidate = emptyDocument; lastGoodForms = []; rollbackForms = []; candidateForms = []; timer = null; active = false; started = 0; listener;
  constructor(host, onEntry, onStatus) {
    this.host = host; this.onEntry = onEntry; this.onStatus = onStatus;
    this.listener = event => this.message(event); addEventListener('message', this.listener); this.restore();
  }
  clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  watchdog() { this.clearTimer(); this.timer = setTimeout(() => this.stop('Execution stopped: five-second time limit', 'error'), 5100); }
  restore() {
    this.frame?.remove(); this.frame = document.createElement('iframe'); this.frame.title = 'Live preview'; this.frame.sandbox = 'allow-scripts'; this.frame.srcdoc = staticDocument(this.lastGood, this.lastGoodForms); this.host.replaceChildren(this.frame);
  }
  stop(reason = 'Run cancelled', level = 'info') {
    if (this.active) { this.lastGood = this.rollback; this.lastGoodForms = this.rollbackForms; }
    this.clearTimer(); this.active = false; this.token = ''; this.restore(); this.onEntry(level, [reason]); this.onStatus(reason, performance.now() - this.started);
  }
  run(code, filename) {
    if (this.active) this.onEntry('info', ['Previous run cancelled']);
    this.clearTimer(); this.token = crypto.randomUUID(); this.started = performance.now(); this.active = true; this.rollback = this.lastGood; this.candidate = this.lastGood; this.rollbackForms = this.lastGoodForms; this.candidateForms = this.lastGoodForms;
    try { this.html = buildRun(code, filename, this.token); }
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
    if (data.kind === 'snapshot') { this.candidate = data.html; this.candidateForms = Array.isArray(data.formState) ? data.formState : []; return; }
    if (data.kind === 'started' || data.kind === 'interaction') { if (data.kind === 'interaction') { this.rollback = this.lastGood; this.rollbackForms = this.lastGoodForms; } this.active = true; this.started = performance.now(); this.watchdog(); this.onStatus('Running…', null); return; }
    if (data.kind === 'pending') { this.onStatus('Waiting for asynchronous work…', null); return; }
    if (data.kind === 'complete') { this.clearTimer(); this.active = false; this.lastGood = this.candidate; this.lastGoodForms = this.candidateForms; this.onStatus('Complete', data.duration); return; }
    if (data.kind === 'error') { this.clearTimer(); this.active = false; this.token = ''; this.lastGood = this.rollback; this.lastGoodForms = this.rollbackForms; this.restore(); this.onEntry('error', [`${data.message}${data.line ? ` · line ${data.line}` : ''}`]); this.onStatus('Error — previous preview retained', data.duration); }
  }
  destroy() { this.clearTimer(); this.token = ''; this.frame?.remove(); removeEventListener('message', this.listener); }
}
