const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired'];
const TERMINAL_STAGES = ['rejected', 'withdrawn'];
const ELIGIBLE_PANEL_MEMBERS = ['hiring@pellmoor.test', 'panel1@pellmoor.test', 'panel2@pellmoor.test'];
const HIRING_MANAGER_EMAIL = 'hiring@pellmoor.test';

function getCapacity(db, vacancyCode) {
  const vacancy = db.prepare('SELECT openings, revision FROM vacancies WHERE code = ?').get(vacancyCode);
  if (!vacancy) return null;

  const reservedRow = db.prepare(`
    SELECT COUNT(*) as count FROM candidates WHERE vacancy_code = ? AND stage = 'offer'
  `).get(vacancyCode);
  const filledRow = db.prepare(`
    SELECT COUNT(*) as count FROM candidates WHERE vacancy_code = ? AND stage = 'hired'
  `).get(vacancyCode);

  const reserved = reservedRow ? reservedRow.count : 0;
  const filled = filledRow ? filledRow.count : 0;
  const openings = vacancy.openings;
  const available = Math.max(0, openings - reserved - filled);

  return {
    openings,
    reserved,
    filled,
    available,
    revision: vacancy.revision
  };
}

function calculateFunnel(db, vacancyCode) {
  const funnel = {
    applied: { reached: 0, remain: 0, lost: 0 },
    screening: { reached: 0, remain: 0, lost: 0 },
    interview: { reached: 0, remain: 0, lost: 0 },
    offer: { reached: 0, remain: 0, lost: 0 },
    hired: { reached: 0, remain: 0, lost: 0 },
  };

  const candidates = db.prepare('SELECT id, stage FROM candidates WHERE vacancy_code = ?').all(vacancyCode);
  const getHistory = db.prepare('SELECT stage FROM candidate_stage_history WHERE candidate_id = ? ORDER BY sequence_order ASC');

  for (const cand of candidates) {
    const historyRows = getHistory.all(cand.id);
    const history = historyRows.map(r => r.stage);

    // 1. Reached
    const reachedSet = new Set();
    for (const st of history) {
      if (STAGES.includes(st)) {
        reachedSet.add(st);
      }
    }
    for (const st of reachedSet) {
      if (funnel[st]) {
        funnel[st].reached += 1;
      }
    }

    // 2. Remain
    if (STAGES.includes(cand.stage)) {
      if (funnel[cand.stage]) {
        funnel[cand.stage].remain += 1;
      }
    }

    // 3. Lost
    if (TERMINAL_STAGES.includes(cand.stage)) {
      // Find the last visited pipeline stage in history
      let lastPipelineStage = null;
      for (let i = history.length - 1; i >= 0; i--) {
        if (STAGES.includes(history[i])) {
          lastPipelineStage = history[i];
          break;
        }
      }
      if (lastPipelineStage && funnel[lastPipelineStage]) {
        funnel[lastPipelineStage].lost += 1;
      }
    }
  }

  return funnel;
}

function evaluateOfferEligibility(candidate, panelMembers, currentScores, availableCapacity) {
  const reasons = [];

  if (candidate.stage !== 'interview') {
    reasons.push(`Candidate is not at interview stage (currently ${candidate.stage})`);
  }

  if (!panelMembers || panelMembers.length < 2) {
    reasons.push(`Panel requires at least 2 distinct members (currently ${panelMembers ? panelMembers.length : 0})`);
  } else {
    // Check if panel consists only of hiring manager
    const nonHiringManager = panelMembers.filter(m => m !== HIRING_MANAGER_EMAIL);
    if (nonHiringManager.length === 0) {
      reasons.push('Panel cannot consist only of the hiring manager');
    }
    
    // Check for invalid panel members
    for (const m of panelMembers) {
      if (!ELIGIBLE_PANEL_MEMBERS.includes(m)) {
        reasons.push(`Ineligible panel member assigned: ${m}`);
      }
    }
  }

  // Check scores for all current panel members in the candidate's current assessment version
  const currentScoresMap = new Map();
  for (const s of currentScores) {
    if (s.assessment_version === candidate.assessment_version) {
      currentScoresMap.set(s.scorer_email, s.score);
    }
  }

  if (panelMembers) {
    for (const m of panelMembers) {
      const score = currentScoresMap.get(m);
      if (score === undefined || score === null) {
        reasons.push(`Missing score from panel member ${m} for assessment version ${candidate.assessment_version}`);
      } else if (!Number.isInteger(score) || score < 1 || score > 5) {
        reasons.push(`Invalid score ${score} from panel member ${m}`);
      }
    }
  }

  if (availableCapacity < 1) {
    reasons.push('Vacancy has no available openings');
  }

  return {
    eligible: reasons.length === 0,
    reasons
  };
}

function validateStageTransition(currentStage, targetStage) {
  if (TERMINAL_STAGES.includes(currentStage)) {
    return { valid: false, error: `Candidate is in terminal stage '${currentStage}' and cannot be moved` };
  }

  if (currentStage === targetStage) {
    return { valid: false, error: `Candidate is already in stage '${currentStage}'` };
  }

  // Terminal move is allowed from any non-terminal stage
  if (TERMINAL_STAGES.includes(targetStage)) {
    return { valid: true, isTerminal: true };
  }

  const currIdx = STAGES.indexOf(currentStage);
  const targetIdx = STAGES.indexOf(targetStage);

  if (currIdx === -1 || targetIdx === -1) {
    return { valid: false, error: `Unknown stage '${targetStage}'` };
  }

  // Forward move: +1 only
  if (targetIdx === currIdx + 1) {
    return { valid: true, isForward: true };
  }

  // Backward move: -1 only
  if (targetIdx === currIdx - 1) {
    return { valid: true, isBackstep: true };
  }

  if (targetIdx > currIdx) {
    return { valid: false, error: `Cannot skip stages: moving from '${currentStage}' to '${targetStage}' is not allowed` };
  } else {
    return { valid: false, error: `Cannot jump back more than one stage: moving from '${currentStage}' to '${targetStage}' is not allowed` };
  }
}

module.exports = {
  STAGES,
  TERMINAL_STAGES,
  ELIGIBLE_PANEL_MEMBERS,
  HIRING_MANAGER_EMAIL,
  getCapacity,
  calculateFunnel,
  evaluateOfferEligibility,
  validateStageTransition
};
