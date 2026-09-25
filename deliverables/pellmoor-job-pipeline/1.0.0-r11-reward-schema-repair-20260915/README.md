# Pellmoor r11 reward schema correction

Upload [pellmoor-job-pipeline.zip](pellmoor-job-pipeline.zip).

SHA256: `16dcc4c6566d88b65b4d6f083013d6f3b9e6ccc0ffc78995c6aa9b5679aed5cc`.

The platform rejected r10 because `reward = []` omitted its required
`[[reward]]` entry. This revision restores the exact canonical reward.toml,
including the named `reward` entry, weighted_mean aggregation and reference
weight maps. Render and Constraints retain valid positive judge weights of 1.0.

Only `tests/reward.toml` and its explanation in `tests/SCORING.md` change.
The final scoring runner, all judges/criteria/prompts and the golden solution
are unchanged. Native RewardKit remains unpatched.

Local results and scope are recorded in [VALIDATION.json](VALIDATION.json).
Read [REPAIR_REPORT.md](REPAIR_REPORT.md) for the intermediate/final score checks.
Fresh hosted static/rubric QC and Oracle results remain pending.
