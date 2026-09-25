# Pellmoor r9 timing and evidence plan

The revision reduces repeated browser work and evidence serialization. It does
not establish that a model judge at `max` reasoning effort will complete all
observations within 9,000 seconds, or that a fresh solver will finish within
7,200 seconds. Fresh hosted timing evidence remains necessary.

## Required limits

These are unchanged reference-standard limits, not estimates:

| Stage | Seconds | Minutes |
| --- | ---: | ---: |
| Solver | 7,200 | 120 |
| Environment build | 600 | 10 |
| Render | 600 | 10 |
| Constraints | 600 | 10 |
| Functional | 9,000 | 150 |
| Polish | 900 | 15 |
| Visual | 900 | 15 |
| Sum of serial judge limits | 12,000 | 200 |
| Serial RewardKit wrapper | 12,600 | 210 |
| Outer verifier | 13,200 | 220 |

The wrapper has 600 seconds beyond the sum of judge limits, and the outer
verifier has another 600 seconds. That nesting is arithmetically valid; it is
not evidence that the individual work fits its limit. Judge effort remains
`max`, and the runner remains serial with `--max-concurrent-agent 1`.

## Concrete work reductions

The counts below are procedural examples against independently executing each
probe or criterion. They are not measured platform call counts or promises of
a particular wall-clock reduction.

| Work | Repeated approach | r9 procedure | Conditional reduction |
| --- | --- | --- | --- |
| Eight ordinary negative cases | Eight separate browser code invocations | One bounded call containing eight sequential, individually checked cases | Seven browser round trips; all eight writes and post-state comparisons remain |
| Eight unchanged-state cases | A fresh before and after read for each: 16 reads | One initial baseline plus eight fresh after reads: 9 reads; each verified after becomes the next before only without an intervening write | Seven duplicate baseline reads; no intermediate comparison omitted |
| Six persistence replays | Sign in again separately for each receipt | Five original Ruth receipts in one authenticated group and the original Wren note in another | Up to four redundant sign-ins; all six responses and fresh current-state comparisons remain |
| Two new individual-capacity applicants | Create, advance, panel and score one entire applicant, then repeat the actor cycle for the other | Five actor phases: Cal creates both; Ruth advances both; Cal panels both; Otis scores both; Wren scores both | Five actor phases instead of ten; the actual application actions and required intermediate observations remain |
| Cross-role durability audit | Add a fresh action for Cal, a scorer, Ruth and a note author | Reuse the earlier captured accepted actions, with a new action only for genuinely missing evidence | Up to four unnecessary product mutations plus their navigation and role changes |
| Successful note replay and feedback | New note and extra revision-advancing action for replay, separate note for pending state, separate actions for messages | Capture the existing CAND-106 note's response and pending UI; use the existing later note/action as the revision advance | Avoids duplicate product writes where the exact original actor, fixture, pending observation and receipt were captured |
| Snapshot output | Repeated full growing application JSON in model-visible output | Save complete immutable checkpoints once, return compact references and explicit fresh comparisons | Removes repeated serialization and context growth; does not remove required full-state reads |

The three legacy receipts and six persistence receipts are retained from the
existing workflows; they do not require nine extra product actions. Only the
six required persistence receipts are replayed after the shared restart. This
preserves the existing six-receipt scope rather than claiming a new reduction
from nine post-restart cases.

The supplied ledger and preserved-session helpers remain available, but an
equivalent bounded capture implementation is valid. This avoids forcing the
judge to copy a large helper into every tool call or reproduce an exact
serialization format when the original evidence is already durable. A failed
helper is neither product-failure evidence nor a pass. At most one documented
setup recovery is allowed; observed product defects may not be retried away.

## Prompt/criterion consistency review

- Functional evidence follows causal dependencies; final verdicts remain in
  criterion order. No instruction requires forty independent workflows.
- The final criterion descriptions and prompt both permit equivalent capture
  tooling and unambiguous receipt filenames/labels. Original method, URL, actor,
  metadata, body, status, result and required state checkpoints remain necessary.
- All explicitly required negative cases remain. Batching does not sample the
  case matrix or infer untested cells from another refusal.
- Routine fixture setup captures its changed candidate/vacancy and required
  audit delta. A criterion requiring all product state still receives the full
  vacancy collection and candidate details, including historical scores, notes,
  histories and activity. Count-only lists, revisions, hashes or a final-only
  comparison cannot replace those observations.
- Every rejection and replay gets a fresh immediate after read. A before state
  is reused only when it was freshly observed and no intervening write occurred.
  A changed state is retained as a defect and becomes the actual later baseline;
  it is never rolled back or ignored.
- The first four criteria inspect the seed before Functional mutations. If
  Polish or Visual ran earlier, their permitted CAND-106 prerequisite notes and
  associated audit/revision increments are part of the current baseline. Exact
  seeded identities, stages, panels, scores and funnels remain required;
  ROLE-017 remains empty and CAND-104 retains its empty panel/scores/notes.
- The seed path is `/recruitment/records/pellmoor_seed_data.json`, matching the
  public runtime path. The Functional prompt's common browser gate is unchanged.
- Individual stale/authentication probes do not acquire an unstated exact status
  requirement from the prompt. The criterion-specific public contract controls
  any exact batch-stale or operation-mismatch status requirement.
- Only one server restart is allowed. The durable audit and six original receipt
  replays share it; grouped replays still receive six independent comparisons.

## Evidence needed before claiming time sufficiency

1. Freeze the revised archive and retain its checksum and prompt provenance.
2. Run the full hosted Oracle on that exact archive with the configured judge
   model and `max` effort. Record each dimension's start/end, Functional phase
   checkpoints, browser/tool failures, approximate tool-call counts and timeout
   status. Preserve the full attempt, including any failures.
3. Require all forty Functional criteria to have evidence for their specified
   observations, including the lost-response original-UI retry, both races,
   complete required negative cases, shared restart and six distinct receipt
   results. Forty verdict entries alone do not prove forty completed tests.
4. Inspect remaining wall-clock margin. A run that exits before the timeout but
   omits required observations does not show that the work fits. If the judge
   still cannot complete it, reduce redundant procedure or explicitly revise
   public task scope and corresponding criteria; do not inflate scores, silently
   sample cases or independently increase standard timeouts.
5. Run the intended solver on the same frozen package and record its 7,200-second
   usage and browser-check completion. The preinstalled browser removes an
   observed setup obstacle; it does not prove implementation time is sufficient.

The root agent is running thirteen deterministic golden workflow groups as a
local regression check. Their outcome and elapsed time must be reported from
their actual result files. Those groups exercise product behavior and capture
mechanics; they do not include the hosted judge's reasoning/tool overhead and
cannot substitute for the full Oracle timing evidence above.
