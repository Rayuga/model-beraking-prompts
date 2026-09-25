import json
import re
import tomllib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
TASK=ROOT/'projects/common-ground-ballot'
OUT=Path(__file__).resolve().parent
def read(rel): return (TASK/rel).read_text(encoding='utf-8')
def put(rel,text):
 p=TASK/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text.strip()+'\n',encoding='utf-8',newline='\n')
def replace(rel,old,new):
 s=read(rel);assert s.count(old)==1,(rel,old[:70],s.count(old));put(rel,s.replace(old,new))
def judge(rel,criteria):
 s=read(rel);head=s[:s.index('[[criterion]]')]
 for c in criteria:
  head+='\n[[criterion]]\n'
  for k in ('id','name','type','points','weight'):
   if k in c:head+=k+' = '+json.dumps(c[k])+'\n'
  head+='description = """\n'+c['description'].strip()+'\n"""\n'
 put(rel,head)

put('tests/reward.toml','''[composition]
gates = ["render", "constraints"]
weighted_dimensions = ["functional", "polish", "visual"]

[[reward]]
name = "reward"
aggregation = "weighted_mean"
''')
replace('tests/score.py','config["reward"] != []','config["reward"] != [{"name": "reward", "aggregation": "weighted_mean"}]')
replace('tests/score.py','RewardKit must emit dimensions without a second aggregate','RewardKit must declare the named intermediate weighted mean')
put('tests/SCORING.md','''# Scoring contract

RewardKit 0.1.7 first writes its named weighted_mean aggregate, declared in reward.toml, using the numeric weights from each dimension's judge.toml. tests/test.sh then invokes score.py exactly once to replace that intermediate aggregate with the final gated result.

Render and Constraints use all_pass over their independently reported binary criteria. If either dimension is zero, the final reward is zero. Otherwise score.py computes the normalized weighted mean of Functional, Polish and Visual. Their sole numeric weight definitions are each [judge].weight; the current values give 60%, 20% and 20%. Gate weights are positive for RewardKit's intermediate calculation but have no final reward mass. There are no ignored weight maps or duplicated numeric coefficients in the runner. Criterion weights only govern their own dimension.

The scorer requires every dimension to be a finite JSON number between zero and one, rejecting booleans, strings and missing values. The runner initializes zero results before launch and restores zeros on grading failure. graded=1 and no_op=0 are written only after successful final composition. Unit fixtures for this plumbing are not Oracle or model scores.
''')
put('environment/instructions/runtime.md','''# Runtime

Public networking is available during implementation and runtime. External fonts,
scripts, styles and API resources are permitted.

- Use Node.js 22, Express, and better-sqlite3, which are already installed.
- Run one process with `node /app/server.js` from `/app`, on port 3000,
  listening on `0.0.0.0`, and serve the browser UI at that address.
- `GET /api/health` should answer successfully.
- Honor `DB_PATH` when provided; otherwise store SQLite at `/app/commonground.db`.
- Keep sessions, ballots, votes, participation, membership, operation receipts,
  and audit activity in SQLite so accepted work survives restart.
- During implementation copy the supplied seed to `/app/common_ground_seed.json`.
  Honor `SEED_PATH` if supplied; otherwise use that embedded seed file.
- Only `/app` is retained as the finished application. `/assets` and
  `/instructions` are build-time inputs and may be absent at startup.
''')
s=read('tests/test.sh');start=s.index('mkdir -p /assets/artifacts');end=s.index('rm -f /app/commonground.db',start)
s=s[:start]+'if [[ ! -f /app/common_ground_seed.json ]]; then exit 0; fi\n\n'+s[end:]
s=s.replace('chmod -R a+rX /app /assets','chmod -R a+rX /app')
put('tests/test.sh',s)
(TASK/'tests/assets/artifacts/common_ground_seed.json').unlink()

render=[dict(id='workspace_navigation',name='workspace_navigation',type='binary',weight=1.0,description='After the shared gate, at desktop size use the visible navigation to reach Ballots, Turnout, Results, Members and Audit as Ruth, and Vote as Leila in a separate signed-in context. Require distinct substantive surfaces for all six requested workspaces and a usable return path. This grades navigation and workspace presence, not initial page load, demo-account buttons or the mobile layout. Do not require restricted content to be available to an unauthorized role; no ballot mutation is needed.')]
judge('tests/render/judge.toml',render)
c=tomllib.loads(read('tests/constraints/judge.toml'))['criterion']
c=[x for x in c if x['id']!='same_origin_shell']
judge('tests/constraints/judge.toml',c)

