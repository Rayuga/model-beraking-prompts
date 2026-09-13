# Common Ground Ballot: Judge Reliability Update

Upload `common-ground-ballot.zip`. It contains one `common-ground-ballot/` folder with 36 files. Task version remains 1.0.0; Functional prompt is r6 and Polish is r3. There are still 33 criteria: Render 2, Constraints 2, Functional 19, Polish 4, Visual 6. All criterion ids and weights, product instructions, configuration, seed and server logic are unchanged.

## Changes

- Exact independent draft fixtures, actual field-value evidence and native-validation handling replace vague invalid-form attempts.
- Save each exchange before asserting; keep actors and contexts separate and do not lose successful evidence when another probe fails.
- Scope receipt/duplicate/mismatch checks to their own ballot. Do not penalize eligibility because an eligible person's approval input was wrongly accepted.
- Recheck visible single-choice and approval results after both existing restarts. Result criteria own those tallies; the durable criterion owns sessions, records and receipts, avoiding triple penalties for a tally-only defect.
- Give mobile turnout emails their full text column and move the participation badge below them.
- Remove the judge's invented 44px touch-target cutoff; grade the brief's actual usability requirement with observable touch interaction and spacing.

## Evidence

- Current golden browser suite: 15/15 local groups, including two real restarts, exact Results UI totals, both themes and desktop/mobile checks; no browser errors.
- Captured Oracle app rejects all exact invalid-draft fixtures locally; the valid control creates one draft and one audit event. Its vague platform failure is not reproducible from the exported evidence.
- Actual rebuilt verifier image passes discovery of all 33 criteria, syntax/runtime and submission-UID isolation checks. Image tag: `ballot-verifier:20260912-judge-r4`.
- `standard-checks.json`, `package-audit.json`, `source-hashes.json`, `prompt-provenance.json`, `changes.diff` and external `coverage.json` document the package.
- Screenshots include `mobile-turnout.png`, desktop and dark/mobile views. The mobile turnout image was visually inspected.

The first isolation test used a Windows bind mount for /tests, which bypassed image ownership. It failed the expected permissions assertion. Rebuilding the exact image and testing its COPY/chmod-installed /tests passed; no isolation assertion was weakened.

## Scores And Limits

The previous r5 upload recorded Oracle 0.9595 (18/19 functional), GPT 0.7393, Gemini 0.6536, Haiku 0, NOP 0. All runs completed. See `reports/common-ground-ballot/2026-09-12-r5-review/` for the audit and source-aware disposable probes.

GPT genuinely normalizes invalid inputs and multiplies seeded votes on restart. Its isolated eligibility and cross-ballot refusals worked, so those apparent failures cannot be used to manufacture a lower score. A proposed extra-field voting probe was rejected as unfair and is not shipped. These fixes can increase some scores; no score below 0.7 is promised.

No full paid Oracle, model rerun or platform QC was run for this new package. Local passes do not establish Oracle 1.0. Run platform QC and Oracle first; investigate any remaining missing-evidence failures before spending on another model build. Historical exports and previous ZIPs were not modified.
