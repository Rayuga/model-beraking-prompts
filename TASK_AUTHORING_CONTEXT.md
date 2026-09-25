# Current WebDev Task Authoring Context

## September 17: Manual checklist audited against final nested ZIP

User asked whether the final delivery meets the supplied manual QC checklist and
has no unwanted comments. Audited the actual nested task ZIP from the final
download bundle. Report:
`deliverables/common-ground-ballot/submission-preparation-20260917/MANUAL-QC-REVIEW.md`.
36 checks pass; two points flagged. Config keys/operational timeouts/verifier.env
match Bazaarbridge exactly; max reasoning; no API-key mentions in the three
specified files; five tests/ verifiers, no judge/model override keys. Reference
literal version is1.0.0 (without v), and folder is tests/ (not test/).

Requested literal reward block is absent: current private scorer derives weights
from judge.toml and is mathematically equivalent. Verified delivered scorer in
1109 cases, including both gates and latest GPT score. Do not claim literal-code
compliance. Earlier platform single-weight-source correction explains the form,
but latest user requirements take precedence for any requested repair.
README retains r25/r26/r27 history, old counts and r24 scores; unnecessary in a
clean final handoff. Code comments are operational, no TODO/FIXME/HACK/debugger.
No task/ZIP/document/score changes made for this check. Frozen r27 provenance
remains intact; changes should produce an explicitly separate revised package.

## September 17: Common Ground final seven-file delivery completed

User clarified final delivery means the evaluation DOCX, case-study DOCX, task
ZIP and named run ZIPs in the format used by other completed projects. Matched
Gambit Hollow, Dropline Four Connect and Patchpad Editor v3 final submissions.
Bundle: `deliverables/common-ground-ballot/common-ground-ballot-final-deliverables.zip`.
Individual seven files: `deliverables/common-ground-ballot/final-submission-20260917/`.
Audit/scripts: `deliverables/common-ground-ballot/submission-preparation-20260917/`.
Bundle SHA256 `e77e9d400bb041d60e618a026ffe12df3ef1a9b7634873639175de567863174e`.

Files: unchanged r27 task ZIP; Oracle job ZIP including NOP; latest GPT high,
Gemini and Haiku job ZIPs; EVAL-REPORT-common-ground-ballot.docx (11 pages),
CASE-STUDY-common-ground-ballot.docx (3 pages). Both rendered in Word, bounds
checked and representative pages visually inspected. All 237 run files preserved
byte-for-byte; no exclusions or credential redactions. All 29 task hashes match
r27/source; final task ZIP passed 294 checks. No task, golden or scores changed.
Oracle1/GPT0.5788, GPT Render/Constraints1. Caveats retained in both reports:
Oracle is reused export; some deductions are incomplete evidence; no platform
QC report or Sonnet export; one measured sample is not a repeatability guarantee.
No paid run, browser regrade, Docker build or platform upload during packaging.

## September 17: Fresh GPT rerun meets the target (latest measured status)

Report: `reports/common-ground-ballot/2026-09-17-r27-rerun/README.md`.
New GPT 3pecCc8: final0.5788, Functional0.3357, Polish0.9286, Visual0.9583,
Render1, Constraints1. Observed full fresh create/open/vote/close/publish/reload
journey. All66Functional verdicts returned:34yes/32no, earned34.75/103.5weight.
Some nos cite incomplete evidence/dependencies, not independently proven defects.
Edit404 is in saved network evidence; judge observed Retry emitting no request.
GPT grading52m16s, total69m02s. No judge timeout, crash, or missing verdict output.

Supplied Oracle iBeMVH2 still1.0000/all86full, but SAME run as prior batch;
do not call it a second Oracle pass. NOP cQy8rSn also reused. New Haiku pWxzQKF
scores0 from failed Create400/Render; new Gemini97FPuUp scores0 because visible
login sends operation_id rejected400. Gemini was graded normally this time.
All graded trials have86verdicts and returncode0 for all5dimensions, no exceptions.
All trial task checksums and verifier hashes agree withr27; Oracle files match.
ZIP and all29packaged hashes rechecked; immutable archive unchanged.

Keep r27 frozen. Target achieved in one fresh GPT sample with0.0212margin;
not a repeat-run guarantee. Separate platform Static/Rubric QC still not supplied.
Only reports and status indexes changed. Historical first-batch failures below
and prior diagnostic calibration do not describe this newer GPT submission.

## September 17: GPT Render calibration after fresh r27 analysis

User wants GPT to pass Render and still score <=0.6, rather than relying on a
gate-zero result. Report: `reports/common-ground-ballot/2026-09-17-render-calibration/README.md`.
Two server response repairs applied only to a disposable copy of GPT dD7G3yM:
load complete eligible ballot details for Vote; populate staff Turnout arrays.
Actual browser then navigated all six workspaces and completed new single-choice
and Approval create/open/vote/close/publish journeys, retaining published results
after reload and exact vote receipts after publication. No browser errors.
Vote revisions stayed unchanged. Ordinary draft editor still has empty choices.
This is a human diagnostic repair, not a scored model submission or new release.
Original run artifacts, r27 golden/task/verifiers and ZIP remain unchanged.

Fixed-other-scores Render-pass counterfactual is0.40468, not a prediction: voting
fixes also raise Functional and may improve Polish/Visual. At old P/V the <=0.6
target requires F<=0.5079. Keep Render checks intact. Recommended next measurement
is another GPT sample on r27; if basic failures recur, a separately versioned
public smoke-test/foundation improvement needs fresh Oracle/model/QC runs.
Separate platform rubric acceptance remains unconfirmed without that report.

## September 17: First r27 platform runs analyzed (historical first batch)

Report: `reports/common-ground-ballot/2026-09-17-r27-fresh-runs/README.md`.
All five trial provenance hashes match r27; Oracle app files match its golden.
Common task checksum `9c16b198807d890250b03d4c1c56efb8870ca6bd0c4de9b4d6e59c5cdf5b8210`.
Oracle iBeMVH2: 1.0000 all five dimensions, all 86 verdicts full credit, no
exception. Grading 3944s (65m44s), Functional 2370s (39m30s), within budgets.
GPT dD7G3yM / gpt-5.4-mini: final0, F0.1824, P0.6429, V0.8333, Render0, C1.
Haiku XM5sBfb: final0, F0.2077, P0.8571, V0.9167, Render0, C1. NOP cQy8rSn0.
Gemini JSzQGy9 / gemini-3.7-flash: ApiRateLimitError, provider monthly spending
cap HTTP429, graded0/no_op1; invalid difficulty sample. Rerun only after cap
is resolved. No platform rubric/static QC report is in the new folders.

Independent disposable replays prove GPT workspace drops vote choices and
turnout arrays, so voting has no choice controls and Turnout throws TypeError.
Haiku vote SQL selects nonexistent operation_receipts.id and returns500.
The GPT round_success_receipt claim that replay reopens Closed is contradicted
by an independent replay: original receiptOpen, current recordClosed rev3 before
and after. This checks only that claimed defect, not every criterion condition.
Many other Functional nos cite missing evidence; do not describe all as proven
independent backend bugs. The reproduced Render failures still make final0 valid.

Recommendation: keep r27 unchanged; measured Oracle1/GPT<=0.6 achieved this batch.
Do not promise repeated-run guarantees or platform53/53 without its report.
Analysis only: task/golden/rubrics/weights/timeouts/ZIP and run outputs unchanged.
Earlier r27 local report accurately records what was known at packaging; this
fresh measured status supersedes its pending-score statements.

## September 17: Common Ground recheck r27 (current candidate)

ZIP: `deliverables/common-ground-ballot/2026-09-17-review-safety-r27/common-ground-ballot.zip`.
SHA256 `76b8cceb5eb22b2a48df6d53d58f647814516722b4beed6e8f7d7fef625cc578`.
Report: `reports/common-ground-ballot/2026-09-17-review-safety-r27/README.md`.
Latest user asked to test golden and rubric one more time. The frozen exact r26
ZIP passed its 96 existing checks, but a new held reviewed-save test reproduced
three client failures: choices could re-enable Save, Discard stayed enabled, and
a late reply closed a newer form. r27 fixes the in-flight review guard/controls
and response ownership. Existing golden server is unchanged.

Two existing round rubric gaps closed: paused -> active -> paused revision race,
and membership-revision-only collision under an original round receipt ID.
Round replay now retains four original refusals (draft plus three roster races).
No instruction, weights, criterion IDs, runtime or four nonfunctional verifiers
changed. Only client app.js, Functional judge/prompt and README differ from r26.

101 browser checks pass: 45 core + 19 round sequentially on one database,
7 review + 4 review race + 7 identity + 19 helper. All eight round mutants are
detected; 30 runner and 294 ZIP checks pass. Five verifiers,
86 criteria, 66 Functional criteria, total weight 103.5. Local 53-point rubric
review and 66-row coverage map retained. All scripts/evidence are outside ZIP.

No fresh autonomous Oracle/model/platform QC run: provider credential absent.
The runner uses explicit offline verdict doubles; actual browser, SQLite and
MCP behaviors are real. Cached dependency images reused. Latest supplied actual
scores remain r24 Oracle 0.9521/GPT 0.7885. Old GPT conditional projection 0.5849
is not a fresh result. Full autonomous duration and subjective scores remain
unmeasured. Do not promise Oracle 1 or platform rubric acceptance.

## September 17: Common Ground atomic rounds r26 (superseded by r27)

ZIP: `deliverables/common-ground-ballot/2026-09-17-atomic-rounds-r26/common-ground-ballot.zip`.
SHA256 `232fe14216cfad2b1f5168866573654b2707992ae44aefb7581b684bdf7a299a`.
Report: `reports/common-ground-ballot/2026-09-17-atomic-rounds-r26/README.md`.
User approved targeting GPT0.6 or below. r26 adds public/golden atomic reviewed
rounds: multi-draft review/cancel, complete draft/roster revision validation,
all-or-nothing opening, canonical original success/refusal receipts, whole-round
pending recovery and current-state refresh. Nine Functional owners add30weight;
old weights unchanged; total103.5. Five verifiers,86criteria,66Functional.
Only nine task files differ fromr25; other20 including all four nonfunctional
verifiers, Dockerfiles/runner/helpers/starter/seed/config/timeouts are unchanged.
Generic single-ballot persistence explicitly excludes round-record persistence
to avoid paying twice. Role and input owners are separate. Round types exercise
both ballot and membership versions; preserve Leila at revision1 until that test.

96 golden browser checks pass (18rounds+78existing);6newroundmutants detected;
7previousGPT replay checks;30runner and294ZIP checks. Model verdicts in runner
checks are mocked. RealMCP/browser, unprivilegedNode/SQLite restart, held initial
round reply, actual Retry and receipt comparisons were exercised. Cached Docker
dependencies reused. No fresh scoredOracle/model/platformQC: local provider
credentials unavailable. Old GPT projection0.584886 is conditional, not a new
model run. Latest actual platform scores remain r24Oracle0.9521/GPT0.7885.
The prior draft-review/account/revision-evidence repairs are retained.

## September 17: Common Ground conflict review r25 (superseded by r26)

ZIP: `deliverables/common-ground-ballot/2026-09-17-conflict-review-r25/common-ground-ballot.zip`.
SHA-256 `ce08f8acb5d2bf7f26474675fb738155079a67ec5cb0fe7b425f0ae044b7f6b3`.
Report: `reports/common-ground-ballot/2026-09-17-conflict-review-r25/README.md`.
Supplied r24 runs replace the previous active output folders: Oracle eSkNnNN
0.9521/F0.9202, all other dimensions1; GPT5.4mini pArUoq4 0.7885;
Gemini0.7777, Haiku0.5542, NOP0. Provenance matched frozen r24 before edits.
Oracle had two missing observations, not a timeout: pre-vote revision and a
PATCH-only Retry matcher missing GET /api/me with a 200 signed-out body.

r25 explicitly captures pre-vote checkpoints and the complete authentication
chain, corroborating signed-out preflight with a denied protected read. Adds
natural brief and golden client for three-way draft review: disjoint/matching
merges, explicit choices on title/context/atomic voting definition, second-edit
conflict with kept working copy, discard and lifecycle stop. Six new criteria
total14weight; previous weights unchanged; Functional total73.5,57criteria;
77overall,5judges. Existing cross-tab criterion now tests closing its in-flight
Retry owner and recovery in the surviving tab. Same-profile tooling is explicit.
Late-reply account isolation is the sixth new criterion. Receipt comparisons
remain owned by refusal_receipt_after_state_change (three saved refusals now).
Eight task files changed;21unchanged, including server/seed/starter/Dockerfiles/
runner and all four nonfunctional judge/prompt pairs. Standard version/config/
timeouts/score formula unchanged. Functional prompt r25; others unchanged.

78golden browser checks (7review,7identity,19recovery,45broad),6mutants,30runner,
294ZIP pass. Golden locked-save CSS issue fixed during iteration. Pinned real
MCP checks use the helper and actual browser; runner verdicts are offline doubles.
Actual previous GPT app replay confirms missing review, late feedback into Leila,
unreadable/expired reminder loss and abandoned-owner permanent busy. Initial
same-profile sharing works; do not repeat the old judge's incorrect witness.
Conditional previous-app projection 0.6973 assumes all other old verdicts
repeat; tiny margin, not a new GPT score. Full platformQC/autonomousOracle/model
still unavailable without provider credentials. Do not claimOracle1/QC53of53/
freshGPTunder0.7. Localimage ballot-verifier:20260917-r25-runtime-validation uses
cached pinned dependencies, not clean downloadbuild. Historical ZIPs immutable.


## September 16: Common Ground Oracle transport repair r24 (historical candidate)

