# Live-desk round 1 reconciliation

**BLOCKED.** Single-per-row round on input `ac48a4ed…`. 53 quality reports and the deterministic report were returned; the pipeline counts 53 valid of 54 because row 34's reviewer did not attest reading the template, so that report is invalid and is not replaced. Original reports are unchanged.

## Fails (all accepted and fixed in the next candidate)

- Row 26: the live out-of-date mark's correctness and the commit-cannot-override-saved-intent rule had no owning criterion. `hro_live_stale_mark` now owns what the open desk displays (arrival, still marked after the balance is restored, not marked by non-invalidating events); `hro_change_intent_key` now owns the B3 commit replay.
- Row 27: `hro_referral_creation` required the referred-hire start on screen, which the display rule did not ask for. Rules section 9 now asks for it.
- Row 30: `hro_change_aba` could pass on an app whose commit never succeeds. It and four weaker rows now name a successful commit or action as the control.
- Row 32: three audit rows said "immutable" with no probe (word removed; immutability stays with the history rows); `browser_run_code` naming made consistent.
- Row 33: `hro_revision_role_recruiter` and `hro_pol_focus` each had two bars; each now has one.
- Row 44: desk rows outweighed access control. Desk rows reduced (largest now 2.5), access-control rows doubled (family 7.8). Functional total 64.4.

## Notes acted on

Rows 4 and 6 (revision form pre-fill and money entry unit now stated in the rules), row 31 (what-if sampled witnesses stated; referral count scoped to the P4 offer), row 18 (receipt card now shows old/new base, signing and relocation; member audit lines report every requisition of the transaction), deterministic (rules line 20 reworded; integration.md line endings).

## Not acted on

Row 1 (optional voice tidy), row 40's suggestion to re-home a recovery row into Polish (Polish time budget), and the template-level notes on image pinning.

## Missing measurements

Rows 11, 40 and 42 are Not exercised: no configured judge run, reward-discrimination run or judge-duration measurement exists. These block clearance and cannot be fixed locally.
