# Grading, totals, and release

The instructor may grade any submitted attempt in the course. The teaching
assistant may grade only attempts assigned to them. Students cannot grade.
Rubric scores must be numeric and within zero and the criterion maximum.

Saving a rubric score and feedback replaces that criterion's earlier grade.
An attempt becomes graded only after every rubric criterion has a grade. Its
total is objective points plus the sum of rubric scores. Each accepted grade
write records exactly one audit event; rejected grade writes change nothing.

Only the instructor may release a fully graded attempt. Before release, its
student sees neither scores, rubric grades, nor feedback. Release exposes those
records only to that student and writes one audit event. Released grades and
feedback are immutable, and repeated or unauthorized release changes nothing.

Privacy applies to every response channel: submission acknowledgements, replayed
receipts, error snapshots, audit details, gradebook and attempt reads. An
unreleased score of zero is private too. Do not reveal scores or feedback to a
student indirectly through audit text or nested response objects. Release makes
them visible only to the owner, and never makes the stored answer key public.
Boolean, null, blank, array and object scores are not numeric grades. A finite
numeric string may be accepted, but invalid values never create or replace a grade.
