import express from 'express';
import { requireAuth } from './auth.js';
import { dbGet, dbAll, dbRun } from './database.js';
import {
  canRemovePanelMember,
  canScoreCandidate,
  validatePanelAddition,
  validateScore,
  canAddPanelAtStage,
  isPanelEligible,
  getCompletePanelWithScores,
} from './hiring-rules.js';

const router = express.Router();

// Get panel for candidate
router.get('/api/candidates/:candidateId/panel', requireAuth, async (req, res) => {
  const { candidateId } = req.params;

  try {
    const candidate = await dbGet(
      `SELECT * FROM candidates WHERE id = ?`,
      [candidateId]
    );

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const panel = await dbGet(
      `SELECT id FROM panels
       WHERE candidate_id = ? AND assessment_version = ?`,
      [candidateId, candidate.assessment_version]
    );

    if (!panel) {
      res.json({
        panel: null,
        assessmentVersion: candidate.assessment_version,
      });
      return;
    }

    const members = await dbAll(
      `SELECT pm.id, pm.email, u.name, pm.added_at
       FROM panel_members pm
       JOIN users u ON pm.email = u.email
       WHERE pm.panel_id = ?`,
      [panel.id]
    );

    const scores = await dbAll(
      `SELECT panel_member_email, score, recorded_at
       FROM scores
       WHERE candidate_id = ? AND assessment_version = ?`,
      [candidateId, candidate.assessment_version]
    );

    const memberScores = members.map((m) => {
      const score = scores.find((s) => s.panel_member_email === m.email);
      return {
        id: m.id,
        email: m.email,
        name: m.name,
        addedAt: m.added_at,
        score: score?.score || null,
        scoredAt: score?.recorded_at || null,
      };
    });

    res.json({
      panel: {
        id: panel.id,
        members: memberScores,
      },
      assessmentVersion: candidate.assessment_version,
      canEdit: ['applied', 'screening', 'interview'].includes(candidate.current_stage),
    });
  } catch (err) {
    console.error('Error fetching panel:', err);
    res.status(500).json({ error: 'Failed to fetch panel' });
  }
});

// Add panel member
router.post(
  '/api/candidates/:candidateId/panel/add',
  requireAuth,
  async (req, res) => {
    const { candidateId } = req.params;
    const { memberEmail, expectedRevision } = req.body;

    // Check permissions
    if (req.user.role !== 'coordinator') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!memberEmail || typeof memberEmail !== 'string') {
      return res.status(400).json({ error: 'Invalid member email' });
    }

    try {
      const candidate = await dbGet(
        `SELECT * FROM candidates WHERE id = ?`,
        [candidateId]
      );

      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      // Validate panel addition
      const validation = await validatePanelAddition(
        candidateId,
        memberEmail,
        candidate.assessment_version
      );

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Check if member is eligible
      if (!(await isPanelEligible(memberEmail))) {
        return res.status(400).json({ error: 'Panel member not eligible' });
      }

      const now = new Date().toISOString();

      // Get or create panel for this assessment version
      let panel = await dbGet(
        `SELECT id FROM panels
         WHERE candidate_id = ? AND assessment_version = ?`,
        [candidateId, candidate.assessment_version]
      );

      if (!panel) {
        const result = await dbRun(
          `INSERT INTO panels (candidate_id, assessment_version, created_at)
           VALUES (?, ?, ?)`,
          [candidateId, candidate.assessment_version, now]
        );
        panel = { id: result.id };
      }

      // Add member
      await dbRun(
        `INSERT INTO panel_members (panel_id, email, added_at)
         VALUES (?, ?, ?)`,
        [panel.id, memberEmail, now]
      );

      // Increment assessment version for panel change
      const newVersion = candidate.assessment_version + 1;

      await dbRun(
        `UPDATE candidates
         SET assessment_version = ?, updated_at = ?
         WHERE id = ?`,
        [newVersion, now, candidateId]
      );

      // Increment vacancy revision
      const revisionResult = await dbGet(
        `SELECT revision_number FROM vacancy_revisions
         WHERE role_code = ? ORDER BY revision_number DESC LIMIT 1`,
        [candidate.role_code]
      );

      const currentRevision = revisionResult?.revision_number || 1;
      const newRevision = currentRevision + 1;

      await dbRun(
        `INSERT INTO vacancy_revisions (role_code, revision_number, changed_by, change_reason, changed_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          candidate.role_code,
          newRevision,
          req.user.email,
          'Panel member added',
          now,
        ]
      );

      // Record activity
      await dbRun(
        `INSERT INTO activity_trail (role_code, candidate_id, action_type, actor_email, action_data, assessment_version_at_action, assessment_version_changed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          candidate.role_code,
          candidateId,
          'panel_member_added',
          req.user.email,
          JSON.stringify({ memberEmail }),
          candidate.assessment_version,
          1,
          now,
        ]
      );

      res.json({
        success: true,
        assessmentVersion: newVersion,
        revision: newRevision,
      });
    } catch (err) {
      console.error('Error adding panel member:', err);
      res.status(500).json({ error: 'Failed to add panel member' });
    }
  }
);

