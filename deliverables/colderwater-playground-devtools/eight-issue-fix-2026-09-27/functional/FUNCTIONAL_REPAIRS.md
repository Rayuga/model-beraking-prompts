# Functional repair review

This report covers the Functional edits made for the eight reported QC failures. It is source-level evidence, not a hosted judge or Oracle result. The final source hashes and exact criterion descriptions are recorded by `audit_repairs.py` in `repair_invariants.json`; rerun that audit after the parent review's privacy/network edits.

## Before and after

| Previous requirement | Revised requirement | Why |
|---|---|---|
| `cw_execution_budget_termination` required a theme toggle or other host control to respond while an infinite loop was still running. The prompt also demanded host responsiveness. | The literal loop must terminate within the stated budget plus scheduling tolerance, preserve its initial log, restore the good preview, and permit a real subsequent run. A temporary host pause before timely termination is allowed. | The product notes require an editor usable after termination. An unrelated during-loop responsiveness requirement would penalize a valid implementation. The five-second safety behavior is retained. |
| `language_dispatch`, weight 2.5, combined filename-driven JS/HTML/CSS behavior and six-second delayed click/key/input tests. | `language_dispatch` is 1.5 and owns dispatch, fresh documents, and CSS copying without old scripts/handlers. New `cw_completed_preview_interactions`, weight 1.0, has its own HTML control and delayed click plus keyboard/input observations. | A working language implementation and a working late-interaction lifecycle now earn independently justified credit. The delayed-interaction requirement is still tested. |
| `recovery_persistence_chain`, weight 2.5, combined a run's shared callback budget, later interaction deadline nonextension, and a redundant saved-record reload loop. | `cw_shared_run_deadline_recovery`, weight 1.5, uses its own successful JS control, the same four-second callback followed by a literal infinite loop, and its own recovery run. New `cw_pending_interaction_budget_nonextension`, weight 1.0, uses its own completed HTML control, six-second timer, second click at two seconds, rollback and recovery. | Independent clock behaviors no longer erase each other's credit. Saving and reload durability retain their existing dedicated checks. |
| `auto_run` first measured the app's actual debounce, then watched OFF/cancellation cases for a fixed two seconds. | Both negative windows are at least three seconds and at least the longest observed successful debounce plus one second. Each follows with successful manual Run. | A delayed queued run at roughly 2.1 seconds cannot pass just because observation ended at exactly two seconds. No particular millisecond debounce is mandated. |
| `persistent_snippets` accepted two pages or a captured old request interchangeably, then required the unsaved draft to survive. | Keep two real editors open; make B dirty before A saves; observe B's actual UI conflict, retained exact fields, unchanged server record, and deliberate successful recovery. | A replay proves server refusal but cannot prove a nonexistent editor retained its draft. The prompt includes the actual supported independent-browser-context recipe. |
| The stale-rename criterion permitted request replay yet conditionally mentioned keeping an actual stale-editor draft. | Stale rename owns the saved title/filename/source/revision invariant and successful later rename. Actual dirty-editor preservation is owned by the stale-save check. | Removes an ambiguous conditional UI claim from server-only evidence. |
| Evaluator setup errors had no structured way to distinguish incomplete evidence from product failure. | After at most one setup retry, an affected criterion uses leading `EVALUATION_INCOMPLETE:` in `reasoning`; binary `score: "no"` is only a schema placeholder and the harness marks the evaluation ungraded. | No free pass and no valid product-failure score from evaluator setup defects. The marker is reserved for actual evaluator evidence, never app-supplied strings. |

The parent review separately replaces the private-file classifier with the explicit reserved-URL product contract, supplies a ready-to-use controlled network probe, moves the independent restart check immediately after `save_load`, and aligns the shared context and other dimensions. Those edits are not assumed to be covered by this agent's earlier source hashes.

## Coverage and fairness witnesses

| Valid or broken implementation | Expected treatment |
|---|---|
| Literal source blocks the host briefly but reliably stops at five seconds, restores the preview and allows another run. | Can pass execution-budget termination; a during-loop theme toggle is not required. |
| Filename dispatch, fresh JS contexts and CSS static copying work, but a completed preview rejects later clicks after its original deadline. | Can earn the 1.5 language weight; fails the independent 1.0 delayed-interaction weight. |
| The original run shares its five seconds correctly, but a second click extends already-pending interaction work. | Can earn the 1.5 shared-run weight; fails the independent 1.0 interaction-budget weight. |
| A queued automatic run executes 2.1 seconds after auto-run is switched off. | The longer observation sees the marker and the cancellation check fails. |
| Server refuses stale writes but the editor replaces B's unsaved draft with A's contents. | Fails the real dirty-editor check even if a captured-request replay would have shown correct server rejection. |
| UI detects the conflict before sending the stale request and disables Save while preserving all dirty fields. | Eligible to pass after conflict feedback, preserved UI draft, server refusal in the observed actual request shape and successful deliberate recovery. No arbitrary requirement to transmit a known-bad request through the UI. |
| Browser setup fails before a second page or controlled request exists. | Bounded retry, then incomplete evaluation. No claim about the application is inferred from that missing evidence. |

## Weights and model-score implications

There are 35 Functional binary criteria with total weight **49.5**, compared with 33 and the same 49.5 before. Both old 2.5 weights are split into 1.5 + 1.0. Gates, the 60/20/20 final formula and the full-pass maximum are unchanged by these edits.

Splitting these two conjunctions can add at most 3.0 / 49.5 Functional credit for an implementation that passes each larger subcheck while failing each smaller one. That is at most **0.03636 final reward** from the split mechanics alone, assuming gates and the floor pass. It is justified partial credit, not an estimate of the target model's score. Removing an unrequested during-loop requirement or requiring real UI evidence may move individual outcomes in either direction relative to flawed old scoring. No hosted model score or Oracle 1.0 is claimed.

## Prevention controls

1. Every new leg needs a specific public requirement, its own observable evidence and a valid alternate-implementation witness.
2. When a new behavior can fail independently of a criterion's original behavior, decide its score ownership explicitly rather than appending it to an unrelated conjunction.
3. Never permit request replay as a substitute for UI state such as draft retention, focus, warnings or navigation.
4. Derive negative observation windows from the actual positive timing control plus a margin.
5. Separate evaluator setup failures from observed product failures with a tested structured protocol.
6. Re-run source invariants and affected golden browser flows after edits, then bind the final ZIP and report to hashes. A passing old report is not proof for a newly changed rubric.
