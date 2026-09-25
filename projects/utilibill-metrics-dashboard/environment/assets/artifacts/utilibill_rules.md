# UtiliBill desk contract

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
