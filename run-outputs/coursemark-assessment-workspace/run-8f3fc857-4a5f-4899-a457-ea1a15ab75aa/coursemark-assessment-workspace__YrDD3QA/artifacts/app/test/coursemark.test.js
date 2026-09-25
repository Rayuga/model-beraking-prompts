const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const SERVER_PATH = '/app/server.js';
const PORT = 3099;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coursemark-test-'));
const DB_PATH = path.join(TMP_DIR, 'coursemark.db');
let server;

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {
      // keep trying
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Server did not become healthy in time');
}

async function api(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.operationId) headers.set('X-Operation-Id', options.operationId);
  if (options.revision !== undefined) headers.set('X-Coursemark-Revision', String(options.revision));
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${BASE}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { response, data };
}

function opId() {
  return crypto.randomUUID();
}

async function signIn(email, password, operationId) {
  const { response, data } = await api('/api/auth/sign-in', {
    method: 'POST',
    body: { email, password },
    operationId,
    revision: 0,
    // sign-in doesn't require revision but the helper includes it only when provided
  });
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  return data;
}

async function startServer() {
  server = spawn('node', [SERVER_PATH], {
    cwd: '/app',
    env: { ...process.env, DB_PATH, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => process.stdout.write(chunk));
  server.stderr.on('data', chunk => process.stderr.write(chunk));
  await waitForHealth();
}

async function stopServer() {
  if (!server) return;
  server.kill('SIGTERM');
  await new Promise(resolve => server.once('exit', resolve));
}

test('Coursemark durable workspace flow', { concurrency: false }, async () => {
  await startServer();
  try {
    const health = await api('/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.data.ok, true);
    assert.equal(health.data.revision, 1);

    const instructorSignIn = await api('/api/auth/sign-in', {
      method: 'POST',
      body: { email: 'ada.mensah@coursemark.example', password: 'Coursemark!2026' },
      operationId: opId(),
    });
    assert.equal(instructorSignIn.response.status, 200);
    const instructor = instructorSignIn.data.user;
    const instructorToken = instructorSignIn.data.token;
    assert.equal(instructor.role, 'instructor');

    const replaySignIn = await api('/api/auth/sign-in', {
      method: 'POST',
      body: { email: 'ada.mensah@coursemark.example', password: 'Coursemark!2026' },
      operationId: '1f6d6dc8-7c16-4a7d-8b58-9d8c6e6a4f12',
    });
    const replaySignIn2 = await api('/api/auth/sign-in', {
      method: 'POST',
      body: { email: 'ada.mensah@coursemark.example', password: 'Coursemark!2026' },
      operationId: '1f6d6dc8-7c16-4a7d-8b58-9d8c6e6a4f12',
    });
    assert.equal(replaySignIn2.response.status, 200);
    assert.equal(replaySignIn.data.token, replaySignIn2.data.token);

    const instructorWorkspace = await api('/api/workspace', { token: instructorToken });
    assert.equal(instructorWorkspace.response.status, 200);
    assert.equal(instructorWorkspace.data.assessments.length, 4);
    assert.equal(instructorWorkspace.data.assessments.find(a => a.id === 'A-01').items[0].answer, 'Transect');
    assert.equal(instructorWorkspace.data.attempts.find(a => a.id === 'AT-103').feedbackStatus, 'hidden');

    const studentSignIn = await api('/api/auth/sign-in', {
      method: 'POST',
      body: { email: 'nora.kim@coursemark.example', password: 'Coursemark!2026' },
      operationId: opId(),
    });
    const studentToken = studentSignIn.data.token;
    const studentWorkspace = await api('/api/workspace', { token: studentToken });
    assert.equal(studentWorkspace.response.status, 200);
    const studentA01 = studentWorkspace.data.assessments.find(a => a.id === 'A-01');
    assert.ok(studentA01);
    assert.equal(Object.prototype.hasOwnProperty.call(studentA01.items[0], 'answer'), false);
    const studentAT100 = studentWorkspace.data.attempts.find(a => a.id === 'AT-100');
    assert.equal(studentAT100.objectiveScore, null);
    assert.equal(studentAT100.totalScore, null);

    const startOperationId = opId();
    const startA04 = await api('/api/assessments/A-04/start', {
      method: 'POST',
      token: studentToken,
      body: {},
      revision: studentWorkspace.data.course.revision,
      operationId: startOperationId,
    });
    assert.equal(startA04.response.status, 201);
    const attemptId = startA04.data.attemptId;
    const replayStartA04 = await api('/api/assessments/A-04/start', {
      method: 'POST',
      token: studentToken,
      body: {},
      revision: studentWorkspace.data.course.revision,
      operationId: startOperationId,
    });
    assert.equal(replayStartA04.data.attemptId, attemptId);

    const saveOperationId = opId();
    const saveAnswer = await api(`/api/attempts/${attemptId}/answers/I-05`, {
      method: 'PUT',
      token: studentToken,
      body: { value: 'Parallel veins' },
      revision: startA04.data.workspace.course.revision,
      operationId: saveOperationId,
    });
    assert.equal(saveAnswer.response.status, 200);
    const saveAnswerReplay = await api(`/api/attempts/${attemptId}/answers/I-05`, {
      method: 'PUT',
      token: studentToken,
      body: { value: 'Parallel veins' },
      revision: startA04.data.workspace.course.revision,
      operationId: saveOperationId,
    });
    assert.equal(saveAnswerReplay.data.itemId, 'I-05');

    const submitA04 = await api(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      token: studentToken,
      body: {},
      revision: saveAnswer.data.revision,
      operationId: opId(),
    });
    assert.equal(submitA04.response.status, 200);
    const studentAfterSubmit = await api(`/api/attempts/${attemptId}`, { token: studentToken });
    assert.equal(studentAfterSubmit.data.attempt.status, 'graded');
    assert.equal(studentAfterSubmit.data.attempt.objectiveScore, null);
    assert.equal(studentAfterSubmit.data.attempt.totalScore, null);

    const signOutInstructor = await api('/api/auth/sign-out', {
      method: 'POST',
      token: instructorToken,
      body: {},
      revision: instructorWorkspace.data.course.revision,
      operationId: opId(),
    });
    assert.equal(signOutInstructor.response.status, 200);
    const oldInstructorWorkspace = await api('/api/workspace', { token: instructorToken });
    assert.equal(oldInstructorWorkspace.response.status, 401);

    const instructorReSignIn = await api('/api/auth/sign-in', {
      method: 'POST',
      body: { email: 'ada.mensah@coursemark.example', password: 'Coursemark!2026' },
      operationId: opId(),
    });
    const instructorToken2 = instructorReSignIn.data.token;
    const instructorWorkspace2 = await api('/api/workspace', { token: instructorToken2 });
    assert.equal(instructorWorkspace2.response.status, 200);

    const createDraft = await api('/api/assessments', {
      method: 'POST',
      token: instructorToken2,
      body: {
        title: 'Wetland methods recap',
        opensAt: '2026-09-06T09:00:00Z',
        dueAt: '2026-09-06T10:00:00Z',
        durationMinutes: 20,
        maxAttempts: 1,
      },
      revision: instructorWorkspace2.data.course.revision,
      operationId: opId(),
    });
    assert.equal(createDraft.response.status, 201);
    const createdAssessmentId = createDraft.data.assessmentId;
    const createDraftReplay = await api('/api/assessments', {
      method: 'POST',
      token: instructorToken2,
      body: {
        title: 'Wetland methods recap',
        opensAt: '2026-09-06T09:00:00Z',
        dueAt: '2026-09-06T10:00:00Z',
        durationMinutes: 20,
        maxAttempts: 1,
      },
      revision: instructorWorkspace2.data.course.revision,
      operationId: '1b8b1741-91c9-4c2c-b5cf-ff8145f4f44f',
    });
    const createDraftReplay2 = await api('/api/assessments', {
      method: 'POST',
      token: instructorToken2,
      body: {
        title: 'Wetland methods recap',
        opensAt: '2026-09-06T09:00:00Z',
        dueAt: '2026-09-06T10:00:00Z',
        durationMinutes: 20,
        maxAttempts: 1,
      },
      revision: instructorWorkspace2.data.course.revision,
      operationId: '1b8b1741-91c9-4c2c-b5cf-ff8145f4f44f',
    });
    assert.equal(createDraftReplay2.data.assessmentId, createDraftReplay.data.assessmentId);
    const staleCreate = await api('/api/assessments', {
      method: 'POST',
      token: instructorToken2,
      body: {
        title: 'Stale draft',
        opensAt: '2026-09-07T09:00:00Z',
        dueAt: '2026-09-07T10:00:00Z',
        durationMinutes: 20,
        maxAttempts: 1,
      },
      revision: 0,
      operationId: opId(),
    });
    assert.equal(staleCreate.response.status, 409);
    assert.equal(staleCreate.data.error.code, 'stale_revision');

    const instructorAfterCreate = await api('/api/workspace', { token: instructorToken2 });
    assert.equal(instructorAfterCreate.data.assessments.length, 5);
    assert.ok(instructorAfterCreate.data.assessments.some(a => a.id === createdAssessmentId));

    const taSignIn = await api('/api/auth/sign-in', {
      method: 'POST',
      body: { email: 'luis.ortega@coursemark.example', password: 'Coursemark!2026' },
      operationId: opId(),
    });
    const taToken = taSignIn.data.token;
    const taWorkspace = await api('/api/workspace', { token: taToken });
    assert.equal(taWorkspace.response.status, 200);
    const gradeAttempt = await api('/api/attempts/AT-101/grades', {
      method: 'POST',
      token: taToken,
      body: {
        rows: [
          { criterionId: 'RC-3', selected: true, score: 1, feedback: 'Adequate limitation.' },
          { criterionId: 'RC-4', selected: true, score: 2, feedback: 'Clear consequence.' },
        ],
      },
      revision: taWorkspace.data.course.revision,
      operationId: opId(),
    });
    assert.equal(gradeAttempt.response.status, 200);
    assert.equal(gradeAttempt.data.graded, true);

    const preview = await api('/api/release-previews', {
      method: 'POST',
      token: instructorToken2,
      body: { attemptIds: ['AT-101'] },
      revision: gradeAttempt.data.revision,
      operationId: opId(),
    });
    assert.equal(preview.response.status, 201);
    assert.equal(preview.data.preview.attempts.length, 1);
    const commit = await api(`/api/release-previews/${preview.data.preview.previewId}/commit`, {
      method: 'POST',
      token: instructorToken2,
      body: {},
      revision: preview.data.revision,
      operationId: opId(),
    });
    assert.equal(commit.response.status, 200);
    assert.deepEqual(commit.data.released, ['AT-101']);

    const benSignIn = await api('/api/auth/sign-in', {
      method: 'POST',
      body: { email: 'ben.okafor@coursemark.example', password: 'Coursemark!2026' },
      operationId: opId(),
    });
    const benWorkspace = await api('/api/workspace', { token: benSignIn.data.token });
    const benAT101 = benWorkspace.data.attempts.find(a => a.id === 'AT-101');
    assert.equal(benAT101.feedbackStatus, 'released');
    assert.equal(benAT101.rubricGrades.length, 2);
    assert.equal(benAT101.totalScore, 3);

    const noraWorkspaceAfterSubmit = await api('/api/workspace', { token: studentToken });
    const noraA04 = noraWorkspaceAfterSubmit.data.attempts.find(a => a.id === attemptId);
    assert.equal(noraA04.status, 'graded');
    assert.equal(noraA04.objectiveScore, null);
    assert.equal(noraA04.totalScore, null);
  } finally {
    await stopServer();
  }
});
