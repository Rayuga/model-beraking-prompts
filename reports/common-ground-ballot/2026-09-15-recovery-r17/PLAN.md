# Common Ground r17 implementation plan

The supplied r16 GPT-5.4-mini/high run scored 0.897 overall: Functional 0.9236,
Polish 0.7143, Visual 1, both gates 1. Its judge/prompt hashes match r16.
Oracle 1 is user-reported; no matching Oracle export is currently supplied.

The goal is a harder complete product while keeping the golden fully correct.
Fresh model/Oracle scores cannot be guaranteed from local checks.

1. Preserve r16 and its evidence. Correct judge ambiguity around normalized blank
   choice rows, the first restart's roster observations, and presentation fixtures.
   Do not count missing observations as proven GPT defects.
2. Clarify existing contracts: a person's operation ID namespace spans all action
   types, and structured/boolean/null/missing revisions cannot be coerced into
   whole-number versions. Probe these on valid targets with positive controls.
3. Add staff-only interrupted-action recovery: durable pending attempts, exact
   explicit retries, independently resolvable entries, account isolation and safe
   cross-tab completion/dismissal. Do not journal Member selections or add a
   separate unsaved-draft editing feature.
4. Implement that feature in the golden through one shared staff mutation helper
   and an accessible Pending actions tray. Keep existing server receipt semantics.
5. Add five separately graded recovery invariants and one operation-namespace
   criterion. Keep 60/20/20 dimensions and mandatory gates. Recovery is substantial
   product work and receives positive weight; every old scenario remains required.
6. Exercise actual browser response loss after upstream commitment, prior-domain
   refusal, reload before response handling, sign-in, multiple pending entries, two tabs and
   real process restart. Save original exchanges before assertions. Test original
   GPT and deliberate broken variants where practical; do not treat these as a
   fresh scored model run.
7. Freeze and audit the ZIP after golden checks pass, then rerun relevant legacy
   browser/MCP/scoring checks on the frozen files. Package a reviewable candidate
   with provenance and exact limitations. Platform QC and fresh Oracle/model runs
   remain the final acceptance steps.

Completed: instructions, golden and verifier are aligned and frozen as r17.
The ZIP contains 39 files and 68 criteria; its SHA256 is
51465c839d05a23574b787ff7e4d01aeb3118c82cb138d8b3be875ab5d73c3a2.
347 local groups passed, including 58 golden boundary and 23 recovery checks.
The existing GPT artifact failed nine boundary probes with no driver errors.
All five recovery mutants and 14 incomplete/unweighted archive controls were
detected. Source, frozen files, ZIP and local image inputs match. Standard/archive
checks passed 179/464 respectively. Fresh platform scores remain unverified.
