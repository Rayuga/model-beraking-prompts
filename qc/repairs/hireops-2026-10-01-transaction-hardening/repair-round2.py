"""Apply reconciled R2 task repairs; refuse an incomplete round or changed source."""
from pathlib import Path
from decimal import Decimal
import hashlib, json, tomllib

ROOT = Path(__file__).resolve().parents[3]
TASK = ROOT / 'projects/hireops-recruiting-operations/hireops-recruiting-operations'
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r2'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = json.loads((RUN / 'manifest.json').read_text())
assert {p.relative_to(TASK).as_posix(): sha(p) for p in TASK.rglob('*') if p.is_file()} == manifest['inputs']['task']
summary = json.loads((RUN / 'summary.json').read_text())
assert summary['valid_reviews'] == 54 and not summary['missing_reviewers']
assert (RUN / 'RECONCILIATION.md').is_file()

def write(rel, value):
    (TASK / rel).write_bytes(value.encode('utf-8'))

def replace(rel, old, new):
    s = (TASK / rel).read_text(encoding='utf-8')
    assert s.count(old) == 1, (rel, old)
    write(rel, s.replace(old, new))

replace('solution/solve.sh',
    "const targets = new Set([process.argv[2], process.argv[2] + '-wal', process.argv[2] + '-shm']);",
    "const targets = new Set([process.argv[2], process.argv[2] + '-wal', process.argv[2] + '-shm']);\n// A fresh installation has no database to reset and needs no process scan.\nif (![...targets].some(target => fs.existsSync(target))) process.exit(0);")

replace('environment/instructions/hireops_rules.md',
    "Anything arriving in a request body is a claim, not a permission. A caller who puts a chosen band, a\nchosen approver, a chosen committed amount, or a chosen clawback figure into the body gets exactly the same\nanswer as a caller who sent none of it: the band and required tier come from the offer's own stored\ncomposition, the approver from the signed-in session, the clawback from the rescission's own stored\neffective date — never from the body.",
    "Client-supplied computed claims are not permissions or authoritative settlement facts. A chosen band,\napprover, committed amount or clawback cannot override the offer's stored composition, the signed-in\nsession, or the valid rescission effective date used by the server. Legitimate editable compensation terms\nand the operator's effective-date input remain ordinary business inputs. An interface may omit computed\nclaims, ignore them and recompute, or reject unsupported/contradictory claims without any settlement\neffects. It must never settle using forged computed claims; its normal supported operation must still work.")

rel = 'tests/scored/functional/judge.toml'
s = (TASK / rel).read_text(encoding='utf-8')
prefix = s.split('[[criterion]]', 1)[0]
rows = tomllib.loads(s)['criterion']
by = {c['id']: c for c in rows}
for c in rows:
    c['weight'] = Decimal(str(c['weight']))

def append(id, text):
    by[id]['description'] = by[id]['description'].strip() + ' ' + text

append('hro_grant', 'Read the units, start and vesting schedule in rendered product details; an authenticated payload alone cannot replace that required display. Expandable details and equivalent percentage/date wording are valid.')
append('hro_signing', 'Read the paid signing remittance in rendered product details; normal responses may corroborate it but cannot replace its display.')
append('hro_referral_creation', 'Read the recipient, separate referred-hire date and at-hire/contingent halves in rendered product details, allowing expandable views and equivalent labels; response-only fields do not satisfy the required display.')
append('hro_referral_clock', 'Read the retention cliff date and vested/contingent amounts in rendered product details; no exact layout or date spelling is required.')

controls = {
    'hro_relocation_approval': 'As the matching working-payment control, observe an actual nonzero signing payment from this successful approval (or an equivalent dedicated approval with nonzero relocation). A successful status transition without any payment write is insufficient. Require payment existence here, not its exact amount or a sibling arithmetic verdict.',
    'hro_relocation_revision': 'As the matching working-payment control, each exclusion observation needs an actual nonzero signing adjustment from a successful revision that changes the signing bonus as well as nonzero relocation. A saved offer with a dead payment writer is insufficient. Require adjustment existence here, independently of the exact signed amount or a sibling arithmetic verdict.',
    'hro_relocation_rescission': 'As the matching working-payment control, observe an actual nonzero signing contra-payment from rescinding a hire with a partially unvested nonzero bonus and nonzero relocation. A status change without a payment write is insufficient. Require contra-payment existence here, not correct clawback arithmetic or a sibling verdict. Fully vested zero-clawback cases may omit a zero row and are not the positive control.'
}
for id, text in controls.items():
    append(id, text)

