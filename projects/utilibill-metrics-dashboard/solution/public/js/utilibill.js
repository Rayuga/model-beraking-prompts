'use strict';
// `el` is intentionally NOT redeclared here — app.js already declares it as a
// top-level const, and classic <script> tags on one page share a single global
// lexical environment, so a second `const el` in this file would be a fatal
// redeclaration SyntaxError. This file's top-level functions are only ever
// invoked later, via window.renderWorkspaces, by which time app.js has already
// loaded and `el` (along with the rest of the shared globals it declares) is in
// scope.

function badgeClass(state) {
  const m = {
    OPEN: 'badge info', ISSUED_ESTIMATE: 'badge warn', BILLED: 'badge ok',
    FINALIZED: 'badge info', REMITTED: 'badge muted',
    PENDING_APPROVAL: 'badge warn', SUPERSEDED: 'badge muted', ISSUED: 'badge muted',
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

// Builds a "not this" decoy string from [value, label] pairs, dropping any pair whose
// value happens to equal the actual figure on this particular record (a decoy formula
// that reduces to the same number here would just assert the correct figure is wrong).
function notThis(actual, ...pairs) {
  const kept = pairs.filter(([val]) => val != null && val !== actual).map(([val, label]) => `${val} ${label}`);
  return kept.length ? kept.join(' / ') : null;
}

function money(c) {
  if (c == null) return '—';
  const s = c < 0 ? '-' : '', a = Math.abs(c);
  return `${s}$${Math.floor(a / 100).toLocaleString('en-US')}.${String(a % 100).padStart(2, '0')}`;
}

/* ---- Dashboard --------------------------------------------------------------- */
function renderDashboard(boot, H) {
  const accounts = boot.accounts || [];
  const nmAccounts = accounts.filter((a) => a.net_metering);
  const budgetAccounts = accounts.filter((a) => a.budget);
  const totalNmBank = nmAccounts.reduce((a, x) => a + (x.nm_bank_cents || 0), 0);
  const totalDeferred = budgetAccounts.reduce((a, x) => a + ((x.budget || {}).deferred_balance_cents || 0), 0);
  const billedCycles = accounts.flatMap((a) => a.cycles || []).filter((c) => c.bills && c.bills.some((b) => b.kind === 'CYCLE'));
  const totalBilled = billedCycles.reduce((a, c) => a + Math.max(...c.bills.filter((b) => b.kind === 'CYCLE').map((b) => b.total_cents), 0), 0);

  const pol = boot.policy || {};
  const page = el('section', { class: 'page', 'data-workspace': 'dashboard' }, [
    el('h1', { text: 'Dashboard' }),
    el('div', { class: 'cards' }, [
      el('article', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('span', { class: 'strong', text: 'Accounts' })]),
        el('div', { class: 'mono', style: 'font-size:22px;margin-top:6px', text: String(accounts.length) }),
        el('div', { class: 'muted small', text: `${nmAccounts.length} net-metering · ${budgetAccounts.length} budget/levelized` }),
      ]),
      el('article', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('span', { class: 'strong', text: 'Total billed (cycle bills)' })]),
        el('div', { class: 'mono', style: 'font-size:22px;margin-top:6px', text: money(totalBilled) }),
        el('div', { class: 'muted small', text: `${billedCycles.length} metered cycle(s) billed` }),
      ]),
      el('article', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('span', { class: 'strong', text: 'Net-metering bank (sum)' })]),
        el('div', { class: 'mono', style: 'font-size:22px;margin-top:6px', text: money(totalNmBank) }),
        el('div', { class: 'muted small', text: 'Summed from every account’s movement rows' }),
      ]),
      el('article', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('span', { class: 'strong', text: 'Budget deferred balance (sum)' })]),
        el('div', { class: 'mono', style: 'font-size:22px;margin-top:6px', text: money(totalDeferred) }),
        el('div', { class: 'muted small', text: 'Summed from movement rows, less any settled true-up' }),
      ]),
    ]),
    el('section', { class: 'panel' }, [
      el('h2', { text: 'Desk tables (stated synthetic constants)' }),
      el('div', { class: 'form-grid' }, [
        el('div', {}, [
          el('div', { class: 'section-title', text: 'Inclining tier bands' }),
          el('div', { class: 'muted small mono', text: (pol.tier_bands || []).map((b) => `[${b.lo_kwh},${b.hi_kwh == null ? '∞' : b.hi_kwh})@${b.rate_cents_per_kwh}¢`).join('  ') }),
        ]),
        el('div', {}, [
          el('div', { class: 'section-title', text: 'TOU buckets (peak revised mid-cycle)' }),
          el('div', { class: 'muted small mono', text: pol.tou_rates ? `peak ${pol.tou_rates.peak_old_cents_per_kwh}¢→${pol.tou_rates.peak_new_cents_per_kwh}¢ · shoulder ${pol.tou_rates.shoulder_cents_per_kwh}¢ · off-peak ${pol.tou_rates.offpeak_cents_per_kwh}¢` : '—' }),
        ]),
        el('div', {}, [
          el('div', { class: 'section-title', text: 'Riders / fixed / export / dual-control' }),
          el('div', { class: 'muted small mono', text: `RPS ${pol.rps_display}  ·  SBC ${pol.sbc_display}  ·  GRT ${pol.grt_display}  ·  fixed ${pol.fixed_charge_display}  ·  export credit ${pol.export_credit_display}  ·  dual-control ${pol.dual_control_threshold_display}` }),
        ]),
        el('div', {}, [
          el('div', { class: 'section-title', text: 'Mid-cycle peak rate change' }),
          el('div', { class: 'muted small mono', text: pol.rate_change ? `effective ${pol.rate_change.effective_at} (half-open)` : '—' }),
        ]),
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

/* ---- Accounts ------------------------------------------------------------------ */
function billNodes(b, label) {
  const nodes = [el('div', { class: 'section-title', text: label || `${b.kind} bill · ${b.id}` })];
  nodes.push(el('div', { class: 'row' }, [el('span', { class: badgeClass(b.state), text: b.state })]));
  nodes.push(kv('Energy charge', b.energy_display));
  if (b.credit_cents) {
    nodes.push(kv('Export credit applied', b.credit_display, notThis(b.credit_display, [money(b.breakdown && b.breakdown.decoy_credit_at_retail_cents), 'at the retail tier-1 rate'])));
    nodes.push(kv('Energy after credit', b.energy_net_display));
  }
  nodes.push(kv('Fixed charge', b.fixed_display));
  for (const a of (b.accruals || [])) {
    nodes.push(kv(`${a.kind} rider (base ${a.base_display})`, a.amount_display));
  }
  nodes.push(kv('Grand total', b.total_display));
  return nodes;
}

function previewNodes(p) {
  const nodes = [el('div', { class: 'section-title', text: 'Bill preview (server-computed, not yet minted)' })];
  if (p.energy_kind === 'TOU' && p.tou) {
    nodes.push(kv(`Peak (${p.tou.peak_old_kwh} kWh @ old + ${p.tou.peak_new_kwh} kWh @ new, boundary on new)`, p.peak_display,
      notThis(p.peak_display, [p.decoy_peak_whole_new_display, 'whole peak at the new rate'],
        [p.decoy_peak_whole_old_display, 'whole peak at the old rate'],
        [p.decoy_peak_day_split_display, 'a day-count split'],
        [p.decoy_peak_boundary_to_old_display, 'boundary interval wrongly on the old rate'])));
    nodes.push(kv(`Shoulder (${p.tou.shoulder_kwh} kWh)`, money(p.tou.shoulder_cents)));
    nodes.push(kv(`Off-peak (${p.tou.offpeak_kwh} kWh)`, money(p.tou.offpeak_cents)));
  } else if (p.tiers) {
    for (const t of p.tiers) nodes.push(kv(`Tier ${t.tier} (${t.kwh} kWh @ ${t.rate}¢)`, money(t.cents)));
  }
  nodes.push(kv('Energy charge (total)', p.energy_display));
  if (p.net_metering) {
    nodes.push(kv('Export credit (avoided-cost rate)', p.export_credit_display,
      notThis(p.export_credit_display, [p.decoy_credit_at_retail_display, 'at the retail tier-1 rate'])));
    nodes.push(kv('Prior bank + this credit = available', `${p.prior_bank_display} + ${p.export_credit_display} = ${p.available_credit_display}`));
    nodes.push(kv('Energy after credit (energy-only offset)', p.energy_net_display,
      notThis(p.energy_net_display, [p.decoy_total_credit_vs_grand_display, 'credit run against the whole bill'])));
    nodes.push(kv('New net-metering bank (excess carried forward)', p.new_bank_display));
  }
  nodes.push(kv('Fixed charge', p.fixed_display));
  nodes.push(kv('RPS rider (4.00% of gross energy)', p.rps_display,
    notThis(p.rps_display, [p.decoy_rps_on_subtotal_display, 'on the everything-else subtotal'], [p.decoy_rps_on_net_energy_display, 'on net-of-credit energy'])));
  nodes.push(kv('SBC rider (0.90¢/kWh of gross delivered kWh)', p.sbc_display,
    notThis(p.sbc_display, [p.decoy_sbc_on_net_kwh_display, 'on net-of-export kWh'])));
  nodes.push(kv('GRT base (net energy + fixed + RPS + SBC)', money(p.grt_base_cents)));
  nodes.push(kv('GRT rider (2.50% of the base, struck last)', p.grt_display,
    notThis(p.grt_display, [p.decoy_grt_on_energy_only_display, 'on energy only'], [p.decoy_grt_before_riders_display, 'struck before the other riders'], [p.decoy_grt_on_gross_receipts_display, 'on gross (pre-credit) receipts'])));
  nodes.push(kv('Grand total', p.total_display));
  return nodes;
}

function trueupPreviewNodes(t) {
  const nodes = [el('div', { class: 'section-title', text: `True-up preview · ${t.trueup_total_kwh} kWh revealed across ${t.legs.length} accrual period(s)` })];
  nodes.push(kv('Dual-control threshold', t.threshold_display));
  nodes.push(kv('Would need distinct-controller approval', t.needs_approval ? `yes — max contra ${t.max_contra_display} exceeds ${t.threshold_display}` : `no — max contra ${t.max_contra_display} is at/under ${t.threshold_display}`));
  for (const l of t.legs) {
    nodes.push(el('div', { class: 'section-title', text: `${l.label} (${l.cycle_id}) · weight ${l.weight} · allocated ${l.allocated_kwh} kWh` }));
    nodes.push(kv('Re-billed energy (fresh blocks for this period alone)', l.rebill_energy_display,
      notThis(l.rebill_energy_display, [t.decoy_equal_split_legs && money((t.decoy_equal_split_legs.find((x) => x.cycle_id === l.cycle_id) || {}).rebill_energy_cents), 'an equal split across periods'])));
    nodes.push(kv(l.has_estimate ? 'Prior bill to be superseded' : 'Prior bill on file', l.has_estimate ? `${l.estimate_bill_id} · ${l.estimate_total_display}` : 'none — first-time rebill'));
    nodes.push(kv('Contra (re-bill minus the prior bill)', l.has_estimate ? l.contra_display : '— (nothing to contra)'));
  }
  nodes.push(kv('Two-period energy total', t.two_cycle_energy_display, notThis(t.two_cycle_energy_display, [t.decoy_dump_two_cycle_display, 'the whole revealed usage dumped into the read’s own cycle'])));
  return nodes;
}

function trueupBillNodes(b) {
  const bd = b.breakdown || {};
  const nodes = [el('div', { class: 'section-title', text: `Re-bill · ${b.id}` })];
  nodes.push(el('div', { class: 'row' }, [el('span', { class: badgeClass(b.state), text: b.state })]));
  nodes.push(kv('Allocated usage', `${bd.allocated_kwh != null ? bd.allocated_kwh : '—'} kWh (weight ${bd.weight != null ? bd.weight : '—'})`));
  nodes.push(kv('Re-billed energy (this period’s own fresh blocks)', b.total_display));
  if (b.superseded) nodes.push(kv('This bill’s own status', `superseded by ${b.superseded_by_id}`));
  if (bd.estimate_bill_id) {
    nodes.push(kv('Superseded prior bill', `${bd.estimate_bill_id} (retained on file, figure intact)`));
    nodes.push(kv('Contra posted', money(bd.contra_cents)));
  }
  if (b.raiser) nodes.push(kv('Raised by', `${b.raiser.name} (${b.raiser.role})`));
  if (b.approver) nodes.push(kv('Approved by', `${b.approver.name} (${b.approver.role})`));
  for (const c of (b.contras || [])) nodes.push(kv('Contra row', `${c.id} · ${c.amount_display}`));
  return nodes;
}

function cycleCard(cycle, H, role) {
  const { actionButton } = H;
  const nodes = [];
  nodes.push(el('div', { class: 'row' }, [
    el('span', { class: badgeClass(cycle.status), text: cycle.status }),
    el('span', { class: 'mono strong', text: `${cycle.label} · ${cycle.id}` }),
    el('span', { class: 'muted small', text: `${cycle.window_start} → ${cycle.window_end}` }),
  ]));
  const read = cycle.read;
  nodes.push(kv('Meter read', read ? `${read.kind}${read.trueup_total_kwh != null ? ` · reveals ${read.trueup_total_kwh} kWh across ${read.accrual_cycle_ids.length} period(s)` : ` · ${read.delivered_kwh} kWh delivered${read.exported_kwh ? ` · ${read.exported_kwh} kWh exported` : ''}`}` : 'no read on file'));

  const cycleBills = (cycle.bills || []).filter((b) => b.kind === 'CYCLE');
  const rebills = (cycle.bills || []).filter((b) => b.kind === 'REBILL');
  const isTrigger = !!(read && read.trueup_total_kwh != null);
  const openForWrites = cycle.status !== 'FINALIZED' && cycle.status !== 'REMITTED';

  if (cycleBills.length) {
    for (const b of cycleBills) for (const n of billNodes(b, `Cycle bill · ${b.id}`)) nodes.push(n);
  } else if (cycle.bill_preview) {
    for (const n of previewNodes(cycle.bill_preview)) nodes.push(n);
    if (role === 'billing_operator' && openForWrites) {
      nodes.push(el('div', { class: 'row' }, [actionButton('Bill this cycle (billing operator)', 'POST', `/api/cycles/${cycle.id}/bill`)]));
    }
  }

  if (rebills.length) {
    for (const b of rebills) for (const n of trueupBillNodes(b)) nodes.push(n);
    if (isTrigger) {
      const pending = rebills.find((b) => b.state === 'PENDING_APPROVAL');
      if (pending && role === 'settlement_controller') {
        nodes.push(el('div', { class: 'row' }, [actionButton('Approve true-up (settlement controller)', 'POST', `/api/reads/${cycle.id}/trueup/approve`)]));
      }
    }
  } else if (isTrigger && cycle.trueup_preview) {
    for (const n of trueupPreviewNodes(cycle.trueup_preview)) nodes.push(n);
    if (role === 'meter_analyst' && openForWrites) {
      nodes.push(el('div', { class: 'row' }, [actionButton('Raise true-up (meter-data analyst)', 'POST', `/api/reads/${cycle.id}/trueup`)]));
    }
  }

  return el('article', { class: 'card', style: 'grid-column: span 1' }, nodes);
}

function budgetSection(account, H, role) {
  const { actionButton } = H;
  const b = account.budget;
  const nodes = [el('div', { class: 'section-title', text: 'Budget / levelized plan' })];
  nodes.push(kv('Current levelized amount (per cycle)', b.current_levelized_display));
  nodes.push(kv('Deferred balance (summed from movement rows)', b.deferred_balance_display));
  nodes.push(el('div', { class: 'section-title', text: 'Per-cycle movements' }));
  for (const m of b.movements) {
    nodes.push(kv(`Cycle ${m.cycle_no} · actual ${m.actual_display} − levelized ${m.movement_display ? b.current_levelized_display : ''}`, m.movement_display));
  }
  nodes.push(el('div', { class: 'section-title', text: 'Annual true-up' }));
  const plan = b.trueup_plan;
  nodes.push(kv('Anniversary', plan.anniversary_at));
  nodes.push(kv('Reference moment', plan.reference_moment));
  nodes.push(kv('Due now (half-open, at/after anniversary)', plan.due ? 'yes' : 'no'));
  if (b.trueups.length) {
    for (const t of b.trueups) {
      nodes.push(kv('Settled', t.settled_display));
      nodes.push(kv('Re-levelled to (trailing-12 actual)', t.new_levelized_display,
        notThis(t.new_levelized_display, [plan.decoy_levelized_unchanged_display, 'left unchanged'], [plan.decoy_last_cycle_x12_display, 'last cycle × 12 ÷ 12'])));
    }
  } else if (plan.due) {
    nodes.push(kv('Would settle', plan.settle_display));
    nodes.push(kv('Would re-level to', plan.new_levelized_display,
      notThis(plan.new_levelized_display, [plan.decoy_levelized_unchanged_display, 'left unchanged'], [plan.decoy_last_cycle_x12_display, 'last cycle × 12 ÷ 12'])));
    if (role === 'billing_operator') {
      nodes.push(el('div', { class: 'row' }, [actionButton('Run annual true-up (billing operator)', 'POST', `/api/accounts/${account.id}/budget-trueup`)]));
    }
  } else {
    nodes.push(el('div', { class: 'muted small', text: 'Not yet at its enrollment anniversary — no true-up control is offered.' }));
  }
  return nodes;
}

function nmSection(account) {
  const nodes = [el('div', { class: 'section-title', text: 'Net-metering bank' })];
  nodes.push(kv('Bank balance (sum of movement rows)', account.nm_bank_display));
  for (const m of account.nm_bank_movements) nodes.push(kv(`${m.kind} · ${m.created_at}`, m.amount_display));
  return nodes;
}

function accountDrawerNodes(a, H, role) {
  const nodes = [];
  nodes.push(el('div', { class: 'row' }, [
    el('span', { class: 'mono strong', text: a.id }),
    el('span', { class: 'muted small', text: `tariff ${a.tariff}${a.net_metering ? ' · net-metering' : ''}${a.budget ? ' · budget/levelized' : ''}` }),
  ]));
  if (a.budget) for (const n of budgetSection(a, H, role)) nodes.push(n);
  if (a.net_metering) for (const n of nmSection(a)) nodes.push(n);
  nodes.push(el('div', { class: 'section-title', text: 'Cycles' }));
  const grid = el('div', { class: 'form-grid' }, (a.cycles || []).map((c) => cycleCard(c, H, role)));
  nodes.push(grid);
  return nodes;
}

function renderAccounts(boot, H) {
  const { openDetail } = H;
  const accounts = boot.accounts || [];
  const role = (boot.user || {}).role;

  function openAccount(a) {
    openDetail(`${a.id} · ${a.name}`, accountDrawerNodes(a, H, role));
  }

  function accountRow(a) {
    return el('tr', {}, [
      el('td', { class: 'mono strong', text: a.id }),
      el('td', { text: a.name }),
      el('td', { class: 'small', text: a.tariff }),
      el('td', { class: 'small', text: a.net_metering ? 'yes' : 'no' }),
      el('td', { class: 'small', text: a.budget ? 'yes' : 'no' }),
      el('td', { class: 'mono small', text: `${(a.cycles || []).length}` }),
      el('td', {}, [el('button', { type: 'button', class: 'action small secondary', onclick: () => openAccount(a) }, ['Details'])]),
    ]);
  }

  const searchInput = el('input', { type: 'search', 'aria-label': 'Search accounts', placeholder: 'Search accounts (id, name, tariff)' });
  const tbody = el('tbody', {}, accounts.map(accountRow));
  searchInput.addEventListener('keyup', () => {
    const q = searchInput.value.trim().toLowerCase();
    tbody.innerHTML = '';
    const filtered = !q ? accounts : accounts.filter((a) => [a.id, a.name, a.tariff].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    for (const a of filtered) tbody.append(accountRow(a));
  });

  return el('section', { class: 'page', 'data-workspace': 'accounts' }, [
    el('h1', { text: 'Accounts' }),
    el('div', { class: 'row toolbar' }, [el('h2', { class: 'flex-fill', text: 'Customer accounts' }), searchInput]),
    el('div', { class: 'table-wrap' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: 'Account' }), el('th', { text: 'Name' }), el('th', { text: 'Tariff' }),
          el('th', { text: 'Net-metering' }), el('th', { text: 'Budget' }), el('th', { text: 'Cycles' }), el('th', { text: 'Actions' }),
        ])]),
        tbody,
      ]),
    ]),
  ]);
}

