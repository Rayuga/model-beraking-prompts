Coursemark run analysis and repaired package — 14 September 2026

The imported Oracle zero was caused by a broken verifier configuration before grading. The updated task repairs that defect, fixes demonstrated golden bugs, and adds six explicit Functional criteria addressing the submitted apps' real weaknesses. The ZIP keeps task version 1.0.0. It is prepared for a fresh platform QC/Oracle run; Oracle = 1.0 is not yet confirmed.

The imported GPT > 0.7 score is not present in these exports. GPT, Haiku, Gemini and Oracle each have reward = 0, graded = 0, no_op = 1 and no criterion verdicts. Their rewardkit.log files all stop during discovery because names such as `Color and contrast` contain spaces; the provider schema requires `[a-zA-Z0-9_-]{1,64}`. Nop also has an ungraded fallback zero, but because there is no submitted app. None of these zeros measures task difficulty or proves an app failed every criterion. The common imported task checksum is `0da9906bf94a0035e0dd99618804e4baaae83dc1c52157e26652ccd8c6fa18b5`.

See [imported metadata](imported-run-summary.json), [real RewardKit discovery before/after](rewardkit-discovery.json), and [renamed criteria](criterion-name-fix.json). All five dimensions now load through the real RewardKit parser. The six Visual criteria, anchors and weights are preserved; five invalid display names were replaced with valid identifiers. Runner diagnostics now distinguish missing app, configuration failure, readiness failure, judge failure and malformed scores.

For a meaningful comparison, each exported app was copied into a separate disposable container with the original seed and a fresh database. API paths and payloads were adapted to each submission. These are 20 targeted HTTP observations, not platform criterion verdicts or weighted scores. Cached image `coursemark-tests:1.0.17` supplied runtime dependencies; it is not proof that every declared dependency or final Dockerfile builds. The original submissions and imported evidence were not changed.

| App | Local passes | Local failures | Untested |
|---|---:|---:|---:|
| GPT-5.4-mini | 10 | 10 | 0 |
| Claude Haiku 4.5 | 12 | 7 | 1 |
| Gemini 3.7 Flash | 14 | 5 | 1 |
| Updated golden | 20 | 0 | 0 |

GPT passes basic sign-in rejection, distinct bearer sessions, cross-student read refusal, active-attempt key filtering, first expiry settlement, basic draft creation and replay, valid grading, score upper bounds, the 4.5 total and logout revocation. Its ten failed observations reveal seven substantive weaknesses:

- `true` is accepted as revision 1 and creates a draft; revision advances from 1 to 2.
- Nora can replay Ada's successful draft request and receive its private title with status 201. Receipts are looked up by operation ID before the acting user's authority is checked.
- The same create receipt is returned from a different publish route, also status 201.
- An unparseable opening date is accepted as a new draft, status 201.
- Rubric `null`, Boolean and empty-string values each return 200 and advance the revision; all should be rejected.
- The student's submit response and audit data expose unreleased objective score 0. Zero must remain private too.
- Submitting after writes records 12:10 although the reference moment is fixed at 12:00. The source derives its clock from revision count.

Haiku additionally exposes the answer key `Transect` in Nora's active attempt. AT-103 becomes submitted with objective score null instead of graded with 5. Completing AT-101 rubric rows produces rubric score 4.5 but leaves objective score null, so the required derived total is absent. It also accepts invalid dates and reuses receipts across routes. Haiku does correctly reject the tested invalid rubric score types.

Gemini passes the tested actor isolation, cross-route rejection, date validation and fixed clock checks. It still accepts the three invalid rubric score types and leaks unreleased score 0 in both submit and audit responses. Its cross-route refusal is 400; that counts as a rejection in this historical comparison. The updated brief explicitly requires mismatch 409. Haiku and Gemini were at revision 0 when the Boolean-revision probe ran, so that observation is untested rather than passed. No conclusions about their whole UI or full rubric follow from these probes.

The complete local observation matrix follows. Evidence includes status codes, revision deltas and relevant score fields in [GPT](gpt-comparison.json), [Haiku](haiku-comparison.json), [Gemini](gemini-comparison.json) and [updated golden](oracle-comparison.json). Missing evidence never counts as a pass.

| Local observation | GPT | Haiku | Gemini | Updated golden |
|---|---|---|---|---|
| wrong password and anonymous reads | PASS | PASS | PASS | PASS |
| four accounts issue distinct bearer tokens | PASS | PASS | PASS | PASS |
| students do not receive keys in active attempt | PASS | FAIL | PASS | PASS |
| student cannot read other students attempt | PASS | PASS | PASS | PASS |
| expired attempt settled once at fixed reference | PASS | FAIL | PASS | PASS |
| boolean revision does not authorize a write | FAIL | Untested | Untested | PASS |
| create draft success and exact replay | PASS | PASS | PASS | PASS |
| receipt cannot cross actor authorization | FAIL | PASS | PASS | PASS |
| receipt is bound to route | FAIL | FAIL | PASS | PASS |
| invalid calendar dates rejected | FAIL | FAIL | PASS | PASS |
| valid rubric save positive control | PASS | PASS | PASS | PASS |
| rubric rejects null | FAIL | PASS | FAIL | PASS |
| rubric rejects boolean | FAIL | PASS | FAIL | PASS |
| rubric rejects empty string | FAIL | PASS | FAIL | PASS |
| rubric rejects over max | PASS | PASS | PASS | PASS |
| complete rubric derives total 4 5 | PASS | FAIL | PASS | PASS |
| submitted score is private in write response | FAIL | FAIL | FAIL | PASS |
| unreleased scores are private in audit | FAIL | FAIL | FAIL | PASS |
| course actions keep fixed reference time | FAIL | PASS | PASS | PASS |
| logout revokes both sessions | PASS | PASS | PASS | PASS |

