from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[3]
TASK=ROOT/'projects/pellmoor-job-pipeline'
criteria=[
('batch_review_is_readonly_and_exact',1.5,'''Setup: after the preceding single-applicant journey, use ROLE-014 (two openings).
As Ruth, release its existing reservations/filled places through legal visible
withdrawal controls. Do not alter other vacancies or erase their saved receipts.
As Cal create four uniquely named applicants, labeled A, B, C and D in your
evidence. Advance each to interview as Ruth and assign Otis and Wren as Cal.
Record both current scores for A, C and D; leave B missing Wren's score.
Retain the four server-issued IDs. Reach this setup through normal UI.
1. Open batch planning as Ruth. Select A then B. Preview must identify both
names/IDs/current assessment versions, B's missing score and a blocked result.
Show selected=2, available=2, projected reserved=2, filled=0, available=0.
Confirmation must be disabled or unavailable for this blocked selection.
2. Change the selection to ordered A,C and review. Both assessments are complete,
the batch is ready, and the same exact capacity projection is displayed.
3. Compare complete product snapshots before selection, after both previews and
after closing. No candidate, score, assessment, history, note, activity, revision
or capacity may change. Record the observed preview and commit request contract;
preview may be client-side from authenticated current data rather than a route.'''),
('batch_commit_is_atomic_and_audit_linked',3.0,'''Setup: A and C are fully assessed interview applicants; ROLE-014 has two openings
available. Open and review A,C through the UI. Capture every vacancy and full
candidate detail snapshot before committing.
1. Confirm once. Exactly A and C become offered, each gains one offer history
visit, and the vacancy revision advances once total. Reserved=2, filled=0,
available=0; the derived funnel and visible board agree after reload.
2. Each selected applicant gains exactly one event attributed to Ruth, containing
interview-to-offer, its unchanged assessment version, the same stable batch ID,
and ordered positions 1/2 and 2/2. There is no extra aggregate product event.
Panels, scores, assessment versions, notes, unselected applicants and all other
vacancies remain unchanged. Preserve the exact success request/status/body.
3. To prepare independent later checks, reopen A and C to interview through
Ruth's UI and obtain Otis and Wren's fresh scores for each. This releases both
openings. Do not reset history or reuse historical scores.'''),
('batch_invalid_member_and_capacity_reject_every_write',3.0,'''Setup: A,C,D have complete current assessments at interview, B is at interview
but lacks Wren's current score, and ROLE-014 has two free openings.
Use the real batch contract with fresh identities and current revision each time.
1. Submit ordered A,B and B,A independently. Both must return 4xx with no 5xx;
an eligible member must not be offered before an ineligible member is discovered.
2. Submit A,C,D: all individually eligible but three exceed the two openings.
Require rejection of the whole selection, not two offers and one failure.
3. After every probe require exact deep equality of all product snapshots,
including assessment history, scores, capacity, funnel, revisions and activity.
Record before/after evidence immediately. Finish B's missing score through Wren's
visible control for later checks; this is a new accepted action, not a repair.'''),
('batch_authorization_and_selection_contract',2.0,'''Setup: use two fully assessed interview applicants with enough capacity, such as
A,C. Capture Ruth's genuine request contract, using valid new metadata per probe.
1. Submit that batch as Cal and as Otis using their own authenticated sessions.
Require refusal, no Ruth receipt leaked, and exact unchanged product state.
2. As Ruth separately probe empty selection, repeated A,A, unknown ID alongside
A, a candidate from ROLE-015 alongside A, and malformed selection values (string,
object, and array containing a Boolean). None may partially commit or return 5xx.
3. Add forged capacity, assessment-version and actor fields to an otherwise valid
batch. Each must be refused, not silently ignored during an accepted batch.
Check every vacancy, selected/unselected candidates, revisions and complete audit
after each probe. Do not mistake ordinary target IDs for forbidden ownership claims.'''),
('batch_stale_confirmation_requires_review',2.0,'''Setup: A,C are eligible and two openings are free. In Ruth's first browser session,
review A,C and record the reviewed revision. In a separate authenticated session
add an ordinary note to B using the UI, advancing the vacancy once.
1. Confirm the original review in the first session. Its request must retain the
reviewed revision, receive stale 409, and make no batch changes. Record exactly
one commit request; waiting must not reveal an automatic retry with a newer revision.
2. Keep the selection visible and explain the conflict. Explicitly review again,
observe current data, then confirm with a fresh operation identity. Only this
new confirmation may offer A,C; verify one revision and the complete batch result.
3. Reopen A,C through the UI and obtain fresh Otis/Wren scores to restore two
eligible interview applicants and free openings for the race checks.'''),
('batch_and_individual_races_commit_one_whole_operation',3.0,'''Setup: A,C,D are eligible interview applicants and ROLE-014 has two free openings.
Capture valid batch and individual-offer requests from the app's actual controls.
1. Submit batch A,C and individual offer D simultaneously from one revision with
distinct identities. Exactly one operation succeeds and the other returns stale
409. Accept either winner. If batch wins only A,C are offered, reserved=2; if
individual wins only D is offered, reserved=1. Revision advances exactly once.
No partial batch, extra event or mutation to the losing applicants is allowed.
2. Legally reopen whichever applicants were offered and re-score in their new
versions through the UI. Then submit overlapping batches A,C and C,D simultaneously
from one current revision and distinct identities. Exactly one whole batch wins,
one returns stale 409, reserved=2, and the revision advances once. The shared
applicant C has only one new offer visit/event; the losing-only applicant is unchanged.
3. Preserve compact full before/after snapshots for both races. Reopen and freshly
score the successful batch's applicants for later checks. Never choose a fixed
winner in advance or turn the race into sequential refreshed submissions.'''),
('batch_lost_response_recovers_original_operation_and_live_view',2.0,'''Setup: C,D are fully assessed interview applicants and two openings are free.
Use Ruth's UI to review C,D. The judge may intercept the real confirmation response,
allow the original request to reach the server, and then withhold/abort delivery
without changing the request, body or status. Capture the actual server result.
1. While pending, repeated activation must send no second confirmation. After
delivery failure the UI explains uncertainty and offers an explicit retry.
Selection, reviewed revision and operation identity remain the same; changing
the unresolved payload is not allowed. Do not require a specific transport library.
2. In a second genuine Ruth session, observe the committed offers and withdraw C
through the UI, releasing one opening. Preserve that current checkpoint.
3. Retry through the first UI. Require the exact original ordered selection,
revision and identity, the saved successful status/JSON, and zero product writes.
The UI must fetch/display current data: C remains withdrawn, D offered, reserved=1,
available=1. It must not replace current data with the historical receipt snapshot.
Retain this success receipt for the final restart check. Report a failed intercept
setup separately; never infer retry behavior from a request that did not reach the server.'''),
('batch_receipts_remain_historical_after_capacity_release',3.0,'''Setup: C is withdrawn, D offered, A,B have complete current interview assessments,
and exactly one ROLE-014 opening is available. If a prior check failed, establish
these premises by lawful UI actions and record them before the graded probes.
1. Submit A,B with fresh valid metadata. Preserve its full-capacity 4xx receipt
and exact unchanged product checkpoint. Withdraw D through Ruth's UI so two
openings are free, then preview A,B to prove it is now eligible.
2. Replay that exact earlier rejection before any new offer. Require identical
status/JSON and no product changes despite sufficient room. A new identity with
current revision may then commit A,B successfully as one batch. Preserve both receipts.
3. Replay the original A,C success from batch_commit_is_atomic_and_audit_linked:
C must remain withdrawn and A's later history/audit must remain untouched. Reorder
only JSON object keys and require the same saved result. Reverse the candidate-ID
array with the same identity and require operation-mismatch 409, unchanged state.
4. Revoke Ruth's session and prove that token cannot replay the success. Sign in
again as Ruth and require its original result. As Cal, reusing that identity for
the same batch must fail authorization, not expose Ruth's result. Preserve all
original requests/statuses/bodies and their actors for the shared restart check.''')]

