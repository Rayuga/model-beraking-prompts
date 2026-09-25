const express = require('express');
const crypto = require('crypto');
const { FIXED_REFERENCE_MOMENT } = require('./db');
const {
  getCourseRevision,
  incrementCourseRevision,
  recordAuditEvent,
  isValidIsoDate
} = require('./utils');
const {
  authMiddleware,
  requireInstructor,
  requireStaff,
  handleLogin,
  handleLogout,
  handleMe
} = require('./auth');
const { checkIdempotencyAndRevision, sendAndRecord, saveReceipt } = require('./idempotency');
const { calculateStudentOutcomes } = require('./outcomes');

function createRouter(db) {
  const router = express.Router();

  // Helper to compute attempt expiry and check if expired
  function getAttemptExpiryInfo(attempt, assessment, studentId) {
    const acc = db.prepare('SELECT extra_time_minutes, deadline_extension_minutes FROM accommodations WHERE course_id = ? AND student_id = ?').get('BIO-214', studentId);
    const extraTime = acc ? acc.extra_time_minutes : 0;
    const deadlineExt = acc ? acc.deadline_extension_minutes : 0;

    const startedAtMs = new Date(attempt.started_at).getTime();
    const durationMs = (assessment.duration_minutes + extraTime) * 60 * 1000;
    const durationExpiryMs = startedAtMs + durationMs;

    const baseDueMs = new Date(assessment.due_at).getTime();
    const adjustedDueMs = baseDueMs + (deadlineExt * 60 * 1000);

    const expiryInstantMs = Math.min(durationExpiryMs, adjustedDueMs);
    const expiryDate = new Date(expiryInstantMs);
    const refMomentMs = new Date(FIXED_REFERENCE_MOMENT).getTime();

    const isExpired = refMomentMs >= expiryInstantMs;

    return {
      extraTimeMinutes: extraTime,
      deadlineExtensionMinutes: deadlineExt,
      adjustedDurationMinutes: assessment.duration_minutes + extraTime,
      adjustedDueAt: new Date(adjustedDueMs).toISOString(),
      expiresAt: expiryDate.toISOString(),
      isExpired
    };
  }

  // Helper to calculate objective score for an attempt
  function calculateObjectiveScore(attemptId, assessmentId) {
    const items = db.prepare('SELECT id, kind, points, answer FROM items WHERE assessment_id = ?').all(assessmentId);
    const answers = db.prepare('SELECT item_id, value FROM answers WHERE attempt_id = ?').all(attemptId);
    const answerMap = {};
    for (const ans of answers) {
      answerMap[ans.item_id] = ans.value;
    }

    let objScore = 0;
    let mcCount = 0;
    let writtenCount = 0;

    for (const it of items) {
      if (it.kind === 'multiple_choice') {
        mcCount++;
        const studentAns = answerMap[it.id];
        if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() === String(it.answer).trim()) {
          objScore += it.points;
        }
      } else if (it.kind === 'written') {
        writtenCount++;
      }
    }

    return {
      objectiveScore: objScore,
      mcCount,
      writtenCount
    };
  }

  // Helper to auto-submit if expired
  function autoSubmitIfExpired(attempt, actorUser = null) {
    if (attempt.status !== 'in_progress') return attempt;

    const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(attempt.assessment_id);
    if (!assessment) return attempt;

    const expiryInfo = getAttemptExpiryInfo(attempt, assessment, attempt.student_id);
    if (expiryInfo.isExpired) {
      const { objectiveScore, writtenCount } = calculateObjectiveScore(attempt.id, assessment.id);
      
      let newStatus = 'submitted';
      let rubricScore = null;
      if (writtenCount === 0) {
        newStatus = 'graded';
        rubricScore = 0;
      }

      db.prepare(`
        UPDATE attempts 
        SET status = ?, submitted_at = ?, objective_score = ?, rubric_score = ?
        WHERE id = ?
      `).run(newStatus, FIXED_REFERENCE_MOMENT, objectiveScore, rubricScore, attempt.id);

      recordAuditEvent(db, {
        timestamp: FIXED_REFERENCE_MOMENT,
        courseId: 'BIO-214',
        actorId: actorUser ? actorUser.id : attempt.student_id,
        action: 'attempt.auto_submitted',
        targetType: 'attempt',
        targetId: attempt.id,
        details: `Attempt ${attempt.id} auto-submitted upon expiration`,
        attemptId: attempt.id,
        assessmentId: attempt.assessment_id,
        studentId: attempt.student_id
      });

      incrementCourseRevision(db, 'BIO-214');

      return db.prepare('SELECT * FROM attempts WHERE id = ?').get(attempt.id);
    }
    return attempt;
  }

  // -------------------------------------------------------------
  // Public Health
  // -------------------------------------------------------------
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Coursemark',
      reference_moment: FIXED_REFERENCE_MOMENT,
      timestamp: FIXED_REFERENCE_MOMENT,
      version: '1.0.0'
    });
  });

  // -------------------------------------------------------------
  // Auth Endpoints
  // -------------------------------------------------------------
  router.post('/auth/login', (req, res) => handleLogin(db, req, res));
  router.post('/auth/logout', authMiddleware(db), (req, res) => handleLogout(db, req, res));
  router.get('/auth/me', authMiddleware(db), (req, res) => handleMe(db, req, res));

  // -------------------------------------------------------------
  // Courses
  // -------------------------------------------------------------
  router.get('/courses', authMiddleware(db), (req, res) => {
    const course = db.prepare('SELECT id, title, instructor_id, revision FROM courses WHERE id = ?').get('BIO-214');
    const enrollments = db.prepare(`
      SELECT e.user_id, e.kind, u.name, u.email, u.role
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE e.course_id = 'BIO-214'
      ORDER BY u.name ASC
    `).all();

    res.json({
      courses: [
        {
          id: course.id,
          title: course.title,
          instructor_id: course.instructor_id,
          revision: course.revision,
          enrollments
        }
      ]
    });
  });

  // -------------------------------------------------------------
  // Assessments
  // -------------------------------------------------------------
  router.get('/assessments', authMiddleware(db), (req, res) => {
    const isStaff = req.user.role === 'instructor' || req.user.role === 'teaching_assistant';
    
    let query = 'SELECT * FROM assessments WHERE course_id = ?';
    if (!isStaff) {
      query += " AND status = 'published'";
    }
    query += ' ORDER BY id ASC';

    const assessments = db.prepare(query).all('BIO-214');
    
    // Attach items count and total points
    const items = db.prepare('SELECT assessment_id, points FROM items').all();
    const itemsMap = {};
    for (const it of items) {
      if (!itemsMap[it.assessment_id]) {
        itemsMap[it.assessment_id] = { count: 0, total_points: 0 };
      }
      itemsMap[it.assessment_id].count++;
      itemsMap[it.assessment_id].total_points += it.points;
    }

    const weights = db.prepare('SELECT assessment_id, weight_percent FROM assessment_weights WHERE course_id = ?').all('BIO-214');
    const weightMap = {};
    for (const w of weights) {
      weightMap[w.assessment_id] = w.weight_percent;
    }

    // If student, check if they have active attempts or attempts used
    const studentAttempts = req.user.role === 'student' 
      ? db.prepare('SELECT id, assessment_id, status, feedback_status FROM attempts WHERE student_id = ?').all(req.user.id)
      : [];

    const attemptsByAssessment = {};
    for (const att of studentAttempts) {
      if (!attemptsByAssessment[att.assessment_id]) {
        attemptsByAssessment[att.assessment_id] = [];
      }
      attemptsByAssessment[att.assessment_id].push(att);
    }

    // Student accommodations
    let accommodation = null;
    if (req.user.role === 'student') {
      accommodation = db.prepare('SELECT extra_time_minutes, deadline_extension_minutes FROM accommodations WHERE course_id = ? AND student_id = ?').get('BIO-214', req.user.id);
    }

    const result = assessments.map(a => {
      const stats = itemsMap[a.id] || { count: 0, total_points: 0 };
      const out = {
        id: a.id,
        course_id: a.course_id,
        title: a.title,
        status: a.status,
        opens_at: a.opens_at,
        due_at: a.due_at,
        duration_minutes: a.duration_minutes,
        max_attempts: a.max_attempts,
        item_count: stats.count,
        total_points: stats.total_points,
        weight_percent: weightMap[a.id] !== undefined ? weightMap[a.id] : 0
      };

      if (req.user.role === 'student') {
        const myAttempts = attemptsByAssessment[a.id] || [];
        const extraTime = accommodation ? accommodation.extra_time_minutes : 0;
        const deadlineExt = accommodation ? accommodation.deadline_extension_minutes : 0;
        const adjustedDue = new Date(new Date(a.due_at).getTime() + (deadlineExt * 60 * 1000)).toISOString();
        const adjustedDuration = a.duration_minutes + extraTime;
        
        const refMs = new Date(FIXED_REFERENCE_MOMENT).getTime();
        const opensMs = new Date(a.opens_at).getTime();
        const dueMs = new Date(adjustedDue).getTime();

        const hasActiveAttempt = myAttempts.some(att => att.status === 'in_progress');
        const attemptsUsed = myAttempts.length;
        const canStart = a.status === 'published' &&
          refMs >= opensMs &&
          refMs <= dueMs &&
          attemptsUsed < a.max_attempts &&
          !hasActiveAttempt;

        out.student_info = {
          extra_time_minutes: extraTime,
          deadline_extension_minutes: deadlineExt,
          effective_due_at: adjustedDue,
          effective_duration_minutes: adjustedDuration,
          attempts_used: attemptsUsed,
          has_active_attempt: hasActiveAttempt,
          can_start: canStart,
          attempts: myAttempts.map(att => ({
            id: att.id,
            status: att.status,
            feedback_status: att.feedback_status
          }))
        };
      }

      return out;
    });

    res.json({ assessments: result });
  });

  router.get('/assessments/:id', authMiddleware(db), (req, res) => {
    const isStaff = req.user.role === 'instructor' || req.user.role === 'teaching_assistant';
    const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND course_id = ?').get(req.params.id, 'BIO-214');

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (!isStaff && assessment.status !== 'published') {
      return res.status(403).json({ error: 'Forbidden: Draft assessments are staff-only' });
    }

    const rawItems = db.prepare('SELECT * FROM items WHERE assessment_id = ? ORDER BY item_order ASC, id ASC').all(assessment.id);
    const rubrics = db.prepare(`
      SELECT rc.* 
      FROM rubric_criteria rc
      JOIN items i ON rc.item_id = i.id
      WHERE i.assessment_id = ?
      ORDER BY rc.criterion_order ASC, rc.id ASC
    `).all(assessment.id);

    const rubricsByItem = {};
    for (const r of rubrics) {
      if (!rubricsByItem[r.item_id]) {
        rubricsByItem[r.item_id] = [];
      }
      rubricsByItem[r.item_id].push({
        id: r.id,
        label: r.label,
        max_points: r.max_points
      });
    }

    const items = rawItems.map(it => {
      const itemObj = {
        id: it.id,
        assessment_id: it.assessment_id,
        kind: it.kind,
        prompt: it.prompt,
        options: it.options_json ? JSON.parse(it.options_json) : null,
        points: it.points,
        item_order: it.item_order,
        rubric_criteria: rubricsByItem[it.id] || []
      };

      // SECURITY & PRIVACY: Only staff get the stored answer key!
      if (isStaff) {
        itemObj.answer = it.answer;
      }

      return itemObj;
    });

    const weightRow = db.prepare('SELECT weight_percent FROM assessment_weights WHERE course_id = ? AND assessment_id = ?').get('BIO-214', assessment.id);

    res.json({
      assessment: {
        ...assessment,
        weight_percent: weightRow ? weightRow.weight_percent : 0,
        items
      }
    });
  });

  // Create Draft Assessment
  router.post('/assessments', authMiddleware(db), requireInstructor, (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    const { title, opens_at, due_at, duration_minutes, max_attempts } = req.body || {};

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      const err = { error: 'Assessment title is required' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    if (!isValidIsoDate(opens_at) || !isValidIsoDate(due_at)) {
      const err = { error: 'Opening and due times must be valid parseable ISO date strings' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    if (new Date(opens_at) >= new Date(due_at)) {
      const err = { error: 'Opening time must be strictly before due time' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const durationNum = Number(duration_minutes);
    if (typeof duration_minutes === 'boolean' || duration_minutes === null || isNaN(durationNum) || !Number.isSafeInteger(durationNum) || durationNum <= 0) {
      const err = { error: 'Duration must be a positive whole integer minute value' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const maxAttemptsNum = Number(max_attempts !== undefined ? max_attempts : 1);
    if (typeof max_attempts === 'boolean' || max_attempts === null || isNaN(maxAttemptsNum) || !Number.isSafeInteger(maxAttemptsNum) || maxAttemptsNum <= 0) {
      const err = { error: 'Max attempts must be a positive whole integer' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    // Generate next ID
    const count = db.prepare('SELECT COUNT(*) as count FROM assessments').get().count;
    const newId = `A-${String(count + 1).padStart(2, '0')}`;

    const insertStmt = db.prepare(`
      INSERT INTO assessments (id, course_id, title, status, opens_at, due_at, duration_minutes, max_attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      newId,
      'BIO-214',
      title.trim(),
      'draft',
      new Date(opens_at).toISOString(),
      new Date(due_at).toISOString(),
      durationNum,
      maxAttemptsNum
    );

    recordAuditEvent(db, {
      timestamp: FIXED_REFERENCE_MOMENT,
      courseId: 'BIO-214',
      actorId: req.user.id,
      action: 'assessment.created',
      targetType: 'assessment',
      targetId: newId,
      details: `Created draft assessment "${title.trim()}" (${newId})`,
      assessmentId: newId
    });

    const newRevision = incrementCourseRevision(db, 'BIO-214');

    const created = db.prepare('SELECT * FROM assessments WHERE id = ?').get(newId);
    return sendAndRecord(db, req, res, 201, { assessment: created, course_revision: newRevision }, idCheck);
  });

  // Add Item to Draft Assessment
  router.post('/assessments/:id/items', authMiddleware(db), requireInstructor, (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND course_id = ?').get(req.params.id, 'BIO-214');
    if (!assessment) {
      const err = { error: 'Assessment not found' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 404, err);
      return res.status(404).json(err);
    }

    if (assessment.status !== 'draft') {
      const err = { error: 'Cannot add questions to a published assessment' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const { kind, prompt, points, options, answer, rubric_criteria } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      const err = { error: 'Question prompt is required' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const pointsNum = Number(points);
    if (typeof points === 'boolean' || points === null || isNaN(pointsNum) || pointsNum <= 0) {
      const err = { error: 'Points must be a positive numeric value' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    let parsedOptions = null;
    let storedAnswer = null;
    let parsedCriteria = [];

    if (kind === 'multiple_choice') {
      if (!Array.isArray(options) || options.length < 2) {
        const err = { error: 'Multiple choice questions require at least two distinct options' };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }

      const trimmedOptions = options.map(o => (typeof o === 'string' ? o.trim() : ''));
      if (trimmedOptions.some(o => o.length === 0)) {
        const err = { error: 'All multiple choice options must be nonempty strings' };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }

      const uniqueSet = new Set(trimmedOptions);
      if (uniqueSet.size !== trimmedOptions.length) {
        const err = { error: 'Multiple choice options must be unique after trimming' };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }

      if (!answer || typeof answer !== 'string' || !uniqueSet.has(answer.trim())) {
        const err = { error: 'Answer key must match one of the multiple choice options' };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }

      parsedOptions = trimmedOptions;
      storedAnswer = answer.trim();
    } else if (kind === 'written') {
      if (!Array.isArray(rubric_criteria) || rubric_criteria.length === 0) {
        const err = { error: 'Written questions require at least one rubric criterion' };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }

      for (const rc of rubric_criteria) {
        if (!rc.label || typeof rc.label !== 'string' || rc.label.trim().length === 0) {
          const err = { error: 'Every rubric criterion requires a non-empty label' };
          saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
          return res.status(400).json(err);
        }
        const maxPts = Number(rc.max_points);
        if (typeof rc.max_points === 'boolean' || rc.max_points === null || isNaN(maxPts) || maxPts <= 0) {
          const err = { error: 'Every rubric criterion requires positive max points' };
          saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
          return res.status(400).json(err);
        }
        parsedCriteria.push({
          label: rc.label.trim(),
          max_points: maxPts
        });
      }
    } else {
      const err = { error: 'Invalid question kind: must be multiple_choice or written' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    // Insert Item and Rubrics atomically
    const allItemsCount = db.prepare('SELECT COUNT(*) as count FROM items').get().count;
    const itemId = `I-${String(allItemsCount + 1).padStart(2, '0')}`;
    const itemOrder = db.prepare('SELECT COUNT(*) as count FROM items WHERE assessment_id = ?').get(assessment.id).count;

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO items (id, assessment_id, kind, prompt, options_json, answer, points, item_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId,
        assessment.id,
        kind,
        prompt.trim(),
        parsedOptions ? JSON.stringify(parsedOptions) : null,
        storedAnswer,
        pointsNum,
        itemOrder
      );

      if (parsedCriteria.length > 0) {
        const rcCount = db.prepare('SELECT COUNT(*) as count FROM rubric_criteria').get().count;
        for (let i = 0; i < parsedCriteria.length; i++) {
          const rcId = `RC-${rcCount + 1 + i}`;
          db.prepare(`
            INSERT INTO rubric_criteria (id, item_id, label, max_points, criterion_order)
            VALUES (?, ?, ?, ?, ?)
          `).run(rcId, itemId, parsedCriteria[i].label, parsedCriteria[i].max_points, i);
        }
      }

      recordAuditEvent(db, {
        timestamp: FIXED_REFERENCE_MOMENT,
        courseId: 'BIO-214',
        actorId: req.user.id,
        action: 'item.added',
        targetType: 'item',
        targetId: itemId,
        details: `Added ${kind} question (${itemId}) to assessment ${assessment.id}`,
        assessmentId: assessment.id
      });

      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = insertTx();

    const createdItem = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
    const createdRubrics = db.prepare('SELECT * FROM rubric_criteria WHERE item_id = ?').all(itemId);

    return sendAndRecord(db, req, res, 201, {
      item: {
        ...createdItem,
        options: createdItem.options_json ? JSON.parse(createdItem.options_json) : null,
        rubric_criteria: createdRubrics
      },
      course_revision: newRevision
    }, idCheck);
  });

  // Publish Draft Assessment
  router.post('/assessments/:id/publish', authMiddleware(db), requireInstructor, (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND course_id = ?').get(req.params.id, 'BIO-214');
    if (!assessment) {
      const err = { error: 'Assessment not found' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 404, err);
      return res.status(404).json(err);
    }

    if (assessment.status !== 'draft') {
      const err = { error: 'Assessment is already published' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const itemCount = db.prepare('SELECT COUNT(*) as count FROM items WHERE assessment_id = ?').get(assessment.id).count;
    if (itemCount < 1) {
      const err = { error: 'Cannot publish an assessment with zero questions' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    if (assessment.duration_minutes <= 0) {
      const err = { error: 'Cannot publish an assessment without a positive duration' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const publishTx = db.transaction(() => {
      db.prepare("UPDATE assessments SET status = 'published' WHERE id = ?").run(assessment.id);

      // Add to assessment_weights at 0% if not present
      db.prepare(`
        INSERT OR IGNORE INTO assessment_weights (course_id, assessment_id, weight_percent)
        VALUES (?, ?, 0)
      `).run('BIO-214', assessment.id);

      recordAuditEvent(db, {
        timestamp: FIXED_REFERENCE_MOMENT,
        courseId: 'BIO-214',
        actorId: req.user.id,
        action: 'assessment.published',
        targetType: 'assessment',
        targetId: assessment.id,
        details: `Published assessment "${assessment.title}" (${assessment.id})`,
        assessmentId: assessment.id
      });

      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = publishTx();
    const updated = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessment.id);

    return sendAndRecord(db, req, res, 200, {
      assessment: updated,
      course_revision: newRevision
    }, idCheck);
  });

  // -------------------------------------------------------------
  // Attempts
  // -------------------------------------------------------------
  router.get('/attempts', authMiddleware(db), (req, res) => {
    let attempts;
    if (req.user.role === 'instructor') {
      attempts = db.prepare(`
        SELECT att.*, u.name as student_name, u.email as student_email, a.title as assessment_title,
               grader.name as assigned_grader_name
        FROM attempts att
        JOIN users u ON att.student_id = u.id
        JOIN assessments a ON att.assessment_id = a.id
        LEFT JOIN users grader ON att.assigned_grader_id = grader.id
        ORDER BY att.started_at DESC, att.id DESC
      `).all();
    } else if (req.user.role === 'teaching_assistant') {
      attempts = db.prepare(`
        SELECT att.*, u.name as student_name, u.email as student_email, a.title as assessment_title,
               grader.name as assigned_grader_name
        FROM attempts att
        JOIN users u ON att.student_id = u.id
        JOIN assessments a ON att.assessment_id = a.id
        LEFT JOIN users grader ON att.assigned_grader_id = grader.id
        WHERE att.assigned_grader_id = ?
        ORDER BY att.started_at DESC, att.id DESC
      `).all(req.user.id);
    } else {
      // Student: only their own attempts
      attempts = db.prepare(`
        SELECT att.*, u.name as student_name, u.email as student_email, a.title as assessment_title
        FROM attempts att
        JOIN users u ON att.student_id = u.id
        JOIN assessments a ON att.assessment_id = a.id
        WHERE att.student_id = ?
        ORDER BY att.started_at DESC, att.id DESC
      `).all(req.user.id);

      // PRIVACY FOR STUDENT: If feedback_status !== 'released', hide unreleased scores
      attempts = attempts.map(att => {
        // Auto submit if expired
        const updatedAtt = autoSubmitIfExpired(att, req.user);
        if (updatedAtt.feedback_status !== 'released') {
          return {
            ...updatedAtt,
            objective_score: null,
            rubric_score: null,
            total_score: null
          };
        }
        return {
          ...updatedAtt,
          total_score: (updatedAtt.objective_score || 0) + (updatedAtt.rubric_score || 0)
        };
      });
    }

    // If staff, compute total_score and check expired in_progress
    if (req.user.role !== 'student') {
      attempts = attempts.map(att => {
        const updatedAtt = autoSubmitIfExpired(att, req.user);
        const obj = updatedAtt.objective_score;
        const rub = updatedAtt.rubric_score;
        const total = (obj !== null || rub !== null) ? ((obj || 0) + (rub || 0)) : null;
        return {
          ...updatedAtt,
          total_score: total
        };
      });
    }

    res.json({ attempts });
  });

  router.get('/attempts/:id', authMiddleware(db), (req, res) => {
    let attempt = db.prepare(`
      SELECT att.*, u.name as student_name, u.email as student_email, a.title as assessment_title,
             a.opens_at, a.due_at, a.duration_minutes, grader.name as assigned_grader_name
      FROM attempts att
      JOIN users u ON att.student_id = u.id
      JOIN assessments a ON att.assessment_id = a.id
      LEFT JOIN users grader ON att.assigned_grader_id = grader.id
      WHERE att.id = ?
    `).get(req.params.id);

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Access control
    if (req.user.role === 'student' && attempt.student_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only view your own attempts' });
    }
    if (req.user.role === 'teaching_assistant' && attempt.assigned_grader_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only view assigned attempts' });
    }

    // Auto-submit if expired
    attempt = autoSubmitIfExpired(attempt, req.user);

    const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(attempt.assessment_id);
    const expiryInfo = getAttemptExpiryInfo(attempt, assessment, attempt.student_id);

    const items = db.prepare('SELECT * FROM items WHERE assessment_id = ? ORDER BY item_order ASC, id ASC').all(attempt.assessment_id);
    const answers = db.prepare('SELECT * FROM answers WHERE attempt_id = ?').all(attempt.id);
    const answerMap = {};
    for (const ans of answers) {
      answerMap[ans.item_id] = ans.value;
    }

    const rubrics = db.prepare(`
      SELECT rc.* 
      FROM rubric_criteria rc
      JOIN items i ON rc.item_id = i.id
      WHERE i.assessment_id = ?
      ORDER BY rc.criterion_order ASC, rc.id ASC
    `).all(attempt.assessment_id);

    const rubricGrades = db.prepare('SELECT * FROM rubric_grades WHERE attempt_id = ?').all(attempt.id);
    const gradesMap = {};
    for (const rg of rubricGrades) {
      gradesMap[rg.criterion_id] = rg;
    }

    const isStaff = req.user.role === 'instructor' || req.user.role === 'teaching_assistant';
    const isReleased = attempt.feedback_status === 'released';

    const rubricsByItem = {};
    for (const r of rubrics) {
      if (!rubricsByItem[r.item_id]) {
        rubricsByItem[r.item_id] = [];
      }
      const grade = gradesMap[r.id];
      const rubricObj = {
        id: r.id,
        label: r.label,
        max_points: r.max_points
      };

      if (isStaff || isReleased) {
        rubricObj.grade = grade ? {
          score: grade.score,
          feedback: grade.feedback,
          graded_by: grade.graded_by,
          graded_at: grade.graded_at
        } : null;
      } else {
        rubricObj.grade = null;
      }

      rubricsByItem[r.item_id].push(rubricObj);
    }

    const itemDetails = items.map(it => {
      const itObj = {
        id: it.id,
        kind: it.kind,
        prompt: it.prompt,
        options: it.options_json ? JSON.parse(it.options_json) : null,
        points: it.points,
        student_answer: answerMap[it.id] !== undefined ? answerMap[it.id] : null,
        rubric_criteria: rubricsByItem[it.id] || []
      };

      if (isStaff) {
        itObj.answer = it.answer; // staff gets key
      }

      return itObj;
    });

    const responseAttempt = {
      ...attempt,
      expiry_info: expiryInfo,
      items: itemDetails
    };

    if (!isStaff && !isReleased) {
      responseAttempt.objective_score = null;
      responseAttempt.rubric_score = null;
      responseAttempt.total_score = null;
    } else {
      const obj = responseAttempt.objective_score;
      const rub = responseAttempt.rubric_score;
      responseAttempt.total_score = (obj !== null || rub !== null) ? ((obj || 0) + (rub || 0)) : null;
    }

    res.json({ attempt: responseAttempt });
  });

  // Start new attempt
  router.post('/attempts/start', authMiddleware(db), (req, res) => {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can start attempts' });
    }

    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    const { assessment_id } = req.body || {};
    if (!assessment_id) {
      const err = { error: 'assessment_id is required' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND course_id = ?').get(assessment_id, 'BIO-214');
    if (!assessment || assessment.status !== 'published') {
      const err = { error: 'Assessment is not available or not published' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const acc = db.prepare('SELECT extra_time_minutes, deadline_extension_minutes FROM accommodations WHERE course_id = ? AND student_id = ?').get('BIO-214', req.user.id);
    const deadlineExt = acc ? acc.deadline_extension_minutes : 0;
    const adjustedDueMs = new Date(assessment.due_at).getTime() + (deadlineExt * 60 * 1000);
    const refMomentMs = new Date(FIXED_REFERENCE_MOMENT).getTime();
    const opensMs = new Date(assessment.opens_at).getTime();

    if (refMomentMs < opensMs) {
      const err = { error: 'Assessment is not open yet' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    if (refMomentMs > adjustedDueMs) {
      const err = { error: 'Assessment due date has passed' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const existingAttempts = db.prepare('SELECT * FROM attempts WHERE assessment_id = ? AND student_id = ?').all(assessment.id, req.user.id);
    if (existingAttempts.length >= assessment.max_attempts) {
      const err = { error: 'Attempt limit reached for this assessment' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const activeAttempt = existingAttempts.find(a => a.status === 'in_progress');
    if (activeAttempt) {
      // Check if expired
      const checked = autoSubmitIfExpired(activeAttempt, req.user);
      if (checked.status === 'in_progress') {
        const err = { error: 'You already have an active attempt in progress' };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }
    }

    // Generate Attempt ID
    const count = db.prepare('SELECT COUNT(*) as count FROM attempts').get().count;
    const attemptId = `AT-${100 + count}`;

    const startTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO attempts (id, assessment_id, student_id, status, started_at, assigned_grader_id, feedback_status)
        VALUES (?, ?, ?, 'in_progress', ?, 'user_2', 'hidden')
      `).run(attemptId, assessment.id, req.user.id, FIXED_REFERENCE_MOMENT);

      recordAuditEvent(db, {
        timestamp: FIXED_REFERENCE_MOMENT,
        courseId: 'BIO-214',
        actorId: req.user.id,
        action: 'attempt.started',
        targetType: 'attempt',
        targetId: attemptId,
        details: `Started attempt ${attemptId} for assessment "${assessment.title}"`,
        attemptId,
        assessmentId: assessment.id,
        studentId: req.user.id
      });

      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = startTx();
    const createdAttempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);

    return sendAndRecord(db, req, res, 201, {
      attempt: createdAttempt,
      course_revision: newRevision
    }, idCheck);
  });

  // Save Answers (in progress)
  router.post('/attempts/:id/answers', authMiddleware(db), (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    let attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(req.params.id);
    if (!attempt) {
      const err = { error: 'Attempt not found' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 404, err);
      return res.status(404).json(err);
    }

    if (attempt.student_id !== req.user.id) {
      const err = { error: 'Forbidden: You can only save answers to your own attempt' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 403, err);
      return res.status(403).json(err);
    }

    // Check expiry
    attempt = autoSubmitIfExpired(attempt, req.user);
    if (attempt.status !== 'in_progress') {
      const err = { error: 'Attempt has ended or expired and cannot accept answer writes' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const { answers } = req.body || {};
    if (!Array.isArray(answers)) {
      const err = { error: 'answers must be an array of { item_id, value } objects' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    // Validate item IDs belong to assessment
    const validItems = db.prepare('SELECT id FROM items WHERE assessment_id = ?').all(attempt.assessment_id);
    const validItemIds = new Set(validItems.map(i => i.id));

    for (const ans of answers) {
      if (!ans || !ans.item_id || !validItemIds.has(ans.item_id)) {
        const err = { error: `Invalid item_id: ${ans ? ans.item_id : 'missing'} does not belong to this assessment` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }
    }

    const saveTx = db.transaction(() => {
      const upsertAnswer = db.prepare(`
        INSERT INTO answers (attempt_id, item_id, value)
        VALUES (?, ?, ?)
        ON CONFLICT(attempt_id, item_id) DO UPDATE SET value = excluded.value
      `);

      for (const ans of answers) {
        upsertAnswer.run(attempt.id, ans.item_id, ans.value !== null && ans.value !== undefined ? String(ans.value) : '');
      }

      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = saveTx();

    return sendAndRecord(db, req, res, 200, {
      success: true,
      saved_count: answers.length,
      course_revision: newRevision
    }, idCheck);
  });

  // Submit Attempt
  router.post('/attempts/:id/submit', authMiddleware(db), (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    let attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(req.params.id);
    if (!attempt) {
      const err = { error: 'Attempt not found' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 404, err);
      return res.status(404).json(err);
    }

    if (attempt.student_id !== req.user.id) {
      const err = { error: 'Forbidden: You can only submit your own attempt' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 403, err);
      return res.status(403).json(err);
    }

    if (attempt.status !== 'in_progress') {
      const err = { error: 'Attempt has already been submitted' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(attempt.assessment_id);
    const expiryInfo = getAttemptExpiryInfo(attempt, assessment, attempt.student_id);
    const isAutoSubmit = expiryInfo.isExpired;

    const { objectiveScore, writtenCount } = calculateObjectiveScore(attempt.id, assessment.id);
    let newStatus = 'submitted';
    let rubricScore = null;
    if (writtenCount === 0) {
      newStatus = 'graded';
      rubricScore = 0;
    }

    const submitTx = db.transaction(() => {
      db.prepare(`
        UPDATE attempts 
        SET status = ?, submitted_at = ?, objective_score = ?, rubric_score = ?
        WHERE id = ?
      `).run(newStatus, FIXED_REFERENCE_MOMENT, objectiveScore, rubricScore, attempt.id);

      recordAuditEvent(db, {
        timestamp: FIXED_REFERENCE_MOMENT,
        courseId: 'BIO-214',
        actorId: req.user.id,
        action: isAutoSubmit ? 'attempt.auto_submitted' : 'attempt.submitted',
        targetType: 'attempt',
        targetId: attempt.id,
        details: isAutoSubmit
          ? `Attempt ${attempt.id} auto-submitted upon expiration`
          : `Attempt ${attempt.id} submitted by ${req.user.name}`,
        attemptId: attempt.id,
        assessmentId: attempt.assessment_id,
        studentId: req.user.id
      });

      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = submitTx();
    const updatedAttempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attempt.id);

    return sendAndRecord(db, req, res, 200, {
      attempt: {
        id: updatedAttempt.id,
        assessment_id: updatedAttempt.assessment_id,
        student_id: updatedAttempt.student_id,
        status: updatedAttempt.status,
        submitted_at: updatedAttempt.submitted_at,
        feedback_status: updatedAttempt.feedback_status
      },
      course_revision: newRevision
    }, idCheck);
  });

  // -------------------------------------------------------------
  // Grading Endpoints
  // -------------------------------------------------------------
  router.post('/grading/rubric', authMiddleware(db), requireStaff, (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    const { attempt_id, criterion_id, score, feedback } = req.body || {};

    const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attempt_id);
    if (!attempt) {
      const err = { error: 'Attempt not found' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 404, err);
      return res.status(404).json(err);
    }

    // Role authorization
    if (req.user.role === 'teaching_assistant' && attempt.assigned_grader_id !== req.user.id) {
      const err = { error: 'Forbidden: TA can only grade assigned attempts' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 403, err);
      return res.status(403).json(err);
    }

    if (attempt.status === 'in_progress') {
      const err = { error: 'Cannot grade an attempt that is still in progress' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    if (attempt.feedback_status === 'released') {
      const err = { error: 'Cannot modify grades for an already released attempt' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    // Check criterion
    const criterion = db.prepare(`
      SELECT rc.*, i.assessment_id
      FROM rubric_criteria rc
      JOIN items i ON rc.item_id = i.id
      WHERE rc.id = ?
    `).get(criterion_id);

    if (!criterion || criterion.assessment_id !== attempt.assessment_id) {
      const err = { error: 'Rubric criterion not found or does not belong to this assessment' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const scoreNum = Number(score);
    if (typeof score === 'boolean' || score === null || isNaN(scoreNum) || scoreNum < 0 || scoreNum > criterion.max_points) {
      const err = { error: `Score must be a number between 0 and ${criterion.max_points}` };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const gradeTx = db.transaction(() => {
      // Upsert rubric grade
      db.prepare(`
        INSERT INTO rubric_grades (attempt_id, criterion_id, score, feedback, graded_by, graded_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(attempt_id, criterion_id) DO UPDATE SET
          score = excluded.score,
          feedback = excluded.feedback,
          graded_by = excluded.graded_by,
          graded_at = excluded.graded_at
      `).run(
        attempt.id,
        criterion.id,
        scoreNum,
        feedback !== undefined && feedback !== null ? String(feedback).trim() : null,
        req.user.id,
        FIXED_REFERENCE_MOMENT
      );

      // Check all criteria for assessment
      const allCriteria = db.prepare(`
        SELECT rc.id
        FROM rubric_criteria rc
        JOIN items i ON rc.item_id = i.id
        WHERE i.assessment_id = ?
      `).all(attempt.assessment_id);

      const allGrades = db.prepare('SELECT score FROM rubric_grades WHERE attempt_id = ?').all(attempt.id);
      const isComplete = allCriteria.length > 0 && allGrades.length >= allCriteria.length;
      const totalRubricScore = allGrades.reduce((sum, g) => sum + g.score, 0);

      const newStatus = isComplete ? 'graded' : 'submitted';

      db.prepare(`
        UPDATE attempts
        SET status = ?, rubric_score = ?
        WHERE id = ?
      `).run(newStatus, totalRubricScore, attempt.id);

      recordAuditEvent(db, {
        timestamp: FIXED_REFERENCE_MOMENT,
        courseId: 'BIO-214',
        actorId: req.user.id,
        action: 'grade.saved',
        targetType: 'rubric_grade',
        targetId: criterion.id,
        details: `Saved rubric grade on attempt ${attempt.id}`,
        attemptId: attempt.id,
        assessmentId: attempt.assessment_id,
        studentId: attempt.student_id
      });

      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = gradeTx();
    const updatedAttempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attempt.id);

    return sendAndRecord(db, req, res, 200, {
      attempt: updatedAttempt,
      course_revision: newRevision
    }, idCheck);
  });

  // Atomic Grading Worksheet
  router.post('/grading/worksheet', authMiddleware(db), requireStaff, (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      const err = { error: 'Worksheet requires a non-empty array of rows' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    // Check for duplicate rows
    const seenPairs = new Set();
    for (const r of rows) {
      if (!r || !r.attempt_id || !r.criterion_id) {
        const err = { error: 'Every worksheet row must have attempt_id and criterion_id' };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }
      const pairKey = `${r.attempt_id}_${r.criterion_id}`;
      if (seenPairs.has(pairKey)) {
        const err = { error: `Duplicate row for attempt ${r.attempt_id} and criterion ${r.criterion_id}` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }
      seenPairs.add(pairKey);
    }

    // Pre-validate all attempts and criteria
    const attemptIds = Array.from(new Set(rows.map(r => r.attempt_id)));
    const attemptsMap = {};
    for (const attId of attemptIds) {
      const att = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attId);
      if (!att) {
        const err = { error: `Attempt ${attId} not found` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 404, err);
        return res.status(404).json(err);
      }
      if (req.user.role === 'teaching_assistant' && att.assigned_grader_id !== req.user.id) {
        const err = { error: `Forbidden: TA cannot grade attempt ${attId}` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 403, err);
        return res.status(403).json(err);
      }
      if (att.status === 'in_progress') {
        const err = { error: `Cannot grade attempt ${attId} while in progress` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }
      if (att.feedback_status === 'released') {
        const err = { error: `Attempt ${attId} is already released and immutable` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }
      attemptsMap[attId] = att;
    }

    // Pre-validate criteria & scores
    const validatedRows = [];
    for (const r of rows) {
      const att = attemptsMap[r.attempt_id];
      const criterion = db.prepare(`
        SELECT rc.*, i.assessment_id
        FROM rubric_criteria rc
        JOIN items i ON rc.item_id = i.id
        WHERE rc.id = ?
      `).get(r.criterion_id);

      if (!criterion || criterion.assessment_id !== att.assessment_id) {
        const err = { error: `Criterion ${r.criterion_id} does not belong to assessment for attempt ${att.id}` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }

      const scoreNum = Number(r.score);
      if (typeof r.score === 'boolean' || r.score === null || isNaN(scoreNum) || scoreNum < 0 || scoreNum > criterion.max_points) {
        const err = { error: `Invalid score ${r.score} for criterion ${r.criterion_id}: must be between 0 and ${criterion.max_points}` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }

      validatedRows.push({
        attempt_id: r.attempt_id,
        criterion_id: r.criterion_id,
        score: scoreNum,
        feedback: r.feedback !== undefined && r.feedback !== null ? String(r.feedback).trim() : null
      });
    }

    const worksheetTx = db.transaction(() => {
      const upsertGrade = db.prepare(`
        INSERT INTO rubric_grades (attempt_id, criterion_id, score, feedback, graded_by, graded_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(attempt_id, criterion_id) DO UPDATE SET
          score = excluded.score,
          feedback = excluded.feedback,
          graded_by = excluded.graded_by,
          graded_at = excluded.graded_at
      `);

      for (const vr of validatedRows) {
        upsertGrade.run(vr.attempt_id, vr.criterion_id, vr.score, vr.feedback, req.user.id, FIXED_REFERENCE_MOMENT);
      }

      // Update each distinct attempt status & scores
      for (const attId of attemptIds) {
        const att = attemptsMap[attId];
        const allCriteria = db.prepare(`
          SELECT rc.id
          FROM rubric_criteria rc
          JOIN items i ON rc.item_id = i.id
          WHERE i.assessment_id = ?
        `).all(att.assessment_id);

        const allGrades = db.prepare('SELECT score FROM rubric_grades WHERE attempt_id = ?').all(attId);
        const isComplete = allCriteria.length > 0 && allGrades.length >= allCriteria.length;
        const totalRubricScore = allGrades.reduce((sum, g) => sum + g.score, 0);
        const newStatus = isComplete ? 'graded' : 'submitted';

        db.prepare(`
          UPDATE attempts
          SET status = ?, rubric_score = ?
          WHERE id = ?
        `).run(newStatus, totalRubricScore, attId);

        recordAuditEvent(db, {
          timestamp: FIXED_REFERENCE_MOMENT,
          courseId: 'BIO-214',
          actorId: req.user.id,
          action: 'grade.saved',
          targetType: 'attempt',
          targetId: attId,
          details: `Saved worksheet grading for attempt ${attId}`,
          attemptId: attId,
          assessmentId: att.assessment_id,
          studentId: att.student_id
        });
      }

      // Exactly ONE revision increment for the entire accepted worksheet
      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = worksheetTx();

    return sendAndRecord(db, req, res, 200, {
      success: true,
      saved_rows_count: validatedRows.length,
      affected_attempts_count: attemptIds.length,
      course_revision: newRevision
    }, idCheck);
  });

  // -------------------------------------------------------------
  // Release Endpoints
  // -------------------------------------------------------------
  router.post('/release/single', authMiddleware(db), requireInstructor, (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    const { attempt_id } = req.body || {};
    const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attempt_id);

    if (!attempt) {
      const err = { error: 'Attempt not found' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 404, err);
      return res.status(404).json(err);
    }

    if (attempt.status !== 'graded') {
      const err = { error: 'Attempt is not fully graded yet' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    if (attempt.feedback_status === 'released') {
      const err = { error: 'Attempt has already been released' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const releaseTx = db.transaction(() => {
      db.prepare("UPDATE attempts SET feedback_status = 'released' WHERE id = ?").run(attempt.id);

      recordAuditEvent(db, {
        timestamp: FIXED_REFERENCE_MOMENT,
        courseId: 'BIO-214',
        actorId: req.user.id,
        action: 'attempt.released',
        targetType: 'attempt',
        targetId: attempt.id,
        details: `Released grades and feedback for attempt ${attempt.id}`,
        attemptId: attempt.id,
        assessmentId: attempt.assessment_id,
        studentId: attempt.student_id
      });

      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = releaseTx();
    const updated = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attempt.id);

    return sendAndRecord(db, req, res, 200, {
      attempt: updated,
      course_revision: newRevision
    }, idCheck);
  });

  // Batch Release: Step 1 Preview
  router.post('/release/preview', authMiddleware(db), requireInstructor, (req, res) => {
    const { attempt_ids } = req.body || {};
    if (!Array.isArray(attempt_ids) || attempt_ids.length === 0) {
      return res.status(400).json({ error: 'attempt_ids must be a non-empty array' });
    }

    const uniqueIds = Array.from(new Set(attempt_ids));
    if (uniqueIds.length !== attempt_ids.length) {
      return res.status(400).json({ error: 'Duplicate attempt IDs in selection' });
    }

    const currentRevision = getCourseRevision(db, 'BIO-214');
    const itemsPreview = [];

    for (const attId of uniqueIds) {
      const attempt = db.prepare(`
        SELECT att.*, u.name as student_name, u.email as student_email, a.title as assessment_title
        FROM attempts att
        JOIN users u ON att.student_id = u.id
        JOIN assessments a ON att.assessment_id = a.id
        WHERE att.id = ? AND a.course_id = 'BIO-214'
      `).get(attId);

      if (!attempt) {
        return res.status(404).json({ error: `Attempt ${attId} not found in this course` });
      }

      if (attempt.status !== 'graded') {
        return res.status(400).json({ error: `Attempt ${attId} is not fully graded` });
      }

      if (attempt.feedback_status === 'released') {
        return res.status(400).json({ error: `Attempt ${attId} is already released` });
      }

      // Calculate max score
      const maxPts = db.prepare('SELECT SUM(points) as total FROM items WHERE assessment_id = ?').get(attempt.assessment_id).total || 0;
      const totalScore = (attempt.objective_score || 0) + (attempt.rubric_score || 0);

      itemsPreview.push({
        attempt_id: attempt.id,
        student_id: attempt.student_id,
        student_name: attempt.student_name,
        student_email: attempt.student_email,
        assessment_id: attempt.assessment_id,
        assessment_title: attempt.assessment_title,
        objective_score: attempt.objective_score,
        rubric_score: attempt.rubric_score,
        total_score: totalScore,
        max_score: maxPts
      });
    }

    const previewId = 'prev_' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO batch_release_previews (id, course_id, instructor_id, created_revision, attempt_ids_json, created_at, consumed)
      VALUES (?, 'BIO-214', ?, ?, ?, ?, 0)
    `).run(
      previewId,
      req.user.id,
      currentRevision,
      JSON.stringify(uniqueIds),
      FIXED_REFERENCE_MOMENT
    );

    return res.json({
      preview_id: previewId,
      created_revision: currentRevision,
      items: itemsPreview
    });
  });

  // Batch Release: Step 2 Commit
  router.post('/release/commit', authMiddleware(db), requireInstructor, (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    const { preview_id } = req.body || {};
    if (!preview_id || typeof preview_id !== 'string') {
      const err = { error: 'preview_id is required' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const preview = db.prepare('SELECT * FROM batch_release_previews WHERE id = ?').get(preview_id);
    if (!preview) {
      const err = { error: 'Preview not found' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 404, err);
      return res.status(404).json(err);
    }

    if (preview.instructor_id !== req.user.id) {
      const err = { error: 'Preview belongs to another instructor' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 403, err);
      return res.status(403).json(err);
    }

    if (preview.consumed === 1) {
      const err = { error: 'This release preview has already been committed and cannot be reused' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    // Check if course revision changed since preview was created
    const currentRevision = getCourseRevision(db, 'BIO-214');
    if (currentRevision !== preview.created_revision) {
      const err = {
        error: 'Preview is stale: course revision changed since preview was generated. Please create a new preview.',
        preview_revision: preview.created_revision,
        current_revision: currentRevision
      };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 409, err);
      return res.status(409).json(err);
    }

    const attemptIds = JSON.parse(preview.attempt_ids_json);

    const commitTx = db.transaction(() => {
      // Mark preview consumed
      db.prepare('UPDATE batch_release_previews SET consumed = 1 WHERE id = ?').run(preview.id);

      const releaseStmt = db.prepare("UPDATE attempts SET feedback_status = 'released' WHERE id = ?");

      for (const attId of attemptIds) {
        const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attId);
        releaseStmt.run(attId);

        recordAuditEvent(db, {
          timestamp: FIXED_REFERENCE_MOMENT,
          courseId: 'BIO-214',
          actorId: req.user.id,
          action: 'attempt.released',
          targetType: 'attempt',
          targetId: attId,
          details: `Batch released attempt ${attId}`,
          attemptId: attId,
          assessmentId: attempt ? attempt.assessment_id : null,
          studentId: attempt ? attempt.student_id : null
        });
      }

      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = commitTx();

    return sendAndRecord(db, req, res, 200, {
      success: true,
      released_count: attemptIds.length,
      released_attempt_ids: attemptIds,
      course_revision: newRevision
    }, idCheck);
  });

  // -------------------------------------------------------------
  // Outcome Ledger & Policy & Exceptions
  // -------------------------------------------------------------
  router.get('/outcomes', authMiddleware(db), (req, res) => {
    if (req.user.role === 'teaching_assistant') {
      return res.status(403).json({ error: 'Forbidden: Teaching assistants cannot access the outcome ledger' });
    }

    if (req.user.role === 'student') {
      const studentOutcomes = calculateStudentOutcomes(db, req.user.id);
      return res.json(studentOutcomes);
    }

    // Instructor: all students
    const outcomes = calculateStudentOutcomes(db);
    res.json(outcomes);
  });

  // Policy update
  router.post('/policy', authMiddleware(db), requireInstructor, (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    const { weights } = req.body || {};
    if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
      const err = { error: 'weights must be an object mapping published assessment IDs to percentage weights' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const published = db.prepare("SELECT id FROM assessments WHERE course_id = 'BIO-214' AND status = 'published'").all();
    const publishedIds = new Set(published.map(a => a.id));

    const weightKeys = Object.keys(weights);
    if (weightKeys.length !== publishedIds.size) {
      const err = { error: `Policy must include all ${publishedIds.size} published assessments exactly once` };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    let sum = 0;
    const parsedWeights = {};

    for (const id of publishedIds) {
      if (weights[id] === undefined) {
        const err = { error: `Missing weight for published assessment ${id}` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }

      const val = weights[id];
      const num = Number(val);
      if (typeof val === 'boolean' || val === null || isNaN(num) || num < 0 || num > 100) {
        const err = { error: `Invalid weight for ${id}: must be a non-negative number <= 100` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }

      // Check at most 2 decimal places
      const strVal = String(num);
      const dotIndex = strVal.indexOf('.');
      if (dotIndex !== -1 && strVal.length - dotIndex - 1 > 2) {
        const err = { error: `Weight for ${id} cannot have more than 2 decimal places` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }

      sum += num;
      parsedWeights[id] = num;
    }

    // Check unknown keys
    for (const k of weightKeys) {
      if (!publishedIds.has(k)) {
        const err = { error: `Unknown or draft assessment ID in weights: ${k}` };
        saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
        return res.status(400).json(err);
      }
    }

    if (Math.abs(sum - 100) > 0.0001) {
      const err = { error: `Total percentage must equal exactly 100% (current sum: ${sum.toFixed(2)}%)` };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const policyTx = db.transaction(() => {
      const upsertWeight = db.prepare(`
        INSERT INTO assessment_weights (course_id, assessment_id, weight_percent)
        VALUES ('BIO-214', ?, ?)
        ON CONFLICT(course_id, assessment_id) DO UPDATE SET weight_percent = excluded.weight_percent
      `);

      for (const [aId, wt] of Object.entries(parsedWeights)) {
        upsertWeight.run(aId, wt);
      }

      recordAuditEvent(db, {
        timestamp: FIXED_REFERENCE_MOMENT,
        courseId: 'BIO-214',
        actorId: req.user.id,
        action: 'policy.updated',
        targetType: 'course',
        targetId: 'BIO-214',
        details: `Updated assessment outcome weighting policy (${JSON.stringify(parsedWeights)})`
      });

      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = policyTx();

    return sendAndRecord(db, req, res, 200, {
      weights: parsedWeights,
      course_revision: newRevision
    }, idCheck);
  });

  // Student Exception update
  router.post('/exceptions', authMiddleware(db), requireInstructor, (req, res) => {
    const idCheck = checkIdempotencyAndRevision(db, req, res);
    if (idCheck.error || idCheck.replay) return;

    const { student_id, assessment_id, excused, reason } = req.body || {};

    const enrollment = db.prepare("SELECT * FROM enrollments WHERE course_id = 'BIO-214' AND user_id = ? AND kind = 'student'").get(student_id);
    if (!enrollment) {
      const err = { error: 'Student not enrolled in course' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 404, err);
      return res.status(404).json(err);
    }

    const assessment = db.prepare("SELECT * FROM assessments WHERE course_id = 'BIO-214' AND id = ? AND status = 'published'").get(assessment_id);
    if (!assessment) {
      const err = { error: 'Assessment not found or not published' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 404, err);
      return res.status(404).json(err);
    }

    const isExcused = !!excused;
    if (isExcused && (!reason || typeof reason !== 'string' || reason.trim().length === 0)) {
      const err = { error: 'A required reason must be provided when excusing an assessment' };
      saveReceipt(db, req.user.id, idCheck.operationId, req.method, req.path, idCheck.inputHash, 400, err);
      return res.status(400).json(err);
    }

    const exTx = db.transaction(() => {
      if (isExcused) {
        db.prepare(`
          INSERT INTO student_exceptions (course_id, student_id, assessment_id, excused, reason, updated_at)
          VALUES ('BIO-214', ?, ?, 1, ?, ?)
          ON CONFLICT(course_id, student_id, assessment_id) DO UPDATE SET
            excused = 1,
            reason = excluded.reason,
            updated_at = excluded.updated_at
        `).run(student_id, assessment_id, reason.trim(), FIXED_REFERENCE_MOMENT);
      } else {
        db.prepare(`
          DELETE FROM student_exceptions 
          WHERE course_id = 'BIO-214' AND student_id = ? AND assessment_id = ?
        `).run(student_id, assessment_id);
      }

      recordAuditEvent(db, {
        timestamp: FIXED_REFERENCE_MOMENT,
        courseId: 'BIO-214',
        actorId: req.user.id,
        action: 'exception.updated',
        targetType: 'exception',
        targetId: `${student_id}_${assessment_id}`,
        details: isExcused 
          ? `Excused assessment ${assessment_id} for student ${student_id}: ${reason.trim()}`
          : `Restored assessment ${assessment_id} for student ${student_id}`,
        assessmentId: assessment_id,
        studentId: student_id
      });

      return incrementCourseRevision(db, 'BIO-214');
    });

    const newRevision = exTx();

    return sendAndRecord(db, req, res, 200, {
      student_id,
      assessment_id,
      excused: isExcused,
      reason: isExcused ? reason.trim() : null,
      course_revision: newRevision
    }, idCheck);
  });

  // -------------------------------------------------------------
  // Audit Log
  // -------------------------------------------------------------
  router.get('/audit', authMiddleware(db), (req, res) => {
    let events;

    if (req.user.role === 'instructor') {
      events = db.prepare(`
        SELECT a.*, u.name as actor_name, u.role as actor_role
        FROM audit_events a
        LEFT JOIN users u ON a.actor_id = u.id
        WHERE a.course_id = 'BIO-214'
        ORDER BY a.id DESC
      `).all();
    } else if (req.user.role === 'teaching_assistant') {
      events = db.prepare(`
        SELECT a.*, u.name as actor_name, u.role as actor_role
        FROM audit_events a
        LEFT JOIN users u ON a.actor_id = u.id
        LEFT JOIN attempts att ON a.attempt_id = att.id
        WHERE a.course_id = 'BIO-214' AND (
          a.actor_id = ? OR att.assigned_grader_id = ?
        )
        ORDER BY a.id DESC
      `).all(req.user.id, req.user.id);
    } else {
      // Student: only events for their own attempts / account
      events = db.prepare(`
        SELECT a.id, a.timestamp, a.course_id, a.action, a.target_type, a.target_id, a.details, a.attempt_id, a.assessment_id, a.student_id
        FROM audit_events a
        WHERE a.course_id = 'BIO-214' AND a.student_id = ?
        ORDER BY a.id DESC
      `).all(req.user.id);
    }

    res.json({ events });
  });

  return router;
}

module.exports = {
  createRouter
};