ZIP: `deliverables/common-ground-ballot/2026-09-16-oracle-transport-r24/common-ground-ballot.zip`.
SHA-256 `116e38d85b9a8417e71c71d349887733e94472ae3d50ee03b269658a31a7aaf0`.
Report: `reports/common-ground-ballot/2026-09-16-oracle-transport-r24/README.md`.
The user added five r23 trials: Oracle N3HksDo reward0.4/F0, other dimensions1;
NOP0; Haiku4.5 reward0/F0.1239 plus agent exit exception; GPT5.4mini reward0/F0
with hidden wrong-password rejection; Gemini3.7Flash reward0/F0.6429, hidden
wrong-password rejection plus agent authentication exception. Full audit saved.
All exported provenance hashes match frozenr23; Oracle app matches golden.

Oracle Functional ended in111.77seconds, not a timeout. Helper filename under
/opt was outside MCP's /app allowed roots. Judge copied it into/app, then its
first wrong-password capture matcher used newURL in the unsafe-codeVM, where
URL is undefined. The unguarded request listener raised ReferenceError and
terminatedMCP;51Functional criteria were untested. Exact call and both faults
reproduced on pinnedMCP0.0.79 with process exit1; record in reproduction/.

r24 sets Functional judge.cwd=/opt/common-ground-verifier, and guards helper
observation/interception matcher callbacks. Sync exceptions, async rejection and
nonboolean matchers become retained evidence-missing results and clean up without
killing MCP. Prompt explains safe string predicates and correcting/recollecting
tool errors. No code copied intoapp or unrestricted file access added. Four
files changed: README,Functionaljudge,Functionalprompt,test.sh(helperbodyonly).
All71criteria,weights,timeouts,golden,brief,starter,scoreformula unchanged.
Functionalprompt nowr24, Render r22, othersr20. Five judge passes remain.

Exact crashing call now returns retained error; the same MCP session completes
all auth probes.9resilience +19realMCP recovery +30runner +294ZIP checks passed.
Cached dependency image, not fresh downloadbuild. No local provider credentials
available for fresh scoredOracle. Full autonomous completion/platformQC/newmodel
scores remain unverified. Do not claimOracle1 or treat oldr23 asOracle-ready.
Earlier current-candidate notes below are historical.

## September 16: Common Ground timeout and vote-revision repair r23 (historical candidate)

ZIP: `deliverables/common-ground-ballot/2026-09-16-budget-revision-r23/common-ground-ballot.zip`.
SHA-256 `e0a9d37a0ec9188749abdc46808c19c97a4124e1939b2c96e2c5d8de29145798`.
Report: `reports/common-ground-ballot/2026-09-16-budget-revision-r23/README.md`.
Latest screenshot: static45/45, rubric51/53. New findings are mandatory-gate
timeouts and lack of accepted-vote revision stability coverage. Render now1800,
Constraints1200, Functional7200, Polish900, Visual900 seconds; total12000 still
fits runner12600 and standard verifier13200. Task.toml/env/agent limit unchanged.
New0.75 Functional criterion accepted_votes_preserve_ballot_revision reuses
Phase B's existing two single-choice votes and approval vote with fresh before/
after reads. Existing50Functional criteria unchanged. Five dimensions,71criteria
(2/2/51/10/6). Functional prompt r23; Render r22; others r20. No golden or brief edit.

Real pinned-MCP golden test: single4->4 twice, approval2->2. Three disposable
mutants (all votes, single only, approval only increment revision) were caught.
Every mutant still passed relative Close+1, reproducing the screenshot loophole.
30runner checks,4offline budget/scoring groups and294ZIP checks pass. Only five
task files changed fromr22;24unchanged. The r22 working-product floor gate remains.
Initial report-driver syntax/reload errors were fixed and excluded from passes.
Cached dependency image; no fresh download build. Full autonomous timing,
platformQC and scoredOracle/model remain unverified. Do not promise53/53,Oracle1
or a new model range. Earlier current-candidate entries below are historical.

## September 16: Common Ground working-product gate r22 (historical candidate)

Current ZIP: `deliverables/common-ground-ballot/2026-09-16-product-gate-r22/common-ground-ballot.zip`.
SHA-256 `68786691e1f87a0a747fe6e40b52d48b420da73394267ec652cf8afcc983aeb2`.
Report: `reports/common-ground-ballot/2026-09-16-product-gate-r22/README.md`.
Latest screenshot: static 45/45, rubric 52/53; only read-only product reward floor
failed. r22 adds one Render all_pass prerequisite: create/Open/member vote/Close/
Publish one fresh ballot, then confirm saved outcome in both reloaded contexts.
Only Render judge, Render prompt and task README changed; 26 other files match
r21 exactly, including natural brief, golden, helpers, weights and timeouts.
Five dimensions, 70 criteria (2/2/50/10/6), task version1.0.0; only Render prompt r22.

Pinned real MCP golden journey passed twice on the same DB. Read-only and
create-only controls captured405; publish-no-op returned200 but fresh read stayed
Closed. Actual RewardKit/scorer with those observed gate results and every other
criterion assumed1 gives all three controls final0. This is an upper-bound check,
not a scored Oracle/model run. Initial403 control diagnostics timed out and are
preserved as failed harness attempts, not successful mutant detections.
Installed scheduler with only agent responses mocked proves serial alphabetical
order and peak concurrency1; Functional seed checks precede Render's new fixture.
30 runner checks and294 ZIP checks passed; cached dependencies, not a fresh clean
download build. Fresh platformQC/fullOracle/model scores remain unverified.
Do not claim Oracle1,53/53QC or a new model range. Earlier current-candidate notes
below are historical; use this entry and its report.

## September 16: Common Ground natural brief r21 (historical candidate)

Current ZIP: `deliverables/common-ground-ballot/2026-09-16-natural-brief-r21/common-ground-ballot.zip`.
SHA-256 `ade223827808dd8f1f31d395377df52616e1eadd1ed3f8cd1b5c145fa5009308`. Report: `reports/common-ground-ballot/2026-09-16-natural-brief-r21/README.md`.
Latest user screenshot reports static45/45 and rubric51/53, failing only natural
product-request voice and natural human voice. Model/Oracle skipped. r21 rewrites
ONLY instruction.md as a conversational product-owner ask and retains precise
business/runtime constraints. All other28taskfiles are byte-identical to r20,
including golden, environment, taskconfig and every verifier. No runtime/model
tests rerun for this prose-only edit. Source259 andZIP294checks pass.
Independent coverage and voice reviews are in the report directory. Fresh
platformQC/Oracle/model results remain unverified. Earlier candidate notes below
are historical; current verifiers still have r20prompt versions unchanged.

## September 16: Common Ground runtime-contract repair r20 (historical candidate)

Current ZIP: `deliverables/common-ground-ballot/2026-09-16-runtime-contract-r20/common-ground-ballot.zip`.
SHA-256 `04d5cbc8cab8c7e71494cdf4b4f4c1acc68a928428d8b65556a759101b028b45`. Report: `reports/common-ground-ballot/2026-09-16-runtime-contract-r20/README.md`.
r19 screenshot failed one static check (44/45): the platform treated private
Python helper launches as missing application entrypoints. r20 uses executable
private commands under `/opt/common-ground-verifier` with explicit Python shebangs
and mode700; no helper enters `/app` or solution/. Functional restart/provenance and
two stale scorer references are aligned. Golden/brief/environment/rubric/weights/
timeouts are unchanged. Five dimensions, 69 criteria, task version1.0.0.
Local: 31 focused contract checks, 30 runner checks
(real golden startup and same-session/data restart twice), 294 ZIP checks.
Platform checker source unavailable; no fresh platform QC/Oracle/model score.
Cached dependencies used; the unchanged Dockerfile clean build had local proxy trouble.
Earlier r18 "latest" notes below are historical and include validation gaps later found.

## September 16: Common Ground verifier repair r18 (latest candidate)

User authorized completing the repair and packaging without permission requests.
Delivered `deliverables/common-ground-ballot/2026-09-16-verifier-repair-r18/common-ground-ballot.zip`,
SHA-256 `35809a2ac0264b81e238bb5c80d670132f67c68c9de075f646504a1577fb88e8`.
41 files; version 1.0.0. Report:
`reports/common-ground-ballot/2026-09-15-verifier-repair-r18/README.md`.

The public brief, seed, golden solution, task metadata/env/timeouts, score.py,
reward.toml and all 68 criterion IDs/types/weights are byte-identical to r17.
Functional now has four phases, immediate retained evidence, valid negative
probe assertions, and one comprehensive final restart instead of duplicate full
restart ledgers. Functional prompt words decreased from 6536 to 3340. The five
judge dimensions remain serial with 1/2/49/10/6 criteria and existing budgets.

New tests/browser-evidence.js loads with the actual Playwright MCP unsafe tool's
filename argument. The MCP VM does not support Node imports or global timers.
It retains captures on the automation Browser object and bounds missing evidence,
interrupted replies, held requests and delivery. Do not reintroduce the removed
direct-send convenience method: it stalled in actual MCP; separate native page
arm/send/collect calls passed. Development failure artifacts are preserved.

New codex-trace.py wraps only codex exec, preserving final-verdict stdout and
exit status while saving redacted events, stderr, output, relevant rollouts and
timing under /logs/verifier/judges/<dimension>/attempt-*/. Dockerfile installs
the wrapper; test.sh exports the log directory; provenance hashes both helpers.

Validation: 179 standard and 472 archive checks; 132 local groups (trace 8,
runtime 5, runner/scorer 19, golden recovery 23, strict boundaries 58, actual
pinned MCP helper integration 19). Tested image is
ballot-verifier:20260915-r18-local; every shipped verifier file matches its
image counterpart. Cached pinned dependencies were used, not a clean download
build. The final archive and frozen tree match source exactly.

No platform execution connector or required local OPENAI_API_KEY/
CODEX_ACCESS_TOKEN was available, so fresh scored Oracle, GPT and platform QC
remain pending. Do not claim Oracle 1.0, guaranteed runtime or a new model range.
This is the repair candidate to upload; r17 remains a known failed historical ZIP.

## September 15: r17 platform Oracle failure (historical result)

The user supplied new platform outputs. r17 is now a known failed Oracle
candidate; do not describe it as Oracle-ready or recommend an unchanged rerun.
Its ZIP remains immutable. Read
`reports/common-ground-ballot/2026-09-15-oracle-failure-r17/run-audit.json`.

Oracle: run-7cc29c66-a32f-4a7a-bb93-bea23993c795, trial PoFcosA, overall 0.7517,
Functional 0.5862, all other dimensions 1. NOP pyc8oFk is 0. The other supplied
run is Haiku (run-da46d1e1-1f11-4019-8af8-2e2c9ff64cba, iK9n9ye), score 0;
it is not a new GPT run. Previous run-output folders have been replaced by the
user; preserved r16/r17 report evidence remains available in deliverables.

All new Oracle prompt/judge/scorer/addendum hashes match r17. Exported golden
server and UI files are byte-identical to the frozen solution. There are five
serial batched browser dimensions, 68 criteria (1/2/49/10/6). Oracle verification
took 2477.748 seconds (41m18s), whole trial 2509.779 seconds (41m50s). It ended
normally with graded=1 and no exception; no timeout is reported. Per-dimension
timings and actual judge trajectories/checkpoint captures are not exported.

Nine Functional failures lose 24/58 weight. All five recovery criteria (20)
were not completed. Roster conflict (2) reports an automation crash before
evidence save; Draft stale refusal (1) used an invalid earlier request and a
later Open target; one-participant staff turnout (0.5) lacks its Ruth capture.
Missing-edit-revision validation (0.5) alleges 200. A fresh pinned MCP 0.0.79
reproduction against a disposable copy of the exported Oracle app returned 400
with unchanged ballot/roster/audit state; a valid subsequent UI edit returned
200. A committed-lost create survived reload and exact explicit Retry resolved
once with the original receipt. All three targeted checks passed; see the new
report's mcp-reproduction/ directory. The original platform request is missing,
so its alleged 200 remains unexplained. Namespace and existing persisted receipt
scenarios passed. The main observed failure is judge orchestration.

The earlier 347 local passes proved bounded scripted behaviors, not completion
of the full autonomous judge workflow. Repair planning must reduce fragile
sequential dependencies and preserve raw judge/evidence logs; increasing the
already 150-minute Functional allowance is not supported by this run. Do not
convert missing observations to passes or tune away required product behavior.
No repaired candidate has been validated by a fresh scored Oracle run yet.

## September 15: Common Ground staff recovery r17 (historical candidate)

Follow-up manual QC/difficulty cross-check: see
`reports/common-ground-ballot/2026-09-15-r17-manual-crosscheck/README.md`.
The unchanged ZIP matches the local canonical commerce reference's 31 key paths,
operational settings/timeouts, version 1.0.0 and exact verifier.env. No original
Jordan BazaarBridge task ZIP is available for byte-level comparison. All five
verifiers and key restrictions pass. The scoring result matches the reference
including its four-decimal rounding, but test.sh delegates to score.py instead
of containing the literal formula. An optional user question about mandatory
inline placement is pending; no scorer or ZIP change was made by this audit.
Do not claim the old GPT is safely below 0.7: a stated counterfactual correcting
evidence-only deductions while applying observed boundary failures gives
Functional 0.5905 and overall 0.7115. This is not a fresh score. Recommendation:
keep scope and run fresh QC/Oracle/GPT before expanding further.

The supplied r16 GPT-5.4-mini/high export scored 0.897 overall, Functional
0.9236, Polish 0.7143, Visual 1 and both gates 1. All five judge/prompt hashes
and scoring hashes match r16. Oracle 1 is user-reported; no matching Oracle
export was supplied. The user requested substantive hardening while preserving
golden correctness.

Current upload: `deliverables/common-ground-ballot/2026-09-15-recovery-r17/common-ground-ballot.zip`.
SHA256 `51465c839d05a23574b787ff7e4d01aeb3118c82cb138d8b3be875ab5d73c3a2`.
39 files, task version 1.0.0. Read the adjacent README and package-audit.json;
raw captures and local drivers are in the matching reports directory. Preserve
the r16 ZIP and all earlier releases.

