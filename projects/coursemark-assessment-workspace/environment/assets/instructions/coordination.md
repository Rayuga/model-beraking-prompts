# Concurrent writes and retries

Show a nonnegative course revision. Every accepted course-data write
increments it exactly once. The browser sends its expected revision with each
write. A stale write receives the authoritative current state and revision,
makes no partial change, and visibly explains that another tab updated the
course; a fresh retry may then proceed.

Give every write an unpredictable operation identifier. Persist the original
status and response for accepted writes and known validation, authorization,
state, and stale-write failures. Repeating the same request and identifier
returns that original result without another revision, record, grade, score,
release, or audit event. Reusing an identifier for different input is rejected
without change.

While a write is pending, repeated activation of its visible control must send
at most one accepted operation. All accepted writes, rejected-write safety,
revisions, and receipts survive reload and later sign-in.
