Reward composition
==================

All five judge configurations use strictly positive weights as required by the
platform schema. Each dimension has one judge. Its criterion weights and
configured aggregation determine its independent dimension score.

Render and Constraints are final eligibility gates, not point contributions.
Their positive judge weights preserve valid independent dimension scores; they
do not allocate a share of the final reward. Functional, Polish and Visual
contribute 60%, 20% and 20% after the gates pass.

reward.toml declares an empty reward list so the native RewardKit runner emits
only the five dimension scores, without a second aggregate reward. The final
postprocessor in test.sh is the sole authority for the final reward. It validates
all five scores as finite numbers in [0, 1], rejects booleans and missing scores,
and applies this formula:

```python
if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]
```

An explicit shared browser prerequisite still zeros every criterion in its
dimension when it fails. Individual criteria retain their configured weighted
aggregation. The postprocessor does not reinterpret a partial positive gate as
zero or assign credit to missing evidence. No RewardKit scoring patch is needed.
