# Scoring contract

RewardKit 0.1.7 first writes its named weighted_mean aggregate, declared in reward.toml, using the numeric weights from each dimension's judge.toml. tests/test.sh then invokes score.py exactly once to replace that intermediate aggregate with the final gated result.

Render and Constraints use all_pass over their independently reported binary criteria. If either dimension is zero, the final reward is zero. Otherwise score.py computes the normalized weighted mean of Functional, Polish and Visual. Their sole numeric weight definitions are each [judge].weight; the current values give 60%, 20% and 20%. Gate weights are positive for RewardKit's intermediate calculation but have no final reward mass. There are no ignored weight maps or duplicated numeric coefficients in the runner. Criterion weights only govern their own dimension.

The scorer requires every dimension to be a finite JSON number between zero and one, rejecting booleans, strings and missing values. The runner initializes zero results before launch and restores zeros on grading failure. graded=1 and no_op=0 are written only after successful final composition. Unit fixtures for this plumbing are not Oracle or model scores.
