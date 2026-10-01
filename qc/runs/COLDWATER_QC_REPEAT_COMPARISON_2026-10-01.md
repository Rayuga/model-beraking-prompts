# Colderwater QC repeatability check — 1 October 2026

Two local QC rounds were completed **in sequence** on `projects/colderwater-playground-devtools`, without changing the task between them. Each round used three separate fresh reviewer contexts; each reviewer covered all 53 quality rows and all 48 deterministic rows using the frozen `WebDev Rubrics QC.xlsx`, Harbor QC skill and references, and template. The task has 50 frozen files and the rules snapshot has 34 files. Both round manifests have the same input SHA-256, `2ad79dadd584e96174ad2cdc615165e14e75b0631aa57d861d6fb34b8c62bc1f`. The task and rules files also match the preceding single-row local review; its different input hash reflects the review mode.

| Result | Round A | Round B |
|---|---:|---:|
| Valid complete reviewer reports | 3/3 | 3/3 |
| Preflight | Pass | Pass |
| Quality Fail verdicts (reviewer × row) | 9 | 2 |
| Distinct quality rows with a Fail | 6 | 1 |
| Deterministic Fail verdicts | 0 | 0 |
| Within-round verdict disagreements | 16 | 9 |
| Missing hash-bound configured runtime records | 4 | 4 |
| Pipeline status | BLOCKED | BLOCKED |

The verdicts are **not repeatable** on identical source. Ten quality rows and four deterministic rows changed their verdict distributions between rounds. In particular, all three A reviewers failed quality row 21, `verifier_entrypoint_is_safe_and_always_scores`, while all three B reviewers passed it. B's Pass rationales cited the initial zero record, trap and suite ordering but did not address A's restart counterexample. The earlier source-bound control recorded an old server surviving SIGTERM, the replacement logging `EADDRINUSE`, and the helper nevertheless reporting `ready=1`. A's finding is therefore not cleared by B's Pass. This is a shared-template `tests/test.sh` limitation; the task has kept the template byte-identical.

| Check | Earlier single-row review | Round A | Round B | Interpretation |
|---|---|---|---|---|
| 11, timeout fits workload | Fail | 3 Not exercised | 3 Not exercised | Full configured judge timing and cold-build evidence remain missing. A 139-second scripted golden browser run does not measure judge latency. The earlier review additionally identified an unbounded readiness-body wait in shared `test.sh`. |
| 21, verifier safe and always scores | Fail | 3 Fail | 3 Pass | Strong review variability; the unchanged restart helper and scored-suite error handling have concrete controlled counterexamples in the earlier local evidence. |
| 35, core behavior and durability proof | Fail | 3 Pass | 3 Pass | The golden's normal restart succeeded, but the earlier surviving-old-server control still limits what the verifier can prove for an adversarial app. The later Passes did not refute it. |
| 26, dimensions cover every requirement | Note with risk | 2 Fail, 1 Pass | 2 Fail, 1 Note | The public notes mandate Express/SQLite, while the browser-only criteria explicitly do not verify implementation technology. This concern recurred in both new rounds. It also exists in the shared template, so it needs a policy decision rather than an invented browser-only proof. |
| 28 and 33, independent/self-consistent criteria | Pass | 1 Fail each | 3 Pass each | One A reviewer found binary rows that combine independently useful JS/HTML execution and unsupported-execution families. These are not refuted by silence in B and need a separate substantive decision if the task is revised. |

Round A also had one reviewer each fail rows 25 and 49 on HTTP-error readiness, and row 28/33 as above. The HTTP-error observation is literal source behavior: `probe_ready` catches `urllib.error.HTTPError` and exits successfully for HTTP 404/500. Whether that constitutes an actionable task defect is a shared-harness policy question; round B did not test the counterexample. Round A's three reviewers all failed row 21 for overlapping restart/readiness reasons. No failed deterministic row appeared in the new full reviews, but the preceding single-row review failed `check-verifier-contract.py` on the same shared restart/cleanup behavior. The absence of that Fail in the new manual reviews is another evidence difference, not a measured repair.

Both rounds lack the four required runtime records for full verifier/workload measurement and empirical reward discrimination/ranking. Neither ran the configured judge, Oracle, Luna, portal QC or the client's private deterministic executables. A prior source-bound scripted golden run passed all 79 mapped functional observations, both gates, and six Polish browser observations; that evidence remains separate from a configured grade. The two rounds establish variability in **local human/agent source review**, not that the portal's reviewer is nondeterministic or that Oracle will pass. No task source or shared template file was edited for this comparison.

Evidence: [round A summary](coldwater-2026-10-01-repeat-a/summary.json), [round B summary](coldwater-2026-10-01-repeat-b/summary.json), [earlier single-row summary](coldwater-2026-10-01-lifecycle-controls/summary.json), and each round's `reviewer-1.json` through `reviewer-3.json` and `QC_REVIEW.xlsx`.