# Claim variants are additional witnesses of each existing owned result. They do
# not pool unrelated operations into a new all-or-nothing authority criterion.
claim_owners = {
    'hro_intrinsic': 'intrinsic', 'hro_annual': 'annualized intrinsic',
    'hro_runrate': 'run-rate', 'hro_basis': 'approval basis',
    'hro_bands': 'displayed band/tier', 'hro_commitment': 'approval commitment/headroom',
    'hro_grant': 'initial grant units/start/schedule', 'hro_signing': 'initial signing remittance',
    'hro_referral_creation': 'initial referral recipient/components',
    'hro_revision_budget': 'revision replacement commitment/headroom',
    'hro_revision_signing': 'revision signing adjustment',
    'hro_revision_equity': 'replacement grant',
    'hro_release': 'rescission budget release', 'hro_claw': 'signing vesting/clawback',
    'hro_cancel': 'equity retention/cancellation',
    'hro_afterimage': 'approval receipt actor',
    'hro_afterimage_revision': 'revision receipt actor',
    'hro_afterimage_rescission': 'rescission receipt actor'
}
for id, owned in claim_owners.items():
    append(id, f'Apply P5a to any actually observed computed claims for this owned {owned} result; keep credit independent of claims affecting other outcomes. A supported request with no such claims satisfies this conditional authority observation without invented keys.')
for c in rows:
    if c['id'].startswith(('hro_approval_role_', 'hro_revision_role_', 'hro_rescission_role_', 'hro_tier_')) or c['id'] == 'hro_dual':
        append(c['id'], 'In P5a, if the observed request supplies identity/role/tier/band claims, alter only those claims on this otherwise valid control; they cannot override this session-based permission. Absent claims are conforming; do not invent keys or inherit another permission verdict.')

def render(c):
    return '\n'.join(['[[criterion]]', f'id = "{c["id"]}"', f'name = "{c["name"]}"',
        f'type = "{c["type"]}"', f'weight = {c["weight"]}', 'description = """',
        c['description'].strip(), '"""', ''])

assert len(rows) == 145 and sum(c['weight'] for c in rows) == 45
write(rel, prefix + '\n'.join(render(c) for c in rows) + '\n')

rel = 'tests/scored/functional/prompt.md'
s = (TASK / rel).read_text(encoding='utf-8')
old = 'P6 — Budget branches.'
assert s.count(old) == 1
protocol = """P5a — Stored-fact authority, reused within existing owners. Inspect the actual successful UI request shapes already captured for offer creation, approval, revision and rescission. Identify only fields that actually claim a computed result or session authority, such as a displayed total, band, committed amount, signing adjustment, clawback, vested units or acting identity. Raw compensation edits, record identifiers and the legitimate effective-date input are not computed claims. Do not add guessed fields or require a claim-bearing API. If a shape carries no computed claims, record that observed fact and retain credit for its independently correct owned results.

Where claims exist, use a separate otherwise eligible target with known inputs and the same observed operation shape, changing only the relevant computed/authority claim to a conflicting plausible value. Reuse one replay's facts for all affected owners; no Cartesian field combinations are required. The operation must either recompute from legitimate inputs/stored facts and the current session, or safely refuse with unchanged settlement state. Follow a refusal with an ordinary supported successful request on that target so a dead operation cannot earn authority credit. Read persisted results afresh. Do not replay only against already-settled targets. Attribute each result only to its existing owner: intrinsic/annual/run-rate/basis/band display, approval commitment/grant/signing/referral, revision budget/signing/equity, rescission release/claw/cancellation, each action's receipt actor, and the applicable role/tier/dual-control permission. One failed claim must not erase unrelated financial or permission observations. Response statuses alone do not establish recomputation. Missing source-visible internals cannot be inferred; this is a bounded browser-observable protocol, not a claim about every possible private request field.

P6 — Budget branches."""
s = s.replace(old, protocol)
s = s.replace('Read the defined figures through ordinary product views; no particular all-fields layout is required.',
    'Read the defined figures in rendered product views; no particular all-fields layout is required. Required operator-facing financial figures throughout this review must be readable in normal screens or expandable details. Ordinary responses may corroborate these figures and reveal additional records, but cannot substitute for their required display. Transport status, generated identities and security refusal facts may use observed responses.')
s = s.replace('using a successful operation with nonzero relocation as the control.',
    'using a successful operation with nonzero relocation AND an actual nonzero signing payment/adjustment/contra-payment from the matching action family as the control. Payment existence suffices for that control; exact payment arithmetic is independently owned. A lifecycle transition with no payment writer is insufficient; legitimate zero rows may be omitted.')
write(rel, s)

rel = 'tests/scored/polish/judge.toml'
s = (TASK / rel).read_text(encoding='utf-8')
prefix = s.split('[[criterion]]', 1)[0]
rows = tomllib.loads(s)['criterion']
by = {c['id']: c for c in rows}
for c in rows:
    c['weight'] = Decimal(str(c['weight']))
by['hro_pol_preserve_revision']['description'] = by['hro_pol_preserve_revision']['description'].replace(
    'Submit normally and verify', 'Submit normally, observe an understandable visible refusal explanation (native validation or equivalent app wording is valid), and verify').replace(
    'Owns retained revision-editor state and successful recovery only; do not regrade available-budget/shortfall wording,',
    'Owns understandable refusal feedback, retained revision-editor state and successful recovery; no exact available-budget/shortfall wording is required. Do not regrade')
