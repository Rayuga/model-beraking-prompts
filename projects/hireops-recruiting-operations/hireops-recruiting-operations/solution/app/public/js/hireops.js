'use strict';
/* HireOps domain workspaces.
 *
 * Defines window.renderWorkspaces(boot, helpers) BEFORE app.js loads, returning the
 * Requisitions, Offers, Equity Table, Referrals and Audit Trail pages. The shell
 * (app.js) supplies the navigation, dashboard, theme control and the drawer used
 * for record detail and for the revise / rescind forms. Every derived figure is
 * rendered from the server's own view objects rather than recomputed here.
 */
(function () {
  window.renderWorkspaces = function renderWorkspaces(boot, H) {
    const { el, actionButton, openDetail, openForm, money, fmtTime, userName, romanTier } = H;
    const role = boot.user && boot.user.role;
    const cents = (value) => {
      const text = String(value);
      if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Enter a nonnegative dollar amount with at most two decimal places.');
      const [whole, fraction = ''] = text.split('.');
      const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
      if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('That amount is too large.');
      return Number(result);
    };
    const dollars = (value) => {
      const amount = BigInt(value || 0);
      return `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
    };
    const units = (value) => {
      if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error('Enter a nonnegative whole number of equity units.');
      return Number(value);
    };
    const dateInstant = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)) throw new Error('Enter a calendar date (YYYY-MM-DD) or a UTC instant such as 2027-01-31T12:30:00.125Z.');
      const instant = value.length === 10 ? value + 'T00:00:00Z' : value;
      const parsed = new Date(instant);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== instant.slice(0, 19)) throw new Error('Enter a real calendar date and valid UTC time.');
      return instant;
    };

    const kv = (k, v) => el('div', { class: 'kv' }, [
      el('div', { class: 'k', text: k }),
      el('div', { class: 'v', 'data-field': k }, [el('span', { text: v == null ? '—' : String(v) })]),
    ]);
    const statusPill = (s) => el('span', { class: 'status ' + String(s || '').toLowerCase(), text: s });

    /* ---------------------------------------------------------------- Requisitions */
    function reqCard(r) {
      return el('article', { class: 'entity', 'data-entity': r.id }, [
        el('h4', {}, [el('span', { text: `${r.id} · ${r.title}` }), el('span', { class: 'muted', text: r.dept })]),
        kv('annualized budget', r.budget_display),
        kv('committed (Σ of live commitment rows)', r.committed_sum_display),
        kv('headroom (budget − Σ committed)', r.headroom_display),
        kv('linked offers', (r.offers || []).join(', ') || '—'),
        el('div', { class: 'sub' }, [
          el('h5', { text: 'Commitment movements behind that headroom' }),
          ...((r.movements || []).length
            ? r.movements.map((m) => kv(`${m.kind} · ${m.offer_id}`, m.movement_display))
            : [el('p', { class: 'empty-line', text: 'No commitments posted against this requisition yet.' })]),
        ]),
      ]);
    }

    const draftReqForm = () => {
      const idIn = el('input', { id: 'req-id', type: 'text', value: 'REQ-NEW-1' });
      const titleIn = el('input', { id: 'req-title', type: 'text', value: 'New Requisition' });
      const deptIn = el('input', { id: 'req-dept', type: 'text', value: 'Engineering' });
      const budgetIn = el('input', { id: 'req-budget', type: 'number', value: '300000', min: '0', step: '0.01', required: '' });
      return el('section', { class: 'panel' }, [
        el('h2', { text: 'Draft a requisition' }),
        el('div', { class: 'form-grid' }, [
          el('label', { class: 'field' }, [el('span', { text: 'Requisition id' }), idIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Title' }), titleIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Department' }), deptIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Annualized budget (dollars)' }), budgetIn]),
          el('div', {}, [actionButton('Create requisition', 'POST', '/api/requisitions', () => ({
            id: idIn.value, title: titleIn.value.trim(), dept: deptIn.value.trim(),
            budget_cents: cents(budgetIn.value),
          }))]),
        ]),
      ]);
    };

    const requisitionsPage = el('section', { class: 'page', 'data-workspace': 'requisitions' }, [
      el('h1', { text: 'Requisitions' }),
      el('p', { class: 'muted', text: 'Open requisitions and their live budget headroom (summed from commitment rows, never a stored scalar).' }),
      draftReqForm(),
      el('section', { class: 'panel' }, [
        el('h2', { text: 'Open requisitions' }),
        ...(boot.requisitions || []).map(reqCard),
      ]),
    ]);

    /* ---------------------------------------------------------------- Offers */
    function offerDetailNodes(o) {
      const c = o.composition || {};
      const nodes = [];
      nodes.push(el('section', { class: 'sub' }, [
        el('h5', { text: 'Equity terms as priced' }),
        kv('equity units', `${c.equity_units || 0} units`),
        kv('fair value per unit', c.equity_fair_display),
        kv('strike price per unit', c.equity_strike_display),
      ]));
      if ((o.remittances || []).length) nodes.push(el('section', { class: 'sub' }, [
        el('h5', { text: 'Remittance rows (payroll twin)' }),
        ...o.remittances.map((r) => kv(`${r.kind} · ${r.offer_id}`, r.amount_display)),
        kv('lineage net signing outflow', o.net_signing_outflow_display),
      ]));
      if ((o.commitment_movements || []).length) nodes.push(el('section', { class: 'sub' }, [
        el('h5', { text: 'Budget commitment movements' }),
        ...o.commitment_movements.map((m) => kv(m.kind, m.movement_display)),
      ]));
      if (o.clawback) {
        const w = o.clawback;
        nodes.push(el('section', { class: 'sub' }, [
          el('h5', { text: `Signing clawback @ ${w.as_of} (vested ${w.vested_pct})` }),
          kv('clawback (unvested signing)', w.clawback_display),
          kv('signing retained (vested)', w.signing_vested_display),
        ]));
      }
      return nodes;
    }

    function offerCard(o) {
      const c = o.composition || {};
      const marks = [];
      if (o.superseded_by_id) marks.push(`superseded by ${o.superseded_by_id}`);
      if (o.supersedes_id) marks.push(`revises ${o.supersedes_id}`);
      const head = el('h4', {}, [
        el('span', { text: `${o.id} · ${o.candidate}` }),
        el('span', { class: 'muted', text: o.req_id }),
        statusPill(o.status),
        marks.length ? el('span', { class: 'muted', text: marks.join(' · ') }) : null,
      ]);
      const kids = [head,
        kv('base salary', c.base_salary_display),
        kv('signing bonus (one-time)', c.signing_bonus_display),
        kv('relocation (one-time)', c.relocation_display),
        kv('equity intrinsic (units × (fair − strike))', c.equity_intrinsic_display),
        kv('equity annualized (÷4)', c.equity_annualized_display),
        kv('committed run-rate (base + equity/4; one-time excluded)', c.committed_run_rate_display),
        kv('approval band basis (base + signing/2 + equity/4)', c.band_basis_display),
        kv('approval band / required tier', `Band ${c.band} · requires tier ${c.required_tier_label}`),
        kv('raised by', o.raiser ? `${o.raiser.name} (${o.raiser.role})` : (o.raised_by || '—')),
        kv('offer start date', o.start_date),
      ];
      if (o.lineage_ids) kids.push(kv('revision lineage', o.lineage_ids.join(' → ')));
      if (o.approver) kids.push(kv('approved by', `${o.approver.name} (${o.approver.role} · Band ${romanTier(o.approver.authority_tier) || '—'})`));
      if (o.equity_grant) {
        const g = o.equity_grant;
        kids.push(kv('equity grant', `${g.units} units @ strike ${money(g.strike_cents)} · ${g.state}`));
        kids.push(kv('grant start date', g.grant_date), kv('equity vesting schedule', g.schedule_note));
        if (g.cancelled) kids.push(kv('equity cancelled / retained (unvested cancelled)',
          `${g.cancelled.cancelled_units} cancelled / ${g.cancelled.vested_units} retained (vested ${g.cancelled.vested_pct})`));
      }
      if (o.referral_accrual) {
        const ra = o.referral_accrual;
        kids.push(kv('referral accrual → referrer', `${ra.referrer ? ra.referrer.name : ra.referrer_id} · vested ${ra.vested_display}`));
        kids.push(kv('referral originally accrued on offer', ra.offer_id));
      }
      for (const r of (o.remittances || [])) kids.push(kv(`remittance · ${r.kind} · ${r.offer_id}`, r.amount_display));
      kids.push(kv('lineage net signing outflow', o.net_signing_outflow_display));
      if (o.status === 'RESCINDED' && o.rescission_effective_at)
        kids.push(kv('rescission effective date', o.rescission_effective_at));
      if (o.clawback) {
        kids.push(kv('signing clawback (unvested, vest-first)', o.clawback.clawback_display));
        kids.push(kv('signing retained (vested)', o.clawback.signing_vested_display));
      }

      const bar = el('div', { class: 'actionbar' }, [
        el('button', { class: 'link-button', type: 'button', onclick: () => openDetail(`${o.id} — equity terms, remittances & movements`, offerDetailNodes(o)) }, ['Open details']),
      ]);
      if (o.status === 'PENDING' && role === 'approver')
        bar.append(actionButton('Approve ' + o.id, 'POST', '/api/offers/' + encodeURIComponent(o.id) + '/approve', () => ({})));
      if (o.status === 'COMMITTED' && ['recruiter', 'approver', 'finance_controller'].includes(role)) {
        bar.append(el('button', { class: 'action secondary', type: 'button', onclick: () => openForm(
          `Revise ${o.id}`,
          [
            { name: 'base', label: 'New base salary (dollars)', type: 'number', value: dollars(c.base_salary_cents) },
            { name: 'signing', label: 'New signing bonus (dollars)', type: 'number', value: dollars(c.signing_bonus_cents) },
            { name: 'relocation', label: 'New relocation (dollars)', type: 'number', value: dollars(c.relocation_cents) },
            { name: 'units', label: 'New equity units', type: 'number', step: '1', value: (c.equity_units || 0) },
            { name: 'fair', label: 'New equity fair value (dollars/unit)', type: 'number', value: dollars(c.equity_fair_cents) },
            { name: 'strike', label: 'New equity strike (dollars/unit)', type: 'number', value: dollars(c.equity_strike_cents) },
          ],
          'Apply revision',
          (v) => ({ method: 'POST', path: '/api/offers/' + encodeURIComponent(o.id) + '/revise', body: {
            base_salary_cents: cents(v.base), signing_bonus_cents: cents(v.signing), relocation_cents: cents(v.relocation),
            equity_units: units(v.units), equity_fair_cents: cents(v.fair), equity_strike_cents: cents(v.strike),
          } }),
        ) }, ['Revise ' + o.id]));
        if (role === 'finance_controller') bar.append(el('button', { class: 'action danger', type: 'button', onclick: () => openForm(
          `Rescind ${o.id}`,
          [{ name: 'effective_at', label: 'Rescission effective date (YYYY-MM-DD or UTC ISO instant)', type: 'text', value: '' }],
          'Post rescission (Finance controller only)',
          (v) => ({ method: 'POST', path: '/api/offers/' + encodeURIComponent(o.id) + '/rescind', body: { effective_at: dateInstant(v.effective_at) } }),
        ) }, ['Rescind ' + o.id]));
      }
      kids.push(bar);
      return el('article', { class: 'entity', 'data-entity': o.id, 'data-status': o.status }, kids);
    }

    const employees = boot.employees || [];
    const draftOfferForm = () => {
      const idIn = el('input', { id: 'off-id', type: 'text', value: 'OFF-NEW-1' });
      const reqSel = el('select', { id: 'off-req' }, (boot.requisitions || []).map((r) =>
        el('option', { value: r.id, text: `${r.id} · ${r.title}` })));
      const candIn = el('input', { id: 'off-cand', type: 'text', value: 'New Candidate' });
      const baseIn = el('input', { id: 'off-base', type: 'number', value: '0', min: '0', step: '0.01' });
      const signIn = el('input', { id: 'off-sign', type: 'number', value: '0', min: '0', step: '0.01' });
      const relIn = el('input', { id: 'off-rel', type: 'number', value: '0', min: '0', step: '0.01' });
      const unitsIn = el('input', { id: 'off-units', type: 'number', value: '0', min: '0', step: '1' });
      const fairIn = el('input', { id: 'off-fair', type: 'number', value: '0.00', min: '0', step: '0.01' });
      const strikeIn = el('input', { id: 'off-strike', type: 'number', value: '0.00', min: '0', step: '0.01' });
      const refSel = el('select', { id: 'off-ref' }, [el('option', { value: '', text: '(none)' }),
        ...employees.map((e) => el('option', { value: e.id, text: `${e.id} · ${e.name}` }))]);
      const startIn = el('input', { id: 'off-start', type: 'text', value: '2026-09-01', required: '', placeholder: 'YYYY-MM-DD or UTC ISO instant' });
      const refStartIn = el('input', { id: 'off-ref-start', type: 'text', value: '2026-09-01', placeholder: 'YYYY-MM-DD or UTC ISO instant' });
      return el('section', { class: 'panel' }, [
        el('h2', { text: 'Draft a compensation offer' }),
        el('p', { class: 'muted', text: 'Creates a PENDING offer with a full composition breakdown; an approver commits it against the requisition.' }),
        el('div', { class: 'form-grid' }, [
          el('label', { class: 'field' }, [el('span', { text: 'Offer id' }), idIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Requisition' }), reqSel]),
          el('label', { class: 'field' }, [el('span', { text: 'Candidate' }), candIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Base salary (dollars)' }), baseIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Signing bonus (dollars)' }), signIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Relocation (dollars)' }), relIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Equity units' }), unitsIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Equity fair value (dollars/unit)' }), fairIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Equity strike (dollars/unit)' }), strikeIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Referring employee (optional)' }), refSel]),
          el('label', { class: 'field' }, [el('span', { text: 'Start date (YYYY-MM-DD or UTC ISO instant)' }), startIn]),
          el('label', { class: 'field' }, [el('span', { text: 'Referred-hire start (date or UTC ISO instant; drives the referral cliff)' }), refStartIn]),
          el('div', {}, [actionButton('Create offer', 'POST', '/api/offers', () => {
            const body = {
              id: idIn.value, req_id: reqSel.value, candidate: candIn.value.trim(),
              base_salary_cents: cents(baseIn.value),
              signing_bonus_cents: cents(signIn.value || '0'),
              relocation_cents: cents(relIn.value || '0'),
              equity_units: units(unitsIn.value || '0'),
              equity_fair_cents: cents(fairIn.value || '0'),
              equity_strike_cents: cents(strikeIn.value || '0'),
              start_date: dateInstant(startIn.value),
            };
            if (refSel.value) { body.referred_by = refSel.value; body.referred_hire_start = dateInstant(refStartIn.value); }
            return body;
          })]),
        ]),
      ]);
    };

    const offers = boot.offers || [];
    const offersPage = el('section', { class: 'page', 'data-workspace': 'offers' }, [
      el('h1', { text: 'Offers' }),
      el('p', { class: 'muted', text: 'Compensation packages with derived composition, approval-band tiers, dual-control approval, revision (supersede) and rescission (vest-first clawback).' }),
      role !== 'auditor' ? draftOfferForm() : null,
      el('section', { class: 'panel' }, [
        el('h2', { text: 'All offers' }),
        ...(offers.length ? offers.map(offerCard) : [el('p', { class: 'muted', text: 'No offers yet.' })]),
      ]),
    ]);

    /* ---------------------------------------------------------------- Equity Table */
    const grants = boot.equity_grants || [];
    const cancellations = boot.equity_cancellations || [];
    const equityPage = el('section', { class: 'page', 'data-workspace': 'equity' }, [
      el('h1', { text: 'Equity Table' }),
      el('p', { class: 'muted', text: 'Minted equity grants and the append-only cancellation rows written when an offer is rescinded (only unvested units are cancelled).' }),
      el('section', { class: 'panel' }, [
        el('h2', { text: 'Equity grants' }),
        grants.length ? el('div', { class: 'table-wrap' }, [
          el('table', {}, [
            el('thead', {}, el('tr', {}, ['Grant', 'Offer', 'Units', 'Strike', 'Fair', 'State', 'Start date', 'Schedule'].map((h) => el('th', { text: h })))),
            el('tbody', {}, grants.map((g) => el('tr', {}, [
              el('td', { text: g.id }), el('td', { text: g.offer_id }), el('td', { text: g.units }),
              el('td', { text: money(g.strike_cents) }), el('td', { text: money(g.fair_cents) }),
              el('td', {}, [statusPill(g.state)]), el('td', { text: g.grant_date }), el('td', { class: 'muted', text: g.schedule_note }),
            ]))),
          ]),
        ]) : el('p', { class: 'muted', text: 'No equity grants yet.' }),
      ]),
      el('section', { class: 'panel' }, [
        el('h2', { text: 'Equity cancellations' }),
        cancellations.length ? el('div', { class: 'table-wrap' }, [
          el('table', {}, [
            el('thead', {}, el('tr', {}, ['Cancellation', 'Grant', 'Offer', 'Effective', 'Vested units retained', 'Cancelled units'].map((h) => el('th', { text: h })))),
            el('tbody', {}, cancellations.map((x) => el('tr', {}, [
              el('td', { text: x.id }), el('td', { text: x.grant_id }), el('td', { text: x.offer_id }),
              el('td', { text: x.effective_at }), el('td', { text: x.vested_units }), el('td', { text: x.cancelled_units }),
            ]))),
          ]),
        ]) : el('p', { class: 'muted', text: 'No cancellations recorded.' }),
      ]),
    ]);

    /* ---------------------------------------------------------------- Referrals */
    function referralCard(ra) {
      return el('article', { class: 'entity', 'data-entity': ra.id }, [
        el('h4', {}, [el('span', { text: `${ra.id}` }), el('span', { class: 'muted', text: `hire ${ra.candidate}` })]),
        kv('referrer (bonus recipient — employee, not candidate)', ra.referrer ? `${ra.referrer.name} (${ra.referrer_id})` : ra.referrer_id),
        kv('referred hire start', ra.referred_hire_start),
        kv('original offer', ra.offer_id),
        kv('6-month retention cliff', ra.retention_cliff_at),
        kv('total bonus', ra.total_display),
        kv('at-hire half', ra.at_hire_display),
        kv('contingent half (vests at cliff)', ra.contingent_display),
        kv('vested now (vs stored reference moment)', ra.vested_display),
      ]);
    }
    const accruals = boot.referral_accruals || [];
    const referralsPage = el('section', { class: 'page', 'data-workspace': 'referrals' }, [
      el('h1', { text: 'Referrals' }),
      el('p', { class: 'muted', text: 'Referral bonuses accrue to the referring employee (never the candidate), split 50% at hire and 50% at the six-month retention cliff, vested against the one stored reference moment.' }),
      el('section', { class: 'panel' }, [
        el('h2', { text: 'Referral accruals' }),
        ...(accruals.length ? accruals.map(referralCard) : [el('p', { class: 'muted', text: 'No referral accruals yet.' })]),
      ]),
    ]);

    /* ---------------------------------------------------------------- Audit Trail */
    const auditRows = boot.audit || [];
    const afterImages = boot.after_images || [];

    // An after-image is stored as raw figures so it can never drift, but the
    // desk reads money in dollars and cents and equity in whole units, so the
    // snapshot is rendered the same way every other figure on screen is.
    const FIGURE_LABELS = {
      committed_run_rate_cents: 'committed run-rate', band_basis_cents: 'approval band basis',
      band: 'approval band', required_tier: 'required tier', approver_id: 'approved by',
      equity_units: 'equity granted', equity_strike_cents: 'equity strike',
      referral_referrer_id: 'referral credited to', signing_remitted_cents: 'signing remitted',
      supersedes_id: 'supersedes', reversal_cents: 'reversal posted',
      fresh_commit_cents: 'fresh commitment',
      new_committed_run_rate_cents: 'new committed run-rate',
      new_band_basis_cents: 'new approval band basis', effective_at: 'effective date',
      vested_bp: 'signing vested', signing_vested_cents: 'signing retained',
      clawback_cents: 'signing clawback', released_commitment_cents: 'commitment released',
      equity_cancelled_units: 'equity cancelled', equity_vested_units: 'equity retained',
    };

    function figureValue(k, v) {
      if (v === null || v === undefined) return '—';
      if (Array.isArray(v)) return v.map((item) => typeof item === 'object' ? figuresText(item) : String(item)).join(' · ');
      if (typeof v === 'object') return figuresText(v);
      if (k.endsWith('_cents')) return money(v);
      if (k.endsWith('_bp')) return `${(v / 100).toFixed(2)}%`;
      if (k.endsWith('_units')) return `${v} units`;
      if (k === 'required_tier') return romanTier(v) || v;
      if (k === 'approver_id') return userName(v);
      if (k === 'referral_referrer_id') {
        const e = (boot.employees || []).find((x) => x.id === v);
        return e ? e.name : v;
      }
      if (k === 'effective_at') return fmtTime(v);
      return String(v);
    }

    function figuresText(figures) {
      if (!figures) return '—';
      return Object.entries(figures)
        .map(([k, v]) => `${FIGURE_LABELS[k] || k.replace(/_cents$|_bp$/, '').replace(/_/g, ' ')} ${figureValue(k, v)}`)
        .join(' · ') || '—';
    }

    function figureNodes(figures) {
      if (!figures || typeof figures !== 'object') return [el('p', { text: String(figures ?? '—') })];
      return Object.entries(figures).filter(([key]) => !key.endsWith('_display')).map(([key, value]) => {
        const label = FIGURE_LABELS[key] || key.replace(/_cents$|_bp$/, '').replace(/_/g, ' ');
        if (value && typeof value === 'object') {
          if (Array.isArray(value) && value.length === 0) return kv(label, 'None');
          return el('details', { class: 'receipt-group' }, [
            el('summary', { text: label + (Array.isArray(value) ? ` (${value.length})` : '') }),
            el('div', { class: 'receipt-fields' }, figureNodes(value)),
          ]);
        }
        return kv(label, figureValue(key, value));
      });
    }

    function receiptCard(a) {
      const figures = a.figures || {};
      return el('details', { class: 'receipt-card', 'data-receipt': a.id }, [
        el('summary', {}, [
          el('strong', { text: `${a.action} · ${a.offer_id || '—'}` }),
          el('span', { class: 'receipt-meta', text: `${userName(a.actor_id)} · ${fmtTime(a.created_at)}` }),
        ]),
        el('div', { class: 'receipt-body' }, [
          figures.before || figures.after ? el('div', { class: 'receipt-comparison' }, ['before', 'after'].map(side =>
            el('section', { class: 'receipt-state' }, [el('h3', { text: side === 'before' ? 'Before' : 'After' }), ...figureNodes(figures[side])])
          )) : null,
          ...figureNodes(Object.fromEntries(Object.entries(figures).filter(([key]) => key !== 'before' && key !== 'after'))),
        ]),
      ]);
    }

    const auditPage = el('section', { class: 'page', 'data-workspace': 'audit' }, [
      el('h1', { text: 'Audit Trail' }),
      el('p', { class: 'muted', text: 'Append-only audit log and after-image snapshots. Corrections are additions; entries are never edited or deleted.' }),
      el('section', { class: 'panel' }, [
        el('h2', { text: 'Audit log' }),
        el('div', { class: 'table-wrap' }, [
          el('table', {}, [
            el('thead', {}, el('tr', {}, ['When', 'Actor', 'Action', 'Subject', 'Detail'].map((h) => el('th', { text: h })))),
            el('tbody', {}, auditRows.map((a) => el('tr', {}, [
              el('td', { text: fmtTime(a.created_at) }), el('td', { text: userName(a.actor_id) }),
              el('td', { text: a.action }), el('td', { text: a.subject }), el('td', { class: 'muted receipt-text', text: a.detail || '—' }),
            ]))),
          ]),
        ]),
      ]),
      el('section', { class: 'panel' }, [
        el('h2', { text: 'After-images' }),
        afterImages.length ? el('div', { class: 'receipt-list' }, afterImages.map(receiptCard))
          : el('p', { class: 'muted', text: 'No after-images yet.' }),
      ]),
    ]);

    return [requisitionsPage, offersPage, equityPage, referralsPage, auditPage];
  };
})();
