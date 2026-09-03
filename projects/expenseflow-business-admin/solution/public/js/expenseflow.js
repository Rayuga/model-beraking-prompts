'use strict';
// `el` is intentionally NOT redeclared here — app.js already declares it as a
// top-level const, and classic <script> tags on one page share a single global
// lexical environment, so a second `const el` in this file is a fatal
// redeclaration SyntaxError (it broke both scripts silently until caught here).
// This file's top-level functions are only ever invoked later, via
// window.renderWorkspaces, by which time app.js has already loaded and `el`
// (along with the rest of the shared globals it declares) is in scope.

function badgeClass(state) {
  const m = {
    POSTED: 'badge ok', APPROVED: 'badge info', ADJUDICATED: 'badge info', FILED: 'badge muted',
    LIVE: 'badge ok', SUPERSEDED: 'badge muted', PAID: 'badge ok',
  };
  return m[state] || 'badge muted';
}

function kv(k, v, decoy) {
  return el('div', { class: 'kv' }, [
    el('div', { class: 'k', text: k }),
    el('div', { class: 'v' }, [
      el('span', { text: v == null ? '—' : String(v) }),
      decoy ? el('span', { class: 'decoy', text: `not this — ${decoy}` }) : null,
    ]),
  ]);
}

/* ---- Dashboard ----------------------------------------------------------- */
function renderDashboard(boot) {
  const reports = boot.reports || [];
  const centers = boot.cost_centers || [];
  const byState = {};
  for (const r of reports) byState[r.state] = (byState[r.state] || 0) + 1;
  const liveReimbursable = reports.filter((r) => r.state === 'POSTED')
    .reduce((a, r) => a + (r.net_report_reimbursable_cents || 0), 0);
  const vatOutstanding = reports.reduce((a, r) => a + ((r.records || {}).vat_net_cents || 0), 0);
  const totalHeadroom = centers.reduce((a, c) => a + (c.headroom_cents || 0), 0);

  const page = el('section', { class: 'page', 'data-workspace': 'dashboard' }, [
    el('h1', { text: 'Dashboard' }),
    el('div', { class: 'cards' }, [
      el('article', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('span', { class: 'strong', text: 'Reports by state' })]),
        el('dl', { class: 'stat-list' }, Object.entries(byState).length
          ? Object.entries(byState).map(([st, n]) => el('div', {}, [el('dt', { text: st }), el('dd', { class: 'mono', text: String(n) })]))
          : [el('div', {}, [el('dt', { text: 'No reports' }), el('dd', { text: '' })])]),
      ]),
      el('article', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('span', { class: 'strong', text: 'Live posted reimbursable' })]),
        el('div', { class: 'mono', style: 'font-size:22px;margin-top:6px', text: money(liveReimbursable) }),
        el('div', { class: 'muted small', text: 'Sum of net reimbursable across posted reports' }),
      ]),
      el('article', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('span', { class: 'strong', text: 'VAT reclaim outstanding' })]),
        el('div', { class: 'mono', style: 'font-size:22px;margin-top:6px', text: money(vatOutstanding) }),
        el('div', { class: 'muted small', text: 'Net of reclaim accruals and reversals' }),
      ]),
      el('article', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('span', { class: 'strong', text: 'Total cost-center headroom' })]),
        el('div', { class: 'mono', style: 'font-size:22px;margin-top:6px', text: money(totalHeadroom) }),
        el('div', { class: 'muted small', text: 'Budget minus live commitment rows, all centers' }),
      ]),
    ]),
    el('section', { class: 'panel' }, [
      el('h2', { text: 'Recent activity' }),
      el('ul', { class: 'list' }, (boot.audit || []).slice(0, 12).length
        ? boot.audit.slice(0, 12).map((a) => el('li', { class: 'row' }, [
            el('span', { class: 'mono muted small', text: a.created_at }),
            el('span', { class: 'strong', text: a.action }),
            el('span', { class: 'mono small', text: a.subject || '' }),
            el('span', { class: 'muted small', text: a.actor_id ? `by ${a.actor_id}` : '' }),
            el('span', { class: 'muted small', text: a.detail || '' }),
          ]))
        : [el('li', { class: 'muted', text: 'No activity yet.' })]),
    ]),
  ]);
  return page;
}