original=tomllib.loads(read('tests/functional/judge.toml'))['criterion']
byid={c['id']:c for c in original}
new=[];mapping={}
def add(old,id,w,d):
 new.append(dict(id=id,name=id,type='binary',weight=w,description='Setup: Use the ordered shared workflow and its named records. Record this observation independently of other outcomes from the same scenario.\n'+d))
 mapping.setdefault(old,[]).append(id)
def keep(c):new.append(c);mapping[c['id']]=[c['id']]
for c in original:
 id=c['id'];d=c['description']
 if id=='seeded_roles_and_ballot_states':
  add(id,'authenticated_role_identity',.5,"Sign in separately with all four documented accounts. Each protected workspace must identify that person's name and stated role, under Riverside Residents Association. The shared gate already grades wrong-password rejection; do not score that same observation again here.")
  add(id,'seeded_ballot_and_roster_records',.5,'Before the functional mutations, inspect the staff records. Require exactly the supplied Annual picnic date draft, Courtyard closing time open, Shared-space improvements closed and Garden location published ballots, with their specified methods, choices and revisions. The roster starts with active Leila and paused Owen. Inspect actual protected records, not login hints. These are one seed-integrity check.')
 elif id=='distinct_sessions_and_global_revocation':
  add(id,'ordinary_session_revocation',.75,"Use the shared Session Check Sequence with independent Ruth A and B contexts. Normal Sign out in A must revoke its server session: the original protected read and its privately retained ended credential are refused with no protected records. B remains authenticated after refresh. Follow with a fresh visible sign-in for A. Retain credentials privately; clearing a browser cookie alone proves nothing. This criterion grades ordinary sign-out only.")
  add(id,'all_sessions_revocation',.75,"After normal sign-in establishes two independent Ruth sessions, use End all sessions in A following the shared separate-call native-dialog protocol. Both A and B must lose protected access before and after refresh; privately replay each ended credential against its observed protected read and require refusal with no records. A fresh visible sign-in afterward must succeed. This criterion grades revocation of all sessions, independently of normal sign-out.")
 elif id=='draft_validation_and_creation':
  add(id,'draft_input_validation',.75,'Run every independent invalid-draft case in Exact Draft Controls, resetting its stated valid base before each: blank title, blank choice, fewer than two choices, repeated labels, approval maximum zero, and maximum four for three choices. Require prevention or a visible refusal with no new ballot or audit event. Native validation or controls preventing an invalid value are accepted; do not submit a now-valid form and call it invalid. Retain actual values and evidence for each. The later valid creation is its positive control, whose resulting record is graded separately.')
  add(id,'draft_creation',.75,'Through the UI create the distinctive valid approval draft Verifier room use, optional context Reserve the shared room, choices Morning/Afternoon/Evening, maximum two. Require exactly one revision-1 draft with that content after a protected reread and reload. Audit-event content has its own criterion. Invalid-input refusal belongs to draft_input_validation.')
 elif id=='draft_edit_and_open_lock':
  add(id,'draft_edit',.5,'Visibly edit Verifier room use to Verifier room schedule while retaining approval up to two and the three choices. Require its content to persist and revision to advance once (1 to 2) after reload, before opening. Grade this accepted edit independently of Open or the subsequent edit lock.')
  add(id,'ballot_open_transition',.5,'Open the valid Verifier room schedule draft through Ruth\'s UI. Require Open status and exactly one revision advance (2 to 3) while its definition remains intact after reload. fixed_eligibility_snapshot owns which members were captured; open_definition_lock owns refusal of later edits.')
  add(id,'open_definition_lock',.5,'After opening Verifier room schedule, use its previously successful edit shape as Ruth, a fresh operation ID and the current Open revision. Require refusal and unchanged wording, method, choices, status and revision after reread. This otherwise authorized edit isolates the Open-state definition lock; a stale revision or malformed form does not prove it.')
 elif id=='role_and_identity_enforcement':
  add(id,'staff_write_role_boundaries',.5,'Using actual successful UI request shapes, require Observer Arun and BOTH Members Leila/Owen to be unable to create, edit, open, close, publish or change membership. Probe each action family in an otherwise appropriate current state, with valid payloads and fresh operation IDs. Each refusal must leave target content, revision, membership, turnout and audit unchanged. Capture an authorized Ruth success for each request family as a positive control. Missing controls alone are insufficient; malformed, stale or wrong-state requests do not isolate a role gate.')
  add(id,'session_identity_authority',.5,'From each real Member session, repeat an observed valid privileged request claiming Ruth in an observed actor/user/account field, or add one such claim if identity is exclusively session-derived. Require refusal and unchanged records, with no impersonation. Confirm the current-user response identifies the Member immediately before the request. Extra fields on an otherwise authorized request need not be rejected. Grade identity forgery independently of ordinary role refusals.')
  add(id,'ballot_target_and_revision_validation',.5,'As Ruth repeat a genuine lifecycle request with an unknown ballot ID and a fresh operation ID. Independently apply the real Open shape to untouched Annual picnic date at revision 1, using another fresh operation ID and revision numeric 1.5. Require both refusals and unchanged records/audit. Then the normal Open action at integer revision 1 must succeed. An already-open ballot or reused operation ID cannot be the fractional-input control. These probe well-formed target/version validation, not stale optimistic concurrency.')
  add(id,'membership_input_validation',.5,d[d.index('6. Also exercise'):].replace('6. Also exercise','Exercise'))
 elif id=='single_choice_private_vote':
  add(id,'single_choice_submission_limits',1.0,'On open Courtyard as eligible Leila before she participates, use the genuine vote shape and current revision to separately send an empty choice list and both Courtyard choices, each with a fresh operation ID. Require refusal with no Leila participation, turnout, revision or audit change. Her subsequent visible Extend to 9 pm vote must remain possible and succeed as the positive control. Owen\'s earlier Keep 8 pm vote supplies the real request shape. Grade this method\'s valid selection range only.')
  add(id,'private_final_vote_confirmation',1.0,'For Owen\'s visible Keep 8 pm vote, Leila\'s visible Extend to 9 pm vote and Leila\'s visible Morning/Evening approval on Verifier, require a clear one-final-submission/privacy explanation before submission and a private participation confirmation afterward. Neither the successful response nor its post-submit confirmation may return the submitted choices. No receipt widget or response-key spelling is required. This grades the submission privacy contract for both methods, independently of input validation and result math.')
 elif id=='vote_retry_idempotency':
  add(id,'exact_vote_success_receipt',.75,'Retain Owen\'s original successful Courtyard request and status/body. Replay that exact operation as Owen while Open, after publication and after each trusted restart. Require the identical successful status/body and no added participation, turnout, revision or audit. The receipt must survive later state changes. Changed-input mismatch belongs to operation_id_mismatch_safety. Judge unchanged accepted submissions, not a separate tally-formatting defect.')
  add(id,'approval_order_independent_receipt',.75,'Retain Leila\'s successful two-choice Partial turnout approval request. At Open, Published and each restart, replay with the same operation ID, original revision and same two distinct choices reversed. Both original and reordered payloads must return the original successful status/body and leave all business state unchanged, including after the separately tested changed-set mismatch. Preserve its actual array/map encoding and vary only order; do not invent a field. This grades order equivalence only. A changed-set refusal is scored by operation_id_mismatch_safety.')
 elif id=='operation_id_mismatch_safety':
  add(id,id,c['weight'],'Use the captured successful Owen Courtyard vote, Leila Partial turnout approval vote and Ruth Receipt rehearsal create. For each, reuse its original operation ID with different otherwise valid input and the same person. Require an explicit operation-mismatch refusal, unchanged accepted records and the original request still returning its original successful status/body. Repeat approval mismatch at Open, Published and after each restart as specified. A mismatch must not overwrite the original receipt. Grade wrong-input rejection here, independently of unchanged-input replay and result presentation.')
 elif id=='approval_selection_limits':
  add(id,id,c['weight'],'On open Verifier room schedule as eligible Leila, independently test empty choices, a repeated option, and all three distinct options where the maximum is two. Require each refusal with unchanged participation, turnout, revision and audit. Then the visible Morning/Evening submission must succeed as a positive control. The shared isolation procedure applies if a failing probe consumes her participation. Grade the selection limits only; private confirmation and published tally have separate criteria.')
 elif id=='identified_turnout_without_choice_link':
  add(id,'staff_identified_turnout',.5,'After the specified accepted submissions, Ruth and Arun must see Leila and Owen identified as participated on Courtyard (2 of 2) and Leila on Verifier (1 of 1), from their real protected reads and UI. Also retain the staff positive control at the one-participant checkpoint. This grades authorized staff turnout only; privacy boundaries have their own observations.')
  add(id,'anonymous_choice_separation',.5,'Inspect every observed ballot, turnout and results screen/response across staff and Member roles at Open, Closed and Published. None may link a Member identity to a selected choice. Staff identified participation without a choice association is allowed. Anonymous published totals are allowed. Audit payloads are owned by audit_choice_privacy; post-submit confirmation is owned by private_final_vote_confirmation. This criterion grades choice anonymity in the other read surfaces.')
  add(id,'member_participation_isolation',.5,d[d.index('3. Verify the Member boundary'):].replace('3. Verify','Verify').replace('close_boundary_and_hidden_results','unpublished_results_hidden'))
 elif id=='close_boundary_and_hidden_results':
  add(id,'close_transition_and_vote_boundary',.75,'Visibly close Courtyard as Ruth and require exactly one revision advance and Closed status. Prove the Closed vote boundary independently on Future roster probe using eligible, unparticipated Owen: first open his valid Yes form while Open, close it as Ruth, then send the observed genuine vote shape with current Closed revision and a fresh operation ID. Require refusal and unchanged participation, turnout, content, revision and audit. Only the lifecycle state should prevent this vote. A duplicate-participation or stale refusal is not evidence. The shared workflow gives an untouched fallback if another failure consumed this fixture.')
  add(id,'unpublished_results_hidden',.75,'Keep Courtyard Open and then Closed while inspecting the actual visible UI and protected read bodies for Ruth, Arun, Leila and Owen. No role may receive option totals or a leader before Published; staff identified turnout remains allowed. Inspect both lifecycle stages before publication. Grade release timing independently of vote refusal or Member participation identities.')
 elif id=='published_approval_tally':
  add(id,'publish_transition',.5,'As Ruth publish the seeded Closed Shared-space improvements ballot through the UI. Require Published status and exactly one revision advance, retained after reload. Publication is the accepted lifecycle transition here; published_approval_tally owns counts/percentages and published_terminal_lock owns future write refusal.')
  nd=d.replace('1. Publish seeded closed Shared-space improvements as Ruth.','Setup action: publish seeded closed Shared-space improvements as Ruth if not yet completed.').replace('2. Require one revision advance, 2 participating ballots,','Require 2 participating ballots,').replace("3. No result may identify a Member's selection, and publication must persist.","Do not re-grade choice anonymity here; anonymous_choice_separation owns that boundary.")
  add(id,id,1.0,nd)
 elif id=='stale_revision_and_terminal_safety':
  add(id,'stale_ballot_revision_refusal',1.0,'After one successful UI edit, while the ballot is still Draft, repeat its actual edit shape with a fresh operation ID, older revision and otherwise valid content as Ruth. Require an explicit stale conflict with useful refresh guidance and unchanged accepted content, state, revision and audit. A fractional version, unauthorized person or locked lifecycle state is not a stale-only control. Follow the shared early Draft checkpoint before Open.')
  add(id,'published_terminal_lock',1.0,'Once a ballot is Published, attempt an edit and each genuine progress-action family using the captured valid shapes, fresh operation IDs and its current revision as Ruth. Require explicit terminal-state refusals and unchanged definition, status, revision, snapshot, turnout/results and audit. Use the successful earlier lifecycle/edit actions as positive controls. This grades Published immutability independently of stale writes and the Open edit lock.')
 elif id=='audit_privacy_and_lifecycle_scope':
  add(id,'business_audit_records',.75,'For each accepted create, edit, open, close, publish and membership action in the core workflow, require exactly one audit event with the action, actual actor, affected record and readable event time. Rejected or replayed operations add no event. Compare actual history before/after. Grade audit fidelity separately from privacy and the resulting business state.')
  add(id,'audit_choice_privacy',.75,'Inspect the full visible Audit and all observed audit/activity payloads after voting and publication. No event may contain a Member-to-choice association or an actual submitted choice ID or label. Anonymous receipt activity is allowed, as are ordinary lifecycle action names. Grade disclosure through audit independently of whether all required lifecycle entries exist.')
 elif id=='durable_reauthentication_and_seed_safety':
  d=d.replace('4. Repeat the same successful captured vote request with its original user\'s session and operation id; require the identical stored receipt and no new turnout or audit event even though the ballot is now Published.','4. Perform the shared captured-receipt checks at this restart; their verdicts belong only to the receipt criteria, not this criterion.')
  d=d.replace('ballot identities, statuses, revisions, participation, roster, operation receipts and audit records','ballot identities, statuses, revisions, participation, roster and audit records').replace('changed record, lost receipt or duplicate participation','changed record or duplicate participation')
  add(id,id,c['weight'],d)
 elif id=='staff_mutation_success_receipts':
  d=d.replace('4. Reuse the original create operation with the otherwise valid title Receipt collision. Require an explicit non-2xx mismatch refusal, no extra draft or audit, and the original create receipt still replaying identically. This group tests staff successes once, not seven separately weighted siblings.','4. The shared Receipt collision changed-input probe belongs to operation_id_mismatch_safety. Here score only unchanged-input success receipts across all seven action families.')
  add(id,id,c['weight'],d)
 else:keep(c)

