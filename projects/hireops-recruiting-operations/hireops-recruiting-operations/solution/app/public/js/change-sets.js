'use strict';
/* Coordinated Changes desk.
 *
 * The desk is built once per signed-in person and then patched in place. A live
 * update, a workspace switch or the operator's own save never rebuilds the editor,
 * so typed terms, focus and scroll position stay where the operator left them.
 * Unsent entries are also kept in this browser per user, which is what lets them
 * survive a reload or a session that ends mid-edit.
 */
(function () {
  const TERMS = [
    ['base_salary_cents', 'Base salary', true], ['signing_bonus_cents', 'Signing bonus', true],
    ['relocation_cents', 'Relocation', true], ['equity_units', 'Equity units', false],
    ['equity_fair_cents', 'Equity fair value', true], ['equity_strike_cents', 'Equity strike price', true],
  ];
  const MAX = BigInt(Number.MAX_SAFE_INTEGER);
  const dollars = (n) => { const v = BigInt(n || 0); return `${v / 100n}.${String(v % 100n).padStart(2, '0')}`; };
  const newKey = () => 'chg-' + Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, '0')).join('');
  let desk = null, faultIds = 0;

  window.resetChangeDesk = () => { desk = null; };
  window.renderChangeSets = function (boot, H) {
    if (!desk || desk.userId !== boot.user.id) desk = build(boot, H);
    desk.update(boot);
    return desk.page;
  };

  function build(boot0, H) {
    const { el, money, api, refresh } = H;
    const user = boot0.user;
    const canSave = user.role === 'finance_controller';
    const storeKey = 'hireops.change-entries.' + user.id;
    let boot = boot0;
    let rows = [];
    let attempted = false;          // field faults on empty inputs appear only after a save attempt
    const notices = new Map();      // change-set id -> message that must outlive a live update
    const cards = new Map();        // change-set id -> { node, sig }

    const page = el('section', { class: 'page', 'data-workspace': 'changes' }, [
      el('h1', { text: 'Coordinated Changes' }),
      el('p', { class: 'muted', text: 'Work out several compensation changes together. Figures below update as you enter terms and store nothing; saving a preview reserves nothing; commit posts every member together or none.' }),
    ]);
    const form = el('form', { class: 'panel', 'aria-label': 'Coordinated change editor', novalidate: '' });
    const key = el('input', { type: 'text', value: newKey(), autocomplete: 'off' });
    const container = el('div', { class: 'changeset-members' });
    const footer = el('section', { class: 'sub headroom-footer', 'aria-label': 'Headroom after this change' });
    const summary = el('div', { class: 'error-summary', role: 'alert', tabindex: '-1', hidden: '' });
    const message = el('p', { class: 'desk-status', role: 'status', 'aria-live': 'polite' });
    const add = el('button', { type: 'button', class: 'secondary', text: 'Add member' });
    const submit = canSave ? el('button', { type: 'submit', class: 'action', text: 'Save preview' }) : null;
    form.append(el('h2', { text: canSave ? 'Prepare a compensation change' : 'What-if: work out a compensation change' }));
    if (canSave) form.append(el('label', { class: 'field' }, [el('span', { text: 'Operation key' }), key]));
    else form.append(el('p', { class: 'note', text: 'Your role can work the figures out here but cannot save or commit a change. Nothing you enter is stored on the desk.' }));
    form.append(container, footer, el('div', { class: 'actionbar' }, [add, submit]), summary);
    const history = el('section', { class: 'panel', 'aria-label': 'Saved previews and receipts' }, [el('h2', { text: 'Saved previews and original receipts' })]);
    const list = el('div', { class: 'changeset-list' });
    const empty = el('p', { class: 'muted', text: 'No coordinated changes have been prepared.' });
    history.append(list, empty);
    page.append(form, message, history);

    const currentOffers = () => (boot.offers || []).filter((o) => o.status === 'COMMITTED' && !o.superseded_by_id);
    const offerById = (id) => (boot.offers || []).find((o) => o.id === id);
    const reqById = (id) => (boot.requisitions || []).find((r) => r.id === id);

    /* ------------------------------------------------------------ unsent entries */
    function persist() {
      try {
        localStorage.setItem(storeKey, JSON.stringify({ key: key.value, rows: rows.map((r) => ({
          offer_id: r.source.value, destination_req_id: r.dest.value,
          terms: Object.fromEntries(TERMS.map(([name]) => [name, r.fields[name].value])) })) }));
      } catch { /* storage unavailable: the editor still works for this page view */ }
    }
    function stored() {
      try { const v = JSON.parse(localStorage.getItem(storeKey)); return v && Array.isArray(v.rows) && v.rows.length ? v : null; }
      catch { return null; }
    }
    function forget() { try { localStorage.removeItem(storeKey); } catch { /* nothing kept */ } }

    /* ------------------------------------------------------------ rows */
    function setOptions(select, options, keep) {
      const sig = JSON.stringify(options);
      if (select.dataset.sig === sig && select.value === keep) return;
      select.dataset.sig = sig;
      select.replaceChildren(...options.map(([value, text]) => el('option', { value, text })));
      select.value = keep;
    }
    function syncOptions(row) {
      const src = row.source.value, dst = row.dest.value;
      const offers = currentOffers().map((o) => [o.id, `${o.id}  /  ${o.candidate}`]);
      if (src && !offers.some(([id]) => id === src)) offers.unshift([src, `${src}  /  no longer current`]);
      setOptions(row.source, offers, src);
      const reqs = (boot.requisitions || []).map((r) => [r.id, `${r.id}  /  ${r.title}`]);
      if (dst && !reqs.some(([id]) => id === dst)) reqs.unshift([dst, `${dst}  /  unavailable`]);
      setOptions(row.dest, reqs, dst);
    }
    function fill(row) {
      const o = offerById(row.source.value);
      if (!o) return;
      row.dest.value = o.req_id;
      for (const [name, , isMoney] of TERMS) row.fields[name].value = isMoney ? dollars(o.composition[name]) : String(o.composition[name]);
    }
    function relabel() {
      rows.forEach((row, i) => {
        const n = i + 1;
        row.n = n;
        row.source.setAttribute('aria-label', `Member ${n} source offer`);
        row.dest.setAttribute('aria-label', `Member ${n} destination requisition`);
        row.sourceLabel.textContent = `Member ${n} source offer`;
        row.destLabel.textContent = `Member ${n} destination requisition`;
        for (const [name, label, isMoney] of TERMS) row.labels[name].textContent = `Member ${n} ${label}${isMoney ? ' (dollars)' : ''}`;
        row.remove.textContent = `Remove member ${n}`;
        row.remove.disabled = rows.length <= 2;
      });
      add.disabled = rows.length >= 4;
    }
    function addRow(saved) {
      if (rows.length >= 4) return null;
      const row = { fields: {}, labels: {}, faults: {} };
      row.node = el('fieldset', { class: 'sub member-row' });
      row.legend = el('legend');
      row.source = el('select');
      row.dest = el('select');
      row.sourceLabel = el('span');
      row.destLabel = el('span');
      row.remove = el('button', { type: 'button', class: 'secondary' });
      row.status = el('p', { class: 'row-status', role: 'status' });
      row.figures = el('div', { class: 'row-figures' });
      const grid = el('div', { class: 'form-grid' }, [
        el('label', { class: 'field' }, [row.sourceLabel, row.source]),
        el('label', { class: 'field' }, [row.destLabel, row.dest]),
      ]);
      for (const [name, , isMoney] of TERMS) {
        const input = el('input', { type: 'text', inputmode: isMoney ? 'decimal' : 'numeric', autocomplete: 'off' });
        // The fault sits beside the label, not inside it, so the field keeps its name.
        const fault = el('span', { class: 'field-fault', id: 'fault-' + (++faultIds) });
        input.setAttribute('aria-describedby', fault.id);
        row.fields[name] = input; row.faults[name] = fault; row.labels[name] = el('span');
        grid.append(el('div', {}, [el('label', { class: 'field' }, [row.labels[name], input]), fault]));
        input.addEventListener('input', () => { persist(); compute(); });
      }
      row.node.append(row.legend, grid, row.status, row.figures, el('div', { class: 'actionbar' }, [row.remove]));
      rows.push(row);
      container.append(row.node);
      if (saved) { row.source.dataset.want = saved.offer_id || ''; }
      const wantSrc = saved ? (saved.offer_id || '') : ((currentOffers().find((o) => !rows.some((r) => r !== row && r.source.value === o.id)) || {}).id || '');
      row.source.replaceChildren(el('option', { value: wantSrc, text: wantSrc })); row.source.value = wantSrc;
      const wantDst = saved ? (saved.destination_req_id || '') : '';
      row.dest.replaceChildren(el('option', { value: wantDst, text: wantDst })); row.dest.value = wantDst;
      syncOptions(row);
      if (saved) for (const [name] of TERMS) row.fields[name].value = String((saved.terms || {})[name] ?? '');
      else fill(row);
      row.source.addEventListener('change', () => { fill(row); persist(); compute(); });
      row.dest.addEventListener('change', () => { persist(); compute(); });
      row.remove.addEventListener('click', () => {
        if (rows.length <= 2) return;
        const at = rows.indexOf(row);
        rows.splice(at, 1); row.node.remove();
        relabel(); persist(); compute();
        (rows[Math.min(at, rows.length - 1)].source).focus();
      });
      relabel();
      return row;
    }
    add.addEventListener('click', () => { const row = addRow(); if (row) { persist(); compute(); row.source.focus(); } });
    key.addEventListener('input', persist);

    function resetEditor() {
      for (const row of rows) row.node.remove();
      rows = []; attempted = false; key.value = newKey();
      addRow(); addRow(); forget(); showFaults([]); compute();
    }

    /* ------------------------------------------------------------ live figures */
    function parseTerm(text, isMoney) {
      const t = String(text).trim();
      if (t === '') return { empty: true };
      if (!(isMoney ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/).test(t))
        return { error: isMoney ? 'Use a nonnegative dollar amount with at most two decimal places.' : 'Use a nonnegative whole number of units.' };
      const [a, b = ''] = t.split('.');
      const v = isMoney ? BigInt(a) * 100n + BigInt(b.padEnd(2, '0')) : BigInt(a);
      if (v > MAX) return { error: 'This value is outside the exact range the desk can store.' };
      return { value: v };
    }
    function compose(t) {
      const spread = t.equity_fair_cents > t.equity_strike_cents ? t.equity_fair_cents - t.equity_strike_cents : 0n;
      const intrinsic = t.equity_units * spread;
      const annual = (intrinsic * 2n + 4n) / 8n;                       // intrinsic / 4, half-up, once
      const run = t.base_salary_cents + annual;
      const basis = t.base_salary_cents + (t.signing_bonus_cents + 1n) / 2n + annual;
      if (intrinsic > MAX || run > MAX || basis > MAX) return null;
      const edges = (boot.constants || {}).band_edges_cents || {};
      const band = basis < BigInt(edges.II_floor ?? 0) ? 'I' : basis < BigInt(edges.III_floor ?? 0) ? 'II' : 'III';
      return { run, basis, band };
    }
    const cash = (v) => money(Number(v));
    const line = (label, text) => el('div', { class: 'kv' }, [el('span', { class: 'k', text: label }), el('strong', { class: 'v', text })]);

    /* Reads every row, marks field faults and returns the faults in row order. */
    function compute() {
      const faults = [], counts = {};
      for (const row of rows) counts[row.source.value] = (counts[row.source.value] || 0) + 1;
      const budgets = new Map();
      let complete = true;
      for (const row of rows) {
        const offer = offerById(row.source.value);
        const isCurrent = !!offer && offer.status === 'COMMITTED' && !offer.superseded_by_id;
        row.legend.textContent = `Member ${row.n}${offer ? '  /  ' + offer.candidate : ''}`;
        const terms = {};
        let ok = true;
        for (const [name, label, isMoney] of TERMS) {
          const parsed = parseTerm(row.fields[name].value, isMoney);
          const text = parsed.error || (parsed.empty && attempted ? 'Enter a value.' : '');
          row.faults[name].textContent = text;
          if (text) row.fields[name].setAttribute('aria-invalid', 'true'); else row.fields[name].removeAttribute('aria-invalid');
          if (text) faults.push({ row, name, label, text });
          if (parsed.value === undefined) ok = false; else terms[name] = parsed.value;
        }
        const notes = [];
        if (!row.source.value) notes.push('Choose a current committed offer.');
        else if (!isCurrent) notes.push(`No longer current: ${row.source.value} has been superseded or rescinded since you selected it. Choose the current offer for this hire; your other members are unchanged.`);
        if (row.source.value && counts[row.source.value] > 1) notes.push('This offer is selected in more than one member.');
        if (!row.dest.value || !reqById(row.dest.value)) notes.push('Choose a destination requisition.');
        const comp = ok ? compose(terms) : null;
        if (ok && !comp) notes.push('These terms produce a figure outside the exact range the desk can store.');
        row.status.textContent = notes.join(' ');
        row.node.classList.toggle('stale', !!row.source.value && !isCurrent);
        row.terms = null;
        if (!offer || !comp) { row.figures.replaceChildren(el('p', { class: 'muted', text: 'Figures appear once every term for this member is valid.' })); complete = false; continue; }
        const before = offer.composition;
        const adjust = terms.signing_bonus_cents - BigInt(before.signing_bonus_cents);
        row.figures.replaceChildren(
          line('Run-rate, old to new', `${money(before.committed_run_rate_cents)}  ->  ${cash(comp.run)}`),
          line('Signing adjustment', cash(adjust)),
          line('Approval-band basis, old to new', `${money(before.band_basis_cents)} (Band ${before.band})  ->  ${cash(comp.basis)} (Band ${comp.band})`),
        );
        if (notes.length) { complete = false; continue; }
        row.terms = terms;
        const touch = (id) => { if (!budgets.has(id)) budgets.set(id, BigInt(reqById(id).headroom_cents)); };
        touch(offer.req_id); touch(row.dest.value);
        budgets.set(offer.req_id, budgets.get(offer.req_id) + BigInt(before.committed_run_rate_cents));
        budgets.set(row.dest.value, budgets.get(row.dest.value) - comp.run);
      }
      const head = el('h3', { text: 'Headroom after this change' });
      if (!complete) footer.replaceChildren(head, el('p', { class: 'muted', text: 'Complete every member to see each requisition after the whole change.' }));
      else footer.replaceChildren(head, ...[...budgets.keys()].sort().map((id) => {
        const after = budgets.get(id), over = after < 0n;
        return el('div', { class: 'kv' + (over ? ' over-budget' : ''), 'data-req': id }, [
          el('span', { class: 'k', text: `Headroom  /  ${id}` }),
          el('strong', { class: 'v', text: `${money(reqById(id).headroom_cents)}  ->  ${cash(after)}  /  ${over ? 'Over budget by ' + cash(-after) : 'Fits'}` })]);
      }));
      return faults;
    }

    /* ------------------------------------------------------------ refusals */
    function showFaults(items, lead) {
      summary.replaceChildren();
      summary.hidden = !items.length && !lead;
      if (summary.hidden) return;
      summary.append(el('p', { class: 'error', text: lead || 'This change was not saved. Correct the marked entries; everything else you entered is kept.' }));
      for (const f of items) {
        summary.append(el('button', { type: 'button', class: 'link-button', text: `Member ${f.row.n} ${f.label}: ${f.text}`, onclick: () => f.row.fields[f.name].focus() }));
      }
      summary.focus();
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!canSave) return;
      attempted = true;
      const faults = compute();
      if (faults.length) return showFaults(faults);
      if (!key.value.trim()) return showFaults([], 'Enter an operation key before saving.');
      const blocked = rows.find((r) => !r.terms);
      if (blocked) return showFaults([], `Member ${blocked.n}: ${blocked.status.textContent || 'complete this member before saving.'}`);
      const body = { operation_key: key.value, members: rows.map((r) => ({ offer_id: r.source.value, destination_req_id: r.dest.value,
        ...Object.fromEntries(TERMS.map(([name]) => [name, Number(r.terms[name])])) })) };
      submit.disabled = true; message.textContent = 'Saving the preview...';
      const result = await api('POST', '/api/change-sets/preview', body);
      submit.disabled = false;
      if (result.status === 401) return;
      if (!result.ok) {
        message.textContent = 'Nothing was saved. Your entries are kept.';
        const d = result.data || {}, row = rows[d.member_index], term = TERMS.find(([name]) => name === d.field);
        if (row && term) {
          row.faults[term[0]].textContent = d.error; row.fields[term[0]].setAttribute('aria-invalid', 'true');
          return showFaults([{ row, name: term[0], label: term[1], text: d.error }]);
        }
        return showFaults([], d.error || 'The preview could not be saved. Try again, or use a new operation key.');
      }
      showFaults([]);
      message.textContent = 'Preview saved. Review it below before committing; budgets are not reserved.';
      await refresh();
      const card = cards.get(result.data.id);
      if (card) { card.node.scrollIntoView({ block: 'nearest' }); card.node.querySelector('h3').focus(); }
    });

    /* ------------------------------------------------------------ saved previews and receipts */
    function card(row) {
      const data = row.receipt || row.preview;
      const title = el('h3', { tabindex: '-1', text: `${row.operation_key}  /  ${row.state}` });
      const box = el('article', { class: 'entity', 'data-change-set': row.id, 'data-state': row.state }, [title,
        line('Change set', row.id), line('Actor', data.actor_name || row.actor_id)]);
      if (row.state === 'PREVIEW') {
        box.append(el('p', { class: row.current ? 'fresh-mark' : 'stale-mark', text: row.current
          ? 'Current: nothing this preview relies on has changed since it was saved.'
          : `Out of date: ${(row.stale_reasons || []).join(' ')} It can no longer be committed; prepare the change again under a new operation key.` }));
      }
      for (const r of data.requisitions) box.append(line(`Headroom  /  ${r.req_id}`, `${money(r.before_headroom_cents)}  ->  ${money(r.after_headroom_cents)}`));
      for (const c of data.changes) {
        const comp = c.proposed || c.after.composition;
        box.append(el('section', { class: 'sub' }, [
          el('h4', { text: `${c.candidate || c.before.candidate}  /  ${c.old_offer_id}${c.new_offer_id ? '  ->  ' + c.new_offer_id : ''}` }),
          line('Requisition', `${c.source_req_id}  ->  ${c.destination_req_id}`),
          line('Old / new base salary', `${money(c.before.composition.base_salary_cents)}  ->  ${money(comp.base_salary_cents)}`),
          line('Old / new signing bonus', `${money(c.before.composition.signing_bonus_cents)}  ->  ${money(comp.signing_bonus_cents)}`),
          line('Old / new relocation', `${money(c.before.composition.relocation_cents)}  ->  ${money(comp.relocation_cents)}`),
          line('Old / new run-rate', `${money(c.before.composition.committed_run_rate_cents)}  ->  ${money(comp.committed_run_rate_cents)}`),
          line('Old / new approval-band basis', `${money(c.before.composition.band_basis_cents)}  ->  ${money(comp.band_basis_cents)}`),
          line('Signing adjustment', money(c.signing_adjustment_cents)),
          line('Replacement equity', `${comp.equity_units} units  /  fair ${money(comp.equity_fair_cents)}  /  strike ${money(comp.equity_strike_cents)}`),
          line('Original grant/start instant', c.before.start_date),
        ]));
      }
      const error = el('p', { class: 'error', role: 'alert', tabindex: '-1', text: notices.get(row.id) || '' });
      if (canSave && row.actor_id === user.id) {
        const button = el('button', { type: 'button', class: 'action', text: notices.has(row.id) ? 'Retry this same operation' : row.state === 'COMMITTED' ? 'Retrieve original receipt' : 'Commit reviewed change' });
        button.addEventListener('click', async () => {
          button.disabled = true; message.textContent = 'Committing this saved operation...';
          const result = await api('POST', '/api/change-sets/' + encodeURIComponent(row.id) + '/commit', {});
          button.disabled = false;
          if (result.status === 401) return;
          if (!result.ok) {
            notices.set(row.id, result.status === 0
              ? 'No confirmation was received. This change may or may not have posted. Retry this same operation: it cannot post twice.'
              : (result.data && result.data.error) || 'The commit was refused.');
            message.textContent = 'Nothing was confirmed. Your editor entries are kept.';
            const now = cards.get(row.id).node.querySelector('.error');
            now.textContent = notices.get(row.id); now.focus();
            return;
          }
          notices.delete(row.id);
          message.textContent = 'Committed. This is the original stored receipt; retrying returns it and does not post again.';
          const clean = key.value === row.operation_key;
          await refresh();
          if (clean) resetEditor();            // after the refresh, so the clean editor offers current offers
          const done = cards.get(row.id);
          if (done) done.node.querySelector('h3').focus();
        });
        box.append(button);
      }
      box.append(error);
      return box;
    }
    function syncHistory() {
      const sets = boot.change_sets || [];
      empty.hidden = sets.length > 0;
      const seen = new Set();
      sets.forEach((row, index) => {
        seen.add(row.id);
        const sig = JSON.stringify(row) + '|' + (notices.get(row.id) || '');
        let entry = cards.get(row.id);
        if (!entry || entry.sig !== sig) {
          const node = card(row);
          if (entry) {
            // A rebuilt card hands focus back to the same part the operator was on.
            const held = entry.node.contains(document.activeElement) && document.activeElement;
            entry.node.replaceWith(node);
            if (held) ((held.classList.contains('error') && node.querySelector('.error')) || (held.tagName === 'H3' && node.querySelector('h3'))
              || node.querySelector('button') || node.querySelector('h3')).focus();
          }
          entry = { node, sig };
          cards.set(row.id, entry);
        }
        if (list.children[index] !== entry.node) list.insertBefore(entry.node, list.children[index] || null);
      });
      for (const [id, entry] of cards) if (!seen.has(id)) { entry.node.remove(); cards.delete(id); }
    }

    /* ------------------------------------------------------------ first paint and live patching */
    const saved = stored();
    if (saved) { if (saved.key) key.value = saved.key; for (const r of saved.rows.slice(0, 4)) addRow(r); }
    while (rows.length < 2) addRow();

    return {
      page, userId: user.id,
      update(next) {
        boot = next;
        for (const row of rows) {
          const wasEmpty = !row.source.value;
          syncOptions(row);
          if (wasEmpty && row.source.options.length) { row.source.selectedIndex = Math.min(rows.indexOf(row), row.source.options.length - 1); fill(row); }
        }
        compute();
        syncHistory();
      },
    };
  }
})();
