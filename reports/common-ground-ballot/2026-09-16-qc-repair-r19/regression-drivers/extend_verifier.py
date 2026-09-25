from pathlib import Path
import tomllib

ROOT=Path(__file__).resolve().parents[3]
TASK=ROOT/'projects/common-ground-ballot'
path=TASK/'tests/functional/judge.toml'
source=path.read_text(encoding='utf-8')
assert 'id = "durable_pending_staff_work"' not in source


def add_to_description(text,cid,extra):
    start=text.index('id = "'+cid+'"')
    opening=text.index('description = """',start)+len('description = """')
    end=text.index('\n"""',opening)
    return text[:end]+'\n'+extra+text[end:]


source=add_to_description(source,'draft_input_validation',
    'Also adapt the observed valid approval-draft request with its maximum replaced separately by a list containing its valid maximum, an object, true, null and an omitted field, leaving valid title/choices/method unchanged and using fresh operation IDs. Refuse each malformed required limit. Use an otherwise valid maximum-1 single-choice-sized approval control for true so its numeric coercion would otherwise be in range. Capture the actual field; ordinary form text encoding is allowed. A failed probe must not contaminate the next case or be counted again under version validation.')
source=add_to_description(source,'membership_input_validation',
    'Independently test the required membership revision as a list containing its actual current revision, an object, null and omitted value, with otherwise valid active/paused input and fresh IDs. Require unchanged roster/audit; use a normal current-revision action as the positive control. A boolean probe only isolates type validation when its coerced value would match the current version; otherwise use the fresh revision-1 Draft boolean case owned by ballot_target_and_revision_validation. Do not mistake stale or wrong-state refusal for validation of the malformed field.')
source=add_to_description(source,'operation_id_mismatch_safety',
    'This criterion varies inputs within the same action family. Cross-action namespace collisions belong only to user_wide_operation_namespace.')
source=add_to_description(source,'roster_conflict_snapshot_chain',
    'Record an explicit three-row checkpoint ledger: before restart, after restart 1, after restart 2. At EACH row retain both ballots and the Owen/Leila visibility reads, then mark that row complete before the next restart. A helper omission is missing evidence, not proof that the roster changed; perform any still-reachable missing observation immediately.')

criteria=[
('user_wide_operation_namespace',2.0,
 'Use the namespace section of recovery.md. Retain Ruth\'s successful create exchange on a dedicated control. Using otherwise valid observed edit and membership shapes, their current target revisions and Ruth\'s same original create operation ID, require explicit collision refusals with unchanged target state and audit; the original create still replays its original outcome. Ordinary fresh-ID edit and membership writes are positive controls. Separately, two eligible Members must be able to submit their own legitimate ballots using the same identifier in their independent actor namespaces. Grade the namespace across actions/people here; same-action payload mismatch and ordinary receipt persistence have existing owners. Never use a stale revision or unauthorized role as the collision witness.'),
('durable_pending_staff_work',4.0,
 'Follow the browser recovery sequence in /tests/functional/recovery.md. For each of the six staff action families (create, edit, Open, Close, Publish, membership), deliberately lose a genuine UI action\'s response after retaining the upstream exchange. Require an identifiable pending action and explicit uncertainty, available after reload in the same browser profile. Retain one through the trusted process restart and fresh sign-in. There must be no automatic resubmission on reload or sign-in. Browser retention and uncertainty are graded here; request equality, per-account isolation, multiple entries and cross-tab completion have their own criteria. A write acknowledged successfully before a later GET refresh failure must not become a pending mutation.'),
('immutable_pending_retry',4.0,
 'Use the same pending attempts and captured exchanges. Click their visible Retry controls and inspect the actual outgoing requests: preserve original method, target, business inputs, operation ID and viewed revision without silently refreshing or regenerating them. Exercise both an upstream-accepted action whose response was lost before a later target change, and a stale/domain refusal whose response was lost before its preconditions changed. A usable success or business refusal resolves the reminder and supplies useful outcome feedback; an unreadable response, server failure or missing acknowledgment remains uncertain. Refresh current records instead of applying the old receipt as current state. Grade browser retry identity and outcome handling here; existing server receipt criteria own original status/body calculation. A correct outgoing request must not be marked wrong merely because a separately graded server receipt is defective.'),
('independent_pending_actions',4.0,
 'In Ruth\'s one browser profile, retain two distinct uncertain staff actions on separate records. Both must be individually recognizable after reload, while independent work remains usable. Retry one and dismiss the other in an independently exercised order: acting on one must not overwrite/remove the other, resend the entire queue or block all other staff work. Capture the exact outgoing requests and per-entry visible states. Grade separation of entries here; dismissal meaning and cross-tab propagation belong to cross_tab_pending_resolution. One fixed global retry slot is insufficient.'),
('pending_actor_isolation',4.0,
 'With Ruth\'s unresolved work in one browser profile, visibly sign out and sign in in turn as Arun, Leila and Owen in that same profile. They must neither see Ruth\'s pending details nor send her original requests. Observe UI and outgoing mutations, not browser-storage internals. Returning through Ruth\'s real sign-in restores her own unresolved work without automatic replay. Also revoke her session from an independent Ruth context before a recovery attempt: refused authentication must retain the original pending work for her later sign-in; it must not be discarded or retried as another person. Other users\' normal authorized reads remain the positive control. Grade actor ownership of recovery only; ordinary/global session revocation has separate criteria.'),
('cross_tab_pending_resolution',4.0,
 'Open two ordinary tabs in Ruth\'s SAME browser context/profile. Make both observe the same unresolved entries. Resolving an entry in one tab must be reflected by the other on its next interaction or reload; a stale Retry must not send a newly reconstructed attempt or recreate a removed entry. For a separate upstream-accepted pending action, use visible Dismiss: it sends no business mutation, removes only that reminder in both tabs, and clearly says dismissal does not undo accepted work. Hold and then release one late network outcome while another tab observes the operation; it must not resurrect a removed reminder or overwrite a different pending entry. A temporary busy/disabled control while another tab handles the same operation is valid. Grade cross-tab coordination and dismissal semantics here; underlying server receipt identity is not graded a second time.')]