/* ---- File / edit a report (proxy) ------------------------------------------ */
const CATEGORIES = ['lodging', 'airfare', 'meals', 'mileage', 'ground', 'entertainment'];

function lineItemRow(existing) {
  const category = el('select', { 'aria-label': 'Category' }, CATEGORIES.map((c) => el('option', { value: c, text: c, selected: existing && existing.category === c ? '' : null })));
  const currency = el('select', { 'aria-label': 'Currency' }, ['USD', 'EUR'].map((c) => el('option', { value: c, text: c, selected: existing && existing.currency === c ? '' : null })));
  const amount = el('input', { type: 'number', step: '0.01', min: '0', 'aria-label': 'Claimed amount (dollars/euros)', placeholder: 'amount', value: existing && existing.claimed_cents != null && existing.miles == null ? (existing.claimed_cents / 100).toFixed(2) : '' });
  const miles = el('input', { type: 'number', step: '1', min: '0', 'aria-label': 'Miles (mileage lines only)', placeholder: 'miles', value: existing && existing.miles != null ? existing.miles : '' });
  const txnDate = el('input', { type: 'text', 'aria-label': 'Transaction date', placeholder: 'YYYY-MM-DD', value: existing ? existing.txn_date : '' });
  const nights = el('input', { type: 'number', step: '1', min: '0', 'aria-label': 'Nights (lodging only)', placeholder: 'nights', value: existing && existing.nights != null ? existing.nights : '' });
  const row = el('div', { class: 'form-grid', style: 'border-top:1px solid var(--line);padding-top:8px;margin-top:8px' }, [
    el('label', {}, [el('span', { text: 'Category' }), category]),
    el('label', {}, [el('span', { text: 'Currency' }), currency]),
    el('label', {}, [el('span', { text: 'Amount' }), amount]),
    el('label', {}, [el('span', { text: 'Miles' }), miles]),
    el('label', {}, [el('span', { text: 'Txn date' }), txnDate]),
    el('label', {}, [el('span', { text: 'Nights' }), nights]),
  ]);
  return { row, category, currency, amount, miles, txnDate, nights };
}

