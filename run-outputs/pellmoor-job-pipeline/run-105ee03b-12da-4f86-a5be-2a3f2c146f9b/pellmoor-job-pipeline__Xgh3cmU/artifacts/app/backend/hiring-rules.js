import { dbGet, dbAll, dbRun } from './database.js';

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired'];
const TERMINAL_STAGES = ['rejected', 'withdrawn'];
const ALL_STAGES = [...STAGES, ...TERMINAL_STAGES];
const SCORE_RANGE = [1, 5];
const MIN_PANEL = 2;

// Permissions
const PERMISSIONS = {
  hiring_manager: {
    moveCandidate: true,
    addNote: true,
    batchOffer: true,
  },
  coordinator: {
    addCandidate: true,
    addPanelMember: true,
    removePanelMember: true,
    addNote: true,
  },
  panel: {
    scoreCandidate: true,
    addNote: true,
  },
};

export async function canMoveCandidate(userRole) {
  return userRole === 'hiring manager';
}

export async function canAddPanelMember(userRole, userEmail) {
  if (userRole !== 'coordinator') return false;
  // Coordinator cannot be a panel member
  return userEmail !== 'coord@pellmoor.test';
}

export async function canRemovePanelMember(userRole) {
  return userRole === 'coordinator';
}

export async function canScoreCandidate(userRole) {
  return userRole === 'panel';
}

export async function canAddCandidate(userRole) {
  return userRole === 'coordinator';
}

export async function canBatchOffer(userRole) {
  return userRole === 'hiring manager';
}

export async function canAddNote() {
  return true; // Everyone can add notes
}

export async function isValidStageTransition(currentStage, nextStage) {
  // Terminal stages are terminal
  if (TERMINAL_STAGES.includes(currentStage)) {
    return false;
  }

  // Must be a valid stage
  if (!ALL_STAGES.includes(nextStage)) {
    return false;
  }

  // Can only move back one stage
  const currentIndex = STAGES.indexOf(currentStage);
  const nextIndex = STAGES.indexOf(nextStage);

  if (nextIndex === currentIndex + 1) {
    // Moving forward
    return true;
  }

  if (nextIndex === currentIndex - 1) {
    // Moving back one stage
    return true;
  }

  // Terminal stages
  if (TERMINAL_STAGES.includes(nextStage) && nextIndex >= 0) {
    // Can move to rejected/withdrawn from any pipeline stage
    return true;
  }

  return false;
}

export async function isPanelEligible(email, userRole) {
  // Only Ruth, Otis, and Wren can be panel members
  // Cal (coordinator) cannot be assigned
  const eligibleEmails = [
    'hiring@pellmoor.test', // Ruth
    'panel1@pellmoor.test', // Otis
    'panel2@pellmoor.test', // Wren
  ];

  return eligibleEmails.includes(email);
}

export async function canAddPanelAtStage(stage) {
  // Can add/remove panels only at applied, screening, or interview
  return ['applied', 'screening', 'interview'].includes(stage);
}

export async function canScoreAtStage(stage) {
  // Can only score at interview
  return stage === 'interview';
}

export async function hasMinimumPanel(panelMembers) {
  return panelMembers.length >= MIN_PANEL;
}

export async function hasNonHiringManagerOnPanel(panelMembers) {
  // At least one panel member must not be the hiring manager
  return panelMembers.some((email) => email !== 'hiring@pellmoor.test');
}

export async function isHiringManagerOnly(panelMembers) {
  // Check if panel consists only of hiring manager
  return (
    panelMembers.length === 1 &&
    panelMembers[0] === 'hiring@pellmoor.test'
  );
}

export async function getCompletePanelWithScores(candidateId, assessmentVersion) {
  // Get panel for candidate at specific assessment version
  const panel = await dbGet(
    `SELECT p.id FROM panels p
     WHERE p.candidate_id = ? AND p.assessment_version = ?`,
    [candidateId, assessmentVersion]
  );

  if (!panel) {
    return null;
  }

  const members = await dbAll(
    `SELECT email FROM panel_members WHERE panel_id = ?`,
    [panel.id]
  );

  if (members.length < MIN_PANEL) {
    return null;
  }

  const scores = await dbAll(
    `SELECT panel_member_email, score FROM scores
     WHERE candidate_id = ? AND assessment_version = ?`,
    [candidateId, assessmentVersion]
  );

  const memberEmails = members.map((m) => m.email);

  // Check if all panel members have scores
  const scoredMembers = scores.map((s) => s.panel_member_email);
  const allScored = memberEmails.every((email) =>
    scoredMembers.includes(email)
  );

  if (!allScored) {
    return null;
  }

  // Check for hiring manager only panel
  const hasNonHiringManager = memberEmails.some(
    (email) => email !== 'hiring@pellmoor.test'
  );
  if (!hasNonHiringManager) {
    return null;
  }

  return { members: memberEmails, scores };
}

