'use strict';

// Coordinated revisions use one SQLite transaction. Persisted intent and receipts
// make retries independent of later changes to a hire or the process lifetime.
module.exports = function installChangeSets(H) {
  const {app, db, R, auth, reject, idValue, economics, economicKeys, storedOffer,
    snapshot, movement, remit, mintGrant, receipt, audit, now, uid, one, all} = H;
  db.exec(`CREATE TABLE IF NOT EXISTS change_sets (
    id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, operation_key TEXT NOT NULL,
    canonical_json TEXT NOT NULL, state TEXT NOT NULL, preview_json TEXT NOT NULL,
    receipt_json TEXT, UNIQUE(actor_id,operation_key));`);

  function version(reqId) {
    // Append-only ledger identity detects ABA even when the balance returns.
    return String(one('SELECT COALESCE(MAX(id),0) AS version FROM commitment_movements WHERE req_id=?', reqId).version);
  }
  // Read-side freshness uses the same two tests as commit, so a reader can see
  // that a saved preview has gone out of date before anyone tries to post it.
  function freshness(preview) {
    const reasons = [];
    for (const c of preview.changes) {
      const o = one('SELECT status,superseded_by_id FROM offers WHERE id=?', c.old_offer_id);
      if (!o || o.status !== 'COMMITTED' || o.superseded_by_id) reasons.push(`Offer ${c.old_offer_id} is no longer the current committed offer.`);
    }
    for (const r of preview.requisitions) {
      if (version(r.req_id) !== r.version) reasons.push(`Requisition ${r.req_id} has had commitment activity since this preview was saved.`);
    }
    return {current: reasons.length === 0, stale_reasons: reasons};
  }
  function publicRow(row) {
    const preview = JSON.parse(row.preview_json);
    return {id: row.id, actor_id: row.actor_id, operation_key: row.operation_key,
      state: row.state, preview,
      receipt: row.receipt_json ? JSON.parse(row.receipt_json) : null,
      ...(row.state === 'PREVIEW' ? freshness(preview) : {})};
  }
  function memberFault(index, field, message) {
    const e = new Error(message); e.status = 400; e.details = {member_index: index, field}; throw e;
  }
  function canonical(body) {
    if (!Array.isArray(body.members) || body.members.length < 2 || body.members.length > 4)
      reject('A coordinated change needs 2 through 4 distinct current offers.');
    const seen = new Set();
    const members = body.members.map((m, index) => {
      if (!m || typeof m !== 'object') reject('Each member must describe an offer.');
      const offer_id = idValue(m.offer_id, 'source offer');
      if (seen.has(offer_id)) reject('An offer may appear only once in a change set.');
      seen.add(offer_id);
      const destination_req_id = idValue(m.destination_req_id, 'destination requisition');
      for (const key of economicKeys) {
        if (!Object.hasOwn(m, key)) memberFault(index, key, `Member ${index + 1}: supply ${key}.`);
        if (typeof m[key] !== 'number' || !Number.isSafeInteger(m[key]) || m[key] < 0)
          memberFault(index, key, `Member ${index + 1}: ${key} must be a nonnegative safe integer.`);
      }
      return {offer_id, destination_req_id, ...economics(m)};
    });
    members.sort((a,b) => a.offer_id < b.offer_id ? -1 : a.offer_id > b.offer_id ? 1 : 0);
    return members;
  }
  function calculate(members) {
    const budgets = new Map();
    const touch = id => {
      if (!budgets.has(id)) {
        const hr = R.headroom(db, id);
        if (!hr) reject('A destination requisition no longer exists.', 409);
        budgets.set(id, {req_id: id, before_headroom_cents: hr.headroom_cents,
          version: version(id), deltas: []});
      }
      return budgets.get(id);
    };
    const changes = members.map(m => {
      const o = storedOffer(m.offer_id, 'COMMITTED');
      const before = snapshot(o), comp = R.composition(m);
      touch(o.req_id).deltas.push(before.composition.committed_run_rate_cents);
      touch(m.destination_req_id).deltas.push(-comp.committed_run_rate_cents);
      return {old_offer_id: o.id, source_req_id: o.req_id, destination_req_id: m.destination_req_id,
        candidate: o.candidate, before, proposed: comp,
        signing_adjustment_cents: R.sumSafe(m.signing_bonus_cents, -o.signing_bonus_cents)};
    });
    const requisitions = [...budgets.values()].sort((a,b) => a.req_id < b.req_id ? -1 : 1).map(r => {
      const after = R.sumSafe(r.before_headroom_cents, ...r.deltas);
      if (after < 0) reject(`Coordinated change exceeds requisition ${r.req_id} by $${Math.floor(-after / 100)}.${String(-after % 100).padStart(2, '0')}.`, 409);
      return {req_id: r.req_id, version: r.version,
        before_headroom_cents: r.before_headroom_cents, after_headroom_cents: after};
    });
    return {requisitions, changes};
  }
  function requireOwner(row, actor) {
    if (!row) reject('No such change set.', 404);
    if (row.actor_id !== actor.id) reject('Only the Finance actor who prepared this change may submit it.', 403);
  }

  app.get('/api/change-sets', auth(), (_req,res) => res.json(all('SELECT * FROM change_sets ORDER BY rowid DESC').map(publicRow)));
  app.get('/api/change-sets/:id', auth(), (req,res) => {
    const row = one('SELECT * FROM change_sets WHERE id=?', req.params.id);
    if (!row) reject('No such change set.', 404);
    res.json(publicRow(row));
  });
  app.post('/api/change-sets/preview', auth('finance_controller'), (req,res) => {
    const key = idValue((req.body || {}).operation_key, 'operation key');
    const members = canonical(req.body || {}), normalized = JSON.stringify(members);
    const result = db.transaction(() => {
      const old = one('SELECT * FROM change_sets WHERE actor_id=? AND operation_key=?', req.user.id, key);
      if (old) {
        if (old.canonical_json !== normalized) reject('This operation key already identifies a different intent. Use a new key.', 409);
        return publicRow(old);
      }
      const preview = {...calculate(members), actor_id: req.user.id, actor_name: req.user.name};
      const id = uid('CS');
      db.prepare('INSERT INTO change_sets (id,actor_id,operation_key,canonical_json,state,preview_json) VALUES (?,?,?,?,?,?)')
        .run(id, req.user.id, key, normalized, 'PREVIEW', JSON.stringify(preview));
      return publicRow(one('SELECT * FROM change_sets WHERE id=?', id));
    }).immediate();
    res.json(result);
  });
  app.post('/api/change-sets/:id/commit', auth('finance_controller'), (req,res) => {
    const result = db.transaction(() => {
      const row = one('SELECT * FROM change_sets WHERE id=?', req.params.id);
      requireOwner(row, req.user);
      if (row.state === 'COMMITTED') return publicRow(row); // Original immutable receipt, never a current recomputation.
      const preview = JSON.parse(row.preview_json), members = JSON.parse(row.canonical_json);
      for (const r of preview.requisitions) {
        if (version(r.req_id) !== r.version) reject('Stale preview: a touched requisition changed. Prepare a new operation key.', 409);
      }
      for (const m of members) storedOffer(m.offer_id, 'COMMITTED');
      calculate(members); // Complete final-budget/overflow validation before any ledger writes.
      const transitions = [];
      for (const m of members) {
        const o = storedOffer(m.offer_id, 'COMMITTED');
        const before = preview.changes.find(c => c.old_offer_id === o.id).before;
        const comp = R.composition(m);
        let id = `${o.id}-R`;
        while (one('SELECT id FROM offers WHERE id=?', id)) id = uid('OFF');
        const revised = {...o, ...Object.fromEntries(economicKeys.map(k => [k,m[k]])), id, req_id: m.destination_req_id};
        db.prepare(`INSERT INTO offers (id,req_id,candidate,status,base_salary_cents,signing_bonus_cents,relocation_cents,
          equity_units,equity_fair_cents,equity_strike_cents,referred_by,referred_hire_start,start_date,
          raised_by,raised_at,approved_by,approved_at,supersedes_id,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(id, revised.req_id, o.candidate, 'COMMITTED', ...economicKeys.map(k => m[k]), o.referred_by,
            o.referred_hire_start, o.start_date, o.raised_by, o.raised_at, o.approved_by, o.approved_at, o.id, `Coordinated change ${row.id}`);
        db.prepare("UPDATE offers SET status='SUPERSEDED',superseded_by_id=? WHERE id=?").run(id,o.id);
        movement(o, 'REVERSAL', before.composition.committed_run_rate_cents, row.id);
        movement(revised, 'COMMIT', -comp.committed_run_rate_cents, row.id);
        const delta = R.sumSafe(m.signing_bonus_cents, -o.signing_bonus_cents);
        if (delta) remit(revised, 'SIGNING_ADJUSTMENT', delta);
        db.prepare("UPDATE equity_grants SET state='SUPERSEDED' WHERE offer_id=?").run(o.id);
        mintGrant(revised);
        transitions.push({before, newId: id, delta});
      }
      const headrooms = preview.requisitions.map(r => ({req_id: r.req_id,
        before_headroom_cents: r.before_headroom_cents, after_headroom_cents: R.headroom(db,r.req_id).headroom_cents}));
      const changes = transitions.map(t => {
        const after = snapshot(one('SELECT * FROM offers WHERE id=?', t.newId));
        receipt('REVISE', req.user, t.before, after, {change_set_id: row.id, signing_adjustment_cents: t.delta, transaction_headrooms: headrooms});
        return {old_offer_id: t.before.id, new_offer_id: after.id,
          source_req_id: t.before.req_id, destination_req_id: after.req_id,
          signing_adjustment_cents: t.delta, before: t.before, after};
      });
      const settled = {change_set_id: row.id, operation_key: row.operation_key, actor_id: req.user.id,
        actor_name: req.user.name, requisitions: headrooms, changes};
      db.prepare("UPDATE change_sets SET state='COMMITTED',receipt_json=? WHERE id=?").run(JSON.stringify(settled), row.id);
      audit(req.user.id, 'CHANGE_SET_COMMITTED', row.id, `${changes.length} coordinated revisions committed atomically.`);
      return publicRow(one('SELECT * FROM change_sets WHERE id=?', row.id));
    }).immediate();
    res.json(result);
  });
  return publicRow;
};
