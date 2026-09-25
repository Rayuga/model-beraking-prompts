# Pellmoor static weight correction

The latest uploaded r9 package failed one of the platform's 45 static checks:
`check-rubric-schema.py` rejected the two `[judge].weight = 0.0` values. Both
Render and Constraints require a strictly positive judge weight. The earlier
repair interpreted final gate contribution as a judge weight; that was incorrect.

## Correction

- Restore Render and Constraints judge weights to **1.0**, matching the valid reference configuration.
- Remove `tests/rewardkit-compat.py`, its image-build invocation and its provenance entry. Native RewardKit scoring is sufficient with positive weights.
- Set `tests/reward.toml` to `reward = []`. This disables the framework's intermediate aggregate and removes duplicate numeric weight maps.
- Keep the exact existing final scoring block in `tests/test.sh`. It alone creates the final reward: either nonpositive gate makes it zero; otherwise the result is 0.6 Functional + 0.2 Polish + 0.2 Visual.
- Document these separate roles in `tests/SCORING.md`. Positive judge weights preserve dimension scores; Render and Constraints do not contribute points to the final sum.
- Make upload preflight reject nonpositive, boolean and nonfinite judge weights. Five negative fixtures reproduce both reported zeros and three other invalid weights.

There is no unused composition table or new scorer implementation. The task
configuration, timeouts, models/effort, golden source, all 60 criteria and every
prompt are byte-for-byte unchanged from r9. Its requirement alignment, balanced
Functional weights, simplified evidence workflow and persisted-note prerequisite
for Polish/Visual remain intact. The canonical seed and generated verifier copy
remain equal.

## Verification

The final archive passed **141 standard checks and 413 archive checks**. Five
deliberately invalid-weight archives were rejected by the new schema guard.
These are local checks; the external platform's 45-check result is pending.

The native pinned RewardKit was exercised against the frozen r10 task in the
cached local runtime. Its runner, reward aggregation and model-schema files
matched their installed wheel records; no scoring source patch was applied.
**119 runtime/final-score cases passed**, including all five judges running,
each of the 60 individual criterion failures, each partial gate, full gate
failures, mixed scores, absent/malformed values and the exact shipped zero-score
fallback. RewardKit emits only five dimension keys; the final scoring stage adds
the reward. These use explicit synthetic judge-boundary inputs and are not
Oracle scores.

All **14 golden workflow groups passed in 58.4 seconds**, using the frozen task
and the actual lifecycle/provenance runner. Their detailed result and duration are
recorded in [VALIDATION.json](VALIDATION.json). This includes the earlier
Polish/Visual notes followed by stale/retry, frozen-stage, capacity, batch,
concurrency, lost-response and restart workflows. Its wrapper's synthetic reward
input checks plumbing; it does not constitute a hosted evaluation.

Evidence and reproduction scripts are under
[the r10 validation directory](../../../reports/pellmoor-job-pipeline/2026-09-15-r10-static-repair/).

## Scope and remaining verification

Final ZIP SHA256: `cdda725d1d91722bdf2e96e1eb9c8b6ef88df88ffcfb6eb3a66bcefefb9eb0e6`.
The r9 archive and historical uploaded runs are preserved unchanged.

Fresh platform static/rubric QC and Oracle remain required on this checksum.
Exact image builds were not repeated in this narrow correction: prior attempts
stalled or failed fetching dependencies, and successful local checks use the
cached runtime. Removing the compatibility invocation does not certify those
external downloads or a full hosted judge's time budget. No new Oracle or model
score is claimed.
