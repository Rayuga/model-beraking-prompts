# Seed records, privacy, and audit

Import every user, course, enrollment, accommodation, assessment, question,
rubric, attempt, answer, and rubric grade in `coursemark_seed.json` exactly once. The fixed
reference moment is `2026-09-02T12:00:00Z`; do not replace seeded differences
with generic records.

Students see only their own attempts. The teaching assistant sees only assigned
submissions. The instructor sees every course submission and a gradebook with
student, assessment, state, release state, and available total. Hidden values
must be absent from protected student responses, not merely concealed by CSS.

Audit is durable and newest first. Instructor sees course events, teaching
assistant sees their actions and assigned-attempt events, and each student sees
only their own attempt events. Accepted publish, submit, grade, and release
events appear once; rejected and replayed operations add no event.

The `rubric_grades` collection contains historical grades with attempt and
criterion IDs, score, feedback, grader ID and grading timestamp. Import each
record exactly once, including explicit zero scores. AT-102 has RC-3=0 and
RC-4=0 recorded by Ada; both criteria are complete. Its objective score is 5,
rubric total is 0, and released total is 5/10. Zero is a recorded grade, not a
missing grade. Initial import restores this existing state without creating
new grade/release actions or audit events; later writes follow the audit rules.
