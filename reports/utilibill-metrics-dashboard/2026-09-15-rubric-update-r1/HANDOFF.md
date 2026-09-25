# UtiliBill unfinished checkpoint — September 15

The user interrupted implementation to compare completion priorities among UtiliBill, Common Ground Ballot, Pellmoor and Coursework. Common Ground is recommended next on present evidence. If Coursework means Coursemark, the September 14 context records it as completed and submitted. Do not reopen it merely because old files remain.

UtiliBill is NOT ready for upload. No final delivery, platform QC, scored Oracle or model rerun has been produced. The original is retained in source-before.zip. The unfinished current files are separately archived as work-in-progress-NOT-FOR-UPLOAD.zip. Do not overwrite historical evidence.

## Authority and completed work

- Root task-implementation.txt is newer than task-implementation.toml. Its 53 criteria were extracted from the accidentally flattened single-line TXT into rubric.json. Public networking is allowed; judge driver/model/effort belong only in task.toml; a nonempty named weighted_mean reward declaration is required.
- Migrated task.toml and Docker templates to version 1.0.0, five dimensions, current public networking, task-level judge configuration and standard timeout budgets.
- Rewrote the product brief/rules to remove grader contamination and contradictory accounting language; retained the supplied financial policy. Added four ordinary C11 cycles so each dimension can prove a different real durable billing mutation without consuming business scenarios.
- Added 37 independent Functional criteria (total weight 76), six Polish, six Visual, one Render and three Constraints. These need a semantic review and full golden validation. All prompts include an identical authentication/backend gate.
- Added named intermediate RewardKit aggregate and a final score.py that reads numeric weights solely from judge files. This design has NOT yet been exercised against installed RewardKit. Shared checkers still need a scoped UtiliBill profile for this design; do not weaken other tasks' checks.
- Added lifecycle and read-only SQLite helpers, provenance and scoring documentation. Startup embeds the seed, uses DB_PATH and requires no runtime /assets restoration.
- Baseline browser reproduced stale bill controls after a successful write and protected shell/details surviving session revocation. Evidence is baseline-results.json and baseline-dashboard.png.
- Patched live-prior bill selection, accrual-cycle locks, correction status updates, atomic finalization validation, approval audit figures and protected audit writes. Replaced frontend app.js for refresh, sign-out cleanup, action pending feedback and modal focus handling. These changes remain unverified.

## Exact stopping point and remaining repairs

finish_repairs.py stopped on its second replacement because a prior Windows default-encoding read had corrupted Unicode. Only its first change (trailing twelve budget sum label) executed. checkpoint.py repaired the mojibake in current task text and made report scripts' reads explicitly UTF-8. Before resuming finish_repairs.py, make its replacement helper safely skip an already-applied new value; otherwise its first already-applied edit will assert. Do not rerun migrate.py or author_tests.py blindly: they would overwrite later edits.

Pending from finish_repairs.py: visible retained re-bill tier breakdowns and batch totals; correct SBC base units; startup failure behavior; safe malformed-cookie handling; CSS touch targets, dark action contrast, reduced motion and narrow detail layout; stripping old JS/SQL comments; standard independent-scoring wording; simplify the lock criterion's unnecessary optional third-period branch to supplied P2. All scripts and project files must keep explicit UTF-8 on Windows.

Then perform full browser journeys with observed UI mutations and separate role contexts: all supplied financial values, both C1 generations, both Kestrel held/approved batches, C5 sequential bank movements, C3/C4 budgets, C2+C7 P1 remittance, C10 plus posted C1 M2 P2 finalization/locks, forgery/duplicate/unauthenticated probes, audit evidence, and two real process restarts after mutation. Inspect screenshots in both themes and viewports. Verify backend-only values are actually shown after mutation, and that proposed contras are distinguished from posted rows.

Check the rubric for independent criteria and scope consistency. The current first-write grand-total criterion deliberately grades assembly separately from component correctness. Audit content similarly grades record fidelity separately. SQLite and APP_MANIFEST checks explicitly allow narrow trusted read-only artifact inspection; do not allow arbitrary source-based grading. Confirm this matches the new 53-rule authority.

Exercise installed RewardKit discovery, aggregation, writer and final scorer with clearly labelled synthetic verdicts, including each failed mandatory criterion, every criterion's reward effect, weight-source changes, malformed values and failure fallback. These are not model/Oracle results. Test lifecycle CWD and unprivileged isolation, packaged-app startup without /assets, and the real ZIP after freezing.

## Environment limitation

An exact agent Docker build was attempted and failed because the configured package proxy hostname ioclrndwg2.ds.indianoil.in could not resolve. Apt therefore could not retrieve its package indexes. Do not claim clean Docker builds passed. Cached ballot-verifier:20260915-r14-local supplies the matching Express, SQLite and Playwright tools for local runtime checks. The temporary utilibill-rubric-r1 container was stopped at checkpoint; it is disposable and contains only copied task code and local test state.

## Other task decision evidence

Common Ground r14 has extensive local checks but no fresh platform QC/Oracle/GPT. Prior r11 Oracle was 0.9206, Functional 0.8676; GPT 0.3716, Functional 0.1471. The current r14 reward=[] conflicts with the newly supplied TXT's named nonempty aggregate requirement; resolve that before a fresh upload. Do not blindly send r14 as guaranteed QC-safe.

Pellmoor current r11 repaired its positive weights and named reward schema, but still needs platform QC and fresh Oracle/GPT. Prior uploaded r7 Oracle was 0.8386; GPT zero involved browser-launch and submitted-app errors, so it is weak evidence of intended model difficulty. Its latest summary is deliverables/pellmoor-job-pipeline/README.md.
