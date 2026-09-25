import express from 'express';
import { requireAuth } from './auth.js';
import { dbGet, dbAll, dbRun } from './database.js';
import {
  calculateVacancyCapacity,
  calculateFunnel,
  canMoveCandidate,
  isValidStageTransition,
  canTransitionToOffer,
  canAddCandidate,
} from './hiring-rules.js';

const router = express.Router();

// Get all vacancies with current state
router.get('/api/vacancies', requireAuth, async (req, res) => {
  try {
    const roles = await dbAll(`SELECT * FROM roles ORDER BY code`);

    const vacancies = await Promise.all(
      roles.map(async (role) => {
        const capacity = await calculateVacancyCapacity(role.code);
        const funnel = await calculateFunnel(role.code);

        // Get current revision
        const revision = await dbGet(
          `SELECT revision_number FROM vacancy_revisions
           WHERE role_code = ? ORDER BY revision_number DESC LIMIT 1`,
          [role.code]
        );

        // Count candidates by stage
        const stageCounts = {};
        for (const stage of [
          'applied',
          'screening',
          'interview',
          'offer',
          'hired',
          'rejected',
          'withdrawn',
        ]) {
          const count = await dbGet(
            `SELECT COUNT(*) as count FROM candidates
             WHERE role_code = ? AND current_stage = ?`,
            [role.code, stage]
          );
          stageCounts[stage] = count?.count || 0;
        }

        return {
          code: role.code,
          title: role.title,
          team: role.team,
          openings: role.openings,
          revision: revision?.revision_number || 1,
          capacity,
          funnel,
          stageCounts,
        };
      })
    );

    res.json({ vacancies });
  } catch (err) {
    console.error('Error fetching vacancies:', err);
    res.status(500).json({ error: 'Failed to fetch vacancies' });
  }
});

// Get specific vacancy details
router.get('/api/vacancies/:roleCode', requireAuth, async (req, res) => {
  const { roleCode } = req.params;

  try {
    const role = await dbGet(`SELECT * FROM roles WHERE code = ?`, [roleCode]);

    if (!role) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    const candidates = await dbAll(
      `SELECT * FROM candidates WHERE role_code = ? ORDER BY created_at DESC`,
      [roleCode]
    );

    const capacity = await calculateVacancyCapacity(roleCode);
    const funnel = await calculateFunnel(roleCode);

    const revision = await dbGet(
      `SELECT revision_number FROM vacancy_revisions
       WHERE role_code = ? ORDER BY revision_number DESC LIMIT 1`,
      [roleCode]
    );

    // Get full candidate details
    const candidateDetails = await Promise.all(
      candidates.map(async (candidate) => {
        const history = await dbAll(
          `SELECT stage, timestamp FROM stage_history
           WHERE candidate_id = ? ORDER BY timestamp ASC`,
          [candidate.id]
        );

        const notes = await dbAll(
          `SELECT n.id, n.content, n.author_email, u.name as author_name, n.created_at
           FROM notes n
           JOIN users u ON n.author_email = u.email
           WHERE n.candidate_id = ? ORDER BY n.created_at ASC`,
          [candidate.id]
        );

        return {
          id: candidate.id,
          name: candidate.name,
          currentStage: candidate.current_stage,
          assessmentVersion: candidate.assessment_version,
          createdAt: candidate.created_at,
          updatedAt: candidate.updated_at,
          history: history.map((h) => ({
            stage: h.stage,
            timestamp: h.timestamp,
          })),
          notes,
        };
      })
    );

    res.json({
      vacancy: {
        code: role.code,
        title: role.title,
        team: role.team,
        openings: role.openings,
        revision: revision?.revision_number || 1,
        capacity,
        funnel,
        candidates: candidateDetails,
      },
    });
  } catch (err) {
    console.error('Error fetching vacancy:', err);
    res.status(500).json({ error: 'Failed to fetch vacancy' });
  }
});