for cid,weight,description in criteria:
    source+='\n[[criterion]]\nid = "'+cid+'"\nname = "'+cid+'"\ntype = "binary"\nweight = '+str(weight)+'\ndescription = """\n'+description+'\n"""\n'
data=tomllib.loads(source)
assert len(data['criterion'])==49
assert sum(c['weight'] for c in data['criterion'])==58
path.write_text(source,encoding='utf-8',newline='\n')

path=TASK/'tests/functional/prompt.md';source=path.read_text(encoding='utf-8')
source=source.replace('common-ground-ballot-functional-v1.0.0-r16','common-ground-ballot-functional-v1.0.0-r17',1)
source=source.replace('## Exact Draft Controls','## Required evidence checkpoints\n\nRead /tests/functional/recovery.md before starting. Execute its dedicated controls after the main staff receipt/roster/refusal sequences and before the final restart checks. Retain pending control evidence through the same trusted restarts without changing the previously tested ballots. The addendum defines narrowly scoped transport interruption permission; no other app/file/storage mutation is allowed. Keep a ledger for every criterion and each required restart phase. Record completion immediately. If a needed state is absent, use the expressly allowed isolated UI fixture; do not claim fixture creation is forbidden when this prompt permits it. Do not turn an unperformed observation into a factual app defect.\n\n## Exact Draft Controls',1)
source=source.replace('| Empty choice | Clear the middle choice, retaining its choice control. | No draft or audit event. |','| Empty choice | Clear a real submitted choice. Blank multiline separators that the editor discards are valid normalization; use the observed request shape for an actual blank item if needed. | No invalid draft or audit event; a valid normalized request is allowed. |',1)
source=source.replace('2. Restart once more, then refresh, sign out and sign in again.','2. Restart once more, then refresh, sign out and sign in again.')
source+='\nBefore EACH trusted restart, read back the saved roster-conflict checkpoint. Immediately after EACH restart, capture both Roster includes Owen and Roster excludes Owen, their snapshots, and the Owen and Leila visibility reads before proceeding. Complete the current row before the next restart. The recovery addendum contributes only its own dedicated pending controls and must not replace these original checks.\n'
path.write_text(source,encoding='utf-8',newline='\n')

path=TASK/'tests/polish/prompt.md';source=path.read_text(encoding='utf-8')
source=source.replace('common-ground-ballot-polish-v1.0.0-r8','common-ground-ballot-polish-v1.0.0-r9',1)
source+='\nPresentation checkpoint: first list the lifecycle, membership and participation states currently available. If Open or a recorded Member participation is missing, explicitly use the permitted dedicated Presentation review setup above. Do not skip unavailable_action_guidance or status_text_without_color by asserting that all fixture creation or voting is forbidden. It is authorized only on those dedicated controls, not on earlier Functional ballots. Record the setup and observation separately; inability to complete it remains missing evidence and must be reported accurately.\n'
path.write_text(source,encoding='utf-8',newline='\n')
print('Functional: 49 criteria, weight 58; six new invariants; targeted evidence fixes.')
