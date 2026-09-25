# Concurrent writes and retries

Show a nonnegative course revision. Every accepted course-data write
increments it exactly once. The browser sends its expected revision with each
write. A stale write returns a 4xx response with the authoritative current state and revision,
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

Request identity and validation
-------------------------------
Authenticate and authorize the acting person independently of any saved receipt.
A retry identity belongs to that person across their sessions and across restart;
another person's identical identifier must never return the first person's result.
A request's method, target path and input values are part of its identity. Object
key ordering is immaterial. Reusing an identifier for a different target or input
returns an operation-mismatch 409 without any write. An exact successful retry
returns its historical result, while the visible workspace must use current data.

Expected revisions must represent nonnegative safe whole integers. Numeric string
transport is permitted; booleans, null, missing values, arrays, objects, fractions
and nonnumeric strings are invalid. Operation identifiers must be nonempty strings
with sufficient randomness; arrays, objects and missing identifiers are invalid.
Refuse client fields claiming server-owned identity, status, totals, timestamps or
revision changes. Metadata errors return 4xx, never 500, without product changes.
The fixed reference moment never advances with revisions or wall-clock time.

For stale revisions and stale release previews, 409 and 412 are both valid
4xx choices; no particular stale-conflict status is required. Exact replay must
preserve the original response status and body, whichever valid status was used.
The operation-identity mismatch rule above specifically requires 409.