// Shared builder for both filing a new report (POST) and editing a still-FILED one
// (PATCH). The rules engine reads line_items/report_allocations generically, so
// this form needs no support from rules.js — it is plain CRUD around the same rows.
function reportFormNodes(H, boot, existing) {
  const { api, flash, refresh, closeDetail } = H;
  const employees = boot.employees || [];
  const centers = boot.cost_centers || [];
  const groups = [];
  for (let i = 0; i < centers.length; i += 3) if (centers[i + 2]) groups.push(centers.slice(i, i + 3));

  const employeeSelect = el('select', { 'aria-label': 'Employee' },
    employees.map((e) => el('option', { value: e.id, text: e.name, selected: existing && existing.employee_id === e.id ? '' : null })));
  const title = el('input', { type: 'text', required: true, 'aria-label': 'Title', value: existing ? existing.title : '' });
  const depart = el('input', { type: 'text', required: true, 'aria-label': 'Trip depart (UTC)', placeholder: 'YYYY-MM-DDTHH:MM:SSZ', value: existing ? existing.trip_depart_at : '' });
  const ret = el('input', { type: 'text', required: true, 'aria-label': 'Trip return (UTC)', placeholder: 'YYYY-MM-DDTHH:MM:SSZ', value: existing ? existing.trip_return_at : '' });
  const groupSelect = el('select', { 'aria-label': 'Cost-center group (50/30/20, first is the residual plug)' },
    groups.map((g, i) => el('option', { value: String(i), text: g.map((c) => c.id).join(' / ') + ' (' + g[0].id + ' plug)' })));
  if (existing && existing.allocation && existing.allocation.length) {
    const plugId = (existing.allocation.find((a) => a.is_plug) || {}).cost_center_id;
    const idx = groups.findIndex((g) => g[0].id === plugId);
    if (idx >= 0) groupSelect.value = String(idx);
  }

  const linesWrap = el('div', { id: 'line-items-wrap' });
  const lineRows = [];
  function addLineRow(seedLine) {
    const lr = lineItemRow(seedLine);
    lineRows.push(lr);
    linesWrap.append(lr.row);
  }
  // A report can only be edited while still FILED (the server refuses otherwise),
  // and `computed.lines` carries every raw input field (category/currency/claimed
  // amount/miles/txn_date/nights) alongside the derived ones, so it doubles as the
  // prefill source — no separate "raw line items" endpoint is needed.
  const prefillLines = existing && existing.computed && existing.computed.lines || [];
  if (prefillLines.length) for (const l of prefillLines) addLineRow(l);
  else addLineRow(null);
  const addLineBtn = el('button', { type: 'button', class: 'action small secondary', onclick: () => addLineRow(null) }, ['+ Add line']);
  const removeLineBtn = el('button', { type: 'button', class: 'action small secondary', onclick: () => { const lr = lineRows.pop(); if (lr) lr.row.remove(); } }, ['− Remove last line']);

  const errorBox = el('p', { class: 'error small' });
  const submit = el('button', {
    type: 'button', class: 'action',
    onclick: async () => {
      errorBox.textContent = '';
      const g = groups[Number(groupSelect.value)];
      if (!g) { errorBox.textContent = 'no cost-center group available'; return; }
      const allocation = [
        { cost_center_id: g[0].id, pct_bp: 5000, is_plug: 1 },
        { cost_center_id: g[1].id, pct_bp: 3000, is_plug: 0 },
        { cost_center_id: g[2].id, pct_bp: 2000, is_plug: 0 },
      ];
      const line_items = lineRows.map((lr) => ({
        category: lr.category.value, currency: lr.currency.value,
        amount_cents: lr.amount.value ? Math.round(Number(lr.amount.value) * 100) : null,
        miles: lr.miles.value ? Number(lr.miles.value) : null,
        txn_date: lr.txnDate.value, nights: lr.nights.value ? Number(lr.nights.value) : null,
      }));
      const body = { employee_id: employeeSelect.value, title: title.value, trip_depart_at: depart.value, trip_return_at: ret.value, allocation, line_items };
      const method = existing ? 'PATCH' : 'POST';
      const path = existing ? `/api/reports/${existing.id}` : '/api/reports';
      const r = await api(method, path, body);
      if (!r.ok) { errorBox.textContent = (r.data && r.data.error) || `request failed (${r.status})`; return; }
      flash(`${r.data.id} ${existing ? 'updated' : 'filed'}.`, 'ok');
      closeDetail();
      await refresh();
    },
  }, [existing ? 'Save changes' : 'File report']);

  return [
    el('label', {}, [el('span', { text: 'Employee' }), employeeSelect]),
    el('label', {}, [el('span', { text: 'Title' }), title]),
    el('div', { class: 'form-grid' }, [
      el('label', {}, [el('span', { text: 'Trip depart (UTC)' }), depart]),
      el('label', {}, [el('span', { text: 'Trip return (UTC)' }), ret]),
    ]),
    el('label', {}, [el('span', { text: 'Cost-center group' }), groupSelect]),
    el('div', { class: 'section-title', text: 'Line items' }),
    linesWrap,
    el('div', { class: 'row', style: 'margin-top:8px' }, [addLineBtn, removeLineBtn]),
    el('div', { class: 'row', style: 'margin-top:14px' }, [submit]),
    errorBox,
  ];
}

/* ---- Reports -------------------------------------------------------------- */
function lineDetailRows(l) {
  const rows = [];
  const claimedLabel = l.miles != null ? `${l.miles} mi` : l.claimed_display;
  rows.push(kv(`L${l.line_no} · ${l.category} · ${l.currency}`, claimedLabel));
  if (l.rate_display) {
    const decoys = (l.decoy_conversions || []).map((d) => `${d.rate_display} on ${d.as_of_date} → ${d.converted_display}`).join(' / ');
    rows.push(kv('FX rate used (line’s own transaction date)', `${l.rate_display} on ${l.txn_date} → ${l.converted_display}`, decoys || null));
  }
  if (l.decoy_mileage_irs_display) {
    rows.push(kv('Mileage @ stated $0.57/mi', l.claimed_display, `${l.decoy_mileage_irs_display} (recalled IRS rate) / ${l.decoy_mileage_alt_display}`));
  }
  if (l.per_diem) {
    rows.push(kv(`Per-diem entitlement (${l.per_diem.blocks} half-open 6h blocks)`, l.per_diem.entitlement_display,
      `${l.per_diem.decoy_calendar_days_display} (calendar days) / ${l.per_diem.decoy_ceil_days_display} (ceil days) / ${l.per_diem.decoy_inclusive_blocks_display} (inclusive edge)`));
  }
  if (l.cap_display != null) rows.push(kv('Binding cap', l.cap_display));
  rows.push(kv('Reimbursable', l.reimbursable_display, l.cap_kind === 'non_reimbursable' ? l.claimed_display + ' if paid in full' : null));
  if (l.disallowed_cents > 0) rows.push(kv('Disallowed excess', l.disallowed_display));
  else rows.push(kv('Disallowed excess', 'none (at/under cap mints no record)'));
  if (l.vat_eligible) rows.push(kv('VAT-reclaim contribution (this line, post-cap)', l.vat_contribution_display, `${l.decoy_vat_precap_display} if taken pre-cap`));
  return rows;
}

