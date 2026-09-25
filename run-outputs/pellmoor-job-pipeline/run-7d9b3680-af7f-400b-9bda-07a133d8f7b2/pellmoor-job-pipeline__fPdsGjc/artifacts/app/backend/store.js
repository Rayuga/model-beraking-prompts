const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const SEED_PATH = '/recruitment/records/pellmoor_seed_data.json';
const PIPELINE_STAGES = ['applied', 'screening', 'interview', 'offer', 'hired'];
const TERMINAL_STAGES = ['rejected', 'withdrawn'];
const ELIGIBLE_PANEL_MEMBERS = new Set([
  'hiring@pellmoor.test',
  'panel1@pellmoor.test',
  'panel2@pellmoor.test',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function payloadHash(payload) {
  return sha256(JSON.stringify(canonicalize(payload)));
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNote(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isIntegerLike(value) {
  return Number.isInteger(value) && value >= 0;
}

function labelUser(store, email) {
  const user = store.getUserByEmail(email);
  return user ? `${user.name} (${email})` : email;
}

function timeOffset(baseIso, days, minutes) {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() - Number(days || 0));
  d.setUTCMinutes(d.getUTCMinutes() + Number(minutes || 0));
  return d.toISOString();
}

function createStore(dbPath) {
  const resolvedDbPath = dbPath || process.env.DB_PATH || path.join(ROOT, 'pellmoor.db');
  fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });
  const db = new Database(resolvedDbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  initSchema(db);
  seedDatabase(db);

  function getUserByEmail(email) {
    return db.prepare('SELECT email, name, role FROM users WHERE email = ?').get(email);
  }

  function getSession(token) {
    if (!token) return null;
    const tokenHash = sha256(token);
    return db
      .prepare(
        `SELECT s.token_hash, s.email, s.created_at, s.revoked_at, u.name, u.role
         FROM sessions s
         JOIN users u ON u.email = s.email
         WHERE s.token_hash = ?`
      )
      .get(tokenHash);
  }

  function createSession(email) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions(token_hash, email, created_at, revoked_at) VALUES(?, ?, ?, NULL)').run(
      sha256(token),
      email,
      nowIso()
    );
    return token;
  }

  function revokeSession(token) {
    if (!token) return false;
    const result = db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').run(
      nowIso(),
      sha256(token)
    );
    return result.changes > 0;
  }

  function listVacancies() {
    const rows = db.prepare('SELECT code, title, team, openings, revision FROM vacancies ORDER BY code').all();
    return rows.map((row) => vacancyView(row.code, row, false));
  }

  function getBootstrap(email) {
    return {
      user: getUserByEmail(email),
      vacancies: listVacancies(),
      pipelineStages: PIPELINE_STAGES,
      terminalStages: TERMINAL_STAGES,
      panelMembers: ['hiring@pellmoor.test', 'panel1@pellmoor.test', 'panel2@pellmoor.test']
        .map((memberEmail) => getUserByEmail(memberEmail))
        .filter(Boolean),
    };
  }

  function getVacancyView(code) {
    const vacancy = getVacancyRow(code);
    if (!vacancy) return null;
    return vacancyView(code, vacancy, true);
  }

  function getCandidateView(candidateId) {
    const candidate = getCandidateRow(candidateId);
    if (!candidate) return null;
    return candidateDetail(candidate);
  }

  function previewBatch(actor, vacancyCode, candidateIds) {
    if (actor.role !== 'hiring manager') {
      return result(403, { error: 'Only Ruth may review batch offers' }, false);
    }
    const vacancy = getVacancyRow(vacancyCode);
    if (!vacancy) return result(404, { error: 'Vacancy not found' }, false);
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return result(400, { error: 'Select at least one candidate' }, false);
    }
    const selection = candidateIds.map((id) => getCandidateView(id));
    if (selection.some((item) => !item)) return result(404, { error: 'One or more candidates were not found' }, false);
    const currentCapacity = vacancyCapacity(vacancyCode);
    const projectedCapacity = {
      reserved: currentCapacity.reserved + candidateIds.length,
      filled: currentCapacity.filled,
      available: vacancy.openings - currentCapacity.reserved - currentCapacity.filled - candidateIds.length,
    };
    return result(
      200,
      {
        vacancy: vacancyView(vacancyCode, vacancy, true),
        selectionCount: candidateIds.length,
        selection: selection.map((candidate) => {
          const eligibility = offerEligibility(candidate, vacancyCode, vacancy, currentCapacity);
          return {
            id: candidate.id,
            name: candidate.name,
            stage: candidate.stage,
            assessmentVersion: candidate.assessmentVersion,
            eligible: eligibility.ok,
            reasons: eligibility.reasons,
          };
        }),
        currentCapacity,
        projectedCapacity,
      },
      false
    );
  }

  function createCandidate(actor, vacancyCode, name, noteText, expectedRevision, operationId) {
    return runOperation(actor, 'POST', `/api/vacancies/${vacancyCode}/candidates`, operationId, {
      vacancyCode,
      name,
      noteText,
      expectedRevision,
    }, () => {
      const vacancy = getVacancyRow(vacancyCode);
      if (!vacancy) return result(404, { error: 'Vacancy not found' });
      if (!isIntegerLike(expectedRevision)) return result(400, { error: 'Expected revision is required' });
      if (vacancy.revision !== expectedRevision) return staleResult(vacancyCode, 'Stale revision for candidate creation');
      const cleanName = normalizeText(name);
      if (!cleanName) return result(400, { error: 'Candidate name is required' });
      const duplicate = db.prepare('SELECT id FROM candidates WHERE vacancy_code = ? AND lower(name) = lower(?)').get(vacancyCode, cleanName);
      if (duplicate) return result(409, { error: 'That person already exists on this vacancy' });
      const candidateId = nextCandidateId();
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO candidates(id, vacancy_code, name, stage, assessment_version, applied_at, created_at, updated_at, created_by)
         VALUES(?, ?, ?, 'applied', 1, ?, ?, ?, ?)`
      ).run(candidateId, vacancyCode, cleanName, createdAt, createdAt, createdAt, actor.email);
      insertStageHistory(candidateId, vacancyCode, 'applied', actor.email, 'candidate created', 1, null, null, null, createdAt);
      insertActivity(vacancyCode, candidateId, actor.email, 'candidate-created', `Added ${cleanName}`, 'Created at applied stage', vacancy.revision + 1, null, null, null, createdAt, {
        candidateId,
        stage: 'applied',
        assessmentVersion: 1,
      });
      if (normalizeNote(noteText)) {
        const text = normalizeNote(noteText);
        const noteId = insertNote(vacancyCode, candidateId, actor.email, text);
        insertActivity(vacancyCode, candidateId, actor.email, 'note', 'Initial note added', text, vacancy.revision + 1, null, null, null, createdAt, {
          noteId,
        });
      }
      bumpRevision(vacancyCode);
      return result(201, { vacancy: getVacancyView(vacancyCode), candidate: getCandidateView(candidateId) });
    });
  }

  function changeStage(actor, candidateId, nextStage, expectedRevision, operationId) {
    return runOperation(actor, 'POST', `/api/candidates/${candidateId}/stage`, operationId, {
      candidateId,
      nextStage,
      expectedRevision,
    }, () => {
      const candidate = getCandidateRow(candidateId);
      if (!candidate) return result(404, { error: 'Candidate not found' });
      const vacancy = getVacancyRow(candidate.vacancy_code);
      if (!vacancy) return result(404, { error: 'Vacancy not found' });
      if (!isIntegerLike(expectedRevision)) return result(400, { error: 'Expected revision is required' });
      if (vacancy.revision !== expectedRevision) return staleResult(vacancy.code, 'Stale revision for stage change');
      if (actor.role !== 'hiring manager') return result(403, { error: 'Only Ruth may move candidates' });
      if (![...PIPELINE_STAGES, ...TERMINAL_STAGES].includes(nextStage)) return result(400, { error: 'Unknown stage' });
      if (candidate.stage === nextStage) return result(409, { error: 'Candidate is already at that stage' });
      if (TERMINAL_STAGES.includes(candidate.stage)) return result(409, { error: 'Terminal applications cannot be moved' });

      const currentIndex = PIPELINE_STAGES.indexOf(candidate.stage);
      const nextIndex = PIPELINE_STAGES.indexOf(nextStage);
      const terminalMove = TERMINAL_STAGES.includes(nextStage);
      const legalStep = terminalMove || nextIndex === currentIndex + 1 || nextIndex === currentIndex - 1;
      if (!legalStep) return result(409, { error: 'Stage jumps are not allowed' });

      const capacity = vacancyCapacity(vacancy.code);
      if (nextStage === 'offer' && candidate.stage !== 'hired' && capacity.available <= 0) {
        return result(409, { error: 'Vacancy is full' });
      }

      const beforeVersion = candidate.assessment_version;
      const afterVersion = nextStage === 'interview' && candidate.stage !== 'interview' ? beforeVersion + 1 : beforeVersion;
      const now = nowIso();
      db.prepare('UPDATE candidates SET stage = ?, assessment_version = ?, updated_at = ? WHERE id = ?').run(nextStage, afterVersion, now, candidateId);
      insertStageHistory(candidateId, vacancy.code, nextStage, actor.email, stageReason(candidate.stage, nextStage), afterVersion, null, null, null, now);
      insertActivity(vacancy.code, candidateId, actor.email, 'stage-change', `${candidate.name}: ${candidate.stage} → ${nextStage}`, afterVersion !== beforeVersion ? `Assessment version advanced to ${afterVersion}` : 'Stage updated without changing assessment version', vacancy.revision + 1, null, null, null, now, {
        fromStage: candidate.stage,
        toStage: nextStage,
        assessmentVersionBefore: beforeVersion,
        assessmentVersionAfter: afterVersion,
        assessmentVersionChanged: afterVersion !== beforeVersion,
      });
      bumpRevision(vacancy.code);
      return result(200, { vacancy: getVacancyView(vacancy.code), candidate: getCandidateView(candidateId) });
    });
  }

  function changePanel(actor, candidateId, memberEmail, action, expectedRevision, operationId) {
    return runOperation(actor, 'POST', `/api/candidates/${candidateId}/panel`, operationId, {
      candidateId,
      memberEmail,
      action,
      expectedRevision,
    }, () => {
      const candidate = getCandidateRow(candidateId);
      if (!candidate) return result(404, { error: 'Candidate not found' });
      const vacancy = getVacancyRow(candidate.vacancy_code);
      if (!vacancy) return result(404, { error: 'Vacancy not found' });
      if (!isIntegerLike(expectedRevision)) return result(400, { error: 'Expected revision is required' });
      if (vacancy.revision !== expectedRevision) return staleResult(vacancy.code, 'Stale revision for panel change');
      if (actor.role !== 'coordinator') return result(403, { error: 'Only Cal may change panels' });
      if (!['applied', 'screening', 'interview'].includes(candidate.stage)) {
        return result(409, { error: 'Panels are frozen at offer, hired, rejected and withdrawn' });
      }
      if (!ELIGIBLE_PANEL_MEMBERS.has(memberEmail)) return result(409, { error: 'That person cannot be assigned to a panel' });
      if (memberEmail === 'coord@pellmoor.test') return result(409, { error: 'Cal cannot be assigned to a panel' });
      const activeMembers = panelMembers(candidateId, true);
      const assigned = activeMembers.includes(memberEmail);
      if (action === 'add' && assigned) return result(409, { error: 'That panel member is already assigned' });
      if (action === 'remove' && !assigned) return result(409, { error: 'That panel member is not assigned' });

      const beforeVersion = candidate.assessment_version;
      const afterVersion = beforeVersion + 1;
      const now = nowIso();
      if (action === 'add') {
        db.prepare(
          `INSERT INTO candidate_panels(candidate_id, vacancy_code, member_email, active, added_by, added_at, removed_by, removed_at)
           VALUES(?, ?, ?, 1, ?, ?, NULL, NULL)
           ON CONFLICT(candidate_id, member_email) DO UPDATE SET active = 1, added_by = excluded.added_by, added_at = excluded.added_at, removed_by = NULL, removed_at = NULL`
        ).run(candidateId, candidate.vacancy_code, memberEmail, actor.email, now);
      } else {
        db.prepare('UPDATE candidate_panels SET active = 0, removed_by = ?, removed_at = ? WHERE candidate_id = ? AND member_email = ?').run(actor.email, now, candidateId, memberEmail);
      }
      db.prepare('UPDATE candidates SET assessment_version = ?, updated_at = ? WHERE id = ?').run(afterVersion, now, candidateId);
      insertStageHistory(candidateId, candidate.vacancy_code, candidate.stage, actor.email, action === 'add' ? `panel member ${memberEmail} added` : `panel member ${memberEmail} removed`, afterVersion, null, null, null, now);
      insertActivity(vacancy.code, candidateId, actor.email, action === 'add' ? 'panel-add' : 'panel-remove', action === 'add' ? 'Added panel member' : 'Removed panel member', `${memberLabel(memberEmail)} ${action === 'add' ? 'assigned to' : 'removed from'} the panel`, vacancy.revision + 1, null, null, null, now, {
        memberEmail,
        action,
        assessmentVersionBefore: beforeVersion,
        assessmentVersionAfter: afterVersion,
      });
      bumpRevision(vacancy.code);
      return result(200, { vacancy: getVacancyView(vacancy.code), candidate: getCandidateView(candidateId) });
    });
  }

  function recordScore(actor, candidateId, score, expectedRevision, operationId) {
    return runOperation(actor, 'POST', `/api/candidates/${candidateId}/scores`, operationId, {
      candidateId,
      score,
      expectedRevision,
    }, () => {
      const candidate = getCandidateRow(candidateId);
      if (!candidate) return result(404, { error: 'Candidate not found' });
      const vacancy = getVacancyRow(candidate.vacancy_code);
      if (!vacancy) return result(404, { error: 'Vacancy not found' });
      if (!isIntegerLike(expectedRevision)) return result(400, { error: 'Expected revision is required' });
      if (vacancy.revision !== expectedRevision) return staleResult(vacancy.code, 'Stale revision for scoring');
      if (candidate.stage !== 'interview') return result(409, { error: 'Scores can only be recorded at interview' });
      if (!ELIGIBLE_PANEL_MEMBERS.has(actor.email)) return result(403, { error: 'Only panel members may score' });
      const activeMembers = panelMembers(candidateId, true);
      if (!activeMembers.includes(actor.email)) return result(403, { error: 'Only assigned panel members may score' });
      if (!Number.isInteger(score) || score < 1 || score > 5) return result(400, { error: 'Scores must be whole numbers from 1 to 5' });
      const version = candidate.assessment_version;
      const existed = db.prepare('SELECT score FROM candidate_scores WHERE candidate_id = ? AND assessment_version = ? AND member_email = ?').get(candidateId, version, actor.email);
      const actorLabel = labelUser({ getUserByEmail }, actor.email);
      const now = nowIso();
      db.prepare(
        `INSERT INTO candidate_scores(candidate_id, vacancy_code, assessment_version, member_email, score, recorded_by, recorded_at)
         VALUES(?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(candidate_id, assessment_version, member_email) DO UPDATE SET score = excluded.score, recorded_by = excluded.recorded_by, recorded_at = excluded.recorded_at`
      ).run(candidateId, candidate.vacancy_code, version, actor.email, score, actor.email, now);
      insertActivity(vacancy.code, candidateId, actor.email, existed ? 'score-updated' : 'score-recorded', `${actorLabel} scored ${score}`, `Assessment version ${version} now records a ${score} from ${actorLabel}`, vacancy.revision + 1, null, null, null, now, {
        memberEmail: actor.email,
        score,
        assessmentVersion: version,
        updated: Boolean(existed),
      });
      bumpRevision(vacancy.code);
      return result(200, { vacancy: getVacancyView(vacancy.code), candidate: getCandidateView(candidateId) });
    });
  }

  function addNote(actor, candidateId, text, expectedRevision, operationId) {
    return runOperation(actor, 'POST', `/api/candidates/${candidateId}/notes`, operationId, {
      candidateId,
      text,
      expectedRevision,
    }, () => {
      const candidate = getCandidateRow(candidateId);
      if (!candidate) return result(404, { error: 'Candidate not found' });
      const vacancy = getVacancyRow(candidate.vacancy_code);
      if (!vacancy) return result(404, { error: 'Vacancy not found' });
      if (!isIntegerLike(expectedRevision)) return result(400, { error: 'Expected revision is required' });
      if (vacancy.revision !== expectedRevision) return staleResult(vacancy.code, 'Stale revision for note addition');
      const cleanText = normalizeNote(text);
      if (!cleanText) return result(400, { error: 'Note text is required' });
      const now = nowIso();
      const noteId = insertNote(vacancy.code, candidateId, actor.email, cleanText, now);
      insertActivity(vacancy.code, candidateId, actor.email, 'note', 'Note added', cleanText, vacancy.revision + 1, null, null, null, now, { noteId });
      bumpRevision(vacancy.code);
      return result(201, { vacancy: getVacancyView(vacancy.code), candidate: getCandidateView(candidateId) });
    });
  }

  function confirmBatch(actor, vacancyCode, candidateIds, expectedRevision, operationId) {
    return runOperation(actor, 'POST', `/api/vacancies/${vacancyCode}/batch-offers`, operationId, {
      vacancyCode,
      candidateIds,
      expectedRevision,
    }, () => {
      if (actor.role !== 'hiring manager') return result(403, { error: 'Only Ruth may confirm batch offers' });
      const vacancy = getVacancyRow(vacancyCode);
      if (!vacancy) return result(404, { error: 'Vacancy not found' });
      if (!isIntegerLike(expectedRevision)) return result(400, { error: 'Expected revision is required' });
      if (vacancy.revision !== expectedRevision) return staleResult(vacancy.code, 'Stale revision for batch confirmation');
      if (!Array.isArray(candidateIds) || candidateIds.length === 0) return result(400, { error: 'Select at least one candidate' });
      if (candidateIds.some((id) => typeof id !== 'string' || !id.trim())) return result(400, { error: 'Candidate identifiers must be non-empty strings' });
      if (new Set(candidateIds).size !== candidateIds.length) return result(409, { error: 'Duplicate candidate identifiers are not allowed' });
      const selected = candidateIds.map((id) => getCandidateRow(id));
      if (selected.some((candidate) => !candidate)) return result(404, { error: 'One or more candidates were not found' });
      if (selected.some((candidate) => candidate.vacancy_code !== vacancyCode)) return result(409, { error: 'All candidates must belong to the selected vacancy' });
      if (selected.some((candidate) => candidate.stage !== 'interview')) return result(409, { error: 'All selected candidates must be at interview' });
      const currentCapacity = vacancyCapacity(vacancyCode);
      if (candidateIds.length > currentCapacity.available) return result(409, { error: 'Vacancy does not have enough available openings' });
      for (const candidate of selected) {
        const eligibility = offerEligibility(candidate, vacancyCode, vacancy, currentCapacity);
        if (!eligibility.ok) {
          return result(409, { error: `${candidate.name} is not eligible for offer: ${eligibility.reasons.join('; ')}` });
        }
      }
      const batchId = crypto.randomUUID();
      const now = nowIso();
      selected.forEach((candidate, index) => {
        db.prepare('UPDATE candidates SET stage = ?, updated_at = ? WHERE id = ?').run('offer', now, candidate.id);
        insertStageHistory(candidate.id, vacancyCode, 'offer', actor.email, 'batch offer confirmed', candidate.assessment_version, batchId, index + 1, selected.length, now);
        insertActivity(vacancyCode, candidate.id, actor.email, 'batch-offer', `${candidate.name} offered in batch ${batchId}`, `Batch offer ${index + 1} of ${selected.length}`, vacancy.revision + 1, batchId, index + 1, selected.length, now, {
          candidateId: candidate.id,
          assessmentVersion: candidate.assessment_version,
          batchId,
          batchPosition: index + 1,
          batchSize: selected.length,
          toStage: 'offer',
        });
      });
      bumpRevision(vacancyCode);
      return result(200, {
        vacancy: getVacancyView(vacancyCode),
        batchId,
        selection: selected.map((candidate, index) => ({
          id: candidate.id,
          name: candidate.name,
          position: index + 1,
          total: selected.length,
        })),
      });
    });
  }

  function runOperation(actor, method, route, operationId, payload, handler) {
    const opId = normalizeText(operationId);
    if (!opId) return result(400, { error: 'Operation id is required' }, false);
    const hash = payloadHash({ method, route, payload });
    const existing = db
      .prepare(
        `SELECT status_code, response_json, payload_hash
         FROM operations
         WHERE actor_email = ? AND operation_id = ? AND method = ? AND route = ?`
      )
      .get(actor.email, opId, method, route);
    if (existing) {
      if (existing.payload_hash !== hash) return result(409, { error: 'That retry identity was already used for different input' }, false);
      return stored(existing.status_code, existing.response_json);
    }
    const tx = db.transaction(() => {
      const repeat = db
        .prepare(
          `SELECT status_code, response_json, payload_hash
           FROM operations
           WHERE actor_email = ? AND operation_id = ? AND method = ? AND route = ?`
        )
        .get(actor.email, opId, method, route);
      if (repeat) {
        if (repeat.payload_hash !== hash) return stored(409, JSON.stringify({ error: 'That retry identity was already used for different input' }));
        return stored(repeat.status_code, repeat.response_json);
      }
      const outcome = handler();
      if (outcome.storeReceipt !== false) {
        db.prepare(
          `INSERT INTO operations(actor_email, operation_id, method, route, payload_hash, status_code, response_json, created_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(actor.email, opId, method, route, hash, outcome.statusCode, JSON.stringify(outcome.body), nowIso());
      }
      return outcome;
    });
    return tx();
  }

  function stored(statusCode, responseJson) {
    return { statusCode: Number(statusCode), body: JSON.parse(responseJson), storeReceipt: false, replay: true };
  }

  function result(statusCode, body, storeReceipt = true) {
    return { statusCode, body, storeReceipt };
  }

  function staleResult(vacancyCode, message) {
    return result(409, { error: message, currentVacancy: getVacancyView(vacancyCode) });
  }

  function insertStageHistory(candidateId, vacancyCode, stage, actorEmail, reason, assessmentVersion, batchId, batchPosition, batchSize, createdAt) {
    db.prepare(
      `INSERT INTO candidate_stage_history(candidate_id, vacancy_code, stage, actor_email, reason, assessment_version, batch_id, batch_position, batch_size, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(candidateId, vacancyCode, stage, actorEmail, reason, assessmentVersion, batchId, batchPosition, batchSize, createdAt || nowIso());
  }

  function insertNote(vacancyCode, candidateId, actorEmail, text, createdAt) {
    const info = db.prepare('INSERT INTO candidate_notes(candidate_id, vacancy_code, actor_email, text, created_at) VALUES(?, ?, ?, ?, ?)').run(
      candidateId,
      vacancyCode,
      actorEmail,
      text,
      createdAt || nowIso()
    );
    return info.lastInsertRowid;
  }

  function insertActivity(vacancyCode, candidateId, actorEmail, type, title, body, revision, batchId, batchPosition, batchSize, createdAt, details) {
    db.prepare(
      `INSERT INTO activity_events(vacancy_code, candidate_id, actor_email, type, title, body, revision, batch_id, batch_position, batch_size, created_at, details_json)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(vacancyCode, candidateId, actorEmail, type, title, body, revision, batchId, batchPosition, batchSize, createdAt || nowIso(), JSON.stringify(details || {}));
  }

  function bumpRevision(vacancyCode) {
    db.prepare('UPDATE vacancies SET revision = revision + 1 WHERE code = ?').run(vacancyCode);
  }

  function nextCandidateId() {
    const current = db.prepare('SELECT value FROM counters WHERE name = ?').get('candidate_seq');
    const next = current ? Number(current.value) + 1 : 110;
    db.prepare('INSERT INTO counters(name, value) VALUES(?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value').run('candidate_seq', next);
    return `CAND-${next}`;
  }

  function getVacancyRow(code) {
    return db.prepare('SELECT code, title, team, openings, revision FROM vacancies WHERE code = ?').get(code);
  }

  function getCandidateRow(candidateId) {
    return db
      .prepare(
        `SELECT c.id, c.vacancy_code, c.name, c.stage, c.assessment_version, c.applied_at, c.created_at, c.updated_at,
                v.title AS vacancy_title, v.team AS vacancy_team, v.openings, v.revision
         FROM candidates c
         JOIN vacancies v ON v.code = c.vacancy_code
         WHERE c.id = ?`
      )
      .get(candidateId);
  }

  function vacancyCapacity(vacancyCode, candidateRows = null) {
    const rows = candidateRows || db.prepare('SELECT stage FROM candidates WHERE vacancy_code = ?').all(vacancyCode);
    const reserved = rows.filter((row) => row.stage === 'offer').length;
    const filled = rows.filter((row) => row.stage === 'hired').length;
    const vacancy = getVacancyRow(vacancyCode);
    const available = vacancy ? vacancy.openings - reserved - filled : 0;
    return { reserved, filled, available: available < 0 ? 0 : available };
  }

  function panelMembers(candidateId, activeOnly) {
    const rows = db
      .prepare(
        `SELECT member_email, active, added_by, added_at, removed_by, removed_at
         FROM candidate_panels
         WHERE candidate_id = ?
         ORDER BY member_email`
      )
      .all(candidateId);
    return activeOnly ? rows.filter((row) => row.active === 1).map((row) => row.member_email) : rows;
  }

  function currentScores(candidateId, version) {
    return db
      .prepare(
        `SELECT member_email, score, recorded_by, recorded_at
         FROM candidate_scores
         WHERE candidate_id = ? AND assessment_version = ?
         ORDER BY member_email`
      )
      .all(candidateId, version);
  }

  function historicalScores(candidateId, version) {
    return db
      .prepare(
        `SELECT assessment_version, member_email, score, recorded_by, recorded_at
         FROM candidate_scores
         WHERE candidate_id = ? AND assessment_version < ?
         ORDER BY assessment_version DESC, member_email`
      )
      .all(candidateId, version);
  }

  function stageHistory(candidateId) {
    return db
      .prepare(
        `SELECT stage, actor_email, reason, assessment_version, batch_id, batch_position, batch_size, created_at
         FROM candidate_stage_history
         WHERE candidate_id = ?
         ORDER BY id ASC`
      )
      .all(candidateId)
      .map((row) => ({
        stage: row.stage,
        actorEmail: row.actor_email,
        reason: row.reason,
        assessmentVersion: row.assessment_version,
        batchId: row.batch_id,
        batchPosition: row.batch_position,
        batchSize: row.batch_size,
        createdAt: row.created_at,
      }));
  }

  function notes(candidateId) {
    return db
      .prepare(
        `SELECT id, actor_email, text, created_at
         FROM candidate_notes
         WHERE candidate_id = ?
         ORDER BY id ASC`
      )
      .all(candidateId)
      .map((row) => ({
        id: row.id,
        actorEmail: row.actor_email,
        text: row.text,
        createdAt: row.created_at,
      }));
  }

  function activity(vacancyCode, candidateId = null) {
    const rows = candidateId
      ? db
          .prepare(
            `SELECT id, vacancy_code, candidate_id, actor_email, type, title, body, revision, batch_id, batch_position, batch_size, created_at, details_json
             FROM activity_events
             WHERE vacancy_code = ? AND candidate_id = ?
             ORDER BY id ASC`
          )
          .all(vacancyCode, candidateId)
      : db
          .prepare(
            `SELECT id, vacancy_code, candidate_id, actor_email, type, title, body, revision, batch_id, batch_position, batch_size, created_at, details_json
             FROM activity_events
             WHERE vacancy_code = ?
             ORDER BY id DESC
             LIMIT 60`
          )
          .all(vacancyCode)
          .reverse();
    return rows.map((row) => ({
      id: row.id,
      vacancyCode: row.vacancy_code,
      candidateId: row.candidate_id,
      actorEmail: row.actor_email,
      type: row.type,
      title: row.title,
      body: row.body,
      revision: row.revision,
      batchId: row.batch_id,
      batchPosition: row.batch_position,
      batchSize: row.batch_size,
      createdAt: row.created_at,
      details: JSON.parse(row.details_json || '{}'),
    }));
  }

  function groupHistoricalScores(rows) {
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.assessment_version)) grouped.set(row.assessment_version, []);
      grouped.get(row.assessment_version).push({
        memberEmail: row.member_email,
        score: row.score,
        recordedBy: row.recorded_by,
        recordedAt: row.recorded_at,
      });
    }
    return [...grouped.entries()].map(([assessmentVersion, scores]) => ({
      assessmentVersion,
      scores,
    }));
  }

  function panelValid(activeMembers) {
    const unique = [...new Set(activeMembers)];
    if (unique.length < 2) return false;
    return unique.some((member) => member !== 'hiring@pellmoor.test');
  }

  function offerEligibility(candidateOrId, vacancyCode, vacancyRow = null, capacityRow = null) {
    const candidate = typeof candidateOrId === 'object' ? candidateOrId : getCandidateView(candidateOrId);
    const vacancy = vacancyRow || getVacancyRow(vacancyCode);
    const reasons = [];
    if (!candidate || !vacancy) return { ok: false, reasons: ['Missing candidate or vacancy'] };
    if (candidate.stage !== 'interview') reasons.push('Candidate is not at interview');
    const activeMembers = candidate.activePanel || panelMembers(candidate.id, true);
    if (!panelValid(activeMembers)) reasons.push('Panel is not complete');
    const current = candidate.currentScores || currentScores(candidate.id, candidate.assessmentVersion);
    const missing = activeMembers.filter((memberEmail) => !current.find((row) => row.member_email === memberEmail));
    if (missing.length > 0) reasons.push('Current panel scores are incomplete');
    const capacity = capacityRow || vacancyCapacity(vacancy.code);
    if (capacity.available <= 0) reasons.push('Vacancy is full');
    return { ok: reasons.length === 0, reasons };
  }

  function candidateSummary(candidateRow) {
    const active = panelMembers(candidateRow.id, true);
    const current = currentScores(candidateRow.id, candidateRow.assessment_version);
    const historical = historicalScores(candidateRow.id, candidateRow.assessment_version);
    const eligibility = offerEligibility({
      id: candidateRow.id,
      stage: candidateRow.stage,
      assessmentVersion: candidateRow.assessment_version,
      activePanel: active,
      currentScores: current,
    }, candidateRow.vacancy_code, null, vacancyCapacity(candidateRow.vacancy_code));
    return {
      id: candidateRow.id,
      name: candidateRow.name,
      stage: candidateRow.stage,
      assessmentVersion: candidateRow.assessment_version,
      appliedAt: candidateRow.applied_at,
      updatedAt: candidateRow.updated_at,
      activePanel: active,
      currentScores: current,
      historicalScoreVersions: groupHistoricalScores(historical),
      noteCount: notes(candidateRow.id).length,
      offerReady: eligibility.ok,
      blockedReasons: eligibility.reasons,
    };
  }

  function candidateDetail(candidateRow) {
    const active = panelMembers(candidateRow.id, true);
    const current = currentScores(candidateRow.id, candidateRow.assessment_version);
    const historical = historicalScores(candidateRow.id, candidateRow.assessment_version);
    const vacancy = getVacancyRow(candidateRow.vacancy_code);
    const eligibility = offerEligibility({
      id: candidateRow.id,
      stage: candidateRow.stage,
      assessmentVersion: candidateRow.assessment_version,
      activePanel: active,
      currentScores: current,
    }, candidateRow.vacancy_code, vacancy, vacancyCapacity(candidateRow.vacancy_code));
    return {
      id: candidateRow.id,
      name: candidateRow.name,
      stage: candidateRow.stage,
      assessmentVersion: candidateRow.assessment_version,
      vacancy: {
        code: candidateRow.vacancy_code,
        title: candidateRow.vacancy_title,
        team: candidateRow.vacancy_team,
        openings: candidateRow.openings,
        revision: candidateRow.revision,
      },
      appliedAt: candidateRow.applied_at,
      createdAt: candidateRow.created_at,
      updatedAt: candidateRow.updated_at,
      stageHistory: stageHistory(candidateRow.id),
      panelAssignments: panelMembers(candidateRow.id, false).map((row) => ({
        memberEmail: row.member_email,
        active: Boolean(row.active),
        addedBy: row.added_by,
        addedAt: row.added_at,
        removedBy: row.removed_by,
        removedAt: row.removed_at,
      })),
      activePanel: active,
      currentScores: current,
      historicalScores: groupHistoricalScores(historical),
      notes: notes(candidateRow.id),
      activity: activity(candidateRow.vacancy_code, candidateRow.id),
      offer: {
        ready: eligibility.ok,
        blockedReasons: eligibility.reasons,
      },
      capacity: vacancyCapacity(candidateRow.vacancy_code),
      frozen: TERMINAL_STAGES.includes(candidateRow.stage) || candidateRow.stage === 'offer' || candidateRow.stage === 'hired',
    };
  }

  function vacancyHistory(candidateRows) {
    const map = new Map();
    for (const candidate of candidateRows) {
      const history = stageHistory(candidate.id).map((entry) => entry.stage);
      map.set(candidate.id, history);
    }
    return map;
  }

  function funnel(code, candidateRows) {
    const histories = vacancyHistory(candidateRows);
    const reached = new Map(PIPELINE_STAGES.map((stage) => [stage, new Set()]));
    const remain = new Map(PIPELINE_STAGES.map((stage) => [stage, 0]));
    const lost = new Map(PIPELINE_STAGES.map((stage) => [stage, 0]));
    for (const candidate of candidateRows) {
      const history = histories.get(candidate.id) || [];
      for (const stage of new Set(history.filter((item) => PIPELINE_STAGES.includes(item)))) {
        reached.get(stage).add(candidate.id);
      }
      if (PIPELINE_STAGES.includes(candidate.stage)) remain.set(candidate.stage, remain.get(candidate.stage) + 1);
      if (TERMINAL_STAGES.includes(candidate.stage)) {
        const lastPipeline = [...history].reverse().find((stage) => PIPELINE_STAGES.includes(stage));
        if (lastPipeline) lost.set(lastPipeline, lost.get(lastPipeline) + 1);
      }
    }
    return PIPELINE_STAGES.map((stage) => ({
      stage,
      reached: reached.get(stage).size,
      remain: remain.get(stage),
      lost: lost.get(stage),
    }));
  }

  function vacancyView(code, vacancyRow, includeCandidates) {
    const rows = db
      .prepare(
        `SELECT id, vacancy_code, name, stage, assessment_version, applied_at, created_at, updated_at
         FROM candidates
         WHERE vacancy_code = ?
         ORDER BY CASE stage
           WHEN 'applied' THEN 1
           WHEN 'screening' THEN 2
           WHEN 'interview' THEN 3
           WHEN 'offer' THEN 4
           WHEN 'hired' THEN 5
           WHEN 'rejected' THEN 6
           WHEN 'withdrawn' THEN 7
           ELSE 99 END,
           id`
      )
      .all(code);
    const capacity = vacancyCapacity(code, rows);
    const candidateSummaries = rows.map(candidateSummary);
    const summary = {
      pipelineCount: rows.filter((candidate) => PIPELINE_STAGES.includes(candidate.stage)).length,
      terminalCount: rows.filter((candidate) => TERMINAL_STAGES.includes(candidate.stage)).length,
    };
    const view = {
      code: vacancyRow.code,
      title: vacancyRow.title,
      team: vacancyRow.team,
      openings: vacancyRow.openings,
      revision: vacancyRow.revision,
      capacity,
      funnel: funnel(code, rows),
      candidateCount: rows.length,
      summary,
      activity: activity(code),
    };
    if (includeCandidates) view.candidates = candidateSummaries;
    return view;
  }

  function readActivityRows(vacancyCode, candidateId = null) {
    const query = candidateId
      ? `SELECT id, vacancy_code, candidate_id, actor_email, type, title, body, revision, batch_id, batch_position, batch_size, created_at, details_json
         FROM activity_events
         WHERE vacancy_code = ? AND candidate_id = ?
         ORDER BY id ASC`
      : `SELECT id, vacancy_code, candidate_id, actor_email, type, title, body, revision, batch_id, batch_position, batch_size, created_at, details_json
         FROM activity_events
         WHERE vacancy_code = ?
         ORDER BY id DESC
         LIMIT 60`;
    const rows = candidateId ? db.prepare(query).all(vacancyCode, candidateId) : db.prepare(query).all(vacancyCode).reverse();
    return rows.map((row) => ({
      id: row.id,
      vacancyCode: row.vacancy_code,
      candidateId: row.candidate_id,
      actorEmail: row.actor_email,
      type: row.type,
      title: row.title,
      body: row.body,
      revision: row.revision,
      batchId: row.batch_id,
      batchPosition: row.batch_position,
      batchSize: row.batch_size,
      createdAt: row.created_at,
      details: JSON.parse(row.details_json || '{}'),
    }));
  }

  function runOperation(actor, method, route, operationId, payload, work) {
    const cleanOpId = normalizeText(operationId);
    if (!cleanOpId) return result(400, { error: 'Operation id is required' }, false);
    const hash = payloadHash({ method, route, payload });
    const existing = db
      .prepare(
        `SELECT status_code, response_json, payload_hash
         FROM operations
         WHERE actor_email = ? AND operation_id = ? AND method = ? AND route = ?`
      )
      .get(actor.email, cleanOpId, method, route);
    if (existing) {
      if (existing.payload_hash !== hash) return result(409, { error: 'That retry identity was already used for different input' }, false);
      return stored(existing.status_code, existing.response_json);
    }
    const tx = db.transaction(() => {
      const repeat = db
        .prepare(
          `SELECT status_code, response_json, payload_hash
           FROM operations
           WHERE actor_email = ? AND operation_id = ? AND method = ? AND route = ?`
        )
        .get(actor.email, cleanOpId, method, route);
      if (repeat) {
        if (repeat.payload_hash !== hash) return stored(409, JSON.stringify({ error: 'That retry identity was already used for different input' }));
        return stored(repeat.status_code, repeat.response_json);
      }
      const outcome = work();
      if (outcome.storeReceipt !== false) {
        db.prepare(
          `INSERT INTO operations(actor_email, operation_id, method, route, payload_hash, status_code, response_json, created_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(actor.email, cleanOpId, method, route, hash, outcome.statusCode, JSON.stringify(outcome.body), nowIso());
      }
      return outcome;
    });
    return tx();
  }

  function result(statusCode, body, storeReceipt = true) {
    return { statusCode, body, storeReceipt };
  }

  function stored(statusCode, responseJson) {
    return { statusCode: Number(statusCode), body: JSON.parse(responseJson), storeReceipt: false, replay: true };
  }

  function staleResult(vacancyCode, message) {
    return result(409, { error: message, currentVacancy: getVacancyView(vacancyCode) });
  }

  function insertStageHistory(candidateId, vacancyCode, stage, actorEmail, reason, assessmentVersion, batchId, batchPosition, batchSize, createdAt) {
    db.prepare(
      `INSERT INTO candidate_stage_history(candidate_id, vacancy_code, stage, actor_email, reason, assessment_version, batch_id, batch_position, batch_size, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(candidateId, vacancyCode, stage, actorEmail, reason, assessmentVersion, batchId, batchPosition, batchSize, createdAt || nowIso());
  }

  function insertNoteRecord(candidateId, vacancyCode, actorEmail, text, createdAt) {
    const info = db.prepare('INSERT INTO candidate_notes(candidate_id, vacancy_code, actor_email, text, created_at) VALUES(?, ?, ?, ?, ?)').run(
      candidateId,
      vacancyCode,
      actorEmail,
      text,
      createdAt || nowIso()
    );
    return info.lastInsertRowid;
  }

  function insertActivity(vacancyCode, candidateId, actorEmail, type, title, body, revision, batchId, batchPosition, batchSize, createdAt, details) {
    db.prepare(
      `INSERT INTO activity_events(vacancy_code, candidate_id, actor_email, type, title, body, revision, batch_id, batch_position, batch_size, created_at, details_json)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(vacancyCode, candidateId, actorEmail, type, title, body, revision, batchId, batchPosition, batchSize, createdAt || nowIso(), JSON.stringify(details || {}));
  }

  function stageReason(fromStage, toStage) {
    if (TERMINAL_STAGES.includes(toStage)) return `moved to ${toStage}`;
    if (toStage === 'interview' && fromStage !== 'interview') return 'entered interview';
    if (fromStage === 'offer' && toStage === 'hired') return 'accepted offer';
    if (fromStage === 'hired' && toStage === 'offer') return 'returned from hired to offer';
    return `moved from ${fromStage} to ${toStage}`;
  }

  function seedDatabase(dbInstance) {
    const alreadySeeded = dbInstance.prepare('SELECT value FROM metadata WHERE key = ?').get('seed_complete');
    if (alreadySeeded) return;
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    const passwordHash = sha256(seed.seed_password);
    const tx = dbInstance.transaction(() => {
      for (const person of seed.people) {
        dbInstance.prepare('INSERT INTO users(email, name, role, password_hash) VALUES(?, ?, ?, ?)').run(person.email, person.name, person.role, passwordHash);
      }
      for (const role of seed.roles) {
        dbInstance.prepare('INSERT INTO vacancies(code, title, team, openings, revision, created_at) VALUES(?, ?, ?, ?, 1, ?)').run(role.code, role.title, role.team, role.openings, seed.clock);
      }
      dbInstance.prepare('INSERT INTO counters(name, value) VALUES(?, ?)').run('candidate_seq', 109);
      for (const candidate of seed.candidates) {
        const appliedAt = timeOffset(seed.clock, candidate.days_since_applied, 0);
        dbInstance.prepare(
          `INSERT INTO candidates(id, vacancy_code, name, stage, assessment_version, applied_at, created_at, updated_at, created_by)
           VALUES(?, ?, ?, ?, 1, ?, ?, ?, ?)`
        ).run(candidate.id, candidate.role, candidate.name, candidate.stage, appliedAt, appliedAt, appliedAt, 'seed');
        candidate.history.forEach((stage, index) => {
          const stamp = timeOffset(appliedAt, 0, index * 10);
          insertStageHistory(candidate.id, candidate.role, stage, 'seed', 'seed import', 1, null, null, null, stamp);
          insertActivity(candidate.role, candidate.id, 'seed', 'seed-stage', `${candidate.name}: ${stage}`, `Imported stage ${stage}`, 1, null, null, null, stamp, {
            stage,
            candidateId: candidate.id,
            assessmentVersion: 1,
            seed: true,
          });
        });
      }
      for (const panel of seed.panels) {
        const vacancyCode = getCandidateRow(panel.candidate).vacancy_code;
        for (const memberEmail of panel.members) {
          dbInstance.prepare(
            `INSERT INTO candidate_panels(candidate_id, vacancy_code, member_email, active, added_by, added_at, removed_by, removed_at)
             VALUES(?, ?, ?, 1, ?, ?, NULL, NULL)`
          ).run(panel.candidate, vacancyCode, memberEmail, 'seed', seed.clock);
          insertActivity(vacancyCode, panel.candidate, 'seed', 'seed-panel', `${panel.candidate}: panel ${memberEmail}`, `Imported panel member ${memberEmail}`, 1, null, null, null, seed.clock, {
            candidateId: panel.candidate,
            memberEmail,
            seed: true,
          });
        }
      }
      for (const score of seed.scores) {
        const vacancyCode = getCandidateRow(score.candidate).vacancy_code;
        dbInstance.prepare(
          `INSERT INTO candidate_scores(candidate_id, vacancy_code, assessment_version, member_email, score, recorded_by, recorded_at)
           VALUES(?, ?, 1, ?, ?, ?, ?)`
        ).run(score.candidate, vacancyCode, score.panel_member, score.score, 'seed', seed.clock);
        insertActivity(vacancyCode, score.candidate, 'seed', 'seed-score', `${score.candidate}: score ${score.score}`, `Imported score ${score.score} from ${score.panel_member}`, 1, null, null, null, seed.clock, {
          candidateId: score.candidate,
          memberEmail: score.panel_member,
          score: score.score,
          assessmentVersion: 1,
          seed: true,
        });
      }
      dbInstance.prepare('INSERT INTO metadata(key, value) VALUES(?, ?)').run('seed_complete', '1');
    });
    tx();
  }

  return {
    db,
    getUserByEmail,
    getSession,
    createSession,
    revokeSession,
    getBootstrap,
    listVacancies,
    getVacancyView,
    getCandidateView,
    previewBatch,
    createCandidate,
    changeStage,
    changePanel,
    recordScore,
    addNote,
    confirmBatch,
    labelUser: (email) => labelUser({ getUserByEmail }, email),
  };
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY(email) REFERENCES users(email)
    );
    CREATE TABLE IF NOT EXISTS vacancies (
      code TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      team TEXT NOT NULL,
      openings INTEGER NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      vacancy_code TEXT NOT NULL,
      name TEXT NOT NULL,
      stage TEXT NOT NULL,
      assessment_version INTEGER NOT NULL,
      applied_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY(vacancy_code) REFERENCES vacancies(code)
    );
    CREATE TABLE IF NOT EXISTS candidate_stage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      vacancy_code TEXT NOT NULL,
      stage TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      reason TEXT NOT NULL,
      assessment_version INTEGER NOT NULL,
      batch_id TEXT,
      batch_position INTEGER,
      batch_size INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS candidate_panels (
      candidate_id TEXT NOT NULL,
      vacancy_code TEXT NOT NULL,
      member_email TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      added_by TEXT NOT NULL,
      added_at TEXT NOT NULL,
      removed_by TEXT,
      removed_at TEXT,
      PRIMARY KEY(candidate_id, member_email)
    );
    CREATE TABLE IF NOT EXISTS candidate_scores (
      candidate_id TEXT NOT NULL,
      vacancy_code TEXT NOT NULL,
      assessment_version INTEGER NOT NULL,
      member_email TEXT NOT NULL,
      score INTEGER NOT NULL,
      recorded_by TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      PRIMARY KEY(candidate_id, assessment_version, member_email)
    );
    CREATE TABLE IF NOT EXISTS candidate_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      vacancy_code TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vacancy_code TEXT NOT NULL,
      candidate_id TEXT,
      actor_email TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      revision INTEGER NOT NULL,
      batch_id TEXT,
      batch_position INTEGER,
      batch_size INTEGER,
      created_at TEXT NOT NULL,
      details_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS operations (
      actor_email TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      method TEXT NOT NULL,
      route TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(actor_email, operation_id, method, route)
    );
    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
  `);
}

module.exports = {
  createStore,
  PIPELINE_STAGES,
  TERMINAL_STAGES,
  ELIGIBLE_PANEL_MEMBERS,
};