export async function calculateVacancyCapacity(roleCode) {
  // Get total openings
  const role = await dbGet(
    `SELECT openings FROM roles WHERE code = ?`,
    [roleCode]
  );

  if (!role) {
    return null;
  }

  const total = role.openings;

  // Count filled (hired)
  const filled = await dbGet(
    `SELECT COUNT(*) as count FROM candidates
     WHERE role_code = ? AND current_stage = 'hired'`,
    [roleCode]
  );

  // Count reserved (offer)
  const reserved = await dbGet(
    `SELECT COUNT(*) as count FROM candidates
     WHERE role_code = ? AND current_stage = 'offer'`,
    [roleCode]
  );

  const filledCount = filled?.count || 0;
  const reservedCount = reserved?.count || 0;
  const availableCount = Math.max(0, total - filledCount - reservedCount);

  return {
    total,
    filled: filledCount,
    reserved: reservedCount,
    available: availableCount,
  };
}

export async function canTransitionToOffer(candidateId, assessmentVersion, roleCode) {
  // Check: must have complete current assessment
  const complete = await getCompletePanelWithScores(candidateId, assessmentVersion);
  if (!complete) {
    return { allowed: false, reason: 'Incomplete assessment' };
  }

  // Check: must have available capacity
  const capacity = await calculateVacancyCapacity(roleCode);
  if (capacity.available <= 0) {
    return { allowed: false, reason: 'No available openings' };
  }

  return { allowed: true };
}

export async function calculateFunnel(roleCode) {
  // Get all candidates for this role
  const candidates = await dbAll(
    `SELECT id, current_stage FROM candidates WHERE role_code = ?`,
    [roleCode]
  );

  // Get all stage histories
  const histories = await Promise.all(
    candidates.map(async (c) => {
      const history = await dbAll(
        `SELECT stage FROM stage_history WHERE candidate_id = ? ORDER BY timestamp ASC`,
        [c.id]
      );
      return {
        id: c.id,
        currentStage: c.current_stage,
        history: history.map((h) => h.stage),
      };
    })
  );

  // Calculate funnel: reached count, remaining count, lost count at each stage
  const funnel = {};
  for (const stage of STAGES) {
    funnel[stage] = {
      reached: 0,
      remaining: 0,
      lost: 0,
    };
  }

  for (const candidate of histories) {
    // Count reached stages
    const visitedStages = new Set();
    for (const stage of candidate.history) {
      if (STAGES.includes(stage)) {
        visitedStages.add(stage);
        funnel[stage].reached++;
      }
    }

    // Determine if lost and at which stage
    const isTerminal = TERMINAL_STAGES.includes(candidate.currentStage);
    if (isTerminal) {
      // Lost - find the last pipeline stage visited before terminal
      const lastPipelineStage = [...candidate.history]
        .reverse()
        .find((stage) => STAGES.includes(stage));

      if (lastPipelineStage) {
        funnel[lastPipelineStage].lost++;
      }
    } else {
      // Still in pipeline - remaining at current stage
      if (STAGES.includes(candidate.currentStage)) {
        funnel[candidate.currentStage].remaining++;
      }
    }
  }

  return funnel;
}

export async function validatePanelAddition(
  candidateId,
  memberEmail,
  currentAssessmentVersion
) {
  const candidate = await dbGet(
    `SELECT current_stage FROM candidates WHERE id = ?`,
    [candidateId]
  );

  if (!candidate) {
    return { valid: false, error: 'Candidate not found' };
  }

  if (!(await canAddPanelAtStage(candidate.current_stage))) {
    return { valid: false, error: 'Cannot add panel at this stage' };
  }

  if (!(await isPanelEligible(memberEmail))) {
    return { valid: false, error: 'Panel member not eligible' };
  }

  // Check if already on panel
  const existingPanel = await dbGet(
    `SELECT pm.id FROM panel_members pm
     JOIN panels p ON pm.panel_id = p.id
     WHERE p.candidate_id = ? AND p.assessment_version = ? AND pm.email = ?`,
    [candidateId, currentAssessmentVersion, memberEmail]
  );

  if (existingPanel) {
    return { valid: false, error: 'Member already on panel' };
  }

  return { valid: true };
}

export async function validateScore(
  score,
  candidateId,
  stage,
  panelMemberEmail
) {
  if (!Number.isInteger(score)) {
    return { valid: false, error: 'Score must be an integer' };
  }

  if (score < SCORE_RANGE[0] || score > SCORE_RANGE[1]) {
    return {
      valid: false,
      error: `Score must be between ${SCORE_RANGE[0]} and ${SCORE_RANGE[1]}`,
    };
  }

  if (!(await canScoreAtStage(stage))) {
    return { valid: false, error: 'Can only score at interview stage' };
  }

  return { valid: true };
}
