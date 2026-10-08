"""Apply task-only repairs after the complete independent audit is reconciled.

This file is prepared during review, but its guard prevents premature mutation.
It does not change the golden, shared harness, reward policy or timeouts.
"""
import hashlib
import json
import re
import tomllib
from decimal import Decimal, ROUND_DOWN
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RUN = Path(__file__).resolve().parent
TASK = ROOT / 'projects/hireops-recruiting-operations/hireops-recruiting-operations'
summary = json.loads((RUN / 'summary.json').read_text())
assert summary['valid_reviews'] == summary['expected_reviews'] == 54
assert not summary['missing_reviewers'] and not summary['invalid']
assert summary['status'] == 'BLOCKED'
manifest = json.loads((RUN / 'manifest.json').read_text())
original = {p.relative_to(TASK).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in TASK.rglob('*') if p.is_file()}

def read(rel):
    return (TASK / rel).read_text(encoding='utf-8')

def write(rel, text):
    (TASK / rel).write_text(text, encoding='utf-8', newline='\n')

def change(rel, old, new):
    text = read(rel)
    assert text.count(old) == 1, (rel, old[:90], text.count(old))
    write(rel, text.replace(old, new))

rel = 'tests/scored/functional/judge.toml'
text = read(rel)
splits = []

def block(cid, weight, description):
    return (f'[[criterion]]\nid = "{cid}"\nname = "{cid}"\ntype = "binary"\n'
            f'weight = {weight}\ndescription = """\n{description.strip()}\n"""\n\n')

def replace(cid, children):
    global text
    pattern = r'\[\[criterion\]\]\nid = "' + re.escape(cid) + r'"\n.*?(?=\[\[criterion\]\]|\Z)'
    m = re.search(pattern, text, re.S)
    assert m, cid
    old = tomllib.loads(m.group(), parse_float=Decimal)['criterion'][0]
    total = Decimal(str(old['weight']))
    unit = (total / len(children)).quantize(Decimal('.00000001'), rounding=ROUND_DOWN)
    weights = [unit] * len(children)
    weights[-1] = total - sum(weights[:-1])
    text = text[:m.start()] + ''.join(block(i, w, d) for (i, d), w in zip(children, weights)) + text[m.end():]
    splits.append({'old_id': cid, 'old_weight': str(total), 'new': [
        {'id': i, 'weight': str(w)} for (i, _), w in zip(children, weights)]})

users = [('recruiter', 'Rafael Costa, Recruiter'), ('comp', 'Mei Lin, Comp partner'),
         ('tier1', 'Ingrid Sorensen, tier-1 Approver'), ('tier2', 'Bill Okafor, tier-2 Approver'),
         ('tier3', 'Yuki Tanaka, tier-3 Approver'), ('finance', 'Farah Nasser, Finance'),
         ('auditor', 'Aud Halvorsen, Auditor')]
replace('hro_accounts', [(f'hro_account_{key}', f'Sign in as {person} with the listed account and shared password. The protected workspace visibly identifies this person and seeded role, including the held tier for an approver. Do not require exact labels or exposed user IDs. This account has independent credit; invalid-password refusal belongs to the gate.') for key, person in users])
replace('hro_duplicate_identity', [
    ('hro_req_duplicate', 'P1 requisition duplicate: after a successful saved requisition, repeat its exact ID through UI or an observed creation replay with different valid details. Refuse without replacing its saved values or adding another requisition. Other identity policies have separate credit.'),
    ('hro_offer_duplicate', 'P1 offer duplicate: after a successful saved offer, repeat its exact ID through UI or an observed creation replay with different valid details. Refuse without replacing the original or adding another offer/economic row. Other identity policies have separate credit.'),
    ('hro_req_blank', 'P1 requisition blank ID: after a successful ordinary creation control, attempt an empty and a whitespace-only ID. Refuse without adding a requisition or modifying the control. Use otherwise valid data and an observed request replay when native UI validation prevents dispatch.'),
    ('hro_offer_blank', 'P1 offer blank ID: after a successful ordinary creation control, attempt an empty and a whitespace-only ID. Refuse without adding an offer/economic row or modifying the control. Use otherwise valid data and an observed request replay when native UI validation prevents dispatch.'),
    ('hro_cross_kind_identity', 'P1 separate identity namespaces: create a requisition and an offer whose IDs are exactly the same nonblank string, then freshly retrieve both with their own saved details and correct association. Either creation order is valid. Do not impose global uniqueness, prefixes or trimmed identity; same-kind duplicate and blank-ID refusal have separate credit.')])
