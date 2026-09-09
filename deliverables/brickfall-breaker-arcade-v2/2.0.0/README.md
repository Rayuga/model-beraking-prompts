# Brickfall V2 — separate task, version 2.0.0

Task source: projects/brickfall-breaker-arcade-v2.
Task identity: turing/brickfall-breaker-arcade-v2.

The original projects/brickfall-breaker-arcade is restored to accepted 2.2.1,
matching HEAD and its historical accepted ZIP (text line endings normalized
for comparison). Original task archives and accepted run evidence are untouched.
The earlier in-place 2.2.2 compatibility work is preserved historically under
deliverables/brickfall-breaker-arcade/2.2.2-rubric, but future changes belong to
this separate V2 task. Do not upload that earlier same-name ZIP in its place.

V2 carries forward those limited compatibility changes: public/public networks,
separate verifier, pinned Docker bases, instruction/fixture layout corrections,
consistent prompt version markers, and aligned dimension-weight metadata.
Gameplay, seed contents, instruction requirements, all 27 criteria, criterion
weights and the 60:40 reward formula are unchanged. Only task identity and
release labels differ from the tested 2.2.2 compatibility snapshot.
The judge remains Codex/openai/gpt-5.6-luna with high reasoning.

This separate identity intentionally has the requested -v2 suffix, like the
other V2 projects; it is not an exactly-three-token name. If the platform
enforces that older naming rule strictly, a naming exception/decision is needed.

Both V2 Docker images built using cached dependencies. Fresh local-checks.json
and browser-regression.json record syntax, discovery, empty-submission zero,
golden startup and twelve real-browser regression groups. A trusted local
RewardKit stub checks aggregation; its injected score is not an Oracle grade.
No paid model or platform QC was run for this new identity.

The newer rubric's no-network recommendation, global authenticated-backend
gates, low mock floor, and anchored visual-quality scoring conflict with the
accepted design. Public/public follows the user's explicit choice. No auth
gate or Likert/scoring redesign was silently applied. Broad criteria and the
optional relocated-app DB_PATH fallback remain review risks. Full new-rubric
compliance is NOT claimed. Details remain in the historical 2.2.2 review.

The old Oracle 1.0, GPT 0.2182 and Haiku 0.0 scores describe the original task,
not V2. Fresh platform QC and run evidence are needed before claiming V2 passed.

The ZIP has one brickfall-breaker-arcade-v2/ wrapper with 30 task files, excluding
reports, credentials, databases, caches and node_modules. package-audit.json
and SHA256SUMS.txt contain exact source and ZIP hashes.
