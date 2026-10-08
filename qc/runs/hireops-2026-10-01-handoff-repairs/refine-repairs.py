"""Close focused review findings without changing any public product promise."""
import hashlib
import json
import re
import tomllib
from decimal import Decimal, ROUND_DOWN
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RUN = Path(__file__).resolve().parent
TASK = ROOT / 'projects/hireops-recruiting-operations/hireops-recruiting-operations'
path = TASK / 'tests/scored/functional/judge.toml'
before = hashlib.sha256(path.read_bytes()).hexdigest()
text = path.read_text()

def amend(cid, description):
    global text
    pattern = r'(\[\[criterion\]\]\nid = "' + re.escape(cid) + r'"\n.*?description = """\n).*?(\n""")'
    text, count = re.subn(pattern, lambda m: m.group(1) + description + m.group(2), text, count=1, flags=re.S)
    assert count == 1, cid

amend('hro_claim_req_create', 'P9 requisition claims: after normal UI creation succeeds, replay its observed shape with a fresh ID and all seven public optional claim keys set to forged values. Creation must succeed with the entered legitimate details and the same result as omission. If the product records or displays creation attribution, it must remain the actual session actor; do not require a requisition creator field or creation audit entry. Rejection solely for these claims fails. Discover the route and ordinary fields from UI, and freshly read the result. All signed-in roles may create requisitions.')
screens = [('dashboard', 'Dashboard headline counts and total headroom'),
           ('requisitions', 'Requisitions and available requisition details'),
           ('offers', 'Offers and available offer details'), ('equity', 'Equity Table grant/vesting data'),
           ('referrals', 'Referrals and accrual data'), ('audit', 'Audit Trail and available action receipts')]
for key, screen in screens:
    cid = f'hro_anon_read_{key}'
    amend(cid, f'P9 confidentiality of {screen}: identify the actual populated authenticated values/records supplying this family, then replay its observed read requests without every cookie/token/auth credential in a fresh empty context. No operational values or records belonging to this owned family may be returned. A shared bootstrap may supply several families: reuse its measured response, but a leak belonging only to another family must not fail this row. Do not invent routes or require a separate endpoint per screen. A missing populated authenticated control proves nothing. The exact anonymous401 response policy has its own criterion; this row owns confidentiality, independently of status formatting and other data families. Health, login/static shell and generic error messages may remain public.')
    text, n = re.subn(r'(id = "' + cid + r'"\nname = "' + cid + r'"\ntype = "binary"\nweight = )[^\n]+', r'\g<1>0.14285714', text)
    assert n == 1
status = '''[[criterion]]
id = "hro_anon_read_status"
name = "hro_anon_read_status"
type = "binary"
weight = 0.14285716
description = """
P9 anonymous-read response policy: inventory all distinct operational read families actually used by the six screens and available details/receipts. First capture populated authenticated success for each, then replay without every observed credential in a fresh empty context. Each must return401. Deduplicate a shared bootstrap: its status is judged once, not once per screen. This row owns the public unauthenticated response-status policy; each data family's confidentiality is scored independently, so an incorrect status alone does not erase proved non-disclosure. Public health and login/static shell may remain public. Do not guess routes or award credit without the populated authenticated controls; report bounded coverage.
"""

'''
marker = '[[criterion]]\nid = "hro_anon_req_create"'
assert marker in text
text = text.replace(marker, status + marker, 1)
amend('hro_dashboard_create', 'P10 dashboard creation: record open requisitions, total net headroom, committed offers and pending approvals. Create a dedicated requisition budget1000 and a pending offer base10,zero extras. Compare fresh dashboard changes with actual saved requisition/offer states and net commitment records. With ordinary correct creation these are +1,+1000,0,+1, but this row owns aggregation of observed records, not independent economic correctness. Use observed baselines and allow other judges\' records. Later transition aggregates have separate credit.')
for key, description, example in [
    ('approval', 'successfully approve an own ordinary base10,zero-extra pending offer', 'headroom-10, committed+1, pending-1'),
    ('revision', 'successfully revise an own ordinary committed base10,zero-extra offer to base20', 'headroom-10 with unchanged committed/pending counts'),
    ('rescission', 'successfully rescind an own ordinary base20,zero-extra committed offer as Finance', 'headroom+20 and committed-1')]:
    amend(f'hro_dashboard_{key}', f'P10 dashboard {key}: {description}. Record actual persisted commitment movements and offer states before/after. Fresh dashboard deltas must match those recorded effects; requisition count stays unchanged. With correct settlement the illustrative delta is {example}, but do not fail aggregation solely because another criterion\'s settlement amount is wrong. Own aggregation, not the formula producing the ledger amounts. Prepare an independently eligible target if another protocol failed; no prior dashboard verdict is a prerequisite. Other dashboard transitions have separate credit.')
parsed = tomllib.loads(text, parse_float=Decimal)
assert len(parsed['criterion']) == 145
assert sum(c['weight'] for c in parsed['criterion']) == Decimal(45)
path.write_text(text, encoding='utf-8', newline='\n')
prompt = TASK / 'tests/scored/functional/prompt.md'
p = prompt.read_text()
old = 'For every family capture populated authenticated success, then replay without all credentials in a clean context and require401 with no operational records.'
new = 'For every family capture populated authenticated success, then replay without all credentials in a clean context. Record each distinct response status once for hro_anon_read_status and check non-disclosure independently for each owned product-data family. A shared bootstrap needs one replay; leaked offer data must not erase credit for protected equity/referral/audit values. The public contract still requires401 and no operational records, with those properties receiving separate credit.'
assert old in p
prompt.write_text(p.replace(old, new, 1), encoding='utf-8', newline='\n')
(RUN / 'refinement-record.json').write_text(json.dumps({
    'functional_judge_before_sha256': before,
    'functional_judge_after_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    'functional_prompt_after_sha256': hashlib.sha256(prompt.read_bytes()).hexdigest(),
    'functional_criteria': 145, 'functional_weight': 45,
    'reason': 'Focused review: no unrequested creation audit, separate anonymous status/confidentiality, aggregate actual ledger facts.'
}, indent=2) + '\n')
print('Refinements applied: 145 Functional criteria, weight45.')