r17 adds per-person operation namespace coverage plus five independent staff
recovery criteria: retained pending work, immutable retries, independent entries,
account isolation and cross-tab resolution. All six staff mutation families are
covered. Functional now has 49 criteria/weight 58; total criteria 68
(1/2/49/10/6). Original criterion weights and final 60/20/20 allocation/gates
remain unchanged. Golden changes are in the browser UI; server.js, test.sh,
score.py and reward.toml remain byte-identical to r16.

The golden stores immutable attempts before sending and handles lost replies,
old receipts, current-data refresh, multiple entries, same-profile tabs and
account changes. A late 401/403 preserves the owner's reminder without hiding a
newer actor's workspace. Do not add recovery for Member selections or a separate
unsaved-draft feature. Functional recovery.md specifies scoped network faults
and dedicated recovery profiles, preserving the main journey's two-restart
session/receipt/roster/result evidence. Its hash is included in provenance.

Local golden evidence includes 58 strict boundary checks and 23 recovery groups;
the actual pinned MCP recovery smoke adds seven groups. The supplied GPT app
fails nine boundary probes with real accepted writes: two cross-action ID
collisions, array/boolean Draft edit and Open revisions, array membership revision,
and array/boolean approval limits. It passes independent Member namespaces and
original receipt controls. These are diagnostics of the old artifact, not a
fresh model score. Five broken recovery variants are detected; 14 missing or
unweighted archive variants are rejected. ZIP checks: 179 standard/464 archive.
See package-audit.json for complete local group totals and exact image evidence.

Do not treat the old missing-evidence deductions as reliable model defects:
blank multiline normalization was valid, first-restart Member reads were omitted,
and the recorded-participation presentation fixture was not exercised. The new
prompts clarify those checks. Actual Members mobile overflow was reported.
Initial local boundary-driver stalls were fixed by JSON-only response observation
and bounded capture; both first-attempt directories are preserved.

Cached image assembly is verified; a fresh dependency download build and scored
platform QC/Oracle/GPT runs remain unperformed. Local passes cannot guarantee
Oracle 1 or the next GPT band. Run QC then Oracle/NOP and GPT on the exact ZIP;
inspect all 49 Functional verdicts and the model's Functional score separately.
UtiliBill and the other tasks remain unchanged.

## September 15: Ballot v9 coverage QC repair r16 (superseded by r17)

The user supplied a NEW platform screenshot: v9, 37 files, Static 45/45 and
Rubric Source 52/53. The remaining failure is
dimensions_cover_every_graded_requirement, with three real witnesses: color-only
status, Observer denied Members/Audit, and unexplained unavailable actions.
Do not confuse this screenshot with the earlier v8/36-file repeat. The current
source had these omissions and needed a new candidate.

Current upload:
`deliverables/common-ground-ballot/2026-09-15-coverage-r16/common-ground-ballot.zip`.
SHA256 `d198f48916835f68953ad26ea253482f12a0a8587bd2e00b395dce9d473bef1e`.
Read the adjacent README, package-audit.json and qc-repair.json. The matching
reports directory holds raw evidence, screenshots, six app mutants and drivers.

r16 adds four independent Functional Observer read criteria (ballot setup,
published results, Members and Audit) and two Polish criteria (visible status
text without color and unavailable-action guidance). Existing Observer turnout
and write boundaries retain their own checks. Observer reads require populated
UI/protected records, comparison with Ruth, reload and separate verdicts.
There are now 62 criteria: Render 1, Constraints 2, Functional 43, Polish 10,
Visual 6. Old criterion weights/descriptions are unchanged; new reads weigh 0.5
each and new Polish checks weigh 1 each. Totals are Functional 36 and Polish 14;
dimension weights stay 60/20/20 with the same mandatory gates.

The golden adds contextual Draft/Open/Closed/Published explanations and wrapping
CSS. Only six task files changed from r15: public app.js/styles.css and the
Functional/Polish judge TOMLs/prompts. The brief, seed, server, runtime, scorer
and runner are unchanged. New prompt versions are Functional r16 and Polish r8.
Shared checkers add a scoped r16 profile and still accept historical r14/r15.

Frozen ZIP bytes passed 154 standard and 419 archive checks plus all 206 local
groups: browser 45, runtime 5, harness 19, scoring 109, new coverage 6, Polish 3,
actual pinned MCP 19. Full browser and MCP journeys include two real restarts.
Each of six defective app variants fails only its associated new criterion;
all six missing-criterion ZIP mutants are rejected. Agent image inputs match,
and prompt/scorer/runner provenance matches the ZIP. Local helper-only fixes
for mutable ZipInfo CRC metadata and CSS capitalization are documented; neither
required changing the frozen task.

No fresh platform QC, scored Oracle or GPT run exists for r16. Cached verifier
assembly passed; clean Docker builds remain unverified due to the established
local proxy/certificate problem. No live judge credential or Harbor auth is
available here. Upload r16 as a new version, run QC, then Oracle/NOP and GPT on
this checksum. Require Oracle >0.95 with all 43 Functional criteria passing;
review all ten Polish verdicts and inspect GPT Functional separately from the
overall band. Local validation does not guarantee platform acceptance.

## September 15: Ballot Oracle/model candidate r15 (superseded by r16)

The user subsequently supplied the v8/36-file QC screenshot again. A fresh
byte-level r15 recheck found all three reported defects already corrected;
147 standard, 400 archive and 103 scoring checks passed again. Evidence is in
`reports/common-ground-ballot/2026-09-15-r15-screenshot-recheck/`. No task edits
or new ZIP were needed. The screenshot cites obsolete criterion IDs and shows
Oracle/model stages skipped. Upload r15 as a new platform version and rerun QC;
do not treat the screenshot as a fresh r15 Oracle failure.

The user selected Ballot as the next task to finish. UtiliBill remains parked at
`reports/utilibill-metrics-dashboard/2026-09-15-rubric-update-r1/HANDOFF.md`.
Do not upload its work-in-progress archive or restart that work implicitly.

Current Ballot upload candidate, superseding r14:
`deliverables/common-ground-ballot/2026-09-15-oracle-ready-r15/common-ground-ballot.zip`.
SHA256 `1cfa7ce8f032883e18a54ae2975c0a05cf5cdf18c0381c466372e7f5d4ab99b2`.
Read the adjacent README and package audit; full local evidence is under the
matching reports directory. Task version stays 1.0.0; release r15 is a local
revision label. The 37-file ZIP is frozen and matches current project source.

This revision follows the newly supplied root task-implementation.txt, not the
older TOML rubric. It restores a nonempty named RewardKit weighted_mean reward
aggregate before the final gated scorer. Render/Constraints remain mandatory
all_pass gates without final reward mass; judge TOMLs are the sole numeric
dimension weights, retaining Functional/Polish/Visual 60/20/20. Runtime now
permits public/external resources, explicitly defines cwd/DB_PATH/SEED_PATH and
requires an embedded /app seed. The runner no longer restores a missing seed.
Cleanup resets any intermediate positive reward after judge failure or signal.

There are 56 criteria: Render 1, Constraints 2, Functional 39, Polish 8, Visual 6.
Combined observations were split with explicit ownership; total Functional
criterion weight stays 34 and Polish stays 12. Authorization probes now cover
all six privileged write families as Observer and both Members with valid
current-state targets; identity forgery and Published locks are separate.
Receipt, privacy, audit, result and persistence checks retain their distinct
evidence, MCP dialog handling, failed-probe isolation and two trusted restarts.
The golden solution is byte-identical to r14; no additional golden fix was needed.

Frozen bytes passed 147 standard and 400 archive checks. All 237 local groups
passed: browser 45, runtime 5, harness 19, session 7, actual pinned MCP 13,
RewardKit/scoring 103, roles/identity/terminal 40, Polish 3, relative-path and
relocation lifecycle 2. Ten malformed packages were rejected; a reduced-motion
mutant failed only its own criterion. Agent smoke and prompt/scorer provenance
match the frozen files. coverage.json maps every criterion; local-source-review
records all 53 current authoring topics without claiming platform QC success.

No fresh scored Oracle, GPT or platform QC exists for r15. Cached dependency
assembly passed, but both exact clean Docker builds failed on local proxy DNS;
a direct registry probe hit the local certificate chain issue. Harbor is
unauthenticated and direct OPENAI_API_KEY is absent. Do not substitute OpenRouter
for the configured judge contract. These are upload-candidate checks, not an
Oracle pass or a verified model score band. Upload this ZIP, run QC, Oracle/NOP,
then GPT; retain identical checksums and complete exports. Require Oracle >0.95
and every Functional criterion passing. Inspect GPT Functional separately from
the saved 0.1–0.7 overall band; perform final Oracle confirmation after freezing.

## September 15: Gambit Hollow final delivery

The user requested the final deliverable after review of five supplied trials.
The seven submission files are in
`deliverables/gambit-hollow-cribbage/final-submission-20260915/`;
the combined download is
`deliverables/gambit-hollow-cribbage/gambit-hollow-cribbage-final-deliverables.zip`.
Read the adjacent `submission-preparation-20260915/README.md` and bundle audit.

Task ZIP SHA256 remains
`06a4f99349469c181d51b8da5520fa0c8bc02332c0433cbfc0d826b374e57f6a`.
Task/golden/verifier/source were not changed for final packaging. Oracle 0.9833
passes all 40 Functional criteria; GPT 0.6616 is within the saved overall band,
with Functional 0.7083 (29/40). Gemini 0.8134 is above 0.7. Haiku 0 is a real
grade on a partial app after agent exit 143; do not describe it as a normally
completed model attempt. Its final broad pkill command likely killed its agent.
NOP is the expected zero and is included in the Oracle archive. All five share
the same recorded task checksum/digest, and all verifier hashes match source.

The package includes task, Oracle/NOP, GPT, Gemini and Haiku ZIPs plus evaluation
and case-study Word reports. Gemini is not substituted for Sonnet; no Sonnet
export was supplied. Haiku's interruption, Oracle Visual 0.9167, Gemini's high
score and absent platform QC report are explicit in both reports. Packaging
passed 406 archive and 134 standard checks. Word reports rendered to three and
eight pages; originals and exports remain byte-identical. No paid model rerun,
browser regrade, Docker rebuild, platform upload or QC was done for packaging.

## September 15: Ballot Platform QC Repair r14

The user's platform screenshot reports three Rubric Source failures, with
Static Checks 45/45 passed and Oracle/GPT skipped because rubric QC failed.
The screenshot's truncated platform hash has not been matched to a local ZIP.
All three defects also existed in the latest r13 source and are now corrected.

Current Ballot ZIP:
`deliverables/common-ground-ballot/2026-09-15-platform-qc-r14/common-ground-ballot.zip`.
SHA256 `dd8b99af573567fda1462b84299e780716711b07f91066bccf56fd7e43dc0318`.
Read `reports/common-ground-ballot/2026-09-15-platform-qc-r14/README.md`.

Render/Constraints now use all_pass aggregation: any failed mandatory runtime
criterion makes the final reward zero. Health and SQLite checks are independent;
the duplicate root-page-load criterion is removed. Theme, touch and reduced
motion each have separate Polish verdicts, preserving their old combined share.
There are 38 task criteria; these differ from the platform's 53 QC checks.
Judge TOMLs are the sole numeric weight source. reward.toml declares dimension
roles, and test.sh invokes score.py for final composition. RewardKit's formerly
ignored reward.toml weight maps and the runner's duplicate coefficients are gone.
The shared standard/checkers have a scoped Common Ground composition profile;
other tasks retain their existing reference contract. Functional criteria and
60/20/20 dimension weights are unchanged. Golden and all r13 workflow fixes remain.

The exact frozen ZIP passes 129 standard and 341 upload checks, 54 scoring checks,
45 browser groups with two restarts, 13 actual pinned MCP groups with two restarts,
15 runner cases, seven session groups, five runtime groups and three Polish groups.
Every single-criterion failure affects reward; each runtime failure gates to zero.
A broken reduced-motion variant fails only its own check. Seven malformed package
variants are rejected. Coverage and provenance match all 38 criteria and frozen
prompt/judge/scorer bytes. Reports preserve an initial test-driver timing issue:
the corrected theme test waits for the Members response and visible row.

No fresh scored Oracle/GPT or platform QC result exists. Local runtime checks use
current frozen source with cached dependencies; exact clean builds remain blocked
by the previously verified Docker package proxy issue. Upload r14 and rerun platform
QC first, then Oracle/GPT. Do not describe local checks as a platform Oracle pass.

## September 15: Ballot MCP Cross-check r13

The user requested another cross-check to avoid another Oracle failure.
Current Ballot ZIP: `deliverables/common-ground-ballot/2026-09-15-crosscheck-r13/common-ground-ballot.zip`.
SHA256 `7a0b5cae1b78ddbc565f387f925caf1e78106dff6582ba6dd0abe8a51a8765f6`.
Read `reports/common-ground-ballot/2026-09-15-crosscheck-r13/README.md`.

The actual pinned Playwright MCP 0.0.79 check exposed native-confirmation
interruption: a combined End all sessions snippet returned Modal state before
its result was retained. The Functional r13 prompt now splits capture, click,
dialog handling, revocation measurements and fresh sign-in into separate calls,
preserves process-owned capture across calls, and keeps the primary context.
It also removes Courtyard-only replay ambiguity, splits immediate privacy and
approval checkpoints, and explicitly repeats the full approval mismatch and
both successful replays at publication and each restart. Only the Functional
prompt changed from r12. Golden, criteria, weights, gates and config are unchanged.