replace('hro_date_validation', [
    ('hro_date_rejection', 'P2 offer date refusal: first successfully create an offer with valid full UTC offer/referral instants. Impossible 2025-02-30T00:00:00Z, nonsensical date text, missing required offer start, and missing separate hire start with a selected referrer must be refused without new/changed offer data. Use otherwise valid controls and observed replays if native inputs block invalid text. An economic-only revision may ignore injected date fields while applying the valid economic change; it need not edit dates. Valid date-only acceptance and rescission-date validation have separate credit.'),
    ('hro_date_only', 'P2 date-only acceptance: through offer creation, save real YYYY-MM-DD values for both required offer start and separate referred-hire start with a referrer. Fresh readback represents each as UTC midnight; equivalent valid display formatting is allowed. This accepts valid calendar inputs independently of invalid-date refusal. Full UTC instant precision is covered by the dedicated date/lineage protocols.')])
replace('hro_req_roles', [(f'hro_req_role_{key}', f'P1/P5: {person} can create and freshly retrieve an ordinary valid requisition with entered title, department and budget. Reuse a successful UI creation for this actor. Judge this permission independently of other accounts, offer creation, unusual IDs and economic calculations.') for key, person in users])
replace('hro_raise_roles', [(f'hro_raise_role_{key}',
    f'P1/P5: {person} can raise a new ordinary offer directly PENDING through the UI on a suitable existing requisition, then freshly retrieve it. Reuse prior successful creation. This actor\'s requisition-creation outcome is not a prerequisite. Judge permission separately from unusual IDs and numerical settlement.' if key != 'auditor' else
    'P5 Auditor offer creation: first establish a successful authorized UI offer-creation control. Replay its observed shape as Auditor with a fresh ID and valid data; require403, no saved offer and no economic effects. Hidden controls alone are insufficient. Other roles have separate credit.') for key, person in users])
replace('hro_approval_role', [(f'hro_approval_role_{key}', f'P5: first observe successful UI approval by a distinct authorized approver. Replay the observed request as {person} against another affordable pending offer; require403, unchanged pending state and no settlement records. Use valid eligible data; hiding a control is insufficient. Each forbidden role has independent credit.') for key, person in users if key in {'recruiter', 'comp', 'finance', 'auditor'}])
replace('hro_revision_roles', [(f'hro_revision_role_{key}',
    f'P4/P5: {person} successfully revises a separate current committed offer through the UI. Reuse prior observations; a minimal base change suffices, and formula correctness has separate credit. ' + ('Include a Recruiter revision into BandIII on an ample budget without a new approval or tier check.' if key == 'recruiter' else 'Other revisers have independent credit.') if key not in {'comp', 'auditor'} else
    f'P5: after an ordinary successful authorized UI revision establishes the request shape, replay a valid revision as {person} against a separate current committed control. Require403 and no lineage/economic mutation. Other actors\' permissions and numerical settlement have separate credit.') for key, person in users])
replace('hro_rescission_role', [(f'hro_rescission_role_{key}', f'P5: Finance first successfully rescinds a current committed control at a valid instant. Replay the observed valid request as {person} against a separate current committed target. Require403 with its saved status and economics unchanged. Reuse the Finance success; this forbidden actor has independent credit.') for key, person in users if key != 'finance'])
tier_rows = []
for tier in range(1, 4):
    for band in range(1, 4):
        outcome = ('successfully approves' if tier >= band else 'receives403 and leaves the target pending with unchanged economic state')
        tier_rows.append((f'hro_tier_{tier}_band_{band}', f'P5: the seeded tier-{tier} approver {outcome} on an affordable Band{band} pending offer raised by someone else. Establish the band from raw inputs. For a refusal, this same actor must first successfully approve an in-range control using the same observed mechanism. Reuse matching successes; use distinct targets from self-approval. Own only this tier/band decision, independently of other matrix cells, numerical settlement and feedback wording.'))
replace('hro_tier', tier_rows)
screens = [('dashboard', 'Dashboard'), ('requisitions', 'Requisitions and available requisition details'),
           ('offers', 'Offers and available offer details'), ('equity', 'Equity Table'),
           ('referrals', 'Referrals'), ('audit', 'Audit Trail and available action receipts')]