/* ---- Settlement ------------------------------------------------------------------ */
function renderSettlement(boot, H) {
  const { actionButton, api, flash, refresh } = H;
  const accounts = boot.accounts || [];
  const periods = boot.periods || [];
  const role = (boot.user || {}).role;

  const billedCycles = accounts.flatMap((a) => (a.cycles || []).map((c) => ({ ...c, account_id: a.id })))
    .filter((c) => c.status === 'BILLED');

  function periodCard(p) {
    const checks = {};
    const checklist = billedCycles.length
      ? billedCycles.map((c) => {
          const cb = el('input', { type: 'checkbox', id: `fin-${p.id}-${c.id}`, onchange: (e) => { checks[c.id] = e.target.checked; } });
          return el('label', { class: 'row', style: 'gap:6px' }, [cb, el('span', { class: 'mono small', text: `${c.id} (${c.account_id})` })]);
        })
      : [el('div', { class: 'muted small', text: 'No billed-but-unfinalized cycles on file right now.' })];

    const nodes = [
      el('div', { class: 'row' }, [
        el('span', { class: 'mono strong', text: p.id }),
        el('span', { class: badgeClass(p.status), text: p.status }),
      ]),
      el('div', { class: 'muted small', text: p.label }),
      el('div', { class: 'section-title', text: 'Finalized cycles' }),
      el('div', { class: 'muted small mono', text: p.finalized_cycle_ids.length ? p.finalized_cycle_ids.join(', ') : 'none yet' }),
      el('div', { class: 'section-title', text: 'Remittance plan (sum of the app’s own rider-accrual rows)' }),
      kv('RPS', p.remittance_plan.rps_display),
      kv('SBC', p.remittance_plan.sbc_display),
      kv('GRT', p.remittance_plan.grt_display),
      kv('Total', p.remittance_plan.total_display),
    ];
    if (p.remittance) {
      nodes.push(el('div', { class: 'section-title', text: 'Released remittance' }));
      nodes.push(kv('Persisted total', p.remittance.total_display));
      nodes.push(kv('Authority acknowledgement', p.remittance.authority_ack || '—'));
    }
    if (p.status !== 'REMITTED' && role === 'billing_operator') {
      nodes.push(el('div', { class: 'section-title', text: 'Finalize billed cycles into this period' }));
      nodes.push(...checklist);
      nodes.push(el('div', { class: 'row' }, [el('button', {
        type: 'button', class: 'action small',
        onclick: async () => {
          const cycle_ids = Object.keys(checks).filter((k) => checks[k]);
          if (!cycle_ids.length) { flash('Select at least one billed cycle to finalize.', 'error'); return; }
          const r = await api('POST', `/api/periods/${p.id}/finalize`, { cycle_ids });
          flash(r.data || `${r.status}`, r.ok ? 'ok' : 'error');
          await refresh();
        },
      }, ['Finalize selected (billing operator)'])]));
    }
    if (p.status === 'OPEN' && p.finalized_cycle_ids.length && role === 'settlement_controller') {
      nodes.push(el('div', { class: 'row', style: 'margin-top:8px' }, [actionButton('Run remittance (settlement controller)', 'POST', `/api/periods/${p.id}/remit`)]));
    }
    return el('article', { class: 'card' }, nodes);
  }

  return el('section', { class: 'page', 'data-workspace': 'settlement' }, [
    el('h1', { text: 'Settlement' }),
    el('div', { class: 'panel' }, [
      el('p', { class: 'muted small', text: 'Finalize billed cycles into a regulatory settlement period, then run the remittance. The remittance figure is summed from the app’s own persisted RPS/SBC/GRT accrual rows across the finalized cycles — never a stored scalar or the twin’s echo.' }),
    ]),
    el('div', { class: 'form-grid' }, periods.map(periodCard)),
  ]);
}