The exact frozen ZIP passes 45 browser groups, seven focused session groups,
13 groups through actual MCP with two real restarts, five runtime checks,
15 harness cases, 115 standard and 317 ZIP checks. Three broken variants are
detected via MCP, including a server session retained after its browser cookie
is cleared. No scored r13 Oracle/GPT or platform QC result exists. Harbor is
unauthenticated and direct OpenAI judge credentials are absent. Passing local
runtime evidence uses current frozen files with cached dependencies; clean
builds were attempted again and the configured package proxy remains blocked.
The original platform session failure's exact cause is still unproven without
the missing action trace. Run platform Oracle, then GPT, on this same checksum.

## September 14: Ballot Oracle Repair r12

The latest uploaded r11 runs scored Oracle 0.9206 (Functional 0.8676), GPT
0.3716 (Functional 0.1471), Gemini 0.6819 and Haiku 0. The Oracle reported two
missing-evidence checkpoints and a session revocation failure. Original server
revocation passed five local sequences; the export lacks a detailed action
trace to establish why the judge reported survival. Two independently reproduced
golden UI defects are fixed: duplicate concurrent sign-in and false signed-out
feedback after a failed logout request. Functional prompt r12 explicitly orders
session checks and immediate Member-privacy/approval-retry evidence capture.
Only solution/public/app.js and tests/functional/prompt.md changed from r11;
all judge criteria, weights, shared gates, brief, seed and config are unchanged.

Current corrected ZIP:
`deliverables/common-ground-ballot/2026-09-14-oracle-repair-r12/common-ground-ballot.zip`
SHA256 `c3f0306ad09149d201fba755ab14ed4e522498424696a270d021278bfbde8d5d`.
Evidence: `reports/common-ground-ballot/2026-09-14-oracle-repair-r12/README.md`.
Local checks: 45 browser groups with two restarts, seven focused session groups,
five runtime groups, 15 runner harness cases, 115 standard and 317 archive checks.
The shared local ZIP checker template/line-ending mismatches are fixed with 11
regression cases; its previous source is preserved outside the upload package.
Exact clean builds remain blocked by the configured Docker package proxy;
passing runtime evidence uses cached dependencies with current task files.
No r12 scored Oracle/GPT or platform QC result exists yet. Platform rerun is
needed; direct OpenAI judge credentials are absent locally. An OpenRouter
alternative would be a separate diagnostic and has not been run.

## September 14: Ballot Functional r11 Candidate

The user reopened Common Ground Ballot and requested stronger Functional
coverage after the latest GPT run reported Functional 0.7647 (17/22) while a
hidden wrong-password message forced the final reward to 0. Oracle scored 1.0.
See `reports/common-ground-ballot/2026-09-14-latest-run-review/README.md` for
the reproduced login defect and the separate judge inconsistencies.

Active Ballot source now has Functional prompt r11. Three existing criteria
cover malformed roster input with its next opening snapshot, Member privacy
inside protected participation payloads, and approval receipt replay when the
same distinct choice set is reordered. The corresponding instructions are
explicit. All 22 Functional criteria and weights, other dimensions, shared
authentication gates, golden source and runtime configuration are unchanged.

Evidence is in `reports/common-ground-ballot/2026-09-14-functional-r11/`.
The candidate release folder is
`deliverables/common-ground-ballot/2026-09-14-functional-r11/`.
Candidate ZIP SHA256:
`ceb9b72cc4e47335ebf8a3192efa81b6daa52a1715a0f4c3f3f03d21bae1bec8`.
Read its README and package audit before upload. Focused local tests pass on
the unchanged golden source and expose all three gaps in the captured GPT app;
45 golden browser groups pass with two real restarts. These are local checks,
not new Oracle/GPT scores. Clean image builds are blocked by Docker's package
proxy; cached-dependency validation and generic ZIP-check compatibility are
documented separately. The frozen r10 ZIP below remains historical evidence.

## September 14: Submitted Tasks Closed; Gambit Is Next

The user confirms that GridForge and Coursemark are completed and submitted.
Do not resume their older conversion, packaging or WIP notes below unless the
user explicitly reopens them. The user requested a context-only push after
adding the next task, `projects/gambit-hollow-cribbage/`.

Gambit's original 28-file baseline is committed as `c52e6c0`. Its 10 JSON/TOML
files and six JavaScript files passed parsing checks, but it is not an
upload-ready release: it still uses the older four-dimension template, old
network/runtime settings and the previous reward formula. Follow the current
`TASK_TEMPLATE_STANDARD.md` and dated lessons when work on Gambit begins.
No Gambit Oracle, platform QC or model run was performed during this import.

Pending GridForge/Coursemark source, reports and delivery changes were removed
from the working tree without deleting their committed project folders. A
machine-local recovery stash preserves them at
`115c6c9e78e2072bb10bc8d09ad4539038778244` (September 14 submitted-task backup).
That stash is not pushed and is not available automatically on another device.
Some historical report/delivery links below therefore refer to local recovery
material, not files guaranteed to exist in a fresh clone. Raw Ballot/GridForge
run exports are also retained locally and ignored by Git. Keep this context and
the reusable QC lessons; do not reintroduce the archived task edits by default.

## September 14: Ballot Shared Authentication Gate Fix

Current Ballot upload:
`deliverables/common-ground-ballot/2026-09-14-auth-gate-r10/common-ground-ballot.zip`
SHA256 `5fff33f3965408f49f5d873295f1935a1f88d271964c275ef8579a1585c5a85c`.
Read [the latest handoff](reports/common-ground-ballot/2026-09-14-auth-gate-r10/HANDOFF.md)
and [September 14 lessons](TASK_LEARNINGS_2026-09-14.md).

User-reported previous platform result: static 45/45, rubric 52/53. The genuine
failure was the shared browser gate checking good login without mandatory
anonymous protected-read denial and bad-password refusal in every dimension.
All five prompt blocks now include these checks, response-body privacy and
fresh-context isolation. No change to criteria/weights, app, brief, seed or config.
Versions: Render r3, Constraints r3, Functional r10, Polish r5, Visual r3.
Local results: 32 browser groups, 15 harness cases, 5 runtime groups, 9 detected
broken variants, 115 standard checks and 55 focused gate-wording checks.
No fresh platform QC, Oracle or paid model run; do not promise their scores.
The dated r9 release below is preserved historical evidence, not the current ZIP.

## September 13: Ballot Stateful r9 And Coursemark Pause

Latest user priority is Common Ground Ballot. Read
[September 13 lessons](TASK_LEARNINGS_2026-09-13.md) and
[Ballot r9 handoff](reports/common-ground-ballot/2026-09-13-stateful-r9/HANDOFF.md).
Scored r7 upload: Oracle 0.9917 with 19/19 Functional; GPT 0.9595;
Gemini 0.6809; Haiku 0.2762; NOP 0. The r9 checkpoint ZIP is
`deliverables/common-ground-ballot/2026-09-13-stateful-r9/common-ground-ballot.zip`,
SHA256 `1f2b0b28261c1e26561144b6b71db4a9e53aa2754e7e1bd162bb275f0d7f915c`.
User approved the deeper scope: staff success receipts, competing roster
revisions with downstream snapshots, and durable domain refusals. Requirements
are explicit in the brief. Functional r9 has22 criteria, total36; existing
criteria are unchanged and three new groups carry2.0 each. Polish remainsr4.
Public network, task1.0.0, central judge and dimension formula are unchanged.
Golden source/seed match corrective r8. Local results:27 browser groups with two
real restarts,15 harness cases,5 runtime groups,6 detected mutants and115 standard
checks. All53 rubric points reviewed locally. No new platform QC, Oracle or paid
model build occurred. Captured r7 apps were tested locally without modification;
new-scope omissions are not retrospective failures. A below0.7 GPT result is
still unconfirmed; the report explains why even these additions do not guarantee it.

Coursemark conversion is paused at its validated checkpoint. Resume from
`reports/coursemark-assessment-workspace/2026-09-13-conversion/HANDOFF.md`.
Do not rerun the one-time migration or discard its working-tree changes.
Pellmoor was not changed. PatchPad, Brickfall and GridForge remain outside this
Ballot work. Preserve all unrelated edits and historical run artifacts.

## Latest User Target: Golden Visual Quality (2026-09-12)

For new tasks after the current GridForge v3 submission, target Visual = 1.0 on
the golden Oracle too. See `TASK_TEMPLATE_STANDARD.md`, Future Golden Visual
Target. Validate actual desktop/mobile surfaces, revision previews and secondary
states, and fix the app rather than lowering judge requirements. Do not claim
full Visual marks until the frozen package has an Oracle result demonstrating it.
Existing GridForge v3 evidence remains Oracle 0.9833, Functional 1.0, Visual
0.9167; no retrospective score change or new gate is authorized. Its GPT zero
and recorded audit caveats must remain visible in the delivery reports.

Updated: 2026-09-11

Today's complete lead guidance, QC and Oracle lessons, fixes, and open decisions
are recorded in [TASK_LEARNINGS_2026-09-11.md](TASK_LEARNINGS_2026-09-11.md).

Latest PatchPad correction: `1.0.0-rubric-coverage-provenance` explicitly grades
document line numbers, identifies all five prompt revisions as plain text,
logs exact verifier file hashes, and removes other-product wording. The latest
QC finding supersedes blanket removal of prompt-version markers: remove code
comments, retain version metadata. No new platform QC or Oracle pass is claimed.

## September 11: mandatory Bazaarbridge commerce template

Read `TASK_TEMPLATE_STANDARD.md` first. It is the current configuration and
manual-QC contract and supersedes all older four-dimension, timeout, model-key
and semantic-version rules below. Reference: `projects/bazaarbridge-marketplace-commerce/`.
Active PatchPad source is `projects/patchpad-editor-v2`, migrated from 2.0.16
to standard version `1.0.0`; new evidence lives in
`deliverables/patchpad-editor-v2/1.0.0-docketlight-procedures/`.
The three failed Oracle criteria now follow Docketlight's Setup / graded
observations structure. Setup navigation can adapt to the app while required
real editor actions and exact outcomes remain graded. Golden presentation now
uses a clear report heading, section emphasis, contained desktop scrolling and
larger readable revision previews. 29 browser regression groups and 108
structural checks passed; the preview is on localhost:3035. No new full Oracle
pass is claimed. The previous run analysis remains under 1.0.0-oracle-reliability.
All five September 11 supplied trials were reviewed: Oracle 0.8877, Gemini
0.5678, GPT-5.4 mini 0.5291, Haiku 0.3033 and no-op 0. The three failed Oracle
Functional checks pass local browser reproduction on unchanged golden code.
Their procedures now use immediate plain-text checkpoints, verified clipboard
targets, supported gutter anchors and bounded recovery for judge-only errors.
No new full Oracle is claimed; native judge action traces were not exported.
See RUN_REVIEW.md in that release for all 156 scored criterion observations.
The user subsequently adopted Docketlight's top-level judge weights:
Functional 0.6, Polish 0.2, Visual 0.2; Render and Constraints remain 1.0.
This replaces the previous 4/3/2 scored-dimension weights. Final test.sh
scoring remains gated 60/20/20. All individual criterion weights are preserved.
Four Functional verifier descriptions now allow the app's actual API identity
locations, selection-driven scroll container, indentation width and consistent
coordinate display base. Exact behaviors and all criterion weights are preserved.
The shared prompt explains normalization and conditional identity probes.
Fresh QC is needed after the Docketlight weight alignment. RewardKit 0.1.7's
built-in total still includes the positive gate judge weights; test.sh writes
the final gated 60/20/20 total. Credit for nonfunctional shells remains unresolved.
Additional potential verifier assumptions are recorded in the conversation
and are deferred at the user's request until QC flags them.
Code/config comments and prompt-version banners were removed at the user's
request; executable shebangs and meaningful Markdown headings remain.
The Visual prompt now has the explicit same-origin/server-backed browser gate
after the platform's missing-gate static finding; fresh platform QC is pending.
The main request is now a short product brief with seed/spec pointers; required
runtime and manifest details are consolidated in overview.md.
The user subsequently removed PatchPad responsiveness: Visual has five
equally weighted desktop-only criteria and retains its 20% reward share.
Historical run scores below do not validate this new five-dimension package.


## September 10: Common Ground canonical upload revision

This is the latest Common Ground state and supersedes the pending-name notes
below. Active source is now `projects/common-ground-ballot/`, package
`turing/common-ground-ballot`, version `2.0.0`. The original 1.0.6 source was
moved to `projects/common-ground-ballot-v0/` without changing its contents.
Its original task metadata is intentionally retained for historical reference.

Deliverables are grouped under `deliverables/common-ground-ballot/`:
- `2.0.0/`: revised canonical ZIP, local evidence, source QC and README.
- `v0/`: unchanged historical 1.0.6 ZIPs, run evidence and reports.
- `pre-template-2.0.0/`: preserved earlier draft ZIP with the v2 suffix.

The revised task injects only `OPENROUTER_API_KEY` for credentials, retaining
`openai/gpt-5.6-luna` and Codex/max in all four dimensions. `test.sh` contains
no key configuration. OpenRouter provider routing is configured in the verifier
image, with no OpenAI-key alias or direct-OpenAI login requirement.

The explicit Codex npm installation has been removed from `tests/Dockerfile`.
Local inspection established that RewardKit 0.1.7 provisions the CLI when it
is missing. This exact startup path was tested from the new no-Codex image:
it installed `codex-cli 0.153.4` in about 44 seconds, preserved the OpenRouter
provider, accepted the prefixed model argument, and loaded the Playwright MCP
configuration. No API keys or model calls were used. This demonstrates runner
provisioning, not an assertion that Harbor always preinstalls the CLI.

Playwright MCP, Chromium and RewardKit remain installed as in the actual
BazaarBridge v2 template. Their removal is not justified by the Codex bootstrap
test; obtain a corrected runtime template if the lead intends those to be
platform-injected too. Runner-owned Codex currently uses a latest-version
installer, so future versions may differ from the one tested here.

