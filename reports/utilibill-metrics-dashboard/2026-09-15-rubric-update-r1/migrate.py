import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TASK = ROOT / 'projects/utilibill-metrics-dashboard'
REF = ROOT / 'projects/common-ground-ballot'

def put(rel, text):
    p = TASK / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text.strip() + '\n', encoding='utf-8', newline='\n')

def edit(rel, old, new):
    p = TASK / rel
    text = p.read_text(encoding='utf-8')
    assert text.count(old) == 1, (rel, old[:80], text.count(old))
    p.write_text(text.replace(old, new), encoding='utf-8', newline='\n')

put('task.toml', '''schema_version = "1.4"
artifacts = ["/app"]

[task]
name = "turing/utilibill-metrics-dashboard"
version = "1.0.0"
description = "Authenticated energy-retail billing and settlement dashboard with tiered and time-of-use tariffs, regulatory riders, recurring catch-up corrections, net-metering banks, budget plans and dual-control approvals. Five browser dimensions evaluate the delivered Node.js, Express and SQLite application."
keywords = ["webdev", "turing", "full-stack", "nodejs", "express", "sqlite", "billing", "settlement"]

[metadata]
difficulty = "hard"
difficulty_explanation = "Correctness depends on composing separate rider bases, metered rate-change boundaries, successive corrections against live prior bills, a carried credit bank, anniversary settlement and session-derived authorization. Stateful browser journeys verify durable amounts and refusals against their own positive controls."
category = "programming"
tags = ["full-stack", "browser", "arena", "rl-training"]
provenance = "Original UtiliBill fictional energy-retail contract and roster, revised against the September 15 task-implementation.txt authoring rubric."
arena_slice = "full-stack-node-express-sqlite-billing"

[agent]
timeout_sec = 7200.0

[environment]
build_timeout_sec = 600.0
network_mode = "public"
cpus = 2
memory_mb = 4096

[verifier]
timeout_sec = 13200.0
environment_mode = "separate"

[verifier.env]
OPENAI_API_KEY = "${OPENAI_API_KEY}"
REWARDKIT_JUDGE = "codex"
REWARDKIT_MODEL = "gpt-5.6-luna"
REWARDKIT_REASONING_EFFORT = "max"

[verifier.environment]
network_mode = "public"
''')

for rel in ['environment/Dockerfile', 'tests/Dockerfile', 'tests/prompt-provenance.py']:
    put(rel, (REF / rel).read_text(encoding='utf-8').replace('common-ground-ballot','utilibill-metrics-dashboard'))
put('instruction.md', '''# UtiliBill billing and settlement dashboard

can you build me a polished full-stack billing and regulatory-settlement back office for our energy retail desk? I need a real backend and persistent storage. Include our five demo logins and show the signed-in person's name and role.

Let me move between Dashboard, Accounts, Settlement, and Audit. As the billing operator I need to bill metered cycles, run annual budget true-ups, and finalize billed cycles into a settlement period. As the meter-data analyst I need to review our stored reads and raise a correction when a later actual read replaces an estimate or corrects a previous re-bill. As either settlement controller I need to approve large corrections and release remittances. Our rate administrator should be able to review the supplied tariffs and the already-active rate change throughout the applicable billing details; I don't need a rate editor.

Show how each figure was calculated: energy, each rider, export credit, the credit bank, deferred balances, correction amounts and remittances. Keep historical bills and audit entries intact. Every successful change must survive a reload, a fresh sign-in and a server restart. Hide protected information when signed out, and enforce each role's permissions on the server.

Give the desk a clear visual hierarchy, readable figures and consistent styling in light and dark modes. It should work on a phone as well as a desktop, with labelled controls, keyboard access, visible focus, comfortable touch targets and respect for reduced motion. Opening account details and completing or refusing an action should give clear, current feedback; avoid duplicate submissions while a request is pending.

The exact contract is in `/assets/artifacts/utilibill_rules.md`, and the starting roster is `/assets/artifacts/utilibill_seed.json`. Follow those supplied terms, including their rounding and reference date. These are our fictional contract rates. Keep the supplied record IDs and copy any needed reference data into your application during the build.

Put the app in `/app`, using Node.js, Express and SQLite. It must start from `/app` with `node /app/server.js`, listen on port `3000`, serve the UI from `/app/public/index.html`, and return a successful `GET /api/health` when ready. Store durable records in `/app/utilibill.db`, honouring `DB_PATH` if provided. The runtime receives the `/app` artifact; `/assets` and `/instructions` are build-time inputs and may be absent at startup. Express and better-sqlite3 are already installed. Public networking is available. Add `/app/APP_MANIFEST.md` with the startup command, database location and a short guide to the workspaces.

Every demo account uses password `Utilibill!2026`:

- `anaya.rao@utilibill.example` — Anaya Rao, meter-data analyst
- `owen.price@utilibill.example` — Owen Price, billing operator
- `rhea.tan@utilibill.example` — Rhea Tan, rate administrator
- `cira.lund@utilibill.example` — Cira Lund, settlement controller
- `cyrus.okafor@utilibill.example` — Cyrus Okafor, settlement controller
''')
put('environment/instructions/runtime.md', '''# Runtime

Build in `/app`. Start with `node /app/server.js` from `/app`, on port 3000.
Use `/app/public/index.html` for the UI and SQLite at `/app/utilibill.db`, or the supplied `DB_PATH`.
`GET /api/health` must succeed once ready. Only `/app` is retained as the application artifact.
Copy required reference data into `/app` during implementation; `/assets` and `/instructions` may be absent at runtime.
Express 5.1.0 and better-sqlite3 12.4.1 are installed globally with NODE_PATH configured.
Public networking is available. The supplied rates and stored reference moment govern all business calculations.
''')

