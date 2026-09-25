from pathlib import Path
import hashlib
import json
import re
import tomllib

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TASK=ROOT/'projects/common-ground-ballot'
brief=(TASK/'instruction.md').read_text(encoding='utf-8')
lines=brief.splitlines()

def line(fragment):
    return next(i for i,text in enumerate(lines,1) if fragment in text)

groups=[
('Identity, role and Observer workspaces','Ruth Adebayo is our Coordinator.', ['authenticated_role_identity','observer_ballot_setup_access','observer_published_results_access','observer_members_access','observer_audit_access','staff_write_role_boundaries']),
('Authoritative initial records',"I've left our starting records",['seeded_ballot_and_roster_records']),
('Draft inputs and editing','For a new ballot, Ruth needs', ['draft_input_validation','draft_creation','draft_edit']),
('Lifecycle and delayed publication','The stages we use are Draft', ['ballot_open_transition','open_definition_lock','ballot_close_transition','closed_vote_refusal','unpublished_results_hidden','publish_transition','published_terminal_lock']),
('Single-choice and Approval result mathematics',"The stages we use are Draft", ['published_single_choice_tie','published_approval_tally']),
('Eligibility frozen at opening','Eligibility is decided when a ballot opens', ['fixed_eligibility_snapshot']),
('Private vote content and participation',"Privacy is the part", ['private_final_vote_confirmation','staff_identified_turnout','anonymous_choice_separation']),
('Member read isolation','Members only get their own participation', ['member_participation_isolation']),
('Session authority, integrity and revocation',"I'd expect the server to know", ['ordinary_session_revocation','all_sessions_revocation','session_identity_authority','unforgeable_session_credentials']),
('Positive whole revisions; malformed writes leave records intact','One detail here matters:', ['ballot_target_and_revision_validation','membership_input_validation']),
('Voting method and final submission limits','For a new ballot, Ruth needs', ['cross_ballot_choice_rejection','single_choice_submission_limits','approval_selection_limits','duplicate_participation_rejection']),
('Vote revision invariance','We do leave tabs open', ['accepted_votes_preserve_ballot_revision']),
('Ordinary optimistic concurrency',"An old tab mustn't overwrite", ['stale_ballot_revision_refusal','roster_conflict_snapshot_chain']),
('Exact durable operation receipts','The other awkward case is a lost response.', ['exact_vote_success_receipt','staff_mutation_success_receipts']),
('Operation identity and Approval set equivalence','Reusing an identifier for different input', ['approval_order_independent_receipt','operation_id_mismatch_safety','user_wide_operation_namespace']),
('Durable refusal receipts and private administrative audit','We also need to remember a valid request', ['refusal_receipt_after_state_change','business_audit_records','audit_choice_privacy']),
('Durable state, sessions and one-time seed','A few hosting details', ['durable_reauthentication_and_seed_safety']),
('Initial attempts survive before a reply; no automatic resend','On the browser side, could we have a Pending actions area?', ['durable_pending_staff_work']),
('Retry retains exact original attempt and resolves usable outcomes','An explicit Retry should ask', ['immutable_pending_retry']),
('Several independently recoverable actions','There could be several uncertain actions', ['independent_pending_actions']),
('Account-owned pending work across sign-in changes','Those reminders belong', ['pending_actor_isolation']),
('Shared pending state, late outcomes, closed owner recovery','We also keep two tabs open', ['cross_tab_pending_resolution']),
('Late Retry replies cannot affect the new account','One more shared-computer problem:', ['late_recovery_reply_isolation']),
('Combine disjoint or matching fields before explicit save','If she changed the title', ['disjoint_draft_review']),
('Compare three versions; explicitly choose each conflicting field','For draft edits, just saying', ['conflicting_draft_review']),
('Another edit during preview; retain working copy and re-review','Another edit might land', ['draft_review_rechecks_revision']),
('Discard working copy without writing','Another edit might land', ['draft_review_discard']),
('Lifecycle locks stop reviewed editing','Another edit might land', ['draft_review_lifecycle_stop']),

('Review a selected meeting round without writes','We sometimes put several decisions', ['round_review_and_cancel']),
('Commit every selected opening and fixed snapshot together','When she confirms a round', ['round_atomic_open']),
('Refuse any changed draft and explicitly review again','When she confirms a round', ['round_draft_conflict']),
('Whole-roster revisions, including change-and-return','The member list can change under her', ['round_roster_conflict']),
('Whole-round admissibility and required revision types',"I don't want a malformed selection", ['round_input_boundaries']),
('Server-enforced Coordinator authority for rounds',"I don't want a malformed selection", ['round_role_boundaries']),
('Canonical round identity, namespace and original success','For retries, order', ['round_success_receipt']),
('Original round refusals survive later confirmations','Changing the selection or a reviewed revision', ['round_refusal_receipts']),
('One durable original pending round and current-state refresh','An interrupted round belongs', ['round_pending_recovery']),
]
mapped={criterion:(label,line(fragment)) for label,fragment,criteria in groups for criterion in criteria}
judges={d:tomllib.loads((TASK/'tests'/d/'judge.toml').read_text(encoding='utf-8')) for d in ('functional','render','constraints','polish','visual')}
assert set(mapped)=={c['id'] for c in judges['functional']['criterion']}
rows=['# Public requirement and criterion ownership','',
      'This is a local coverage review, not a platform QC verdict. Every Functional ID has an explicit public product requirement. Normal server guards, review UI, receipt outcomes and delivery ownership retain separate verdicts.','',
      '| Functional criterion | Public requirement | instruction.md line |','| --- | --- | --- |']