Both images built. Eleven golden browser regression groups passed, including
two real process restarts, durable sessions/receipts, anonymous vote totals,
server rejection checks and mobile account actions. Five runtime checks and
three agent preflight checks passed. The local nine-case harness uses an
explicit RewardKit score test double, not an Oracle judge. Consult the current
JSON reports and `qc-preflight.json` for final evidence and package hashes.
No new paid Oracle/model run or platform upload has been performed.
Historical Oracle 1.0 applies only to the preserved 1.0.6 package.

GridForge's finalized task and delivery remain unchanged by this migration.
The user requested a push after Ballot is complete. The earlier push was
blocked by approval policy; explicit confirmation of the existing remote
`Rayuga/model-beraking-prompts`, branch `main`, has been requested again.
Do not report a successful push until Git confirms it.

## September 10: Lead template update and delivery handover

This section supersedes older template recommendations where they conflict.
The new reference is `projects/bazaarbridge-marketplace-v2/`. It is a reference
task, not a project to modify while updating GridForge or Common Ground.

### Lead's requested runtime template

- Follow the reference's overall `task.toml`, `environment/Dockerfile`,
  `tests/Dockerfile`, and `tests/test.sh` organization for future task work.
  Keep task-specific runtime dependencies, seed paths, lifecycle helpers and
  requirements intact; do not copy marketplace behavior into another task.
- Keep agent networking public and the separate verifier networking public.
- Use OpenRouter credentials, not the sample's direct OpenAI credentials.
  The provider key name is `OPENROUTER_API_KEY`, supplied by the platform;
  never store a literal key in source, scripts, Dockerfiles, reports or ZIPs.
- Preserve `REWARDKIT_JUDGE = "codex"` and the OpenRouter model identifier
  `REWARDKIT_MODEL = "openai/gpt-5.6-luna"`. Every dimension's `judge.toml`
  must likewise use `model = "openai/gpt-5.6-luna"`, not bare `gpt-5.6-luna`.
- Keep provider-key export, remapping and provider setup out of `test.sh`.
  That script should handle application startup, bounded readiness, lifecycle
  cleanup, invoking the verifier, and writing the reward artifacts.
- The lead says Harbor already provides judge tooling, so future verifier
  Dockerfiles should not redundantly install Codex and platform-provided tools.
  Keep the application/runtime dependencies the task actually needs.
- Do not declare non-provider secret placeholders that the platform cannot
  inject. Put ordinary non-secret runtime defaults in the task environment.
- After changing infrastructure, check readiness, timeout nesting, provider
  routing, required executables in the actual verifier environment, and reward
  generation. Preserve the scored package and historical evidence separately.

### Important reference discrepancy

The files currently supplied in `projects/bazaarbridge-marketplace-v2/` do NOT
yet demonstrate the lead's no-install tooling setup. Its `tests/Dockerfile`
still explicitly installs `@openai/codex@0.151.0`, `@playwright/mcp@0.0.79`,
Chromium and `harbor-rewardkit==0.1.7`. Its task config uses direct
`OPENAI_API_KEY` and the bare model name. These are not instructions to copy
those provider choices into our tasks.

Treat removal of tool installation as the intended new platform contract, but
do not claim the local sample proves tools are injected into the separate
verifier image. Confirm that injection or obtain the corrected Dockerfile
before describing a no-install package as runtime-verified. Do not silently
remove dependencies and assume an old Oracle score validates the new runner.
The existing GridForge compatibility aliases (`OPENAI_API_KEY` mapped from
OpenRouter and `OPENAI_BASE_URL`) are historical configuration, not a new
requirement for future tasks; routing changes still need runtime validation.

### Current task decisions

- GridForge is frozen for this delivery. The user explicitly said to leave it
  as it is rather than migrate it to the new infrastructure template now.
- Final GridForge artifacts are in `deliverables/gridforge/final-deliverables/`:
  the task ZIP, four named directories under `job-directory/`, and
  `CASE-STUDY-gridforge-spreadsheet-v2.docx` plus
  `EVAL-REPORT-gridforge-spreadsheet-v2.docx`.
- All four exports record version `2.0.10` and the same task checksum. Rewards:
  Oracle `0.9545`, GPT-5.4-mini `0.2697`, Haiku 4.5 `0.0268`, and Gemini 3.7
  Flash `0.6848`. The user accepts Oracle at `0.95` or above for this submission;
  this does not turn its two failed Functional checks into passes.
- The user wants evaluation and case-study documents focused on recorded
  results, without speculative fairness commentary. Preserve exact scores and
  evidence; do not claim independent revalidation or perfect passes.
- Apply the new template work to Common Ground next, preserve its original
  version, prepare its upload ZIP, and push again after the changes.
- Naming preference: the revised active task should be `common-ground-ballot`,
  with the original source archived as `common-ground-ballot-v0`. That rename
  is still pending: actual paths remain `projects/common-ground-ballot/`
  (original 1.0.6) and `projects/common-ground-ballot-v2/` (revised 2.0.0).
- Revised Ballot validation and the provisional old-slug ZIP currently live
  in `deliverables/common-ground-ballot-v2/`. Its README has stale 1.0.7 notes;
  refresh it when preparing the canonical upload. Local regression reports
  exist, but no fresh platform Oracle has run for the revised task. Historical
  Oracle 1.0 belongs only to the original 1.0.6 package.

### Git handover

The current workspace snapshot was committed locally as `01657ee` (GridForge
delivery and run evidence, current Ballot preparation, reference task and shared
context). The attempted push to `Rayuga/model-beraking-prompts`, branch `main`,
was blocked by the tool approval policy, not by a Git merge conflict. Explicit
confirmation of that payload and remote was requested. Do not report it as
pushed or retry through an indirect workaround. This handover update was made
after that commit and needs inclusion in the next authorized commit/push.

## September 10: Agent bootstrap and release preflight

This entry supersedes older GridForge version notes below. GridForge is now
`2.0.10`; its upload ZIP is
`deliverables/gridforge/gridforge-v2-2.0.10-validation/gridforge-spreadsheet-v2.zip`.
Agent and verifier networking are public; the verifier remains separate.

GridForge release files now live together under `deliverables/gridforge/`, with
one existing version folder per release. `deliverables/gridforge/README.md`
identifies the latest upload. Each version contains only one task upload archive,
`gridforge-spreadsheet-v2.zip`. Duplicate `*-task.zip` aliases were removed only
after SHA-256 equality was verified; retained ZIP bytes and historical reports
are unchanged. Older report archive names refer to these former aliases.
The packager now emits only the canonical name for GridForge. Editable source
stays at `projects/gridforge-spreadsheet-v2/`; the older
`projects/gridforge-spreadsheet/` is a separate legacy task, not a delivery copy.
Inside each upload ZIP, retain the one `gridforge-spreadsheet-v2/` wrapper required
by the portal. Do not add the outer `gridforge/` release collection to the ZIP.

Platform run `run-ce624351` used OpenHands SDK `1.44.1` with
`gemini/gemini-3.7-flash`. It ended after about 12 seconds during agent setup:
`curl (77) error setting certificate file: /etc/ssl/certs/ca-certificates.crt`.
The minimal agent image installed curl with `--no-install-recommends` but did
not explicitly install `ca-certificates`. The previous local agent image also
confirmed the bundle was absent. No model execution or verification occurred;
the displayed zero is not a measured task score or a model-breaking result.

Fix: explicitly install `ca-certificates` in the AGENT Dockerfile, run
`update-ca-certificates`, and assert that the bundle is nonempty at build time.
Do not assume a successful verifier/Oracle run validates agent installation:
Oracle can bypass the OpenHands bootstrap, and the verifier is a different image.
Public network permission does not supply TLS trust roots or bootstrap tools.
Never work around this by disabling certificate verification.

Validation for this release: agent image built successfully; a certificate-
verified GET of the exact failed URL, `https://astral.sh/uv/install.sh`, returned
HTTP 200; all 34 local structural checks passed. Golden implementation, verifier
criteria/weights, and dependency versions are unchanged from 2.0.9. Only agent
trust-store setup and release metadata changed. The installer itself, remaining
SDK setup steps, paid model run, and fresh Oracle were NOT run in this validation.
The evidence is in `bootstrap-fix-report.json` beside the ZIP. This establishes
the fix for the observed error, not a guarantee of all later platform stages.

Before future uploads, build BOTH images and test the selected agent's bootstrap
prerequisites, including secure HTTPS from inside its exact image. Perform this
before spending time on platform QC. Preserve old ZIPs/evidence, compare changed
files, and update only root package versions, never dependency versions through
global text replacement. An updated ZIP may trigger platform QC again; do not
promise reuse of previous QC or bypass platform checks.

Common Ground has since been preserved as original 1.0.6 plus revised 2.0.0
work. See the current handover above for actual paths, the pending canonical
rename, and the requested lead-template migration. Historical 1.0.6 Oracle 1.0
is not evidence of a fresh Oracle run for the revision.

## September 9 merge resolution

This update supersedes older network and current-version notes below. Active
sources are PatchPad `2.0.4` and GridForge `2.0.8`. Both agent and verifier
environments now use public networking, as requested. Dependency installation
during development is allowed; the required custom editor/grid and locally
served runtime resources remain part of each brief.

The merge retains incoming GridForge brief/bootstrap-tool fixes and PatchPad's
separate seed, custom-surface and unsaved-discard checks. It also retains the
locally tested PatchPad focus/clipboard fixes, Escape-to-Find behavior, flexible
word navigation, manifest parser contract and API documentation check. PatchPad
uses only `tests/app-lifecycle.sh` and one restart criterion, not two competing
lifecycle helpers or duplicate restart rewards. It has 35 criteria in total:
2 Render, 2 Constraints, 27 Functional and 4 Polish.

Previously exported ZIPs and run evidence remain historical, not evidence for
these merged source versions. Repackage before uploading. Static validation
does not establish a new Oracle pass; Docker was unavailable during this merge.

## Latest QC and PatchPad handoff

The latest supplied rubric is root `WebDev Rubrics QC.xlsx`: 53 rows in
`Quality Checks` and 58 listed checks in `Deterministic Checks`. Use this newer
rubric for current submissions where it supersedes the historical scorecard
below. The workbook lists checks, not executable platform-checker code.

The active revised PatchPad task is `projects/patchpad-editor-v2/`, package
`turing/patchpad-editor-v2`, version `2.0.3`. The user explicitly requires this
name; do not rename it to patchpad-incident-editor. The latest platform result
reported 52/53 passed with only coverage failing; identity was not a remaining
failure. Other QC repairs are retained. Use the patchpad-editor-v2-2.0.3-task.zip archive; the previous
patchpad-incident-editor archive is superseded. The older submitted PatchPad
and GridForge tasks were not changed.

On September 7, nine platform findings were traced to overlapping problems:
hidden database-extension constraints, ambiguous stale-draft handling, a Tab
indentation/focus-traversal contradiction, an unstated visible match count,
platform-specific word boundaries, a version-suffixed identity, and missing
prompt version/copy-edit residue. The brief, reference, and tests were aligned.
Escape now leaves the editor for Find; Tab still indents. Both common word
boundary conventions are accepted, with exact coordinate/clipboard checks.

Evidence and the corrected task ZIP are under
`deliverables/patchpad-incident-editor-validation/`. Read
`patchpad_qc_rework.json` for the nine dispositions and 53-check inventory.
Local unpaid checks cover 22 browser regression groups, 11 manifest cases,
RewardKit discovery, syntax, and empty-submission zero scoring. This is not a
full Oracle or a new 53/53 platform verdict; upload QC and a complete Oracle
remain to be run. No paid model calls were made for this repair.

The final reported coverage gap concerned server restart idempotence and
manifest API-route documentation. Two Functional criteria now cover those
requirements, giving 33 total criteria (2 Render, 2 Constraints, 25 Functional,
4 Polish). `tests/app-lifecycle.sh` is trusted verifier infrastructure, shared
by test.sh and the restart criterion; it restarts npm start without resetting
SQLite or calling solve.sh. Judge terminal use is narrowly permitted to read
the manifest as documentation and invoke that helper. Golden tests verified
two process replacements preserve the saved report and entire revision history.
Disposable broken copies proved startup reseeding and missing route docs fail.
The harness was also tested with a local stub to verify restart cleanup and
score aggregation; that injected test score is explicitly not an Oracle result.

Oracle `run-74864554` (export under `run-outputs/patchpad-editor-v2/`) completed
on version 2.0.2: reward 0.8143, Functional 0.6905, other dimensions 1.0,
25/33 criteria passed, no-op zero. Both new coverage criteria passed. Eight
failures concerned Unicode, paste/cut, Find, restore Undo, and multi-caret paths.
The action trajectory was not exported; do not call every failure an app bug.
Local reproduction confirmed clicked Find Next and Restore Draft left button
focus, whereas held-modifier multi-caret and atomic paste/cut worked.

Version 2.0.3 returns focus after clicked Find/Undo/Redo/Replace and asynchronous
Restore Draft, while keyboard Find cycling keeps input focus. The verifier now
copies selected document text after Escape, establishes an exact paste baseline,
requires actual held modifiers and waits for clipboard/API completion without
issuing rescue actions. All eight failure paths have exact regression checks in
`oracle-failures-regression.cjs`, including both Alt/Control multi-carets and
keyboard/button restore Undo. Their local pass is not a fresh full Oracle score.

Keep the human product voice. Do not make requirements vague to induce model
failure or pin undocumented reference-only behavior. A prompt-version marker
helps trace evidence but does not make an LLM judge deterministic.

This is the current shared standard for WebDev/RL task authoring in this
repository. It combines the latest admin instructions, the root validation
files, and the strongest patterns from the extracted BazaarBridge Marketplace
and OrbitalOps packages. Newer written admin guidance overrides this document.

## Start here

Use `MODEL_BREAKING_PLAYBOOK.md` as the concise cross-device workflow. It
contains the reusable lifecycle roles, Ripple Effect verifier method, fair
hardening rules, run-validity checks, delivery boundary, and restart checklist.
Use this longer file for the exact current platform contract, historical
lessons, and active task status.