put('environment/assets/artifacts/utilibill_rules.md', '''# UtiliBill desk contract

These are the energy retail desk's authoritative fictional contract terms. The supplied roster contains the meter feed and the starting ledgers. Remittance acknowledgements may be generated locally; no utility or settlement-service account is required.

## People and authority

All five users may read Dashboard, Accounts, Settlement and Audit. Show the authenticated person's name and role. Anaya Rao is the meter-data analyst; Owen Price is the billing operator; Rhea Tan is the rate administrator; Cira Lund and Cyrus Okafor are distinct settlement controllers with identical permissions. Each user has exactly one role.

| Action | Permitted role |
|---|---|
| Bill a metered cycle | Billing operator |
| Review a stored actual read and raise its catch-up correction | Meter-data analyst |
| Approve a held correction | Settlement controller, distinct from the raiser |
| Run an annual budget true-up | Billing operator |
| Finalize billed cycles into a period | Billing operator |
| Release a remittance | Settlement controller |
| Review tariffs and the supplied active rate change | All signed-in roles |

The rate administrator has no money-writing permission. Read review uses the supplied meter feed; a meter editor and a rate editor are outside this desk's scope.

The server determines identity and role from its authenticated session. Reject wrong passwords and unauthenticated protected reads and writes. Signing out revokes that session and removes protected content from the screen. Refuse a role-ineligible write with 403. Refuse invalid state transitions with a 4xx response, preserving all business records. Do not present forbidden actions as available controls.

Record identifiers and selections are ordinary request data. Ignore extra client claims such as `role`, `actor_id`, `approver_id`, `approved_by`, `approved`, `amount` or derived totals: an otherwise valid authorized action still succeeds using the real session and stored inputs. Such extra fields cannot grant permission, choose a different approver, alter a calculation or bypass a state restriction. Do not reject an otherwise valid request solely for these extra claims.

## Reference data and units

Seed the supplied IDs once, retaining subsequent state. The stored reference moment is `2026-08-15T09:00:00Z`; compare business timestamps with it, never today's date. Supplied meter reads are available for processing even where a cycle's end is later than that reference moment. Every time window is half-open `[start,end)`.

Money is integer cents, percentage rates are integer basis points, volume is whole kWh, and sub-cent rates are hundredths of a cent per kWh. Display money as dollars and cents and label units. Round half-up once at each monetary line: `floor(x + 0.5)`. Preserve intermediate bases so the desk can inspect the calculations.

## Metered bills

A normal actual read becomes one cycle bill, including energy, fixed charge, riders and the total. Reject duplicate billing without creating another bill, rider accrual, bank movement or business audit entry. A catch-up actual read is processed by the analyst's correction workflow, not normal cycle billing.

Tiered energy uses fresh blocks on each cycle: the first 400 kWh at 8 cents/kWh, the next 500 kWh at 13 cents/kWh, and usage above 900 kWh at 20 cents/kWh. Do not carry tier consumption between cycles or apply a single marginal rate to all usage.

Time-of-use energy uses the stored meter buckets. Peak is 30 cents/kWh before `2026-07-10T18:00:00Z` and 34 cents/kWh at or after that instant. Shoulder is 16 cents/kWh; off-peak is 9 cents/kWh. The meter explicitly records peak usage before, exactly at and after the change. Charge those measured sub-periods at their effective rates; elapsed days do not allocate consumption. Show the effective instant, both peak rates and the measured split.

Each normal cycle bill has a fixed charge of 1200 cents. RPS is 400 basis points of gross delivered energy charge before any export credit. SBC is 90 hundredths of a cent per gross delivered kWh. GRT is 250 basis points of the receipt base: energy after credit, plus fixed charge, RPS and SBC; this base excludes GRT itself. The bill total is that base plus GRT. Persist separate RPS, SBC and GRT accruals with their amounts and bases.

## Net-metering bank

For a net-metering account, current exported kWh earns 650 hundredths of a cent per kWh. Add this credit to the sum of existing bank movements. Apply the available credit to energy only, up to the gross energy charge. Fixed charges and riders remain payable. RPS still uses gross energy and SBC still uses gross delivered kWh; GRT uses the resulting net energy in its receipt base.

The new bank is the remaining available credit after this energy offset. Append a movement equal to new bank minus previous bank. It can increase or decrease; when available credit exactly covers energy, the new bank is zero and the movement consumes any previous bank. Never pay out the excess or subtract export kWh before calculating the gross riders. A later bill uses all earlier persisted movements, including bills from this session.

Show exported kWh, the credit rate and amount, prior bank, available credit, energy offset, remaining energy, the new bank and its movement history.

## Catch-up corrections

A later actual read reveals a total over the listed accrual cycles. Allocate that total in proportion to those cycles' stored baseline weights, then re-bill each accrual cycle on its own fresh tier blocks. The supplied allocations are all whole kWh. These correction bills are energy-only; do not add fixed charges or regulatory riders to the correction base.

Use each cycle's most recent live, non-superseded bill as the prior bill. Retain the prior amount and record its supersession link. Where a prior exists, append a contra equal to re-billed energy minus that prior bill's energy. Where none exists, create the first re-bill with no contra row, including no zero-valued placeholder. A subsequent correction uses the live figure left by the preceding correction; earlier generations stay on file.

When any absolute contra exceeds 10000 cents, hold the entire correction batch pending approval. Until approval, no prior bill is superseded and no contra is posted. A distinct settlement controller releases the batch, recording the real raiser and real approver. Both named controllers have the same authority. At or below the threshold, post the correction immediately. Reject repeat raises or repeat approvals without new business rows.

Show the actual read, baseline weights, per-cycle allocated usage and tier calculation, re-billed energy, retained prior bill and status, contra amount or absence, batch energy sum, approval state, raiser and approver. Clearly distinguish a proposed contra from one already posted.

## Budget plans

For each supplied historical budget cycle, the customer paid the plan's original levelized amount; the deferred movement is actual bill minus that amount. Sum those movements and subtract settled annual true-ups to derive the current deferred balance.

At or after the account's stored enrollment anniversary, the operator can settle the entire deferred balance and reset the levelized amount to the trailing twelve actual bills' sum divided by twelve, rounded half-up. Before the anniversary, refuse the action. Reject a repeat annual true-up for the same supplied anniversary. Historical movements retain the levelized amount that applied when they accrued.

Show the original per-cycle amounts and movements, their total, the current levelized amount, anniversary, reference moment, settlement and new levelized amount. Harnby Row is eligible at the supplied reference moment; Pelham Gate is not yet eligible.

## Finalization and remittance

The operator selects billed cycles for a settlement period. Finalize that selection atomically: refuse empty, duplicate, unknown, already-finalized or otherwise unbilled selections without partial changes. A cycle belongs to at most one settlement period. A pending correction is not a posted bill and cannot be finalized.

Finalized and remitted cycles are locked against billing and corrections, including a later actual read whose accrual set contains a locked cycle. A correction awaiting approval must not bypass that lock. Show locked status and refuse prohibited server writes.

A controller releases a nonempty period by summing that period's own RPS, SBC and GRT accrual rows, saving each rider total, the combined remittance and an acknowledgement. Mark the period and its finalized cycles remitted. Reject a second release or adding cycles to a remitted period without changing balances, records or business activity. Base energy and fixed charges are not remittance amounts.

## Audit and screens

Append an audit entry for each successful bill, correction raise/post, approval, annual budget true-up, finalization and remittance, recording the actual actor, action, affected record, reference timestamp and computed amount (or selected cycle count for finalization). No role can edit or delete audit history. Refused business writes do not add successful business activity. Authentication activity may be recorded separately.

Dashboard shows current totals and recent activity. Accounts lets the desk find every supplied account and inspect its cycles, reads, bills, credits, budget plan and corrections. Settlement shows selected cycles, rider sums and released remittances. Audit shows the retained history. Figures must be present in the usable UI with their calculation details, not only in API responses or explanatory prose. Each successful action updates the affected screen immediately and stays correct after reload, a fresh sign-in and a real server restart.
''')

