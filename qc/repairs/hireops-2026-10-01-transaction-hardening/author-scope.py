"""User-authorized scope reduction and harder transaction workflow, 1 October."""
import json, re, hashlib, tomllib
from pathlib import Path
from decimal import Decimal, ROUND_DOWN
ROOT=Path(__file__).resolve().parents[3]
TASK=ROOT/'projects/hireops-recruiting-operations/hireops-recruiting-operations'
OUT=Path(__file__).resolve().parent
def read(p): return (TASK/p).read_text(encoding='utf-8')
def write(p,s): (TASK/p).write_text(s,encoding='utf-8',newline='\n')
old=read('instruction.md')
runtime=next(p for p in old.split('\n\n') if p.startswith('Put the application'))
accounts=next(p for p in old.split('\n\n') if p.startswith('Provide these demo accounts'))
write('instruction.md', '''Can you build HireOps into a compensation change desk? Finance needs to move several hires between requisitions and revise their packages together. Sometimes both requisitions are fully committed: the exchange is affordable as a whole, but neither move can happen first. We need a saved preview we can review, then one commit that posts every change or none.

People may keep a preview open while someone else changes the books. Refuse an out-of-date preview, even if a budget was changed and later restored to the same balance. If the browser loses the commit response, we need to retry the same operation without paying anyone twice. That retry must return the original receipt, including after later revisions, rescissions or a server restart.

Keep the underlying offer desk working: requisitions, pending offers, tiered approvals, exact equity valuation, signing adjustments, referrals and rescission clawbacks. Old offers, grants and receipts must remain traceable. I need the saved old and new figures on screen so we can explain a change to an auditor. Give us usable Requisitions, Offers, Coordinated Changes, Equity, Referrals and Audit views; the layout and names are yours. Focus on a clear desktop transaction workspace. We don't need a dashboard, theme switching or a special phone layout.

The financial rules and the exact coordinated-change contract are in /instructions/hireops_rules.md. Read it alongside /instructions/integration.md. Preserve the one stored reference moment, integer arithmetic and calendar conventions. Finance's coordinated changes need an ordinary form for selecting offers, destination requisitions and compensation terms, followed by a readable preview and commit/retry controls. Keep entered revision and change-set terms available after refusal so we can correct them. A failed rescission request must retain its effective date for retry. Explain these failures clearly; a lost response must not silently become a new operation.

'''+runtime+'''

Copy required assets into /app; /assets and /instructions are unavailable at runtime. Use the supplied users, referring employees, constants and fixed clock. The operational requisition/offer/ledger rows are optional demonstration history, not a required import roster. An initially empty operational desk is acceptable. Start with no shipped database, seed once, and retain new work on later restarts.

'''+accounts.strip()+'\n')
s=read('environment/instructions/hireops_rules.md')
s=s.replace('Opening a requisition is different: anyone signed in may open one, auditor\nincluded, because a requisition on its own commits no money.', 'Provide requisition creation for the Recruiter. Other signed-in roles may also open requisitions;\nthat intake convenience is optional and commits no money.')
a=s.index('### The seed roster');b=s.index('\n---',a)
s=s[:a]+'''### The starting data

Use the supplied users, referring employees, constants and reference moment. The operational
requisition, offer and ledger rows are demonstration history: importing them is optional. If imported,
their old planning scalars are never financial authority. New work must derive composed values from its
stored raw terms and append-only movements. Restart must retain that work rather than replace it with
demonstration data.
'''+s[b:]
s=s.replace('The same goes for opening a requisition, which any signed-in role may do (section 1).', 'Opening a requisition likewise creates it directly (section 1).')
a=s.index('Whoever raises an offer gives it an id');b=s.index('Raising an offer also names',a)
s=s[:a]+'''Record identifiers may be generated or entered by the operator. Their format and input controls are
yours; preserve stable associations and history when records are revised or transferred.

'''+s[b:]
a=s.index('Some clients attach optional claims named');b=s.index('An unauthenticated caller',a)
s=s[:a]+s[b:]
# Drop exact refusal-message formatting while retaining the financial enforcement.
s=re.sub(r'(?m)^.*held.*required.*message.*\n','',s) if False else s
s=s.replace('A compensation breakdown should carry the base salary, signing bonus, relocation and equity together with the\nequity\'s intrinsic and annualized value, the committed run-rate, and the approval band basis and tier side by\nside — they are different figures, and a screen that shows only one of run-rate or band basis is not showing\nthe other.', 'Expose the raw compensation terms and each defined derived figure in ordinary product views.\nThe run-rate and approval-band basis are different figures; both must be available. They need not all\nfit in one viewport or one particular layout.')
s=s.replace('And the\nlanding screen should carry the headline figures we open the app for: how many requisitions are open, what\nheadroom is left across them, how many offers are committed and how many approvals are waiting.', 'A separate aggregate dashboard is not required.')
s+='''
## 11. Coordinated compensation changes

Finance can prepare a change set containing two through four distinct current COMMITTED offers. Each
member selects its current offer, a destination requisition (which may be its existing requisition), and
all six replacement compensation terms. Use ordinary labelled form controls; a raw JSON editor is not
the operator workflow. Any signed-in person may read saved previews and receipts, but only the Finance
actor who prepared a change set may commit it. Other roles may neither prepare nor commit one. The
normal session-based401/403 rules apply to these operations as well.

The operator supplies a nonblank operation key. The key belongs to that signed-in actor and identifies
one immutable intent: the source offer identities, destination requisitions and replacement terms.
Reordering members does not change intent. Reusing the key with that same intent returns the same saved
preview or committed result; changing any member, destination or compensation term with that key is a
conflict (409), with no new economic effects. Use a new key for corrected or changed intent. No particular
HTTP route, request schema, key prefix or generated record format is prescribed.

Preview computes each member's old/new run-rate, signing adjustment and replacement equity terms, and
each touched requisition's before/after headroom. It preserves the original source offer and requisition
identities. Preview is durable but reserves no budget, supersedes no offer, creates no grant/payment/
referral and writes no successful settlement receipt. An invalid shape (fewer than two or more than four
members, repeated source, missing target, or invalid compensation) must not save a valid change set.

Calculate final headroom per requisition as current headroom plus all selected old commitments released
from that requisition, minus all replacement commitments assigned to it. Final headroom must be
nonnegative and all stored money/unit results must remain exact safe integers. Validate the complete
set, not a sequence of intermediate budgets: fully funded cycles and offsetting changes must succeed.
Insufficient final headroom refuses the entire preview or commit. Existing signing, equity, rounding
and relocation rules remain unchanged.

A saved preview captures the exact current source leaves and the economic state of every source and
destination requisition it touches. At commit, reject409 if any source is no longer current COMMITTED,
or if any commitment-changing operation has happened on any touched requisition since preview. This
includes changes made and then reversed: equal headroom is not proof that the preview is still current.
A pending offer creation, an unrelated requisition's settlement, or another preview alone must not
invalidate it. Repeating an old preview request must not silently refresh its captured state. Prepare a
new key after a conflict. The representation of versions or freshness tokens is up to you.

Commit uses the saved intent and recomputes/validates stored facts; values or identities in a request
cannot override that intent or the signed-in actor. All members commit atomically. Each receives a new
COMMITTED successor on its destination requisition; its old row remains on the old requisition as
SUPERSEDED. Keep candidate, original creator/approver, original offer/grant date and referral identity/
start unchanged. Append a reversal on the source and a new commitment on the destination. Append the
signed difference in signing bonus, supersede the prior grant and mint the replacement grant only when
units are positive. Do not duplicate or move the original referral accrual. Later ordinary revisions and
rescissions use the successor's destination budget and original vesting anchors.

Write the usual immutable member audit lines/after-images plus one durable batch receipt identifying
the actor, operation, all old/new offer identities, source/destination requisitions, all before/after
headrooms, compensation and signed adjustments. Every member's receipt reflects the same complete
before/after transaction, not an intermediate half-posted balance. A failed commit leaves every member
and all economic/history records as they were immediately before the attempt; generic access logs may
grow. A draft record can remain after a conflict. Never post a successful batch receipt for a refusal.

Concurrent commits of the same saved operation both return the one original committed result and create
only one set of effects. Two different outstanding previews touching the same requisition cannot both
commit from the old state: one succeeds and the other conflicts, with no partial loser. Disjoint previews
remain independently committable. Once committed, retrying the same operation returns its original
immutable receipt without revalidating current leaves or budgets, even after later changes or restart.
Check current session authorization before returning a cached write result. Read-only receipt access is
available to all signed-in roles through ordinary history views.
'''
write('environment/instructions/hireops_rules.md',s)
ctx=read('tests/app_context.md').replace('Dashboard, Requisitions, Offers, Equity Table, Referrals and Audit Trail.', 'Coordinated Changes, Requisitions, Offers, Equity Table, Referrals and Audit Trail.\nOperational demonstration rows may be absent; prepare your own controls.\nFinance prepares and commits coordinated changes; all signed-in roles can read them.')
write('tests/app_context.md',ctx)