Three external methodology notes were reviewed and distilled into that
playbook on 2026-09-04. They remain secondary to current admin guidance:

| File | SHA-256 |
| --- | --- |
| `delivery-v3.md` | `22D2E61C13DFF589F7738B633007872584F2ADF323941DA44678B2E37BECB021` |
| `restructure-v2.md` | `0C20D1B7BBB2101C60FEADDE6EBBAC9BF4FA88FD80844E648C3550FEFE018169` |
| `MODEL_BREAKING_PROMPT.md` | `F8997D2962158DA8DB8C638AF1DC0E5B87427FF929117C12AD7B8AE1E57882FB` |

The colleague lessons incorporated there are: use an internal `<= 0.5` target
to leave margin under the formal keeper ceiling; prefer coupled lifecycle,
payroll, civil, and game behavior over easy standalone calculations; grade
secondary and tertiary consequences through the Ripple Effect; revalidate hero
verifiers when they unexpectedly fail; and use parallel local runs only after
proving isolation and resource headroom.

## Authority and source snapshot

Use sources in this order:

1. The latest written admin/user instructions.
2. `Task QC - platform.docx` at the repository root.
3. `upload-checks-README.md.docx` at the repository root.
4. `RL_Task_QC_Scorecard.xlsx` at the repository root.
5. `Deliverables Tracker_- WebDev_.xlsx` at the repository root.
6. The extracted reference task folders:
   - `projects/bazaarbridge_marketplace/bazaarbridge-marketplace/bazaarbridge-marketplace/`
   - `projects/orbitalops/orbitalops/orbitalops/`

Archived tasks and exported runs are reference-only. Removed legacy folders,
including the former `old-qc-and-formats/` archive, are not required because
the durable lessons have been consolidated into the two root context files.
Do not include archived material in routine task QC unless the user explicitly
asks for an archival comparison or investigation.

Validation-file hashes for the snapshot reviewed on 2026-09-02:

| File | SHA-256 |
| --- | --- |
| `Task QC - platform.docx` | `CDF6B22BB9874ABFE8046195E1C68EC49393405FBE44CE58D9825BC85AD60933` |
| `upload-checks-README.md.docx` | `744161548A8FF4E64F7174912385CC1A6D7B89B4DEF156E1060073B05F54E6BD` |
| `RL_Task_QC_Scorecard.xlsx` | `FFD729B652631E61BC120354C68B78908C45150DCC1A05D2B8D578E6690A7411` |
| `Deliverables Tracker_- WebDev_.xlsx` | `6378677E41320D1308AA99DEE06BF32AA4236EB38F7DE4123FBC2F2A2A386CD6` |

The root scorecard calls itself a 34-criterion rubric but contains 30
criterion rows. The platform QC document explicitly acknowledges this and
splits the available rows into 19 source-decidable checks and 11 run-dependent
checks. Do not invent the missing A1, A5, or B2 criteria.

## Current admin contract

### Naming

- Every task slug must contain exactly three lowercase words separated by
  dashes: `<word1>-<word2>-<word3>`.
- For the current Lite task, the canonical slug is `dropline-four-lite`.
- `task.toml` must use `name = "turing/<task_name>"`; therefore this task uses
  `name = "turing/dropline-four-lite"`.
- Use the same canonical slug for the task package folder, ZIP stem, and the
  ZIP's single top-level extracted folder.
- Product-facing copy may still use the display name `DropLine`.

The extracted references contain mixed legacy names. They are useful for
structure and verifier design, but the latest exactly-three-word kebab-case
instruction overrides their naming style.

### Required stack and trust model

- Browser: vanilla HTML, CSS, and JavaScript.
- Server: Node.js with Express.
- Durable store: SQLite.
- Authentication: server-issued unpredictable bearer tokens persisted in
  SQLite.
- The server derives account identity from the bearer token. It must not trust
  a browser-supplied user/account identifier.
- Sign-out revokes the stored token, and replaying it must fail.
- Protected data and writes require authentication and remain account-scoped.
- The application must not require public-network scripts, styles, fonts,
  images, APIs, or runtime package installation.

### Prompt and instruction files

- Preserve a real, human voice and record provenance. The platform static QC
  specifically expects real traffic or a real product/arena request rather
  than a model-synthesized prompt.
- Do not polish every prompt into generic, formal prose. Preserve natural
  terseness, casing, and harmless quirks where they exist in the source.
- Keep a short instruction in one file.
- If the complete instruction would exceed 20 lines, keep `instruction.md`
  concise and split the contract into focused mounted files.
- Every referenced instruction and artifact must be available to the agent and
  named by an absolute container path where the platform policy requires it.
- Keep the request unambiguous and achievable from the shipped environment and
  seed state.

### Verifiers and reward

Use exactly five verifier categories under `tests/`: `render`, `constraints`,
`functional`, `polish`, and `visual`. Each contains `judge.toml` and `prompt.md`.
Use the matching reference judge configuration; keep `[judge]` but omit the
`judge` and `model` keys and add no configuration keys. Inherit common provider,
model and max reasoning from the reference task environment and Docker setup.
See `TASK_TEMPLATE_STANDARD.md` for exact keys, common timeouts and visual anchors.
Keep appearance in Visual and concrete interaction usability in Polish.

Functional verification must cover more than 80% of functionality. Define the
functional requirement denominator explicitly; do not claim coverage from raw
criterion count. Independently, every explicit requirement must map to at
least one assertion in some verifier category.

#### Render and Constraints simplification

Use this design rule when authoring or revising the hard-gate verifiers.

- Render should be an intentionally easy gate for a working submission, with
  only two or three simple criteria: the page loads into a usable visible UI,
  it still loads after refresh, and, when applicable, one obvious link or
  control can be clicked without breaking the page.
- Do not place detailed functionality, visual polish, or broad product
  coverage in Render. Those belong in Functional or Polish.
- Constraints should likewise contain only two or three clear, essential
  contract checks. Avoid duplicating Functional behavior or turning
  Constraints into a second comprehensive rubric.
- Render and Constraints remain hard gates, so their criteria should identify
  genuinely unusable or non-compliant submissions rather than make capable
  model submissions fail on incidental details.

The only accepted final reward policy is:

```text
if render <= 0 or constraints <= 0:
    reward = 0
else:
    reward = 0.6 * functional + 0.2 * polish + 0.2 * visual
```

Use the reference five-dimension declaration:

```toml
[[reward]]
name = "reward"
aggregation = "weighted_mean"
weights = { render = 0.0, constraints = 0.0, functional = 0.6, polish = 0.2, visual = 0.2 }
```

RewardKit does not supply the hard gate by itself. `tests/test.sh` must read and
validate all five dimension scores, apply the gate, and atomically replace the
final reward outputs. Startup, judge, parsing, or post-processing failure must
leave a complete zero-reward record with the same five dimension fields.

### Score targets

- Oracle/reference reward must be greater than `0.95`.
- Every Functional verifier must pass for the Oracle, even if its aggregate is
  already above `0.95`.
- The primary `gpt-5.4-mini` model reward must be from `0.1` through `0.7`.
- Haiku and Sonnet 4.5 runs are required delivery evidence. Record their exact
  scores. The earlier explicit Haiku exception permits a score below `0.7`,
  including zero; no separate Sonnet acceptance band has been supplied.
- A high aggregate may never hide a failed Oracle Functional criterion.

## Canonical Harbor package

```text
dropline-four-lite/
  task.toml
  instruction.md
  environment/
    Dockerfile
    instructions/                 # only when the contract is split
    assets/artifacts/             # authoritative source/seed assets
  solution/
    solve.sh
    ...golden solution files...
  tests/
    Dockerfile
    test.sh
    reward.toml
    coverage.json
    render/
      judge.toml
      prompt.md
    constraints/
      judge.toml
      prompt.md
    functional/
      judge.toml
      prompt.md
    polish/
      judge.toml
      prompt.md
    visual/
      judge.toml
      prompt.md
    assets/artifacts/             # verifier-only copies when required
```

The package must not contain reports, run ZIPs, screenshots, generated
databases, logs, caches, secrets, handoffs, unrelated references, or duplicate
nested task wrappers.

## Root platform QC: 19 static-source checks

`Task QC - platform.docx` evaluates these from `instruction.md`, `task.toml`,
`environment/`, `solution/`, and `tests/` without running the task:

| ID | Required evidence |
| --- | --- |
| A2 | Real traffic/product-request provenance is recorded; the prompt is not model-synthesized. |
| A3 | The source prompt's natural voice and quirks are preserved. |
| A6 | One achievable interpretation; every required artifact is reachable. |
| B1 | A complete requirement-to-assertion matrix with no unchecked ask. |
| B3 | A real execution/render gate; static keyword matching is insufficient. |
| B4 | `all`/`every` requirements inspect the full collection, not one match. |
| C4 | Every expected type and literal agrees with the seed and write path. |
| C5 | Assertions and paths are live, valid, and capable of passing. |
| C6 | Runtime placeholders are resolved by the configured runner. |
| C7 | "Nothing else changed" uses whole-state or explicit comparison guards. |
| C8 | Legitimate app side effects are excluded from unchanged baselines. |
| C9 | LLM-graded facts and weighting arithmetic match the actual seed. |
| D2 | Render or Constraints failure hard-zeros all shaping terms. |
| D5 | Under/over-production is bounded where output length or scope matters. |
| E2 | Reference/baseline artifacts are versioned and their hashes recorded. |
| E3 | The verifier is offline or restricted to a pinned allowlist. |
| E4 | Judge model, temperature, and prompt version are pinned. |
| F2 | Judge prompts treat agent content as untrusted and resist injection. |
| F3 | A separate verifier keeps tests and rubrics out of the agent image. |

For a WebDev product, D5 is best handled by a precise product scope: require
all necessary workspaces and workflows while explicitly excluding unrelated
features. Do not reward extra pages, verbose filler, or duplicated UI.

## Full scorecard: 11 run-dependent checks

The platform static QC deliberately removes these because they require real
execution evidence. They still belong in pre-delivery QC:

| ID | Required measurement |
| --- | --- |
| A4 | Domain and difficulty match the tracker/taxonomy allocation. |
| B5 | An unchanged/no-op rollout scores at most `0.05`. |
| C1 | Oracle/reference rollout scores at least `0.95`. |
| C2 | At least two knowingly wrong/adversarial rollouts score at most `0.2`. |
| C3 | Known-better rollouts monotonically outscore known-worse rollouts. |
| D1 | Sampled rewards contain at least four distinct values. |
| D3 | Passing only cheap gates earns at most `0.1`. |
| D4 | Reward standard deviation across at least eight rollouts is at least `0.15`. |
| E1 | The same rollout rescored three times receives the same reward. |
| F1 | A keyword-stuffed non-solution scores at most `0.2`. |
| F4 | A refusal or clarification-only rollout scores at most `0.05`. |

The source workbook also expects non-inverted reward ordering, frozen
baselines, true seed literals, injection resistance, and agent/test isolation.
Preserve run logs and calculations in the evaluation report.

## Upload checks: 26 structural rules

The Rules stage stops immediately on any error-severity failure. Check every
item locally before spending time on model runs.

### Environment and image

- Positive numeric agent/verifier timeouts; each at most 18,000 seconds and
  total build/agent/verifier time within 21,600 seconds.
- At most 4 CPU, 8 GiB memory, and 10 GiB disk for a non-GPU sandbox unless the
  platform policy is raised first.
- The agent environment must not copy or expose `solution/` or `tests/`.
- Network mode must meet project policy. Every allowlist mode declares hosts.
- GPU types, if used, must be recognized by the backend.
- Do not use `FROM --platform=...`.
- Compose, if used, must use named volumes rather than host bind mounts.

### Reproducibility

- Every base image has a tag or digest; do not rely on `latest`.
- Do not use bare `nproc` for build parallelism.
- Pin every pip/uv tool dependency version in Dockerfiles, `test.sh`, and
  `solve.sh`.
- Use `apt-get update`, avoid version-pinning apt packages, and clean
  `/var/lib/apt/lists/*`.
- When pytest tools are installed, use the configured versions (`pytest`
  8.3.4 and `pytest-json-ctrf` 0.3.6 under the documented default policy).
- Do not fetch tools with curl/wget/git from `tests/test.sh` at trial time.

### Metadata and naming

- The task folder slug remains within the eight-token limit.
- Use the `turing/` task-name prefix and make the task slug match the package
  folder.
- Declare a semantic task version and bump it for verifier, baseline, prompt,
  or contract changes.
- When the project enables the optional metadata check, include
  `difficulty_explanation`, `solution_explanation`, `category`, `subcategory`,
  and `persona`; category must be one of Science, Software, ML, Operations,
  Security, Hardware, or Media.
- Canary, instruction-suffix, and version enforcement checks are off by
  default unless project policy enables them.

### Instructions and verifier

- Mention files used by both tests and solution in `instruction.md` or
  `task.toml`.
- Prefer absolute container paths in instructions.
- A separate verifier bakes RewardKit, judge, browser, and other test tooling
  into `tests/Dockerfile`; it performs no trial-time install.
- Artifact paths contain no `..`; destinations are relative forward-slash
  paths and are not named `manifest.json`.
- For separate mode, keep `artifacts` top-level, copy tests into `/tests`, and
  create required artifact/log parent directories.

## Seed and baseline rules

- The authoritative seed belongs under `environment/assets/artifacts/`.
- The separate verifier cannot read `environment/`. A byte-identical copy may
  therefore live under `tests/assets/artifacts/` when the verifier needs it.
- Document why the test copy exists and verify equality by SHA-256.
- A golden solution may keep a co-located copy when it must seed independently;
  keep it byte-identical and versioned.
- Do not duplicate assets when deterministic prompts already contain every
  seed value they need.

