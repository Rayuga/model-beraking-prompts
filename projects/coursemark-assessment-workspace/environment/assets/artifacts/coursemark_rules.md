# Coursemark assessment rules

The reference moment is `2026-09-02T12:00:00Z`. All times are UTC.

## Eligibility and timing
- Only published assessments are visible to enrolled students.
- A student may start during the inclusive `opens_at` through `due_at` window when attempts used are below `max_attempts`.
- Effective duration is `duration_minutes + extra_time_minutes` from that student's accommodation. Effective due time is `due_at + deadline_extension_minutes`.
- An attempt expires at the earlier of its start plus effective duration or effective due time. The exact expiry instant is no longer writable and is auto-submitted by the server.
- Answers may be saved only on the authenticated student's own `in_progress` attempt. One active attempt per student and assessment is allowed.

## Submission and grading
- Submission is atomic and terminal. The server scores multiple-choice items from the stored answer key; request bodies cannot supply points.
- Instructors and the submission's assigned teaching assistant may grade rubric criteria. Each score must be within the criterion's stored maximum.
- Total score is objective points plus rubric points. Released feedback is immutable; later grading changes are refused.
- Students see score and feedback only when `feedback_status` is `released`.

## Authority and audit
- Instructors alone create, edit, publish, and release assessments. Publishing requires at least one item and a positive duration.
- Teaching assistants see only submissions assigned to them. Students cannot access other students, answer keys, rubrics with hidden notes, or grading endpoints.
- Identity and role come from the session. Every accepted publish, submit, grade, and release operation writes one append-only audit event; rejected operations write none.
