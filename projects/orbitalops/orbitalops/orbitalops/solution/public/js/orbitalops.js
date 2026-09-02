'use strict';

const CRAFT_CODES = ['SAT-ALPHA', 'SAT-BRAVO', 'SAT-CHARLIE', 'SAT-DELTA'];

function badgeClass(status) {
  const m = {
    EXECUTED: 'badge ok', PASSED: 'badge ok',
    CANCELLED: 'badge muted', DRAFT: 'badge info',
    FAILED: 'badge bad', OPEN: 'badge warn',
  };
  return m[status] || 'badge muted';
}

function renderConstellation(boot, H) {
  const { el, api, flash, refresh } = H;
  const user = boot.user || {};
  const page = el('section', { class: 'page', 'data-workspace': 'constellation' }, [
    el('h1', { text: 'Constellation status' }),
    el('div', { class: 'cards', id: 'craft-cards' }, (boot.craft || []).map((c) => {
      const kids = [
        el('div', { class: 'card-head' }, [
          el('span', { class: 'mono strong', text: c.code }),
          el('span', { class: badgeClass(c.checkout), text: `checkout ${c.checkout}` }),
        ]),
        el('dl', { class: 'stat-list' }, [
          el('div', {}, [el('dt', { text: 'Propellant' }), el('dd', { class: 'mono', text: `${c.propellant_kg} / ${c.tank_kg} kg` })]),
          el('div', {}, [el('dt', { text: 'Battery' }), el('dd', { class: 'mono', text: `${c.battery_pct}%` })]),
          el('div', {}, [el('dt', { text: 'Reserve floor' }), el('dd', { class: 'mono', text: `${c.reserve_pct}%` })]),
        ]),
      ];
      if (user.role === 'flight_director') {
        const select = el('select', { 'aria-label': `Checkout result for ${c.code}` }, [
          el('option', { value: 'PASSED', text: 'PASSED' }),
          el('option', { value: 'FAILED', text: 'FAILED' }),
        ]);
        kids.push(el('div', { class: 'row' }, [
          select,
          el('button', {
            type: 'button', class: 'action',
            onclick: async () => {
              const r = await api('POST', `/api/craft/${c.code}/checkout`, { result: select.value });
              flash(r.ok ? `Checkout recorded for ${c.code}.` : (r.data || r.status), r.ok ? 'ok' : 'error');
              await refresh();
            },
          }, ['Record checkout']),
        ]));
      }
      return el('article', { class: 'card' }, kids);
    })),
    el('section', { class: 'panel' }, [
      el('h2', { text: 'Open anomalies' }),
      el('ul', { class: 'list' }, (boot.anomalies || []).length
        ? boot.anomalies.map((a) => el('li', { class: 'anomaly' }, [
            el('span', { class: 'mono strong', text: a.code }),
            el('span', { class: badgeClass(a.status), text: a.status }),
            el('span', { class: 'muted', text: ` ${a.craft_code} — ${a.summary}` }),
          ]))
        : [el('li', { class: 'muted', text: 'No open anomalies.' })]),
    ]),
    el('section', { class: 'panel' }, [
      el('h2', { text: 'Contact windows' }),
      el('div', { class: 'table-wrap' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: 'Pass' }), el('th', { text: 'Craft' }), el('th', { text: 'Opens' }), el('th', { text: 'Closes' }),
          ])]),
          el('tbody', {}, (boot.passes || []).map((p) => el('tr', {}, [
            el('td', { class: 'mono', text: p.code }),
            el('td', { class: 'mono', text: p.craft_code }),
            el('td', { class: 'mono muted', text: p.opens_at }),
            el('td', { class: 'mono muted', text: p.closes_at }),
          ]))),
        ]),
      ]),
    ]),
  ]);
  return page;
}