function reportDrawerNodes(rep, H, role, boot) {
  const { actionButton, openDetail } = H;
  const c = rep.computed || {};
  const rec = rep.records || {};
  const nodes = [];
  nodes.push(el('div', { class: 'row' }, [
    el('span', { class: badgeClass(rep.state), text: rep.state },),
    el('span', { class: 'muted small', text: `${(rep.employee || {}).name || rep.employee_id} · filed by ${(rep.filer || {}).name || rep.filed_by}` }),
  ]));
  nodes.push(el('div', { class: 'muted small', text: `trip [${rep.trip_depart_at}, ${rep.trip_return_at})` }));
  if (rep.approver) nodes.push(kv('Approved by', `${rep.approver.name} (${rep.approved_tier} tier)`));

  nodes.push(el('div', { class: 'section-title', text: 'Line adjudication' }));
  for (const l of (c.lines || [])) for (const row of lineDetailRows(l)) nodes.push(row);

  nodes.push(el('div', { class: 'section-title', text: 'Report totals' }));
  nodes.push(kv('Report reimbursable (Σ line reimbursables)', c.reimbursable_total_display, `${c.decoy_pay_as_claimed_display} if paid as claimed, no caps`));
  nodes.push(kv('Disallowed total (Σ line disallowances)', c.disallowed_total_display));
  nodes.push(kv('VAT-reclaim accrual (eligible post-cap base ' + c.vat_eligible_base_display + ')', c.vat_accrual_display,
    `${c.decoy_vat_whole_report_display} whole report / ${c.decoy_vat_precap_eligible_display} pre-cap / ${c.decoy_vat_exclusive_display} exclusive rate`));
  nodes.push(kv('Approval tier needed (on computed reimbursable)', c.required_tier, `${c.tier_on_claimed} if gated on the claim`));

  if (c.split && c.split.rows) {
    nodes.push(el('div', { class: 'section-title', text: 'Cost-center split (residual plug)' }));
    for (const r of c.split.rows) {
      nodes.push(kv(`${r.cost_center_id}${r.is_plug ? ' (plug)' : ` (${(r.pct_bp / 100).toFixed(2)}%)`}`, r.amount_display,
        r.is_plug ? `${r.decoy_independent_display} if rounded independently → phantom sum ${c.split.decoy_three_independent_sum_display}` : null));
    }
  }

  if (rec.line_postings && rec.line_postings.length) {
    nodes.push(el('div', { class: 'section-title', text: 'Posted records' }));
    for (const p of rec.line_postings) nodes.push(kv(`Line posting ${p.line_no} · ${p.category}`, `${p.reimbursable_display}${p.disallowed_cents > 0 ? ' (disallowed ' + p.disallowed_display + ')' : ''}`));
    for (const d of rec.disallowances || []) nodes.push(kv(`Disallowance · ${d.category}`, d.amount_display));
    for (const a of rec.vat_accruals || []) nodes.push(kv(`VAT ${a.kind}${a.is_reversal ? ' (reversal)' : ''}`, a.amount_display));
    if (rec.vat_accruals && rec.vat_accruals.length) nodes.push(kv('Net VAT-reclaim accrual', money(rec.vat_net_cents)));
    for (const cm of rec.commitments || []) nodes.push(kv(`Commitment · ${cm.cost_center_id} · ${cm.state}${cm.supersedes_id ? ' · supersedes ' + cm.supersedes_id : ''}`, cm.amount_display));
    for (const rv of rec.recoveries || []) nodes.push(kv(`Employee recovery · line ${rv.line_id}`, rv.amount_display));
    nodes.push(kv('Net report reimbursable (current live commitments)', rep.net_report_reimbursable_display));
  }

  // Controls are shown for the role that can actually use them (a courtesy, per
  // the rules — hiding one is never itself the enforcement); the server is the
  // real authority and refuses the matching request from any other role or state.
  nodes.push(el('div', { class: 'section-title', text: 'Actions' }));
  const actions = [];
  if (rep.state === 'FILED' && role === 'proxy') {
    actions.push(el('button', {
      type: 'button', class: 'action small secondary',
      onclick: () => openDetail(`Edit ${rep.id}`, reportFormNodes(H, boot, rep)),
    }, ['Edit (proxy)']));
  }
  if (rep.state === 'FILED' && role === 'finance') actions.push(actionButton('Adjudicate (finance)', 'POST', `/api/reports/${rep.id}/adjudicate`));
  if (rep.state === 'ADJUDICATED' && role === 'approver') actions.push(actionButton('Approve (as me)', 'POST', `/api/reports/${rep.id}/approve`));
  if (rep.state === 'APPROVED' && role === 'finance') actions.push(actionButton('Post (finance)', 'POST', `/api/reports/${rep.id}/post`));
  if (rep.state === 'POSTED' && role === 'finance') {
    const rejectable = (rec.line_postings || []).filter((p) => p.reimbursable_cents > 0);
    if (rejectable.length) {
      const select = el('select', { 'aria-label': `Line to reject on ${rep.id}` },
        rejectable.map((p) => el('option', { value: p.line_id, text: `${p.line_id} · ${p.category} · ${p.reimbursable_display}` })));
      actions.push(el('div', { class: 'row' }, [select, actionButton('Reject receipt (finance)', 'POST', `/api/reports/${rep.id}/reject-receipt`, () => ({ line_id: select.value }), { secondary: true })]));
    } else {
      actions.push(el('span', { class: 'muted small', text: 'No reimbursed line left to reject.' }));
    }
  }
  if (!actions.length) actions.push(el('span', { class: 'muted small', text: 'No action available here for your role right now.' }));
  nodes.push(el('div', { class: 'row' }, actions));
  return nodes;
}