functional=read('tests/scored/functional/judge.toml')
head=functional.split('[[criterion]]')[0]
criteria=tomllib.loads(functional,parse_float=Decimal)['criterion']
remove={'hro_req_identity','hro_offer_identity','hro_offer_id_revision','hro_offer_id_lifecycle','hro_offer_id_rescission','hro_compensation_breakdown','hro_req_duplicate','hro_offer_duplicate','hro_req_blank','hro_offer_blank','hro_cross_kind_identity','hro_readback','hro_tier_feedback','hro_approval_budget_feedback','hro_revision_budget_feedback'}
prefixes=('hro_account_','hro_seed_','hro_req_role_','hro_claim_','hro_dashboard_')
dropped=[c for c in criteria if c['id'] in remove or c['id'].startswith(prefixes)]
kept=[c for c in criteria if c not in dropped]
for c in kept:
    if c['id']=='hro_anon_read_dashboard':
        c['id']=c['name']='hro_anon_read_changes'
        c['description']=c['description'].replace('Dashboard headline counts and total headroom','Coordinated Changes previews and receipts').replace('other data families','other data families')
    c['description']=c['description'].replace('including its unusual requisition ID','including its requisition association')
    c['description']=c['description'].replace('Informative refusal contents belong to hro_tier_feedback.','No exact refusal-message contents are required.')
    c['description']=c['description'].replace('Basic caller-chosen ID handling is separately hro_req_identity.','')
    c['description']=c['description'].replace('Every-role creation permission, including Auditor, belongs to the per-account requisition-role criteria.','')
    if c['id']=='hro_stale_approval':
        c['description']=re.sub(r' Also refuse approval of seeded DRAFT OFF-301; inspect that DRAFT contributes no commitment\.', '',c['description'])
    if c['id']=='hro_dual':
        c['description']='P5: as an approver, raise an affordable pending offer, record its creator and attempt to approve it as that same person. Refuse with unchanged state. A matching unrelated offer raised by another person must be successfully approved by this actor. Then a distinct sufficient-tier approver must approve the same self-refused target. Judge separation of duties, not a seeded ID or formula accuracy.'
old_total=sum(c['weight'] for c in kept)
for c in kept: c['weight']=(c['weight']*Decimal(17)/old_total).quantize(Decimal('.00000001'),rounding=ROUND_DOWN)
kept[-1]['weight']+=Decimal(17)-sum(c['weight'] for c in kept)
def dump(rows):
    return head+''.join('[[criterion]]\n'+f'id = "{c["id"]}"\nname = "{c["id"]}"\ntype = "binary"\nweight = {c["weight"]}\ndescription = """\n{c["description"].strip()}\n"""\n\n' for c in rows)
write('tests/scored/functional/judge.toml',dump(kept))
(OUT/'scope-record.json').write_text(json.dumps({'removed_criteria':[c['id'] for c in dropped],'retained_count':len(kept),'retained_weight':17,'planned_coordinated_change_weight':28,'user_authorization':'Remove easy scope and add difficult features, then independent QC until task-specific defects are cleared; shared blockers accepted. No provider spend or upload authorization.'},indent=2)+'\n')
print('Retained',len(kept),'legacy criteria with total weight17; removed',len(dropped))
