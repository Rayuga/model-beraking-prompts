"""Apply reconciled task-only repairs. Original round and shared harness stay intact."""
from pathlib import Path
from decimal import Decimal
import hashlib,json,tomllib

ROOT=Path(__file__).resolve().parents[3]
TASK=ROOT/'projects/hireops-recruiting-operations/hireops-recruiting-operations'
RUN=ROOT/'qc/runs/hireops-2026-10-01-transaction-hardening-r1'
M=json.loads((RUN/'manifest.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert {p.relative_to(TASK).as_posix():sha(p) for p in TASK.rglob('*') if p.is_file()}==M['inputs']['task']
summary=json.loads((RUN/'summary.json').read_text())
assert summary['valid_reviews']==54 and not summary['missing_reviewers']
assert (RUN/'RECONCILIATION.md').is_file()
def write(rel,s): (TASK/rel).write_text(s,encoding='utf-8',newline='\n')

rel='environment/instructions/hireops_rules.md'
s=(TASK/rel).read_text(encoding='utf-8').encode('cp1252').decode('utf-8')
s=s.replace('The runtime launches Node from `/tests`, which is not the application directory.',
 'The runtime may launch Node from a working directory other than the application directory.')
s=s.replace('session-based401/403','session-based 401/403').replace('reject409','reject 409')
write(rel,s)

rel='tests/gates/constraints/judge.toml';s=(TASK/rel).read_text(encoding='utf-8')
s=s.replace('create a uniquely named requisition with a stable generated or entered ID, a title, a department and annual budget1000.00.',
 'create a new requisition with a stable generated or entered ID and annual budget1000.00. Fill any descriptive fields the UI requires with distinctive ordinary text; a separate title or department control is not required.')
s=s.replace('the entered title/department/candidate/base/start-date values must be preserved',
 'its budget, any entered descriptive values, and the offer candidate/base/start-date values must be preserved')
s=s.replace("Never settle a seeded offer or another judge's record.","Never settle a seeded offer or another judge's record.")
write(rel,s)
for dim in ['functional','polish','visual']:
 rel=f'tests/scored/{dim}/prompt.md';s=(TASK/rel).read_text(encoding='utf-8')
 s=s.replace('create one ordinary uniquely named requisition through the UI, recording its entered title, department and budget.',
  'create one ordinary new requisition through the UI, recording its saved identity, budget and any descriptive values entered through the supported controls. A separate title or department field is not required.')
 write(rel,s)

rel='tests/scored/polish/judge.toml';s=(TASK/rel).read_text(encoding='utf-8')
s=s.replace('the valid effective date remains in an editable form, allowing an unchanged retry.',
 'the valid effective date remains visible in retained operation state, allowing an unchanged retry. Editable controls or a read-only confirmation with a Retry action are both valid.')
write(rel,s)
rel='tests/scored/polish/prompt.md';s=(TASK/rel).read_text(encoding='utf-8')
s=s.replace('the form must retain the entered valid effective date and allow an unchanged successful retry.',
 'the UI must retain the entered valid effective date and allow an unchanged successful retry, using editable controls or a read-only retained-date confirmation.')
write(rel,s)

rel='tests/scored/functional/judge.toml';original=(TASK/rel).read_text(encoding='utf-8')
prefix=original.split('[[criterion]]',1)[0]
rows=tomllib.loads(original)['criterion']
for c in rows:c['weight']=Decimal(str(c['weight']))
by={c['id']:c for c in rows}
def edit(id,description,weight=None):
 by[id]['description']=description
 if weight is not None:by[id]['weight']=Decimal(str(weight))
def add(id,weight,description,after):
 c={'id':id,'name':id,'type':'binary','weight':Decimal(str(weight)),'description':description}
 rows.insert(rows.index(by[after])+1,c);by[id]=c
def take(id,weight):by[id]['weight']-=Decimal(str(weight))

edit('hro_commitment', 'P4 approval on your own fresh requisition: record its budget, existing movements and headroom, then approve the dedicated offer. A visible commitment consumes exactly100001.77 and fresh headroom drops by that amount. Headroom equals the recorded budget plus the net signed commitment/reversal/release movements, rather than a planning-only scalar. Use judge-created records; no imported requisition is required. This row owns live movement netting and the approval effect. Later preservation of old monetary rows belongs to hro_history.')
take('hro_raise_role_recruiter','.01')
add('hro_req_create_recruiter','.01','P1: Rafael Costa, Recruiter can create a new ordinary requisition through the UI and retrieve its actual identity and entered budget in a fresh signed-in read. Reuse the initial Recruiter setup when successful. This permission is independent of offer creation and other actors; generated IDs and optional descriptive fields are valid.', 'hro_raise_role_recruiter')
take('hro_referral_creation','.01')
add('hro_referrer_roster','.01','P1/P4: every supplied referring employee (Dara Whitfield, Sofia Marchetti and Omar Haddad) is available for assignment to a new ordinary offer. Observe each selection/reference in the normal UI or saved draft product readback; different picker or text-entry designs are valid. Reuse ordinary offer setup and do not require an approval per employee. This owns roster usability only, independently of referral amounts or settlement.', 'hro_referral_creation')
take('hro_stale_approval','.01')
add('hro_draft_eligibility','.01','P9 conditional imported-history observation: if the app exposes any imported DRAFT offers, they have no commitment/headroom effect and cannot be approved directly. After a successful fresh PENDING approval control, adapt that observed approval request only to one imported DRAFT identity; require refusal and fresh unchanged economic/history state. This sole intended-refusal seed probe is permitted; never intentionally settle or alter other seed records. If the optional history is omitted or no DRAFT is exposed, this condition is satisfied without requiring import. Owns DRAFT eligibility only; ordinary repeated approval has separate credit.', 'hro_stale_approval')

take('hro_change_net_budget','.5')
add('hro_change_over_budget','.5','B1/B2: on a dedicated100.00 requisition with committed run-rates60/40, establish the affordable80/20 replacement control. A separate new-key intent80/20.01 must not commit the one-cent final overrun. Allow refusal during prepare or, if a draft is saved, commit. Fresh readback preserves every member and all economic/settlement history from immediately before the attempt; a draft and generic access logs may remain. A corrected affordable intent under a new key succeeds. Owns final-budget refusal, independently of affordable netting or stale-token handling.', 'hro_change_net_budget')
take('hro_change_signing','.25')
add('hro_change_relocation','.25','B1: around a successful coordinated change with nonzero changed relocation values, compare all payment/remittance records and retained compensation terms. Relocation stays recorded on successors but produces no reimbursement, contra-payment or other settlement. Use ordinary nonzero signing adjustments as the working-payment control, and a simpler eligible change set if another B1 branch fails. Owns coordinated relocation exclusion only, not signing adjustment arithmetic.', 'hro_change_signing')
edit('hro_change_preview_neutral','B1/B3: after a successful preparation, commitments, source statuses, grants, payments, referrals and successful settlement history equal their pre-prepare state. Generic access logging and the draft itself may grow. The preview does not reserve or settle anything. Owns economic neutrality only; draft persistence and later commit success are independent.', '.5')
add('hro_change_preview_durable','.5','B1/B3: after successful preparation, a fresh independent signed-in context retrieves the same saved operation identity, canonical member intent and original computed preview values. Use its normal history/detail view and product reads; no exact schema is required. Owns durable preview retrieval independently of economic neutrality and later commit success.', 'hro_change_preview_neutral')
edit('hro_change_shape','B2: a valid nonblank-key four-member control works. One/five members, repeated source, missing/nonexistent destination and missing/blank operation key cannot produce a valid preview or economic effects. Use the observed request representation and a nearby valid control. Do not require a particular validation status within4xx. Compensation numeric validity and an affordable final budget are separately owned.')
edit('hro_change_numeric','B2: after valid compensation controls, negative/nonnumeric/sub-cent money, fractional units, unsafe integer inputs and safe-input computed overflow refuse without a valid preview or financial effects. Safe units9007199254740991 with a zero fair/strike spread remain accepted, while the same units at fair.02/strike0 overflow. Adapt dollars/cents and value types to the actual UI-observed request; do not invent fields or force impossible text into native controls. Nearby valid values still prepare successfully. Owns coordinated numeric/overflow validation only.')
edit('hro_change_receipt','B1: a durable batch receipt identifies actual actor/operation, all old/new offers, source/destination requisitions, compensation, signed adjustments and complete before/after headrooms. Retrieve it in a fresh signed-in context. Judge fidelity to the observed transaction rather than regrade arithmetic. Member audit lines, structured member snapshots and later historical preservation have independent owners.', '.25')
add('hro_change_audit','.25','B1: every successful member revision produces a readable audit line identifying the action, actor and old/new offer, with the transaction before/after summary. Read these through the ordinary Audit Trail after a fresh sign-in. A card, row or another readable layout is valid. Owns readable member history independently of batch receipts and structured member snapshots; use a simpler successful change set if needed.', 'hro_change_receipt')
add('hro_change_afterimages','.25','B1: each successful member has a durable structured before/after receipt with actual actor, source/destination identities and observed compensation/settlement figures. All member headrooms reflect the same complete transaction, not an intermediate half-posted state. Read through normal product views/responses in a fresh signed-in context. Owns member snapshot fidelity; missing text lines or batch receipt do not erase an independently observed snapshot.', 'hro_change_audit')
add('hro_change_history','.25','B6: preserve the batch receipt and member text/snapshots actually obtained from a successful coordinated commit. After later successful ordinary revision and rescission, freshly read those original artifacts: their actor, identities, before/after values and original settlement details remain unchanged. This owns preservation of earlier recorded history, not initial artifact creation or cached write replay. Preserve evidence for each artifact that exists; do not inherit an initial sibling failure or silently accept changed historical values. If needed, use a simpler successful transfer and later action to obtain an independent preservation witness.', 'hro_change_afterimages')
edit('hro_change_later_destination','B6: an ordinary revision of a transferred current successor replaces its commitment on the destination requisition. Its original source budget stays as the completed transfer left it. Observe the replacement/reversal and final budgets after a successful revision. Use a simple transfer as alternate setup. Owns post-transfer revision budget ownership, independently of rescission, vesting and batch history.', '.25')
add('hro_change_later_release','.25','B6: ordinary Finance rescission of a transferred current successor releases its latest commitment to the destination requisition while the original source budget stays unchanged. Read the persisted release and budgets. If ordinary revision is unavailable, rescind a dedicated transferred successor directly; do not inherit that earlier failure. Owns post-transfer release ownership, not vesting amounts or original-result replay.', 'hro_change_later_destination')
add('hro_change_signing_anchor','.25','B6: after a successful transfer, rescind a dedicated successor at2025-02-28T12:34:56.789Z for the B1 original start2024-02-29T12:34:56.789Z, or another exact public calendar boundary for a dedicated original start. The retained signing amount and contra-payment use the original start under the public calendar/cliff rules. A later ordinary revision may be reused when it succeeds, but is not required for this observation. Owns signing date anchoring after transfer; use an ordinary nonzero bonus control and do not inherit budget or equity failures.', 'hro_change_later_release')
add('hro_change_equity_anchor','.25','B6: after a successful transfer, rescind a dedicated positive-unit successor at2025-02-28T12:34:56.789Z for the B1 original start2024-02-29T12:34:56.789Z, or another exact public calendar boundary for a dedicated original start. Vested versus cancelled units use the original anchor under the public calendar/cliff rules. A later ordinary revision may be reused when it succeeds, but is not required. Owns equity date anchoring after transfer, independently of signing, budget and receipt/retry outcomes.', 'hro_change_signing_anchor')

assert len(rows)==145
assert sum(c['weight'] for c in rows)==45
assert sum(c['weight'] for c in rows if c['id'].startswith('hro_change_'))==28
assert all(c['weight']>0 for c in rows)
def render(c):
 return '\n'.join(['[[criterion]]',f'id = "{c["id"]}"',f'name = "{c["name"]}"',f'type = "{c["type"]}"',f'weight = {c["weight"]}', 'description = """',c['description'].strip(),'"""',''])
write(rel,prefix+'\n'.join(render(c) for c in rows)+'\n')

rel='tests/scored/functional/prompt.md';s=(TASK/rel).read_text(encoding='utf-8')
s=s.replace('Users, referring employees, constants and clock remain supplied facts.',
 'Users, referring employees, constants and clock remain supplied facts. Record Recruiter requisition intake independently from offer intake. Exercise availability of all three supplied referrers through normal offer inputs/readback; no additional approval per employee is needed.')
s=s.replace('Never send bodies to unobserved routes. Coordinated prepare/commit',
 'If imported DRAFT offers are exposed, verify that they contribute no commitment and adapt one successful pending-approval request to a DRAFT identity as an intended refusal, with fresh unchanged-state readback. This is the sole permitted seed-operation probe; never intentionally settle seed offers. Omitted operational history remains valid. Never send bodies to unobserved routes. Coordinated prepare/commit')
s=s.replace('No winner/order constraint.','No winner/order constraint. On a dedicated same-requisition pair also try80/20.01: refuse at prepare or commit with no economic effects, then a new-key affordable80/20 intent works. Compare fresh immediately-before-attempt state and reuse this setup for the independent final-overrun observation.')
s=s.replace('repeated source, missing/nonexistent destination, fractional units, negative money and computed overflow',
 'repeated source, missing/nonexistent destination, missing/blank operation key, fractional units, negative/nonnumeric/sub-cent money, unsafe integer inputs and computed overflow')
s=s.replace('signing adjustments, grants, retained referrals, per-member after-images and batch receipt.',
 'signing adjustments, absence of relocation settlement, grants, retained referrals, readable member audit lines, per-member after-images and batch receipt.')
s=s.replace("Its budget release belongs to the destination requisition and vesting still uses the original date.",
 "Revision replacement and rescission release each belong to the destination requisition. Inspect signing and equity vesting independently at2025-02-28T12:34:56.789Z using the known original2024-02-29T12:34:56.789Z anchor. No separate operation-timestamp field is required. If revision fails, directly rescind another dedicated transferred successor for independent release/vesting observations. Use simpler successful transfers if needed.")
s=s.replace('Read the original batch receipt after each later action:',
 'Read the original batch receipt and all available original member text/after-images after each later action:')
s=s.replace('Durable reads, original-result replay and subsequent destination-budget behavior receive their own observations, without inheriting each other\'s pass flag.',
 'Preview persistence/neutrality, initial batch receipt, member text, member snapshots, later preservation, original-result replay, revision budget, rescission release and each vesting anchor receive independent observations, without inheriting sibling pass flags.')
write(rel,s)

# Robustness improvement, not an assertion that uncapped receipt cards lost history.
rel='solution/app/src/index.js';s=(TASK/rel).read_text(encoding='utf-8')
assert s.count('SELECT * FROM audit_log ORDER BY id DESC LIMIT 5000')==1
write(rel,s.replace('SELECT * FROM audit_log ORDER BY id DESC LIMIT 5000','SELECT * FROM audit_log ORDER BY id DESC'))

shared=['tests/test.sh','tests/Dockerfile','tests/.dockerignore','tests/scoring.toml','tests/tools/restart_mcp.py','tests/tools/score.py','environment/Dockerfile','task.toml']
for rel in shared:assert sha(TASK/rel)==M['inputs']['task'][rel],rel
new={p.relative_to(TASK).as_posix():sha(p) for p in TASK.rglob('*') if p.is_file()}
record={'based_on_input_sha256':M['input_sha256'],'reconciled_reports':54,'changed_files':[r for r in new if new[r]!=M['inputs']['task'][r]],'source_sha256':new,'functional_count':len(rows),'functional_points':45,'coordinated_points':28,'core_points':17,'shared_files_unchanged':shared,'classification':'Task-specific repair plus audit-feed robustness; no provider measurement or clearance.'}
(Path(__file__).parent/'round1-repairs.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in record.items() if k!='source_sha256'},indent=2))
