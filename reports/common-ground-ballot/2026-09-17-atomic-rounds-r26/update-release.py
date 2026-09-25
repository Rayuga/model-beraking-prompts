from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT / 'projects/common-ground-ballot'

def write(path, value):
    path.write_text(value, encoding='utf-8', newline='\n')

p = TASK / 'tests/functional/prompt.md'
s = p.read_text(encoding='utf-8').replace('functional-v1.0.0-r25', 'functional-v1.0.0-r26')
s = s.replace('or the Phase A session-credential integrity probes.', 'round selection/roster validation, round atomicity/permission probes, or the Phase A session-credential integrity probes.')
section = '''### Opening a reviewed round

Complete these nine outcomes within Phase C, before its final restart checkpoint. Reuse existing legitimate Ruth A/B and Member contexts. Round setup uses the visible UI; all direct controls adapt the genuine observed round confirmation, never a guessed endpoint. A round is one product action, not a loop of individually committed Opens. A nonmutating preview POST is a read. Keep preview and confirmation captures separate.

Create a mixed-method pair (one Single, one Approval) and a third unselected draft. Select the pair, review its complete definitions/eligible names, cancel and save unchanged records/audit. Then review and confirm normally; capture the real whole-round shape/success and the before/after records. Both open once with equal reviewed snapshots, one Open audit each and no change to the outsider. Record Member visibility. Save that receipt for canonical-order and collision probes; close one selected ballot normally before those probes.

For draft conflict, create a second pair and review in A. B edits one selected draft normally. Confirm A's unchanged preview, save the refusal and all records/audit, then explicitly review again and confirm with fresh ID/current viewed versions. Retain this refusal for replay. On a third pair, B opens one draft while A has the review; confirm A and require that the other draft stays Draft with no round side effects. Where a serialized order exists, put the changed target last to expose partial commits. Restore neither fixture by editing storage; use another fresh UI-created pair if erroneous acceptance consumes it.

On a fourth fresh pair, use the captured shape for the round input table: repeated target, only one distinct target, unknown target, one omitted roster Member, then required ballot revision [currentRevision], true, null and omitted. The type probes use revision-1 Drafts, current roster, fresh ID and valid other inputs. Use separate bounded tables of at most six rows, retaining each packet/refusal/unchanged records immediately. Apply an otherwise valid packet as Arun, Leila and Owen; do not substitute missing buttons or stale-state failures for role refusal. These are two independent criterion owners.

Keep that fourth pair for roster races. With Owen paused, A reviews. B activates Owen. A's old confirmation must refuse everything; retain refusal R1. A reviews the now-active roster. B pauses then activates Owen again. A confirms the second old preview: even though the names match, its membership revisions are old, so everything is refused; retain R2. A explicitly reviews again and confirms with a new ID. Capture the accepted upstream result but drop delivery using the helper. This one round must appear as one pending entry identifying both ballots. Reload with no automatic resend, retaining that entry for Phase D. B closes one selected ballot and pauses Owen normally; its sibling stays Open with the original both-Member snapshot. Save current records and the original whole-round packet.

Use the first successful round to test reversed target and roster order with the original ID/revisions after the later lifecycle/roster changes. Its exact original success survives; changed selected target and changed viewed revision under that ID each yield an explicit input collision without replacing its original receipt. The first edited-draft refusal and roster R1/R2 also replay their exact original refusal after the later successful confirmations. Server replay controls remain reachable if the pending UI failed; browser recovery remains separately scorable if an original server receipt is wrong.

Reuse these saved records/receipts at Phase D. No additional process restart or separate account/cross-tab pending matrix is required for rounds. Record a missing round feature once for its affected outcomes and move on; never spend the remaining phase trying to invent absent controls. Keep at least 20 minutes of Functional's budget for Phase D and all saved verdicts; checkpoint the completed phases before this section and use bounded calls. The round cases reuse four pairs and one unselected draft; do not create independent fixtures for every receipt replay.

'''
assert '### Opening a reviewed round' not in s
s = s.replace('## Phase D: one comprehensive persistence checkpoint', section + '## Phase D: one comprehensive persistence checkpoint')
s = s.replace('- The separate recovery reminder survives', '- Round records/snapshots/audit remain. The first successful round in reversed order and the three saved round refusals still return their exact original outcomes without mutations. In the dedicated round profile, reload and then genuinely sign out/in: its single pending round stays, with no automatic resend. Explicit Retry sends the unchanged whole-round selection/versions/roster, settles that entry, and displays current Closed/Open states rather than old receipt state. Save this separate browser-recovery verdict.\n- The separate recovery reminder survives')
write(p, s)

p = TASK / 'task.toml'
s = p.read_text(encoding='utf-8').replace('review of conflicting drafts, and recovery', 'review of conflicting drafts, atomic opening of reviewed rounds, and recovery').replace('with revision-safe confirmation.', 'with revision-safe confirmation, plus all-or-nothing multi-ballot opening against a reviewed roster.')
write(p, s)
p = TASK / 'README.md'
s = p.read_text(encoding='utf-8').replace('Functional now has 57 criteria; the task has 77 criteria', 'The r25 release introduced 57 Functional criteria and 77 total criteria')
s += '''
## Reviewed rounds (r26)

Functional now has 66 criteria; the task has 86 across the same five verifiers.
Nine new outcomes cover round review/cancellation (3), atomic opening (4), draft
conflicts (4), whole-roster conflicts (4), malformed inputs (2), role enforcement
(1), original success receipts (4), original refusal receipts (4), and interrupted
round recovery (4). These add 30 to the previous Functional total of 73.5. Existing
criterion weights and all dimension weights remain unchanged. Full atomic and
receipt/recovery outcomes use the same weight 4 as existing durable staff-work
criteria; review and boundary weights reflect their narrower scope.

The golden implements one SQLite transaction and one operation receipt per round.
Review includes both active and paused membership revisions. Draft/roster changes
refuse the entire round; explicit re-review creates a new operation. Reordered
input sets keep receipt identity. The existing pending queue retains the complete
round and renders current records after Retry. The other four verifiers, runner,
Dockerfiles, supplied foundation and operational timeouts remain unchanged.
The Functional plan reuses four pairs, one outsider and the existing final
restart, with bounded probe/replay tables and an explicit persistence reserve.
No fresh autonomous Oracle/model/QC score is represented by local validation.
'''
write(p, s)

for name in ['build-runtime.py', 'run-runtime-checks.py']:
    p = HERE / name
    write(p, p.read_text(encoding='utf-8').replace('r25', 'r26'))
p = HERE / 'runtime-smoke.py'
write(p, p.read_text(encoding='utf-8').replace('all 77 criteria', 'all 86 criteria').replace("discovery['criteria_count'] == 77", "discovery['criteria_count'] == 86"))
p = HERE / 'validate-package.py'
s = p.read_text(encoding='utf-8').replace('r25 upload', 'r26 upload').replace('25 if dimension', '26 if dimension').replace("('solution/server.js','solution/solve.sh','solution/package.json')", "('solution/solve.sh','solution/package.json')").replace('golden server and installer unchanged', 'golden installer and dependency versions unchanged')
write(p, s)

# Normalize only task text files, retaining the exact closed upload layout.
for p in TASK.rglob('*'):
    if p.is_file():
        data = p.read_bytes()
        if b'\r' in data: p.write_bytes(data.replace(b'\r\n', b'\n'))
print('Updated r26 instructions, execution plan and validators.')
