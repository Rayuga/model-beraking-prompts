const { STAGES, TERMINAL_STAGES, ELIGIBLE_PANEL_MEMBERS, getCapacity, calculateFunnel, evaluateOfferEligibility } = require('./rules');

function getVacancySummary(db, vacancyCode) {
  const v = db.prepare('SELECT code, title, team, openings, revision FROM vacancies WHERE code = ?').get(vacancyCode);
  if (!v) return null;

  const capacity = getCapacity(db, vacancyCode);
  const countRow = db.prepare('SELECT COUNT(*) as count FROM candidates WHERE vacancy_code = ?').get(vacancyCode);

  return {
    code: v.code,
    title: v.title,
    team: v.team,
    openings: v.openings,
    revision: v.revision,
    reserved: capacity.reserved,
    filled: capacity.filled,
    available: capacity.available,
    candidate_count: countRow ? countRow.count : 0
  };
}

function getAllVacancies(db) {
  const rows = db.prepare('SELECT code FROM vacancies ORDER BY code ASC').all();
  return rows.map(r => getVacancySummary(db, r.code));
}

function getCandidateDetails(db, candidateId) {
  const cand = db.prepare(`
    SELECT c.id, c.vacancy_code, c.name, c.stage, c.days_since_applied, c.assessment_version, c.created_at, c.updated_at
    FROM candidates c
    WHERE c.id = ?
  `).get(candidateId);

  if (!cand) return null;

  // History
  const historyRows = db.prepare(`
    SELECT stage FROM candidate_stage_history
    WHERE candidate_id = ?
    ORDER BY sequence_order ASC
  `).all(cand.id);
  const history = historyRows.map(r => r.stage);

  // Panel
  const panelRows = db.prepare(`
    SELECT pa.member_email, p.name as member_name
    FROM panel_assignments pa
    LEFT JOIN people p ON pa.member_email = p.email
    WHERE pa.candidate_id = ?
    ORDER BY pa.member_email ASC
  `).all(cand.id);
  const panel = panelRows.map(p => ({
    email: p.member_email,
    name: p.member_name || p.member_email
  }));
  const panelEmails = panel.map(p => p.email);

  // Scores
  const scoreRows = db.prepare(`
    SELECT s.assessment_version, s.scorer_email, s.score, p.name as scorer_name, s.created_at, s.updated_at
    FROM scores s
    LEFT JOIN people p ON s.scorer_email = p.email
    WHERE s.candidate_id = ?
    ORDER BY s.assessment_version DESC, s.scorer_email ASC
  `).all(cand.id);

  const currentScores = [];
  const historicalScores = [];

  for (const s of scoreRows) {
    const item = {
      assessment_version: s.assessment_version,
      scorer_email: s.scorer_email,
      scorer_name: s.scorer_name || s.scorer_email,
      score: s.score,
      created_at: s.created_at,
      updated_at: s.updated_at
    };
    if (s.assessment_version === cand.assessment_version) {
      currentScores.push(item);
    } else {
      historicalScores.push(item);
    }
  }

  // Notes
  const notesRows = db.prepare(`
    SELECT id, author_email, author_name, text, created_at
    FROM notes
    WHERE candidate_id = ?
    ORDER BY id ASC
  `).all(cand.id);

  // Capacity & Eligibility
  const capacity = getCapacity(db, cand.vacancy_code);
  const eligibility = evaluateOfferEligibility(cand, panelEmails, scoreRows, capacity.available);

  const isFrozen = ['offer', 'hired', 'rejected', 'withdrawn'].includes(cand.stage);
  const isTerminal = ['rejected', 'withdrawn'].includes(cand.stage);

  return {
    id: cand.id,
    vacancy_code: cand.vacancy_code,
    name: cand.name,
    stage: cand.stage,
    days_since_applied: cand.days_since_applied,
    assessment_version: cand.assessment_version,
    history,
    panel,
    current_scores: currentScores,
    historical_scores: historicalScores,
    notes: notesRows,
    offer_eligibility: eligibility,
    is_frozen: isFrozen,
    is_terminal: isTerminal,
    created_at: cand.created_at,
    updated_at: cand.updated_at
  };
}

function getVacancyFullDetails(db, vacancyCode) {
  const summary = getVacancySummary(db, vacancyCode);
  if (!summary) return null;

  const funnel = calculateFunnel(db, vacancyCode);

  const candidateRows = db.prepare('SELECT id FROM candidates WHERE vacancy_code = ? ORDER BY id ASC').all(vacancyCode);
  const candidates = candidateRows.map(r => getCandidateDetails(db, r.id));

  const activityRows = db.prepare(`
    SELECT id, vacancy_code, candidate_id, actor_email, actor_name, action_type, description, details_json, created_at
    FROM activity_log
    WHERE vacancy_code = ?
    ORDER BY id DESC
    LIMIT 100
  `).all(vacancyCode);

  const activity = activityRows.map(a => {
    let details = {};
    try {
      details = JSON.parse(a.details_json);
    } catch (e) {
      details = {};
    }
    return {
      id: a.id,
      vacancy_code: a.vacancy_code,
      candidate_id: a.candidate_id,
      actor_email: a.actor_email,
      actor_name: a.actor_name,
      action_type: a.action_type,
      description: a.description,
      details,
      created_at: a.created_at
    };
  });

  return {
    vacancy: summary,
    funnel,
    candidates,
    activity
  };
}

module.exports = {
  getVacancySummary,
  getAllVacancies,
  getCandidateDetails,
  getVacancyFullDetails
};