// Remove panel member
router.post(
  '/api/candidates/:candidateId/panel/remove',
  requireAuth,
  async (req, res) => {
    const { candidateId } = req.params;
    const { memberId, expectedRevision } = req.body;

    // Check permissions
    if (req.user.role !== 'coordinator') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!memberId) {
      return res.status(400).json({ error: 'Invalid member ID' });
    }

    try {
      const candidate = await dbGet(
        `SELECT * FROM candidates WHERE id = ?`,
        [candidateId]
      );

      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      if (!(await canAddPanelAtStage(candidate.current_stage))) {
        return res.status(400).json({
          error: 'Cannot modify panel at this stage',
        });
      }

      // Get member
      const member = await dbGet(
        `SELECT * FROM panel_members WHERE id = ?`,
        [memberId]
      );

      if (!member) {
        return res.status(404).json({ error: 'Panel member not found' });
      }

      // Remove member
      await dbRun(`DELETE FROM panel_members WHERE id = ?`, [memberId]);

      const now = new Date().toISOString();

      // Increment assessment version for panel change
      const newVersion = candidate.assessment_version + 1;

      await dbRun(
        `UPDATE candidates
         SET assessment_version = ?, updated_at = ?
         WHERE id = ?`,
        [newVersion, now, candidateId]
      );

      // Increment vacancy revision
      const revisionResult = await dbGet(
        `SELECT revision_number FROM vacancy_revisions
         WHERE role_code = ? ORDER BY revision_number DESC LIMIT 1`,
        [candidate.role_code]
      );

      const currentRevision = revisionResult?.revision_number || 1;
      const newRevision = currentRevision + 1;

      await dbRun(
        `INSERT INTO vacancy_revisions (role_code, revision_number, changed_by, change_reason, changed_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          candidate.role_code,
          newRevision,
          req.user.email,
          'Panel member removed',
          now,
        ]
      );

      // Record activity
      await dbRun(
        `INSERT INTO activity_trail (role_code, candidate_id, action_type, actor_email, action_data, assessment_version_at_action, assessment_version_changed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          candidate.role_code,
          candidateId,
          'panel_member_removed',
          req.user.email,
          JSON.stringify({ memberEmail: member.email }),
          candidate.assessment_version,
          1,
          now,
        ]
      );

      res.json({
        success: true,
        assessmentVersion: newVersion,
        revision: newRevision,
      });
    } catch (err) {
      console.error('Error removing panel member:', err);
      res.status(500).json({ error: 'Failed to remove panel member' });
    }
  }
);

// Record score
router.post('/api/candidates/:candidateId/score', requireAuth, async (req, res) => {
  const { candidateId } = req.params;
  const { score } = req.body;

  // Check permissions
  const canScore = await canScoreCandidate(req.user.role);
  if (!canScore) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const candidate = await dbGet(
      `SELECT * FROM candidates WHERE id = ?`,
      [candidateId]
    );

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Validate score
    const validation = await validateScore(
      score,
      candidateId,
      candidate.current_stage,
      req.user.email
    );

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check if user is on panel
    const panelMember = await dbGet(
      `SELECT pm.id FROM panel_members pm
       JOIN panels p ON pm.panel_id = p.id
       WHERE p.candidate_id = ? AND p.assessment_version = ? AND pm.email = ?`,
      [candidateId, candidate.assessment_version, req.user.email]
    );

    if (!panelMember) {
      return res.status(403).json({ error: 'Not assigned to this candidate' });
    }

    const now = new Date().toISOString();

    // Insert or update score
    await dbRun(
      `INSERT OR REPLACE INTO scores (candidate_id, assessment_version, panel_member_email, score, recorded_at)
       VALUES (?, ?, ?, ?, ?)`,
      [candidateId, candidate.assessment_version, req.user.email, score, now]
    );

    // Record activity
    await dbRun(
      `INSERT INTO activity_trail (role_code, candidate_id, action_type, actor_email, action_data, assessment_version_at_action, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        candidate.role_code,
        candidateId,
        'score_recorded',
        req.user.email,
        JSON.stringify({ score }),
        candidate.assessment_version,
        now,
      ]
    );

    // Increment vacancy revision
    const revisionResult = await dbGet(
      `SELECT revision_number FROM vacancy_revisions
       WHERE role_code = ? ORDER BY revision_number DESC LIMIT 1`,
      [candidate.role_code]
    );

    const currentRevision = revisionResult?.revision_number || 1;
    const newRevision = currentRevision + 1;

    await dbRun(
      `INSERT INTO vacancy_revisions (role_code, revision_number, changed_by, change_reason, changed_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        candidate.role_code,
        newRevision,
        req.user.email,
        'Score recorded',
        now,
      ]
    );

    res.json({
      success: true,
      score,
      revision: newRevision,
    });
  } catch (err) {
    console.error('Error recording score:', err);
    res.status(500).json({ error: 'Failed to record score' });
  }
});

export default router;
