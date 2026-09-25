const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { authMiddleware, requireRole } = require('../auth');
const { handleIdempotency, sendResponseWithReceipt } = require('../receipts');
const { checkForServerOwnedFields, parseExpectedRevision } = require('../validation');
const { getCapacity, evaluateOfferEligibility, HIRING_MANAGER_EMAIL, ELIGIBLE_PANEL_MEMBERS } = require('../rules');
const { getCandidateDetails, getVacancyFullDetails } = require('../vacancyService');

const router = express.Router({ mergeParams: true });

// 1. Batch offers preview (Read-only)
router.post('/preview', authMiddleware, (req, res) => {
  const serverFieldErr = checkForServerOwnedFields(req.body, ['candidate_ids']);
  if (serverFieldErr) {
    return res.status(400).json({ error: serverFieldErr });
  }

  const { candidate_ids } = req.body || {};
  if (!Array.isArray(candidate_ids)) {
    return res.status(400).json({ error: 'candidate_ids must be an array of candidate identifier strings' });
  }

  const db = getDb();
  const vacancyCode = (req.params.code || '').trim().toUpperCase();
  const vacancy = db.prepare('SELECT code, openings, revision FROM vacancies WHERE code = ?').get(vacancyCode);
  if (!vacancy) {
    return res.status(404).json({ error: `Vacancy '${vacancyCode}' not found` });
  }

  const capacity = getCapacity(db, vacancyCode);
  const candidatesData = [];
  const batchIneligibleReasons = [];
  let allEligible = true;

  if (candidate_ids.length === 0) {
    allEligible = false;
    batchIneligibleReasons.push('No candidates selected for batch offer');
  }

  // Check duplicates in selection
  const seenIds = new Set();
  let hasDuplicates = false;
  for (const id of candidate_ids) {
    if (typeof id !== 'string' || !id.trim()) {
      allEligible = false;
      batchIneligibleReasons.push('Invalid or empty candidate identifier in selection array');
      continue;
    }
    const cleanId = id.trim();
    if (seenIds.has(cleanId)) {
      hasDuplicates = true;
    }
    seenIds.add(cleanId);
  }

  if (hasDuplicates) {
    allEligible = false;
    batchIneligibleReasons.push('Duplicate candidate identifiers found in batch selection');
  }

  for (const candId of candidate_ids) {
    if (typeof candId !== 'string' || !candId.trim()) continue;
    const cleanId = candId.trim();

    const cand = db.prepare('SELECT id, vacancy_code, name, stage, assessment_version FROM candidates WHERE id = ?').get(cleanId);
    if (!cand) {
      allEligible = false;
      candidatesData.push({
        id: cleanId,
        name: 'Unknown candidate',
        stage: 'unknown',
        assessment_version: 0,
        eligible: false,
        reasons: [`Candidate '${cleanId}' not found`]
      });
      continue;
    }

    if (cand.vacancy_code !== vacancyCode) {
      allEligible = false;
      candidatesData.push({
        id: cand.id,
        name: cand.name,
        stage: cand.stage,
        assessment_version: cand.assessment_version,
        eligible: false,
        reasons: [`Candidate belongs to vacancy '${cand.vacancy_code}', not '${vacancyCode}'`]
      });
      continue;
    }

    const panelRows = db.prepare('SELECT member_email FROM panel_assignments WHERE candidate_id = ?').all(cand.id);
    const panelEmails = panelRows.map(p => p.member_email);
    const scoreRows = db.prepare('SELECT assessment_version, scorer_email, score FROM scores WHERE candidate_id = ?').all(cand.id);

    // Evaluate individual eligibility (excluding single capacity limit, as capacity is checked for whole batch)
    const reasons = [];
    if (cand.stage !== 'interview') {
      reasons.push(`Candidate is in stage '${cand.stage}', must be in 'interview'`);
    }

    if (panelEmails.length < 2) {
      reasons.push(`Panel requires at least 2 distinct members (currently ${panelEmails.length})`);
    } else {
      const nonHM = panelEmails.filter(m => m !== HIRING_MANAGER_EMAIL);
      if (nonHM.length === 0) {
        reasons.push('Panel cannot consist only of the hiring manager');
      }
    }

    const currentScoresMap = new Map();
    for (const s of scoreRows) {
      if (s.assessment_version === cand.assessment_version) {
        currentScoresMap.set(s.scorer_email, s.score);
      }
    }

    for (const m of panelEmails) {
      const score = currentScoresMap.get(m);
      if (score === undefined || score === null) {
        const memberNameRow = db.prepare('SELECT name FROM people WHERE email = ?').get(m);
        const memberName = memberNameRow ? memberNameRow.name : m;
        reasons.push(`Missing score from ${memberName} (version ${cand.assessment_version})`);
      }
    }

    const isEligible = reasons.length === 0;
    if (!isEligible) {
      allEligible = false;
    }

    candidatesData.push({
      id: cand.id,
      name: cand.name,
      stage: cand.stage,
      assessment_version: cand.assessment_version,
      eligible: isEligible,
      reasons
    });
  }

  // Check batch capacity
  if (candidate_ids.length > capacity.available) {
    allEligible = false;
    batchIneligibleReasons.push(
      `Insufficient capacity: selecting ${candidate_ids.length} candidates exceeds ${capacity.available} available openings`
    );
  }

  const projectedReserved = capacity.reserved + candidate_ids.length;
  const projectedAvailable = Math.max(0, capacity.openings - projectedReserved - capacity.filled);

  return res.json({
    vacancy_code: vacancyCode,
    selected_count: candidate_ids.length,
    current_capacity: {
      openings: capacity.openings,
      reserved: capacity.reserved,
      filled: capacity.filled,
      available: capacity.available,
      revision: vacancy.revision
    },
    projected_capacity: {
      openings: capacity.openings,
      reserved: projectedReserved,
      filled: capacity.filled,
      available: projectedAvailable
    },
    candidates: candidatesData,
    batch_eligible: allEligible && candidate_ids.length > 0,
    batch_ineligible_reasons: batchIneligibleReasons
  });
});

