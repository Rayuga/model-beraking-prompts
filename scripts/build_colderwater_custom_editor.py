from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = (root / 'projects/patchpad-editor-v3/solution/app/public/js/app.js').read_text(encoding='utf-8')
destination = root / 'projects/colderwater-playground-devtools/solution/app/src/custom-editor.js'

def between(start, end):
    return source[source.index(start):source.index(end)]

core = between('function snapshot() {', 'async function saveDocument() {')
core += between('function onPaste(event) {', 'function render() {')
core += source[source.index('function render() {'):]
core = core.replace('      saveDocument();', '      callbacks.save?.();')
core = core.replace("  document.getElementById('doc-title').textContent = state.title || 'PatchPad';\n", '')
core = core.replace("  document.getElementById('revision-label').textContent = `Revision ${state.baseRevision}`;\n", '')
core = core.replace("  document.getElementById('save-btn').disabled = !state.dirty || state.saving;\n", '')
core = core.replace("  const mode = state.dirty ? 'Dirty' : 'Saved';\n", '')
core = core.replace("  document.getElementById('save-state').textContent = `${mode} | ${count}`;", "  document.getElementById('save-state').textContent = count;")
core = core.replace("  document.getElementById('focus-state').textContent =", "  document.getElementById('focus-state').textContent =")
core = core.replace("'Click the report to edit, or use Find to select text.'", "'Click the code to edit, or use Find to select text.'")
core = core.replace("    document.getElementById('find-box').focus();\n    return;\n  }", "    leaveOnNextTab = true;\n    message.textContent = 'Press Tab to leave the editor.';\n    return;\n  }\n  if (leaveOnNextTab && event.key !== 'Tab') leaveOnNextTab = false;")
core = core.replace("  if (event.key === 'Tab') {\n    event.preventDefault();", "  if (event.key === 'Tab') {\n    if (leaveOnNextTab) { leaveOnNextTab = false; return; }\n    event.preventDefault();")
core = core.replace("  editor.replaceChildren(fragment);\n}", "  editor.replaceChildren(fragment);\n  const next = textContent();\n  if (!suppressChange && next !== lastEmitted) { lastEmitted = next; callbacks.onChange?.(next); }\n}")
core = core.replace("  const points = new Set([0, line.length]);", "  const tokens = syntaxForLine(lineIndex);\n  const points = new Set([0, line.length]);\n  for (const token of tokens) { points.add(token.start); points.add(token.end); }")
core = core.replace("    if (hitIndex >= 0) classes.push(hitIndex === state.activeMatch ? 'find-hit active-hit' : 'find-hit');", "    if (hitIndex >= 0) classes.push(hitIndex === state.activeMatch ? 'find-hit active-hit' : 'find-hit');\n    const token = tokens.find(t => t.start <= col && t.end >= next);\n    if (token) classes.push('tok-' + token.kind);")
core = core.replace("'Replace temporary dashboard link'", "'Replace temporary dashboard link'")