replace('hro_anon_read', [(f'hro_anon_read_{key}', f'P9: inventory the actual operational read families supplying {screen}. Capture populated authenticated success, then replay each observed family without every cookie/token/auth credential in a fresh empty context. Require401 and no operational records. A shared bootstrap may serve several screens: reuse that same measured request/result, do not invent routes or repeat it. An empty response without populated control proves nothing. State the bounded observed inventory. Other screens have independent credit; health and login/static shell may remain public.') for key, screen in screens])
replace('hro_claim_identity', [
    ('hro_claim_approval_identity', 'P9 approval identity claims: after normal UI approval succeeds, replay its observed shape for another valid pending offer adding claimedActorId, claimedRole and claimedTier. Authorized success and recorded actor must match the signed-in session, as with omission. A forbidden actor or insufficient-tier approver cannot gain approval by claiming another actor/role/tier and still receives403. Use an eligible offer and unchanged-state readback. Rejection solely for adding the claims fails. Economic claims have separate credit.'),
    ('hro_claim_req_create', 'P9 requisition claims: after normal UI creation succeeds, replay its observed shape with a fresh ID and all seven public optional claim keys set to forged values. Creation must succeed with the entered legitimate details and actual session actor, as with omission; claims cannot alter saved/audit attribution. Rejection solely for these claims fails. Discover the route and ordinary fields from UI, and freshly read the result. All signed-in roles may create requisitions.'),
    ('hro_claim_offer_create', 'P9 offer-creation claims: after normal UI creation succeeds, replay its shape with a fresh ID and all seven public optional claim keys set to forged values. An authorized actor succeeds, preserving legitimate inputs and session creator just as with omission. Auditor claiming an allowed creator still receives403 and creates nothing. Verify fresh state. Rejecting an otherwise valid request solely for the claims fails; ordinary fields/routes come from the UI.'),
    ('hro_claim_revision', 'P9 revision claims: after normal UI revision succeeds, replay its shape for another eligible current committed target with all seven public optional claim keys forged. An authorized reviser succeeds with effects derived from legitimate stored/input values and its actual session actor, as with omission. Auditor claiming Finance still receives403 with unchanged state. Rejecting solely for added claims fails. Judge claim influence independently of unrelated formula accuracy; discover ordinary fields/routes from UI.'),
    ('hro_claim_rescission_identity', 'P9 rescission identity claims: after a successful normal Finance UI rescission, replay its shape for another eligible target with forged claimedActorId, claimedRole, claimedTier, claimedBand and claimedCommittedCents. Finance succeeds with the actual session actor and otherwise unchanged semantics. Auditor claiming Finance still receives403 with unchanged state. Claims must be ignored, not rejected. Clawback/cancelled-unit monetary claims have their own row; discover ordinary fields/routes from UI.')])
text = text.replace('claimedBand, claimedTier and claimedCommittedCents', 'claimedBand, claimedCommittedCents, claimedClawbackCents and claimedCancelledUnits')
old = 'P4: first and second prior grants become SUPERSEDED historical grants preserving7 then11 units and their original grant instant. Active grant has13 revised units and original instant, not revision time; previous cancellation totals remain unchanged.'
new = 'P4: first and second prior grants become SUPERSEDED historical grants preserving7 units at fair1.02/strike0.01 and11 units at fair2.03/strike0.02, respectively, with their original grant instant. The active replacement grant has13 units at fair3.04/strike0.03 and the original instant, not revision time. Compare prices on the grant records themselves, not only the offer. Previous cancellation totals remain unchanged.'
assert old in text
text = text.replace(old, new)
replace('hro_offer_identity', [
    ('hro_offer_identity', 'P1: using any successfully authorized creator, raise a valid offer directly PENDING and freshly retrieve it. Preserve the entered nonblank ID including spaces /?#, requisition, candidate, all six economic inputs and both distinct dates/referrer when supplied. No draft-submit dance is required. Own creation and saved identity only; approval, revision and rescission routing and creator-role permissions have separate credit.'),
    ('hro_offer_id_revision', 'P4 unusual-ID revision: successfully revise a current committed offer whose offer and requisition IDs contain spaces /?#, targeting that exact hire and preserving its lineage association. Use an ordinary-ID successful revision as the control and prepare an independently eligible unusual-ID target if an earlier observation failed for an unrelated reason. Own identifier routing, not compensation formulas, creation, approval or rescission.')])
