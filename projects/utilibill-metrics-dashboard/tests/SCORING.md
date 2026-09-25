# Reward composition

The named `[[reward]]` in reward.toml instructs pinned RewardKit to write its intermediate weighted mean. The final scorer replaces that intermediate aggregate after validating all five dimension scores. Render and Constraints use `all_pass` over binary mandatory criteria. If either dimension is zero, final reward is zero. Otherwise the scorer normalizes the weighted sum of Functional, Polish and Visual only.

Numeric dimension weights have one authority: each dimension's `[judge].weight`. Their current values produce 60% Functional, 20% Polish and 20% Visual. Gate judge weights are positive for RewardKit's intermediate aggregation but contribute no mass to final reward. reward.toml declares composition roles, with no ignored duplicate weight map. Criterion weights affect only their own dimension. The sole judge driver, model and reasoning effort are in task.toml verifier.env.

All scores must be finite JSON numbers from zero to one; booleans, missing values and strings fail closed. The wrapper initializes zero outputs and CTRF before launching any app, runs the five judges serially, and writes graded=1/no_op=0 only after successful composition. Infrastructure failure retains zero fallback results, never a fabricated pass. The 12600-second wrapper encloses the 12000-second sum of judge budgets within the 13200-second verifier timeout.
