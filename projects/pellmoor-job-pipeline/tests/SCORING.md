Reward composition
==================

All five judge configurations use strictly positive weights as required by the
platform schema. Each dimension has one judge. Its criterion weights and
configured aggregation determine its independent dimension score.

Render and Constraints are final eligibility gates, not point contributions.
Their positive judge weights preserve valid independent dimension scores; they
do not allocate a share of the final reward. Functional, Polish and Visual
contribute 60%, 20% and 20% after the gates pass.

reward.toml retains the platform-required named [[reward]] entry and the
reference weight maps. The native RewardKit runner emits the five independent
dimension scores and an intermediate aggregate. The final postprocessor in
test.sh recomputes and replaces that aggregate; it is the authority for the
delivered reward.json and reward.txt. It validates all five dimension scores as
finite numbers in [0, 1], rejects booleans and missing scores, and applies this
formula:

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

In the pinned RewardKit 0.1.7, the intermediate aggregate uses positive judge
weights. Its value can differ from the final score, including when a gate fails
or the point dimensions are zero. Do not use that intermediate value as the
task result. The shipped runner always applies the final postprocessor and
overwrites reward.json and reward.txt, with zero fallback on invalid scores.