function renderReports(boot, H) {
  const { openDetail } = H;
  const reports = boot.reports || [];
  const role = (boot.user || {}).role;

  function openReport(rep) {
    openDetail(`${rep.id} · ${rep.title}`, reportDrawerNodes(rep, H, role, boot));
  }

  function reportRow(rep) {
    return el('tr', {}, [
      el('td', { class: 'mono strong', text: rep.id }),
      el('td', { text: (rep.employee || {}).name || rep.employee_id }),
      el('td', { text: rep.title }),
      el('td', {}, [el('span', { class: badgeClass(rep.state), text: rep.state })]),
      el('td', { class: 'mono num', text: rep.net_report_reimbursable_display || (rep.computed || {}).reimbursable_total_display || '—' }),
      el('td', { class: 'muted small', text: (rep.filer || {}).name || rep.filed_by }),
      el('td', {}, [el('button', { type: 'button', class: 'action small secondary', onclick: () => openReport(rep) }, ['Details'])]),
    ]);
  }

  const searchInput = el('input', {
    type: 'search', 'aria-label': 'Search reports', placeholder: 'Search reports (id, employee, title, state)',
  });
  const tbody = el('tbody', {}, reports.map(reportRow));
  searchInput.addEventListener('keyup', () => {
    const q = searchInput.value.trim().toLowerCase();
    tbody.innerHTML = '';
    const filtered = !q ? reports : reports.filter((r) =>
      [r.id, (r.employee || {}).name, r.employee_id, r.title, r.state].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    for (const r of filtered) tbody.append(reportRow(r));
  });

  const fileBtn = role === 'proxy'
    ? el('button', { type: 'button', class: 'action', onclick: () => openDetail('File a new report', reportFormNodes(H, boot, null)) }, ['File a new report'])
    : null;

  return el('section', { class: 'page', 'data-workspace': 'reports' }, [
    el('h1', { text: 'Reports' }),
    el('div', { class: 'row toolbar' }, [el('h2', { class: 'flex-fill', text: 'Expense reports' }), searchInput, fileBtn]),
    el('div', { class: 'table-wrap' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: 'Reference' }), el('th', { text: 'Employee' }), el('th', { text: 'Title' }),
          el('th', { text: 'State' }), el('th', { class: 'num', text: 'Reimbursable' }), el('th', { text: 'Filed by' }), el('th', { text: 'Actions' }),
        ])]),
        tbody,
      ]),
    ]),
  ]);
}

