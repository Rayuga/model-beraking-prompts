'use strict';
const assert = require('node:assert/strict');

// Reference-only direct Playwright flow. No browser launch or output on import.
const SUPPORTED = Object.freeze(['S01', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S34', 'S35']);
const equal = (a, b) => { try { assert.deepEqual(a, b); return true; } catch { return false; } };
const occurrences = (text, marker) => text.split(marker).length - 1;

async function runWorkspaceScenario(id, d, l, inputs, emit, state = {}) {
  assert(inputs.freeze_confirmed === true, 'Workspace execution requires confirmed fixture freeze.');
  assert(SUPPORTED.includes(id), `Unsupported workspace scenario ${id}`);
  const spec = inputs.scenarios?.[id];
  assert(spec && typeof spec.protocol === 'string', `Frozen protocol absent for ${id}`);
  const p = d.page, protocol = spec.protocol, f = spec.fixtures || {}, attempts = [], stage = inputs.stage;
  state.workspace ||= {};
  const memory = state.workspace[id] ||= {};
  const say = (key, passed, evidence) => emit(`${id}.${key}`, passed, evidence);
  const attempt = async (label, fn) => {
    try { const value = await fn(); const row = { label, completed: true, value }; attempts.push(row); return row; }
    catch (error) { const row = { label, completed: false, error: String(error), error_name: error.name }; attempts.push(row); return row; }
  };
  const paint = () => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const waitLog = (marker, minimum = 1, timeout = 8500) => p.waitForFunction(({ marker, minimum }) => (document.querySelector('[role="log"]')?.textContent || '').split(marker).length - 1 >= minimum, { marker, minimum }, { timeout });
  const snapshot = async () => ({ fields: await d.fields(), body: await d.body(), logs: await d.logs() });
  const rememberGood = async () => {
    const value = await snapshot(), status = await d.status();
    if (/^Complete/.test(status)) state.currentLastGood = { ...value, status, completed: true, observed_at_ms: l.relative(), source_scenario: id };
    return state.currentLastGood;
  };
  const exactFields = expected => p.waitForFunction(expected => {
    const actual = { title: document.querySelector('input[aria-label="Snippet title"]')?.value, filename: document.querySelector('input[aria-label="Filename"]')?.value,
      code: [...document.querySelectorAll('[aria-label="Code editor"] .cm-line')].map(e => e.textContent).join('\n') };
    return Object.entries(expected).every(([key, value]) => actual[key] === value);
  }, expected);
  const control = async (marker, log = marker, file = 'workspace-control.js') => {
    await d.run(`document.body.innerHTML='<p>${marker}</p>';console.log('${log}');`, file);
    const value = await snapshot();
    assert(value.body.includes(marker) && value.logs.includes(log), 'Authored working control unavailable');
    return value;
  };
  if (id !== 'S01' && id !== 'S17') await attempt('Auto-run setup', () => d.disableAutoIfAvailable());

  if (id === 'S01') {
    if (stage !== 'deferred') {
    const startup = await attempt('Fresh automatic startup', async () => {
      await d.open();await d.completed();
      const value = await snapshot();
      return { ...value, status: await d.status(), manual_run_used: false };
    });
    await say('startup_ready', startup.completed && Boolean(startup.value.fields.code.trim() && startup.value.body.trim() && !/Console is clear/.test(startup.value.logs) && startup.value.logs.trim()), startup);
    await attempt('Disable typing runs after startup observation', () => d.disableAutoIfAvailable());
    }
    let original = memory.original;
    async function chooseOriginal() {
      const picker = p.getByRole('combobox', { name: 'Starter example', exact: true });
      const value = original?.choice || f.example || await picker.locator('option').first().evaluate(option => option.value);
      assert(value, 'No offered built-in example');
      await l.action('choose_example', 'Choose actual built-in example', () => picker.selectOption(value));
      await exactFields({ filename: value });await paint();
      if (original) await exactFields({ filename: original.filename, code: original.code });
      const fields = await d.fields();
      return { choice: value, ...fields };
    }
    if (stage !== 'deferred') {
    const usable = await attempt('Example and authored edit', async () => {
      original = await chooseOriginal();
      memory.original = original;
      await d.run();const example = await snapshot();
      const authored = await control('example-authored-marker', 'example-authored-marker', 'authored.js');
      return { original, example, authored, editable_source: original.code.trim().length > 0 };
    });
    await say('usable_examples', usable.completed && usable.value.editable_source && Boolean(usable.value.example.body.trim()), usable);
    }
    if (stage !== 'initial') {
    await attempt('Disable typing runs before deferred example Save', () => d.disableAutoIfAvailable());
    const separate = await attempt('Saved example copy remains separate', async () => {
      if (!original) original = await chooseOriginal();
      else await chooseOriginal();
      memory.original = original;
      const kind = original.filename.split('.').pop().toLowerCase();
      const comment = kind === 'js' ? '// QC saved copy' : kind === 'css' ? '/* QC saved copy */' : '<!-- QC saved copy -->';
      const code = original.code + '\n' + comment, title = f.saved_title || 'QC Example Saved Copy';
      await d.enter(code, original.filename);await l.action('edit_title', 'Title edited example copy', () => d.title().fill(title));
      const saved = await d.save();
      await d.reload();const builtin = await chooseOriginal();await d.load(saved.record);
      const loaded = await d.fields(), server = (await d.library()).find(row => row.id === saved.record.id);
      return { original, builtin, saved, loaded, server, expected: { title, filename: original.filename, code } };
    });
    await say('example_separate', separate.completed && separate.value.builtin.filename === separate.value.original.filename && separate.value.builtin.code === separate.value.original.code && equal(separate.value.loaded, separate.value.expected) && separate.value.server?.code === separate.value.expected.code, separate);
    }
  }

  if (id === 'S14') {
    const observed = await attempt('Ordered console level stream', async () => {
      const source = protocol.split('\n').filter(line => /^console\.(log|warn|error|info)\('level-/.test(line)).join('\n');
      assert(source.split('\n').length === 4, 'Frozen level fixture changed');
      await d.run(source, 'console-levels.js');
      const rows = await p.getByRole('log').locator('.entry').evaluateAll(elements => elements.map(e => ({ text: e.textContent, level: e.querySelector('.level')?.textContent })));
      const selected = ['log', 'warn', 'error', 'info'].map(level => ({ level, index: rows.findLastIndex(row => row.text.includes(`level-${level}`)) }));
      return { source, rows, selected, status: await d.status() };
    });
    await say('console_level_stream', observed.completed && observed.value.selected.every((row, index, all) => row.index >= 0 && observed.value.rows[row.index].level === row.level && (index === 0 || row.index > all[index - 1].index)) && /^Complete/.test(observed.value.status), observed);
  }

  if (id === 'S15') {
    const observed = await attempt('Inspect actual object and array entries', async () => {
      const source = protocol.split('\n').filter(line => /^console\.log\(/.test(line)).join('\n');
      assert(source.includes('object-check') && source.includes('[11, 22, 33]'), 'Frozen object fixture changed');
      await d.run(source, 'console-values.js');
      const object = p.getByRole('log').locator('.entry').filter({ hasText: 'object-check' }).last();
      const array = p.getByRole('log').locator('.entry').filter({ hasText: 'Array(3)' }).last();
      await l.action('console_expand', 'Open logged object', () => object.locator('details').first().locator(':scope > summary').click());
      const nested = object.locator('.tree > div').filter({ hasText: /^nested:/ }).first().locator('details').first();
      await l.action('console_expand', 'Open nested object', () => nested.locator(':scope > summary').click());
      await l.action('console_expand', 'Open logged array', () => array.locator('details').first().locator(':scope > summary').click());
      return { object: await object.innerText(), array: await array.innerText() };
    });
    await say('console_value_inspection', observed.completed && ['tag:', 'object-check', 'nested:', 'deep:', 'nested-value'].every(text => observed.value.object.includes(text)) && ['0:', '1:', '2:', '11', '22', '33'].every(text => observed.value.array.includes(text)), observed);
  }

  if (id === 'S16') {
    const consoleArea = p.getByRole('log');
    const geometry = () => consoleArea.evaluate(e => ({ top: e.scrollTop, height: e.clientHeight, total: e.scrollHeight, bottom: e.scrollHeight - e.scrollTop - e.clientHeight < 24 }));
    if (stage !== 'clear') {
    const initial = await attempt('Forty rows and duration', async () => {
      await d.run("for(let i=0;i<40;i++) console.log('row-'+i);", 'console-rows.js');
      return { logs: await d.logs(), status: await d.status(), geometry: await geometry() };
    });
    await say('console_duration', initial.completed && /^Complete/.test(initial.value.status) && /\b\d+(?:\.\d+)?\s*ms\b/.test(initial.value.status), initial);
    const up = await attempt('Preserve deliberate reading position', async () => {
      if (!initial.completed) await d.run("for(let i=0;i<40;i++) console.log('row-'+i);", 'console-rows.js');
      await l.action('console_scroll', 'Scroll console away from bottom', async () => { await consoleArea.hover();await p.mouse.wheel(0, -10000);await paint(); });
      const before = await geometry();await d.run("console.log('after-scroll-up');", 'console-scroll.js');await paint();
      return { before, after: await geometry(), logs: await d.logs() };
    });
    const down = await attempt('Follow new row at bottom', async () => {
      await l.action('console_scroll', 'Scroll console to bottom', async () => { await consoleArea.hover();await p.mouse.wheel(0, 10000);await paint(); });
      const before = await geometry();await d.run("console.log('after-scroll-down');", 'console-scroll.js');await paint();
      return { before, after: await geometry(), logs: await d.logs() };
    });
    const allForty = text => { const markers = new Set(text.match(/row-\d+\b/g) || []);return Array.from({ length: 40 }, (_, i) => `row-${i}`).every(marker => markers.has(marker)); };
    await say('console_history', up.completed && down.completed && allForty(up.value.logs) && allForty(down.value.logs) && down.value.logs.includes('after-scroll-up') && down.value.logs.includes('after-scroll-down'), { initial, up, down });
    await say('console_scroll_policy', up.completed && down.completed && !up.value.before.bottom && Math.abs(up.value.after.top - up.value.before.top) <= 3 && !up.value.after.bottom && down.value.before.bottom && down.value.after.bottom, { up, down });
    memory.history = { initial, up, down };
    if (down.completed) await rememberGood();
    }
    if (stage !== 'history') {
    const cleared = await attempt('Ordinary Clear console action', async () => {
      if (!(await consoleArea.locator('.entry').count())) await d.run("console.log('clear-control');", 'clear-control.js');
      const before = await d.logs();await l.action('clear_console', 'Activate ordinary Clear console', () => p.getByRole('button', { name: 'Clear console', exact: true }).click());
      await p.waitForFunction(() => !document.querySelectorAll('[role="log"] .entry').length);
      return { before, after: await d.logs(), rows_after: await consoleArea.locator('.entry').count() };
    });
    await say('console_clear_control', cleared.completed && cleared.value.rows_after === 0, cleared);
    }
  }

  if (id === 'S17') {
    const auto = p.getByRole('checkbox', { name: 'Auto-run', exact: true });
    const source = marker => `document.body.innerHTML='<p>${marker}</p>';console.log('${marker}');`;
    const edit = async code => l.action('edit_source', 'Real source edit for measured debounce', async () => {
      await d.editor().click();await p.keyboard.press('Control+A');await p.keyboard.insertText(code);
      const at = l.relative();assert.equal(await d.source(), code);return at;
    });
    let delay = null, windowMs = 3000, manualOn, manualOff, first;
    first = await attempt('Measure first actual automatic execution', async () => {
      assert(await auto.count(), 'Auto-run control absent');await auto.uncheck();await d.enter(source('auto-initial-control'), 'auto.js');
      await l.action('auto_run_toggle', 'Enable Auto-run', () => auto.check());
      const editAt = await edit(source('auto-fired'));await waitLog('auto-fired', 1, 2500);const observedAt = l.relative();await d.completed();
      delay = observedAt - editAt;windowMs = Math.max(3000, delay + 1000);
      return { edit_at_ms: editAt, observed_at_ms: observedAt, delay_ms: delay, body: await d.body(), logs: await d.logs() };
    });
    manualOn = await attempt('Manual Run while on and source quiescent', async () => {
      assert(await auto.count(), 'Auto-run control absent');
      if (!first.completed) { await auto.check();await edit(source('auto-fired'));await l.wait(p, 3000, 'Independent manual-on fallback: let the allowed debounce interval expire without further edits'); }
      const unchanged = await d.source(), before = occurrences(await d.logs(), 'auto-fired');
      await d.run();await waitLog('auto-fired', before + 1);
      return { unchanged_source: unchanged === await d.source(), before, after: occurrences(await d.logs(), 'auto-fired'), auto_checked: await auto.isChecked(), fallback_used: !first.completed };
    });
    const debounce = await attempt('Continuous edits reset observed debounce', async () => {
      if (!(delay > 0 && delay <= 2500)) throw new Error('Measured positive debounce unavailable; cannot invent a fixed interval.');
      let sequence;
      for (let trial = 0; trial < 2; trial++) {
        const gap = Math.max(10, Math.min(80, delay / 5)), n = Math.ceil(delay / gap) + 3, times = [], markers = [];
        await auto.check();
        for (let i = 0; i < n; i++) {
          const marker = `auto-sequence-${trial}-${i}-end`;markers.push(marker);times.push(await edit(source(marker)));
          if (i < n - 1) await l.wait(p, gap, 'Active debounce-reset edit spacing');
        }
        await waitLog(markers.at(-1), 1, 2500);const observedAt = l.relative();await d.completed();
        const logs = await d.logs(), setup = times.at(-1) - times[0] > delay && times.slice(1).every((at, i) => at - times[i] < delay);
        sequence = { trial, markers, edit_times_ms: times, setup_valid: setup, final_delay_ms: observedAt - times.at(-1), intermediate_executed: markers.slice(0, -1).filter(marker => logs.includes(marker)), body: await d.body() };
        if (setup) break;
      }
      windowMs = Math.max(windowMs, sequence.final_delay_ms + 1000);
      return sequence;
    });
    await say('autorun_debounce', first.completed && first.value.delay_ms <= 2500 && first.value.body.includes('auto-fired') && debounce.completed && debounce.value.setup_valid && debounce.value.final_delay_ms <= 2500 && debounce.value.intermediate_executed.length === 0, { first, debounce });
    const off = await attempt('Off state leaves new source idle', async () => {
      await auto.uncheck();const before = await snapshot();await edit(source('auto-off'));await l.wait(p, windowMs, 'Full measured Auto-run-off absence window');const after = await snapshot();
      return { before, after, window_ms: windowMs, unexecuted: after.body === before.body && occurrences(after.logs, 'auto-off') === occurrences(before.logs, 'auto-off') };
    });
    await say('autorun_off_stays_idle', off.completed && off.value.unexecuted, off);
    manualOff = await attempt('Manual Run while off', async () => {
      if (!off.completed) { await d.disableAutoIfAvailable();await d.enter(source('auto-off'), 'auto.js'); }
      const before = occurrences(await d.logs(), 'auto-off');await d.run();await waitLog('auto-off', before + 1);
      return { before, after: occurrences(await d.logs(), 'auto-off'), auto_checked: await auto.isChecked(), body: await d.body() };
    });
    const queued = await attempt('Switching off cancels a pending edit', async () => {
      let result;
      for (let trial = 0; trial < 2; trial++) {
        const marker = `auto-queued-${trial}`, before = await snapshot();
        const timing = await l.action('auto_run_queue_cancel', 'Batch actual edit then disable before debounce', async () => {
          await auto.check();const editAt = await edit(source(marker));await auto.uncheck();return { edit_at_ms: editAt, off_at_ms: l.relative() };
        });
        await l.wait(p, windowMs, 'Full queued Auto-run cancellation observation window');
        const after = await snapshot();
        result = { marker, before, after, ...timing, window_ms: windowMs, setup_valid: delay !== null && timing.off_at_ms - timing.edit_at_ms < delay,
          unexecuted: after.body === before.body && occurrences(after.logs, marker) === occurrences(before.logs, marker) };
        if (result.setup_valid) break;
      }
      return result;
    });
    await say('autorun_off_cancels_queue', queued.completed && queued.value.setup_valid && queued.value.unexecuted, queued);
    const queuedManual = await attempt('Same queued source runs manually afterward', async () => {
      if (!queued.completed) { await d.disableAutoIfAvailable();await d.enter(source('auto-queued-recovery'), 'auto.js'); }
      const marker = queued.completed ? queued.value.marker : 'auto-queued-recovery', before = occurrences(await d.logs(), marker);
      await d.run();await waitLog(marker, before + 1);return { before, after: occurrences(await d.logs(), marker), body: await d.body() };
    });
    await say('manual_run_independent_of_autorun', manualOn.completed && manualOn.value.unchanged_source && manualOn.value.auto_checked && manualOn.value.after > manualOn.value.before && manualOff.completed && !manualOff.value.auto_checked && manualOff.value.after > manualOff.value.before, { manual_on: manualOn, manual_off: manualOff, queued_source_control: queuedManual });
    if (queuedManual.completed) await rememberGood();
    await attempt('Leave Auto-run off', () => d.disableAutoIfAvailable());
  }

  if (id === 'S18') {
    const sizes = async () => ({ editor: await p.getByRole('region', { name: 'Editor', exact: true }).boundingBox(), preview: await p.getByRole('region', { name: 'Live preview', exact: true }).boundingBox(), console: await p.getByRole('region', { name: 'Console', exact: true }).boundingBox() });
    const moved = await attempt('Move both actual divider controls', async () => {
      const before = await sizes();
      for (const [name, key] of [['Resize editor and preview', 'ArrowRight'], ['Resize preview and console', 'ArrowDown']]) await l.action('pane_resize', name, async () => { const divider = p.getByRole('separator', { name, exact: true });await divider.focus();await divider.press(key);await divider.press(key);await divider.press(key); });
      await paint();return { before, after: await sizes() };
    });
    const changed = moved.completed && Math.abs(moved.value.after.editor.width - moved.value.before.editor.width) > 2 && Math.abs(moved.value.after.preview.height - moved.value.before.preview.height) > 2 && Object.values(moved.value.after).every(box => box && box.width > 0 && box.height > 0);
    await say('pane_dividers_work', changed, moved);
    const persisted = await attempt('Reload actual resized allocations', async () => { const before = await sizes();await d.reload();await paint();return { before, after: await sizes() }; });
    await say('pane_sizes_persist', changed && persisted.completed && ['editor', 'preview', 'console'].every(name => Math.abs(persisted.value.before[name].width - persisted.value.after[name].width) <= 2 && Math.abs(persisted.value.before[name].height - persisted.value.after[name].height) <= 2), { moved, persisted });
  }

  if (id === 'S19') {
    const populated = await attempt('Populate editor for visible font and gutter', () => d.enter('const data = { value: 1 };\nconsole.log(data.value);', 'editor.js'));
    const font = await attempt('Observe actual editor font metrics', () => d.editor().evaluate(e => {
      const style = getComputedStyle(e), canvas = document.createElement('canvas'), context = canvas.getContext('2d');context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return { family: style.fontFamily, size: style.fontSize, narrow_width: context.measureText('iiiiiiii').width, wide_width: context.measureText('WWWWWWWW').width };
    }));
    await say('editor_monospace', font.completed && Math.abs(font.value.narrow_width - font.value.wide_width) < 0.5, { populated, font });
    const numbers = await attempt('Read rendered line-number gutter', () => p.locator('.cm-lineNumbers .cm-gutterElement').allTextContents());
    await say('editor_line_numbers', populated.completed && numbers.completed && ['1', '2'].every(n => numbers.value.map(text => text.trim()).includes(n)), numbers);
    const colour = [];
    for (const [file, source] of [['colour.js', 'const value = "string";\nconsole.log(value);'], ['colour.html', '<!doctype html><html><body><h1 class="mark">Hello</h1></body></html>'], ['colour.css', 'body { color: red; margin: 2px; }']]) {
      colour.push(await attempt(`Visible syntax ${file}`, async () => { await d.enter(source, file);await paint();return { file, source, colours: await d.editor().locator('.cm-line').evaluateAll(lines => [...new Set(lines.flatMap(line => [getComputedStyle(line).color, ...[...line.querySelectorAll('span')].map(span => getComputedStyle(span).color)]))]) }; }));
    }
    await say('editor_syntax_colouring', colour.every(row => row.completed && row.value.colours.length > 1), { languages: colour });
    const brackets = await attempt('Observe matching complete brace pair', async () => {
      await d.enter('const data = { value: 1 };', 'braces.js');
      await l.action('editor_cursor', 'Place caret beside complete closing brace', async () => { await d.editor().press('End');await d.editor().press('ArrowLeft'); });await paint();
      return p.locator('.cm-matchingBracket').evaluateAll(elements => elements.map(e => ({ text: e.textContent, background: getComputedStyle(e).backgroundColor, outline: getComputedStyle(e).outlineStyle, visible: e.getBoundingClientRect().width > 0 })));
    });
    await say('editor_matching_brackets', brackets.completed && brackets.value.length >= 2 && brackets.value.every(row => row.visible) && brackets.value.some(row => row.text === '{') && brackets.value.some(row => row.text === '}'), brackets);
  }

  if (id === 'S20') {
    const original = protocol.split('\n').filter(line => /^const (alpha|beta|gamma) = /.test(line)).join('\n');
    assert(original.split('\n').length === 3, 'Frozen multiline fixture changed');
    const select = async () => { await d.editor().click();await p.keyboard.press('Control+A'); };
    const indented = await attempt('Tab consistently indents three selected lines', async () => {
      await d.enter(original, 'indent.js');await l.action('editor_indent', 'Select three lines and Tab', async () => { await select();await p.keyboard.press('Tab'); });
      const actual = await d.source(), lines = actual.split('\n'), prefixes = lines.map(line => line.match(/^\s*/)[0]);
      return { original, actual, prefixes, valid: lines.length === 3 && prefixes[0].length > 0 && prefixes.every(prefix => prefix === prefixes[0]) && lines.every((line, index) => line.slice(prefixes[index].length) === original.split('\n')[index]) };
    });
    await say('editor_multiline_indent', indented.completed && indented.value.valid, indented);
    const unindented = await attempt('Shift+Tab independently removes one level', async () => {
      const fallback = !indented.completed || !indented.value.valid;
      if (fallback) await d.enter(original.split('\n').map(line => '  ' + line).join('\n'), 'indent.js');
      // Reselect explicitly; retention of the original selection is not required.
      await l.action('editor_unindent', 'Select all indented lines and Shift+Tab', async () => { await select();await p.keyboard.press('Shift+Tab'); });
      return { actual: await d.source(), expected: original, manually_indented_fallback: fallback };
    });
    await say('editor_multiline_unindent', unindented.completed && unindented.value.actual === original, unindented);
  }

  if (id === 'S34') {
    const working = await attempt('Theme actual working-state handoff or fallback', async () => {
      const actual = await snapshot(), prior = state.currentLastGood, status = await d.status();
      if (prior?.completed && /^Complete/.test(status) && equal(actual, { fields: prior.fields, body: prior.body, logs: prior.logs })) return { reused: true, source_scenario: prior.source_scenario, actual };
      return { reused: false, actual: await control('theme-control-preview', 'theme-control-log') };
    });
    const styles = () => p.evaluate(() => Object.fromEntries([['chrome', document.body], ['editor', document.querySelector('.cm-editor')], ['console', document.querySelector('[role="log"]')]].map(([name, element]) => { const style = getComputedStyle(element);return [name, { color: style.color, background: style.backgroundColor }]; })));
    let before;
    const switched = await attempt('Two actual appearance switches', async () => {
      before = { work: await snapshot(), styles: await styles() };
      await l.action('theme_switch', 'Switch to other theme', () => p.getByRole('button', { name: /^(Light|Dark) theme$/ }).click());await paint();const middle = { work: await snapshot(), styles: await styles() };
      await l.action('theme_switch', 'Switch back to original theme', () => p.getByRole('button', { name: /^(Light|Dark) theme$/ }).click());await paint();const after = { work: await snapshot(), styles: await styles() };
      return { before, middle, after };
    });
    await say('theme_actual_switch', switched.completed && ['chrome', 'editor', 'console'].every(name => !equal(switched.value.before.styles[name], switched.value.middle.styles[name]) && equal(switched.value.before.styles[name], switched.value.after.styles[name])), { working, switched });
    await say('theme_work_preserved', switched.completed && equal(switched.value.before.work, switched.value.middle.work) && equal(switched.value.before.work, switched.value.after.work), switched);
  }

  if (id === 'S35') {
    const docs = await attempt('Read visible keyboard documentation', () => p.locator('#keyboard-help').innerText());
    const text = docs.completed ? docs.value : '';
    const documented = { run: /Ctrl(?:\/Cmd)?\+Enter\s+Run/i.test(text), save: /Ctrl(?:\/Cmd)?\+S\s+Save/i.test(text), clear: /Ctrl(?:\/Cmd)?\+Shift\+K\s+Clear/i.test(text) };
    const code = memory.code || "document.body.innerHTML='<p>keyboard-marker</p>';console.log('keyboard-log');";
    memory.code = code;memory.documentation = text;
    let prepared = memory.prepared;
    if (stage !== 'deferred') {
    prepared = await attempt('Prepare one shortcut draft', async () => { await d.newDraft();await d.enter(code, 'keyboard.js');return d.fields(); });
    memory.prepared = prepared;
    const run = await attempt('Documented Run shortcut only', async () => {
      assert(documented.run, 'Run binding absent from visible documentation');
      if (!prepared.completed) { await d.newDraft();await d.enter(code, 'keyboard.js'); }
      await l.action('shortcut_run', 'Use documented Control+Enter', () => p.keyboard.press('Control+Enter'));await waitLog('keyboard-log');await d.completed();return snapshot();
    });
    await say('shortcut_run', documented.run && run.completed && run.value.body.includes('keyboard-marker') && run.value.logs.includes('keyboard-log'), { documentation: text, prepared, run });
    }
    if (stage !== 'initial') {
    const saved = await attempt('Documented Save shortcut only', async () => {
      assert(documented.save, 'Save binding absent from visible documentation');
      if (stage === 'deferred') { await d.newDraft();await d.enter(code, 'keyboard.js'); }
      if ((await d.source()) !== code) await d.enter(code, 'keyboard.js');
      await l.action('edit_title', 'Title the same shortcut draft', () => d.title().fill(f.title || 'QC Keyboard Save'));await l.action('edit_filename', 'Filename for shortcut save', () => d.filename().fill('qc-keyboard.js'));
      const expected = await d.fields();
      const response = await d.captureMutation('shortcut_save', () => p.keyboard.press('Control+s'), ['POST', 'PUT']);
      if (response.ok) await p.getByRole('status').filter({ hasText: /Saved.*revision/ }).waitFor();
      if (!d.libraryUrl && d.listCandidates.size === 1) d.libraryUrl = [...d.listCandidates.keys()][0];
      const records = await d.library(), actual = records.find(row => row.id === response.data?.id);
      return { expected, response, actual, exact: actual && equal({ title: actual.title, filename: actual.filename, code: actual.code }, expected) };
    });
    await say('shortcut_save', documented.save && saved.completed && saved.value.response.ok && Boolean(saved.value.exact), { documentation: text, saved });
    }
    if (stage !== 'deferred') {
    const cleared = await attempt('Documented Clear shortcut only', async () => {
      assert(documented.clear, 'Clear binding absent from visible documentation');
      if (!(await p.getByRole('log').locator('.entry').count())) await d.run("console.log('shortcut-clear-control');", 'shortcut-clear.js');
      const before = await d.logs();await l.action('shortcut_clear', 'Use documented Control+Shift+K', () => p.keyboard.press('Control+Shift+k'));
      await p.waitForFunction(() => !document.querySelectorAll('[role="log"] .entry').length);
      return { before, after: await d.logs(), rows_after: await p.getByRole('log').locator('.entry').count() };
    });
    await say('shortcut_clear', documented.clear && cleared.completed && cleared.value.rows_after === 0, { documentation: text, cleared });
    }
  }
  return { scenario: id, scope: 'Local observed product facts only; no Oracle/current score', attempts };
}

module.exports = { runWorkspaceScenario, SUPPORTED };