The original 49 criterion IDs are retained. Functional now has 31 criteria and the task has 55 overall. Six added criteria cover fixed time after writes, privacy across responses/replays/audit, account-scoped receipts, method/path/input receipt binding, server authoring validation and typed write metadata/server-owned fields. The existing numeric grading criterion increases from weight 0.5 to 4.0. New criterion weights are 4, 4, 4, 3, 3 and 3. These areas govern grade confidentiality, authorization and durable integrity; they should contribute more than a basic view or manifest check. The 60% Functional / 20% Polish / 20% Visual formula and all operational timeouts remain unchanged.

The brief now explicitly documents the new expectations before the agent starts. Tests must discover each app's actual API and legitimate UI flow, use fresh revisions and unpredictable identities, and prove rejected writes leave records/revision/audit unchanged. Receipt namespace setup uses a second fresh instructor identity so a student's earlier rejected request cannot contaminate the positive control. A current-revision array tests coercion without accidentally passing merely because a scalar is stale. Gates require a real anonymous context before and after its own exact wrong-password attempt. Criteria require independent evidence and continued evaluation after individual failures.

A conditional difficulty check: the seven strengthened criteria above have weight 25 of 48.75. If an app fails all seven, even perfect scores everywhere else yield Functional <= 0.487179 and overall <= 0.692308. This is score arithmetic, not a measured GPT result or a promise about a new GPT implementation. A fresh run may fix some defects, and actual Visual/Polish scores are unknown. Do not tune against the fallback zeros or claim the requested range has been empirically achieved.

The old golden also accepted Boolean `true` as revision 1. Its request fingerprint was sensitive to JSON key order; scalar authoring numbers used permissive coercion; empty multiple-choice options were silently removed; malformed option containers could cause a 500; extra server-owned fields were ignored; date entry used the browser's local timezone; and question-detail content lacked dialog padding. The repaired golden validates types and allowed fields, canonicalizes JSON object keys, rejects invalid question data safely, uses explicit UTC form labels/parsing and gives detail dialogs consistent padding. Existing private serializers and actor-scoped receipts already worked and remain in place. [Baseline local evidence](comparison-before/oracle-comparison.json) records the reproduced revision defect.

Validation completed:

- Real RewardKit discovery: old configuration fails with the imported error; repaired configuration loads all five dimensions.
- [134 template checks](standard-check.json), including exact config keys, networking, judge configuration, timeout nesting and 60/20/20 reward formula.
- [17 original regression groups](regressions.json) and [7 new regression groups](hardening.json) pass. These include real Chromium workflows, a browser in Asia/Kolkata, independent account receipts, score privacy, malformed requests, stale tabs, release and actual process restart persistence.
- The actual runner exercised a clearly labelled synthetic five-dimension result of 0.58 to check aggregation and CTRF output. This is a runner fixture, not an Oracle result. Ten postprocessor cases cover gates, missing values, booleans, nonfinite values and range errors.
- [24 screenshots](visual-review/index.json) cover sign-in, all five views, student assessment view and five dialog types at 1280x800 and 375x812. Capture waits for transitions to finish; all pages fit the viewport. Actual visual inspection found and repaired detail-dialog padding. Visual = 1.0 still requires the real judge; anchors were not relaxed.

Exact image build attempts are logged in [environment build](environment-build.log) and [verifier build](verifier-build.log). Dependency network failures prevented clean build validation: Debian package retrieval stalls and PyPI retrieval times out. The environment build was stopped after more than five minutes without progress beyond Debian retrieval. Cached-runtime checks are diagnostic evidence only. All 24 regression groups also passed against the extracted final ZIP; its SHA-256 is `b90108e396d26dab0db77606045ae3c67407565807499615ac8a878236d6a46f`. No judge API credential is configured locally, so a full paid Oracle/model run and platform QC were not performed. The next verification is a fresh Oracle and model run on the exact ZIP checksum, requiring graded = 1 and populated criterion verdicts. Inspect real failing evidence if Oracle is below 1; do not reinterpret another fallback zero as a score.

The task ZIP is [coursemark-assessment-workspace.zip](coursemark-assessment-workspace.zip). Reports, screenshots, local probes, original snapshots and hashes stay outside it. [Package verification](package-verification.json) records the exact archive hash and file hashes. The historical delivery remains intact.