by['hro_pol_change_recovery']['weight'] = Decimal('2.5')
by['hro_pol_change_recovery']['description'] = """First establish a valid ordinary UI coordinated prepare/commit control. On another eligible operation, retain distinctive member selections, destinations and replacement terms, then attempt a genuinely refused commit. Prefer a saved preview invalidated by a separate settlement on a touched requisition while selected sources remain current. If that freshness branch wrongly succeeds, preserve the Functional failure and obtain an independent real refusal by revising a selected source after preview, or by a genuine budget conflict through the same editor. Observe an understandable visible explanation of refusal. The entered member selections, destinations and otherwise valid terms remain available/editable. Correct only the stale/invalid element as necessary, use a new operation key, prepare the current preview and commit successfully without re-entering unchanged values. Owns usable commit-refusal recovery, not freshness enforcement, formulas or a sibling verdict. Native validation/equivalent error wording and explicit refresh/correction controls are valid if they preserve the draft. If no genuine refusal can be observed, give no unobserved recovery credit and report the actual missing evidence."""
rows.insert(rows.index(by['hro_pol_change_recovery']), {
    'id': 'hro_pol_change_prepare_recovery', 'name': 'hro_pol_change_prepare_recovery', 'type': 'binary', 'weight': Decimal('.5'),
    'description': """Establish a valid ordinary UI coordinated preview/commit control. On dedicated current members, enter distinctive valid destinations and compensation terms, then make one different term invalid or the final budget overrun and submit Prepare normally. After an actual refused preparation, show an understandable failure explanation and retain member selections, destinations and otherwise valid entered terms. Native validation and equivalent wording are valid. Correct only the offending input, use a new operation key if necessary, then obtain a saved preview and successful commit without re-entering unchanged values. Owns preparation-stage retention/correction independently of commit-refusal recovery and budget/validation enforcement. Deferring over-budget refusal until commit is allowed; if Prepare accepts that draft, use a genuine malformed-input refusal instead. A dead form cannot earn credit. Do not force impossible text into native controls or require additional input fields."""
})
assert len(rows) == 5 and sum(c['weight'] for c in rows) == 9
write(rel, prefix + '\n'.join(render(c) for c in rows) + '\n')

replace('tests/scored/polish/prompt.md',
    'After refusal retain the bonus and correct only base to an affordable value, then save.',
    'After an understandable visible refusal (native validation or equivalent wording is valid), retain the bonus and correct only base to an affordable value, then save. No exact budget/shortfall copy is required.')
replace('tests/scored/polish/prompt.md',
    'For coordinated stale recovery, prepare two-member terms through ordinary controls. Use another allowed settlement on a touched requisition without changing selected leaves, then commit the old preview. Its refusal must preserve the editor for a new-key preview and successful commit.',
    'For coordinated preparation recovery, first establish a valid UI preview/commit control. On dedicated current members, enter distinctive valid terms and make one other input invalid or the final budget excessive. After a real refused Prepare with understandable visible feedback, the member selections, destinations and otherwise valid terms remain. Correct only the offending input, use a new key if needed, then preview and commit successfully. A genuine native-validation refusal is valid; no forced impossible native input or fabricated response. Budget refusal may legally be deferred until commit; if Prepare accepts that draft, use a genuine malformed-input refusal instead, without inheriting a Functional verdict. For coordinated commit recovery, prepare two-member terms through ordinary controls. Prefer another allowed settlement on a touched requisition without changing selected leaves, then commit the old preview. If this stale branch wrongly succeeds, record the separate Functional failure and obtain a genuine refusal by revising a selected source after another preview or by a real budget conflict through the same editor. An understandable visible refusal must preserve the otherwise valid editor values. Correct only what became stale/invalid, use a new key, preview and commit successfully. Score editor recovery independently of freshness enforcement; do not grant credit without an actual refusal and successful recovery.')

result = {'round': 'R2', 'previous_input_sha256': manifest['input_sha256'],
    'scope': 'Task-specific installer, authority observation, rendered financial detail, recovery independence and matching payment controls. No shared harness/scoring/model/budget changes.',
    'task_sha256': {p.relative_to(TASK).as_posix(): sha(p) for p in TASK.rglob('*') if p.is_file()},
    'counts': {'functional': 145, 'polish': 5, 'visual': 5, 'gates': 2},
    'weights': {'functional': 45, 'coordinated_functional': 28, 'polish': 9, 'coordinated_polish': 6, 'visual': 6}}
(Path(__file__).parent / 'round2-repairs.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'changed': [p for p,h in result['task_sha256'].items() if manifest['inputs']['task'].get(p) != h], 'counts': result['counts']}))
