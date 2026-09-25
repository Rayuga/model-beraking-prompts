const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Use an isolated test database
const TEST_DB = path.join(__dirname, 'test_pellmoor.db');
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
process.env.DB_PATH = TEST_DB;

const app = require('../backend/server');
let server;
let baseUrl;

async function startTestServer() {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function request(method, pathUrl, options = {}) {
  const url = new URL(pathUrl, baseUrl);
  return new Promise((resolve, reject) => {
    const headers = options.headers || {};
    let bodyData = null;
    if (options.body) {
      bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyData);
    }
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const req = http.request(url, {
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Pellmoor Hiring Workspace Backend Tests ---');
  await startTestServer();

  let ruthToken, calToken, otisToken, wrenToken;

  try {
    // 1. Auth Tests
    console.log('1. Testing Authentication...');
    const loginRes = await request('POST', '/api/auth/login', {
      body: { email: 'hiring@pellmoor.test', password: 'password123' }
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.user.role, 'hiring manager');
    ruthToken = loginRes.body.token;

    const calLogin = await request('POST', '/api/auth/login', {
      body: { email: 'coord@pellmoor.test', password: 'password123' }
    });
    assert.strictEqual(calLogin.status, 200);
    calToken = calLogin.body.token;

    const otisLogin = await request('POST', '/api/auth/login', {
      body: { email: 'panel1@pellmoor.test', password: 'password123' }
    });
    assert.strictEqual(otisLogin.status, 200);
    otisToken = otisLogin.body.token;

    const wrenLogin = await request('POST', '/api/auth/login', {
      body: { email: 'panel2@pellmoor.test', password: 'password123' }
    });
    assert.strictEqual(wrenLogin.status, 200);
    wrenToken = wrenLogin.body.token;

    // Bad login
    const badLogin = await request('POST', '/api/auth/login', {
      body: { email: 'coord@pellmoor.test', password: 'wrong' }
    });
    assert.strictEqual(badLogin.status, 401);

    // 2. Vacancies Read & Capacity
    console.log('2. Testing Vacancies & Initial Seed Capacity...');
    const vacListRes = await request('GET', '/api/vacancies', { token: ruthToken });
    assert.strictEqual(vacListRes.status, 200);
    assert.strictEqual(vacListRes.body.vacancies.length, 4);

    const r14 = await request('GET', '/api/vacancies/ROLE-014', { token: ruthToken });
    assert.strictEqual(r14.status, 200);
    assert.strictEqual(r14.body.vacancy.openings, 2);
    assert.strictEqual(r14.body.vacancy.reserved, 0);
    assert.strictEqual(r14.body.vacancy.filled, 0);
    assert.strictEqual(r14.body.vacancy.available, 2);
    assert.strictEqual(r14.body.funnel.applied.reached, 4);
    assert.strictEqual(r14.body.funnel.interview.reached, 2);
    assert.strictEqual(r14.body.funnel.interview.lost, 1); // Nur Halabi was rejected at interview

    const r17 = await request('GET', '/api/vacancies/ROLE-017', { token: ruthToken });
    assert.strictEqual(r17.status, 200);
    assert.strictEqual(r17.body.vacancy.available, 1);
    assert.strictEqual(r17.body.funnel.applied.reached, 0); // Empty vacancy intentional state

    // 3. Server-owned fields rejection
    console.log('3. Testing Server-Owned Fields Rejection...');
    const forbiddenFieldRes = await request('POST', '/api/candidates', {
      token: calToken,
      body: {
        vacancy_code: 'ROLE-014',
        name: 'Hacker Candidate',
        assessment_version: 5,
        expected_revision: 1
      }
    });
    assert.strictEqual(forbiddenFieldRes.status, 400);

    // Strict JSON type check
    const badTypeRev = await request('POST', '/api/candidates', {
      token: calToken,
      body: {
        vacancy_code: 'ROLE-014',
        name: 'Valid Name',
        expected_revision: "1" // string should be rejected in JSON
      }
    });
    assert.strictEqual(badTypeRev.status, 400);

    // 4. Candidate Creation by Coordinator (Cal)
    console.log('4. Testing Candidate Creation...');
    // Ruth cannot create candidate
    const ruthCreate = await request('POST', '/api/candidates', {
      token: ruthToken,
      body: { vacancy_code: 'ROLE-014', name: 'Alice Test', expected_revision: 1 }
    });
    assert.strictEqual(ruthCreate.status, 403);

    // Cal creates candidate
    const createRes = await request('POST', '/api/candidates', {
      token: calToken,
      body: { vacancy_code: 'ROLE-014', name: 'Alice Test', expected_revision: 1 }
    });
    assert.strictEqual(createRes.status, 201);
    const aliceId = createRes.body.candidate.id;
    assert.strictEqual(createRes.body.candidate.stage, 'applied');
    assert.strictEqual(createRes.body.candidate.assessment_version, 1);
    assert.strictEqual(createRes.body.vacancy.vacancy.revision, 2);

    // Duplicate candidate rejected
    const dupRes = await request('POST', '/api/candidates', {
      token: calToken,
      body: { vacancy_code: 'ROLE-014', name: 'Alice Test', expected_revision: 2 }
    });
    assert.strictEqual(dupRes.status, 400);

    // 5. Stage Transitions & Hiring Rules
    console.log('5. Testing Stage Transitions...');
    // Cal cannot move candidate
    const calMove = await request('POST', `/api/candidates/${aliceId}/stage`, {
      token: calToken,
      body: { target_stage: 'screening', expected_revision: 2 }
    });
    assert.strictEqual(calMove.status, 403);

    // Ruth moves Alice: applied -> interview (disallowed skip)
    const skipMove = await request('POST', `/api/candidates/${aliceId}/stage`, {
      token: ruthToken,
      body: { target_stage: 'interview', expected_revision: 2 }
    });
    assert.strictEqual(skipMove.status, 400);

    // Ruth moves Alice: applied -> screening (+1 allowed)
    const move1 = await request('POST', `/api/candidates/${aliceId}/stage`, {
      token: ruthToken,
      body: { target_stage: 'screening', expected_revision: 2 }
    });
    assert.strictEqual(move1.status, 200);
    assert.strictEqual(move1.body.candidate.stage, 'screening');
    assert.strictEqual(move1.body.candidate.assessment_version, 1); // stays 1
    assert.strictEqual(move1.body.vacancy.vacancy.revision, 3);

    // Ruth moves Alice: screening -> interview (+1 allowed) -> advances assessment version to 2!
    const move2 = await request('POST', `/api/candidates/${aliceId}/stage`, {
      token: ruthToken,
      body: { target_stage: 'interview', expected_revision: 3 }
    });
    assert.strictEqual(move2.status, 200);
    assert.strictEqual(move2.body.candidate.stage, 'interview');
    assert.strictEqual(move2.body.candidate.assessment_version, 2); // advanced to 2!
    assert.strictEqual(move2.body.vacancy.vacancy.revision, 4);

    // 6. Panel Management & Assessment Freshness
    console.log('6. Testing Panel Management & Freshness...');
    // Ruth cannot modify panel
    const ruthPanel = await request('POST', `/api/candidates/${aliceId}/panel`, {
      token: ruthToken,
      body: { action: 'add', member_email: 'panel1@pellmoor.test', expected_revision: 4 }
    });
    assert.strictEqual(ruthPanel.status, 403);

    // Cannot add Cal to panel
    const calAddSelf = await request('POST', `/api/candidates/${aliceId}/panel`, {
      token: calToken,
      body: { action: 'add', member_email: 'coord@pellmoor.test', expected_revision: 4 }
    });
    assert.strictEqual(calAddSelf.status, 400);

    // Cal adds Otis (panel1) -> advances assessment_version to 3!
    const addOtis = await request('POST', `/api/candidates/${aliceId}/panel`, {
      token: calToken,
      body: { action: 'add', member_email: 'panel1@pellmoor.test', expected_revision: 4 }
    });
    assert.strictEqual(addOtis.status, 200);
    assert.strictEqual(addOtis.body.candidate.assessment_version, 3);
    assert.strictEqual(addOtis.body.vacancy.vacancy.revision, 5);

    // Cal adds Wren (panel2) -> advances assessment_version to 4!
    const addWren = await request('POST', `/api/candidates/${aliceId}/panel`, {
      token: calToken,
      body: { action: 'add', member_email: 'panel2@pellmoor.test', expected_revision: 5 }
    });
    assert.strictEqual(addWren.status, 200);
    assert.strictEqual(addWren.body.candidate.assessment_version, 4);
    assert.strictEqual(addWren.body.vacancy.vacancy.revision, 6);

    // 7. Scoring
    console.log('7. Testing Scoring...');
    // Cal cannot score
    const calScore = await request('POST', `/api/candidates/${aliceId}/scores`, {
      token: calToken,
      body: { score: 5, expected_revision: 6 }
    });
    assert.strictEqual(calScore.status, 403);

    // Otis scores 4 in version 4
    const otisScore = await request('POST', `/api/candidates/${aliceId}/scores`, {
      token: otisToken,
      body: { score: 4, expected_revision: 6 }
    });
    assert.strictEqual(otisScore.status, 200);
    assert.strictEqual(otisScore.body.candidate.current_scores.length, 1);
    assert.strictEqual(otisScore.body.candidate.current_scores[0].score, 4);
    assert.strictEqual(otisScore.body.vacancy.vacancy.revision, 7);

    // Try moving Alice to offer without Wren's score -> rejected 422!
    const preWrenOffer = await request('POST', `/api/candidates/${aliceId}/stage`, {
      token: ruthToken,
      body: { target_stage: 'offer', expected_revision: 7 }
    });
    assert.strictEqual(preWrenOffer.status, 422);

    // Wren scores 5 in version 4
    const wrenScore = await request('POST', `/api/candidates/${aliceId}/scores`, {
      token: wrenToken,
      body: { score: 5, expected_revision: 7 }
    });
    assert.strictEqual(wrenScore.status, 200);
    assert.strictEqual(wrenScore.body.candidate.current_scores.length, 2);
    assert.strictEqual(wrenScore.body.vacancy.vacancy.revision, 8);

    // Now Alice has 2 scores in v4, panel has 2 members, available capacity is 2 -> Move to offer succeeds!
    const offerAlice = await request('POST', `/api/candidates/${aliceId}/stage`, {
      token: ruthToken,
      body: { target_stage: 'offer', expected_revision: 8 }
    });
    assert.strictEqual(offerAlice.status, 200);
    assert.strictEqual(offerAlice.body.candidate.stage, 'offer');
    assert.strictEqual(offerAlice.body.vacancy.vacancy.reserved, 1);
    assert.strictEqual(offerAlice.body.vacancy.vacancy.available, 1);
    assert.strictEqual(offerAlice.body.vacancy.vacancy.revision, 9);

    // Panels and scores are frozen in offer
    const frozenPanel = await request('POST', `/api/candidates/${aliceId}/panel`, {
      token: calToken,
      body: { action: 'add', member_email: 'hiring@pellmoor.test', expected_revision: 9 }
    });
    assert.strictEqual(frozenPanel.status, 400);

    // 8. Reopening Interview & Score Invalidation
    console.log('8. Testing Reopening Interview (Offer -> Interview)...');
    // Ruth moves Alice back to interview: offer -> interview
    const reopenAlice = await request('POST', `/api/candidates/${aliceId}/stage`, {
      token: ruthToken,
      body: { target_stage: 'interview', expected_revision: 9 }
    });
    assert.strictEqual(reopenAlice.status, 200);
    assert.strictEqual(reopenAlice.body.candidate.stage, 'interview');
    assert.strictEqual(reopenAlice.body.candidate.assessment_version, 5); // Version advanced to 5!
    assert.strictEqual(reopenAlice.body.candidate.current_scores.length, 0); // No v5 scores!
    assert.strictEqual(reopenAlice.body.candidate.historical_scores.length, 2); // v4 scores are historical!
    assert.strictEqual(reopenAlice.body.vacancy.vacancy.reserved, 0); // Capacity released!
    assert.strictEqual(reopenAlice.body.vacancy.vacancy.available, 2);
    assert.strictEqual(reopenAlice.body.vacancy.vacancy.revision, 10);

    // 9. Batch Offers
    console.log('9. Testing Atomic Batch Offers...');
    // Let's prepare CAND-101 (in ROLE-014, currently interview, v1, Otis scored 4, Wren needs score)
    // Wren scores CAND-101 in v1
    const wrenScore101 = await request('POST', '/api/candidates/CAND-101/scores', {
      token: wrenToken,
      body: { score: 4, expected_revision: 10 }
    });
    assert.strictEqual(wrenScore101.status, 200);

    // Score Alice in v5 by Otis and Wren
    await request('POST', `/api/candidates/${aliceId}/scores`, {
      token: otisToken,
      body: { score: 5, expected_revision: 11 }
    });
    await request('POST', `/api/candidates/${aliceId}/scores`, {
      token: wrenToken,
      body: { score: 5, expected_revision: 12 }
    });

    // Preview batch offer for CAND-101 and Alice
    const previewRes = await request('POST', '/api/vacancies/ROLE-014/batch-offers/preview', {
      token: ruthToken,
      body: { candidate_ids: ['CAND-101', aliceId] }
    });
    assert.strictEqual(previewRes.status, 200);
    assert.strictEqual(previewRes.body.selected_count, 2);
    assert.strictEqual(previewRes.body.batch_eligible, true);
    assert.strictEqual(previewRes.body.projected_capacity.reserved, 2);
    assert.strictEqual(previewRes.body.projected_capacity.available, 0);

    // Execute atomic batch offer with Idempotency Key
    const batchKey = 'batch-op-key-001';
    const batchRes = await request('POST', '/api/vacancies/ROLE-014/batch-offers', {
      token: ruthToken,
      headers: { 'Idempotency-Key': batchKey },
      body: { candidate_ids: ['CAND-101', aliceId], expected_revision: 13 }
    });
    assert.strictEqual(batchRes.status, 200);
    assert.strictEqual(batchRes.body.batch_size, 2);
    assert.strictEqual(batchRes.body.vacancy.vacancy.reserved, 2);
    assert.strictEqual(batchRes.body.vacancy.vacancy.available, 0);
    assert.strictEqual(batchRes.body.vacancy.vacancy.revision, 14); // Revision advanced by 1 for whole batch!

    // Verify activity trail has exactly 2 events linked to batch
    const batchActivity = batchRes.body.vacancy.activity.filter(a => a.action_type === 'BATCH_OFFER');
    assert.strictEqual(batchActivity.length >= 2, true);
    assert.strictEqual(batchActivity[0].details.batch_size, 2);

    // Exact retry with same idempotency key returns saved result
    const retryRes = await request('POST', '/api/vacancies/ROLE-014/batch-offers', {
      token: ruthToken,
      headers: { 'Idempotency-Key': batchKey },
      body: { candidate_ids: ['CAND-101', aliceId], expected_revision: 13 }
    });
    assert.strictEqual(retryRes.status, 200);
    assert.strictEqual(retryRes.body.batch_id, batchRes.body.batch_id);

    // Reordered array with same idempotency key returns 409 mismatch
    const mismatchRes = await request('POST', '/api/vacancies/ROLE-014/batch-offers', {
      token: ruthToken,
      headers: { 'Idempotency-Key': batchKey },
      body: { candidate_ids: [aliceId, 'CAND-101'], expected_revision: 13 }
    });
    assert.strictEqual(mismatchRes.status, 409);

    // Different user cannot recover Ruth's receipt
    const calReplayRes = await request('POST', '/api/vacancies/ROLE-014/batch-offers', {
      token: calToken,
      headers: { 'Idempotency-Key': batchKey },
      body: { candidate_ids: ['CAND-101', aliceId], expected_revision: 13 }
    });
    assert.strictEqual(calReplayRes.status, 403); // Cal unauthorized, not getting Ruth's 200

    // 10. Additional Edge Cases: Funnel loss after backstep & Capacity release
    console.log('10. Testing Funnel Loss after Backstep & Capacity Transitions...');
    // Create candidate Bob in ROLE-014 (Cal)
    const bobRes = await request('POST', '/api/candidates', {
      token: calToken,
      body: { vacancy_code: 'ROLE-014', name: 'Bob Backstep', expected_revision: 14 }
    });
    assert.strictEqual(bobRes.status, 201);
    const bobId = bobRes.body.candidate.id;

    // Move Bob: applied -> screening -> interview -> screening -> rejected
    // 1. applied -> screening
    await request('POST', `/api/candidates/${bobId}/stage`, {
      token: ruthToken,
      body: { target_stage: 'screening', expected_revision: 15 }
    });
    // 2. screening -> interview
    await request('POST', `/api/candidates/${bobId}/stage`, {
      token: ruthToken,
      body: { target_stage: 'interview', expected_revision: 16 }
    });
    // 3. interview -> screening (backstep)
    await request('POST', `/api/candidates/${bobId}/stage`, {
      token: ruthToken,
      body: { target_stage: 'screening', expected_revision: 17 }
    });
    // 4. screening -> rejected (terminal)
    const bobRej = await request('POST', `/api/candidates/${bobId}/stage`, {
      token: ruthToken,
      body: { target_stage: 'rejected', expected_revision: 18 }
    });
    assert.strictEqual(bobRej.status, 200);

    // Check funnel: Bob visited applied, screening, interview, but last pipeline stage before rejected was screening!
    // So reached: applied, screening, interview. Lost: screening!
    const v14Updated = await request('GET', '/api/vacancies/ROLE-014', { token: ruthToken });
    assert.strictEqual(v14Updated.body.funnel.screening.lost, 1);

    // 11. Testing Business Rejection Idempotency Receipt
    console.log('11. Testing Business Rejection Receipts...');
    const rejectKey = 'rej-op-key-999';
    // Try to move Bob (who is rejected/terminal) to applied -> fails with 400
    const failRes1 = await request('POST', `/api/candidates/${bobId}/stage`, {
      token: ruthToken,
      headers: { 'Idempotency-Key': rejectKey },
      body: { target_stage: 'applied', expected_revision: 19 }
    });
    assert.strictEqual(failRes1.status, 400);

    // Exact retry returns the exact same saved 400 rejection
    const failRes2 = await request('POST', `/api/candidates/${bobId}/stage`, {
      token: ruthToken,
      headers: { 'Idempotency-Key': rejectKey },
      body: { target_stage: 'applied', expected_revision: 19 }
    });
    assert.strictEqual(failRes2.status, 400);
    assert.strictEqual(failRes2.body.error, failRes1.body.error);

    // Mismatch on same key returns 409
    const mismatchRej = await request('POST', `/api/candidates/${bobId}/stage`, {
      token: ruthToken,
      headers: { 'Idempotency-Key': rejectKey },
      body: { target_stage: 'screening', expected_revision: 19 }
    });
    assert.strictEqual(mismatchRej.status, 409);

    console.log('All backend tests passed successfully!');
  } finally {
    if (server) server.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  }
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