seed = json.loads((TASK/'environment/assets/artifacts/utilibill_seed.json').read_text(encoding="utf-8"))
seed.pop('hardening_revision', None)
seed.pop('task_version', None)
seed['generated_note'] = 'UtiliBill opening roster and meter feed. Use the accompanying desk contract for rates, permissions and accounting treatment.'
for a in seed['accounts']:
    a['note'] = ''
for p in seed['settlement_periods']:
    p['note'] = ''
seed['settlement_periods'][1]['label'] = 'Fennimore Yard remittance'
for month, label, kwh in [(2,'FEB',70),(3,'MAR',80),(4,'APR',90),(5,'MAY',100)]:
    cid=f'CY-C11-{label}'
    if not any(c['id']==cid for c in seed['cycles']):
        seed['cycles'].append(dict(id=cid, account_id='ACCT-C11',label=label,window_start=f'2026-{month:02}-01T00:00:00Z',window_end=f'2026-{month+1:02}-01T00:00:00Z',baseline_weight=10,status='OPEN'))
        seed['meter_reads'].append(dict(id=f'MR-C11-{label}',cycle_id=cid,kind='ACTUAL',delivered_kwh=kwh,exported_kwh=0))
for rel in ['environment/assets/artifacts/utilibill_seed.json','solution/src/seed_data.json']:
    put(rel,json.dumps(seed,indent=2))