OrbitalOps intentionally ships three byte-identical copies of its workbook;
their reviewed SHA-256 is
`3444B9EA947CD6C08647F5AE77E0D6CEF9A3A234DFB17CD8C47F1059C46AAA3E`.
DropLine's current authoritative workbook has SHA-256
`2EAE3582E4F71E3F6D66C031706EB0041D08C9465C08E1B878CF8AE907715626`.

## Verifier design learned from the references

### Render

Make Render a cheap hard gate with only two or three smoke checks: the page
loads into a usable visible UI, it still loads after refresh, and, when useful,
one obvious link, sign-in action, or control works without breaking the page.
Do not test bad-password handling, detailed persistence, exact game state, or
visual polish here. A blank, crashed, or unusable page must still fail.

### Constraints

Keep Constraints to two or three essential contract checks, such as the
same-origin full-stack workspace, authenticated access boundary, offline
operation, or durable reload behavior. Put detailed account isolation,
revocation, state-transition, and mutation-safety behavior in Functional unless
it is genuinely a task-wide hard constraint.

### Functional

Use exact end-to-end action sequences, boundary values on both sides,
whole-collection checks, persistence rechecks, terminal-state immutability,
and derived-value verification. Continue to independent criteria after one
failure. The Oracle must pass every Functional criterion.

### Polish

Combine interaction quality and the former visual-quality concerns here:
responsive layout, accessibility, keyboard behavior, focus, visible feedback,
hierarchy, coherence, and production readiness. Do not recreate an Aesthetic
directory.

### Runner safety

- Write zero reward before app startup.
- Reject missing entry files and symlinks.
- Stage the submission and run it as an unprivileged user.
- Use a bounded readiness loop and same-origin health check.
- Keep verifier logs private and guarantee reward files on every exit path.
- Validate every dimension as a finite number in `[0,1]` before calculating
  reward.
- If post-processing fails, restore zero rather than leaving an ungated mean.

## Operational learnings from DropLine and Brickfall

### Category isolation, ordering, and verifier budgets

- RewardKit 0.1.7 may evaluate AgentJudge categories concurrently by default.
  Categories that mutate the same SQLite database can therefore race and
  invalidate one another's baseline. Either isolate/reset state per category
  or run the categories serially with
  `rewardkit --max-concurrent-agent 1 /tests`.
- Render and Constraints should avoid persistent product mutations. Functional
  and Polish may mutate state only when their own setup and cleanup make the
  behavior deterministic.
- Criterion order matters within a mutating category. Run seed-import and
  baseline assertions before gameplay changes. Test archive cap/order behavior
  before later criteria generate additional completed records.
- Sum the configured category timeouts and keep the runner timeout above that
  total but below the platform verifier timeout. DropLine currently budgets
  `480 + 2400 + 900 + 480 = 4260` seconds, uses a 5280-second runner bound,
  and keeps the verifier limit at 5400 seconds.

### Idempotency, stale writes, and session safety

- Give every new-game, move, undo, and redo request its own opaque,
  high-entropy operation ID. Reusing a human-readable constant across an
  unrelated operation is not a valid test or implementation.
- Persist and replay the original HTTP status and response body for both
  successful mutations and known 4xx mutation failures.
- Test a successful duplicate after other state has advanced. Also replay a
  previously rejected stale request after later state changes and prove it
  still returns its original rejection without changing the fresh state.
- For optimistic concurrency, verify the stale revision response, re-read the
  authoritative state, and explicitly retry with a new operation ID and the
  current revision.
- A deliberately pending double activation may commit at most one move and one
  revision increment.
- Test all-session logout with two separately issued tokens for the same
  account. After a rejected or replayed action, re-read state and prove the
  rejection caused no mutation.

### Undo, redo, and terminal archive identity

- A completed archive record is not only its winner. Its identity includes the
  result, board, move list, completion time/order, and round identity.
- Undoing a terminal move removes that exact record and reverses the score.
  Redo restores the same record exactly once; it must not create a new
  completion timestamp or a duplicate archive entry.
- Starting a new game or making a new branch after undo clears the redo stack.
- Test exact terminal undo/redo early enough that unrelated generated archive
  entries do not make cap and order assertions ambiguous.

### Seed collections and latest-ten views

- To prove a ten-item cap, seed or create more than ten records. DropLine uses
  11 completed matches so the verifier can check newest-first order and the
  omission of the oldest entry.
- Expose the total completed-record count separately from the ten records
  displayed in the current view.
- Check exact order and exact omission rather than only counting ten cards.
- Keep environment, verifier, and golden seed copies byte-identical and record
  their SHA-256 hashes.
- Validate workbook-provided redo stacks by redoing the exact seeded move and
  revision, then undoing it so later checks recover their baseline.

### Browser-verifier observability

- Never grade a behavior that the instructions do not require. Every verifier
  criterion must point to an instruction clause or an explicitly mapped
  requirement.
- A generic browser verifier cannot directly prove a physical SQLite schema.
  Verify the observable contract instead: bearer-token issuance and use,
  reload persistence, distinct sessions, account isolation, and global token
  revocation. Do not force a golden-only endpoint or schema solely to make an
  internal implementation detail inspectable.
- Prefer visible UI controls. Network capture and controlled replay are a
  narrow exception for request idempotency and stale-write behavior.
- Put explicit seeded credentials in verifier prompts. When a scenario needs a
  boundary value, perform the exact steps that create it; do not assume the
  app's default range, revision, board, or focus state.
- If a test expects an empty board, start a new game first. Check keyboard
  focus after a nonterminal move because terminal-state controls may correctly
  be disabled.
- Test reduced motion by emulating the media query and verifying that animation
  and transition duration is materially reduced.
- Polish criteria should grade concrete instruction-backed qualities: readable
  type, focus visibility, contrast, spacing, distinguishable pieces, responsive
  layout, status feedback, and a clear winner state.
- Put exact deterministic verifier values in the mounted instructions or a
  verifier-visible scenario asset. Never make the judge infer hidden timing,
  scoring, seed, or checkpoint state from the golden implementation.
- Expose semantic gameplay telemetry for browser verification: stable entity
  identifiers, held/moving state, positions, velocities, active effects, and a
  bounded event stream. Canvas pixels alone are too ambiguous for exact rules.
- Exercise every mutating route's operation receipt, including successful and
  known-4xx replays, revision conflicts, and operation-ID payload mismatches.
- A latest-ten history needs both ten retained snapshots and tombstones for
  older terminal run IDs; otherwise a pruned run can be submitted again.
- Prevent autosave from racing level-complete, finish, or progress mutations.
  Freeze conflicting controls while a mutation is pending and reconcile stale
  responses from authoritative server state.
- Check pointer behavior through overlays as well as visual appearance; an
  invisible full-screen layer can leave a polished game entirely unplayable.

### Version, baseline, and ZIP integrity

- Keep the standard version `1.0.0`. Any instruction, judge, golden solution or
  frozen-baseline change requires new source/ZIP hashes, dated release evidence
  and fresh validation, without overwriting historical packages.
- Recompute seed and golden-file hashes only after the final content edit, then
  rebuild the task ZIP. Brickfall demonstrated why this order matters: an HTML
  change left stale coverage hashes until version 1.0.1 refreshed the entire
  baseline.
- The ZIP must contain exactly one top-level directory whose name matches the
  ZIP stem. Compare the ZIP file inventory and bytes against the source, test
  every entry's CRC, and reject absolute paths, traversal, duplicate wrappers,
  and unexpected files.
- Build packages from tracked or explicitly allowlisted source files. Do not
  package a dirty runtime directory containing ignored `node_modules`, SQLite
  databases, WAL/SHM files, logs, caches, or screenshots.

### Run evidence and local naming

- Friendly outer run-directory names may include the model/outcome and a short
  run-ID prefix. Preserve the complete run UUID inside Harbor JSON.
- Never rename nested Harbor trial directories or standard files such as
  `result.json`, `config.json`, and `lock.json`; exported viewers and trial
  mappings use those exact names and the stored `trial_name`.
- Treat exported transcripts as immutable evidence. Do not normalize their
  whitespace or rewrite them merely to reduce a Git diff.
- Keep secrets and disposable runtime databases/logs out of commits. A captured
  model database or log may be retained only when it is required to reproduce a
  run artifact, is contained in the evidence archive, and passes an exact
  external-secret scan. Never include `.jwt_secret`, expanded API environment,
  or raw completion dumps.
- An infrastructure failure is not a task/model score. The current DropLine
  GPT-5.4-mini attempt identified as `run-c866d723` stopped because the Daytona
  organization had depleted credits; do not report it as a valid model or NOP
  result.
- A numeric reward is invalid when a judge timed out, reasoning is blank, the
  agent was killed by provider failure before finishing, or the task version,
  checksum, or configuration differs from the submitted package. Never repair
  those cases with a detached verifier-only rerun and present it as an untouched
  end-to-end run.
- For Windows PowerShell, JSON-valued `--ak` arguments need escaped inner quotes
  so Harbor receives an object. Validate with `--print-config`; otherwise a
  value such as `model_info` becomes a string and OpenHands raises
  `'str' object has no attribute 'get'` before model execution.
- DropLine v6.0.3 now has exact-package Oracle, GPT-5.4-mini, and Haiku evidence
  sharing task checksum
  `c7400c4c34da652f7e4d050c40a063e4aa4fd4ffeacd3b6aa4ecd092d10aa528`.

### Git and Windows repository handling

- On this workspace, repository-wide `git add -A` can fail because an archived
  nested repository contains an overlong Windows object path. Stage only the
  active task, context, ZIP, or run-evidence paths being delivered; do not edit
  archived exports to work around the issue.
- A directory rename appears as deletions plus untracked files until staged.
  Inspect the staged result and final tree rather than relying only on Git's
  rename percentage. Identical empty files can also produce surprising rename
  pairings without changing the final content.
- Before pushing, fetch the remote, check branch divergence, scan the staged
  material for secrets, commit only the intended paths, push, then verify a
  clean worktree and `HEAD == origin/main`.

## What changed from the older five-dimension pattern

| Older pattern | Current requirement |
| --- | --- |
| Render, Constraints, Functional, Polish, Aesthetic | Exactly Render, Constraints, Functional, Polish |
| Generic/five-way weighted mean | Hard gates, then `0.6 Functional + 0.4 Polish` |
| Visual craft isolated in Aesthetic | Visual craft and production readiness live in Polish |
| Judge prompt embedded in TOML | Versioned `prompt.md` referenced by `judge.toml` |
| Coverage inferred from criteria | Explicit requirement/assertion matrix and measured Functional coverage `>80%` |
| Mixed legacy task slugs | Exactly three lowercase dash-separated words |
| One or two model artifacts | Oracle plus gpt-5.4-mini, Haiku, and Sonnet 4.5 run ZIPs |
| Static review alone | 19 source checks plus 11 measured run checks and 26 upload rules |

BazaarBridge is the clearer reward implementation because `reward.toml`
declares the weights and `test.sh` applies the gate. OrbitalOps is the clearer
seed-isolation example and includes `tests/coverage.json`. Use the strongest
part of each; do not copy reference inconsistencies.

## Required delivery folder

The final delivery folder must contain these artifact classes:

1. Task ZIP.
2. Oracle run ZIP.
3. A model run ZIP for each required model:
   - gpt-5.4-mini
   - Haiku
   - Sonnet 4.5
4. Evaluation report.
5. Case study report.

Unless the platform exports a single documented multi-model archive, this is
seven files: one task, one Oracle, three model runs, and two reports. Keep them
outside the Harbor task ZIP. Recommended organization:

```text
deliverables/dropline-four-lite/
  dropline-four-lite.zip
  dropline-four-lite-oracle-run.zip
  dropline-four-lite-gpt-5-4-mini-run.zip
  dropline-four-lite-haiku-run.zip
  dropline-four-lite-sonnet-4-5-run.zip
  dropline-four-lite-eval-report.<approved-format>
  dropline-four-lite-case-study-report.<approved-format>
```

Inspect the task ZIP central directory. It must contain exactly one top-level
folder named `dropline-four-lite/`, matching the ZIP stem exactly.

## Tracker allocation for DropLine

The updated tracker provides two relevant facts:

- Taxonomy sheet: `Classic & Board Games` -> `Tic-tac-toe / Connect-4`, with
  assigned app name `dropline-connect-four-lite`.
- Active work sheet: task `dropline-connect-four`, category `Board Game`, with
  a description that includes complete win/draw detection, move history,
  undo/redo, persistent scores, keyboard controls, responsive play, and reload
  restoration.

The tracker uses `dropline-connect-four` for the earlier package. The current
Lite rework uses the distinct three-word slug `dropline-four-lite` so the
existing project history is not overwritten.

The task owner resolved the scope discrepancy on 2026-09-02: the Lite task now
includes move history, undo, and redo. Version 5.0.0 adds all three to the
instructions, golden solution, coverage map, and Functional verification.

## Current DropLine Lite audit

Working source reviewed:
`projects/dropline-four-lite/`

### Current implementation and evidence (version 6.0.3)

- The working folder, npm package, task name, and delivery slug use
  `dropline-four-lite`.
- `task.toml` uses `turing/dropline-four-lite` and version `6.0.3`.
- The natural main instruction is at most 20 lines. Every mounted instruction
  file is also at most 20 lines; dedicated `concurrency.md` and `records.md`
  keep the new contract explicit rather than hiding requirements in judges.
- The solution uses vanilla HTML/CSS/JS, Node.js, Express, and SQLite.
- It reads the authoritative Excel seed, hashes passwords with per-account
  scrypt salts, issues unpredictable bearer tokens, persists sessions, revokes
  tokens on sign-out, derives identity server-side, and isolates account state.
- It implements server-owned gravity, turns, four-direction wins, draws,
  terminal locking, move history, repeated branching undo/redo, terminal-score
  reversal/restoration, and durable reload/sign-in persistence.
