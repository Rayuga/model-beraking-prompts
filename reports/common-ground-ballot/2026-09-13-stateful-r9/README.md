# Common Ground Ballot: Stateful Workflow Update

## Status

Prepared for a fresh platform review, not certified by a new platform run.
No paid Oracle or model generation was started.

The user approved the three follow-on product requirements in the previous
difficulty plan. Functional prompt r9 implements them; task version remains
1.0.0 under the current lead template. Public networking, central judge
configuration, timeouts and the 60/20/20 reward formula are unchanged.

## What Changed

- Durable operation receipts now explicitly cover create, edit, lifecycle and
  membership actions, not just votes. Their original status and body must replay
  without undoing later work or duplicating audit.
- Membership writes must use the viewed revision, including a pause/reactivate
  race where the active value returns to its original state. Accepted membership
  then determines two different future eligibility snapshots.
- Well-formed authorized stale-revision and wrong-state refusals are remembered
  through later changes and restart. A fresh operation is a new attempt.

Only ballots.md, privacy.md, Functional judge.toml and Functional prompt.md changed
from the corrective r8 archive. The golden source and seed are byte-identical.
No existing criterion was removed, reworded or reweighted.

## Criteria

| Dimension | Criteria |
| --- | --- |
| Render | 2 |
| Constraints | 2 |
| Functional | 22 |
| Polish | 4 |
| Visual | 6 |
| Total | 36 |

Three new independent workflow groups each carry Functional weight 2.0.
The original Functional weight 28 remains intact; the new total is 34.
Seven successful staff operations are one group, not seven duplicate penalties.

## Local Evidence

- 115 canonical configuration checks.
- 27 golden browser regression groups, including two actual process restarts.
- 15 launch/reward harness tests with an explicitly labeled local judge stub.
- Five runtime groups, including real RewardKit discovery of all 36 criteria,
  native SQLite dependencies and unprivileged submission boundaries.
- Six deliberate backend defects detected at their intended checkpoints.
- Final agent and verifier images built; instruction/seed and prompt hashes checked.
- Desktop/mobile screenshots inspected and five dark-theme contrast targets tested.
- All 53 supplied rubric-review points assessed locally in QC-REVIEW.md.

These are not a provider-backed Oracle score, a platform static pass, or a 53/53
platform rubric result. Golden Visual 1.0 and the full remote judge runtime are
still unconfirmed.

## Captured Model Diagnostics

Preserved r7 GPT, Gemini and Haiku apps were copied into disposable no-network
containers. Their source hashes did not change. Ordinary stale roster actions
were accepted in all three, with no operation or viewed-revision mechanism in
the actual membership request. GPT also creates a second identity on exact
create replay, refuses an earlier Open after publication, and recomputes a
premature Publish refusal after Close. The last two behaviors persisted after
a process restart.

These are NEW-scope diagnostics. The old brief did not promise staff receipt
or membership revision behavior. They must not be reported as extra failures
of the historical runs. Gemini/Haiku diagnostics here cover the roster only;
their complete new receipt workflow was not evaluated.

The historical r7 scores remain Oracle 0.9917, GPT 0.9595, Gemini 0.6809,
Haiku 0.2762 and NOP 0. None is a score for this ZIP.

## Calibration Limit

Do not assume these additions put a new GPT build below 0.7. An illustrative
calculation that keeps the old GPT quality scores, also detects the r8 approval
denominator defect, and fails all three new groups would still be about 0.8328.
That is neither an official rescore nor a prediction: the old build never saw
the new requirements, and a fresh build may implement them.

Run platform QC and Oracle on the frozen ZIP before interpreting new model
scores. If the lead requires a verified lower model band before delivery,
this package is not yet a completed delivery. Do not manufacture failures,
inflate overlapping weights or hide requirements to meet that band.

## Upload

Upload common-ground-ballot.zip only. It has one common-ground-ballot/ wrapper
containing 36 task files. Coverage, reports, local probes and hashes stay beside
the ZIP, not inside the task. Previous releases and run exports are preserved.

