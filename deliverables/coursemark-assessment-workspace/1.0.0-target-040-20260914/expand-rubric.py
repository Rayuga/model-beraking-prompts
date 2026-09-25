from pathlib import Path
import json

OUT=Path(__file__).resolve().parent
TASK=OUT.parents[2]/'projects/coursemark-assessment-workspace'
functional=[
('worksheet_atomic_rows_and_totals',12,'''Setup: after the existing grading/numeric checks, use submitted unreleased AT-100.
Discover the Grading worksheet through Ada or assigned Luis. Record all rubric
rows, attempt state, total, revision and audit before each controlled write.
1. Save RC-1=1 and RC-2=2 with distinct feedback together through the worksheet.
Require one revision and one grade event, stored rubric total 3, objective 4 and
total 7. Single-row grading and reload must show the same values.
2. Adapt that observed multi-row request: put a valid RC-1 change before an
invalid RC-2 score 4, then test duplicate criterion IDs and a criterion from
another assessment. Use fresh identities/current revisions. Require 4xx and
exact unchanged grades/totals/status/revision/audit, including the first row.
3. Select only RC-1 and save zero: preserve RC-2=2 and derive total 6. Finish with
both criteria=3, total 10. Reject student/unassigned or released-attempt writes.
No partial transaction and no extra per-row revision/event is allowed.'''),
('worksheet_concurrent_grading_and_receipts',12,'''Setup: open the same unreleased AT-100 worksheet as Ada and Luis in separate
real authenticated browser contexts at the same course revision. Preserve both
typed forms and current server baseline. Do not invent UI/request fields.
1. Ada saves RC-1=2, RC-2=3. Luis's stale save of 1 and 3 must return conflict,
leave Ada's total 9 unchanged, keep Luis's typed values and visibly explain it.
2. Refresh authoritative revision through the supported recovery and deliberately
retry Luis's retained values. Require one accepted write and total 8. Do not
declare this failed merely because the fresh retry was never performed.
3. Replay Ada's earlier exact accepted request using her still-active token.
Require its original status/result, no extra event/revision and no overwrite of
Luis's current grades. Changed worksheet input under that identity must return
409 unchanged. Preserve receipts and baselines for the final restart.'''),
('release_preview_authority_and_readonly_state',12,'''Setup: AT-100 is fully graded and unreleased after worksheets; AT-103 is graded
and unreleased from exact expiry. Use Ada's visible Release batch workflow.
If a previous criterion could not establish this state, prepare other legitimate
submitted/graded attempts through supported UI without resetting the database.
1. Select both and preview. Require the actual two students/assessment titles and
awarded totals, with no release, revision or audit change. Record the preview's
server-issued binding and full before/after course data.
2. Using captured preview shape with fresh current metadata, test empty and
duplicate selections and valid plus ungraded/already-released/nonexistent IDs.
Require rejection, no release, no revision and no audit change.
3. Nora and Luis cannot preview or commit Ada's batch or receive private totals.
Changing the visible selection invalidates the review/commit affordance. Restore
a legitimate preview of two eligible attempts for the following criterion.'''),
('release_plan_stale_atomic_commit_and_replay',12,'''Setup: retain a valid reviewed two-attempt release and Ada's issued plan/binding.
1. Make one legitimate course write in another tab. Commit the old preview with
fresh current request revision and operation identity. It must still return 409
because the reviewed state is stale, with neither attempt released and no extra
revision/event. Client-supplied replacement IDs/totals must not bypass the binding.
2. Show the stale explanation, obtain a fresh preview through visible controls,
review and commit it. Require both releases together, one course revision, one
release audit event per selected attempt and owner-only student visibility.
3. Exact commit replay returns its original success without any new effect.
A fresh operation against the consumed preview refuses unchanged. Retain this
accepted receipt and the plan identity for final restart verification.'''),
('outcome_policy_atomic_validation',12,'''Setup: open Ada's Outcome ledger and Edit weights. Existing A-01/A-03/A-04 start
40/40/20; all newly published assessments start at zero; drafts are excluded.
Snapshot every policy entry, course revision, audit and underlying attempt.
1. Save A-01=30, A-03=50, A-04=20 and zero for every other published assessment
through the UI. Require one revision/event and durable matching values.
2. Adapt the captured whole-policy request independently to total 99 or 101,
duplicate/missing rows, a draft/unknown ID, negative, null, Boolean, blank and
more-than-two-decimal weights. Fresh identity/current revision each time. Require
4xx and no partial policy, revision, audit, grade or exception change.
3. Student/TA policy writes must refuse. Restore 40/40/20 plus other zeros through
the UI, proving a normal valid save still works after all negative cases.'''),
('outcome_zero_missing_excused_arithmetic',12,'''Setup: retain Ben's released AT-101=4.5/10 from the original grading journey.
Author a fresh 5-point objective-only assessment, submit an incorrect answer as
Ben and release its true zero. Nora must have no attempt on that fresh assessment.
Set A-03 and the new assessment to 50% each, all others zero, through policy UI.
1. Ben's ledger must show released zero distinctly and final 22.50%. Nora's A-03
5/10 plus missing new work must produce pending, never 25% or a fabricated zero.
2. Excuse Ben's new assessment with a reason: final becomes 45.00% with included
weight 50. Restore it: final returns to 22.50%. No attempt/score is deleted.
3. Excuse Nora's missing assessment: her final becomes 50.00%. Excuse all remaining
positive-weight work for Nora: no included denominator and no final percentage.
Restore A-03 inclusion and require 50.00%. A blank excuse reason must reject
without policy/grade/revision/audit change. Round only the final percentage.'''),
('outcome_privacy_search_and_reauthentication',12,'''Setup: retain the ledger/exception state from the arithmetic journey. Use
authentic instructor, student and TA sessions and observed outcome reads.
1. Ada can search name/email to find each enrolled student and clear the filter
to restore both. Each labeled assessment cell exposes the correct state and
weight; new published zero-weight work remains explicitly unweighted.
2. Nora and Ben receive only their own rows. Unreleased awarded values anywhere
in their responses are absent/null, not zero. Preserve an unreleased positive
weighted attempt as a privacy control, while a released zero remains numeric.
TA full-ledger reads and policy/exception writes must refuse without private data.
3. Reload and reauthenticate. Require policy, reasons, inclusion and all released
calculations unchanged. Retain full ledger/policy/exception/receipt baselines for
the one final process restart. Do not waive missing observations.''')]
polish=[
('worksheet_selection_and_conflict_recovery',2,'''Use the actual multi-row grading worksheet by keyboard. Labels identify each
criterion, maximum, score and feedback. Row selection explains which values save
together. Invalid/stale saves retain typed rows, show an actionable message and
permit intentional recovery. Pending activation cannot send another accepted
save. Modal closure returns focus to a usable control. Judge usability here;
the Functional criteria separately establish transactional correctness.'''),
('outcome_ledger_explanations_and_search',2,'''Use the outcome ledger as instructor and student. Clearly distinguish pending,
missing, unweighted, excused and released zero, label included weight and final
percentage, and show excuse reasons. Instructor name/email search has a useful
empty state and can be cleared. Student-only visibility remains understandable.
Assess visible explanations and controls, not inferred backend calculations.'''),
('release_review_and_stale_preview_recovery',2,'''Use Release batch through selection, preview, an intervening valid write and
stale recovery. Recipients, assessment names and awarded totals are reviewable
before commit; changing selection visibly invalidates preview. A stale rejection
explains how to preview again. Successful commit is announced and pending commit
cannot be activated twice. Keyboard access and focus remain usable throughout.'''),
('outcome_policy_forms_and_mobile_access',2,'''At 1280x800 and 375x812 use weight editing, exception entry, the ledger, worksheet
and release review. Controls have associated labels and visible keyboard focus;
weight total and validation are understandable; rejected forms retain values.
Required fields, recipient names and save/review actions must be reachable without
horizontal page scrolling or clipped actions. Native modal vertical scrolling is
allowed. Distinguish this interaction usability from Visual appearance.''')]
def blocks(rows):
    return ''.join('\n[[criterion]]\nid = '+json.dumps(i)+'\nname = '+json.dumps(i)+'\ntype = "binary"\nweight = '+str(float(w))+'\ndescription = """\n'+d+'\n"""\n' for i,w,d in rows)