function renderQueue(boot, H) {
  const { el, api, flash, refresh, openDetail } = H;
  const user = boot.user || {};
  const canWrite = user.role === 'operator' || user.role === 'flight_director';
  const rows = boot.commands || [];

  function showCommandDetail(c) {
    openDetail(`Command ${c.ref}`, [
      el('dl', { class: 'stat-list' }, [
        el('div', {}, [el('dt', { text: 'Craft' }), el('dd', { class: 'mono', text: c.craft_code })]),
        el('div', {}, [el('dt', { text: 'Type' }), el('dd', { text: c.type })]),
        el('div', {}, [el('dt', { text: 'Delta-v' }), el('dd', { class: 'mono', text: `${c.delta_v_ms} m/s` })]),
        el('div', {}, [el('dt', { text: 'Propellant' }), el('dd', { class: 'mono', text: `${c.propellant_kg} kg` })]),
        el('div', {}, [el('dt', { text: 'Battery draw' }), el('dd', { class: 'mono', text: `${c.battery_draw_pct}%` })]),
        el('div', {}, [el('dt', { text: 'Window (UTC)' }), el('dd', { class: 'mono', text: `${c.starts_at} → ${c.ends_at}` })]),
        el('div', {}, [el('dt', { text: 'Status' }), el('dd', {}, [el('span', { class: badgeClass(c.status), text: c.status })])]),
        el('div', {}, [el('dt', { text: 'Submitted by' }), el('dd', { text: c.submitted_by || '—' })]),
        el('div', {}, [el('dt', { text: 'Authorized by' }), el('dd', { text: c.authorized_by || '—' })]),
        el('div', {}, [el('dt', { text: 'Executed at' }), el('dd', { class: 'mono', text: c.executed_at || '—' })]),
      ]),
    ]);
  }

  const searchInput = el('input', {
    type: 'search', 'aria-label': 'Search commands', placeholder: 'Search commands (ref, craft, type, status)',
    onkeyup: async (e) => {
      const r = await api('GET', `/api/commands${e.target.value ? `?q=${encodeURIComponent(e.target.value)}` : ''}`);
      if (r.ok) replaceQueueRows(r.data);
    },
  });

  function commandRow(c) {
    const actions = [
      el('button', { type: 'button', class: 'action small secondary',
        onclick: () => showCommandDetail(c) },
        ['Details']),
    ];
    if (canWrite) {
      if (user.role === 'flight_director') {
        actions.push(el('button', { type: 'button', class: 'action small',
          onclick: async () => { const r = await api('POST', `/api/commands/${c.ref}/authorize`); flash(r.ok ? `${c.ref} authorized.` : r.data, r.ok ? 'ok' : 'error'); await refresh(); } },
          ['Authorize']));
      }
      actions.push(el('button', { type: 'button', class: 'action small',
        onclick: async () => { const r = await api('POST', `/api/commands/${c.ref}/execute`); flash(r.ok ? `${c.ref} uplinked.` : r.data, r.ok ? 'ok' : 'error'); await refresh(); } },
        ['Uplink']));
      actions.push(el('button', { type: 'button', class: 'action small secondary',
        onclick: async () => { const r = await api('POST', `/api/commands/${c.ref}/cancel`); flash(r.ok ? `${c.ref} cancelled.` : r.data, r.ok ? 'ok' : 'error'); await refresh(); } },
        ['Cancel']));
    }
    return el('tr', {}, [
      el('td', { class: 'mono strong', text: c.ref }),
      el('td', { class: 'mono', text: c.craft_code }),
      el('td', { text: c.type }),
      el('td', { class: 'mono num', text: String(c.delta_v_ms) }),
      el('td', { class: 'mono num', text: String(c.propellant_kg) }),
      el('td', { class: 'mono num', text: String(c.battery_draw_pct) }),
      el('td', { class: 'mono muted small', text: `${c.starts_at} → ${c.ends_at}` }),
      el('td', {}, [el('span', { class: badgeClass(c.status), text: c.status })]),
      el('td', { class: 'muted small', text: c.authorized_by || '—' }),
      el('td', { class: 'row' }, actions),
    ]);
  }

  const tbody = el('tbody', {}, rows.map(commandRow));
  function replaceQueueRows(newRows) {
    tbody.innerHTML = '';
    for (const c of newRows) tbody.append(commandRow(c));
  }

  const headerRow = [
    el('th', { text: 'Reference' }), el('th', { text: 'Craft' }), el('th', { text: 'Type' }),
    el('th', { class: 'num', text: 'Δv m/s' }), el('th', { class: 'num', text: 'Prop kg' }), el('th', { class: 'num', text: 'Draw %' }),
    el('th', { text: 'Window (UTC)' }), el('th', { text: 'Status' }), el('th', { text: 'Authorized by' }),
    el('th', { text: 'Actions' }),
  ];

  const sections = [
    el('h1', { text: 'Command queue' }),
    el('div', { class: 'row toolbar' }, [el('h2', { class: 'flex-fill', text: 'Queue' }), searchInput]),
    el('div', { class: 'table-wrap' }, [
      el('table', {}, [el('thead', {}, [el('tr', {}, headerRow)]), tbody]),
    ]),
  ];

  if (canWrite) {
    const refInput = el('input', { type: 'text', required: true, 'aria-label': 'Reference' });
    const typeInput = el('input', { type: 'text', value: 'IMAGE', 'aria-label': 'Type' });
    const dvInput = el('input', { type: 'number', step: 'any', value: '0', 'aria-label': 'Delta-v m/s' });
    const propInput = el('input', { type: 'number', step: 'any', value: '0', 'aria-label': 'Propellant kg' });
    const drawInput = el('input', { type: 'number', step: 'any', value: '0', 'aria-label': 'Battery draw percent' });
    const startsInput = el('input', { type: 'text', placeholder: 'YYYY-MM-DDTHH:MM:SSZ', required: true, 'aria-label': 'Window start UTC' });
    const endsInput = el('input', { type: 'text', placeholder: 'YYYY-MM-DDTHH:MM:SSZ', required: true, 'aria-label': 'Window end UTC' });
    const craftSelect = el('select', { 'aria-label': 'Craft' }, CRAFT_CODES.map((c) => el('option', { value: c, text: c })));

    const form = el('form', {
      class: 'form-grid',
      onsubmit: async (e) => {
        e.preventDefault();
        const r = await api('POST', '/api/commands', {
          ref: refInput.value, craft_code: craftSelect.value, type: typeInput.value,
          delta_v_ms: Number(dvInput.value) || 0, propellant_kg: Number(propInput.value) || 0,
          battery_draw_pct: Number(drawInput.value) || 0, starts_at: startsInput.value, ends_at: endsInput.value,
        });
        flash(r.ok ? `Command ${refInput.value} drafted.` : r.data, r.ok ? 'ok' : 'error');
        if (r.ok) refInput.value = '';
        await refresh();
      },
    }, [
      el('label', {}, [el('span', { text: 'Reference' }), refInput]),
      el('label', {}, [el('span', { text: 'Type' }), typeInput]),
      el('label', {}, [el('span', { text: 'Craft' }), craftSelect]),
      el('label', {}, [el('span', { text: 'Delta-v m/s' }), dvInput]),
      el('label', {}, [el('span', { text: 'Propellant kg' }), propInput]),
      el('label', {}, [el('span', { text: 'Battery draw %' }), drawInput]),
      el('label', {}, [el('span', { text: 'Window start (UTC)' }), startsInput]),
      el('label', {}, [el('span', { text: 'Window end (UTC)' }), endsInput]),
      el('div', { class: 'form-actions' }, [el('button', { type: 'submit', class: 'action' }, ['Draft command'])]),
    ]);
    sections.push(el('section', { class: 'panel' }, [el('h2', { text: 'Draft a new command' }), form]));
  }

  return el('section', { class: 'page', 'data-workspace': 'queue' }, sections);
}

