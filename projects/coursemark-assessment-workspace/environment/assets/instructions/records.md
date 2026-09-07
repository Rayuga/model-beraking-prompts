# Seed records, privacy, and audit

Import every user, course, enrollment, accommodation, assessment, question,
rubric, attempt, and answer in `coursemark_seed.json` exactly once. The fixed
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
