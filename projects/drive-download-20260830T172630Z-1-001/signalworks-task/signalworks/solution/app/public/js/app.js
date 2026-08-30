/* Signalworks UI. Every desk works from the screen: no page needs a URL typed
   in, every action a role is allowed to take is a control on one of its pages,
   and every figure the office argues about is rendered — money in pounds and
   pence, durations in whole minutes. */
(function () {
  'use strict';
  var S = { me: null, data: null, tab: null, incidents: null, labour: null, preview: {}, flash: null };
  var root = document.getElementById('root');

  // ---------------------------------------------------------------- helpers
  function money(p) {
    if (p === null || p === undefined || p === '') return '—';
    var s = p < 0 ? '-' : '', a = Math.abs(p);
    return s + '£' + Math.floor(a / 100).toLocaleString('en-GB') + '.' + String(a % 100).padStart(2, '0');
  }
  function mins(m) {
    if (m === null || m === undefined || m === '') return '—';
    return String(m) + ' min';
  }
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function or(v) { return (v === null || v === undefined || v === '') ? '—' : esc(v); }
  function labelise(k) { return k.replace(/_pence$/, '').replace(/_/g, ' '); }

  // The message has to survive the reload that follows an action, otherwise the
  // desk never sees what happened.
  function paintFlash() {
    var f = document.getElementById('flash');
    if (!f) return;
    f.className = S.flash ? S.flash.kind : '';
    f.textContent = S.flash ? S.flash.msg : '';
  }
  function flash(msg, kind) {
    S.flash = msg ? { msg: msg, kind: kind } : null;
    paintFlash();
    if (kind === 'ok') {
      var mine = S.flash;
      setTimeout(function () { if (S.flash === mine) { S.flash = null; paintFlash(); } }, 10000);
    }
  }

  function api(method, url, body) {
    return fetch(url, {
      method: method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || ('request failed with ' + r.status)); e.payload = j; throw e; }
        return j;
      });
    });
  }

  // A refusal that turns on a figure has to SHOW that figure. Every number,
  // date, short string, flag and list the server sent back with the refusal is
  // rendered beside the message.
  function refusalText(e) {
    var p = e.payload || {}, bits = [];
    Object.keys(p).forEach(function (k) {
      if (k === 'error') return;
      var v = p[k];
      if (v === null || v === undefined) return;
      if (typeof v === 'number') bits.push(labelise(k) + ': ' + (/_pence$/.test(k) ? money(v) : v));
      else if (typeof v === 'boolean') bits.push(labelise(k) + ': ' + (v ? 'yes' : 'no'));
      else if (typeof v === 'string') { if (v.length <= 80) bits.push(labelise(k) + ': ' + v); }
      else if (Array.isArray(v)) {
        // Render objects too, by their identifying field - a refusal that turns
        // on "which period" is useless if the period never reaches the screen.
        var flat = v.map(function (x) {
          if (typeof x === 'string' || typeof x === 'number') return String(x);
          if (x && typeof x === 'object') return String(x.id || x.name || x.code || x.label || '');
          return '';
        }).filter(function (x) { return x !== ''; });
        if (flat.length) bits.push(labelise(k) + ': ' + flat.join(', '));
      }
      else if (typeof v === 'object') {
        var one = v.id || v.name || v.code || v.label;
        if (one) bits.push(labelise(k) + ': ' + String(one));
      }
    });
    return e.message + (bits.length ? ' — ' + bits.join(' · ') : '');
  }

  function act(method, url, body, okMsg) {
    api(method, url, body).then(function () { flash(okMsg || 'Done.', 'ok'); return load(); })
      .catch(function (e) { flash(refusalText(e), 'err'); });
  }
  window.swAct = act;

  function tag(text, kind) { return '<span class="tag ' + (kind || '') + '">' + esc(text) + '</span>'; }
  function stateTag(s) {
    var v = String(s || '');
    var k = /FAIL|WITHDRAWN|CANCELLED|SUSPENDED|INVALIDATED|OVERDUE|BLOCKED/.test(v) ? 'bad'
          : /IN_SERVICE|PASS|APPROVED|COMPLETE|SETTLED|CLEARED|REMOVED|HANDED_BACK|EXECUTED|CLOSED/.test(v) ? 'ok'
          : /OPEN|DRAFT|ASSIGNED|IN_PROGRESS|ACKNOWLEDGED|EXECUTING|ACTIVE|MAINTENANCE|SETTLE_READY|OFFSET/.test(v) ? 'warn' : '';
    return tag(v, k);
  }
  function yn(b, badWhenTrue) {
    return b ? tag('yes', badWhenTrue ? 'bad' : 'ok') : tag('no', badWhenTrue ? 'ok' : '');
  }
  function table(cols, rows) {
    return '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + (rows.length ? rows.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
      }).join('') : '<tr><td colspan="' + cols.length + '" class="muted">Nothing here yet.</td></tr>') + '</tbody></table>';
  }
  function opts(list, key, labelFn, blank) {
    return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + (list || []).map(function (x) {
      return '<option value="' + esc(x[key]) + '">' + esc(labelFn(x)) + '</option>';
    }).join('');
  }
  // A hold, spelled out with its figures rather than left as a code.
  function holdText(hold) {
    return Object.keys(hold).filter(function (k) { return k !== 'code'; })
      .map(function (k) { return labelise(k) + ' ' + (Array.isArray(hold[k]) ? hold[k].join(', ') : hold[k]); })
      .join(' · ');
  }
  function nameOf(id) {
    var u = (S.data.users || []).filter(function (x) { return x.id === id; })[0];
    return u ? u.name : null;
  }
  function refDate() { return (S.data.clock || {}).reference_date || ''; }

  // ---------------------------------------------------------------- incidents
  var PAGES = {};

  PAGES.incidents = function (d) {
    var h = '<h2>Incidents</h2>';
    h += '<div class="card"><h3>Raise an incident</h3>' +
      '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/incidents\',[\'id\',\'asset_id\',\'note\',\'raised_at\'],\'Incident raised.\')">' +
      '<label>Reference <input name="id" placeholder="INC-..." /></label>' +
      '<label>Asset <select name="asset_id">' + opts(d.assets, 'id', function (a) { return a.id + ' · ' + a.kind + ' · ' + a.section_id; }) + '</select></label>' +
      '<label>Note <input name="note" placeholder="what the board shows" /></label>' +
      '<label>Raised at <input name="raised_at" placeholder="' + esc((d.clock || {}).reference_at || 'YYYY-MM-DDTHH:MM:SSZ') + '" /></label>' +
      '<button class="act" type="submit">Raise incident</button></form>' +
      '<p class="muted">Reference date held by the control office: ' + esc(refDate()) + '.</p></div>';

    h += '<div class="card">' + table(
      ['Incident', 'Asset', 'Section', 'State', 'Raised at', 'Cleared at', 'Delay minutes', 'Settlement'],
      (d.incidents || []).map(function (i) {
        return ['<strong>' + esc(i.id) + '</strong>', esc(i.asset_id), esc(i.section_id), stateTag(i.state),
          esc(i.raised_at), or(i.cleared_at), '<span class="num">' + mins(i.delay_minutes_total) + '</span>',
          i.settlement ? esc(i.settlement.id) + ' · <span class="money">' + money(i.settlement.net_pence) + '</span>' : '—'];
      })) + '</div>';

    (d.incidents || []).forEach(function (i) { h += incidentCard(i, d); });
    return h;
  };

  function incidentCard(i, d) {
    var h = '<div class="card"><h3>' + esc(i.id) + ' &middot; ' + esc(i.asset_id) + ' &middot; ' + stateTag(i.state) + '</h3>';
    h += '<dl class="kv"><dt>Asset</dt><dd>' + esc(i.asset_id) + (i.asset ? ' (' + esc(i.asset.kind) + ', state ' + esc(i.asset.state) + ')' : '') + '</dd>' +
      '<dt>Section</dt><dd>' + esc(i.section_id) + '</dd>' +
      '<dt>Raised at</dt><dd>' + esc(i.raised_at) + '</dd>' +
      '<dt>Cleared at</dt><dd>' + or(i.cleared_at) + '</dd>' +
      '<dt>Note</dt><dd>' + or(i.note) + '</dd>' +
      '<dt>Total delay minutes</dt><dd class="num"><strong>' + mins(i.delay_minutes_total) + '</strong></dd></dl>';

    h += '<h4>Delay recorded, per operator</h4>' + table(['Reference', 'Operator', 'Delay minutes'],
      (i.delay_records || []).map(function (r) {
        return [esc(r.id), esc(r.operator_id), '<span class="num">' + mins(r.delay_minutes) + '</span>'];
      }));

    if (i.settlement) h += settlementFigures(i.settlement, i.credit);
    else if (i.credit) h += '<p class="muted">Mutual-aid credit ' + esc(i.credit.id) + ' of ' + money(i.credit.amount_pence) +
      ' is earmarked against this incident and is ' + esc(i.credit.state) + '.</p>';

    if (S.preview[i.id]) h += previewFigures(S.preview[i.id]);

    h += '<h4>Events</h4>' + table(['#', 'Kind', 'Actor', 'Detail', 'At'], (i.events || []).map(function (e) {
      return [String(e.id), esc(e.kind), or(e.actor_id), or(e.detail), esc(e.created_at)];
    }));

    h += '<h4>Actions</h4>';
    var role = S.me.role;
    if (role === 'signaller') {
      if (i.state === 'OPEN')
        h += '<button class="act" onclick="swAct(\'POST\',\'/api/incidents/' + i.id + '/acknowledge\',null,\'Incident acknowledged.\')">Acknowledge incident</button>';
      if (i.state === 'ACKNOWLEDGED')
        h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/incidents/' + i.id + '/assign\',[\'job_id\',\'team_id\'],\'Incident assigned.\')">' +
          '<label>Job <select name="job_id">' + opts(d.jobs, 'id', function (j) { return j.id + ' · ' + j.kind + ' · ' + j.asset_id + ' · ' + j.state; }, 'no job') + '</select></label>' +
          '<label>Team <input name="team_id" placeholder="TEAM-... (must be on call)" /></label>' +
          '<button class="act" type="submit">Assign incident</button></form>';
      if (i.state === 'ACKNOWLEDGED' || i.state === 'ASSIGNED')
        h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/incidents/' + i.id + '/clear\',[\'cleared_at\'],\'Incident cleared.\')">' +
          '<label>Cleared at <input name="cleared_at" placeholder="YYYY-MM-DDTHH:MM:SSZ" /></label>' +
          '<button class="act" type="submit">Clear incident</button></form>';
      if (!i.settled) {
        h += '<form class="inline" onsubmit="return swSubmit(event,\'PATCH\',\'/api/incidents/' + i.id + '\',[\'note\',\'asset_id\'],\'Incident edited.\')">' +
          '<label>Note <input name="note" value="' + esc(i.note || '') + '" /></label>' +
          '<label>Asset <select name="asset_id">' + opts(d.assets, 'id', function (a) { return a.id + ' · ' + a.kind; }, 'leave as is') + '</select></label>' +
          '<button class="act sec" type="submit">Edit incident</button></form>';
        h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/incidents/' + i.id + '/delays\',[\'id\',\'operator_id\',\'delay_minutes\'],\'Delay recorded.\',[\'delay_minutes\'])">' +
          '<label>Reference <input name="id" placeholder="DLY-..." /></label>' +
          '<label>Operator <select name="operator_id">' + opts(d.operators, 'id', function (o) { return o.id + ' · ' + o.name; }) + '</select></label>' +
          '<label>Delay minutes <input name="delay_minutes" placeholder="e.g. 45" /></label>' +
          '<button class="act" type="submit">Record delay</button></form>';
      } else {
        h += '<p class="muted">This incident is settled: it is a closed book, so it cannot be edited and takes no further delay records. Append a correction instead.</p>';
      }
      h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/incidents/' + i.id + '/corrections\',[\'detail\'],\'Correction appended.\')">' +
        '<label>Correction <input name="detail" placeholder="what is being corrected" size="40" /></label>' +
        '<button class="act sec" type="submit">Append correction</button></form>';
      h += '<button class="act sec" onclick="swPreview(\'' + i.id + '\')">Preview settlement figures</button>';
    }
    h += '</div>';
    return h;
  }

  function settlementFigures(s, credit) {
    return '<h4>Settlement</h4><dl class="kv">' +
      '<dt>Settlement</dt><dd>' + esc(s.id) + ' &middot; ' + stateTag(s.state) + ' &middot; period ' + or(s.period_id) + '</dd>' +
      '<dt>Delay minutes as recorded</dt><dd class="num">' + mins(s.delay_minutes) + '</dd>' +
      '<dt>Gross penalty before any credit</dt><dd class="money"><strong>' + money(s.gross_pence) + '</strong> ' +
        (s.banded ? tag('banded', 'ok') : tag('flat, major-disruption window ' + (s.window_id || ''), 'warn')) + '</dd>' +
      '<dt>Credit applied</dt><dd class="money">' + money(s.credit_applied_pence) +
        (s.credit_id ? ' (credit ' + esc(s.credit_id) + ')' : ' (no credit applied)') + '</dd>' +
      '<dt>Net settlement</dt><dd class="money"><strong>' + money(s.net_pence) + '</strong></dd>' +
      (credit ? '<dt>Earmarked credit</dt><dd>' + esc(credit.id) + ' · ' + money(credit.amount_pence) + ' · ' + esc(credit.state) + '</dd>' : '') +
      '</dl>';
  }

  function previewFigures(p) {
    return '<h4>Settlement preview (nothing is posted)</h4><dl class="kv">' +
      '<dt>Delay minutes</dt><dd class="num">' + mins(p.delay_minutes) + '</dd>' +
      '<dt>Gross penalty</dt><dd class="money">' + money(p.gross_pence) + ' ' +
        (p.banded ? tag('banded', 'ok') : tag('flat inside window ' + (p.window_id || ''), 'warn')) + '</dd>' +
      '<dt>Credit available</dt><dd class="money">' + money(p.credit_amount_pence) + (p.credit_id ? ' (' + esc(p.credit_id) + ')' : '') + '</dd>' +
      '<dt>Credit that would apply</dt><dd class="money">' + money(p.credit_applied_pence) + '</dd>' +
      '<dt>Net</dt><dd class="money"><strong>' + money(p.net_pence) + '</strong></dd></dl>';
  }

  // ---------------------------------------------------------------- assets
  PAGES.assets = function (d) {
    var role = S.me.role;
    var h = '<h2>Assets</h2><p class="muted">Everything below is judged against the control office reference date ' + esc(refDate()) + '.</p>';
    h += '<div class="card">' + table(
      ['Asset', 'Kind', 'Section', 'State', 'Inspection due', 'Overdue', 'Last inspection', 'Section blocked', 'Takes repair', 'Takes renewal', 'Takes inspection'],
      (d.assets || []).map(function (a) {
        var od = a.inspection_overdue_detail;
        return ['<strong>' + esc(a.id) + '</strong>', esc(a.kind), esc(a.section_id), stateTag(a.state),
          '<span class="num">' + esc(a.inspection_due_on) + '</span>',
          a.inspection_overdue ? tag('OVERDUE by ' + (od ? od.overdue_by_days : '?') + ' days', 'bad') : tag('no', 'ok'),
          a.latest_inspection ? esc(a.latest_inspection.id) + ' ' + stateTag(a.latest_inspection.result) + ' ' + esc(a.latest_inspection.inspected_on) : '—',
          a.section_blocked ? tag(a.blockage_id, 'bad') : tag('no', 'ok'),
          yn(a.available_for_repair), yn(a.available_for_renewal), yn(a.available_for_inspection)];
      })) + '</div>';

    if (role === 'maintenance' || role === 'engineer') {
      (d.assets || []).forEach(function (a) {
        h += '<div class="card"><h3>' + esc(a.id) + ' &middot; ' + esc(a.kind) + ' &middot; ' + stateTag(a.state) + '</h3>' +
          '<dl class="kv"><dt>Section</dt><dd>' + esc(a.section_id) + '</dd>' +
          '<dt>Inspection next due</dt><dd class="num">' + esc(a.inspection_due_on) + '</dd>' +
          '<dt>Overdue</dt><dd>' + (a.inspection_overdue
            ? tag('overdue by ' + a.inspection_overdue_detail.overdue_by_days + ' days (due ' + a.inspection_overdue_detail.inspection_due_on + ', reference ' + a.inspection_overdue_detail.reference_date + ')', 'bad')
            : tag('no', 'ok')) + '</dd>' +
          '<dt>Competence demanded</dt><dd>' + esc((a.required_competence || []).join(', ')) + '</dd>' +
          '<dt>Configuration note</dt><dd>' + or(a.config_note) + '</dd></dl>';

        if (role === 'maintenance') {
          h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/assets/' + a.id + '/inspections\',[\'id\',\'result\',\'inspected_on\',\'next_due_on\',\'technician_id\',\'evidence_ref\'],\'Inspection recorded.\')">' +
            '<label>Reference <input name="id" placeholder="INSP-..." /></label>' +
            '<label>Result <select name="result"><option>PASS</option><option>FAIL</option></select></label>' +
            '<label>Inspected on <input name="inspected_on" placeholder="YYYY-MM-DD" /></label>' +
            '<label>Next due on <input name="next_due_on" placeholder="YYYY-MM-DD (a pass must set this)" /></label>' +
            '<label>Inspector <select name="technician_id">' + opts(d.technicians, 'id', function (t) { return t.id + ' · ' + t.name + ' · card to ' + t.competence_expires_on; }, 'not named') + '</select></label>' +
            '<label>Evidence <input name="evidence_ref" placeholder="EV-..." /></label>' +
            '<button class="act" type="submit">Record inspection</button></form>';
        }
        if (role === 'engineer') {
          h += '<form class="inline" onsubmit="return swSubmit(event,\'PATCH\',\'/api/assets/' + a.id + '\',[\'state\',\'config_note\',\'reason\'],\'Asset updated.\')">' +
            '<label>State <select name="state"><option value="">leave as is</option><option>MAINTENANCE</option><option>WITHDRAWN</option><option>FAILED</option></select></label>' +
            '<label>Configuration note <input name="config_note" value="' + esc(a.config_note || '') + '" /></label>' +
            '<label>Reason <input name="reason" placeholder="why" /></label>' +
            '<button class="act sec" type="submit">Update asset</button></form>';
          if (a.state !== 'IN_SERVICE')
            h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/assets/' + a.id + '/return-to-service\',[\'reason\'],\'Asset returned to service.\')">' +
              '<label>Reason <input name="reason" placeholder="why it is fit" /></label>' +
              '<button class="act" type="submit">Return to service</button></form>';
          else h += '<p class="muted">This asset is already in service, so there is nothing to return.</p>';
        }
        h += '</div>';
      });
    }
    return h;
  };

  // ---------------------------------------------------------------- inspections
  PAGES.inspections = function (d) {
    var h = '<h2>Inspections</h2>';
    h += '<div class="card"><h3>Record an inspection</h3>' +
      '<form class="inline" onsubmit="return swInspect(event)">' +
      '<label>Asset <select name="asset_id">' + opts(d.assets, 'id', function (a) { return a.id + ' · ' + a.kind + ' · due ' + a.inspection_due_on; }) + '</select></label>' +
      '<label>Reference <input name="id" placeholder="INSP-..." /></label>' +
      '<label>Result <select name="result"><option>PASS</option><option>FAIL</option></select></label>' +
      '<label>Inspected on <input name="inspected_on" placeholder="YYYY-MM-DD" /></label>' +
      '<label>Next due on <input name="next_due_on" placeholder="YYYY-MM-DD" /></label>' +
      '<label>Inspector <select name="technician_id">' + opts(d.technicians, 'id', function (t) { return t.id + ' · ' + t.name; }, 'not named') + '</select></label>' +
      '<label>Evidence <input name="evidence_ref" placeholder="EV-..." /></label>' +
      '<button class="act" type="submit">Record inspection</button></form>' +
      '<p class="muted">A passed inspection must carry the next due date, and that date has to fall after the inspection.</p></div>';

    h += '<div class="card">' + table(['#', 'Reference', 'Asset', 'Inspector', 'Result', 'Inspected on', 'Next due on', 'Evidence'],
      (d.inspections || []).slice().reverse().map(function (i) {
        return [String(i.seq), esc(i.id), esc(i.asset_id), or(i.technician_id), stateTag(i.result),
          esc(i.inspected_on), or(i.next_due_on), or(i.evidence_ref)];
      })) + '</div>';
    return h;
  };

  // ---------------------------------------------------------------- sections
  PAGES.sections = function (d) {
    var h = '<h2>Line sections</h2><div class="card">' + table(
      ['Section', 'Name', 'Interlocking', 'Blockage', 'Placed by', 'Reason'],
      (d.sections || []).map(function (s) {
        var b = s.active_blockage;
        return ['<strong>' + esc(s.id) + '</strong>', esc(s.name), esc(s.interlocking_id),
          b ? tag(b.id + ' ACTIVE', 'bad') : tag('clear', 'ok'),
          b ? esc(b.placed_by) + (nameOf(b.placed_by) ? ' (' + esc(nameOf(b.placed_by)) + ')' : '') : '—',
          b ? esc(b.reason) : '—'];
      })) + '</div>';
    h += '<div class="card"><h3>Interlockings</h3>' + table(['Interlocking', 'Name'],
      (d.interlockings || []).map(function (x) { return [esc(x.id), esc(x.name)]; })) + '</div>';
    if (d.assets) h += '<div class="card"><h3>Assets by section</h3>' + table(['Asset', 'Kind', 'Section', 'State', 'Inspection due'],
      (d.assets || []).map(function (a) {
        return [esc(a.id), esc(a.kind), esc(a.section_id), stateTag(a.state), '<span class="num">' + esc(a.inspection_due_on) + '</span>'];
      })) + '</div>';
    return h;
  };

  // ---------------------------------------------------------------- blockages
  PAGES.blockages = function (d) {
    var h = '<h2>Line blockages</h2>';
    h += '<div class="card"><h3>Place a blockage</h3>' +
      '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/blockages\',[\'id\',\'section_id\',\'reason\'],\'Blockage placed.\')">' +
      '<label>Reference <input name="id" placeholder="BLK-..." /></label>' +
      '<label>Section <select name="section_id">' + opts(d.sections, 'id', function (s) { return s.id + ' · ' + s.name; }) + '</select></label>' +
      '<label>Reason <input name="reason" placeholder="why the line is blocked" size="32" /></label>' +
      '<button class="act" type="submit">Place blockage</button></form>' +
      '<p class="muted">A section carries at most one active blockage. While one is in force, work and possession execution on that section are held.</p></div>';

    h += '<div class="card">' + table(['Reference', 'Section', 'State', 'Placed by', 'Reason', 'Placed at', 'Removed by', 'Removed at', ''],
      (d.blockages || []).map(function (b) {
        return [esc(b.id), esc(b.section_id), stateTag(b.state),
          esc(b.placed_by) + (nameOf(b.placed_by) ? ' (' + esc(nameOf(b.placed_by)) + ')' : ''),
          or(b.reason), or(b.placed_at), or(b.removed_by), or(b.removed_at),
          b.state === 'ACTIVE'
            ? '<button class="act" onclick="swAct(\'POST\',\'/api/blockages/' + b.id + '/remove\',null,\'Blockage lifted.\')">Lift blockage</button>'
            : '<span class="muted">already lifted</span>'];
      })) + '</div>';
    return h;
  };

  // ---------------------------------------------------------------- jobs
  PAGES.jobs = function (d) {
    var role = S.me.role, h = '<h2>Jobs</h2>';
    if (role === 'maintenance' || role === 'teamlead') {
      h += '<div class="card"><h3>Raise a job</h3>' +
        '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/jobs\',[\'id\',\'asset_id\',\'kind\',\'incident_id\',\'note\'],\'Job raised.\')">' +
        '<label>Reference <input name="id" placeholder="JOB-..." /></label>' +
        '<label>Asset <select name="asset_id">' + opts(d.assets, 'id', function (a) { return a.id + ' · ' + a.kind + ' · ' + a.state; }) + '</select></label>' +
        '<label>Kind <select name="kind"><option>REPAIR</option><option>INSPECTION</option><option>RENEWAL</option></select></label>' +
        '<label>Incident <input name="incident_id" placeholder="INC-... (optional)" /></label>' +
        '<label>Note <input name="note" /></label>' +
        '<button class="act" type="submit">Raise job</button></form></div>';
    }

    h += '<div class="card">' + table(
      ['Job', 'Asset', 'Kind', 'State', 'Team holding it', 'Technician', 'Incident', 'Competence demanded', 'Hold', 'Blockage', 'Startable', 'Handback'],
      (d.jobs || []).map(function (j) {
        return ['<strong>' + esc(j.id) + '</strong>', esc(j.asset_id), esc(j.kind), stateTag(j.state),
          j.team ? esc(j.team.id) + ' · ' + esc(j.team.name) + (j.team.on_call ? ' ' + tag('on call', 'ok') : ' ' + tag('not on call', 'warn')) : '—',
          j.technician ? esc(j.technician.id) + ' · ' + esc(j.technician.name) : '—',
          or(j.incident_id), esc((j.required_competence || []).join(', ')),
          j.asset_hold ? tag(j.asset_hold.code, 'bad') : tag('none', 'ok'),
          j.section_blockage ? tag(j.section_blockage.id, 'bad') : tag('none', 'ok'),
          yn(j.startable), j.handback ? esc(j.handback.id) + ' ' + stateTag(j.handback.state) : '—'];
      })) + '</div>';

    if (role === 'teamlead' || role === 'maintenance') (d.jobs || []).forEach(function (j) { h += jobCard(j, d); });
    return h;
  };

  function jobCard(j, d) {
    var h = '<div class="card"><h3>' + esc(j.id) + ' &middot; ' + esc(j.kind) + ' on ' + esc(j.asset_id) + ' &middot; ' + stateTag(j.state) + '</h3>';
    h += '<dl class="kv">' +
      '<dt>Team holding it</dt><dd>' + (j.team ? esc(j.team.id) + ' · ' + esc(j.team.name) + (j.team.on_call ? ' (on call)' : ' (not on call)') : 'nobody yet') + '</dd>' +
      '<dt>Technician</dt><dd>' + (j.technician ? esc(j.technician.id) + ' · ' + esc(j.technician.name) + ' · card expires ' + esc(j.technician.competence_expires_on) : '—') + '</dd>' +
      '<dt>Asset state</dt><dd>' + (j.asset ? stateTag(j.asset.state) + ' · inspection due ' + esc(j.asset.inspection_due_on) : '—') + '</dd>' +
      '<dt>Competence demanded</dt><dd>' + esc((j.required_competence || []).join(', ')) + '</dd>' +
      '<dt>Hold on the asset</dt><dd>' + (j.asset_hold ? tag(j.asset_hold.code, 'bad') + ' ' + esc(holdText(j.asset_hold)) : tag('none', 'ok')) + '</dd>' +
      '<dt>Blockage on the section</dt><dd>' + (j.section_blockage ? tag(j.section_blockage.id + ' ' + j.section_blockage.reason, 'bad') : tag('none', 'ok')) + '</dd>' +
      '<dt>Started at</dt><dd>' + or(j.started_at) + '</dd>' +
      '<dt>Completed at</dt><dd>' + or(j.completed_at) + '</dd>' +
      '<dt>Possession worked under</dt><dd>' + or(j.possession_id) + '</dd></dl>';

    h += '<h4>Assignment history</h4>' + table(['Reference', 'Team', 'Technician', 'Competence required', 'Card expires', 'Assigned at', 'State'],
      (j.assignments || []).map(function (a) {
        return [esc(a.id), or(a.team_id), or(a.technician_id), or(a.competence_required), or(a.competence_expires_on), esc(a.assigned_at), stateTag(a.state)];
      }));

    h += '<h4>Actions</h4>';
    var open = j.state === 'OPEN', assigned = j.state === 'ASSIGNED';
    if (open || assigned) {
      h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/jobs/' + j.id + '/assign-team\',[\'team_id\'],\'Team assigned.\')">' +
        '<label>Team <select name="team_id">' + opts(d.teams, 'id', function (t) { return t.id + ' · ' + t.name + (t.on_call ? ' · on call' : ' · not on call'); }) + '</select></label>' +
        '<button class="act" type="submit">Assign team</button></form>';
      h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/jobs/' + j.id + '/assign-technician\',[\'technician_id\'],\'Technician assigned.\')">' +
        '<label>Technician <select name="technician_id">' + opts(d.technicians, 'id', function (t) {
          return t.id + ' · ' + t.name + ' · ' + t.team_id + ' · ' + t.competences + ' · to ' + t.competence_expires_on;
        }) + '</select></label>' +
        '<button class="act" type="submit">Assign technician</button></form>';
    }
    if (open && !j.team_id)
      h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/jobs/' + j.id + '/claim\',[\'team_id\'],\'Job claimed.\')">' +
        '<label>Claim for team <select name="team_id">' + opts(d.teams, 'id', function (t) { return t.id + ' · ' + t.name; }) + '</select></label>' +
        '<button class="act" type="submit">Claim job</button></form>';
    if (assigned)
      h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/jobs/' + j.id + '/start\',[\'executed_at\'],\'Job started.\')">' +
        '<label>Executed at <input name="executed_at" placeholder="YYYY-MM-DDTHH:MM:SSZ (defaults to the possession or the reference moment)" size="46" /></label>' +
        '<button class="act" type="submit">Start work</button></form>';
    if (j.state === 'IN_PROGRESS')
      h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/jobs/' + j.id + '/complete\',[\'completed_at\'],\'Job completed.\')">' +
        '<label>Completed at <input name="completed_at" placeholder="YYYY-MM-DDTHH:MM:SSZ" /></label>' +
        '<button class="act" type="submit">Complete work</button></form>';
    if (['COMPLETE', 'HANDED_BACK', 'CANCELLED'].indexOf(j.state) < 0)
      h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/jobs/' + j.id + '/cancel\',[\'reason\'],\'Job cancelled.\')">' +
        '<label>Reason <input name="reason" /></label><button class="act sec" type="submit">Cancel job</button></form>';
    if (S.me.role === 'teamlead' && j.incident_id)
      h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/incidents/' + j.incident_id + '/assign\',[\'job_id\',\'team_id\'],\'Incident assigned to this job.\')">' +
        '<input type="hidden" name="job_id" value="' + esc(j.id) + '" />' +
        '<label>Take incident ' + esc(j.incident_id) + ' for team <select name="team_id">' +
        opts(d.teams, 'id', function (t) { return t.id + ' · ' + t.name + (t.on_call ? ' · on call' : ' · not on call'); }, 'no team') + '</select></label>' +
        '<button class="act" type="submit">Assign incident to this job</button></form>';
    h += '</div>';
    return h;
  }

  // ---------------------------------------------------------------- technicians
  PAGES.technicians = function (d) {
    var ref = refDate();
    var h = '<h2>Technicians and teams</h2><p class="muted">Competence is judged against the reference date ' + esc(ref) + '.</p>';
    h += '<div class="card">' + table(['Technician', 'Name', 'Team', 'Competences held', 'Competence expires', 'Valid at reference date', 'Base rate an hour'],
      (d.technicians || []).map(function (t) {
        var valid = String(t.competence_expires_on) >= ref;
        return ['<strong>' + esc(t.id) + '</strong>', esc(t.name), esc(t.team_id),
          esc(String(t.competences).split(',').join(', ')),
          '<span class="num">' + esc(t.competence_expires_on) + '</span>',
          valid ? tag('valid', 'ok') : tag('EXPIRED', 'bad'),
          '<span class="money">' + money(t.base_rate_pence_per_hour) + '</span>'];
      })) + '</div>';
    h += '<div class="card"><h3>Teams</h3>' + table(['Team', 'Name', 'On call', 'Technicians'],
      (d.teams || []).map(function (t) {
        var members = (d.technicians || []).filter(function (x) { return x.team_id === t.id; }).map(function (x) { return x.id; });
        return [esc(t.id), esc(t.name), t.on_call ? tag('on call', 'ok') : tag('off call', 'warn'), esc(members.join(', ') || '—')];
      })) + '</div>';
    return h;
  };

  // ---------------------------------------------------------------- callouts
  PAGES.callouts = function (d) {
    var h = '<h2>Callouts</h2>';
    h += '<div class="card"><h3>Record a callout</h3>' +
      '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/callouts\',[\'id\',\'technician_id\',\'job_id\',\'starts_at\',\'ends_at\'],\'Callout recorded.\')">' +
      '<label>Reference <input name="id" placeholder="CAL-..." /></label>' +
      '<label>Technician <select name="technician_id">' + opts(d.technicians, 'id', function (t) { return t.id + ' · ' + t.name + ' · ' + money(t.base_rate_pence_per_hour) + '/h'; }) + '</select></label>' +
      '<label>Job <select name="job_id">' + opts(d.jobs, 'id', function (j) { return j.id + ' · ' + j.asset_id; }, 'no job') + '</select></label>' +
      '<label>Starts at <input name="starts_at" placeholder="YYYY-MM-DDTHH:MM:SSZ" /></label>' +
      '<label>Ends at <input name="ends_at" placeholder="YYYY-MM-DDTHH:MM:SSZ" /></label>' +
      '<button class="act" type="submit">Record callout</button></form>' +
      '<p class="muted">Callouts by one technician that overlap or merely touch settle as one callout, and the four-hour minimum then applies once to the merged span.</p></div>';

    h += '<div class="card">' + table(['Reference', 'Technician', 'Job', 'Starts at', 'Ends at', 'Worked minutes', 'Settled in'],
      (d.callouts || []).map(function (c) {
        var worked = Math.round((Date.parse(c.ends_at) - Date.parse(c.starts_at)) / 60000);
        return [esc(c.id), esc(c.technician_id), or(c.job_id), esc(c.starts_at), esc(c.ends_at),
          '<span class="num">' + mins(worked) + '</span>', c.settled_in ? esc(c.settled_in) : tag('unsettled', 'warn')];
      })) + '</div>';
    return h;
  };

  // ---------------------------------------------------------------- handbacks
  PAGES.handbacks = function (d) {
    var h = '<h2>Handbacks</h2>';
    h += '<div class="card"><h3>The six stages</h3>' + table(['#', 'Stage', 'Evidence demanded'],
      (d.handback_stages || []).map(function (s) { return [String(s.sequence), esc(s.name) + ' (' + esc(s.id) + ')', esc(s.evidence_required)]; })) + '</div>';

    var mayWriteHandback = S.me.role === 'teamlead' || S.me.role === 'safety';
    if (mayWriteHandback)
    h += '<div class="card"><h3>Open a handback</h3>' +
      '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/handbacks\',[\'id\',\'job_id\'],\'Handback opened.\')">' +
      '<label>Reference <input name="id" placeholder="HBK-..." /></label>' +
      (d.jobs
        ? '<label>Job <select name="job_id">' + opts(d.jobs, 'id', function (j) { return j.id + ' · ' + j.asset_id + ' · ' + j.state; }) + '</select></label>'
        : '<label>Job <input name="job_id" placeholder="JOB-..." /></label>') +
      '<button class="act" type="submit">Open handback</button></form>' +
      '<p class="muted">Only a completed job can be handed back, and a job carries at most one handback.</p></div>';

    (d.handbacks || []).forEach(function (hb) {
      h += '<div class="card"><h3>' + esc(hb.id) + ' &middot; job ' + esc(hb.job_id) + ' &middot; asset ' + esc(hb.asset_id) + ' &middot; ' + stateTag(hb.state) + '</h3>';
      h += '<dl class="kv"><dt>Progress</dt><dd><strong>' + hb.completed_stages + ' of ' + hb.total_stages + ' stages signed</strong></dd>' +
        '<dt>Opened by</dt><dd>' + or(hb.opened_by) + ' at ' + or(hb.opened_at) + '</dd>' +
        '<dt>Completed</dt><dd>' + or(hb.completed_by) + (hb.completed_at ? ' at ' + esc(hb.completed_at) : '') + '</dd>' +
        '<dt>Next stage</dt><dd>' + (hb.next_stage ? esc(hb.next_stage.id) + ' · ' + esc(hb.next_stage.name) + ' · evidence ' + esc(hb.next_stage.evidence_required) : 'every stage is recorded') + '</dd></dl>';
      h += table(['#', 'Stage', 'Evidence demanded', 'Signed', 'Evidence on file', 'Signed by', 'Signed at'],
        (hb.stages || []).map(function (s) {
          var step = (hb.steps || []).filter(function (x) { return x.stage_id === s.id; })[0];
          return [String(s.sequence), esc(s.name) + ' (' + esc(s.id) + ')', esc(s.evidence_required),
            step ? tag('signed', 'ok') : tag('not yet', 'warn'),
            step ? or(step.evidence_ref) : '—', step ? or(step.completed_by) : '—', step ? esc(step.completed_at) : '—'];
        }));
      if (hb.state === 'IN_PROGRESS') {
        if (mayWriteHandback) h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/handbacks/' + hb.id + '/steps\',[\'stage_id\',\'evidence_ref\'],\'Stage recorded.\')">' +
          '<label>Stage <select name="stage_id">' + (hb.stages || []).map(function (s) {
            var selected = hb.next_stage && hb.next_stage.id === s.id ? ' selected' : '';
            return '<option value="' + esc(s.id) + '"' + selected + '>' + esc(s.sequence + ' · ' + s.name + ' · evidence ' + s.evidence_required) + '</option>';
          }).join('') + '</select></label>' +
          '<label>Evidence <input name="evidence_ref" placeholder="EV-... where the stage demands it" /></label>' +
          '<button class="act" type="submit">Record stage</button></form>';
        if (mayWriteHandback) h += '<button class="act" onclick="swAct(\'POST\',\'/api/handbacks/' + hb.id + '/complete\',null,\'Handback completed.\')">Complete handback</button>';
      } else {
        h += '<p class="muted">This handback is ' + esc(hb.state) + ', so it takes no further stages.</p>';
      }
      h += '</div>';
    });
    return h;
  };

  // ---------------------------------------------------------------- possessions
  PAGES.possessions = function (d) {
    var h = '<h2>Possession plans</h2>';
    h += '<div class="card"><h3>Plan a possession</h3>' +
      '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/possessions\',[\'id\',\'section_id\',\'starts_at\',\'ends_at\',\'note\'],\'Possession planned.\')">' +
      '<label>Reference <input name="id" placeholder="POS-..." /></label>' +
      '<label>Section <select name="section_id">' + opts(d.sections, 'id', function (s) { return s.id + ' · ' + s.name; }) + '</select></label>' +
      '<label>Starts at <input name="starts_at" placeholder="YYYY-MM-DDTHH:MM:SSZ" /></label>' +
      '<label>Ends at <input name="ends_at" placeholder="YYYY-MM-DDTHH:MM:SSZ" /></label>' +
      '<label>Note <input name="note" /></label>' +
      '<button class="act" type="submit">Plan possession</button></form>' +
      '<p class="muted">You are recorded as the planner, and a possession has to be approved by somebody else.</p></div>';

    h += '<div class="card">' + table(
      ['Possession', 'Section', 'Starts at', 'Ends at', 'State', 'Version', 'Planned by', 'Approved by', 'Waiting for a signature again', 'Clash', 'Blockage', 'Executable'],
      (d.possessions || []).map(function (p) {
        var waiting = p.state === 'DRAFT' && p.version > 1;
        return ['<strong>' + esc(p.id) + '</strong>', esc(p.section_id), esc(p.starts_at), esc(p.ends_at),
          stateTag(p.state), String(p.version),
          esc(p.planner_id) + (p.planner && p.planner.name ? ' · ' + esc(p.planner.name) : ''),
          p.approved_by ? esc(p.approved_by) + (p.approver && p.approver.name ? ' · ' + esc(p.approver.name) : '') : '—',
          waiting ? tag('yes — approval was invalidated by an edit', 'bad') : tag('no', 'ok'),
          p.conflict ? tag('clashes with ' + p.conflict.overlaps_with, 'bad') : tag('none', 'ok'),
          p.active_blockage ? tag(p.active_blockage.id, 'bad') : tag('none', 'ok'),
          yn(p.executable)];
      })) + '</div>';

    (d.possessions || []).forEach(function (p) {
      h += '<div class="card"><h3>' + esc(p.id) + ' &middot; ' + esc(p.section_id) + ' &middot; ' + stateTag(p.state) + '</h3>';
      h += '<dl class="kv"><dt>Starts at</dt><dd>' + esc(p.starts_at) + '</dd><dt>Ends at</dt><dd>' + esc(p.ends_at) + '</dd>' +
        '<dt>Section</dt><dd>' + esc(p.section_id) + (p.section ? ' · ' + esc(p.section.name) : '') + '</dd>' +
        '<dt>Planned by</dt><dd>' + esc(p.planner_id) + (p.planner && p.planner.name ? ' · ' + esc(p.planner.name) : '') + '</dd>' +
        '<dt>Approved by</dt><dd>' + (p.approved_by ? esc(p.approved_by) + (p.approver && p.approver.name ? ' · ' + esc(p.approver.name) : '') + ' at ' + or(p.approved_at) : 'nobody yet') + '</dd>' +
        '<dt>Plan version</dt><dd>' + String(p.version) + '</dd>' +
        '<dt>Clash</dt><dd>' + (p.conflict
          ? tag('overlaps ' + p.conflict.overlaps_with + ' (' + p.conflict.existing_starts_at + ' to ' + p.conflict.existing_ends_at + ')', 'bad')
          : tag('none', 'ok')) + '</dd>' +
        '<dt>Note</dt><dd>' + or(p.note) + '</dd></dl>';
      if (p.state === 'DRAFT' && p.version > 1)
        h += '<p>' + tag('This plan was materially edited after approval: it is waiting for a signature again.', 'bad') + '</p>';
      h += '<h4>Approvals</h4>' + table(['Reference', 'Approver', 'Plan version', 'State', 'Invalidated because', 'At'],
        (p.approvals || []).map(function (a) {
          return [esc(a.id), esc(a.approver_id) + (nameOf(a.approver_id) ? ' · ' + esc(nameOf(a.approver_id)) : ''),
            String(a.plan_version), stateTag(a.state), or(a.invalidated_reason), esc(a.created_at)];
        }));

      h += '<h4>Actions</h4>';
      var editable = ['EXECUTED', 'CANCELLED'].indexOf(p.state) < 0;
      if (editable) {
        h += '<form class="inline" onsubmit="return swSubmit(event,\'PATCH\',\'/api/possessions/' + p.id + '\',[\'section_id\',\'starts_at\',\'ends_at\',\'note\'],\'Possession edited.\')">' +
          '<label>Section <select name="section_id">' + (d.sections || []).map(function (s) {
            return '<option value="' + esc(s.id) + '"' + (s.id === p.section_id ? ' selected' : '') + '>' + esc(s.id) + '</option>';
          }).join('') + '</select></label>' +
          '<label>Starts at <input name="starts_at" value="' + esc(p.starts_at) + '" size="22" /></label>' +
          '<label>Ends at <input name="ends_at" value="' + esc(p.ends_at) + '" size="22" /></label>' +
          '<label>Note <input name="note" value="' + esc(p.note || '') + '" /></label>' +
          '<button class="act sec" type="submit">Edit possession</button></form>' +
          '<p class="muted">Changing the section or either time after approval voids the approval and the plan needs signing again.</p>';
      }
      if (p.state === 'DRAFT')
        h += '<button class="act" onclick="swAct(\'POST\',\'/api/possessions/' + p.id + '/approve\',null,\'Possession approved.\')">Approve possession</button>';
      if (p.state === 'APPROVED' && S.me.role === 'safety')
        h += '<button class="act" onclick="swAct(\'POST\',\'/api/possessions/' + p.id + '/execute\',null,\'Possession is in force.\')">Take the possession (execute)</button>';
      if (editable)
        h += '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/possessions/' + p.id + '/cancel\',[\'reason\'],\'Possession cancelled.\')">' +
          '<label>Reason <input name="reason" /></label><button class="act sec" type="submit">Cancel possession</button></form>';
      if (!editable) h += '<p class="muted">A possession that is ' + esc(p.state) + ' can no longer be edited or cancelled.</p>';
      h += '</div>';
    });
    return h;
  };

  // ---------------------------------------------------------------- configuration
  PAGES.configuration = function (d) {
    var h = '<h2>Configuration</h2>';
    h += '<div class="card"><h3>Control office clock</h3><dl class="kv">' +
      '<dt>Reference moment</dt><dd>' + esc((d.clock || {}).reference_at) + '</dd>' +
      '<dt>Reference date</dt><dd>' + esc(refDate()) + '</dd>' +
      '<dt>Region</dt><dd>' + esc((d.region || {}).id) + ' · ' + esc((d.region || {}).name) + '</dd></dl>' +
      '<p class="muted">Every date decision — an overdue inspection, an expired competence — compares stored values against this moment, never against the wall clock.</p></div>';
    h += '<div class="card"><h3>Competence each asset kind demands</h3>' + table(['Reference', 'Asset kind', 'Requires', 'Note'],
      (d.competence_requirements || []).map(function (c) { return [esc(c.id), esc(c.asset_kind), esc(c.requires), or(c.note)]; })) + '</div>';
    return h;
  };

  // ---------------------------------------------------------------- settlements
  PAGES.settlements = function (d) {
    var h = '<h2>Settlement</h2>';
    var incs = S.incidents || [];

    h += '<div class="card"><h3>Incidents waiting to be settled</h3>' + table(
      ['Incident', 'State', 'Raised at', 'Cleared at', 'Delay minutes', 'Settlement', 'Actions'],
      incs.map(function (i) {
        var settleable = !i.settlement_id && ['CLEARED', 'SETTLE_READY'].indexOf(i.state) >= 0;
        var a = '<button class="act sec" onclick="swPreview(\'' + i.id + '\')">Preview figures</button>';
        if (settleable) a += '<button class="act" onclick="swAct(\'POST\',\'/api/settlements/incidents/' + i.id + '\',null,\'Incident settled.\')">Settle incident</button>';
        return [esc(i.id), stateTag(i.state), esc(i.raised_at), or(i.cleared_at),
          '<span class="num">' + mins(i.delay_minutes_total) + '</span>',
          i.settlement_id ? esc(i.settlement_id) : '—', a];
      })) + '</div>';

    incs.forEach(function (i) {
      if (!S.preview[i.id]) return;
      h += '<div class="card"><h3>' + esc(i.id) + ' — preview</h3>' + previewFigures(S.preview[i.id]) + '</div>';
    });

    h += '<div class="card"><h3>Append a correction to an incident</h3>';
    h += incs.map(function (i) {
      return '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/incidents/' + i.id + '/corrections\',[\'detail\'],\'Correction appended.\')">' +
        '<label>' + esc(i.id) + ' <input name="detail" placeholder="what is being corrected" size="40" /></label>' +
        '<button class="act sec" type="submit">Append correction</button></form>';
    }).join('') + '<p class="muted">A settled incident is never rewritten; a correction is appended to its record.</p></div>';

    h += '<div class="card"><h3>Incident settlements</h3>' + table(
      ['Settlement', 'Incident', 'Period', 'Delay minutes', 'Gross penalty', 'Banded or flat', 'Window', 'Credit', 'Credit applied', 'Net', 'State'],
      (d.incident_settlements || []).map(function (s) {
        return ['<strong>' + esc(s.id) + '</strong>', esc(s.incident_id), or(s.period_id),
          '<span class="num">' + mins(s.delay_minutes) + '</span>',
          '<span class="money">' + money(s.gross_pence) + '</span>',
          s.state === 'OFFSET' ? '—' : (s.banded ? tag('banded', 'ok') : tag('flat in window', 'warn')),
          or(s.window_id), or(s.credit_id), '<span class="money">' + money(s.credit_applied_pence) + '</span>',
          '<span class="money"><strong>' + money(s.net_pence) + '</strong></span>', stateTag(s.state)];
      })) + '</div>';

    h += positions(d.incident_settlements || [], 'net_pence', 'Incident settlement');

    h += '<div class="card"><h3>Unsettled callouts</h3>' + table(['Reference', 'Technician', 'Job', 'Starts at', 'Ends at', 'Settled in'],
      (d.callouts || []).map(function (c) {
        return [esc(c.id), esc(c.technician_id), or(c.job_id), esc(c.starts_at), esc(c.ends_at),
          c.settled_in ? esc(c.settled_in) : tag('unsettled', 'warn')];
      })) + '</div>';

    if (S.labour) {
      h += '<div class="card"><h3>Labour preview (nothing is posted)</h3>' + table(
        ['Technician', 'Callouts merged', 'Merged span', 'Worked minutes', 'Billed minutes', 'Normal minutes', 'Overtime minutes', 'Night minutes', 'Base', 'Overtime', 'Night', 'Total'],
        (S.labour.spans || []).map(function (s) { return spanRow(s); })) +
        '<p class="muted">Considered: ' + esc((S.labour.callouts_considered || []).join(', ') || 'none') +
        ' &middot; total <span class="money">' + money(S.labour.total_pence) + '</span></p></div>';
    }

    h += '<div class="card"><h3>Settle labour</h3>' +
      '<button class="act" onclick="swAct(\'POST\',\'/api/settlements/labour\',null,\'Labour settled.\')">Settle every unsettled callout</button>' +
      '<form class="inline" onsubmit="return swSubmitList(event,\'POST\',\'/api/settlements/labour\',[\'callout_ids\'],\'Labour settled.\')">' +
      '<label>Or just these callouts <input name="callout_ids" placeholder="CAL-001, CAL-002" size="34" /></label>' +
      '<button class="act sec" type="submit">Settle the callouts listed</button></form></div>';

    h += '<div class="card"><h3>Labour settlements</h3>' + table(
      ['Settlement', 'Technician', 'Callouts merged', 'Span', 'Worked minutes', 'Billed minutes', 'Normal minutes', 'Overtime minutes', 'Night minutes', 'Base', 'Overtime', 'Night', 'Total', 'State'],
      (d.labour_settlements || []).map(function (s) {
        return ['<strong>' + esc(s.id) + '</strong>', esc(s.technician_id), or(s.parts),
          esc(s.starts_at) + ' → ' + esc(s.ends_at),
          '<span class="num">' + mins(s.worked_minutes) + '</span>',
          '<span class="num">' + mins(s.billed_minutes) + (s.billed_minutes > s.worked_minutes ? ' ' + tag('four-hour minimum applied', 'warn') : '') + '</span>',
          '<span class="num">' + mins(s.normal_minutes) + '</span>',
          '<span class="num">' + mins(s.overtime_minutes) + '</span>',
          '<span class="num">' + mins(s.night_minutes) + '</span>',
          '<span class="money">' + money(s.base_pence) + '</span>',
          '<span class="money">' + money(s.overtime_pence) + '</span>',
          '<span class="money">' + money(s.night_pence) + '</span>',
          '<span class="money"><strong>' + money(s.total_pence) + '</strong></span>', stateTag(s.state)];
      })) + '</div>';

    h += positions(d.labour_settlements || [], 'total_pence', 'Labour settlement');

    h += '<div class="card"><h3>Adjust a settlement</h3>' +
      (d.incident_settlements || []).concat(d.labour_settlements || []).filter(function (s) { return s.state !== 'OFFSET'; }).map(function (s) {
        return '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/settlements/' + s.id + '/adjust\',[\'amount_pence\',\'reason\'],\'Adjustment applied.\',[\'amount_pence\'])">' +
          '<label>' + esc(s.id) + ' — adjust by pence <input name="amount_pence" placeholder="e.g. -2500" /></label>' +
          '<label>Reason <input name="reason" /></label>' +
          '<button class="act sec" type="submit">Adjust</button></form>';
      }).join('') +
      '<p class="muted">While the period is open the settlement itself is edited. Once the period is closed the original is frozen and the adjustment is appended as an offset.</p></div>';

    h += '<div class="card"><h3>Mutual-aid credits</h3>' + table(['Credit', 'Earmarked for', 'Amount', 'State', 'Consumed on'],
      (d.mutual_aid_credits || []).map(function (c) {
        return [esc(c.id), or(c.incident_id), '<span class="money">' + money(c.amount_pence) + '</span>', stateTag(c.state), or(c.consumed_on_settlement)];
      })) + '</div>';

    h += '<div class="card"><h3>Delay penalty bands</h3>' + table(['Band', 'Sequence', 'Up to minutes', 'Pence a minute'],
      (d.penalty_bands || []).map(function (b) {
        return [esc(b.id), String(b.sequence), b.up_to_minutes === null ? 'no ceiling' : '<span class="num">' + b.up_to_minutes + '</span>',
          '<span class="num">' + b.pence_per_minute + 'p</span>'];
      })) + '<p class="muted">The bands are marginal: each rate applies only to the minutes inside that band.</p></div>';

    h += '<div class="card"><h3>Major-disruption windows</h3>' + table(['Window', 'Starts at', 'Ends at', 'Reason'],
      (d.disruption_windows || []).map(function (w) { return [esc(w.id), esc(w.starts_at), esc(w.ends_at), or(w.reason)]; })) +
      '<p class="muted">An incident whose whole span falls inside a window is charged flat at the middle band rate instead of being banded.</p></div>';

    h += '<div class="card"><h3>Payroll rules</h3>' + table(['Rule', 'Kind', 'Detail'],
      (d.payroll_rules || []).map(function (r) { return [esc(r.id), esc(r.rule), esc(r.detail)]; })) + '</div>';
    return h;
  };

  function spanRow(s) {
    return [esc(s.technician_id), esc((s.parts || []).join(' + ')), esc(s.starts_at) + ' → ' + esc(s.ends_at),
      '<span class="num">' + mins(s.worked_minutes) + '</span>',
      '<span class="num">' + mins(s.billed_minutes) + (s.billed_minutes > s.worked_minutes ? ' ' + tag('four-hour minimum applied', 'warn') : '') + '</span>',
      '<span class="num">' + mins(s.normal_minutes) + '</span>',
      '<span class="num">' + mins(s.overtime_minutes) + '</span>',
      '<span class="num">' + mins(s.night_minutes) + '</span>',
      '<span class="money">' + money(s.base_pence) + '</span>',
      '<span class="money">' + money(s.overtime_pence) + '</span>',
      '<span class="money">' + money(s.night_pence) + '</span>',
      '<span class="money"><strong>' + money(s.total_pence) + '</strong></span>'];
  }

  // Original figure, each offset against it, and the current position.
  function positions(rows, field, what) {
    var originals = rows.filter(function (r) { return r.state !== 'OFFSET'; });
    var offsets = rows.filter(function (r) { return r.state === 'OFFSET'; });
    if (!offsets.length) return '';
    var h = '<div class="card"><h3>' + esc(what) + 's corrected after the period closed</h3>';
    originals.forEach(function (o) {
      var mine = offsets.filter(function (x) { return x.offsets_settlement_id === o.id; });
      if (!mine.length) return;
      var current = mine.reduce(function (t, x) { return t + x[field]; }, o[field]);
      h += '<div class="rec"><dl class="kv"><dt>Settlement</dt><dd>' + esc(o.id) + ' (period ' + or(o.period_id) + ')</dd>' +
        '<dt>Original figure</dt><dd class="money"><strong>' + money(o[field]) + '</strong></dd></dl>' +
        table(['Offset', 'Amount', 'Reason', 'Posted at'], mine.map(function (x) {
          return [esc(x.id), '<span class="money">' + money(x[field]) + '</span>', or(x.reason), esc(x.settled_at)];
        })) +
        '<dl class="kv"><dt>Current position</dt><dd class="money"><strong>' + money(current) + '</strong></dd></dl></div>';
    });
    return h + '</div>';
  }

  // ---------------------------------------------------------------- periods
  PAGES.periods = function (d) {
    return '<h2>Settlement periods</h2><div class="card">' + table(['Period', 'Label', 'State', 'Closed by', 'Closed at', ''],
      (d.periods || []).map(function (p) {
        return ['<strong>' + esc(p.id) + '</strong>', esc(p.label),
          p.state === 'OPEN' ? tag('OPEN', 'warn') : tag('CLOSED', 'ok'), or(p.closed_by), or(p.closed_at),
          p.state === 'OPEN'
            ? '<button class="act" onclick="swAct(\'POST\',\'/api/periods/' + p.id + '/close\',null,\'Period closed.\')">Close period</button>'
            : '<span class="muted">already closed — its settlements are immutable</span>'];
      })) + '</div>';
  };

  // ---------------------------------------------------------------- ledger
  PAGES.ledger = function (d) {
    var debit = 0, credit = 0;
    (d.ledger || []).forEach(function (g) { debit += g.debit_pence; credit += g.credit_pence; });
    return '<h2>Ledger</h2><div class="card">' + table(['#', 'Account', 'Reference', 'Description', 'Debit', 'Credit', 'At'],
      (d.ledger || []).map(function (g) {
        return [String(g.id), esc(g.account), esc(g.ref), esc(g.description),
          '<span class="money">' + (g.debit_pence ? money(g.debit_pence) : '—') + '</span>',
          '<span class="money">' + (g.credit_pence ? money(g.credit_pence) : '—') + '</span>', esc(g.created_at)];
      })) + '<p class="muted">Total debits <span class="money">' + money(debit) + '</span> &middot; total credits <span class="money">' + money(credit) + '</span></p></div>';
  };

  // ---------------------------------------------------------------- users
  PAGES.users = function (d) {
    return '<h2>Users</h2><div class="card">' + table(['User', 'Name', 'Email', 'Role', 'Suspended', 'Actions'],
      (d.users || []).map(function (u) {
        var a = '<form class="inline" onsubmit="return swSubmit(event,\'POST\',\'/api/admin/users/' + u.id + '/role\',[\'role\'],\'Role changed.\')">' +
          '<select name="role">' + ['signaller', 'teamlead', 'maintenance', 'engineer', 'safety', 'admin'].map(function (r) {
            return '<option' + (r === u.role ? ' selected' : '') + '>' + r + '</option>';
          }).join('') + '</select><button class="act sec" type="submit">Change role</button></form>' +
          '<button class="act sec" onclick="swAct(\'POST\',\'/api/admin/users/' + u.id + '/suspend\',{suspended:' + (u.suspended ? 'false' : 'true') + '},\'User updated.\')">' +
          (u.suspended ? 'Reinstate' : 'Suspend') + '</button>';
        return [esc(u.id), esc(u.name), esc(u.email), esc(u.role), u.suspended ? tag('yes', 'bad') : tag('no', 'ok'), a];
      })) + '<p class="muted">An administrator cannot change or suspend their own account.</p></div>';
  };

  // ---------------------------------------------------------------- audit
  PAGES.audit = function (d) {
    return '<h2>Audit trail</h2><div class="card">' + table(['#', 'Actor', 'Action', 'Subject', 'Detail', 'At', 'Amend'],
      (d.audit || []).map(function (a) {
        return [String(a.id), or(a.actor_id), esc(a.action), esc(a.subject), or(a.detail), esc(a.created_at),
          '<button class="act sec" onclick="swAct(\'DELETE\',\'/api/audit/' + a.id + '\',null,\'Deleted.\')">Attempt to amend</button>'];
      })) + '<p class="muted">The trail is append-only: an attempt to amend an entry is refused, and the refusal is shown here.</p></div>';
  };

  // ---------------------------------------------------------------- notifications
  PAGES.notifications = function (d) {
    return '<h2>Notifications</h2><div class="card">' + table(['#', 'Subject', 'Section', 'Message', 'At'],
      (d.notifications || []).map(function (n) {
        return [String(n.id), or(n.subject), or(n.section_id), esc(n.message), esc(n.created_at)];
      })) + '</div>';
  };

  // ---------------------------------------------------------------- forms
  function collect(form, fields, numeric) {
    var body = {};
    fields.forEach(function (n) {
      var el = form.elements[n];
      if (!el) return;
      var v = String(el.value == null ? '' : el.value).trim();
      if (v === '') return;                                   // an empty box asks for nothing
      body[n] = (numeric && numeric.indexOf(n) >= 0) ? parseInt(v, 10) : v;
    });
    return body;
  }
  window.swSubmit = function (ev, method, url, fields, okMsg, numeric) {
    ev.preventDefault();
    act(method, url, collect(ev.target, fields, numeric), okMsg);
    return false;
  };
  // The one form whose field is a LIST of references rather than a single value.
  window.swSubmitList = function (ev, method, url, fields, okMsg) {
    ev.preventDefault();
    var f = ev.target, body = {};
    fields.forEach(function (n) {
      var v = f.elements[n] ? f.elements[n].value.trim() : '';
      if (v) body[n] = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    });
    act(method, url, body, okMsg);
    return false;
  };
  // The inspections desk picks the asset on the form, so the path is built here.
  window.swInspect = function (ev) {
    ev.preventDefault();
    var f = ev.target, asset = String(f.elements.asset_id.value || '').trim();
    var body = collect(f, ['id', 'result', 'inspected_on', 'next_due_on', 'technician_id', 'evidence_ref']);
    act('POST', '/api/assets/' + encodeURIComponent(asset) + '/inspections', body, 'Inspection recorded.');
    return false;
  };
  window.swPreview = function (id) {
    api('GET', '/api/settlements/incidents/' + encodeURIComponent(id) + '/preview')
      .then(function (p) { S.preview[id] = p; render(); flash('Preview for ' + id + ': net ' + money(p.net_pence) + '.', 'ok'); })
      .catch(function (e) { flash(refusalText(e), 'err'); });
  };
  window.swLogin = function (ev) {
    ev.preventDefault();
    var f = ev.target;
    api('POST', '/api/auth/login', { email: f.email.value.trim().toLowerCase(), password: f.password.value })
      .then(function () { S.tab = null; S.preview = {}; return load(); })
      .catch(function (e) { flash(refusalText(e), 'err'); });
    return false;
  };
  window.swLogout = function () {
    api('POST', '/api/auth/logout', {}).then(function () {
      S.me = null; S.data = null; S.incidents = null; S.labour = null; S.preview = {}; S.tab = null; render();
    });
  };
  window.swTab = function (t) { S.tab = t; render(); };

  // ---------------------------------------------------------------- shell
  var LABELS = {
    incidents: 'Incidents', assets: 'Assets', sections: 'Sections', blockages: 'Blockages',
    jobs: 'Jobs', technicians: 'Technicians', callouts: 'Callouts', handbacks: 'Handbacks',
    inspections: 'Inspections', possessions: 'Possessions', configuration: 'Configuration',
    settlements: 'Settlement', periods: 'Periods', ledger: 'Ledger', users: 'Users',
    audit: 'Audit', notifications: 'Notifications',
  };

  function render() {
    if (!S.me) {
      root.innerHTML = '<header><h1>Signalworks</h1></header><main><div class="login card">' +
        '<h2>Sign in</h2><div id="flash"></div>' +
        '<form onsubmit="return swLogin(event)">' +
        '<p><label>Email<br/><input name="email" style="width:100%" placeholder="you@signalworks.test" /></label></p>' +
        '<p><label>Password<br/><input name="password" type="password" style="width:100%" /></label></p>' +
        '<button class="act" type="submit">Sign in</button></form></div></main>';
      paintFlash();
      return;
    }
    var areas = [];
    (S.data.areas || []).forEach(function (a) { if (areas.indexOf(a) < 0) areas.push(a); });
    if (!S.tab || areas.indexOf(S.tab) < 0) S.tab = areas[0];
    var body;
    try { body = PAGES[S.tab] ? PAGES[S.tab](S.data) : '<p class="muted">Nothing to show.</p>'; }
    catch (e) { body = '<p class="muted">This screen could not be drawn: ' + esc(e.message) + '</p>'; }
    root.innerHTML =
      '<header><h1>Signalworks</h1><span class="muted" style="color:#cfe0f5">' +
      esc(((S.data.region || {}).name || 'signalling control')) + ' &middot; reference date ' + esc(refDate()) + '</span>' +
      '<span class="who">' + esc(S.me.name) + ' &middot; ' + esc(S.me.role) +
      ' &nbsp;<button class="act sec" onclick="swLogout()">Sign out</button></span></header>' +
      '<nav>' + areas.map(function (a) {
        return '<button class="' + (a === S.tab ? 'active' : '') + '" onclick="swTab(\'' + a + '\')">' + esc(LABELS[a] || a) + '</button>';
      }).join('') + '</nav><main><div id="flash"></div>' + body + '</main>';
    paintFlash();
  }

  function load() {
    return api('GET', '/api/bootstrap').then(function (d) {
      S.data = d; S.me = d.user;
      var extra = [];
      if ((d.areas || []).indexOf('settlements') >= 0) {
        extra.push(api('GET', '/api/incidents').then(function (x) { S.incidents = x; }, function () { S.incidents = []; }));
        extra.push(api('GET', '/api/settlements/labour/preview').then(function (x) { S.labour = x; }, function () { S.labour = null; }));
      }
      return Promise.all(extra);
    }).then(function () { render(); }, function () { S.me = null; S.data = null; render(); });
  }
  load();
})();