for c in judges['functional']['criterion']:
    label,number=mapped[c['id']]
    rows.append(f"| `{c['id']}` | {label} | {number} |")
rows+=['','Render owns navigation and the minimum persisted create/open/vote/close/publish product gate. Constraints owns the documented health endpoint and real SQLite storage. Polish owns keyboard/semantic/focus/touch/motion/status/feedback/mobile operation. Visual owns degree of visual craft. Their four judge/prompt pairs are byte-identical to the last Oracle run, which scored each dimension 1.','',
       'All asked status surfaces are explicit in the brief: ballots, membership and participation. Review method/limit/ordered choices are one field, while title and context are independent. Matching concurrent changes receive no unnecessary conflict choice. The three new review workflows have distinct false-pass witnesses: lost remote fields, silently selected conflicts, or saving against an unseen revision. Discard and lifecycle stopping each have their own observable.','',
       'The reviewed-save refusal receipt is checked by refusal_receipt_after_state_change. draft_review_rechecks_revision scores only review working-copy retention, choosing the viewed revision and fresh operation IDs. This avoids scoring the same refusal body in two criteria. Existing read-only/mock floor controls remain mandatory Render/Constraints gates.','',
       'No evaluator-specific DOM selectors, route spellings, storage technology for pending/review state, or exact UI copy are imposed by the new criteria. Browser contexts and trusted helper APIs in the execution prompt describe evaluator tooling, not a required application implementation.','']
(HERE/'coverage-matrix.md').write_text('\n'.join(rows),encoding='utf-8',newline='\n')

