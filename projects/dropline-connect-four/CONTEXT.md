# DropLine follow-up context

This file is not part of the current task instructions or scoring contract. It
records possible follow-up work and project-design context. A future feature
must not become graded until it is added to the human-facing instructions, the
golden solution, and a deterministic verifier together.

## Possible future work

- Add a computer opponent with deterministic difficulty levels.
- Add online multiplayer, live presence, and reconnect behavior.
- Let players choose names while retaining clear token identities.
- Add best-of-three matches and tournament formats.
- Add optional themes, sound, and additional animations.
- Add match replay and shareable results.
- Add a game archive and longer-term statistics.
- Add touch and mobile gesture controls.

## New-client context

This project starts a new client workstream. The move to a simpler task is a
response to the new client's target-model and evaluation brief; it is not a
judgment that GridForge or the earlier projects were too large or incorrectly
designed.

The models the new tasks are intended to break are:

- `gpt-5.4-mini` - the only target model to run for now;
- Sonnet 4.5 - a later target, not part of the first run;
- Claude Haiku 4.5 - a later target, not part of the first run.

Use `gpt-5.6-luna` as the browser judge instead of Sonnet. The client supplied
this recommendation because Luna is substantially cheaper and, according to
their benchmark guidance, provides comparable judging quality for this work.
Do not silently substitute Sonnet when the Luna configuration fails.

## Client-supplied references

The planning for this workstream is based on the files supplied on 27 August
2026:

- `CodeArena_Measurements.docx` - measured WebDev Arena headroom, technology
  slices, intent and domain observations, interaction/style signals, and the
  relationship between complete implementation and arena outcomes;
- `Webdev_app_taxonomy.xlsx` - the client category list covering 26 application
  categories and 11 industry verticals;
- `Docketlight Enterprise - Feature and Verifier Specification.pdf` - the
  reference style for a readable product overview, workflows, expected results,
  controls, feature coverage, and golden walkthrough.

The taxonomy and measurements guide task selection; they are not themselves
agent-facing instructions. DropLine is categorized under **Classic & Board
Games**, using the Connect Four concept selected during planning. Gaming was one
of the areas identified as having useful headroom in the supplied measurements.

## New-client task format

- Keep the established Harbor structure, Docker environment, golden solution,
  manifest, test harness, browser rubric, and clean upload process.
- Organize requirements as features and sub-features.
- Keep `instruction.md` short and human-written, with the details split across
  topic files under `environment/instructions/`.
- Use more than 20 meaningful verifiers. They should remain atomic,
  deterministic, and based on real visible interactions.
- Every verifier must have defensible coverage in the instructions without
  exposing its exact test sequence to the target model.
- Avoid hidden routes, synthetic events, DOM mutation, and timing-dependent
  setup in the browser rubric.
- Build the golden solution alongside the verifier design and require it to pass
  the complete rubric deterministically before the GPT-5.4-mini run.
- Run Oracle and task QC before running the target model.
- Keep planning documents and this context file outside the Harbor upload ZIP.

The Docketlight-style reference material for DropLine is now recorded beside
this file as `DropLine_Feature_Verifier_Spec.md` and
`DropLine_Feature_Verifier_Spec.docx`.
