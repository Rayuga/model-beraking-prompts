import express from 'express';
import crypto from 'crypto';
import { requireAuth } from './auth.js';
import { dbGet, dbAll, dbRun } from './database.js';
import {
  canBatchOffer,
  calculateVacancyCapacity,
  getCompletePanelWithScores,
} from './hiring-rules.js';

const router = express.Router();

// Add note
router.post('/api/candidates/:candidateId/note', requireAuth, async (req, res) => {
  const { candidateId } = req.params;
  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Invalid note content' });
  }

  try {
    const candidate = await dbGet(
      `SELECT * FROM candidates WHERE id = ?`,
      [candidateId]
    );

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO notes (candidate_id, author_email, content, created_at)
       VALUES (?, ?, ?, ?)`,
      [candidateId, req.user.email, content, now]
    );

    // Record activity
    await dbRun(
      `INSERT INTO activity_trail (role_code, candidate_id, action_type, actor_email, action_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        candidate.role_code,
        candidateId,
        'note_added',
        req.user.email,
        JSON.stringify({ length: content.length }),
        now,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error adding note:', err);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Get notes for candidate
router.get('/api/candidates/:candidateId/notes', requireAuth, async (req, res) => {
  const { candidateId } = req.params;

  try {
    const candidate = await dbGet(
      `SELECT * FROM candidates WHERE id = ?`,
      [candidateId]
    );

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const notes = await dbAll(
      `SELECT n.id, n.content, n.author_email, u.name as author_name, n.created_at
       FROM notes n
       JOIN users u ON n.author_email = u.email
       WHERE n.candidate_id = ? ORDER BY n.created_at ASC`,
      [candidateId]
    );

    res.json({ notes });
  } catch (err) {
    console.error('Error fetching notes:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Batch offer operations
router.post('/api/vacancies/:roleCode/batch-offer/preview', requireAuth, async (req, res) => {
  const { roleCode } = req.params;
  const { candidateIds, expectedRevision } = req.body;

  // Check permissions
  const canBatch = await canBatchOffer(req.user.role);
  if (!canBatch) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Validate input
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return res.status(400).json({ error: 'Invalid candidate selection' });
  }

  // Check for duplicates
  if (new Set(candidateIds).size !== candidateIds.length) {
    return res.status(400).json({ error: 'Duplicate candidate IDs' });
  }

  try {
    const role = await dbGet(`SELECT * FROM roles WHERE code = ?`, [roleCode]);
    if (!role) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    const revisionResult = await dbGet(
      `SELECT revision_number FROM vacancy_revisions
       WHERE role_code = ? ORDER BY revision_number DESC LIMIT 1`,
      [roleCode]
    );

    const currentRevision = revisionResult?.revision_number || 1;

    if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
      return res.status(409).json({
        error: 'Stale revision',
        currentRevision,
      });
    }

    // Get candidate details
    const candidates = await Promise.all(
      candidateIds.map(async (id) => {
        const candidate = await dbGet(
          `SELECT * FROM candidates WHERE id = ? AND role_code = ?`,
          [id, roleCode]
        );

        if (!candidate) {
          return { id, error: 'Candidate not found' };
        }

        if (candidate.current_stage !== 'interview') {
          return {
            id,
            name: candidate.name,
            error: 'Candidate is not at interview stage',
            currentStage: candidate.current_stage,
          };
        }

        const complete = await getCompletePanelWithScores(
          id,
          candidate.assessment_version
        );

        if (!complete) {
          return {
            id,
            name: candidate.name,
            error: 'Incomplete assessment',
            assessmentVersion: candidate.assessment_version,
          };
        }

        return {
          id,
          name: candidate.name,
          assessmentVersion: candidate.assessment_version,
          eligible: true,
        };
      })
    );

    const capacity = await calculateVacancyCapacity(roleCode);
    const eligible = candidates.filter((c) => c.eligible);

    if (eligible.length !== candidateIds.length) {
      return res.status(400).json({
        error: 'Some candidates ineligible',
        candidates,
        capacity,
      });
    }

    if (capacity.available < eligible.length) {
      return res.status(400).json({
        error: 'Insufficient capacity',
        candidates,
        capacity,
        neededOpenings: eligible.length,
      });
    }

    res.json({
      selection: {
        candidateIds,
        count: eligible.length,
        candidates: eligible,
      },
      revision: currentRevision,
      capacity: {
        current: capacity,
        projected: {
          filled: capacity.filled,
          reserved: capacity.reserved + eligible.length,
          available: capacity.available - eligible.length,
        },
      },
    });
  } catch (err) {
    console.error('Error previewing batch offer:', err);
    res.status(500).json({ error: 'Failed to preview batch offer' });
  }
});

// Commit batch offer
router.post(
  '/api/vacancies/:roleCode/batch-offer/commit',
  requireAuth,
  async (req, res) => {
    const { roleCode } = req.params;
    const { candidateIds, operationId, expectedRevision } = req.body;

    // Check permissions
    const canBatch = await canBatchOffer(req.user.role);
    if (!canBatch) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Validate input
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ error: 'Invalid candidate selection' });
    }

    if (!operationId || typeof operationId !== 'string') {
      return res.status(400).json({ error: 'Invalid operation ID' });
    }

    // Check for duplicates
    if (new Set(candidateIds).size !== candidateIds.length) {
      return res.status(400).json({ error: 'Duplicate candidate IDs' });
    }

    try {
      // Check for existing receipt
      const existingReceipt = await dbGet(
        `SELECT * FROM operation_receipts
         WHERE operation_id = ? AND actor_email = ?`,
        [operationId, req.user.email]
      );

      if (existingReceipt) {
        const response = JSON.parse(existingReceipt.response_data);
        return res.status(existingReceipt.status === 'success' ? 200 : 400).json(response);
      }

      const role = await dbGet(`SELECT * FROM roles WHERE code = ?`, [roleCode]);
      if (!role) {
        return res.status(404).json({ error: 'Vacancy not found' });
      }

      const revisionResult = await dbGet(
        `SELECT revision_number FROM vacancy_revisions
         WHERE role_code = ? ORDER BY revision_number DESC LIMIT 1`,
        [roleCode]
      );

      const currentRevision = revisionResult?.revision_number || 1;

      if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
        // Stale revision
        const responseData = {
          error: 'Stale revision',
          currentRevision,
        };

        await dbRun(
          `INSERT INTO operation_receipts (operation_id, actor_email, role_code, operation_type, status, request_data, response_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            operationId,
            req.user.email,
            roleCode,
            'batch_offer',
            'rejected',
            JSON.stringify({ candidateIds, expectedRevision }),
            JSON.stringify(responseData),
            new Date().toISOString(),
          ]
        );

        return res.status(409).json(responseData);
      }

      // Validate all candidates
      const candidates = await Promise.all(
        candidateIds.map(async (id) => {
          const candidate = await dbGet(
            `SELECT * FROM candidates WHERE id = ? AND role_code = ?`,
            [id, roleCode]
          );

          if (!candidate) {
            return { id, valid: false, error: 'Not found' };
          }

          if (candidate.current_stage !== 'interview') {
            return { id, valid: false, error: 'Not at interview stage' };
          }

          const complete = await getCompletePanelWithScores(
            id,
            candidate.assessment_version
          );

          return {
            id,
            valid: !!complete,
            error: complete ? null : 'Incomplete assessment',
            candidate,
          };
        })
      );

      const invalid = candidates.filter((c) => !c.valid);
      if (invalid.length > 0) {
        const responseData = {
          error: 'Some candidates ineligible',
          ineligible: invalid,
        };

        await dbRun(
          `INSERT INTO operation_receipts (operation_id, actor_email, role_code, operation_type, status, request_data, response_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            operationId,
            req.user.email,
            roleCode,
            'batch_offer',
            'rejected',
            JSON.stringify({ candidateIds, expectedRevision }),
            JSON.stringify(responseData),
            new Date().toISOString(),
          ]
        );

        return res.status(400).json(responseData);
      }

      // Check capacity
      const capacity = await calculateVacancyCapacity(roleCode);
      if (capacity.available < candidateIds.length) {
        const responseData = {
          error: 'Insufficient capacity',
          available: capacity.available,
          needed: candidateIds.length,
        };

        await dbRun(
          `INSERT INTO operation_receipts (operation_id, actor_email, role_code, operation_type, status, request_data, response_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            operationId,
            req.user.email,
            roleCode,
            'batch_offer',
            'rejected',
            JSON.stringify({ candidateIds, expectedRevision }),
            JSON.stringify(responseData),
            new Date().toISOString(),
          ]
        );

        return res.status(400).json(responseData);
      }

      // All valid - commit batch
      const now = new Date().toISOString();
      const batchId = crypto.randomBytes(8).toString('hex');

      const activity = [];

      for (let i = 0; i < candidateIds.length; i++) {
        const candidateData = candidates.find((c) => c.id === candidateIds[i]);
        const candidate = candidateData.candidate;

        // Add to stage history
        await dbRun(
          `INSERT INTO stage_history (candidate_id, stage, timestamp)
           VALUES (?, ?, ?)`,
          [candidateIds[i], 'offer', now]
        );

        // Update stage
        await dbRun(
          `UPDATE candidates SET current_stage = ?, updated_at = ? WHERE id = ?`,
          [candidateIds[i], now, 'offer']
        );

        // Record activity
        await dbRun(
          `INSERT INTO activity_trail (role_code, candidate_id, action_type, actor_email, action_data, batch_id, batch_position, batch_total, assessment_version_at_action, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            roleCode,
            candidateIds[i],
            'batch_offer',
            req.user.email,
            JSON.stringify({ offer: true }),
            batchId,
            i + 1,
            candidateIds.length,
            candidate.assessment_version,
            now,
          ]
        );

        activity.push({
          candidateId: candidateIds[i],
          position: i + 1,
          total: candidateIds.length,
        });
      }

      // Increment vacancy revision
      const newRevision = currentRevision + 1;
      await dbRun(
        `INSERT INTO vacancy_revisions (role_code, revision_number, changed_by, change_reason, changed_at)
         VALUES (?, ?, ?, ?, ?)`,
        [roleCode, newRevision, req.user.email, 'Batch offer committed', now]
      );

      const responseData = {
        success: true,
        batchId,
        count: candidateIds.length,
        offers: candidateIds.map((id) => ({ candidateId: id, stage: 'offer' })),
        revision: newRevision,
      };

      // Save receipt
      await dbRun(
        `INSERT INTO operation_receipts (operation_id, actor_email, role_code, operation_type, status, request_data, response_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          operationId,
          req.user.email,
          roleCode,
          'batch_offer',
          'success',
          JSON.stringify({ candidateIds, expectedRevision }),
          JSON.stringify(responseData),
          now,
        ]
      );

      res.json(responseData);
    } catch (err) {
      console.error('Error committing batch offer:', err);
      res.status(500).json({ error: 'Failed to commit batch offer' });
    }
  }
);

export default router;
