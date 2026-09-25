const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, requireRole } = require('../auth');
const { handleIdempotency, sendResponseWithReceipt } = require('../receipts');
const { checkForServerOwnedFields, parseExpectedRevision } = require('../validation');
const { STAGES, TERMINAL_STAGES, ELIGIBLE_PANEL_MEMBERS, HIRING_MANAGER_EMAIL, getCapacity, evaluateOfferEligibility, validateStageTransition } = require('../rules');
const { getCandidateDetails, getVacancyFullDetails, getVacancySummary } = require('../vacancyService');

const router = express.Router();

// 1. Create candidate (Coordinator only)
router.post('/', authMiddleware, requireRole('coordinator'), handleIdempotency, (req, res) => {
  const serverFieldErr = checkForServerOwnedFields(req.body, ['vacancy_code', 'name']);
  if (serverFieldErr) {
    return sendResponseWithReceipt(res, 400, { error: serverFieldErr });
  }

  const { vacancy_code, name } = req.body || {};
  if (!vacancy_code || typeof vacancy_code !== 'string' || !name || typeof name !== 'string' || !name.trim()) {
    return sendResponseWithReceipt(res, 400, { error: 'vacancy_code and non-empty name are required' });
  }

  const db = getDb();
  const vCode = vacancy_code.trim().toUpperCase();
  const trimmedName = name.trim();

  const vacancy = db.prepare('SELECT code, openings, revision FROM vacancies WHERE code = ?').get(vCode);
  if (!vacancy) {
    return sendResponseWithReceipt(res, 404, { error: `Vacancy '${vCode}' not found` });
  }

  const revCheck = parseExpectedRevision(req);
  if (revCheck.error) {
    return sendResponseWithReceipt(res, 400, { error: revCheck.error });
  }
  if (revCheck.revision !== null && revCheck.revision !== vacancy.revision) {
    return sendResponseWithReceipt(res, 409, {
      error: `Concurrency conflict: vacancy revision is ${vacancy.revision}, but expected revision was ${revCheck.revision}`,
      current_revision: vacancy.revision,
      vacancy: getVacancyFullDetails(db, vCode)
    });
  }

  // Check duplicate candidate in this vacancy
  const dup = db.prepare('SELECT id FROM candidates WHERE vacancy_code = ? AND LOWER(name) = LOWER(?)').get(vCode, trimmedName);
  if (dup) {
    return sendResponseWithReceipt(res, 400, { error: `Candidate '${trimmedName}' is already registered for vacancy ${vCode}` });
  }

  // Generate ID
  const maxRow = db.prepare("SELECT MAX(CAST(SUBSTR(id, 6) AS INTEGER)) as max_num FROM candidates WHERE id LIKE 'CAND-%'").get();
  const nextNum = (maxRow && maxRow.max_num) ? maxRow.max_num + 1 : 101;
  const candId = `CAND-${nextNum}`;

  const now = new Date().toISOString();
  let candidateRecord, vacancyRecord;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO candidates (id, vacancy_code, name, stage, days_since_applied, assessment_version, created_at, updated_at)
      VALUES (?, ?, ?, 'applied', 0, 1, ?, ?)
    `).run(candId, vCode, trimmedName, now, now);

    db.prepare(`
      INSERT INTO candidate_stage_history (candidate_id, stage, sequence_order, created_at)
      VALUES (?, 'applied', 1, ?)
    `).run(candId, now);

    db.prepare('UPDATE vacancies SET revision = revision + 1 WHERE code = ?').run(vCode);

    db.prepare(`
      INSERT INTO activity_log (vacancy_code, candidate_id, actor_email, actor_name, action_type, description, details_json, created_at)
      VALUES (?, ?, ?, ?, 'CANDIDATE_CREATED', ?, ?, ?)
    `).run(
      vCode,
      candId,
      req.user.email,
      req.user.name,
      `Candidate ${trimmedName} (${candId}) added to vacancy ${vCode}`,
      JSON.stringify({ candidate_id: candId, name: trimmedName, stage: 'applied', assessment_version: 1 }),
      now
    );

    candidateRecord = getCandidateDetails(db, candId);
    vacancyRecord = getVacancyFullDetails(db, vCode);
  });

  tx();

  return sendResponseWithReceipt(res, 201, {
    candidate: candidateRecord,
    vacancy: vacancyRecord
  });
});

// 2. Get candidate details
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const cand = getCandidateDetails(db, req.params.id);
  if (!cand) {
    return res.status(404).json({ error: `Candidate '${req.params.id}' not found` });
  }
  return res.json({ candidate: cand });
});

// 3. Stage transition (Hiring Manager only)
router.post('/:id/stage', authMiddleware, requireRole('hiring manager'), handleIdempotency, (req, res) => {
  const serverFieldErr = checkForServerOwnedFields(req.body, ['target_stage', 'stage']);
  if (serverFieldErr) {
    return sendResponseWithReceipt(res, 400, { error: serverFieldErr });
  }

  const targetStage = req.body.target_stage || req.body.stage;
  if (!targetStage || typeof targetStage !== 'string') {
    return sendResponseWithReceipt(res, 400, { error: 'target_stage string is required' });
  }

  const db = getDb();
  const cand = db.prepare('SELECT id, vacancy_code, name, stage, assessment_version FROM candidates WHERE id = ?').get(req.params.id);
  if (!cand) {
    return sendResponseWithReceipt(res, 404, { error: `Candidate '${req.params.id}' not found` });
  }

  const vacancy = db.prepare('SELECT code, openings, revision FROM vacancies WHERE code = ?').get(cand.vacancy_code);
  const revCheck = parseExpectedRevision(req);
  if (revCheck.error) {
    return sendResponseWithReceipt(res, 400, { error: revCheck.error });
  }
  if (revCheck.revision !== null && revCheck.revision !== vacancy.revision) {
    return sendResponseWithReceipt(res, 409, {
      error: `Concurrency conflict: vacancy revision is ${vacancy.revision}, but expected revision was ${revCheck.revision}`,
      current_revision: vacancy.revision,
      vacancy: getVacancyFullDetails(db, cand.vacancy_code)
    });
  }

  // Validate transition rules
  const transition = validateStageTransition(cand.stage, targetStage);
  if (!transition.valid) {
    return sendResponseWithReceipt(res, 400, { error: transition.error });
  }

  const capacity = getCapacity(db, cand.vacancy_code);

  // If moving to 'offer'
  if (targetStage === 'offer') {
    // Check panel assignments
    const panelRows = db.prepare('SELECT member_email FROM panel_assignments WHERE candidate_id = ?').all(cand.id);
    const panelEmails = panelRows.map(p => p.member_email);

    // Check scores
    const scoreRows = db.prepare('SELECT assessment_version, scorer_email, score FROM scores WHERE candidate_id = ?').all(cand.id);

    const eligibility = evaluateOfferEligibility(cand, panelEmails, scoreRows, capacity.available);
    if (!eligibility.eligible) {
      return sendResponseWithReceipt(res, 422, {
        error: `Cannot extend offer to ${cand.name}: ${eligibility.reasons.join('; ')}`,
        reasons: eligibility.reasons
      });
    }
  }

  // Determine if assessment version advances
  let newAssessmentVersion = cand.assessment_version;
  let versionChangeReason = null;

  // Transition into interview advances assessment version
  if (targetStage === 'interview' && cand.stage !== 'interview') {
    newAssessmentVersion += 1;
    versionChangeReason = cand.stage === 'offer'
      ? 'Interview reopened from offer'
      : `Transition into interview from ${cand.stage}`;
  }

  const now = new Date().toISOString();
  let updatedCandidate, updatedVacancy;

  const tx = db.transaction(() => {
    // Update candidate
    db.prepare(`
      UPDATE candidates
      SET stage = ?, assessment_version = ?, updated_at = ?
      WHERE id = ?
    `).run(targetStage, newAssessmentVersion, now, cand.id);

    // Get next sequence order for stage history
    const maxSeqRow = db.prepare('SELECT MAX(sequence_order) as max_seq FROM candidate_stage_history WHERE candidate_id = ?').get(cand.id);
    const nextSeq = (maxSeqRow && maxSeqRow.max_seq) ? maxSeqRow.max_seq + 1 : 1;

    db.prepare(`
      INSERT INTO candidate_stage_history (candidate_id, stage, sequence_order, created_at)
      VALUES (?, ?, ?, ?)
    `).run(cand.id, targetStage, nextSeq, now);

    // Vacancy revision increments by 1
    db.prepare('UPDATE vacancies SET revision = revision + 1 WHERE code = ?').run(cand.vacancy_code);

    // Activity log
    const details = {
      from_stage: cand.stage,
      to_stage: targetStage,
      assessment_version: newAssessmentVersion,
      version_change_reason: versionChangeReason
    };

    db.prepare(`
      INSERT INTO activity_log (vacancy_code, candidate_id, actor_email, actor_name, action_type, description, details_json, created_at)
      VALUES (?, ?, ?, ?, 'STAGE_CHANGE', ?, ?, ?)
    `).run(
      cand.vacancy_code,
      cand.id,
      req.user.email,
      req.user.name,
      `Stage changed from ${cand.stage} to ${targetStage} for ${cand.name}`,
      JSON.stringify(details),
      now
    );

    updatedCandidate = getCandidateDetails(db, cand.id);
    updatedVacancy = getVacancyFullDetails(db, cand.vacancy_code);
  });

  tx();

  return sendResponseWithReceipt(res, 200, {
    candidate: updatedCandidate,
    vacancy: updatedVacancy
  });
});

// 4. Panel management (Coordinator only)
router.post('/:id/panel', authMiddleware, requireRole('coordinator'), handleIdempotency, (req, res) => {
  const serverFieldErr = checkForServerOwnedFields(req.body, ['action', 'member_email', 'email']);
  if (serverFieldErr) {
    return sendResponseWithReceipt(res, 400, { error: serverFieldErr });
  }

  const { action } = req.body || {};
  const memberEmail = (req.body.member_email || req.body.email || '').trim().toLowerCase();

  if (!action || !['add', 'remove'].includes(action)) {
    return sendResponseWithReceipt(res, 400, { error: "action must be 'add' or 'remove'" });
  }
  if (!memberEmail) {
    return sendResponseWithReceipt(res, 400, { error: 'member_email is required' });
  }

  const db = getDb();
  const cand = db.prepare('SELECT id, vacancy_code, name, stage, assessment_version FROM candidates WHERE id = ?').get(req.params.id);
  if (!cand) {
    return sendResponseWithReceipt(res, 404, { error: `Candidate '${req.params.id}' not found` });
  }

  // Panels can only be modified at applied, screening, interview
  if (!['applied', 'screening', 'interview'].includes(cand.stage)) {
    return sendResponseWithReceipt(res, 400, {
      error: `Panel assignments are frozen in stage '${cand.stage}'. Move candidate back to interview to modify panel.`
    });
  }

  const vacancy = db.prepare('SELECT code, revision FROM vacancies WHERE code = ?').get(cand.vacancy_code);
  const revCheck = parseExpectedRevision(req);
  if (revCheck.error) {
    return sendResponseWithReceipt(res, 400, { error: revCheck.error });
  }
  if (revCheck.revision !== null && revCheck.revision !== vacancy.revision) {
    return sendResponseWithReceipt(res, 409, {
      error: `Concurrency conflict: vacancy revision is ${vacancy.revision}, but expected revision was ${revCheck.revision}`,
      current_revision: vacancy.revision,
      vacancy: getVacancyFullDetails(db, cand.vacancy_code)
    });
  }

  // Validate panel member eligibility
  if (!ELIGIBLE_PANEL_MEMBERS.includes(memberEmail)) {
    return sendResponseWithReceipt(res, 400, {
      error: `User '${memberEmail}' is not eligible for interview panels. Only Ruth, Otis, and Wren can be assigned.`
    });
  }

  // Check current panel assignments
  const existingAssignment = db.prepare('SELECT * FROM panel_assignments WHERE candidate_id = ? AND member_email = ?').get(cand.id, memberEmail);

  if (action === 'add') {
    if (existingAssignment) {
      return sendResponseWithReceipt(res, 400, { error: `Panel member '${memberEmail}' is already assigned to ${cand.name}` });
    }
  } else if (action === 'remove') {
    if (!existingAssignment) {
      return sendResponseWithReceipt(res, 400, { error: `Panel member '${memberEmail}' is not assigned to ${cand.name}` });
    }
  }

  const now = new Date().toISOString();
  const newAssessmentVersion = cand.assessment_version + 1;
  const versionReason = `Panel member ${action === 'add' ? 'added' : 'removed'}: ${memberEmail}`;

  let updatedCandidate, updatedVacancy;

  const tx = db.transaction(() => {
    if (action === 'add') {
      db.prepare('INSERT INTO panel_assignments (candidate_id, member_email, created_at) VALUES (?, ?, ?)').run(cand.id, memberEmail, now);
    } else {
      db.prepare('DELETE FROM panel_assignments WHERE candidate_id = ? AND member_email = ?').run(cand.id, memberEmail);
    }

    // Advance assessment version
    db.prepare('UPDATE candidates SET assessment_version = ?, updated_at = ? WHERE id = ?').run(newAssessmentVersion, now, cand.id);

    // Increment vacancy revision
    db.prepare('UPDATE vacancies SET revision = revision + 1 WHERE code = ?').run(cand.vacancy_code);

    // Activity log
    const memberObj = db.prepare('SELECT name FROM people WHERE email = ?').get(memberEmail);
    const memberName = memberObj ? memberObj.name : memberEmail;

    db.prepare(`
      INSERT INTO activity_log (vacancy_code, candidate_id, actor_email, actor_name, action_type, description, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cand.vacancy_code,
      cand.id,
      req.user.email,
      req.user.name,
      action === 'add' ? 'PANEL_ADDED' : 'PANEL_REMOVED',
      `Panel member ${memberName} (${memberEmail}) ${action === 'add' ? 'assigned to' : 'removed from'} ${cand.name} (assessment version advanced to ${newAssessmentVersion})`,
      JSON.stringify({
        action,
        member_email: memberEmail,
        member_name: memberName,
        assessment_version: newAssessmentVersion,
        version_change_reason: versionReason
      }),
      now
    );

    updatedCandidate = getCandidateDetails(db, cand.id);
    updatedVacancy = getVacancyFullDetails(db, cand.vacancy_code);
  });

  tx();

  return sendResponseWithReceipt(res, 200, {
    candidate: updatedCandidate,
    vacancy: updatedVacancy
  });
});

