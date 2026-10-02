# Findings queued while R2 remains frozen

These are working notes, not a final union, clearance, or changes to the audited task. Finish all 53 quality rows before editing the candidate.

- Row 17 confirmed golden bugs: two inline handlers on one HTML element overwrite a shared rewrite marker; accepted leading filename whitespace is trimmed in durable storage. Fix implementation and add focused regression evidence.
- Row 26 found missing distinguishing probes for independent New records sharing a title, a fresh deliberate restore to a previously restored target, and quiet New/load with Auto-run enabled but no pending queue. Reuse current scenarios and preserve independent credit. Clarify duplicate-title support naturally if needed; do not add artificial title-validation policy.
- Row 27 confirmed that logical restore identity is different from transport metadata. Exact replay of stale one-use CSRF data can reject a conforming retry. Let observed application mechanisms refresh incidental transport metadata while preserving the business operation and loaded revision. Apply consistently to request-replay guidance, not just one sentence.
- Row 28 found that history inspection combines dirty-draft preservation and unchanged saved head. Split the existing observations and keep their combined weight; no extra browser scenario is needed.
- Root follow-up for reconciliation: examine whether document navigation's queued-work cancellation and non-execution of newly opened source also need separate owners, by the same independence policy. Do not silently turn this pending concern into a confirmed reviewer finding.

Shared cleanup/restart behavior and missing configured measurements remain the user's deferred concerns. The R1 private-prompt argv/proc issue is a distinct shared concern, not automatically covered by the restart exception.

No source, policy, engine, or indexed evidence changed while these notes were added. R2 remains candidate b10dbfae5ccc478c0bc422ac98a58494148a3c9c1df7b5b226d2b3a9a73f8863 at commit d327054e.
