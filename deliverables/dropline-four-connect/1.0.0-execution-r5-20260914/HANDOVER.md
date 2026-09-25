# Dropline execution-reliability release r5

Upload: `dropline-four-connect.zip` in this folder.

SHA-256: `819b69f6a53335b513bcae04d3c5546e3077f9031ca913d0118facd1ad346e8f`.
Exactly one `dropline-four-connect/` wrapper, 39 task files. Every archived file
matches current source bytes. Task version remains `1.0.0` under the shared
standard. Prompt revisions: Render r2, Constraints r2, Functional r5, Polish r4,
Visual r4. Historical deliveries, model exports and scores remain unchanged.

## Golden fix and differential evidence

The original four ordinary pending-repeat tests passed on the exported Oracle.
A more specific input-boundary case exposed a real robustness defect:

1. Send one analysis move and hold its unchanged server response.
2. Press the mouse on a disabled analysis column while that response is pending.
3. Deliver the first response and let the UI become ready, then release the mouse.
4. The previously started gesture became a fresh click after the button enabled.

On the unmodified exported Oracle, the settled result was two requests, two new
nodes and two revision increments. See pointer-before-detailed.json. The first
diagnostic read taken before the second save settled is separately preserved in
pointer-before-unsettled.json; it is not the final before-state conclusion.

`solution/app/public/analysis.js` now remembers presses begun while controls are
busy/disabled and suppresses their later click. It also prevents keyboard
auto-repeat from turning a held activation into later fresh moves, while allowing
a genuinely new key press. The workspace exposes aria-busy during saves.
No arbitrary cooldown, server special case, test-only flag or judge detection
was added. Ordinary fresh actions remain accepted.

After the fix, the boundary case produces one request/node/revision. The four
ordinary cases (same/different mouse target, Enter, Space) also pass. A held-Enter
positive-control test confirms repeated held-key events are ignored and a new
press after release saves the next move normally.

This is a demonstrated app fix, but the platform judge's detailed action trace
is unavailable. We cannot prove this exact event ordering caused its historical
analysis_operation_receipts deduction. The previous 0.9819 Oracle result is not
validation of this new package, and no new Oracle score is claimed.

## Measurement changes

- Functional explicitly specifies the pending-response interception protocol:
  second physical activation before release, no locator auto-wait that postpones
  the click until completion, actual unmodified responses, request/state counts,
  and cleanup in finally. Exact receipt replay remains a separate observation.
- Polish uses the same timing rule for preview/commit controls.
- The restart criterion now labels R0-R4 and places game Redo explicitly between
  Restart 1 and Restart 2. Both saved-study snapshots, receipts, tactical report
  and the uncommitted transplant preview remain graded. No restart was added.
- Functional asks for a compact checkpoint ledger, earlier completion of the
  two-tab/session/ownership/retry checks, and an end-of-run incomplete-evidence
  review. A skipped action must not be described as an observed implementation
  failure. Genuine tool/budget limitations must still be disclosed, not hidden.
- Rejection matrices vary one invalid field at a time, begin with a valid
  observed request, and use genuine foreign IDs for ownership probes. One
  rejection cannot stand in for the entire matrix.
- All five prompts use the standard explicit independent-judgment wording.
  Their shared startup gates and scoring rules are unchanged.

These changes reduce known sources of omissions and false deductions; prompts
alone cannot guarantee a future judge completes every action. None of the
previous uncertain deductions was retroactively converted to a pass or failure.

## Stronger existing coverage, not score manipulation

The 2,801-node tactical explanation check now validates every path extension,
alternating player, unknown internal/horizon outcome, absent win/loss distance,
and all disclosed parent-to-child board transitions. It also inspects a second
actual UI path to reject a static/root-only inspector. Equivalent representations
and UI-derived positions remain allowed; no incidental JSON shape is required.
These observations follow the existing instruction to explain every legal reply
and inspect any exact proof position. No new product feature, fixture secret,
deadline reduction, score cap or model-specific expectation was introduced.

All 60 criterion IDs/types/weights are preserved: 2 Render, 2 Constraints,
43 Functional, 7 Polish and 6 Visual. Only three Functional descriptions changed:
analysis_operation_receipts, restart_persistence_and_seed_idempotence and
tactics_complete_bounded_proof. Functional total weight remains 66.5 and the final
formula remains gated 0.6 Functional + 0.2 Polish + 0.2 Visual.

The prior GPT result was 0.671 with nine incompletely evidenced deductions.
Its concrete reported defects include duplicate study creation on exact retry,
analysis Redo errors, forbidden input fields accepted, incorrect tactical
results and absent proof interaction. The existing tests still require those
behaviors. Completing previously skipped checks could raise the measured score;
this revision does not guarantee a lower GPT result. The previous run review
remains the evidence source, not a score prediction for r5.

## Runtime and packaging alignment

The runner and existing lifecycle helper now launch from the app entry file's
directory while keeping the judge working directory separate. This follows the
latest standard and supports ordinary relative asset paths. It prevents a
correct relative-path submission from failing only because of the verifier's
working directory. One lifecycle helper and two graded restarts remain.

The solution launcher uses the canonical /bin/bash shebang. ZIP metadata now
explicitly records Unix regular files and executable shell scripts. The final
archive passed the actual upload audit. Earlier local packaging attempts that
failed metadata/literal-wording checks are retained as .bin evidence under
packaging-attempts; they are not upload deliverables.

Task TOML, both Dockerfiles, requirements, seed data, backend, criterion weights,
dimension configuration and public agent/separate-verifier networking remain
unchanged. The exact changed-file list and hashes are in package-verification.json.

## Fresh checks passed

- 139 repository standard checks and 406 checks against the final ZIP.
- Task JSON/TOML parsing; authored JavaScript, inline browser script and shell
  syntax checks during the actual solve.sh/test.sh regression setup.
- 49 API/real-browser regression groups, including exact game rules, study
  isolation, conflicts, receipts, tactical fixtures and two process restarts.
- Three shared browser journeys and three layout/reduced-motion groups.
- Four ordinary pending-input cases, one boundary case and one held-key/new-key
  positive-control case, with the failing-before/passing-after evidence above.
- Full proof structure plus both visible paths; seven corrupted proof variants
  rejected (nine proof-audit checks total).
- Normal and relocated relative-path fixtures: actual test.sh startup and two
  actual helper restarts each, preserving data and serving relative assets.
- Twelve reward formula/input-validation cases; all 39 ZIP entries read back
  and matched against source hashes and current runner prompt provenance.

These are unpaid local tests, not 43 completed Codex criterion judgments. The
local RewardKit stand-in supplied synthetic scores solely to test runner
post-processing; its 0.58 result is not an Oracle score.

## Remaining limits

Both exact Docker builds were attempted. The agent build failed resolving the
local configured repository/proxy host; the verifier build hit repeated PyPI
timeouts and could not fetch pinned packages. Logs are retained. Current-source
behavior tests used cached dropline-verifier-local:v6.0.3, with its existing
Chromium executable. This is not proof that fresh builds pass on this machine.
The Dockerfiles were not changed to hide those external access failures.

No paid Oracle/model or platform QC run was launched. There is no measured r5
Oracle score, GPT score, or full-judge elapsed time. Oracle 1.0, lower GPT scores,
zero future judge omissions and platform rubric approval cannot be guaranteed.
