# Timed attempts and answers

An assessment is startable only while published, at or after its opening time,
at or before the student's effective due time, and while attempts used are
below its limit. Permit only one active attempt for that assessment and student.

Add the student's course accommodation to the base duration and due time. An
attempt expires at the earlier of its adjusted duration from `started_at` and
its adjusted due time. At or after that exact instant it accepts no answer
write and auto-submits once. Use the fixed reference moment from the seed for
all availability, expiry, submission, grading, and audit timestamps.

A student may read and save only their own in-progress answers. Reload and
later sign-in restore every accepted save. Submission is terminal, calculates
multiple-choice points from the server key, preserves written answers for
grading, and records exactly one submitted or auto-submitted audit event.
