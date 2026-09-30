# Coldwater hardening, 30 September 2026

Candidate input: `a6a5219e9c5aa5e19c2b30acb01ca3a1719938a02ea09674cd18e08987bf43a9`.

The user authorized three deeper existing scenarios and a modest functional weight adjustment. This is not a measured difficulty calibration: the target remains Luna 0.4–0.5, with Oracle 1.0 as the engineering goal. Neither score has been measured for these bytes.

| Change | Public anchor in behaviour.md | Observation and scoring owner |
|---|---|---|
| Cancelled callback tries a late DOM write, log and thrown error | Starting another run cancels old work; cancelled errors must not spoil the newer run | S04 first observes the same uncancelled callback/error. New Run and Stop trials independently check suppression. Stop rollback has its own row. Retained earlier console entries are compared against a baseline. |
| Successful A, then distinct successful B, then failing C | Restore the most recent successful render | S10 rollback must restore B. Error message and source-line outcomes retain independent credit if rollback fails. |
| Two consecutive save conflicts with reversed editor roles | Revisions, refusal without mutation, retained unsaved work, repeated editing from both windows | S23 uses two live editors twice. Server refusal and actual dirty-editor recovery remain separate outcomes; API replay alone cannot establish draft retention. |
| Shift 2.00 functional weight points toward these invariants | Core execution and saved-work correctness | Total stays 32.70 across 58 binary outcomes. Every existing outcome retains positive weight. Exact changes are in hardening-diff.json. |

Only behaviour.md, the functional prompt and functional criterion definitions differ from the prior Round 3 candidate. The golden source, gates, polish, visual, shared harness, Dockerfiles, scoring policy, judge settings and timeouts are unchanged. There are still 23 shared protocols; estimated actions rise from 370 to 396. This is a planning estimate, not measured judge latency.

Moving weight alone changes a fixed set of pass/fail outcomes by at most `0.6 * 2 / 32.7`, about 0.0367 final reward. Stronger fixtures can change which outcomes pass, but that effect needs an actual model run. It would be misleading to promise 0.4–0.5 from this adjustment.

The generic breaker source scanner detected the staged profile, 58 outcomes and weight 32.7. Its keyword heuristic reported 17.4% enforcement share; that is not a semantic measure of this execution sandbox. Its three generic failures are not changes requested here: canonical test.sh intentionally clears initial database state; optional provisional-preview display is a valid implementation choice; and the prompt says fresh lookup/readback rather than the exact token “re-read”. These flags need profile-aware review, not automatic edits to frozen files or stricter hidden UI requirements.

Prior reviewed candidate for comparison: `qc/runs/coldwater-2026-09-29-round3`. Its tests and reviews are historical evidence, not clearance for this candidate. New independent reviews and fresh scripted reference evidence are recorded beside this document. Missing full judge duration, provider grading and target-model evidence must remain visible in final status.

Fresh scripted reference verification completed in `golden/run-golden-20260930-070504/RESULTS.json`: 58/58 current functional facts and all 26 phase observations passed, with one actual canonical process restart, in 98.027 seconds. No solution edit was necessary. The superseded callback's observed uncancelled control emitted its delayed marker and error once; neither count increased after cancellation. The A→B→C test restored `latest-good-B`. Conflict cycles advanced the saved record through revisions 2→3 and 4→5, retaining the losing editor's exact dirty fields both times.

The initial `070305` run is preserved. Its S23 driver selected a newly renamed record from A's unrefreshed library list and timed out: 56 facts were collected and two were missing. The app does not promise live cross-window list refresh. The driver now performs an ordinary reload before loading the current record for the second cycle; the corrected complete run starts from a fresh database. This changes local test setup only, not the task or expected product behavior.

Final local review: all three independent reports cover 53 quality and 48 deterministic rows, with no demonstrated task-local source Fail. Structural preflight50/50 and regression guards45/45 pass. Reconciliation is **BLOCKED**, not cleared: seven distinct risk rows remain across the reports, covering full judge workload and execution, empirical floor/discrimination/ranking, inherited exact-stack verification and full sibling-corpus distinctness. The 20 report-level flags include repeated risks from different reviewers; they are not 20 newly discovered implementation defects. See SUMMARY.md and QC_REVIEW.xlsx for original verdicts and disagreements.

The ZIP contains50 files and exactly matches the reviewed manifest. SHA256: `9f63a6bde530883634502471f80c707e8f2362c6e612a080bade7d731255aa07`. Packaging passes CRC, extraction hashes, shell modes and public-prose scans. No upload, paid provider run, commit or push occurred in this hardening pass.