rubric=(ROOT/'task-implementation.txt').read_text(encoding='utf-8')
names=[re.search(r'name\s*=\s*"([^"]+)"',b).group(1) for b in rubric.split('[[criteria]]')[2:]]
assert len(names)==53
notes={
1:'First-person association product request; new review behavior explains the user problem without prescribing code.',
2:'Existing conversational voice retained; additions use concrete shared-tab and shared-computer situations.',
3:'UTF-8 source and spelling reviewed; no template or evaluator residue in the brief.',
4:'Coverage matrix links all 66 Functional outcomes; runtime, accounts, statuses and presentation asks are explicit.',
5:'No grader, score, rubric, criterion IDs or private verifier paths in instruction.md.',
6:'New review requires one extra Draft and existing Ruth profiles; no new account/service/library or unavailable input.',
7:'Full authenticated ballot product with real writes, private voting, durability and review/recovery workflows.',
8:'Slug/name/version coherent; metadata updated to name draft review while keeping standard keys.',
9:'Public network, synthetic accounts and existing resource values preserved.',
10:'Separate verifier, pinned packages/model wiring and unchanged verifier.env.',
11:'12000s sum < 12600s runner < 13200s outer; Functional has 7200s, latest old run used 1929s; bounded new sequence reuses fixtures.',
12:'No prebuilt agent image shadows environment/Dockerfile.',
13:'Seed, starter and all public asset/runtime paths unchanged.',
14:'Unchanged authoritative synthetic seed; old and new browser regressions accept it.',
15:'Agent Dockerfile/dependencies unchanged from the deployed working package; final local validation uses cached dependency layers.',
16:'Starter contains infrastructure and incomplete shell only; new review/golden files are solely in solution/.',
17:'78 passing browser checks cover golden behavior; new review has saved server-backed positive controls.',
18:'Every new outcome has a golden browser witness; all existing nonfunctional judges remain unchanged.',
19:'Real solve.sh/runner starts unprivileged Node with embedded seed, durable DB and no runtime /assets dependency.',
20:'Checked-in reference code; no remote generation or runtime model dependency.',
21:'Unchanged zero-initialization/failure paths and safe lifecycle runner; 30 runner checks pass.',
22:'Pinned verifier runtime starts real browser/golden app and discovers all five judges; cached build limitation recorded.',
23:'Port, command, DB_PATH, SEED_PATH and health contract match the public brief.',
24:'TOML parses; five dimensions/86 criteria discovered; actual fixed 0.6/0.2/0.2 composition tested.',
25:'All prompts drive real browser; added review requires visible UI and real exchanges, never source-only scoring.',
26:'Coverage matrix reconciles every Functional criterion; existing four dimensions retained; all new asks have owners.',
27:'Merge units, explicit choices, repeat review, discard, lock, late reply and abandoned tab are stated publicly.',
28:'Separate merge/choice/re-review/cancel/lock/delivery owners; receipt persistence stays in its existing criterion.',
29:'All five shared gates remain byte-identical, including real failed-login and credential-free protected-read probes.',
30:'New refusals/absence checks use accepted edit/retry and authorized reads as positive controls.',
31:'All three merge fields and both late-response outcomes are required; existing all-role/action-family matrices retained.',
32:'Full-credit observations are real UI, request/response and subsequent persisted records; no hardcoded app internals.',
33:'Each bar has one observable meaning; accepting a preflight or preventing an account switch are equivalent protections, not waived safety.',
34:'Real clicks, tab creation/closure, held replies, reloads, restarts and 390px viewport were exercised.',
35:'Unchanged minimum-product gate and actual functional lifecycle/restart checks remain.',
36:'Review values/records are newly created, distinct from seed data; none shipped pre-completed.',
37:'New review fixture is isolated after seeded checks; later dimensions explicitly use current mutated state.',
38:'Failures stay with their owner; missing review ends only those unavailable UI cases and does not stop recovery tests.',
39:'Blank/auth fakes fail shared gate; real read-only/create-only/publish stubs still fail mandatory saved ballot journey.',
40:'66 independently weighted binary functional outcomes plus graded visual craft preserve partial credit.',
41:'Behavior is binary; six visual properties retain five-point anchored Likert grades.',
42:'All coefficients/weights positive; failing a behavior cannot increase score. Fake/read-only products are gated to zero.',
43:'Render/Constraints have no final reward mass; their failure zeros all weighted terms.',
44:'Functionality remains 60%; existing weights untouched. New workflow weights total 14/73.5, reflecting multi-step product work.',
45:'Untrusted app scoring instructions are ignored in all prompts; helper only records real observations.',
46:'Tests/helpers remain private, outside /app; no grader code or answer copied into starter.',
47:'Pinned model/runtime, temperature 0 and prompt r25; acknowledge autonomous judge variance rather than claim determinism.',
48:'Shared accounts/seed/workspaces/paths consistent; Functional uses the updated seven saved refusal/review flows as documented.',
49:'Source validator checks standard runtime/env/budget and single-authority weights; no parallel numeric policy changed.',
50:'29 allowed task files; reports, scripts, mutation fixtures and artifacts stay outside the ZIP.',
51:'All JSON/TOML parse; JavaScript executed by actual pinned browser and Node; runner/shell exercised.',
52:'Only public demo credentials; no live key in Dockerfiles/runner, no host paths in task, private capture redaction preserved.',
53:'Association ballots, frozen eligibility, anonymous selections and revision-aware recovery/review form a domain-specific task.',
}
notes[48]='Shared accounts/seed/workspaces/paths consistent; reviewed-save refusal is the third saved refusal in Phase D, with one criterion owner.'

