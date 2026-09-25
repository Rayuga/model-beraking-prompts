# Pellmoor required reward entry repair

The user's latest screenshot reports `check-reward-schema.py` failing because
`reward.toml` lacks `[[reward]]`. The r10 empty-list change was accepted by the
native library but did not meet the platform's static schema. This revision
restores the full canonical file byte-for-byte and retains the positive judge
weights required by the preceding static check.

Only two task files change from r10: `tests/reward.toml` and
`tests/SCORING.md`. The archive still contains 37 files. No task requirement,
criterion, weight within a criterion, judge configuration, prompt, golden file,
timeout, model setting, Dockerfile or final scoring code changes.

## Schema and score verification

- The final archive passes **141 local standard checks and 414 archive checks**.
- Six negative archives reproduce an empty reward list, missing reward entry,
  missing reward name, incorrect aggregation and either zero gate judge weight.
  All are rejected by the local regression checks.
- The restored reward file has SHA256
  `b0113b0d4975f39fd754e903092fcbcd4d0c31737ce5e51390ca2abc44a27505`, identical
  to the canonical reference file.
- The native pinned RewardKit scoring path and exact shipped final shell are
  tested on the frozen task, using explicitly synthetic criterion verdicts.
  Results, source hashes and native implementation evidence are in the
  [runtime report](../../../reports/pellmoor-job-pipeline/2026-09-15-r11-reward-schema-repair/runtime/results.json).

The required `[[reward]]` causes native RewardKit 0.1.7 to emit an intermediate
aggregate. Its current implementation uses the positive judge weights for that
aggregate. The final shipped postprocessor recomputes the task result from the
five independent dimension scores and replaces the intermediate value in
reward.json and reward.txt. This is the unchanged required scoring path, not a
new source patch or forced score.

The runtime regression deliberately checks cases where those two values differ:

| Synthetic dimension inputs | Native intermediate | Required final reward |
| --- | ---: | ---: |
| Render=Constraints=1; Functional=1; Polish=Visual=0 | 0.8667 | 0.6 |
| Render=Constraints=1; all three point dimensions=0 | 0.6667 | 0 |
| Render=0; other four dimensions=1 | 0.6667 | 0 |

It also exercises every single criterion failure, mixed/partial scores,
malformed inputs, and the shipped fallback and final output files. These are
runtime regression inputs, not new Oracle or model scores.

## Preserved evidence and limits

The golden source, all 60 criteria and the lifecycle/scoring runner match r10.
Its 14 golden workflow groups previously passed and were not repeated for this
two-file configuration/documentation correction. The changed reward composition
is exercised separately through the native runtime and unchanged final shell.

Historical packages and uploaded run evidence are preserved. Exact image builds
remain unverified after earlier dependency-download failures; these local runtime
checks use the cached image. Fresh platform static/rubric QC and Oracle still
need to run on this exact archive. Local schema checks do not claim the hosted
45-check result or an Oracle score of 1.0.

Archive SHA256:
`16dcc4c6566d88b65b4d6f083013d6f3b9e6ccc0ffc78995c6aa9b5679aed5cc`.
