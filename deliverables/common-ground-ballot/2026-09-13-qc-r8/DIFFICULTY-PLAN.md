# Ballot Difficulty Plan

## What The New Results Mean

The evaluated r7 package scored Oracle 0.9917, GPT 0.9595, Gemini 0.6809,
Haiku 0.2762 and NOP 0. Oracle passed all 19 Functional criteria. Its only
deduction was Visual contrast. GPT passed 18/19; its accepted vote replay
failed after publication and restart. These are completed runs with matching
prompt/judge/runner hashes, not infrastructure-zero attempts.

The fairness corrections did not remove product requirements. They stopped
unrelated failures and missing captures from being counted as additional app
defects. A new model build can also be better than an earlier one. This set of
runs cannot isolate the effect of clearer wording from normal model variation.

## Implemented In The Corrective Package

The existing approval fixtures had equal eligible and participating counts.
That let the wrong denominator pass. The captured GPT app displays 50/0/50
with two eligible Members and one participant, despite saying percentages use
participants. Its database preserves that wrong result after restart.

Functional r8 adds Partial turnout approval to the existing
published_approval_tally criterion: two eligible Members, only Leila voting
Morning and Evening, expected 1/0/1 approvals and 100/0/100 percent. It checks
the rendered and protected result before and after both restarts. The existing
golden passes. An eligible-denominator mutant fails. Criterion count and weights
are unchanged; this does not award multiple penalties for the same calculation.

This fix is not enough to claim GPT is in the 0.1-0.7 band. Holding every other
recorded criterion unchanged and additionally failing this 1.5-weight Functional
criterion gives approximately 0.9274, not a new measured score or forecast.
Do not spend on another model run expecting this correction alone to get <0.7.

## Recommended Next Scope, Not Implemented

These need approval as explicit product requirements before being graded. Keep
the natural brief short, then use exact judge fixtures and independent ownership.

1. **Receipts for all staff mutations.** Extend the current vote-retry promise
   explicitly to create, edit, lifecycle and membership actions. Capture an Open
   success, change the roster and close the ballot, then replay the original Open:
   return the original receipt without reopening, recapturing eligibility or
   adding audit events. Repeat after restart. A separate create-retry case should
   establish one record, not reward the same Open receipt bug twice.
2. **Competing roster updates and downstream snapshots.** Explicitly require
   roster revision checks. Two ordinary Ruth tabs read the same roster revision;
   one activates Owen, the other submits its stale paused state. The stale action
   must not undo the activation or add audit history. A ballot opened next must
   include Owen. A fresh subsequent pause must affect only the following ballot.
   This tests conflict handling through actual eligibility, not just a 409 toast.
3. **Recorded refusal survives changing preconditions.** Explicitly define that
   both success and refusal receipts are durable for each mutation. A premature
   Publish while Open is refused; after a legitimate Close, replay that exact old
   operation and keep the original refusal and Closed state. A fresh operation
   can Publish. Do not force this onto the current brief's vote-only paragraph.

The golden already has generic receipt/revision helpers, making these plausible
extensions, but each full workflow still needs browser tests, isolated negative
controls and a fresh full Oracle run. Do not assume existing implementation is
proof. Keep failed-operation storage private; audit rejection should add no event.

## Calibration And Stop Rule

- Prefer two or three distinct state-transition workflows, not many sibling
  checks for the already-known Published vote replay defect.
- Keep the required 60/20/20 dimension formula and reference configuration.
- Replay the captured model apps locally before paying for a new build; separate
  diagnostic source-aware probes from the black-box judge's actual evidence.
- Freeze the exact ZIP and run platform QC and Oracle before interpreting new
  model scores. Preserve every run, including judge/setup failures.
- No score band is guaranteed. If strong, fairly graded apps continue to pass,
  revise the product scope with the lead or move on rather than hiding requirements.