p=TASK/'tests/functional/judge.toml'
s=p.read_text(encoding='utf-8')
block='\n'.join(f'[[criterion]]\nid = "{name}"\nname = "{name}"\ntype = "binary"\nweight = {weight}\ndescription = """\n{description}\n"""\n' for name,weight,description in criteria)+'\n'
marker='[[criterion]]\nid = "durable_cross_role_audit_after_reload"'
assert marker in s and criteria[0][0] not in s
s=s.replace(marker,block+marker)
s=s.replace('routes covering login, logout, vacancy and','routes covering batch planning/preview and commit, login, logout, vacancy and')
s=s.replace('rejection and Wren note receipts from the earlier hardening workflows.', 'rejection and Wren note receipts from the earlier hardening workflows, plus\nthe saved batch successes and full-capacity batch rejection. Include the batch\nwhose response was lost and whose applicant was later withdrawn.')
s=s.replace('replay the three original requests.', 'replay all these original requests, including both batch successes and the\nbatch rejection. Array order, batch links and historical response bodies must\nbe preserved. Verify all current product state after each individual replay.')
p.write_text(s,encoding='utf-8',newline='\n')

for dim in ['render','constraints','functional','polish','visual']:
 p=TASK/f'tests/{dim}/prompt.md';s=p.read_text(encoding='utf-8')
 s=re.sub(r'(Prompt version: .*?-r)(\d+)',lambda m:m[1]+str(int(m[2])+1),s)
 if dim=='functional':
  s=s.replace('{criteria}', '''The batch criteria run before durable_cross_role_audit_after_reload. Keep a
compact evidence ledger: applicant labels to real IDs, ordered selections,
reviewed revisions, request identities, actor, status and full response bodies.
Take exact snapshots before each mutation under test, not after later cleanup.
The only restart remains the existing durable audit; it also covers batch receipts.
Later batch setups may use legitimate UI transitions and fresh scores; never
reset SQLite, invent IDs or assume a race winner. A failure is local to its
criterion: independently establish the next criterion's stated premises using
supported UI where possible and distinguish unavailable setup from observed defects.
Do not weaken a criterion because setup is longer than a single request.

{criteria}''')
 elif dim in ['visual','polish']:
  s=s.replace('scrolling and viewport changes are safe.', 'scrolling, read-only batch selection/preview/cancellation and viewport changes are safe.')
  s=s.replace('{criteria}', '''Also open Ruth's batch planning surface. Inspect unselected selection and
a selected review, including a blocked review if current records are ineligible.
Selection/preview are read-only. Use existing candidates; never create candidates
or commit an offer for this dimension. If no batch can currently succeed, the
review's truthful eligibility explanation is valid setup. Inspect at desktop
and phone width in both themes. Do not grade batch correctness here or require
the golden layout; judge only this dimension's stated observations.

{criteria}''')
 else:
  s=s.replace('{criteria}', '''The product also includes batch offer planning. Do not make completing an
offer batch a Render or Constraints prerequisite; detailed batch correctness
belongs to Functional. Preserve current records for the remaining dimensions.

{criteria}''')
 p.write_text(s,encoding='utf-8',newline='\n')

