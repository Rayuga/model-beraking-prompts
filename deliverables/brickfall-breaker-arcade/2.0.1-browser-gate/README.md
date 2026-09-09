# Brickfall 2.0.1 — mandatory browser gate

Addresses the supplied check-rubric-prompt.py failure: every dimension now
contains the same explicit global browser gate, including loaded page,
protected-data isolation, wrong-password rejection, correct sign-in and
same-origin authenticated server-backed content. A narrow replay of an observed
protected GET without credentials must reject without disclosing player data.
Any missing prerequisite assigns zero to all criteria in that dimension.

Removed the contradictory Render/Constraints no-auth exemptions and Polish
public-screen credit after failed login. Functional's API restriction explicitly
allows the gate's narrow read-only probe. Gate contexts are separate and closed
without sign-out, avoiding account-wide revocation and preserved-game changes.
The same gate passed locally four times with ranked state unchanged, followed
by all twelve existing browser regression groups. Both final Docker images
built; syntax, discovery, no-op and trusted-stub runner/aggregation checks passed.

All 27 criterion ids/types/weights, Functional and Polish descriptions, game
logic, seed and instructions remain unchanged. Render/Constraints descriptions
only clarify the shared prerequisite. Both networks remain public; the judge
remains Codex/openai/gpt-5.6-luna/high. The old v0 source and old ZIPs are untouched.

This is an explicitly authorized scoring-policy change: the old GPT artifact's
broken sign-in may now hard-zero it. Historical scores are not scores for this
release. New Oracle/model validation is required. No paid run or actual
platform static checker was executed here, and all new-rubric checks are not
claimed to pass. Earlier binary-versus-Likert and bundling concerns remain.

Use the single brickfall-breaker-arcade.zip in this folder. It contains exactly
30 task files and one matching wrapper, without reports, databases, caches,
node_modules or credentials. package-audit.json and SHA256SUMS.txt identify it.
