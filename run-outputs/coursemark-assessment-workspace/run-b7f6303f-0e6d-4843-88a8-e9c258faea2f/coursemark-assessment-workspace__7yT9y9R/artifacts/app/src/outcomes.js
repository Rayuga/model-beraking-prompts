function calculateStudentOutcomes(db, targetStudentId = null) {
  // Get all enrolled students
  let studentsQuery = `
    SELECT u.id, u.name, u.email
    FROM users u
    JOIN enrollments e ON u.id = e.user_id
    WHERE e.course_id = 'BIO-214' AND e.kind = 'student'
  `;
  const params = [];
  if (targetStudentId) {
    studentsQuery += ' AND u.id = ?';
    params.push(targetStudentId);
  }
  studentsQuery += ' ORDER BY u.name ASC';

  const students = db.prepare(studentsQuery).all(...params);

  // Get all published assessments
  const publishedAssessments = db.prepare(`
    SELECT a.id, a.title, a.status, a.opens_at, a.due_at, a.duration_minutes, a.max_attempts
    FROM assessments a
    WHERE a.course_id = 'BIO-214' AND a.status = 'published'
    ORDER BY a.id ASC
  `).all();

  // Get items to calculate maximum points for each assessment
  const items = db.prepare(`
    SELECT id, assessment_id, points
    FROM items
  `).all();

  const maxPointsMap = {};
  for (const a of publishedAssessments) {
    maxPointsMap[a.id] = 0;
  }
  for (const it of items) {
    if (maxPointsMap[it.assessment_id] !== undefined) {
      maxPointsMap[it.assessment_id] += it.points;
    }
  }

  // Get policy weights
  const weightsRows = db.prepare(`
    SELECT assessment_id, weight_percent
    FROM assessment_weights
    WHERE course_id = 'BIO-214'
  `).all();
  const weightsMap = {};
  for (const w of weightsRows) {
    weightsMap[w.assessment_id] = w.weight_percent;
  }

  // Get exceptions
  const exceptionsRows = db.prepare(`
    SELECT student_id, assessment_id, excused, reason
    FROM student_exceptions
    WHERE course_id = 'BIO-214'
  `).all();
  const exceptionsMap = {};
  for (const ex of exceptionsRows) {
    exceptionsMap[`${ex.student_id}_${ex.assessment_id}`] = ex;
  }

  // Get all attempts
  const allAttempts = db.prepare(`
    SELECT id, assessment_id, student_id, status, started_at, submitted_at, feedback_status, objective_score, rubric_score
    FROM attempts
    ORDER BY started_at DESC, id DESC
  `).all();

  // Map most recent attempt for (student_id, assessment_id)
  const mostRecentAttemptMap = {};
  for (const att of allAttempts) {
    const key = `${att.student_id}_${att.assessment_id}`;
    if (!mostRecentAttemptMap[key]) {
      mostRecentAttemptMap[key] = att;
    }
  }

  // Build outcomes ledger for each student
  const ledger = students.map(student => {
    const assessmentCells = publishedAssessments.map(assessment => {
      const weight = weightsMap[assessment.id] !== undefined ? weightsMap[assessment.id] : 0;
      const maxPoints = maxPointsMap[assessment.id] || 0;
      const exKey = `${student.id}_${assessment.id}`;
      const exception = exceptionsMap[exKey];
      const isExcused = !!(exception && exception.excused === 1);
      const attempt = mostRecentAttemptMap[exKey];

      let state = 'missing'; // 'missing', 'pending', 'released', 'excused', 'unweighted'
      let awardedPoints = null;
      let attemptId = attempt ? attempt.id : null;
      let attemptStatus = attempt ? attempt.status : null;
      let feedbackStatus = attempt ? attempt.feedback_status : null;

      if (isExcused) {
        state = 'excused';
      } else if (weight === 0) {
        state = 'unweighted';
        if (attempt && attempt.feedback_status === 'released') {
          awardedPoints = (attempt.objective_score || 0) + (attempt.rubric_score || 0);
        }
      } else if (!attempt) {
        state = 'missing';
      } else if (attempt.feedback_status === 'released') {
        state = 'released';
        awardedPoints = (attempt.objective_score || 0) + (attempt.rubric_score || 0);
      } else {
        state = 'pending';
      }

      return {
        assessment_id: assessment.id,
        assessment_title: assessment.title,
        weight,
        max_points: maxPoints,
        state,
        excused: isExcused,
        excuse_reason: isExcused ? exception.reason : null,
        attempt_id: attemptId,
        attempt_status: attemptStatus,
        feedback_status: feedbackStatus,
        awarded_points: awardedPoints
      };
    });

    // Compute final outcome
    const included = assessmentCells.filter(c => !c.excused && c.weight > 0);
    let finalPercentage = null;
    let finalStatus = 'unavailable'; // 'calculated', 'pending', 'unavailable'
    let explanation = '';

    if (included.length === 0) {
      finalStatus = 'unavailable';
      explanation = 'No weighted assessments included in grade calculation';
    } else {
      const hasMissing = included.some(c => c.state === 'missing');
      const hasPending = included.some(c => c.state === 'pending');

      if (hasMissing || hasPending) {
        finalStatus = 'pending';
        const pendingNames = included.filter(c => c.state === 'missing' || c.state === 'pending').map(c => c.assessment_title);
        explanation = `Final grade pending: awaiting completion or release of ${pendingNames.join(', ')}`;
      } else {
        // All included are released
        let sumWeights = 0;
        let sumWeightedScores = 0;

        for (const c of included) {
          sumWeights += c.weight;
          const ratio = c.max_points > 0 ? (c.awarded_points / c.max_points) : 0;
          sumWeightedScores += c.weight * ratio;
        }

        if (sumWeights > 0) {
          finalPercentage = Number((100 * sumWeightedScores / sumWeights).toFixed(2));
          finalStatus = 'calculated';
          explanation = `Calculated from ${included.length} released assessment(s) totaling ${sumWeights.toFixed(2)}% included weight`;
        } else {
          finalStatus = 'unavailable';
          explanation = 'Total included weight is zero';
        }
      }
    }

    return {
      student_id: student.id,
      name: student.name,
      email: student.email,
      assessments: assessmentCells,
      final_percentage: finalPercentage,
      final_status: finalStatus,
      explanation
    };
  });

  return {
    assessments: publishedAssessments.map(a => ({
      id: a.id,
      title: a.title,
      weight: weightsMap[a.id] !== undefined ? weightsMap[a.id] : 0,
      max_points: maxPointsMap[a.id] || 0
    })),
    policy_weights: weightsMap,
    ledger
  };
}

module.exports = {
  calculateStudentOutcomes
};
