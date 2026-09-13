# Task Authoring Lessons: 12 September 2026

## Platform Evidence

GridForge v3's corrected 35-file package passed 45/45 platform static checks.
Its next Rubric Source review passed 51/53 checks and failed two prompt policies.
These results belong to the uploaded package, not to subsequent fixes or other tasks.

## Keep Authoring Reports Outside the Task

The platform rejected `coverage.json` at the task root. Retain requirement maps,
QC reports, screenshots and package scripts under the external delivery folder.
The allowed task-root layout is `README.md`, `environment/`, `instruction.md`,
`rubrics/`, `solution/`, `task.toml` and `tests/`; only create the optional entries
when needed. Exclude repository-only files such as `.gitattributes` from ZIPs.
Package one task-named wrapper and validate archive entries, not just source files.

The local template checker had passed 128 checks but lacked this root-layout
rule. A local checker pass must never be described as platform QC approval.

## Do Not Turn Asset-Origin Defects into a Universal Gate

The five GridForge prompts put every same-origin asset/request restriction in
the global browser gate. Under public networking, a working app with one external
font or CDN script would then lose every dimension and receive total reward zero.
The platform classified this as over-strict even though locally served resources
are legitimately required by the brief.

Keep the global gate focused on a substantive working local page, no fatal browser
error, actual backend data, and product-appropriate authentication. Retain the
brief's local-resource requirement, but grade asset-origin violations only in its
dedicated Constraints criterion. Public networking does not erase that requirement;
it changes where a violation is penalized. Do not duplicate it as a universal veto.
This supersedes the September 11 instruction to put all same-origin runtime
requests inside every global gate.

## State Independent Scoring in Every Batched Prompt

Render, Constraints and Polish lacked explicit independent-scoring instructions.
`weighted_mean` alone does not prevent an LLM judge from cascading one failure
into all criteria. Each prompt must say to continue after individual failures,
score each criterion from its own evidence and return every verdict. Keep all
mandatory subchecks within a criterion; do not award untested behavior.

Distinguish a documented shared prerequisite from an ordinary criterion. Only
the former may invalidate the whole batch. Do not invent cross-criterion all-pass
behavior, silently change aggregation, or soften real failures. Functional and
Visual need the same explicit policy even if they already had partial wording.

## Release Discipline

Increment the plain-text prompt revision whenever its contents change. Record
prompt/judge, runner, reward and archive hashes. For this GridForge correction,
only five prompts change; the app, seeds, criterion definitions/weights and runner
remain byte-identical to the previously locally tested archive. Verify this
mechanically and rebuild a new dated ZIP without overwriting historical packages.

The corrective release still needs a new platform QC and Oracle run. These lessons
and local validations cannot guarantee either result.

## Do Not Turn Calculation Rationale into Mandatory UI Copy

Common Ground Ballot's September 12 upload passed 45/45 static checks and 52/53
Rubric Source checks. Its only finding was `no_criterion_grades_the_unrequired`:
`published_approval_tally` demanded an on-screen explanation that approval
percentages may exceed 100%. The brief explained the participant denominator and
its mathematical consequence, but did not require that sentence in the UI.

Require the observable result, not extra copy inferred from its rationale. For
this seeded result, retain 2 participants and counts/percentages of 2/100%, 1/50%
and 1/50%, plus revision, privacy and persistence checks. Do not fail an otherwise
correct implementation for omitting an explanatory note. Do not expand the brief
solely to justify an accidental extra test. Bump the prompt revision, preserve
criterion weights and test the golden solution again before packaging.

The above platform pass counts describe the reported pre-fix upload. The corrected
package still needs a new platform review; local checks are not that review.

## Inspect Golden Secondary Surfaces for Full Visual Credit

GridForge v3's full Oracle passed all 43 binary criteria but scored 0.9167 in
Visual and 0.9833 overall. The judge deducted for dense/clipped raw JSON in the
revision preview and overall craft. A functional preview is not automatically
a fully polished preview. The user requests a Visual = 1.0 target for future
golden solutions; check secondary states and every required viewport before
the next task is frozen. Preserve fair appearance criteria and actual scores.

Current acceptance evidence is separate: scorecard C1 asks for Oracle >=0.95,
and the execution checklist asks for >0.95 plus all Functional passes. Neither
adds a standalone Visual = 1.0 minimum for this existing GridForge run. A new
authoring target must not be presented as a historical platform requirement.

## Capture Evidence Before Irreversible State Transitions