replace('hro_dashboard', [
    ('hro_dashboard_create', 'P10 dashboard creation: record open requisitions, net headroom, committed offers and pending approvals. Create a dedicated requisition budget1000 and a pending offer base10,zero extras. Fresh dashboard deltas are +1,+1000,0,+1. Use observed baselines; allow other judges\' records. Later transition aggregates have independent credit.'),
    ('hro_dashboard_approval', 'P10 dashboard approval: after an independently successful approval of an own ordinary base10,zero-extra pending offer, fresh dashboard headroom decreases10, committed count increases1 and pending decreases1. Requisition count stays unchanged. Use a dedicated eligible control if another protocol fails; other dashboard transitions have separate credit.'),
    ('hro_dashboard_revision', 'P10 dashboard revision: successfully revise an own ordinary committed base10,zero-extra offer to base20. Fresh dashboard headroom decreases10; committed, pending and requisition counts stay unchanged. Independently prepare an eligible target if needed. Other dashboard transitions have separate credit.'),
    ('hro_dashboard_rescission', 'P10 dashboard rescission: successfully rescind an own ordinary base20,zero-extra committed offer as Finance. Fresh dashboard headroom increases20, committed count decreases1; pending and requisition counts stay unchanged. Independently prepare an eligible target without requiring a prior revision. Other dashboard transitions have separate credit.')])
text = text.replace('belongs to hro_req_roles', 'belongs to the per-account requisition-role criteria')
parsed = tomllib.loads(text, parse_float=Decimal)
assert sum(Decimal(str(c['weight'])) for c in parsed['criterion']) == Decimal(45)
assert len({c['id'] for c in parsed['criterion']}) == len(parsed['criterion'])
write(rel, text)

# Task-specific prompts may change; shared runtime and scoring files remain frozen.
change('tests/scored/functional/prompt.md', 'Earlier gates may have added a unique requisition and committed offer', 'Earlier gates may have added a unique requisition and PENDING offer')
change('tests/scored/functional/prompt.md', 'If ID routing fails, retain that failure in hro_offer_identity and establish an ordinary-ID chain for independent economic observations.', 'If ID routing fails, record it only in the owner of the attempted action: hro_offer_identity for creation/readback, hro_offer_id_lifecycle for approval, hro_offer_id_revision for revision, or hro_offer_id_rescission for rescission. Establish an ordinary-ID chain for independent economic observations; do not retroactively fail a successful creation.')
change('tests/scored/functional/prompt.md', 'For the claim controls, add only the public optional keys claimedActorId, claimedRole, claimedTier, claimedBand and claimedCommittedCents to a UI-observed approval body, and claimedClawbackCents and claimedCancelledUnits to a UI-observed rescission body. Compare each with an otherwise valid omission control; score approval and rescission claim handling independently.', 'The public optional claim keys are claimedActorId, claimedRole, claimedTier, claimedBand, claimedCommittedCents, claimedClawbackCents and claimedCancelledUnits. Follow each claim criterion\'s allocation: add all seven to observed requisition-creation, offer-creation and revision requests; approval identity owns ActorId/Role/Tier and approval economics owns the other four; rescission identity owns ActorId/Role/Tier/Band/CommittedCents and rescission economics owns ClawbackCents/CancelledUnits. Use forged values, legitimate actual inputs, separate eligible targets and otherwise equivalent omission controls. Check successful authorized acceptance, actual session attribution and each stated forbidden actor\'s unchanged-state refusal. Reuse observations across rows without inheriting verdicts. Never penalize the same claimedTier handling in both approval rows.')
change('tests/scored/functional/prompt.md', 'Record before/after facts per row and per record.', 'Record before/after facts per row and per record. Account, role, tier/band, identity-policy, anonymous-read-screen and dashboard-transition criteria have separate credit. Execute their shared matrix/inventory once and reuse its facts; a failed cell must not erase successful sibling cells. Do not repeat the whole protocol for each criterion.')

change('tests/gates/constraints/judge.toml', 'Sign in as the seeded Recruiter.', 'Sign in with a seeded account allowed to raise offers, preferring Recruiter. If that account is unavailable, try another allowed account; individual-account support has scored credit.')
change('tests/gates/constraints/judge.toml', 'sign in as the seeded Auditor and navigate', 'sign in with a working seeded account, preferring Auditor, and navigate')
change('tests/gates/constraints/prompt.md', 'retrieve both in a fresh Auditor context.', 'retrieve both in a fresh empty signed-in context (prefer Auditor; another working seeded account is acceptable).')
change('tests/gates/constraints/prompt.md', 'requisition creation, offer creation and approval', 'requisition creation and offer creation')
change('tests/gates/constraints/prompt.md', 'The independent Auditor context', 'The independent signed-in context')