p=TASK/'tests/polish/judge.toml';s=p.read_text(encoding='utf-8')
s=s.replace('and the open candidate drawer','the open candidate drawer, and batch selection/review')
s=s.replace('mutation, theme, close, and sign-out control.', 'mutation, batch selection/review/confirmation, theme, close, and sign-out control.')
s=s.replace('after opening and closing the candidate drawer.', 'after opening and closing the candidate drawer. Also keyboard-select an\napplicant in batch planning, open the read-only review and dismiss it. Require\nfocus to remain usable within the modal and return to its initiating control.')
s=s.replace('currently permitted mutation controls to have practical touch targets', 'currently permitted mutation and batch selection/review controls to have practical touch targets')
p.write_text(s,encoding='utf-8',newline='\n')
p=TASK/'tests/visual/judge.toml';s=p.read_text(encoding='utf-8')
s=s.replace('Assess rendered sign-in, vacancies and candidate details typography at desktop size.', 'Assess rendered sign-in, vacancies, candidate details and batch selection/review\ntypography at desktop size.')
s=s.replace('across vacancies and candidate details.', 'across vacancies, candidate details and batch selection/review.')
s=s.replace('description = """\nAssess', 'description = """\nAssess')
s += '\n'
p.write_text(s,encoding='utf-8',newline='\n')
print('Added eight batch Functional criteria; extended shared restart, Polish and Visual coverage; revised all five prompts')