p=TASK/'tests/functional/judge.toml';s=p.read_text(encoding='utf-8');marker='[[criterion]]\nid = "restart_persistence_and_seed_idempotence"';assert marker in s;s=s.replace(marker,blocks(functional)+'\n'+marker);s=s.replace('browser refresh alone. Revoked session tokens must remain rejected.','browser refresh alone. Revoked session tokens must remain rejected. Also compare\noutcome weights, exceptions, all permitted ledgers and the committed release batch;\nreplay retained worksheet/batch receipts and refuse a consumed preview under a\nfresh operation, without changing any baseline.');p.write_text(s,encoding='utf-8')
p=TASK/'tests/polish/judge.toml';p.write_text(p.read_text(encoding='utf-8')+blocks(polish),encoding='utf-8')
for dim in ['render','constraints','functional','polish','visual']:
    p=TASK/f'tests/{dim}/prompt.md';s=p.read_text(encoding='utf-8').replace('-v1.0.0-r2','-v1.0.0-r3')
    extra='''\nRequired outcome surfaces include the weighted ledger, weight/exception forms,
atomic grading worksheet and reviewed batch release. Discover their visible
controls in Gradebook. Preserve current state across dimensions; do not reseed.
'''
    if dim=='functional':extra+='''
After the existing six hardening criteria, run the seven outcome criteria in
their listed order: worksheets, release previews/commit, policy, arithmetic and
privacy. The single restart remains last and includes their durable state.
Complete the numeric-validation matrix and the fresh two-tab retry when their
turn arrives; preserve compact HTTP/status/state evidence immediately. Reserve
time for all remaining criteria. An unexecuted test is unverified evidence, not
a demonstrated product defect. Continue independently and explicitly distinguish
missing evidence in reasoning; do not fabricate passes or skip positive controls.
The API adapters must use the app's actual routes/field names, not the golden's.
'''
    if dim=='visual':extra+='''
Inspect the outcome ledger, policy/exception forms, worksheet and reviewed release
at both required viewport sizes as well as the original surfaces. Judge their
rendered readability, grouping and responsive consistency under the existing
anchors. A missing required surface is not evidence of visual excellence.
'''
    s=s.replace('{criteria}',extra+'\n{criteria}');p.write_text(s,encoding='utf-8')
p=TASK/'tests/visual/judge.toml';s=p.read_text(encoding='utf-8');s=s.replace('Attempts, Gradebook, Audit and available form/detail surfaces.','Attempts, Gradebook, Audit, weighted ledger, policy/exception forms,\nworksheet, release review and available form/detail surfaces.');p.write_text(s,encoding='utf-8')
p=TASK/'task.toml';s=p.read_text(encoding='utf-8').replace('Concurrent full-stack course assessment workspace with timed accommodations, grading, release, audit, idempotent writes, and durable role isolation','Course assessment workspace with atomic grading worksheets, weighted outcomes, reviewed batch release, timed accommodations, and durable role isolation');p.write_text(s,encoding='utf-8')
(OUT/'rubric-expansion.json').write_text(json.dumps({'new_functional':[{ 'id':i,'weight':w}for i,w,_ in functional],'new_polish':[{ 'id':i,'weight':w}for i,w,_ in polish],'existing_criterion_weights':'preserved','dimension_weights':'unchanged 60/20/20'},indent=2)+'\n')
print('Added seven Functional and four Polish outcome criteria; prompt revision r3')
