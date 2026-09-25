const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

// We will test using an in-memory or temporary database to avoid polluting the default one,
// and also test against the app.
const testDbPath = path.join(__dirname, 'test_coursemark.db');
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

async function runTests() {
  console.log('Starting backend verification test suite...');

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });

  try {
    // 1. Health check
    console.log('Test 1: Health check');
    const health = await request('GET', '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'ok');
    assert.ok(health.body.reference_moment);

    // 2. Auth tests
    console.log('Test 2: Authentication');
    const badLogin = await request('POST', '/api/auth/login', {
      body: { email: 'ada.mensah@coursemark.example', password: 'wrong' }
    });
    assert.strictEqual(badLogin.status, 401);

    // Login instructor
    const instructorLogin = await request('POST', '/api/auth/login', {
      body: { email: 'ada.mensah@coursemark.example', password: 'Coursemark!2026' }
    });
    assert.strictEqual(instructorLogin.status, 200);
    const instructorToken = instructorLogin.body.token;
    assert.strictEqual(instructorLogin.body.user.role, 'instructor');

    // Login TA
    const taLogin = await request('POST', '/api/auth/login', {
      body: { email: 'luis.ortega@coursemark.example', password: 'Coursemark!2026' }
    });
    assert.strictEqual(taLogin.status, 200);
    const taToken = taLogin.body.token;

    // Login Student Nora
    const noraLogin = await request('POST', '/api/auth/login', {
      body: { email: 'nora.kim@coursemark.example', password: 'Coursemark!2026' }
    });
    assert.strictEqual(noraLogin.status, 200);
    const noraToken = noraLogin.body.token;

    // Login Student Ben
    const benLogin = await request('POST', '/api/auth/login', {
      body: { email: 'ben.okafor@coursemark.example', password: 'Coursemark!2026' }
    });
    assert.strictEqual(benLogin.status, 200);
    const benToken = benLogin.body.token;

    // Test /api/auth/me
    const me = await request('GET', '/api/auth/me', {
      headers: { Authorization: `Bearer ${noraToken}` }
    });
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.body.user.email, 'nora.kim@coursemark.example');

    // Test Logout revokes tokens
    const logoutRes = await request('POST', '/api/auth/logout', {
      headers: { Authorization: `Bearer ${noraToken}` }
    });
    assert.strictEqual(logoutRes.status, 200);

    const oldTokenCheck = await request('GET', '/api/auth/me', {
      headers: { Authorization: `Bearer ${noraToken}` }
    });
    assert.strictEqual(oldTokenCheck.status, 401);

    // Re-login Nora
    const noraLogin2 = await request('POST', '/api/auth/login', {
      body: { email: 'nora.kim@coursemark.example', password: 'Coursemark!2026' }
    });
    const noraFreshToken = noraLogin2.body.token;

    // 3. Courses and Assessments
    console.log('Test 3: Courses and Assessments isolation');
    const instructorAssessments = await request('GET', '/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` }
    });
    assert.strictEqual(instructorAssessments.status, 200);
    assert.strictEqual(instructorAssessments.body.assessments.length, 4); // A-01, A-02 (draft), A-03, A-04

    const studentAssessments = await request('GET', '/api/assessments', {
      headers: { Authorization: `Bearer ${noraFreshToken}` }
    });
    assert.strictEqual(studentAssessments.status, 200);
    assert.strictEqual(studentAssessments.body.assessments.length, 3); // ONLY published (A-01, A-03, A-04)
    assert.ok(studentAssessments.body.assessments.every(a => a.status === 'published'));

    // Check student assessment detail hides answer keys
    const studentA01 = await request('GET', '/api/assessments/A-01', {
      headers: { Authorization: `Bearer ${noraFreshToken}` }
    });
    assert.strictEqual(studentA01.status, 200);
    for (const item of studentA01.body.assessment.items) {
      assert.strictEqual(item.answer, undefined, 'Student must not see answer key');
    }

    // 4. Concurrency and Idempotency
    console.log('Test 4: Concurrency and Idempotency');
    const courseMe = await request('GET', '/api/auth/me', {
      headers: { Authorization: `Bearer ${instructorToken}` }
    });
    let currentRev = courseMe.body.course.revision;

    // Stale revision rejection
    const staleWrite = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        title: 'New Quiz',
        opens_at: '2026-09-03T10:00:00Z',
        due_at: '2026-09-03T12:00:00Z',
        duration_minutes: 30,
        max_attempts: 1,
        expected_revision: 999, // stale!
        operation_id: 'op_stale_test_123'
      }
    });
    assert.strictEqual(staleWrite.status, 409);
    assert.ok(staleWrite.body.error);

    // Valid create draft
    const createDraft = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        title: 'Wetland Ecology Survey',
        opens_at: '2026-09-03T10:00:00Z',
        due_at: '2026-09-03T12:00:00Z',
        duration_minutes: 30,
        max_attempts: 1,
        expected_revision: currentRev,
        operation_id: 'op_create_draft_123'
      }
    });
    assert.strictEqual(createDraft.status, 201);
    const newAssessmentId = createDraft.body.assessment.id;
    currentRev = createDraft.body.course_revision;

    // Replay exact same create draft -> returns identical 201 without incrementing revision
    const replayCreate = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        title: 'Wetland Ecology Survey',
        opens_at: '2026-09-03T10:00:00Z',
        due_at: '2026-09-03T12:00:00Z',
        duration_minutes: 30,
        max_attempts: 1,
        expected_revision: currentRev - 1, // original expected_revision
        operation_id: 'op_create_draft_123'
      }
    });
    assert.strictEqual(replayCreate.status, 201);
    assert.strictEqual(replayCreate.body.assessment.id, newAssessmentId);

    // Reusing same operation_id with different input -> 409 conflict
    const mismatchOp = await request('POST', '/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        title: 'Different Title',
        opens_at: '2026-09-03T10:00:00Z',
        due_at: '2026-09-03T12:00:00Z',
        duration_minutes: 30,
        max_attempts: 1,
        expected_revision: currentRev,
        operation_id: 'op_create_draft_123'
      }
    });
    assert.strictEqual(mismatchOp.status, 409);

    // 5. Add Items and Publish
    console.log('Test 5: Authoring items and publishing');
    // Multiple choice item
    const addMc = await request('POST', `/api/assessments/${newAssessmentId}/items`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        kind: 'multiple_choice',
        prompt: 'What is the primary indicator of hydric soils?',
        points: 5,
        options: ['Gleying', 'Sandy texture', 'Dry crust'],
        answer: 'Gleying',
        expected_revision: currentRev,
        operation_id: 'op_add_mc_123'
      }
    });
    assert.strictEqual(addMc.status, 201);
    currentRev = addMc.body.course_revision;

    // Written item with rubric
    const addWritten = await request('POST', `/api/assessments/${newAssessmentId}/items`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        kind: 'written',
        prompt: 'Describe the ecological role of wetland buffers.',
        points: 5,
        rubric_criteria: [
          { label: 'Identifies buffer functions', max_points: 3 },
          { label: 'Discusses nutrient filtering', max_points: 2 }
        ],
        expected_revision: currentRev,
        operation_id: 'op_add_written_123'
      }
    });
    assert.strictEqual(addWritten.status, 201);
    currentRev = addWritten.body.course_revision;

    // Publish assessment
    const publishRes = await request('POST', `/api/assessments/${newAssessmentId}/publish`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        expected_revision: currentRev,
        operation_id: 'op_publish_123'
      }
    });
    assert.strictEqual(publishRes.status, 200);
    assert.strictEqual(publishRes.body.assessment.status, 'published');
    currentRev = publishRes.body.course_revision;

    // 6. Attempts, answers, submission and grading
    console.log('Test 6: Grading and Worksheets');
    // Luis (TA) grades AT-101 (assigned to Luis)
    const at101Detail = await request('GET', '/api/attempts/AT-101', {
      headers: { Authorization: `Bearer ${taToken}` }
    });
    assert.strictEqual(at101Detail.status, 200);
    assert.strictEqual(at101Detail.body.attempt.status, 'submitted');

    // Worksheet grading on AT-101: RC-3 (max 2) = 2, RC-4 (max 3) = 2
    const worksheetRes = await request('POST', '/api/grading/worksheet', {
      headers: { Authorization: `Bearer ${taToken}` },
      body: {
        rows: [
          { attempt_id: 'AT-101', criterion_id: 'RC-3', score: 2, feedback: 'Good limitation' },
          { attempt_id: 'AT-101', criterion_id: 'RC-4', score: 2, feedback: 'Clear consequence' }
        ],
        expected_revision: currentRev,
        operation_id: 'op_worksheet_ta_123'
      }
    });
    assert.strictEqual(worksheetRes.status, 200);
    currentRev = worksheetRes.body.course_revision;

    // Check AT-101 is now graded
    const at101After = await request('GET', '/api/attempts/AT-101', {
      headers: { Authorization: `Bearer ${taToken}` }
    });
    assert.strictEqual(at101After.body.attempt.status, 'graded');
    assert.strictEqual(at101After.body.attempt.rubric_score, 4);

    // Student Ben reading AT-101 must NOT see scores before release!
    const benAt101 = await request('GET', '/api/attempts/AT-101', {
      headers: { Authorization: `Bearer ${benToken}` }
    });
    assert.strictEqual(benAt101.status, 200);
    assert.strictEqual(benAt101.body.attempt.feedback_status, 'hidden');
    assert.strictEqual(benAt101.body.attempt.objective_score, null);
    assert.strictEqual(benAt101.body.attempt.rubric_score, null);
    assert.strictEqual(benAt101.body.attempt.total_score, null);

    // 7. Batch Release Preview and Commit
    console.log('Test 7: Batch Release');
    const previewRes = await request('POST', '/api/release/preview', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        attempt_ids: ['AT-101']
      }
    });
    assert.strictEqual(previewRes.status, 200);
    assert.ok(previewRes.body.preview_id);
    assert.strictEqual(previewRes.body.items.length, 1);
    const previewId = previewRes.body.preview_id;

    // Commit batch release
    const commitRes = await request('POST', '/api/release/commit', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        preview_id: previewId,
        expected_revision: currentRev,
        operation_id: 'op_commit_release_123'
      }
    });
    assert.strictEqual(commitRes.status, 200);
    assert.strictEqual(commitRes.body.released_count, 1);
    currentRev = commitRes.body.course_revision;

    // Ben reading AT-101 now sees released feedback!
    const benAt101Released = await request('GET', '/api/attempts/AT-101', {
      headers: { Authorization: `Bearer ${benToken}` }
    });
    assert.strictEqual(benAt101Released.status, 200);
    assert.strictEqual(benAt101Released.body.attempt.feedback_status, 'released');
    assert.strictEqual(benAt101Released.body.attempt.total_score, 4); // 0 objective + 4 rubric

    // 8. Outcome Ledger & Policy & Exceptions
    console.log('Test 8: Outcome Ledger');
    const outcomesRes = await request('GET', '/api/outcomes', {
      headers: { Authorization: `Bearer ${instructorToken}` }
    });
    assert.strictEqual(outcomesRes.status, 200);
    assert.ok(outcomesRes.body.ledger.length >= 2);

    // TA forbidden from outcome ledger
    const taOutcomes = await request('GET', '/api/outcomes', {
      headers: { Authorization: `Bearer ${taToken}` }
    });
    assert.strictEqual(taOutcomes.status, 403);

    // Policy update: A-01: 30%, A-03: 40%, A-04: 20%, newAssessmentId: 10%
    const policyRes = await request('POST', '/api/policy', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        weights: {
          'A-01': 30,
          'A-03': 40,
          'A-04': 20,
          [newAssessmentId]: 10
        },
        expected_revision: currentRev,
        operation_id: 'op_policy_update_123'
      }
    });
    assert.strictEqual(policyRes.status, 200);
    currentRev = policyRes.body.course_revision;

    // Student exception (excuse Ben for A-01)
    const excuseRes = await request('POST', '/api/exceptions', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: {
        student_id: 'user_4',
        assessment_id: 'A-01',
        excused: true,
        reason: 'Medical accommodation approved',
        expected_revision: currentRev,
        operation_id: 'op_excuse_ben_123'
      }
    });
    assert.strictEqual(excuseRes.status, 200);
    currentRev = excuseRes.body.course_revision;

    // 9. Audit log
    console.log('Test 9: Audit log');
    const auditRes = await request('GET', '/api/audit', {
      headers: { Authorization: `Bearer ${instructorToken}` }
    });
    assert.strictEqual(auditRes.status, 200);
    assert.ok(auditRes.body.events.length > 0);

    console.log('All backend verification tests passed successfully!');
  } finally {
    if (server) {
      server.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