header = '''import { tokenizer, parse } from 'acorn';
import { full as walk } from 'acorn-walk';
import prettier from 'prettier/standalone';
import babelPlugin from 'prettier/plugins/babel';
import estreePlugin from 'prettier/plugins/estree';
import htmlPlugin from 'prettier/plugins/html';

export function mountCodeEditor(host, callbacks = {}) {
  const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  host.innerHTML = `<div class="custom-tools" aria-label="Editor tools">
    <button id="undo-btn" type="button">Undo</button><button id="redo-btn" type="button">Redo</button>
    <button id="format-btn" type="button">Format document</button>
    <label>Find <input id="find-box" aria-label="Find in code"></label>
    <button id="find-next-btn" type="button">Next</button><button id="find-prev-btn" type="button">Previous</button>
    <label>Replace <input id="replace-box" aria-label="Replacement text"></label>
    <button id="replace-current-btn" type="button">Replace</button><button id="replace-all-btn" type="button">Replace all</button>
    <span id="save-state" aria-live="polite"></span>
  </div>
  <div id="editor" class="custom-code-editor" role="textbox" aria-label="Code editor" aria-multiline="true" tabindex="0"></div>
  <div class="editor-footer"><span id="cursor-label">Ln 1, Col 1</span><span id="focus-state">Click the code to edit</span><span id="editor-message" role="status"></span></div>`;
  const editor = host.querySelector('#editor');
  const message = host.querySelector('#editor-message');
  const state = {
    lines: [''], caret: {line: 0, col: 0}, extraCarets: [], selection: null,
    preferredCol: null, undo: [], redo: [], typingGroup: null, dirty: false,
    savedContent: '', query: '', matches: [], activeMatch: -1
  };
  let mode = 'js';
  let suppressChange = false;
  let lastEmitted = '';
  let leaveOnNextTab = false;
  let syntaxCache = null;
  let syntaxSource = null;
  let syntaxMode = null;
  const onKey = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault(); callbacks.run?.(); return;
    }
    onKeyDown(event);
  };
  editor.addEventListener('keydown', onKey);
  editor.addEventListener('paste', onPaste);
  editor.addEventListener('mousedown', onMouseDown);
  document.addEventListener('focusin', renderFocusStatus);
  document.addEventListener('focusout', () => queueMicrotask(renderFocusStatus));
  const findBox = host.querySelector('#find-box');
  findBox.addEventListener('input', event => {
    state.query = event.target.value; state.activeMatch = -1;
    state.selection = null; recomputeMatches(); render();
  });
  findBox.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); event.shiftKey ? findPrevious() : findNext(); }
    if (event.key === 'Escape') { event.preventDefault(); editor.focus(); }
  });
  for (const [id, command] of [
    ['undo-btn', undo], ['redo-btn', redo], ['find-next-btn', findNext],
    ['find-prev-btn', findPrevious], ['replace-current-btn', replaceCurrent],
    ['replace-all-btn', replaceAll]
  ]) host.querySelector('#' + id).addEventListener('click', () => {command(); editor.focus();});
  host.querySelector('#format-btn').addEventListener('click', () => formatDocument());

  function setValue(value, resetHistory = true) {
    suppressChange = true;
    state.lines = String(value).replace(/\\r\\n?/g, '\\n').split('\\n');
    state.caret = {line: 0, col: 0}; state.extraCarets = []; state.selection = null;
    if (resetHistory) {state.undo = []; state.redo = []; state.typingGroup = null;}
    state.savedContent = textContent(); state.dirty = false;
    lastEmitted = textContent(); recomputeMatches(); render();
    suppressChange = false;
  }
  function setMode(value) { mode = value === 'html' ? 'html' : 'js'; syntaxSource = null; render(); }
  function markDirty() { state.dirty = textContent() !== state.savedContent; }
  async function formatDocument() {
    try {
      const before = textContent();
      const result = await prettier.format(before, {
        parser: mode === 'html' ? 'html' : 'babel',
        plugins: [babelPlugin, estreePlugin, htmlPlugin],
        tabWidth: 2, useTabs: false, printWidth: 80, semi: true
      });
      const formatted = result.replace(/\\n$/, '');
      if (formatted === before) {message.textContent = 'Already formatted.'; return;}
      pushUndo();
      const priorLine = state.caret.line;
      state.lines = formatted.split('\\n');
      state.caret = {line: Math.min(priorLine, state.lines.length - 1), col: 0};
      state.extraCarets = []; state.selection = null;
      markDirty(); recomputeMatches(); render(); editor.focus();
      message.textContent = 'Document formatted. Undo restores the previous source.';
    } catch (error) {message.textContent = `Format failed: ${error.message}`;}
  }
  function syntaxForLine(line) {
    const value = textContent();
    if (syntaxSource !== value || syntaxMode !== mode) {
      syntaxSource = value; syntaxMode = mode;
      syntaxCache = state.lines.map(() => []);
      const add = (start, end, kind) => {
        let offset = 0;
        for (let i = 0; i < state.lines.length && offset < end; i++) {
          const right = offset + state.lines[i].length;
          if (start < right && end > offset) syntaxCache[i].push({start: Math.max(0, start - offset), end: Math.min(right, end) - offset, kind});
          offset = right + 1;
        }
      };
      if (mode === 'js') {
        try {
          const stream = tokenizer(value, {ecmaVersion: 'latest', sourceType: 'script', onComment: (_block, _text, start, end) => add(start, end, 'comment')});
          for (;;) {
            const token = stream.getToken();
            if (token.type.label === 'eof') break;
            const label = token.type.label;
            const kind = token.type.keyword ? 'keyword' : label === 'string' || label === 'template' ? 'string' : label === 'num' ? 'number' : null;
            if (kind) add(token.start, token.end, kind);
          }
        } catch {}
        try {
          const tree = parse(value, {ecmaVersion: 'latest', sourceType: 'script'});
          const names = new Set();
          walk(tree, node => {
            if (node.type === 'FunctionDeclaration' && node.id) names.add(node.id.name);
            if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' &&
                (node.init?.type === 'FunctionExpression' || node.init?.type === 'ArrowFunctionExpression')) names.add(node.id.name);
          });
          walk(tree, node => {
            if (node.type === 'FunctionDeclaration' && node.id) add(node.id.start, node.id.end, 'function');
            if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' &&
                (node.init?.type === 'FunctionExpression' || node.init?.type === 'ArrowFunctionExpression')) add(node.id.start, node.id.end, 'function');
            if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && names.has(node.callee.name)) {
              add(node.callee.start, node.callee.end, 'function');
            }
          });
        } catch {}
      } else {
        for (let start = 0; start < value.length; start++) {
          if (value.startsWith('<!--', start)) {
            const close = value.indexOf('-->', start + 4);
            const end = close < 0 ? value.length : close + 3;
            add(start, end, 'comment'); start = end - 1; continue;
          }
          if (value[start] !== '<' || !/^<\\/?[A-Za-z]/.test(value.slice(start))) continue;
          let quote = null, end = start + 1;
          for (; end < value.length; end++) {
            const char = value[end];
            if (quote) { if (char === quote) quote = null; }
            else if (char === '"' || char === "'") quote = char;
            else if (char === '>') break;
          }
          const segment = value.slice(start, Math.min(end + 1, value.length));
          const tag = /^<\\/?([A-Za-z][\\w:-]*)/.exec(segment);
          if (tag) add(start + segment.indexOf(tag[1]), start + segment.indexOf(tag[1]) + tag[1].length, 'tag');
          for (const attr of segment.matchAll(/([A-Za-z_:][\\w:.-]*)\\s*=/g)) add(start + attr.index, start + attr.index + attr[1].length, 'attribute');
          for (const quoted of segment.matchAll(/"[^"]*"|'[^']*'/g)) add(start + quoted.index, start + quoted.index + quoted[0].length, 'string');
          start = end;
        }
      }
      for (const tokens of syntaxCache) tokens.sort((a,b) => a.start - b.start || (a.kind === 'function' ? -1 : 1));
    }
    return syntaxCache[line] || [];
  }
'''

footer = '''
  render();
  return {
    getValue: textContent,
    setValue,
    setMode,
    format: formatDocument,
    undo,
    redo,
    focus: () => editor.focus(),
    destroy: () => { editor.removeEventListener('keydown', onKey); host.replaceChildren(); }
  };
}
'''

with destination.open('w', encoding='utf-8', newline='\n') as stream:
    stream.write(header + '\n' + '\n'.join('  ' + line if line else '' for line in core.splitlines()) + footer)
print(destination)
