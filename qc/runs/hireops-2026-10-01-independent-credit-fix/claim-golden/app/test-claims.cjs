const assert = require('node:assert/strict');

const origin = 'http://127.0.0.1:3000';
async function request(path, body, cookie) {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, 200, `${path}: ${response.status} ${JSON.stringify(data)}`);
  return { response, data };
}
async function login(email) {
  const { response, data } = await request('/api/auth/login', { email, password: 'Hireops!2026' });
  return { cookie: response.headers.get('set-cookie').split(';')[0], user: data };
}
async function run() {
  const recruiter = await login('rafael.costa@hireops.example');
  const approver = await login('bill.okafor@hireops.example');
  const finance = await login('farah.nasser@hireops.example');
  const req = 'REQ-CLAIM-PROBE';
  await request('/api/requisitions', { id: req, title: 'Claim probe', budget_cents: 100000000 }, recruiter.cookie);
  const offer = (id) => ({ id, req_id: req, candidate: id, start_date: '2026-01-01', base_salary_cents: 1000000, signing_bonus_cents: 100000, relocation_cents: 0, equity_units: 10, equity_fair_cents: 1000, equity_strike_cents: 0 });
  await request('/api/offers', offer('OFF-CLAIM-BASE'), recruiter.cookie);
  await request('/api/offers', offer('OFF-CLAIM-EXTRA'), recruiter.cookie);
  const first = (await request('/api/offers/OFF-CLAIM-BASE/approve', {}, approver.cookie)).data;
  const second = (await request('/api/offers/OFF-CLAIM-EXTRA/approve', {
    claimedActorId: recruiter.user.id,
    claimedRole: 'finance_controller',
    claimedTier: 0,
    claimedBand: 'III',
    claimedCommittedCents: 0,
  }, approver.cookie)).data;
  assert.equal(first.status, 'COMMITTED');
  assert.equal(second.status, 'COMMITTED');
  assert.equal(first.approved_by, approver.user.id);
  assert.equal(second.approved_by, approver.user.id);
  assert.equal(first.composition.committed_run_rate_cents, second.composition.committed_run_rate_cents);
  assert.notEqual(second.composition.committed_run_rate_cents, 0);
  const plain = (await request('/api/offers/OFF-CLAIM-BASE/rescind', { effective_at: '2026-02-01' }, finance.cookie)).data;
  const extra = (await request('/api/offers/OFF-CLAIM-EXTRA/rescind', { effective_at: '2026-02-01', claimedClawbackCents: 0, claimedCancelledUnits: 0 }, finance.cookie)).data;
  assert.equal(plain.status, 'RESCINDED');
  assert.equal(extra.status, 'RESCINDED');
  assert.equal(plain.clawback_cents, extra.clawback_cents);
  assert.equal(plain.equity_cancelled_units, extra.equity_cancelled_units);
  assert.notEqual(extra.clawback_cents, 0);
  assert.notEqual(extra.equity_cancelled_units, 0);
  console.log(JSON.stringify({ pass: true, approved_by: second.approved_by, committed_run_rate_cents: second.composition.committed_run_rate_cents, clawback_cents: extra.clawback_cents, equity_cancelled_units: extra.equity_cancelled_units }));
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