- Version 6 imports distinct workbook boards, totals, histories, redo stacks,
  revisions, round ids, and all 11 completed matches. SQLite transactions reject
  stale two-tab writes, persist successful and rejected mutation receipts, revoke
  every account token on sign-out, and maintain a latest-ten idempotent archive.
- The client shows revisions, reconciles stale state, suppresses duplicate
  activation, retains keyboard focus, and renders a separate accessible replay
  board with step, Previous, Next, and Close controls.
- Exactly four verifier categories remain. Former Aesthetic criteria now live
  in Polish.
- Render and Constraints each contain two short smoke/contract criteria. They
  avoid persistent game mutations so concurrently evaluated dimensions cannot
  overwrite one another's expected account state.
- Every judge pins Codex, `openai/gpt-5.6-luna`, temperature zero, a versioned
  `prompt.md`, and Playwright MCP.
- `reward.toml` declares only the 0.6 Functional/0.4 Polish weights, while
  `test.sh` validates all dimensions and implements the Render/Constraints
  hard gate with complete zero-output fallback. Agent judges run serially so
  one mutating category cannot corrupt another category's SQLite baseline.
- `tests/coverage.json` maps 18 requirements and reports all 15 functional
  requirements covered by Functional (`100%`). There are 13 Functional
  criteria with total criterion weight 19; the five new behavior groups carry
  weight 10 without making them a global gate.
- Baseline solution and seed hashes are recorded. The verifier seed copy is
  byte-identical and documented as required by separate-verifier isolation.
- Docker images are tagged, pip/npm verifier tools are versioned, apt metadata
  is cleaned, runtime fetching is absent, and the agent image does not copy
  tests or solution.
- Both `[environment]` and `[verifier.environment]` use `network_mode =
  "public"`. Harbor Docker does not support verifier `allowlist`; retaining it
  creates an immediate launcher error and invalidates end-to-end grading.
- Constraints has a 900-second judge timeout, Functional 2400 seconds, Polish
  1800 seconds, and Render 480 seconds. A timed-out dimension with blank
  reasoning is infrastructure failure, not a genuine zero.
- The upload ZIP contains 28 files beneath exactly one
  `dropline-four-lite/` wrapper. `tests/coverage.json` remains an authoring file
  and is intentionally excluded from the platform archive.
- Version 6 has passed local API, real-Chromium, exact-draw/undo/redo regression,
  two-tab conflict, all-session revocation, 11-record/latest-ten archive lifecycle,
  request-result replay, keyboard-focus, 375-pixel replay, and reduced-motion checks.
- Exact v6.0.3 Oracle scored `1.0000`: all four dimensions and all 22 criteria
  passed, including 13/13 Functional criteria.
- Exact v6.0.3 GPT-5.4-mini scored `0.5390`: Render `1.0`, Constraints `1.0`,
  Functional `0.6316`, and Polish `0.4`. OpenHands 0.62.0 reached `FINISHED`,
  with no exception or no-op, and every criterion has non-empty reasoning.
- Exact v6.0.3 Haiku scored `0.3327`: Render `1.0`, Constraints `1.0`,
  Functional `0.4211`, and Polish `0.2`; all 22 criteria have reasoning and no
  judge timed out. Haiku built the graded app but then self-terminated
  OpenHands with `pkill -f "node /app/server.js"`, producing exit 143. Preserve
  this as a transparent model-caused exception rather than infrastructure zero.

### Remaining platform and delivery work

1. Run the final static/upload QC after refreshing all v6.0.3 reports and hashes.
2. Upload the nested `dropline-four-lite.zip` and confirm the platform's own
   batch checks accept the public network configuration.
3. Run Sonnet 4.5 only if the strict multi-model delivery checklist is enforced;
   the reviewer-requested Oracle, GPT-5.4-mini, and Haiku runs are complete.
4. Add eight-rollout and three-repeat statistics only if those scorecard rows
   are treated as mandatory rather than unmeasured follow-up.

### Current high-risk QC items

| Check | Current status | Reason |
| --- | --- | --- |
| A2 real provenance | Platform confirmation needed | Metadata truthfully identifies the tracker assignment and task owner's live request; the platform must decide whether that provenance meets its real-traffic bar. |
| A3 natural source voice | Addressed in source | The main prompt retains lowercase, terse human wording instead of formal checklist prose. |
| B1 complete mapping | Addressed in source | All 18 requirements map to live criterion IDs; concurrency and records requirements are instruction-backed. |
| D2 hard gate | Addressed in source | The runner validates four dimensions and applies the exact gate/formula. |
| E2 frozen/hash-recorded baseline | Partial in scored package | Version 6.0.3 records both seed copies and golden-file SHA-256 values, but packaged `solution/app/server.js` has mixed LF/CRLF bytes and does not match its recorded LF-normalized hash. |
| Functional `>80%` | Addressed in source | Defined denominator is 15 functional requirements; Functional covers all 15 (`100%`). |
| Four categories only | Addressed in source | Only Render, Constraints, Functional, and Polish remain. |
| Three-word dash naming | Addressed in source | Source/task/npm/delivery slugs use `dropline-four-lite`. |
| Docker/runtime checks | Passed locally | Exact v6.0.3 Oracle, GPT, and Haiku launched and completed the full verifier under Docker. |
| Run evidence | Addressed | All three runs share the exact submitted task checksum; GPT is 0.5390 and Oracle is 1.0000 with 13/13 Functional passes. |
| Haiku agent exit | Transparent model failure | Haiku's artifact received a complete 0.3327 grade, but its final broad `pkill` command self-terminated OpenHands with exit 143. |
| Delivery set | Addressed for requested runs | Nested task ZIP, Oracle/GPT/Haiku evidence ZIPs, evaluation report, case study, and QC files are grouped under the final package. |

The post-run local preflight emulating the documented rules passes all 26 upload
checks and 18 of 19 source-decidable scorecard items. The sole failure is the
packaged `server.js` byte-hash mismatch caused by mixed line endings; correcting
it would change the exact task checksum and therefore requires new run evidence.
This is not a platform
Rules result; treat the platform checks as unverified until an upload passes.

## Current Brickfall audit snapshot

Working source reviewed:
`projects/brickfall-breaker-arcade/`

- The canonical three-word slug is `brickfall-breaker-arcade` and the current
  task version is `2.2.1`.
- It has exactly four verifier categories: 2 Render, 2 Constraints,
  16 Functional, and 7 Polish criteria. Render or Constraints failure gates the
  reward to zero; otherwise the reward is `0.6 * Functional + 0.4 * Polish`.
- The long contract is split into eight mounted instruction files of no more
  than 20 lines. Exact level manifests, constants, seeded checkpoints, drill
  outcomes, concurrency rules, receipt replay, latest-ten history, and terminal
  run tombstones are instruction-backed and verifier-visible.
- The v2.2.1 Oracle scored `1.0` in Render, Constraints, Functional and Polish.
  All 27 criteria passed, including every one of the 16 Functional criteria.
- The v2.2.1 GPT-5.4-mini regrade scored `0.2182`: Render `1.0`, Constraints
  `1.0`, Functional `0.0`, and Polish `0.5455`. The model's initial signed-out
  bootstrap rendered its form without binding the submit handler, so sign-in
  became a GET navigation and every authenticated Functional scenario remained
  inaccessible. This is a model-artifact failure, not a golden/verifier failure.
- Formal post-run local QC passed 29/29 executable assertions, all 19 active
  upload rules, and four optional rules; three disabled rules are not applicable.
  The checks cover TOML/JSON/Node/shell syntax, both Docker images and their baked
  tooling, no-op scoring at `0.0`, reward post-processing, package/ZIP structure,
  run-result parsing, and the model/Oracle thresholds. Functional coverage
  remains 14/14 (`100%`).
- The task ZIP contains exactly 31 allowlisted source files beneath one matching
  wrapper directory, and its extracted contents match the reviewed source.
  Runtime dependencies, databases, logs, caches, screenshots, and temporary test
  material are excluded. Both canonical Dockerfiles build successfully.
- The canonical verifier remains restricted to `openrouter.ai`. Disposable local
  run mirrors used public verifier networking only because this Windows Docker
  kernel cannot enforce Harbor's nft allowlist; that local workaround was not
  copied into the canonical task.
- Early Haiku attempts failed during setup or entered a zero-context condenser
  loop. The corrected run supplied explicit 200,000-input/8,192-output metadata,
  made 8,076,748 input-token and 118,863 output-token calls, and completed without
  an exception. Its first verifier handoff returned an ungraded no-op, but a
  regrade of the exact artifact produced a valid zero: Render `1.0`, Constraints
  `0.0`, Functional `0.0`, Polish `0.2727`, `graded=1`, and `no_op=0`. Haiku
  omitted the referenced `/game.js`, leaving `handleSignIn` undefined. The local
  Docker regrade used public verifier networking because Harbor regrade cannot
  enforce allowlists in Docker; all criterion files matched the canonical task.
  Sonnet 4.5 remains absent if the strict multi-model checklist is enforced.
- Post-run deliverables include `eval-report.md`, `case-study.md`,
  `qc-report.xlsx`, and `qc-findings.json`. The strict
  30-row scorecard records 23 passes, one partial, and six open measurement rows;
  those gaps require more robustness artifacts and are not source/golden defects.
- The drive-ready grouped copy is under
  `deliverables/brickfall-breaker-arcade/final-submission/`. It contains the task,
  GPT, and Oracle ZIPs plus the evaluation, case-study, and QC reports. Each ZIP
  stem matches its single internal wrapper (`brickfall-breaker-arcade/`,
  `gpt-run/`, `oracle-run/`, and `haiku-run/`), and every grouped copy matches its
  reviewed source SHA-256. The Haiku archive is sanitized, valid graded-zero evidence.
- Run-evidence validation confirms GPT and Oracle used the same frozen task
  checksum, every category returned its expected unique criteria, category
  scores recompute from criterion weights, and final rewards recompute from the
  hard-gate formula. GPT's 16 Functional failures are valid user-visible misses,
  but 15 are downstream authentication-blocked checks caused by its initial
  bootstrap returning before binding the sign-in handler; they are not 16
  independent root defects. Its five Polish failures also match the artifact.

## Current package snapshots

These hashes identify the packages assembled after the latest reviewed source
changes. Any later task edit invalidates the corresponding row and requires a
new semantic version, hash, and ZIP build.

| Task | Version | Source files in ZIP | ZIP SHA-256 |
| --- | --- | ---: | --- |
| `dropline-four-lite` | `6.0.3` | 28 | `A30778752EEAA2214C0B47CD93126E1EC866231267B0758EA5BDE1959A4FB98E` |
| `brickfall-breaker-arcade` | `2.2.1` | 31 | `9BEF39A6F1A02D1EC902CB09AAB1E8E15D822A9F44C7B5E93808376AF529F10F` |

## Brickfall cross-device handoff

As of 2026-09-04, `brickfall-breaker-arcade` version 2.2.1 is source-complete,
post-run checked and packaged. Do not rerun GPT-5.4-mini or Oracle merely for
packaging or documentation changes: their final evidence is exported under
`run-outputs/brickfall-breaker-arcade/gpt-run/`, `oracle-run/`, and `haiku-run/`,
with delivery archives `gpt-run.zip`, `oracle-run.zip`, and `haiku-run.zip`. Their
SHA-256 values are
`DFDA397DE6C02EEE076CF224C7070AD99BBA68852FF2A1D32364C8CB10915BC6`,
`BEE530B16488BA1E6729C358B2DD65553C2B010832FF9DC85DF5F24A7CADAA4B`, and
`1D39C21188234921E507EF1D48C701F8B40B14093C2F5BA5AE8534E0070270BA`.

The canonical task archive is
`deliverables/brickfall-breaker-arcade/brickfall-breaker-arcade.zip`; it contains
one matching wrapper and exactly 31 files. GPT-5.4-mini is inside the target band
at `0.2182`, and Oracle is `1.0` with 16/16 Functional passes. A rerun is required
only after changing the task contract, verifier, seed assets, or golden solution.
Haiku is complete for the stated project rule and is recorded at a valid graded
`0.0`; its exact captured artifact passed Render but failed Constraints because
the generated application omitted the referenced `/game.js`.
Sonnet 4.5 remains absent if the strict root delivery checklist applies.

## Final pre-delivery checklist

### Source and structure

- Canonical three-word lowercase dash-separated slug everywhere required.
- `turing/<task_name>` matches the package folder.
- Exactly five verifier directories, including Visual; no Aesthetic directory.
- Natural prompt with truthful provenance and no unchecked requirement.
- Correct stack and SQLite-backed bearer authentication.
- Minimal Harbor structure; no unrelated or generated files.
- Seed and baseline hashes recorded; version 1.0.0 with new checksums for changes.

### Static and upload QC

- All 19 platform source criteria pass.
- All 26 enabled upload rules pass; warnings are reviewed.
- Every explicit requirement maps to an assertion.
- Functional coverage is calculated and strictly greater than 80%.
- Every judge prompt is pinned and injection-resistant.
- Reward post-processing is tested for gate pass, render fail, constraints
  fail, malformed input, and missing output.

### Runtime QC

- No-op and refusal-only rollouts score at most 0.05.
- Two adversarial/wrong rollouts and keyword stuffing score at most 0.2.
- Oracle is greater than 0.95 and every Functional criterion passes.
- Primary model score is within the accepted band.
- Rewards produce at least four values and standard deviation at least 0.15
  across eight or more rollouts.
- Same rollout rescored three times is stable.
- Reward ordering is monotone from bad to good.

### Delivery

- Task ZIP stem equals its single wrapper folder.
- Oracle run ZIP included.
- gpt-5.4-mini, Haiku, and Sonnet 4.5 run ZIPs included.
- Evaluation report includes static, upload, runtime, score, and failure
  evidence.
- Case study explains task design, verifier separation, model failure modes,
  and final lessons without being placed inside the task ZIP.
