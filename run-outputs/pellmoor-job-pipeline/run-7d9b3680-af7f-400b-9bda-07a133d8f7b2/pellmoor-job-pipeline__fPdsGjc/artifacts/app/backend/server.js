const express = require('express');
const path = require('path');
const { createStore } = require('./store');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const store = createStore(process.env.DB_PATH);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '128kb' }));
app.use(express.static(PUBLIC_DIR, { fallthrough: true }));

app.post('/api/login', (req, res) => {
  const body = req.body || {};
  if (!isPlainObject(body)) return res.status(400).json({ error: 'Invalid request body' });
  if (!onlyKeys(body, ['email', 'password'])) return res.status(400).json({ error: 'Unexpected login fields' });
  const { email, password } = body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = store.getUserByEmail(email.trim().toLowerCase());
  if (!user || password !== 'password123') {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = store.createSession(user.email);
  res.cookie('pellmoor_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ user });
});

app.post('/api/logout', requireAuth, (req, res) => {
  store.revokeSession(req.sessionToken);
  res.clearCookie('pellmoor_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/bootstrap', requireAuth, (req, res) => {
  res.json(store.getBootstrap(req.user.email));
});

app.get('/api/vacancies', requireAuth, (req, res) => {
  res.json({ vacancies: store.listVacancies(), user: req.user });
});

app.get('/api/vacancies/:code', requireAuth, (req, res) => {
  const vacancy = store.getVacancyView(req.params.code);
  if (!vacancy) return res.status(404).json({ error: 'Vacancy not found' });
  res.json(vacancy);
});

app.get('/api/candidates/:id', requireAuth, (req, res) => {
  const candidate = store.getCandidateView(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json(candidate);
});

app.post('/api/vacancies/:code/batch-preview', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!isPlainObject(body)) return res.status(400).json({ error: 'Invalid request body' });
  if (!onlyKeys(body, ['candidateIds'])) return res.status(400).json({ error: 'Unexpected batch preview fields' });
  const candidateIds = body.candidateIds;
  if (!Array.isArray(candidateIds)) return res.status(400).json({ error: 'candidateIds must be an array' });
  const response = store.previewBatch(req.user, req.params.code, candidateIds);
  res.status(response.statusCode).json(response.body);
});

app.post('/api/vacancies/:code/candidates', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!isPlainObject(body)) return res.status(400).json({ error: 'Invalid request body' });
  if (!onlyKeys(body, ['name', 'noteText', 'expectedRevision', 'operationId'])) {
    return res.status(400).json({ error: 'Unexpected candidate creation fields' });
  }
  const expectedRevision = readExpectedRevision(req, body);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return res.status(400).json({ error: 'Expected revision must be a nonnegative integer' });
  const operationId = readOperationId(req, body);
  const response = store.createCandidate(req.user, req.params.code, body.name, body.noteText, expectedRevision, operationId);
  res.status(response.statusCode).json(response.body);
});

app.post('/api/candidates/:id/stage', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!isPlainObject(body)) return res.status(400).json({ error: 'Invalid request body' });
  if (!onlyKeys(body, ['nextStage', 'expectedRevision', 'operationId'])) {
    return res.status(400).json({ error: 'Unexpected stage change fields' });
  }
  const expectedRevision = readExpectedRevision(req, body);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return res.status(400).json({ error: 'Expected revision must be a nonnegative integer' });
  const operationId = readOperationId(req, body);
  const response = store.changeStage(req.user, req.params.id, body.nextStage, expectedRevision, operationId);
  res.status(response.statusCode).json(response.body);
});

app.post('/api/candidates/:id/panel', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!isPlainObject(body)) return res.status(400).json({ error: 'Invalid request body' });
  if (!onlyKeys(body, ['memberEmail', 'action', 'expectedRevision', 'operationId'])) {
    return res.status(400).json({ error: 'Unexpected panel change fields' });
  }
  const expectedRevision = readExpectedRevision(req, body);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return res.status(400).json({ error: 'Expected revision must be a nonnegative integer' });
  const operationId = readOperationId(req, body);
  const response = store.changePanel(req.user, req.params.id, body.memberEmail, body.action, expectedRevision, operationId);
  res.status(response.statusCode).json(response.body);
});

app.post('/api/candidates/:id/scores', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!isPlainObject(body)) return res.status(400).json({ error: 'Invalid request body' });
  if (!onlyKeys(body, ['score', 'expectedRevision', 'operationId'])) {
    return res.status(400).json({ error: 'Unexpected score fields' });
  }
  const expectedRevision = readExpectedRevision(req, body);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return res.status(400).json({ error: 'Expected revision must be a nonnegative integer' });
  const operationId = readOperationId(req, body);
  const response = store.recordScore(req.user, req.params.id, body.score, expectedRevision, operationId);
  res.status(response.statusCode).json(response.body);
});

app.post('/api/candidates/:id/notes', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!isPlainObject(body)) return res.status(400).json({ error: 'Invalid request body' });
  if (!onlyKeys(body, ['text', 'expectedRevision', 'operationId'])) {
    return res.status(400).json({ error: 'Unexpected note fields' });
  }
  const expectedRevision = readExpectedRevision(req, body);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return res.status(400).json({ error: 'Expected revision must be a nonnegative integer' });
  const operationId = readOperationId(req, body);
  const response = store.addNote(req.user, req.params.id, body.text, expectedRevision, operationId);
  res.status(response.statusCode).json(response.body);
});

app.post('/api/vacancies/:code/batch-offers', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!isPlainObject(body)) return res.status(400).json({ error: 'Invalid request body' });
  if (!onlyKeys(body, ['candidateIds', 'expectedRevision', 'operationId'])) {
    return res.status(400).json({ error: 'Unexpected batch offer fields' });
  }
  const expectedRevision = readExpectedRevision(req, body);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return res.status(400).json({ error: 'Expected revision must be a nonnegative integer' });
  const operationId = readOperationId(req, body);
  const response = store.confirmBatch(req.user, req.params.code, body.candidateIds, expectedRevision, operationId);
  res.status(response.statusCode).json(response.body);
});

app.get('/', (req, res) => {
  res.sendFile(INDEX_HTML);
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(404).sendFile(INDEX_HTML);
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Pellmoor server listening on http://${HOST}:${PORT}`);
});

function requireAuth(req, res, next) {
  const token = readSessionToken(req);
  const session = store.getSession(token);
  if (!session || session.revoked_at) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }
  req.user = { email: session.email, name: session.name, role: session.role };
  req.sessionToken = token;
  next();
}

function readSessionToken(req) {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookie = req.headers.cookie;
  if (!cookie) return '';
  const found = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('pellmoor_session='));
  return found ? decodeURIComponent(found.slice('pellmoor_session='.length)) : '';
}

function readOperationId(req, body) {
  const header = req.get('x-operation-id');
  if (header && header.trim()) return header.trim();
  if (typeof body.operationId === 'string' && body.operationId.trim()) return body.operationId.trim();
  return '';
}

function readExpectedRevision(req, body) {
  const header = req.get('x-expected-revision');
  if (header !== undefined && header !== null && header !== '') {
    if (!/^\d+$/.test(String(header).trim())) return NaN;
    return Number(String(header).trim());
  }
  if (Object.prototype.hasOwnProperty.call(body, 'expectedRevision')) {
    return Number.isInteger(body.expectedRevision) ? body.expectedRevision : NaN;
  }
  return NaN;
}

function onlyKeys(obj, allowed) {
  const keys = Object.keys(obj);
  return keys.every((key) => allowed.includes(key));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