put('solution/APP_MANIFEST.md', '''# UtiliBill

Run `node /app/server.js` from `/app`. The app listens on port 3000 and reports readiness at `/api/health`.
SQLite defaults to `/app/utilibill.db`; `DB_PATH` selects an alternative file. The seed is embedded in `src/seed_data.json` and initializes an empty database once. No `/assets` directory is needed at runtime.

Sign in with a demo account from the brief. Dashboard shows totals and policy details. Accounts contains the per-account detail panels, bill and correction actions, banks and budget plans. Settlement contains the operator's cycle selection and the controller's remittance action. Audit retains business history. Each role sees only its permitted write controls.
''')
put('solution/solve.sh','''#!/bin/bash
set -euo pipefail
SOURCE="$(cd -- "$(dirname -- "$0")" && pwd)"
mkdir -p /app/public/js /app/src
cp "$SOURCE/package.json" "$SOURCE/server.js" "$SOURCE/APP_MANIFEST.md" /app/
cp -r "$SOURCE/src/." /app/src/
cp -r "$SOURCE/public/." /app/public/
''')
edit('solution/src/db.js', "const DATA_DIR = process.env.UTILIBILL_DATA_DIR || path.join(__dirname, '..', 'data');", "const DATA_DIR = path.dirname(process.env.DB_PATH || path.join(__dirname, '..', 'utilibill.db'));")
start=(TASK/'solution/src/db.js').read_text(encoding="utf-8").index('const SEED_PATH =')
end=(TASK/'solution/src/db.js').read_text(encoding="utf-8").index('const ROSTER =',start)
text=(TASK/'solution/src/db.js').read_text(encoding="utf-8")
put('solution/src/db.js',text[:start]+"const SEED_PATH = path.join(__dirname, 'seed_data.json');\n"+text[end:])
edit('solution/src/rules.js', '''db.prepare("SELECT * FROM bills WHERE cycle_id=? AND kind='ESTIMATE'").get(c.id) ||
      db.prepare("SELECT * FROM bills WHERE cycle_id=? AND kind='REBILL' AND superseded=0 ORDER BY created_at DESC, id DESC LIMIT 1").get(c.id) ||''', '''db.prepare("SELECT * FROM bills WHERE cycle_id=? AND kind IN ('ESTIMATE','REBILL') AND superseded=0 AND state IN ('ISSUED','BILLED','APPROVED') ORDER BY rowid DESC LIMIT 1").get(c.id) ||''')