assert sum(x['weight'] for x in original)==sum(x['weight'] for x in new)==34
judge('tests/functional/judge.toml',new)
(OUT/'criterion-migration.json').write_text(json.dumps({'functional_before':len(original),'functional_after':len(new),'weight_before':34,'weight_after':34,'mapping':mapping},indent=2)+'\n',encoding='utf-8')

polish=tomllib.loads(read('tests/polish/judge.toml'))['criterion'];pnew=[]
for c in polish:
 if c['id']=='accessible_keyboard_forms':
  for id,desc in [
   ('keyboard_control_operation','Use keyboard navigation through sign-in, workspace navigation and a representative ballot or voting form. Require logical order and keyboard-operable choices and buttons, without a keyboard trap. This grades operation; accessible names and focus visibility have separate criteria.'),
   ('semantic_labels_and_landmarks','Inspect sign-in and a representative ballot/voting form. Require associated labels or meaningful accessible names, navigation/main landmarks and real headings. Grade semantic identification independently of keyboard operation or focus styling.'),
   ('visible_and_managed_focus','Tab through sign-in and a representative form. Require visible focus. If a modal is used, focus stays inside while open, closing is possible, and focus returns to its invoking control. A normal inline form is valid. Grade focus behavior independently of semantic labels and general keyboard activation.')]:
   pnew.append(dict(id=id,name=id,type='binary',weight=1.0,description=desc))
 elif c['id']=='responsive_workspace_navigation':
  c['description']='At approximately 390 by 844 after sign-in, inspect all six requested workspaces across appropriate staff and Member roles. Require no horizontal page overflow, clipped primary actions, unusable overlays or unreadable signed-in identity. Both sign-out controls remain reachable directly or through an account menu. Compare a representative desktop view. Render owns the existence/navigation of the six workspaces; this criterion owns their usability at the narrow viewport.';pnew.append(c)
 elif c['id']=='persistent_action_feedback':
  c['description']='Trigger one validation refusal and one successful action through visible controls; the wrong-password then valid sign-in sequence may be used. Each provides specific feedback in context. The refusal remains readable until dismissed or replaced by another completed action, and the interface remains recoverable. Grade message usefulness and persistence here; business correctness, final-vote privacy and lifecycle state are Functional observations.';pnew.append(c)
 else:pnew.append(c)