// 5. Score submission (Assigned panel member only)
router.post('/:id/scores', authMiddleware, handleIdempotency, (req, res) => {
  const serverFieldErr = checkForServerOwnedFields(req.body, ['score']);
  if (serverFieldErr) {
    return sendResponseWithReceipt(res, 400, { error: serverFieldErr });
  }

  const { score } = req.body || {};
  if (score === undefined || score === null || typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
    return sendResponseWithReceipt(res, 400, { error: 'score must be a whole-number integer between 1 and 5' });
  }

  const db = getDb();
  const cand = db.prepare('SELECT id, vacancy_code, name, stage, assessment_version FROM candidates WHERE id = ?').get(req.params.id);
  if (!cand) {
    return sendResponseWithReceipt(res, 404, { error: `Candidate '${req.params.id}' not found` });
  }

  if (cand.stage !== 'interview') {
    return sendResponseWithReceipt(res, 400, { error: `Scores can only be submitted or changed while candidate is in interview stage (currently '${cand.stage}')` });
  }

  // Check if current user is assigned to this candidate's panel
  const assignment = db.prepare('SELECT * FROM panel_assignments WHERE candidate_id = ? AND member_email = ?').get(cand.id, req.user.email);
  if (!assignment) {
    return sendResponseWithReceipt(res, 403, { error: `User '${req.user.email}' is not assigned to the interview panel for ${cand.name}` });
  }

  const vacancy = db.prepare('SELECT code, revision FROM vacancies WHERE code = ?').get(cand.vacancy_code);
  const revCheck = parseExpectedRevision(req);
  if (revCheck.error) {
    return sendResponseWithReceipt(res, 400, { error: revCheck.error });
  }
  if (revCheck.revision !== null && revCheck.revision !== vacancy.revision) {
    return sendResponseWithReceipt(res, 409, {
      error: `Concurrency conflict: vacancy revision is ${vacancy.revision}, but expected revision was ${revCheck.revision}`,
      current_revision: vacancy.revision,
      vacancy: getVacancyFullDetails(db, cand.vacancy_code)
    });
  }

  const now = new Date().toISOString();
  let updatedCandidate, updatedVacancy;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO scores (candidate_id, assessment_version, scorer_email, score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(candidate_id, assessment_version, scorer_email) DO UPDATE SET
        score = excluded.score,
        updated_at = excluded.updated_at
    `).run(cand.id, cand.assessment_version, req.user.email, score, now, now);

    db.prepare('UPDATE vacancies SET revision = revision + 1 WHERE code = ?').run(cand.vacancy_code);

    db.prepare(`
      INSERT INTO activity_log (vacancy_code, candidate_id, actor_email, actor_name, action_type, description, details_json, created_at)
      VALUES (?, ?, ?, ?, 'SCORE_SUBMITTED', ?, ?, ?)
    `).run(
      cand.vacancy_code,
      cand.id,
      req.user.email,
      req.user.name,
      `Score ${score}/5 submitted by ${req.user.name} for ${cand.name} (version ${cand.assessment_version})`,
      JSON.stringify({
        score,
        scorer_email: req.user.email,
        scorer_name: req.user.name,
        assessment_version: cand.assessment_version
      }),
      now
    );

    updatedCandidate = getCandidateDetails(db, cand.id);
    updatedVacancy = getVacancyFullDetails(db, cand.vacancy_code);
  });

  tx();

  return sendResponseWithReceipt(res, 200, {
    candidate: updatedCandidate,
    vacancy: updatedVacancy
  });
});

// 6. Notes (Any authenticated user)
router.post('/:id/notes', authMiddleware, handleIdempotency, (req, res) => {
  const serverFieldErr = checkForServerOwnedFields(req.body, ['text', 'note']);
  if (serverFieldErr) {
    return sendResponseWithReceipt(res, 400, { error: serverFieldErr });
  }

  const text = (req.body.text || req.body.note || '').trim();
  if (!text) {
    return sendResponseWithReceipt(res, 400, { error: 'Note text cannot be empty' });
  }

  const db = getDb();
  const cand = db.prepare('SELECT id, vacancy_code, name, stage, assessment_version FROM candidates WHERE id = ?').get(req.params.id);
  if (!cand) {
    return sendResponseWithReceipt(res, 404, { error: `Candidate '${req.params.id}' not found` });
  }

  const vacancy = db.prepare('SELECT code, revision FROM vacancies WHERE code = ?').get(cand.vacancy_code);
  const revCheck = parseExpectedRevision(req);
  if (revCheck.error) {
    return sendResponseWithReceipt(res, 400, { error: revCheck.error });
  }
  if (revCheck.revision !== null && revCheck.revision !== vacancy.revision) {
    return sendResponseWithReceipt(res, 409, {
      error: `Concurrency conflict: vacancy revision is ${vacancy.revision}, but expected revision was ${revCheck.revision}`,
      current_revision: vacancy.revision,
      vacancy: getVacancyFullDetails(db, cand.vacancy_code)
    });
  }

  const now = new Date().toISOString();
  let updatedCandidate, updatedVacancy;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO notes (candidate_id, author_email, author_name, text, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(cand.id, req.user.email, req.user.name, text, now);

    db.prepare('UPDATE vacancies SET revision = revision + 1 WHERE code = ?').run(cand.vacancy_code);

    db.prepare(`
      INSERT INTO activity_log (vacancy_code, candidate_id, actor_email, actor_name, action_type, description, details_json, created_at)
      VALUES (?, ?, ?, ?, 'NOTE_ADDED', ?, ?, ?)
    `).run(
      cand.vacancy_code,
      cand.id,
      req.user.email,
      req.user.name,
      `Note added by ${req.user.name} for ${cand.name}`,
      JSON.stringify({ text, author_email: req.user.email, author_name: req.user.name }),
      now
    );

    updatedCandidate = getCandidateDetails(db, cand.id);
    updatedVacancy = getVacancyFullDetails(db, cand.vacancy_code);
  });

  tx();

  return sendResponseWithReceipt(res, 201, {
    candidate: updatedCandidate,
    vacancy: updatedVacancy
  });
});

module.exports = router;