/* ---- Audit ------------------------------------------------------------------------ */
function renderAudit(boot) {
  const audit = boot.audit || [];
  return el('section', { class: 'page', 'data-workspace': 'audit' }, [
    el('h1', { text: 'Audit' }),
    el('div', { class: 'panel' }, [
      el('p', { class: 'muted small', text: 'The append-only audit trail. Every bill, true-up, approval, budget true-up and remittance is recorded here with its computed figure; entries cannot be edited or deleted, by any role.' }),
      el('div', { class: 'table-wrap' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: 'When' }), el('th', { text: 'Action' }), el('th', { text: 'Subject' }), el('th', { text: 'By' }), el('th', { text: 'Detail' }),
          ])]),
          el('tbody', {}, audit.length ? audit.map((a) => el('tr', {}, [
            el('td', { class: 'mono small', text: a.created_at }),
            el('td', { class: 'strong small', text: a.action }),
            el('td', { class: 'mono small', text: a.subject || '' }),
            el('td', { class: 'muted small', text: a.actor_id || '—' }),
            el('td', { class: 'muted small', text: a.detail || '' }),
          ])) : [el('tr', {}, [el('td', { colspan: '5', class: 'muted', text: 'No audit entries yet.' })])]),
        ]),
      ]),
    ]),
  ]);
}

window.renderWorkspaces = function renderWorkspaces(boot, helpers) {
  return [
    renderDashboard(boot, helpers),
    renderAccounts(boot, helpers),
    renderSettlement(boot, helpers),
    renderAudit(boot),
  ];
};
