'use strict';

// Proof-only text transforms. This module performs no filesystem or network I/O.
// Each transform accepts the exact frozen baseline text and returns one mutant.
// Do not compose transforms or apply them to the task's shipped source.
const { createHash } = require('node:crypto');

const BASELINES = Object.freeze({
  server: Object.freeze({
    relativePath: 'solution/app/server.js',
    sha256: '17d8b0e5b9cfb56a92ddd3323dcf6d1f9d3d5dde948a809b2cbdc41694cc45a4',
  }),
  runtime: Object.freeze({
    relativePath: 'solution/app/src/runtime.ts',
    sha256: 'd2fc0471003dd6a2107918be7a2d69f3a96027ec4c56266e6dd9b035a30efd86',
  }),
});

function requireBaseline(source, baseline, variantName) {
  if (typeof source !== 'string') {
    throw new TypeError(`${variantName}: expected unmodified UTF-8 source text.`);
  }
  const actual = createHash('sha256').update(source, 'utf8').digest('hex');
  if (actual !== baseline.sha256) {
    throw new Error(`${variantName}: base drift for ${baseline.relativePath}; expected SHA-256 ${baseline.sha256}, received ${actual}.`);
  }
}

function replaceExactlyOnce(source, anchor, replacement, label) {
  const at = source.indexOf(anchor);
  if (at < 0 || source.indexOf(anchor, at + anchor.length) !== -1) {
    throw new Error(`${label}: expected exactly one exact anchor.`);
  }
  if (anchor === replacement) throw new Error(`${label}: replacement would be a no-op.`);
  return source.slice(0, at) + replacement + source.slice(at + anchor.length);
}

const filenameGuard = String.raw`  if (!filename || filename.length > 180 || /[\x00-\x1f/\\]/.test(filename) || !/\.(js|html|css)$/i.test(filename)) {`;
const filenameGuardWithoutExtension = String.raw`  if (!filename || filename.length > 180 || /[\x00-\x1f/\\]/.test(filename)) {`;

function serverExtensionValidationBypass(source) {
  requireBaseline(source, BASELINES.server, 'serverExtensionValidationBypass');
  return replaceExactlyOnce(source, filenameGuard, filenameGuardWithoutExtension, 'server extension guard');
}

function serverCaseInsensitiveUniqueness(source) {
  requireBaseline(source, BASELINES.server, 'serverCaseInsensitiveUniqueness');
  return replaceExactlyOnce(
    source,
    "SELECT 1 FROM snippets WHERE title = ? AND id != ?",
    "SELECT 1 FROM snippets WHERE title COLLATE NOCASE = ? AND id != ?",
    'server title lookup',
  );
}

const cssBootstrapAnchor = "  send('started');";
const cssBootstrapReplacement = String.raw`  // Disposable proof defect: apply CSS in the existing live context.
  addEventListener('message', event => {
    if (event.source !== parent || event.data?.token !== token || event.data?.kind !== 'cw-proof-css-in-place') return;
    if (failed || !settled) return;
    settled = false; started = now(); deadline = started + 4900;
    const style = document.createElement('style');
    style.textContent = event.data.code;
    document.head.append(style);
    send('started'); snapshot(); settleSoon();
  });
  send('started');`;

const cssRunAnchor = '  run(code, filename) {';
const cssRunReplacement = String.raw`  run(code, filename) {
    // Disposable proof defect: keep the completed document and its handlers.
    if (language(filename) === 'css' && !this.active && this.token && this.frame?.contentWindow) {
      this.clearTimer(); this.started = performance.now(); this.active = true;
      this.rollback = this.lastGood; this.candidate = this.lastGood;
      this.onStatus('Running CSS...', null); this.watchdog();
      this.frame.contentWindow.postMessage({ token: this.token, kind: 'cw-proof-css-in-place', code }, '*');
      return;
    }`;

function cssLiveContextInheritance(source) {
  requireBaseline(source, BASELINES.runtime, 'cssLiveContextInheritance');
  const withReceiver = replaceExactlyOnce(source, cssBootstrapAnchor, cssBootstrapReplacement, 'runtime bootstrap receiver');
  return replaceExactlyOnce(withReceiver, cssRunAnchor, cssRunReplacement, 'runtime CSS run branch');
}

module.exports = Object.freeze({
  BASELINES,
  serverExtensionValidationBypass,
  serverCaseInsensitiveUniqueness,
  cssLiveContextInheritance,
});