// Move candidate to next stage
router.post('/api/vacancies/:roleCode/candidates/:candidateId/move', requireAuth, async (req, res) => {
  const { roleCode, candidateId } = req.params;
  const { nextStage, expectedRevision } = req.body;

  // Check permissions
  const canMove = await canMoveCandidate(req.user.role);
  if (!canMove) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Get current candidate state
    const candidate = await dbGet(
      `SELECT * FROM candidates WHERE id = ? AND role_code = ?`,
      [candidateId, roleCode]
    );

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Get current revision
    const revisionResult = await dbGet(
      `SELECT revision_number FROM vacancy_revisions
       WHERE role_code = ? ORDER BY revision_number DESC LIMIT 1`,
      [roleCode]
    );

    const currentRevision = revisionResult?.revision_number || 1;

    if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
      // Stale revision - return current state
      const currentState = await dbGet(
        `SELECT current_stage FROM candidates WHERE id = ?`,
        [candidateId]
      );

      const capacity = await calculateVacancyCapacity(roleCode);

      return res.status(409).json({
        error: 'Stale revision',
        currentRevision,
        currentStage: currentState?.current_stage,
        capacity,
      });
    }

    // Validate stage transition
    if (!isValidStageTransition(candidate.current_stage, nextStage)) {
      return res.status(400).json({
        error: 'Invalid stage transition',
        from: candidate.current_stage,
        to: nextStage,
      });
    }

    // Special checks for moving to offer
    if (nextStage === 'offer') {
      const canOffer = await canTransitionToOffer(
        candidateId,
        candidate.assessment_version,
        roleCode
      );

      if (!canOffer.allowed) {
        return res.status(400).json({
          error: canOffer.reason,
          currentRevision,
        });
      }
    }

    // Update candidate stage
    const now = new Date().toISOString();

    // Check if moving to interview - increment assessment version
    let newAssessmentVersion = candidate.assessment_version;
    let versionChanged = false;

    if (nextStage === 'interview' && candidate.current_stage !== 'interview') {
      newAssessmentVersion = candidate.assessment_version + 1;
      versionChanged = true;
    }

    // Add to stage history
    await dbRun(
      `INSERT INTO stage_history (candidate_id, stage, timestamp)
       VALUES (?, ?, ?)`,
      [candidateId, nextStage, now]
    );

    // Update candidate
    await dbRun(
      `UPDATE candidates
       SET current_stage = ?, assessment_version = ?, updated_at = ?
       WHERE id = ?`,
      [nextStage, newAssessmentVersion, now, candidateId]
    );

    // Increment vacancy revision
    const newRevision = currentRevision + 1;
    await dbRun(
      `INSERT INTO vacancy_revisions (role_code, revision_number, changed_by, change_reason, changed_at)
       VALUES (?, ?, ?, ?, ?)`,
      [roleCode, newRevision, req.user.email, `Stage change: ${candidate.current_stage} -> ${nextStage}`, now]
    );

    // Record activity
    await dbRun(
      `INSERT INTO activity_trail (role_code, candidate_id, action_type, actor_email, action_data, assessment_version_at_action, assessment_version_changed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roleCode,
        candidateId,
        'stage_change',
        req.user.email,
        JSON.stringify({ from: candidate.current_stage, to: nextStage }),
        candidate.assessment_version,
        versionChanged ? 1 : 0,
        now,
      ]
    );

    const capacity = await calculateVacancyCapacity(roleCode);

    res.json({
      success: true,
      candidate: {
        id: candidateId,
        currentStage: nextStage,
        assessmentVersion: newAssessmentVersion,
      },
      revision: newRevision,
      capacity,
    });
  } catch (err) {
    console.error('Error moving candidate:', err);
    res.status(500).json({ error: 'Failed to move candidate' });
  }
});

// Add candidate
router.post('/api/vacancies/:roleCode/candidates', requireAuth, async (req, res) => {
  const { roleCode } = req.params;
  const { name } = req.body;

  // Check permissions
  const canAdd = await canAddCandidate(req.user.role);
  if (!canAdd) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Invalid candidate name' });
  }

  try {
    // Verify role exists
    const role = await dbGet(`SELECT * FROM roles WHERE code = ?`, [roleCode]);
    if (!role) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    // Check if candidate already exists for this role
    const existing = await dbGet(
      `SELECT id FROM candidates WHERE role_code = ? AND name = ?`,
      [roleCode, name]
    );

    if (existing) {
      return res.status(400).json({ error: 'Candidate already exists for this role' });
    }

    const candidateId = `CAND-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    // Create candidate
    await dbRun(
      `INSERT INTO candidates (id, role_code, name, current_stage, assessment_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [candidateId, roleCode, name, 'applied', 1, now, now]
    );

    // Add initial stage history
    await dbRun(
      `INSERT INTO stage_history (candidate_id, stage, timestamp)
       VALUES (?, ?, ?)`,
      [candidateId, 'applied', now]
    );

    // Get current revision and increment
    const revisionResult = await dbGet(
      `SELECT revision_number FROM vacancy_revisions
       WHERE role_code = ? ORDER BY revision_number DESC LIMIT 1`,
      [roleCode]
    );

    const currentRevision = revisionResult?.revision_number || 1;
    const newRevision = currentRevision + 1;

    await dbRun(
      `INSERT INTO vacancy_revisions (role_code, revision_number, changed_by, change_reason, changed_at)
       VALUES (?, ?, ?, ?, ?)`,
      [roleCode, newRevision, req.user.email, 'Candidate added', now]
    );

    // Record activity
    await dbRun(
      `INSERT INTO activity_trail (role_code, candidate_id, action_type, actor_email, action_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roleCode, candidateId, 'candidate_added', req.user.email, JSON.stringify({ name }), now]
    );

    res.json({
      success: true,
      candidate: {
        id: candidateId,
        name,
        currentStage: 'applied',
        assessmentVersion: 1,
      },
      revision: newRevision,
    });
  } catch (err) {
    console.error('Error adding candidate:', err);
    res.status(500).json({ error: 'Failed to add candidate' });
  }
});

export default router;
