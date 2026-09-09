# Brickfall 2.2.2 follow-up review

This folder holds fresh local checks of the existing 2.2.2 compatibility
release. It does not replace historical accepted-run evidence and is not a
platform QC or Oracle score. No task source or scoring changes were made in
this follow-up. The prior detailed review is in ../2.2.2-rubric/README.md.

The user requested public networking and no major changes to the accepted
game, requirements or scoring. Both agent and verifier remain public. The
separate verifier and Codex/openai/gpt-5.6-luna/high judge remain unchanged.
All 27 criteria remain: 2 Render, 2 Constraints, 16 Functional and 7 Polish.

## Decision boundary

The newer reference rubric's authenticated-backend gates and anchored visual
quality scales are not equivalent to the accepted task's public-screen gates
and binary Polish criteria. The old GPT artifact had broken sign-in and
scored 0.2182. Requiring successful authentication in every dimension could
zero it. Such a change requires an explicit scoring-policy decision and fresh
model evidence; it is not a harmless format correction.

Public/public also differs from the reference workbook's network-policy
recommendation, but follows the user's explicit request. The accepted broad
criteria and undisclosed optional /tmp DB_PATH fallback remain review risks.
No claim of full new-rubric compliance is made.

## Validation

Fresh local-checks.json and browser-regression.json record actual completion.
They use a disposable, externally offline verifier container, with a trusted
local RewardKit stub; no paid judge or model is invoked. The stub score is only
an orchestration/aggregation assertion, never an Oracle result.

The twelve browser groups cover authentication, seeded data, saved checkpoints,
history, all seven mechanics drills, replay safety, reload and mobile layout.
They are a focused regression suite, not independent execution of all 27
platform criteria. Shell/Node syntax, criterion discovery and no-op rejection
are also checked by the runner.

The deliverable remains ../2.2.2-rubric/brickfall-breaker-arcade.zip. Its source
and archive hashes must still match before reuse; followup-audit.json records
that comparison. Historical Oracle 1.0, GPT 0.2182 and Haiku 0.0 are for 2.2.1,
not fresh 2.2.2 scores. No changes to PatchPad, GridForge or shared files.