function renderTelemetry(boot, H) {
  const { el, api } = H;
  const rows = boot.telemetry || [];
  const tbody = el('tbody', {}, rows.map(telemetryRow));
  function telemetryRow(t) {
    return el('tr', {}, [
      el('td', { class: 'mono', text: t.craft_code }),
      el('td', { class: 'mono muted small', text: t.recorded_at }),
      el('td', { class: 'mono num', text: String(t.battery_pct) }),
      el('td', { class: 'mono num', text: String(t.propellant_kg) }),
      el('td', { class: 'mono num', text: String(t.temp_c) }),
    ]);
  }
  const searchInput = el('input', {
    type: 'search', 'aria-label': 'Search telemetry by craft', placeholder: 'Search telemetry by craft',
    onkeyup: async (e) => {
      const r = await api('GET', `/api/telemetry${e.target.value ? `?q=${encodeURIComponent(e.target.value)}` : ''}`);
      if (r.ok) { tbody.innerHTML = ''; for (const t of r.data) tbody.append(telemetryRow(t)); }
    },
  });
  return el('section', { class: 'page', 'data-workspace': 'telemetry' }, [
    el('h1', { text: 'Telemetry' }),
    el('div', { class: 'row toolbar' }, [el('h2', { class: 'flex-fill', text: 'Recent readings' }), searchInput]),
    el('div', { class: 'table-wrap' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: 'Craft' }), el('th', { text: 'Recorded (UTC)' }), el('th', { class: 'num', text: 'Battery %' }),
          el('th', { class: 'num', text: 'Propellant kg' }), el('th', { class: 'num', text: 'Temp °C' }),
        ])]),
        tbody,
      ]),
    ]),
  ]);
}