edit('solution/src/index.js', "  const already = one(\"SELECT * FROM bills WHERE cycle_id=? AND kind='REBILL'\", c.id);", """  const locked = t.legs.find(leg => ['FINALIZED', 'REMITTED'].includes(one('SELECT status FROM cycles WHERE id=?', leg.cycle_id).status));
  if (locked) return fail(res, 409, `accrual cycle ${locked.cycle_id} is locked`, { cycle_id: locked.cycle_id });
  const held = t.legs.find(leg => one("SELECT id FROM bills WHERE cycle_id=? AND state='PENDING_APPROVAL'", leg.cycle_id));
  if (held) return fail(res, 409, `accrual cycle ${held.cycle_id} has a pending correction`, { cycle_id: held.cycle_id });
  const already = one("SELECT * FROM bills WHERE kind='REBILL' AND json_extract(breakdown,'$.trueup_actual_cycle')=?", c.id);""")
edit('solution/src/index.js', "      created.push(rebillId);", "      created.push(rebillId);\n      if (!t.needs_approval) db.prepare(\"UPDATE cycles SET status='BILLED' WHERE id=?\").run(leg.cycle_id);")
edit('solution/src/index.js', '  const raiser = pending[0].raised_by;', '''  const locked = pending.find(rb => ['FINALIZED', 'REMITTED'].includes(one('SELECT status FROM cycles WHERE id=?', rb.cycle_id).status));
  if (locked) return fail(res, 409, `accrual cycle ${locked.cycle_id} is locked`, { cycle_id: locked.cycle_id });
  const raiser = pending[0].raised_by;''')
edit('solution/src/index.js', "      const bd = JSON.parse(rb.breakdown || '{}');", "      const bd = JSON.parse(rb.breakdown || '{}');\n      db.prepare(\"UPDATE cycles SET status='BILLED' WHERE id=?\").run(rb.cycle_id);")
edit('solution/src/index.js', "  audit(req.user.id, 'TRUEUP_APPROVED', c.id, String(req.user.id));", "  audit(req.user.id, 'TRUEUP_APPROVED', c.id, JSON.stringify({ contra_cents: pending.reduce((sum, rb) => sum + JSON.parse(rb.breakdown).contra_cents, 0), approver_id: req.user.id, raiser_id: raiser }));")
edit('solution/src/index.js', '  const finalized = [];', '''  if (new Set(ids).size !== ids.length || ids.some(cid => typeof cid !== 'string')) return bad(res, 'select distinct cycle IDs', 400);
  const invalid = ids.find(cid => {
    const cycle = one('SELECT * FROM cycles WHERE id=?', cid);
    return !cycle || cycle.status !== 'BILLED' || one("SELECT id FROM bills WHERE cycle_id=? AND state='PENDING_APPROVAL'", cid) || one('SELECT id FROM period_cycles WHERE cycle_id=?', cid);
  });
  if (invalid) return fail(res, 409, `cycle ${invalid} is not available for finalization`, { cycle_id: invalid });
  const finalized = [];''')
edit('solution/src/index.js', "      if (!c || c.status !== 'BILLED') continue;", "      if (!c || c.status !== 'BILLED') throw new Error('cycle changed during finalization');")
edit('solution/src/index.js', "  audit(req.user.id, 'PERIOD_FINALIZED', p.id, finalized.join(','));", "  audit(req.user.id, 'PERIOD_FINALIZED', p.id, JSON.stringify({ cycle_ids: finalized, cycle_count: finalized.length }));")
edit('solution/src/index.js', "app.use('/api/audit', (req, res)", "app.use('/api/audit', auth(), (req, res)")