/* ---- Cost Centers ----------------------------------------------------------- */
function renderCostCenters(boot, H) {
  const { openDetail } = H;
  const centers = boot.cost_centers || [];

  function openCenter(cc) {
    const nodes = [
      kv('Budget', cc.budget_display),
      kv('Headroom (budget − Σ live commitment rows)', cc.headroom_display, `${cc.stored_scalar_headroom_display} stored scalar, not live`),
      kv('Committed (sum of live rows)', cc.committed_display),
      el('div', { class: 'section-title', text: 'Commitment rows' }),
      ...(cc.commitments || []).map((c) => kv(
        `${c.id}${c.is_prior ? ' (prior)' : ''} · ${c.report_id || '—'} · ${c.state}${c.supersedes_id ? ' · supersedes ' + c.supersedes_id : ''}${c.superseded_by_id ? ' · superseded by ' + c.superseded_by_id : ''}`,
        c.amount_display)),
    ];
    openDetail(`${cc.id} · ${cc.name}`, nodes);
  }

  return el('section', { class: 'page', 'data-workspace': 'cost-centers' }, [
    el('h1', { text: 'Cost Centers' }),
    el('div', { class: 'cards' }, centers.map((cc) => el('article', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'mono strong', text: cc.id }),
        el('span', { class: 'muted small', text: cc.name }),
      ]),
      el('dl', { class: 'stat-list' }, [
        el('div', {}, [el('dt', { text: 'Budget' }), el('dd', { class: 'mono', text: cc.budget_display })]),
        el('div', {}, [el('dt', { text: 'Headroom (live rows)' }), el('dd', { class: 'mono', text: cc.headroom_display })]),
        el('div', {}, [el('dt', { text: 'Stored scalar (decoy)' }), el('dd', { class: 'mono muted', text: cc.stored_scalar_headroom_display })]),
        el('div', {}, [el('dt', { text: 'Committed' }), el('dd', { class: 'mono', text: cc.committed_display })]),
      ]),
      el('button', { type: 'button', class: 'action small secondary', onclick: () => openCenter(cc) }, ['Commitment rows']),
    ]))),
  ]);
}

/* ---- Audit ------------------------------------------------------------------ */
function renderAudit(boot, H) {
  const rows = boot.audit || [];
  return el('section', { class: 'page', 'data-workspace': 'audit' }, [
    el('h1', { text: 'Audit' }),
    el('div', { class: 'panel' }, [
      el('p', { class: 'muted small', text: 'Append-only. Every adjudication, approval, posting and rejection is recorded here with the figure it computed; entries cannot be edited or removed.' }),
      el('div', { class: 'table-wrap' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: 'When (UTC)' }), el('th', { text: 'Action' }), el('th', { text: 'Subject' }), el('th', { text: 'Actor' }), el('th', { text: 'Detail' }),
          ])]),
          el('tbody', {}, rows.map((a) => el('tr', {}, [
            el('td', { class: 'mono muted small', text: a.created_at }),
            el('td', { class: 'strong', text: a.action }),
            el('td', { class: 'mono small', text: a.subject || '—' }),
            el('td', { class: 'small', text: a.actor_id || '—' }),
            el('td', { class: 'muted small', text: a.detail || '' }),
          ]))),
        ]),
      ]),
    ]),
  ]);
}

/* ---- money helper (server sends *_display strings; this is only a fallback) - */
function money(c) {
  if (c == null) return '—';
  const s = c < 0 ? '-' : '', a = Math.abs(c);
  return `${s}$${Math.floor(a / 100).toLocaleString('en-US')}.${String(a % 100).padStart(2, '0')}`;
}

window.renderWorkspaces = function renderWorkspaces(boot, helpers) {
  return [
    renderDashboard(boot),
    renderReports(boot, helpers),
    renderCostCenters(boot, helpers),
    renderAudit(boot),
  ];
};