backing = ('Minimal backend check: sign in with a working seeded account and create one ordinary uniquely named requisition through the UI, recording its entered title, department and budget. '
           'Use a new empty browser context via browser_run_code_unsafe: const ctx=await page.context().browser().newContext(); const fresh=await ctx.newPage(); '
           'navigate, sign in through ordinary controls (prefer Auditor; another working account is acceptable), and retrieve that exact new requisition with matching values. '
           'Close only ctx, preserving the supplied page. A supported separate-context tool is an alternative; a same-context tab/reload or HTTP200 is insufficient. '
           'A static seed/no-op response or browser-only save fails this backend check. No approval, revision, rescission, financial formula or technology/source inspection belongs in this prerequisite. '
           'Use a dimension-specific ID suffix and leave the record in place. Reuse this creation for later applicable observations; do not repeat it per criterion.')
for dimension in ('functional', 'polish', 'visual'):
    relp = f'tests/scored/{dimension}/prompt.md'
    s = read(relp)
    marker = '## Global browser gate and independent scoring' if dimension == 'functional' else '## Global browser gate'
    s = s.replace(marker, marker + '\n\n' + backing, 1)
    if dimension == 'functional':
        s = s.replace('First sign in and demonstrate a usable saved product record through the UI, followed by readback. A blank/static shell or unavailable operational app gives every criterion zero.', 'Establish the minimal backend check above. A blank/static shell, unavailable operational app or observed failure of that check gives every binary criterion0.')
    elif dimension == 'polish':
        s = s.replace('Sign in and demonstrate operational content with a usable saved record. Blank/static nonoperational shells receive zero throughout.', 'Establish the minimal backend check above. Blank/static nonoperational shells or an observed failure of that check receive binary0 throughout.')
    else:
        s = s.replace('Sign in and establish an operational populated workspace. A blank/static nonworking shell gives every criterion zero.', 'Establish the minimal backend check above and an operational populated workspace. A blank/static nonworking shell or an observed failure of that check gives every criterion its minimum raw Likert score1, which normalizes to zero.')
        s = s.replace('Read-only review of dashboard', 'After this one gate-setup creation, perform a read-only review of dashboard')
    if dimension != 'functional':
        low = 'raw Likert1 (normalized zero)' if dimension == 'visual' else 'binary0'
        s = s.replace('{criteria}', f'If an evaluator/tool failure or exhausted budget prevents the gate or an owned observation, return {low} for the unobserved outcome with reason "NOT EXERCISED — evaluator/tool limitation". This is missing evidence, not an observed application failure. Preserve every completed independent observation.\n\n' + '{criteria}')
    write(relp, s)

change('tests/gates/render/prompt.md', '{criteria}', 'If a browser/tool error or exhausted budget prevents observation, return binary0 with reason "NOT EXERCISED — evaluator/tool limitation". Do not describe an unobserved app as broken or claim that authentication failed.\n\n{criteria}')
change('tests/scored/polish/judge.toml', 'then release it and verify successful completion.', 'then release it unchanged. In either the natural or delayed path, the same observed operation must successfully complete; an indefinitely stalled operation earns no loading-state credit.')
rules = read('environment/instructions/hireops_rules.md')
write('environment/instructions/hireops_rules.md', rules.rstrip() + '\n\n## 10. Runtime file paths\n\nThe runtime launches Node from `/tests`, which is not the application directory. It runs as an\nunprivileged user and may launch a writable copy of the submitted application. Resolve bundled UI and\nseed files relative to the entry/module directory or another explicit absolute path, never by assuming\nthe current working directory is `/app`. Honor the supplied `DB_PATH` for persistent storage. The launch\nenvironment contains `PATH`, `HOME`, `NODE_PATH`, `PORT` and `DB_PATH`; do not rely on inherited shell\nvariables. `HOME` points to the writable application copy, and `/app/server.js` remains the submitted entry.\n')

after = {p.relative_to(TASK).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
         for p in TASK.rglob('*') if p.is_file()}
for name, digest in original.items():
    if name.startswith('solution/') or name in {'task.toml', 'environment/Dockerfile', 'tests/Dockerfile', 'tests/test.sh', 'tests/scoring.toml', 'tests/tools/score.py', 'tests/tools/restart_mcp.py', 'environment/instructions/integration.md'}:
        assert after[name] == digest, name
(RUN / 'criterion-repairs.json').write_text(json.dumps({
    'source_before': original, 'splits': splits,
    'functional_criteria': len(parsed['criterion']), 'functional_weight': '45',
    'weight_rounding': 'Equal allocation to eight decimals; final residual preserves each original pool exactly.',
    'changed_files': [name for name in original if original[name] != after[name]],
    'source_after': after
}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'functional_criteria': len(parsed['criterion']), 'functional_weight': 45}))
