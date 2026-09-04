# Common Ground Ballot — Case Study

## Goal

Common Ground turns a compact ballot product into an objectively verifiable full-stack task. A correct implementation must connect role-based authentication, durable sessions, ballot lifecycle, fixed eligibility, private voting, exact publication, revision safety, idempotency and audit history rather than merely render a dashboard.

## Difficulty design

The authoritative seed fixes four people and four ballots at different lifecycle stages. The verifier creates and opens one additional approval ballot, then carries the shared state through cross-ballot rejection, valid voting, exact retry, mismatched operation reuse, close and publish. Each accepted write is checked through its dependent turnout, anonymous selection, result and audit state; rejected writes must preserve every one of those values.

Render and Constraints remain deliberately small: two page/control smoke checks and two same-origin/entrypoint checks. Difficulty lives in 19 Functional criteria, while five Polish criteria cover responsive navigation, keyboard forms, durable feedback, result hierarchy and theme/touch/reduced-motion quality.

## Results

The v1.0.6 Oracle scored 1.0000 and passed all 28 criteria. The final untouched GPT-5.4-mini rollout scored 0.1600 with both gates passing, no Functional passes and two Polish passes. It built a plausible responsive shell but did not integrate the seeded server workflows. The exact-version Haiku rollout scored 0.4064 with both gates passing, 0.4107 Functional and 0.4 Polish.

An earlier Haiku artifact exposed an overbroad symlink preflight: npm legitimately creates links under `node_modules/.bin`. v1.0.6 now permits only those links when their resolved target remains inside `node_modules`. The final exact-version Haiku run then completed normally, separating the fixed verifier defect from genuine model incompleteness.

## Lessons

- Easy hard gates provide partial credit to usable shells without hiding Functional incompleteness.
- Fixed eligibility and anonymous selections require downstream checks, not source keywords or visible labels.
- Idempotency needs both exact replay and mismatched-payload reuse checks.
- Rejected-write verification must reread revisions, history and derived totals.
- Package-manager symlinks are normal; security checks should validate resolved containment instead of banning all links.
- A model zero caused by setup, startup or handoff is not a valid task result.
