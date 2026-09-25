const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Use a dedicated clean test database
const testDbPath = path.join(__dirname, 'test_e2e_coursemark.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
process.env.DB_PATH = testDbPath;

const { initializeDatabase } = require('../src/db');
const { app } = require('../server');

let server;
let baseUrl;

function request(method, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = options.headers || {};
    let body = options.body;

    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      headers['content-type'] = 'application/json';
    }

    const req = http.request(url, {
      method: method.toUpperCase(),
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
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
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runE2ETests() {
  console.log('--- Starting Comprehensive Coursemark E2E Test Suite ---');

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`E2E Test Server listening at ${baseUrl}`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // 1. Health Endpoint
    // -------------------------------------------------------------
    console.log('[E2E 1] Public Health Check');
    const health = await request('GET', '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'ok');
    assert.strictEqual(health.body.reference_moment, '2026-09-02T12:00:00Z');

    // -------------------------------------------------------------
    // 2. Authentication & Session Revocation
    // -------------------------------------------------------------
    console.log('[E2E 2] Authentication & Session Management');
    // Unauthenticated access
    const unauthMe = await request('GET', '/api/auth/me');
    assert.strictEqual(unauthMe.status, 401);

    // Invalid password
    const badPass = await request('POST', '/api/auth/login', {
      body: { email: 'ada.mensah@coursemark.example', password: 'InvalidPassword' }
    });
    assert.strictEqual(badPass.status, 401);

    // Login Ada (Instructor)
    const adaLogin = await request('POST', '/api/auth/login', {
      body: { email: 'ada.mensah@coursemark.example', password: 'Coursemark!2026' }
    });
    assert.strictEqual(adaLogin.status, 200);
    const adaToken = adaLogin.body.token;
    assert.strictEqual(adaLogin.body.user.role, 'instructor');

    // Login Luis (TA)
    const luisLogin = await request('POST', '/api/auth/login', {
      body: { email: 'luis.ortega@coursemark.example', password: 'Coursemark!2026' }
    });
    assert.strictEqual(luisLogin.status, 200);
    const luisToken = luisLogin.body.token;
    assert.strictEqual(luisLogin.body.user.role, 'teaching_assistant');

    // Login Nora (Student)
    const noraLogin = await request('POST', '/api/auth/login', {
      body: { email: 'nora.kim@coursemark.example', password: 'Coursemark!2026' }
    });
    assert.strictEqual(noraLogin.status, 200);
    const noraToken = noraLogin.body.token;
    assert.strictEqual(noraLogin.body.user.role, 'student');

    // Login Ben (Student)
    const benLogin = await request('POST', '/api/auth/login', {
      body: { email: 'ben.okafor@coursemark.example', password: 'Coursemark!2026' }
    });
    assert.strictEqual(benLogin.status, 200);
    const benToken = benLogin.body.token;

    // Test multi-session logout
    const secondNoraLogin = await request('POST', '/api/auth/login', {
      body: { email: 'nora.kim@coursemark.example', password: 'Coursemark!2026' }
    });
    const secondNoraToken = secondNoraLogin.body.token;

    const logoutNora = await request('POST', '/api/auth/logout', {
      headers: { Authorization: `Bearer ${secondNoraToken}` }
    });
    assert.strictEqual(logoutNora.status, 200);

    // BOTH tokens for Nora must now be revoked
    const checkRevoked1 = await request('GET', '/api/auth/me', {
      headers: { Authorization: `Bearer ${noraToken}` }
    });
    assert.strictEqual(checkRevoked1.status, 401);
    const checkRevoked2 = await request('GET', '/api/auth/me', {
      headers: { Authorization: `Bearer ${secondNoraToken}` }
    });
    assert.strictEqual(checkRevoked2.status, 401);

    // Re-login Nora
    const noraFresh = await request('POST', '/api/auth/login', {
      body: { email: 'nora.kim@coursemark.example', password: 'Coursemark!2026' }
    });
    const activeNoraToken = noraFresh.body.token;

    // -------------------------------------------------------------
    // 3. Concurrency, Revision Checking & Operation Idempotency
    // -------------------------------------------------------------
    console.log('[E2E 3] Concurrency, Revision Checking & Operation Idempotency');
    const meRes = await request('GET', '/api/auth/me', {
      headers: { Authorization: `Bearer ${adaToken}` }
    });
    let curRev = meRes.body.course.revision;
    assert.strictEqual(curRev, 0);

    // Missing expected_revision on write
    const missingRev = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        title: 'Test Assessment',
        opens_at: '2026-09-03T10:00:00Z',
        due_at: '2026-09-03T12:00:00Z',
        duration_minutes: 30,
        operation_id: 'op_test_missing_rev_1'
      }
    });
    assert.strictEqual(missingRev.status, 400);

    // Stale revision on write
    const staleRev = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        title: 'Test Assessment',
        opens_at: '2026-09-03T10:00:00Z',
        due_at: '2026-09-03T12:00:00Z',
        duration_minutes: 30,
        expected_revision: 99,
        operation_id: 'op_test_stale_rev_1'
      }
    });
    assert.strictEqual(staleRev.status, 409);

    // Replaying exact same stale request returns exact same 409
    const replayStale = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        title: 'Test Assessment',
        opens_at: '2026-09-03T10:00:00Z',
        due_at: '2026-09-03T12:00:00Z',
        duration_minutes: 30,
        expected_revision: 99,
        operation_id: 'op_test_stale_rev_1'
      }
    });
    assert.strictEqual(replayStale.status, 409);

    // Reusing op_test_stale_rev_1 with different parameters returns 409 mismatch
    const mismatchStale = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        title: 'Different Title',
        opens_at: '2026-09-03T10:00:00Z',
        due_at: '2026-09-03T12:00:00Z',
        duration_minutes: 30,
        expected_revision: 99,
        operation_id: 'op_test_stale_rev_1'
      }
    });
    assert.strictEqual(mismatchStale.status, 409);

    // -------------------------------------------------------------
    // 4. Assessment Authoring, Item Validation & Publishing
    // -------------------------------------------------------------
    console.log('[E2E 4] Assessment Authoring & Publishing');
    // Non-instructor cannot author
    const studentAuthor = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${activeNoraToken}` },
      body: {
        title: 'Student Attempting Authoring',
        opens_at: '2026-09-03T10:00:00Z',
        due_at: '2026-09-03T12:00:00Z',
        duration_minutes: 30,
        expected_revision: curRev,
        operation_id: 'op_student_author_1'
      }
    });
    assert.strictEqual(studentAuthor.status, 403);

    // Invalid dates (opens after due)
    const invalidDates = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        title: 'Invalid Dates Assessment',
        opens_at: '2026-09-04T10:00:00Z',
        due_at: '2026-09-03T10:00:00Z',
        duration_minutes: 30,
        expected_revision: curRev,
        operation_id: 'op_invalid_dates_1'
      }
    });
    assert.strictEqual(invalidDates.status, 400);

    // Valid create draft
    const createDraft = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        title: 'Biodiversity Index Quiz',
        opens_at: '2026-09-01T08:00:00Z',
        due_at: '2026-09-03T18:00:00Z',
        duration_minutes: 40,
        max_attempts: 2,
        expected_revision: curRev,
        operation_id: 'op_create_biodiversity_draft'
      }
    });
    assert.strictEqual(createDraft.status, 201);
    const newAssId = createDraft.body.assessment.id;
    curRev = createDraft.body.course_revision;
    assert.strictEqual(curRev, 1);

    // Add invalid MC question (duplicate options)
    const badMc = await request('POST', `/api/assessments/${newAssId}/items`, {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        kind: 'multiple_choice',
        prompt: 'Which index measures species richness and evenness?',
        points: 4,
        options: ['Shannon-Wiener', 'Shannon-Wiener', 'Simpson'],
        answer: 'Shannon-Wiener',
        expected_revision: curRev,
        operation_id: 'op_bad_mc_dup_1'
      }
    });
    assert.strictEqual(badMc.status, 400);

    // Add valid MC question
    const goodMc = await request('POST', `/api/assessments/${newAssId}/items`, {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        kind: 'multiple_choice',
        prompt: 'Which index measures species richness and evenness?',
        points: 4,
        options: ['Shannon-Wiener', 'Simpson', 'Pielou'],
        answer: 'Shannon-Wiener',
        expected_revision: curRev,
        operation_id: 'op_good_mc_1'
      }
    });
    assert.strictEqual(goodMc.status, 201);
    curRev = goodMc.body.course_revision;
    assert.strictEqual(curRev, 2);

    // Add valid Written question with rubric
    const goodWritten = await request('POST', `/api/assessments/${newAssId}/items`, {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        kind: 'written',
        prompt: 'Explain the effect of habitat fragmentation on species evenness.',
        points: 6,
        rubric_criteria: [
          { label: 'Identifies edge effects', max_points: 3 },
          { label: 'Explains population isolation', max_points: 3 }
        ],
        expected_revision: curRev,
        operation_id: 'op_good_written_1'
      }
    });
    assert.strictEqual(goodWritten.status, 201);
    curRev = goodWritten.body.course_revision;
    assert.strictEqual(curRev, 3);

    // Publish assessment
    const publishAss = await request('POST', `/api/assessments/${newAssId}/publish`, {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        expected_revision: curRev,
        operation_id: 'op_publish_biodiversity_1'
      }
    });
    assert.strictEqual(publishAss.status, 200);
    assert.strictEqual(publishAss.body.assessment.status, 'published');
    curRev = publishAss.body.course_revision;
    assert.strictEqual(curRev, 4);

    // Terminal publish check: cannot publish again or add items
    const publishAgain = await request('POST', `/api/assessments/${newAssId}/publish`, {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        expected_revision: curRev,
        operation_id: 'op_publish_biodiversity_again'
      }
    });
    assert.strictEqual(publishAgain.status, 400);

    const addItemToPublished = await request('POST', `/api/assessments/${newAssId}/items`, {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        kind: 'multiple_choice',
        prompt: 'Another prompt',
        points: 2,
        options: ['A', 'B'],
        answer: 'A',
        expected_revision: curRev,
        operation_id: 'op_add_item_to_pub_1'
      }
    });
    assert.strictEqual(addItemToPublished.status, 400);

    // -------------------------------------------------------------
    // 5. Timed Attempts, Accommodations, Answers & Submission
    // -------------------------------------------------------------
    console.log('[E2E 5] Timed Attempts, Accommodations, Answers & Submission');
    // Nora (user_3) has +15m extra time accommodation
    // Nora starts attempt on newAssId
    const startNora = await request('POST', '/api/attempts/start', {
      headers: { Authorization: `Bearer ${activeNoraToken}` },
      body: {
        assessment_id: newAssId,
        expected_revision: curRev,
        operation_id: 'op_start_nora_new_ass'
      }
    });
    assert.strictEqual(startNora.status, 201);
    const noraAttemptId = startNora.body.attempt.id;
    curRev = startNora.body.course_revision;

    // Student Nora saves answers
    // Find item IDs for newAssId
    const noraAssDetail = await request('GET', `/api/assessments/${newAssId}`, {
      headers: { Authorization: `Bearer ${activeNoraToken}` }
    });
    const itemsList = noraAssDetail.body.assessment.items;
    const mcItem = itemsList.find(i => i.kind === 'multiple_choice');
    const writtenItem = itemsList.find(i => i.kind === 'written');

    const saveAns = await request('POST', `/api/attempts/${noraAttemptId}/answers`, {
      headers: { Authorization: `Bearer ${activeNoraToken}` },
      body: {
        answers: [
          { item_id: mcItem.id, value: 'Shannon-Wiener' }, // correct (+4 pts)
          { item_id: writtenItem.id, value: 'Fragmentation increases edge effects and limits gene flow.' }
        ],
        expected_revision: curRev,
        operation_id: 'op_save_nora_answers_1'
      }
    });
    assert.strictEqual(saveAns.status, 200);
    curRev = saveAns.body.course_revision;

    // Submit attempt
    const submitNora = await request('POST', `/api/attempts/${noraAttemptId}/submit`, {
      headers: { Authorization: `Bearer ${activeNoraToken}` },
      body: {
        expected_revision: curRev,
        operation_id: 'op_submit_nora_attempt_1'
      }
    });
    assert.strictEqual(submitNora.status, 200);
    assert.strictEqual(submitNora.body.attempt.status, 'submitted');
    assert.strictEqual(submitNora.body.attempt.feedback_status, 'hidden');
    curRev = submitNora.body.course_revision;

    // Student privacy check: Nora reading attempt must NOT see objective_score or total_score
    const readNoraAttempt = await request('GET', `/api/attempts/${noraAttemptId}`, {
      headers: { Authorization: `Bearer ${activeNoraToken}` }
    });
    assert.strictEqual(readNoraAttempt.body.attempt.feedback_status, 'hidden');
    assert.strictEqual(readNoraAttempt.body.attempt.objective_score, null);
    assert.strictEqual(readNoraAttempt.body.attempt.rubric_score, null);
    assert.strictEqual(readNoraAttempt.body.attempt.total_score, null);

    // -------------------------------------------------------------
    // 6. Rubric Grading & Atomic Worksheets
    // -------------------------------------------------------------
    console.log('[E2E 6] Rubric Grading & Atomic Worksheets');
    // Staff Ada views noraAttemptId
    const adaViewNora = await request('GET', `/api/attempts/${noraAttemptId}`, {
      headers: { Authorization: `Bearer ${adaToken}` }
    });
    assert.strictEqual(adaViewNora.status, 200);
    assert.strictEqual(adaViewNora.body.attempt.objective_score, 4);

    const rubricCrit = adaViewNora.body.attempt.items.find(i => i.kind === 'written').rubric_criteria;
    assert.strictEqual(rubricCrit.length, 2);

    // TA Luis grades assigned attempt AT-101 using worksheet
    const worksheetLuis = await request('POST', '/api/grading/worksheet', {
      headers: { Authorization: `Bearer ${luisToken}` },
      body: {
        rows: [
          { attempt_id: 'AT-101', criterion_id: 'RC-3', score: 2, feedback: 'Accurate model limitation' },
          { attempt_id: 'AT-101', criterion_id: 'RC-4', score: 3, feedback: 'Thorough explanation' }
        ],
        expected_revision: curRev,
        operation_id: 'op_ws_luis_at101'
      }
    });
    assert.strictEqual(worksheetLuis.status, 200);
    curRev = worksheetLuis.body.course_revision;

    // Instructor Ada grades noraAttemptId using worksheet
    const worksheetAda = await request('POST', '/api/grading/worksheet', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        rows: [
          { attempt_id: noraAttemptId, criterion_id: rubricCrit[0].id, score: 3, feedback: 'Great point on edges' },
          { attempt_id: noraAttemptId, criterion_id: rubricCrit[1].id, score: 2.5, feedback: 'Clear gene flow analysis' }
        ],
        expected_revision: curRev,
        operation_id: 'op_ws_ada_nora'
      }
    });
    assert.strictEqual(worksheetAda.status, 200);
    curRev = worksheetAda.body.course_revision;

    // Check noraAttempt is now 'graded'
    const noraGraded = await request('GET', `/api/attempts/${noraAttemptId}`, {
      headers: { Authorization: `Bearer ${adaToken}` }
    });
    assert.strictEqual(noraGraded.body.attempt.status, 'graded');
    assert.strictEqual(noraGraded.body.attempt.objective_score, 4);
    assert.strictEqual(noraGraded.body.attempt.rubric_score, 5.5);
    assert.strictEqual(noraGraded.body.attempt.total_score, 9.5);

    // -------------------------------------------------------------
    // 7. Reviewed Batch Release
    // -------------------------------------------------------------
    console.log('[E2E 7] Reviewed Batch Release');
    // Preview release for AT-101 and noraAttemptId
    const releasePreview = await request('POST', '/api/release/preview', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        attempt_ids: ['AT-101', noraAttemptId]
      }
    });
    assert.strictEqual(releasePreview.status, 200);
    assert.strictEqual(releasePreview.body.items.length, 2);
    const prevHandle = releasePreview.body.preview_id;

    // Commit batch release
    const releaseCommit = await request('POST', '/api/release/commit', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        preview_id: prevHandle,
        expected_revision: curRev,
        operation_id: 'op_commit_batch_release_both'
      }
    });
    assert.strictEqual(releaseCommit.status, 200);
    assert.strictEqual(releaseCommit.body.released_count, 2);
    curRev = releaseCommit.body.course_revision;

    // Nora reading her attempt now sees released scores!
    const noraAfterRelease = await request('GET', `/api/attempts/${noraAttemptId}`, {
      headers: { Authorization: `Bearer ${activeNoraToken}` }
    });
    assert.strictEqual(noraAfterRelease.body.attempt.feedback_status, 'released');
    assert.strictEqual(noraAfterRelease.body.attempt.total_score, 9.5);

    // -------------------------------------------------------------
    // 8. Outcome Ledger & Exceptions
    // -------------------------------------------------------------
    console.log('[E2E 8] Outcome Ledger, Policy & Student Exceptions');
    // Policy update: A-01: 30%, A-03: 30%, A-04: 20%, newAssId: 20% -> total 100%
    const updatePolicy = await request('POST', '/api/policy', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        weights: {
          'A-01': 30,
          'A-03': 30,
          'A-04': 20,
          [newAssId]: 20
        },
        expected_revision: curRev,
        operation_id: 'op_update_policy_e2e'
      }
    });
    assert.strictEqual(updatePolicy.status, 200);
    curRev = updatePolicy.body.course_revision;

    // Student Nora checks her outcome ledger row
    const noraOutcomes = await request('GET', '/api/outcomes', {
      headers: { Authorization: `Bearer ${activeNoraToken}` }
    });
    assert.strictEqual(noraOutcomes.status, 200);
    assert.strictEqual(noraOutcomes.body.ledger.length, 1);
    assert.strictEqual(noraOutcomes.body.ledger[0].student_id, 'user_3');

    // Excuse Nora for A-01 and A-04 to see calculated final grade
    const excuseNoraA01 = await request('POST', '/api/exceptions', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        student_id: 'user_3',
        assessment_id: 'A-01',
        excused: true,
        reason: 'Approved field conflict',
        expected_revision: curRev,
        operation_id: 'op_excuse_nora_a01'
      }
    });
    assert.strictEqual(excuseNoraA01.status, 200);
    curRev = excuseNoraA01.body.course_revision;

    const excuseNoraA04 = await request('POST', '/api/exceptions', {
      headers: { Authorization: `Bearer ${adaToken}` },
      body: {
        student_id: 'user_3',
        assessment_id: 'A-04',
        excused: true,
        reason: 'Waived prerequisite check',
        expected_revision: curRev,
        operation_id: 'op_excuse_nora_a04'
      }
    });
    assert.strictEqual(excuseNoraA04.status, 200);
    curRev = excuseNoraA04.body.course_revision;

    // Now Nora has released scores for A-03 (AT-102: 5/10 = 50%, weight 30%)
    // and newAssId (noraAttemptId: 9.5/10 = 95%, weight 20%).
    // Both included weights: 30 + 20 = 50.
    // Sum weighted = 30 * (5/10) + 20 * (9.5/10) = 15 + 19 = 34.
    // Final percentage = 100 * 34 / 50 = 68.00%.
    const noraCalculated = await request('GET', '/api/outcomes', {
      headers: { Authorization: `Bearer ${activeNoraToken}` }
    });
    assert.strictEqual(noraCalculated.body.ledger[0].final_status, 'calculated');
    assert.strictEqual(noraCalculated.body.ledger[0].final_percentage, 68.00);

    // -------------------------------------------------------------
    // 9. Audit Logging & Privacy
    // -------------------------------------------------------------
    console.log('[E2E 9] Durable Audit Log & Privacy');
    const adaAudit = await request('GET', '/api/audit', {
      headers: { Authorization: `Bearer ${adaToken}` }
    });
    assert.strictEqual(adaAudit.status, 200);
    assert.ok(adaAudit.body.events.length >= 10);
    // Newest first
    for (let i = 0; i < adaAudit.body.events.length - 1; i++) {
      assert.ok(adaAudit.body.events[i].id > adaAudit.body.events[i + 1].id);
    }

    const noraAudit = await request('GET', '/api/audit', {
      headers: { Authorization: `Bearer ${activeNoraToken}` }
    });
    assert.strictEqual(noraAudit.status, 200);
    // Student Nora only sees events relevant to user_3
    for (const ev of noraAudit.body.events) {
      assert.ok(ev.student_id === 'user_3' || ev.details.includes('user_3') || ev.details.includes('Nora'));
    }

    console.log('--- ALL E2E CONTRACT AND REQUIREMENT TESTS PASSED PERFECTLY! ---');
  } finally {
    if (server) {
      server.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

runE2ETests().catch(err => {
  console.error('E2E Test Failure:', err);
  process.exit(1);
});