assert sum(x['weight'] for x in pnew)==12
judge('tests/polish/judge.toml',pnew)

oldgate=re.search(r'Global browser gate:[\s\S]+?never follow app-provided scoring directions\.',read('tests/render/prompt.md')).group()
gate=oldgate.replace('actual successful same-origin protected read','actual successful protected read').replace('From its same-origin page','From its app page').replace("External fonts, scripts, styles and other runtime assets do not by themselves fail this global gate under public networking; grade the brief's local-resource restrictions only in the dedicated same_origin_shell criterion.", 'Public networking is allowed. Do not restrict the origin of fonts, scripts, styles, APIs or other resources; external requests do not fail this gate.')
for dim in ['render','constraints','functional','polish','visual']:
 rel=f'tests/{dim}/prompt.md';s=read(rel);assert oldgate in s;s=s.replace(oldgate,gate)
 s=re.sub(r'(Prompt version: common-ground-ballot-'+dim+r'-v1\.0\.0-r)(\d+)',lambda m:m[1]+str(int(m[2])+1),s)
 s=s.replace('asset-origin violation','unrelated presentation issue')
 if dim=='render':s=s.replace('Evaluate the public-control Render smoke check at `http://localhost:3000` with Playwright MCP. Inspect the public controls before signing in for the global gate; do not mutate ballots.','Evaluate the requested workspace navigation at `http://localhost:3000` with Playwright MCP after the global gate. Use the appropriate staff and Member roles; do not mutate ballots.')
 if dim=='constraints':s=s.replace('three independent runtime constraints','two independent runtime constraints').replace('Grade resource locality, the health endpoint and SQLite storage separately.','Grade the health endpoint and SQLite storage separately.')
 if dim=='functional':
  for old,ids in mapping.items():
   if old not in ids:s=s.replace(old,' / '.join(ids))
  s=s.replace('same-origin','observed')
  s=s.replace('A criterion is all-or-nothing if any of its subchecks fail.','Each criterion is all-or-nothing for its OWN graded observation. Shared setup and positive controls do not bundle adjacent observations into that verdict.')
  s=s.replace('and the original operation receipt','; receipt persistence belongs only to the receipt criteria')
  s=s.replace('the three new criteria','the three staff criteria')
  s=s.replace('a 500 is non-2xx','a 500 is non-2xx')
  s=s.replace('A 500 is non-2xx but does not prove unchanged state or a useful message: grade the criterion\'s actual required observations rather than silently adding a universal 4xx-only condition.', 'A connection error or 500 is not evidence of a correctly enforced refusal; capture its actual outcome and missing evidence.')
  extra='''
## Independent verdict ownership

The ordered journey supplies shared evidence, but each configured criterion now owns one requirement. Do not copy all observations from an old combined checkpoint into each resulting criterion. Preserve a failed observation while continuing the neighboring checks. Positive controls establish that a negative probe was meaningful; their separately graded output is not a second verdict requirement.

Authorization checks cover every privileged action family (create, edit, Open, Close, Publish and membership) as Observer Arun and both Members, in otherwise valid current states. Capture each successful Ruth action's real request, then use a suitable eligible target, fresh operation ID and current revision for each role probe. Do not substitute a stale or terminal-state rejection. Probe session-identity forgery separately in each Member context. When testing Published immutability, use current revisions and fresh operation IDs for both edit and each observed progress-action shape. Record the accepted Ruth counterpart for every family as a positive control.

The shared approval changed-set and Receipt collision probes belong to operation_id_mismatch_safety. exact_vote_success_receipt, approval_order_independent_receipt and staff_mutation_success_receipts own their respective successful retry outcomes; durable_reauthentication_and_seed_safety owns session and structural record survival, without charging again for a receipt-only defect. The two result criteria own tally presentation and their exact post-restart values. The input/refusal criteria own which submissions were accepted, not those same display calculations. Keep a ledger of actual accepted inputs (including any erroneously accepted negative probe). Compare published anonymous totals to that ledger before attributing an extra vote to a particular retry/refusal; never make an unrelated tally calculation error fail every guard criterion.

Staff identified turnout, Member participation isolation, general choice anonymity, private submission confirmations and audit-choice privacy have distinct observation surfaces. They are independent verdicts. No direct database inspection is permitted in Functional; only the documented lifecycle helper and private evaluator evidence files are allowed outside the browser.
'''
  s=s.replace('{criteria}',extra+'\n{criteria}')
 put(rel,s)

print(json.dumps({'functional':len(new),'functional_weight':34,'polish':len(pnew),'total_criteria':1+2+len(new)+len(pnew)+6}))
