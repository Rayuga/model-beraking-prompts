# Common Ground Ballot r17

Superseded by [the r18 verifier repair candidate](../2026-09-16-verifier-repair-r18/README.md).

**Latest status: platform Oracle failed, scoring 0.7517 overall and 0.5862
Functional. Do not rerun this ZIP unchanged.** The new run matches these exact
bytes. It reports five recovery checks not completed and other lost/invalid
judge evidence. The local validation described below predates this platform
result and did not prove completion of the autonomous judge workflow. See
[the diagnosis and repair plan](../../../reports/common-ground-ballot/2026-09-15-oracle-failure-r17/README.md),
[the latest audit](latest-oracle-failure-audit.json), and
[three passing targeted reproductions](latest-oracle-targeted-reproduction.json).
The alleged missing-revision bug did not reproduce: the exported app returned
HTTP 400 with unchanged business state. These narrow checks are not a new scored
Oracle run, and no repaired release has been packaged.

This candidate makes Common Ground harder by adding a complete staff recovery
workflow and checking previously uncovered request boundaries. The product brief,
golden UI and verifier were updated together. The frozen upload is
`deliverables/common-ground-ballot/2026-09-15-recovery-r17/common-ground-ballot.zip`.
The r16 ZIP is preserved.

## Why change the task

The supplied GPT-5.4-mini/high run scored **0.897 overall**, with **0.9236
Functional**, **0.7143 Polish**, Visual 1 and both gates 1. Its verifier hashes
match r16. This is a strong result on the old task. Oracle 1 was reported by the
user; a matching Oracle export was not supplied.

Some old deductions were evidence problems: a blank multiline separator became
a valid normalized choice list, a first-restart Member visibility observation
was omitted, and a permitted recorded-participation presentation fixture was
not exercised. The new prompts clarify those observations instead of treating
them as reliable model weaknesses. The mobile Members overflow was a concrete
reported defect.

The stricter boundary probes isolate valid current targets and actor roles.
They test a person's operation identifier across different action families,
independent identifiers across people, and invalid structured/boolean/null or
missing revisions and approval limits. Fresh valid UI actions are positive
controls. Local results against the supplied GPT app are diagnostic evidence,
not a fresh scored GPT run.

## What changed

Coordinators now need a Pending actions area for interrupted create, edit,
Open, Close, Publish and membership writes. Attempts survive reload and fresh
sign-in, Retry preserves the original request, independent reminders remain
separate, other accounts cannot recover someone's work, and two tabs cannot
resurrect dismissed or resolved entries. A confirmed mutation stays confirmed
if a later read fails. The UI explains that dismissing a reminder does not undo
an accepted change.

The golden persists each immutable attempt before sending, checks the signed-in
actor, coordinates retries between tabs, and refreshes current records after
recovering an old receipt. It retains uncertainty after lost/unreadable replies,
server failures, or expired/changed authorization. Member vote selections are
outside this recovery flow. The existing SQLite backend and receipt semantics
are unchanged.

Functional has 49 criteria with total criterion weight 58: the original 43,
one operation-namespace criterion (weight 2), and five independent recovery
criteria (weight 4 each). There are 68 criteria overall. Original criterion
weights are unchanged. Final weighting remains 60% Functional, 20% Polish and
20% Visual, with mandatory Render/Constraints gates. No score cap, arbitrary
penalty or Oracle-specific bypass was added.

## Validation and limits

`package-audit.json` records the completed checks and their actual counts.
All **347 local regression/scoring groups** passed, including 58 golden boundary
checks and 23 recovery groups. The supplied GPT artifact passed 48 boundary
checks and failed nine with actual state-changing acceptance. Standard checks
passed 179/179 and archive checks 464/464. Five broken recovery variants were
detected and all 14 incomplete/unweighted archive controls were rejected.
Evidence includes the legacy browser journey and two process restarts, roles,
sessions, responsive/theme behavior, exact score composition, all six interrupted
staff families, two-tab/account recovery, pinned Playwright MCP execution and
five deliberately broken recovery variants. Captures retain the actual upstream
exchange before response delivery is interrupted. The late-403 diagnostic
explicitly records its deliberate adoption of an existing UI-issued session;
it does not claim a spontaneous race or retain credential values.

The initial boundary helper stalled while collecting bodies from unrelated
non-JSON resources. Its failed attempts were preserved. The corrected helper
filters JSON responses and bounds captures; infrastructure failures never count
as model defects. See `input-run-audit.json`, `golden-strict-boundaries-results.json`,
`existing-gpt-strict-boundaries-results.json` and the recovery reports for actual evidence.

Local images were assembled from previously installed, pinned dependencies.
A fresh dependency download build and provider-scored Oracle/GPT run were not
performed. Local passes reduce regression risk; they cannot guarantee Oracle 1
or a specific new GPT score.

Upload this ZIP as a new version, run platform QC, then Oracle/NOP and a fresh
GPT run on these exact bytes. Check Functional independently of the overall
score and inspect any Oracle deduction before accepting the candidate.
