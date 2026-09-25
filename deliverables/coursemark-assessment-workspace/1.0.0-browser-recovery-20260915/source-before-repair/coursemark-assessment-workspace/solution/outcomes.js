module.exports = function installOutcomes({app, db, requireUser, performMutation, sendMutation, httpError, numeric, cleanText, currentRevision, referenceNow, audit, attemptView, courseVisible, id}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS outcome_weights (assessment_id TEXT PRIMARY KEY REFERENCES assessments(id), basis_points INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS outcome_exceptions (student_id TEXT NOT NULL REFERENCES users(id), assessment_id TEXT NOT NULL REFERENCES assessments(id), reason TEXT NOT NULL, PRIMARY KEY(student_id, assessment_id));
    CREATE TABLE IF NOT EXISTS release_plans (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), revision INTEGER NOT NULL, attempt_ids TEXT NOT NULL, consumed INTEGER NOT NULL DEFAULT 0);
  `);
  if (!db.prepare("SELECT 1 FROM settings WHERE key='outcomes_initialized'").get()) db.transaction(() => {
    for (const [assessment, weight] of [["A-01",4000],["A-03",4000],["A-04",2000]]) db.prepare("INSERT OR IGNORE INTO outcome_weights VALUES (?, ?)").run(assessment, weight);
    db.prepare("INSERT INTO settings VALUES ('outcomes_initialized','1')").run();
  })();

  function instructor(user) {
    if (user.role !== "instructor" || !courseVisible("BIO-214", user)) throw httpError(403, "Only the course instructor can do this.");
  }
  function published() {
    return db.prepare("SELECT a.*, COALESCE(w.basis_points,0) AS basis_points, (SELECT COALESCE(SUM(points),0) FROM items WHERE assessment_id=a.id) AS maximum FROM assessments a LEFT JOIN outcome_weights w ON a.id=w.assessment_id WHERE a.course_id='BIO-214' AND a.status='published' ORDER BY a.id").all();
  }
  function ledger(user) {
    if (!["instructor","student"].includes(user.role) || !courseVisible("BIO-214", user)) throw httpError(403, "The outcome ledger is available to the instructor and its individual students.");
    const assessments = published();
    const students = db.prepare("SELECT u.id,u.name,u.email FROM users u JOIN enrollments e ON e.user_id=u.id WHERE e.course_id='BIO-214' AND e.kind='student' ORDER BY u.name").all().filter(u => user.role === "instructor" || u.id === user.id);
    return {revision: currentRevision(), assessments: assessments.map(a => ({id:a.id,title:a.title,weight:a.basis_points/100,maximum:a.maximum})), rows:students.map(student => {
      let denominator=0, numerator=0, complete=true;
      const cells=assessments.map(a => {
        const attempt=db.prepare("SELECT * FROM attempts WHERE assessment_id=? AND student_id=? ORDER BY rowid DESC LIMIT 1").get(a.id,student.id);
        const exception=db.prepare("SELECT reason FROM outcome_exceptions WHERE student_id=? AND assessment_id=?").get(student.id,a.id);
        const released=attempt?.feedback_status === "released";
        const awarded=attempt && (released || user.role === "instructor") && attempt.status === "graded" ? Number(attempt.objective_score || 0)+Number(attempt.rubric_score || 0) : null;
        const state=exception ? "excused" : !a.basis_points ? "unweighted" : !attempt ? "missing" : released ? "released" : "pending";
        if (a.basis_points && !exception) {
          denominator+=a.basis_points;
          if (!released) complete=false;
          else numerator+=awarded/a.maximum*a.basis_points;
        }
        return {assessment_id:a.id,state,reason:exception?.reason || "",awarded,maximum:a.maximum,weight:a.basis_points/100};
      });
      return {student,cells,included_weight:denominator/100,complete:complete && denominator>0,final_percentage:complete && denominator>0 ? Math.round((numerator/denominator*100+Number.EPSILON)*100)/100 : null};
    })};
  }
  app.get("/api/outcomes", requireUser, (req,res) => res.json(ledger(req.user)));
  app.put("/api/outcome-weights", requireUser, (req,res) => sendMutation(res,performMutation(req,{execute:() => {
    instructor(req.user);
    const rows=req.body.weights, assessments=published();
    if (!Array.isArray(rows) || rows.length !== assessments.length || new Set(rows.map(r=>r?.assessment_id)).size !== rows.length) throw httpError(400,"Provide each published assessment exactly once.");
    const checked=rows.map(r => {
      const value=numeric(r?.weight), bp=Math.round(value*100);
      if (!assessments.some(a=>a.id===r?.assessment_id) || !Number.isFinite(value) || value<0 || value>100 || Math.abs(value*100-bp)>0.000001 || Object.keys(r).some(k=>!["assessment_id","weight"].includes(k))) throw httpError(400,"Weights must be percentages with at most two decimal places.");
      return [r.assessment_id,bp];
    });
    if (checked.reduce((sum,r)=>sum+r[1],0)!==10000) throw httpError(400,"Assessment weights must total exactly 100%.");
    for (const row of checked) db.prepare("INSERT INTO outcome_weights VALUES (?,?) ON CONFLICT(assessment_id) DO UPDATE SET basis_points=excluded.basis_points").run(...row);
    audit(req.user.id,"weights_updated","course","BIO-214","Updated assessment weights");
    return {saved:true};
  }})));
  app.put("/api/outcome-exceptions", requireUser, (req,res) => sendMutation(res,performMutation(req,{execute:() => {
    instructor(req.user);
    const {student_id,assessment_id,excused}=req.body;
    const reason=cleanText(req.body.reason,300);
    if (typeof student_id!=="string" || typeof assessment_id!=="string" || typeof excused!=="boolean" || !published().some(a=>a.id===assessment_id) || !db.prepare("SELECT 1 FROM enrollments WHERE course_id='BIO-214' AND user_id=? AND kind='student'").get(student_id) || (excused && !reason)) throw httpError(400,"Select an enrolled student and published assessment, and explain an excuse.");
    if (excused) db.prepare("INSERT INTO outcome_exceptions VALUES (?,?,?) ON CONFLICT(student_id,assessment_id) DO UPDATE SET reason=excluded.reason").run(student_id,assessment_id,reason);
    else db.prepare("DELETE FROM outcome_exceptions WHERE student_id=? AND assessment_id=?").run(student_id,assessment_id);
    audit(req.user.id,"exception_updated","course","BIO-214","Updated an outcome exception");
    return {saved:true};
  }})));
  app.put("/api/grading-worksheet/:id", requireUser, (req,res) => sendMutation(res,performMutation(req,{execute:() => {
    const attempt=db.prepare("SELECT * FROM attempts WHERE id=?").get(req.params.id);
    if (!attempt || !courseVisible(db.prepare("SELECT course_id FROM assessments WHERE id=?").get(attempt.assessment_id).course_id,req.user)) throw httpError(404,"Attempt not found.");
    if (req.user.role!=="instructor" && !(req.user.role==="teaching_assistant" && attempt.assigned_grader_id===req.user.id)) throw httpError(403,"You cannot grade this attempt.");
    if (attempt.status==="in_progress" || attempt.feedback_status==="released") throw httpError(409,"Only submitted, unreleased work can be graded.");
    const grades=req.body.grades;
    if (!Array.isArray(grades) || !grades.length || new Set(grades.map(g=>g?.criterion_id)).size!==grades.length) throw httpError(400,"Provide distinct rubric rows.");
    const criteria=db.prepare("SELECT r.* FROM rubric_criteria r JOIN items i ON i.id=r.item_id WHERE i.assessment_id=?").all(attempt.assessment_id);
    const checked=grades.map(g=>{
      const criterion=criteria.find(c=>c.id===g?.criterion_id), score=numeric(g?.score);
      if (!criterion || !Number.isFinite(score) || score<0 || score>criterion.max_points || typeof g.feedback!=="string" || Object.keys(g).some(k=>!["criterion_id","score","feedback"].includes(k))) throw httpError(400,"Every worksheet row needs a valid score and text feedback.");
      return {criterion_id:g.criterion_id,score,feedback:cleanText(g.feedback,1000)};
    });
    for (const g of checked) db.prepare("INSERT INTO rubric_grades VALUES (?,?,?,?,?,?) ON CONFLICT(attempt_id,criterion_id) DO UPDATE SET score=excluded.score,feedback=excluded.feedback,graded_by=excluded.graded_by,graded_at=excluded.graded_at").run(attempt.id,g.criterion_id,g.score,g.feedback,req.user.id,referenceNow());
    const totals=db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(score),0) AS total FROM rubric_grades WHERE attempt_id=?").get(attempt.id);
    db.prepare("UPDATE attempts SET rubric_score=?,status=? WHERE id=?").run(totals.total,totals.count===criteria.length?"graded":"submitted",attempt.id);
    audit(req.user.id,"graded","attempt",attempt.id,`Saved ${checked.length} rubric rows together`);
    return {attempt:attemptView(db.prepare("SELECT * FROM attempts WHERE id=?").get(attempt.id),req.user)};
  }})));
  function releaseRows(ids) {
    if (!Array.isArray(ids) || !ids.length || ids.length>100 || new Set(ids).size!==ids.length || ids.some(x=>typeof x!=="string")) throw httpError(400,"Select distinct attempts for release.");
    return ids.map(attemptId=>{
      const a=db.prepare("SELECT t.*,a.course_id,u.name AS student_name,a.title AS assessment_title FROM attempts t JOIN assessments a ON a.id=t.assessment_id JOIN users u ON u.id=t.student_id WHERE t.id=?").get(attemptId);
      if (!a || a.course_id!=="BIO-214" || a.status!=="graded" || a.feedback_status!=="hidden") throw httpError(409,"Every selected attempt must be fully graded and unreleased. Refresh the selection.");
      return a;
    });
  }
  app.post("/api/release-plans",requireUser,(req,res)=>{
    instructor(req.user);
    if (!req.body || Object.keys(req.body).some(k=>!["attempt_ids","expected_revision"].includes(k))) throw httpError(400,"Invalid preview fields.");
    const revision=numeric(req.body.expected_revision);
    if (!Number.isSafeInteger(revision) || revision<0) throw httpError(400,"A valid revision is required.");
    if (revision!==currentRevision()) throw httpError(409,"Course updated in another tab. Refresh before previewing.");
    const rows=releaseRows(req.body.attempt_ids), planId=id("plan");
    db.prepare("INSERT INTO release_plans(id,actor_id,revision,attempt_ids) VALUES (?,?,?,?)").run(planId,req.user.id,revision,JSON.stringify(rows.map(r=>r.id)));
    res.json({plan_id:planId,revision,rows:rows.map(r=>({attempt_id:r.id,student_name:r.student_name,assessment_title:r.assessment_title,total:Number(r.objective_score || 0)+Number(r.rubric_score || 0)}))});
  });
  app.post("/api/release-plans/commit",requireUser,(req,res)=>sendMutation(res,performMutation(req,{execute:()=>{
    instructor(req.user);
    if (typeof req.body.plan_id!=="string") throw httpError(400,"Preview a release selection first.");
    const plan=db.prepare("SELECT * FROM release_plans WHERE id=? AND actor_id=?").get(req.body.plan_id,req.user.id);
    if (!plan) throw httpError(404,"Release preview not found.");
    if (plan.consumed || plan.revision!==currentRevision()) throw httpError(409,"Release preview is stale. Preview again before committing.");
    const rows=releaseRows(JSON.parse(plan.attempt_ids));
    for (const r of rows) {
      db.prepare("UPDATE attempts SET feedback_status='released' WHERE id=?").run(r.id);
      audit(req.user.id,"released","attempt",r.id,"Released feedback in a reviewed batch");
    }
    db.prepare("UPDATE release_plans SET consumed=1 WHERE id=?").run(plan.id);
    return {released_ids:rows.map(r=>r.id)};
  }})));
};