function renderAdmin(boot, H) {
  const { el, api, flash, refresh } = H;
  const roles = ['operator', 'flight_director', 'analyst', 'admin'];
  const userRows = (boot.users || []).map((u) => {
    const roleSelect = el('select', { 'aria-label': `Role for ${u.email}` }, roles.map((r) => el('option', { value: r, text: r, selected: r === u.role ? '' : null })));
    return el('tr', {}, [
      el('td', { class: 'mono', text: u.email }),
      el('td', { text: u.name }),
      el('td', { text: u.role }),
      el('td', {}, [el('span', { class: badgeClass(u.status === 'ACTIVE' ? 'PASSED' : 'FAILED'), text: u.status })]),
      el('td', { class: 'row' }, [
        roleSelect,
        el('button', { type: 'button', class: 'action small',
          onclick: async () => { const r = await api('POST', `/api/users/${encodeURIComponent(u.email)}/role`, { role: roleSelect.value }); flash(r.ok ? `${u.email} is now ${roleSelect.value}.` : r.data, r.ok ? 'ok' : 'error'); await refresh(); } },
          ['Set role']),
        el('button', { type: 'button', class: 'action small secondary',
          onclick: async () => { const status = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'; const r = await api('POST', `/api/users/${encodeURIComponent(u.email)}/status`, { status }); flash(r.ok ? `${u.email} is now ${status}.` : r.data, r.ok ? 'ok' : 'error'); await refresh(); } },
          [u.status === 'ACTIVE' ? 'Suspend' : 'Reinstate']),
      ]),
    ]);
  });
  const auditRows = (boot.audit || []).map((a) => el('tr', {}, [
    el('td', { class: 'mono muted small', text: a.at }),
    el('td', { class: 'strong', text: a.action }),
    el('td', { class: 'mono', text: a.subject_ref || '—' }),
    el('td', { class: 'small', text: a.actor_email || '—' }),
    el('td', { class: 'muted small', text: a.detail || '' }),
  ]));
  return el('section', { class: 'page', 'data-workspace': 'admin' }, [
    el('h1', { text: 'Administration' }),
    el('section', { class: 'panel' }, [
      el('h2', { text: 'Crew accounts' }),
      el('div', { class: 'table-wrap' }, [
        el('table', {}, [el('thead', {}, [el('tr', {}, [
          el('th', { text: 'Email' }), el('th', { text: 'Name' }), el('th', { text: 'Role' }), el('th', { text: 'Status' }), el('th', { text: 'Change' }),
        ])]), el('tbody', {}, userRows)]),
      ]),
    ]),
    el('section', { class: 'panel' }, [
      el('h2', { text: 'Audit trail' }),
      el('div', { class: 'table-wrap' }, [
        el('table', {}, [el('thead', {}, [el('tr', {}, [
          el('th', { text: 'When (UTC)' }), el('th', { text: 'Action' }), el('th', { text: 'Subject' }), el('th', { text: 'Actor' }), el('th', { text: 'Detail' }),
        ])]), el('tbody', {}, auditRows)]),
      ]),
    ]),
  ]);
}

window.renderWorkspaces = function renderWorkspaces(boot, helpers) {
  const pages = [renderConstellation(boot, helpers), renderQueue(boot, helpers), renderTelemetry(boot, helpers)];
  if (boot.user && boot.user.role === 'admin') pages.push(renderAdmin(boot, helpers));
  return pages;
};