edit('solution/public/js/utilibill.js', "      decoy ? el('span', { class: 'decoy', text: `not this — ${decoy}` }) : null,", '')
edit('solution/public/js/utilibill.js', 'Desk tables (stated synthetic constants)', 'Tariffs and contract rates')
edit('solution/public/js/utilibill.js', "  nodes.push(kv('Energy charge', b.energy_display));", '''  const detail = b.breakdown || {};
  if (detail.tou) {
    nodes.push(kv(`Peak (${detail.tou.peak_old_kwh} kWh @ ${detail.tou.peak_old_rate}¢ + ${detail.tou.peak_new_kwh} kWh @ ${detail.tou.peak_new_rate}¢)`, money(detail.tou.peak_cents)));
    nodes.push(kv('Rate change effective', detail.tou.rate_change_effective_at));
    nodes.push(kv('Usage exactly at change (new rate)', `${detail.tou.peak_boundary_kwh} kWh`));
    nodes.push(kv('Shoulder', money(detail.tou.shoulder_cents)));
    nodes.push(kv('Off-peak', money(detail.tou.offpeak_cents)));
  }
  for (const t of detail.tiers || []) nodes.push(kv(`Tier ${t.tier} (${t.kwh} kWh @ ${t.rate}¢)`, money(t.cents)));
  nodes.push(kv('Energy charge', b.energy_display));
  if (detail.net_metering) {
    nodes.push(kv('Export credit earned (6.50¢/kWh)', money(detail.export_credit_cents)));
    nodes.push(kv('Prior bank', money(detail.prior_bank_cents)));
    nodes.push(kv('Available credit', money(detail.available_credit_cents)));
    nodes.push(kv('New bank after this bill', money(detail.new_bank_cents)));
  }''')
edit('solution/public/js/utilibill.js', "nodes.push(kv('Superseded prior bill', `${bd.estimate_bill_id} (retained on file, figure intact)`));\n    nodes.push(kv('Contra posted', money(bd.contra_cents)));", "nodes.push(kv(b.state === 'PENDING_APPROVAL' ? 'Prior bill awaiting supersession' : 'Superseded prior bill', `${bd.estimate_bill_id} (retained on file, figure intact)`));\n    nodes.push(kv(b.state === 'PENDING_APPROVAL' ? 'Proposed contra (held)' : 'Contra posted', money(bd.contra_cents)));")
edit('solution/public/js/utilibill.js', '  const cycleBills = (cycle.bills || []).filter', '''  for (const prior of (cycle.bills || []).filter(b => b.kind === 'ESTIMATE')) {
    nodes.push(kv(`Retained estimate · ${prior.id}`, `${prior.total_display} · ${prior.state}`));
  }
  const cycleBills = (cycle.bills || []).filter''')
edit('solution/public/js/utilibill.js', '${m.movement_display ? b.current_levelized_display : \'\'}', '${money(m.levelized_cents)}')
edit('solution/public/js/utilibill.js', 'openDetail(`${a.id} · ${a.name}`, accountDrawerNodes(a, H, role));', '''openDetail(`${a.id} · ${a.name}`, () => {
      const current = STATE.boot.accounts.find(item => item.id === a.id);
      return accountDrawerNodes(current, H, STATE.user.role);
    });''')
text=(TASK/'solution/public/js/utilibill.js').read_text(encoding="utf-8")
start=text.index("      nodes.push(el('div', { class: 'row' }, [el('button', {",text.index('function renderSettlement'))
end=text.index("    }\n    if (p.status === 'OPEN'",start)
text=text[:start]+'''      nodes.push(el('div', { class: 'row' }, [actionButton('Finalize selected (billing operator)', 'POST', `/api/periods/${p.id}/finalize`, () => {
        const cycle_ids = Object.keys(checks).filter(k => checks[k]);
        if (!cycle_ids.length) { flash('Select at least one billed cycle to finalize.', 'error'); return false; }
        return { cycle_ids };
      })]));
'''+text[end:]
put('solution/public/js/utilibill.js',text)
edit('solution/public/js/utilibill.js', "searchInput.addEventListener('keyup'", "searchInput.addEventListener('input'")

for rel in ['solution/.gitignore','solution/package-lock.json','tests/coverage.json','tests/assets/artifacts/utilibill_seed.json']:
    (TASK/rel).unlink(missing_ok=True)

print('Task contract, runtime configuration and golden domain repairs written.')