Common Ground Ballot's rubric-r2 Oracle returned 0.8928. Its three failed criteria
reported an Open edit-refusal check performed too late, a lost successful vote
exchange, and a missing fresh vote refusal while Closed. These were not three
demonstrated golden application defects. The unchanged golden source passed the
corresponding local checks, but that evidence does not replace the recorded score.

Give the browser judge an ordered checkpoint list. Register action-specific
request/response capture before the click, preserve the complete successful
exchange in private judge-owned evidence outside the app, and read it back before
replay. Keep original operation ids and revisions for exact retries, including
after app restarts. Do not rely on the browser's latest network list or manufacture
another successful vote when a capture is lost. Keep secrets out of verdicts/logs.

Before leaving a lifecycle state, record each required observation as completed,
app-failed or evidence-missing. Continue independently reachable criteria after a
failure; checkpoint ordering is not an extra all-pass gate. A Published refusal
does not establish a Closed or Open boundary. Isolate the reason for rejection:
test stale edits while editing is otherwise valid; use current revisions and fresh
operation ids for eligibility/input/duplicate-participation controls. Invalid
state, role, or stale-request refusals must not masquerade as another guard.

For judge-r3, only the Functional prompt changes (r4 to r5); criteria, weights,
brief, golden source and runtime remain unchanged. Thirteen local golden groups
pass and four disposable broken variants fail at the expected checks. Full Oracle
and platform QC on the new archive remain pending; do not promise a score of 1.

## Exact Inputs And Independent Ripple Checks

Ballot's subsequent r5 results were Oracle 0.9595, GPT 0.7393, Gemini 0.6536,
Haiku 0. Oracle's only functional failure called a draft malformed without
retaining the exact input. The captured golden passed concrete browser controls
for blank/repeated choices, blank title, minimum choices and approval bounds.
Specify a valid base form, change one invalid field, confirm actual control values
and voting mode, then preserve the exchange and state comparison. A negative-test
title is not evidence that its payload is invalid. Respect native input prevention;
do not submit a corrected valid form and expect rejection.

Write each captured exchange before assertions. Do not run unrelated negative
requests in one throwing batch. Verify the actual signed-in actor just before
role/eligibility probes. Isolated GPT tests rejected ineligible Owen and cross-ballot
Leila correctly; another accepted repeated-option request had contaminated the
shared workflow. Judge failures are not automatically independent app defects.

Scope delayed anonymous tally checks to the ballot actually probed. An approval
defect must not fail a correct single-choice receipt replay, mismatch guard or
eligibility snapshot. Use independent UI-created controls when a failed guard has
consumed participation; preserve the original failure and never reset it away.

Recheck rendered result totals after real restarts. GPT multiplied seeded Garden
counts 1-1 to 2-2 to 3-3 while keeping two participants. Assign distinct scoring
ownership: published-result criteria own exact durable totals/percentages/ties;
the persistence criterion owns session/record/receipt survival. Do not count the
same tally defect three times. Do not invent request fields to force a failure:
GPT's vote did not send a revision field, so an extra-field diagnostic was excluded.

Current Ballot upload is deliverables/common-ground-ballot/2026-09-12-judge-r4/
with Functional r6. Fifteen local golden groups pass, but this package has no new
platform QC/Oracle/model score. Correct fairness fixes may raise model scores.
Do not promise that an updated task will land in the target score band.

The brief's comfortable-touch-target wording is not a hidden numeric 44px rule.
Use actual touch operability, separation, overlap and clipping evidence unless the
task explicitly states a pixel minimum. Ballot Polish r3 records this distinction.

## One Rejection Reason Per Negative Control

Before the complete Ballot rerun, Functional r7 isolates two remaining controls:
use a fresh operation id for malformed/fractional lifecycle writes, otherwise an
operation-mismatch rejection can conceal bad revision validation. To test Closed
voting, use an eligible Member who has not yet participated, at the current Closed
revision with a fresh operation id and a valid in-ballot choice. An already-voted
Member can be refused for duplication even when the Closed guard is missing.

This distinction was reproduced with a disposable missing-Closed-guard mutant:
the old duplicate-based check passed; the new unparticipated-Member check caught
an incorrect 201 success. The unchanged golden passes all 16 local test groups.
Current ZIP: deliverables/common-ground-ballot/2026-09-12-judge-r5/common-ground-ballot.zip.
The user will run the complete platform pipeline; there is no new platform result
yet. Keep the package frozen pending that evidence rather than retuning weights.