// 2. Commit Batch Offers (Ruth only)
router.post('/', authMiddleware, requireRole('hiring manager'), handleIdempotency, (req, res) => {
  const serverFieldErr = checkForServerOwnedFields(req.body, ['candidate_ids']);
  if (serverFieldErr) {
    return sendResponseWithReceipt(res, 400, { error: serverFieldErr });
  }

  const { candidate_ids } = req.body || {};
  if (!Array.isArray(candidate_ids) || candidate_ids.length === 0) {
    return sendResponseWithReceipt(res, 400, { error: 'candidate_ids must be a non-empty array of candidate identifiers' });
  }

  for (const id of candidate_ids) {
    if (typeof id !== 'string' || !id.trim()) {
      return sendResponseWithReceipt(res, 400, { error: 'candidate_ids must contain non-empty string identifiers' });
    }
  }

  // Check duplicate IDs
  const idSet = new Set(candidate_ids);
  if (idSet.size !== candidate_ids.length) {
    return sendResponseWithReceipt(res, 400, { error: 'Duplicate candidate identifiers in batch selection' });
  }

  const db = getDb();
  const vacancyCode = (req.params.code || '').trim().toUpperCase();
  const vacancy = db.prepare('SELECT code, openings, revision FROM vacancies WHERE code = ?').get(vacancyCode);
  if (!vacancy) {
    return sendResponseWithReceipt(res, 404, { error: `Vacancy '${vacancyCode}' not found` });
  }

  const revCheck = parseExpectedRevision(req);
  if (revCheck.error) {
    return sendResponseWithReceipt(res, 400, { error: revCheck.error });
  }
  if (revCheck.revision !== null && revCheck.revision !== vacancy.revision) {
    return sendResponseWithReceipt(res, 409, {
      error: `Concurrency conflict: vacancy revision is ${vacancy.revision}, but expected revision was ${revCheck.revision}`,
      current_revision: vacancy.revision,
      vacancy: getVacancyFullDetails(db, vacancyCode)
    });
  }

  const capacity = getCapacity(db, vacancyCode);
  if (candidate_ids.length > capacity.available) {
    return sendResponseWithReceipt(res, 409, {
      error: `Vacancy capacity exceeded: ${candidate_ids.length} offers requested, but only ${capacity.available} openings available`,
      available: capacity.available,
      requested: candidate_ids.length
    });
  }

  // Validate every candidate in the batch
  const candidateRecords = [];
  for (let i = 0; i < candidate_ids.length; i++) {
    const candId = candidate_ids[i].trim();
    const cand = db.prepare('SELECT id, vacancy_code, name, stage, assessment_version FROM candidates WHERE id = ?').get(candId);
    if (!cand) {
      return sendResponseWithReceipt(res, 404, { error: `Candidate '${candId}' not found` });
    }
    if (cand.vacancy_code !== vacancyCode) {
      return sendResponseWithReceipt(res, 400, { error: `Candidate '${candId}' belongs to vacancy '${cand.vacancy_code}', not '${vacancyCode}'` });
    }
    if (cand.stage !== 'interview') {
      return sendResponseWithReceipt(res, 422, { error: `Candidate '${cand.name}' (${candId}) is in stage '${cand.stage}', must be in 'interview'` });
    }

    const panelRows = db.prepare('SELECT member_email FROM panel_assignments WHERE candidate_id = ?').all(cand.id);
    const panelEmails = panelRows.map(p => p.member_email);
    if (panelEmails.length < 2) {
      return sendResponseWithReceipt(res, 422, { error: `Candidate '${cand.name}' requires at least 2 panel members (currently ${panelEmails.length})` });
    }
    const nonHM = panelEmails.filter(m => m !== HIRING_MANAGER_EMAIL);
    if (nonHM.length === 0) {
      return sendResponseWithReceipt(res, 422, { error: `Candidate '${cand.name}' panel cannot consist only of the hiring manager` });
    }

    const scoreRows = db.prepare('SELECT scorer_email, score FROM scores WHERE candidate_id = ? AND assessment_version = ?').all(cand.id, cand.assessment_version);
    const scoredMap = new Map(scoreRows.map(s => [s.scorer_email, s.score]));

    for (const m of panelEmails) {
      if (!scoredMap.has(m)) {
        return sendResponseWithReceipt(res, 422, { error: `Candidate '${cand.name}' is missing score from panel member ${m} for assessment version ${cand.assessment_version}` });
      }
    }

    candidateRecords.push(cand);
  }

  // All candidates validated and room exists. Execute atomic batch offer!
  const batchId = `BATCH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();
  let updatedVacancy, updatedCandidates;

  const tx = db.transaction(() => {
    for (let i = 0; i < candidateRecords.length; i++) {
      const cand = candidateRecords[i];
      const position = i + 1;
      const batchSize = candidateRecords.length;

      // Update candidate stage to 'offer' (assessment_version unchanged)
      db.prepare('UPDATE candidates SET stage = \'offer\', updated_at = ? WHERE id = ?').run(now, cand.id);

      // Add stage history entry
      const maxSeqRow = db.prepare('SELECT MAX(sequence_order) as max_seq FROM candidate_stage_history WHERE candidate_id = ?').get(cand.id);
      const nextSeq = (maxSeqRow && maxSeqRow.max_seq) ? maxSeqRow.max_seq + 1 : 1;

      db.prepare(`
        INSERT INTO candidate_stage_history (candidate_id, stage, sequence_order, created_at)
        VALUES (?, 'offer', ?, ?)
      `).run(cand.id, nextSeq, now);

      // Add activity event for this candidate
      const details = {
        batch_id: batchId,
        batch_position: position,
        batch_size: batchSize,
        from_stage: 'interview',
        to_stage: 'offer',
        assessment_version: cand.assessment_version
      };

      db.prepare(`
        INSERT INTO activity_log (vacancy_code, candidate_id, actor_email, actor_name, action_type, description, details_json, created_at)
        VALUES (?, ?, ?, ?, 'BATCH_OFFER', ?, ?, ?)
      `).run(
        vacancyCode,
        cand.id,
        req.user.email,
        req.user.name,
        `Offer extended to ${cand.name} (Batch offer ${position}/${batchSize}, ID: ${batchId})`,
        JSON.stringify(details),
        now
      );
    }

    // Vacancy revision increments EXACTLY ONCE for the whole batch
    db.prepare('UPDATE vacancies SET revision = revision + 1 WHERE code = ?').run(vacancyCode);

    updatedVacancy = getVacancyFullDetails(db, vacancyCode);
    updatedCandidates = candidateRecords.map(c => getCandidateDetails(db, c.id));
  });

  tx();

  return sendResponseWithReceipt(res, 200, {
    success: true,
    batch_id: batchId,
    batch_size: candidateRecords.length,
    vacancy: updatedVacancy,
    candidates: updatedCandidates
  });
});

module.exports = router;