notes.update({
  1:'First-person product request now explains the meeting use case for reviewing and opening a round.',
  4:'66-row Functional coverage map plus unchanged Render/Constraints/Polish/Visual ownership; no-active roster, malformed versions and cross-action round namespace explicitly covered.',
  6:'Four pairs and one outsider use existing accounts and normal UI. Leila remains at membership revision 1 until its boolean-type control; no reset is required.',
  11:'Standard agent 7200s; supplied SQLite/auth/session/shell foundation retained. Functional 7200s versus last measured old run 1929s; round plan reuses four pairs, bounded tables and the one restart, with a 20-minute persistence reserve. New full autonomous duration remains unmeasured. Sum12000 < runner12600 < outer13200.',
  17:'96 golden browser checks: 78 existing plus 18 real-MCP round checks, including 16 malformed packets, three role probes, a held initial reply and real restart.',
  18:'Golden server/client implement all nine round owners; other four verifier definitions and prompts are byte-identical.',
  26:'Every added round paragraph maps to one or more of nine distinct owners; existing presentation/runtime requirements retain their owners.',
  27:'Round preview, atomic commit, draft/roster conflicts, validation, permissions, canonical receipts, original refusals and recovery are all public requirements.',
  28:'Round permissions and input validation are split. Individual-ballot persistence excludes round records; atomic round persistence owns those records. Receipt computation and outgoing recovery identity have separate failure witnesses.',
  30:'Accepted mixed-method round is the positive control for all refusals; probes use current authorized inputs except the one changed variable.',
  31:'Both methods, all three denied roles, both draft conflict types, whole roster including paused Members, empty active roster, both revision locations/types and both success/refusal receipts have observations.',
  32:'Actual preview, confirmations, packets, protected records, audit, Member visibility and restart supply evidence; no route or schema is prescribed.',
  34:'Pinned MCP/browser exercised cancellation, re-review, stale confirmations, held initial response, reload, sign-in, current-state Retry, real restart and narrow viewport.',
  36:'All round fixtures are freshly created through UI; no round outcome is pre-seeded or hardcoded.',
  37:'Round mutations occur after seed checks; Leila revision-1 control reserved explicitly; later dimensions use current state.',
  38:'Missing round feature ends affected cases only. Direct observed server receipts remain independently testable when recovery UI fails, and vice versa.',
  44:'Functionality60%, Polish20%, Visual20%; gated shells0. New round outcomes weigh30/103.5 of Functional (17.39% overall). Complex atomic/receipt/recovery workflows use existing weight4 precedent; preview3, validation2, permissions1. Previous weights are unchanged.',
  47:'Pinned model/runtime and temperature0; Functional r26. Scripted passes do not imply deterministic autonomous judging.',
  48:'One extra round success and three round refusals reuse the final restart. Whole-round retention refreshes Closed/Open current state; original receipts never replace it.',
  53:'Association-specific anonymous ballots now include same-meeting opening against a reviewed roster; this is real product work, not a target-model exception.',
})

review=['# Local review against task-implementation.txt','',
        f'Source SHA-256: `{hashlib.sha256((ROOT/"task-implementation.txt").read_bytes()).hexdigest()}`. Archetype: authenticated server-backed application with SQLite, private ballots, optimistic concurrency and browser recovery.','',
        '**This is a local author review, not a 53/53 platform result.** No new platform rubric run or autonomous scored Oracle/model run was available. Docker validation reused pinned cached dependency layers; it was not a clean external dependency-download build.','',
        '| # | QC criterion | Local finding | Basis |','| --- | --- | --- | --- |']
for i,name in enumerate(names,1):review.append(f'| {i} | `{name}` | No issue identified | {notes[i]} |')
review+=['','Concrete rejected witnesses: lost remote merge content; preselected conflicting fields; accepting an unseen revision; a discard control doing nothing; an enabled reviewed-save control after Open; old-account feedback in a new session. Six r25 mutations were detected in the previous release; this release additionally detects six round defects: partial commit, status-only roster checks, order-sensitive receipts, missing original refusals, role bypass and updated-revision Retry. The previous GPT app also demonstrates lost stale working copy, unreadable acknowledgment loss, expired-session reminder loss, and a permanently busy reminder after its owning tab closes.','',
         'Required next external checks: upload this exact ZIP; obtain platform static/rubric result; run Oracle and the target GPT model on the same version. Local browser assertions do not prove autonomous completion of every verdict or a new model score.','']
(HERE/'rubric-review.md').write_text('\n'.join(review),encoding='utf-8',newline='\n')
print('Wrote 66-row Functional coverage matrix and 53-point local QC review.')
