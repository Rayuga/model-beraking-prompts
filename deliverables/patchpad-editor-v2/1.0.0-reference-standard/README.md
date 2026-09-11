# PatchPad: Bazaarbridge reference standard

Prepared 2026-09-11. Editable source: `projects/patchpad-editor-v2/`.
Upload archive: **`patchpad-editor-v2.zip`**, one wrapper, 32 files.
Task version is **1.0.0**, exactly as the supplied reference, replacing the
previous 2.0.16 release numbering under the new manual QC standard.
SHA-256: `5cda4828889900f05fde79260fb1f0e40b286dc1748fa077f18b4feaeb0a873b`.

## Configuration and scoring

- `task.toml` has the exact reference table/key set. Operational values and
  `verifier.env` match the reference. Domain identity/descriptions are PatchPad's.
- Agent/build/verifier budgets: 7200 / 600 / 13200 seconds. Serial judges:
  Render 600, Constraints 600, Functional 9000, Polish 900, Visual 900; total
  12000 inside the 12600-second grading wrapper.
- Both Dockerfiles follow the reference image/tool configuration. The only
  Docker adaptations are task labels and PatchPad's seed/instruction COPY paths.
  API-key mentions are absent from both Dockerfiles and test.sh, including
  comments. The required environment placeholder remains only in task.toml.
- All five judge configurations match the corresponding reference header,
  without `judge`, `model` or additional reasoning-effort keys. Existing
  all-pass Render/Constraints aggregation is retained, including the required
  custom-editor prerequisite.
- Final reward: zero if Render or Constraints is nonpositive; otherwise
  `0.6 * functional + 0.2 * polish + 0.2 * visual`. Reward outputs and CTRF
  include all five dimensions.
- The runner retains PatchPad's documented manifest/seed preparation and npm
  lifecycle helper. It uses the reference grading/post-processing flow rather
  than copying Bazaarbridge's marketplace entry point or fixed clock.
- The oracle uses the reference's preinstalled Express 5.1.0. Package metadata,
  lockfile, setup and brief now agree; no dependency download is needed during
  solve.sh or npm start. The lockfile was refreshed from the local npm cache
  after online attempts failed, without disabling certificate verification.

## Verifiers and oracle reliability

There are **40 criteria: 2 Render, 2 Constraints, 27 Functional, 3 Polish,
6 Visual**. Every Functional criterion, including its ID, weight and exact
assertions, is identical to the pre-migration 2.0.16 source.

Visual independently scores typography, colour/contrast, spacing/layout,
hierarchy/scannability, overall craft and responsive consistency. It reviews
the actual editor, toolbar, report and history/preview at 1280x800 and 390x844.
Long lines may scroll inside the editor. No marketplace screens, sign-in,
second theme or pixel match to the oracle are required. The presentation
contract is explicit in interface.md. The existing UI and all editor/server
logic are unchanged and support the checked desktop/mobile layouts.

The old purely visual hierarchy criterion moved out of Polish into Visual.
Polish retains labels, keyboard focus and readable feedback/history. Its
duplicated persistence prerequisite was removed; persistence remains tested
by the unchanged Functional criteria. This reduces unnecessary state changes
and keeps the dimensions distinct.

Latest reviewed historical oracle: `run-61fd1cd1`, reward 0.7614, Functional
0.7349 under the old formula. Five reported failures concerned real mouse
selection, separate-location Undo/Redo, atomic paste/cut, Find/Replace and
chained stale saves. The saved review found invalid/missing judge observations
and locally passing behavior; the original full action trajectory was absent.
Do not claim every failure was conclusively a platform bug.

The Functional prompt now explicitly measures padded/scrolled glyph bounds,
verifies click targets and setup focus, records compact exact evidence before
each mutation, handles tool exceptions without replaying completed actions,
and inspects separate visible alerts after rejected saves. Requirements and
failure thresholds are preserved. These changes improve procedure; they do
not guarantee that an LLM judge will pass the oracle.

## Validation and limits

Passed locally:

- 89 mechanical reference-standard checks, including exact parsed configuration.
- RewardKit discovery of all five dimensions; shell and JavaScript syntax.
- 27 synthetic reward/CTRF cases, including partial positive gates, and 40
  rejected malformed/missing score inputs. These are not model scores.
- Actual runner integration with a trusted synthetic grader: application
  startup, two server restarts, 60/20/20 aggregation and process cleanup.
- Six current-failure groups and four latest-oracle reproduction groups.
- Fourteen broader editor/server regression groups with a fresh seeded app.
- Desktop/mobile screenshots, page width and toolbar containment checks.
  Screenshots were visually inspected; no paid visual judge score was produced.
- Byte preservation of editor/server/UI/lifecycle/seed/behavior files, exact
  Functional-criterion equality, ZIP CRC/contents/hashes and git diff whitespace.

Browser, lifecycle and schema checks used **current source in the cached
`patchpad-preflight-tests:2.0.9` image**, with isolated temporary application and
log directories. They do not prove that the new Dockerfiles build successfully.

Both exact image builds were attempted and blocked locally: the agent build
could not resolve the configured corporate proxy; the verifier build timed
out fetching PyPI packages. Logs are `build-environment.log` and
`build-tests.log`. These are unresolved build-environment limitations, not
successful builds. No proxy/security bypass was used.

The first combined diagnostic run reused a database modified by the preceding
suite, invalidating an exact tail-position precondition. That attempt is kept
under `initial-combined-run/`. Giving each independent suite its required fresh
seed made all 14 broader checks pass; no app change was made to obtain that
result. `reproduction.json` was subsequently regenerated to report the actual
package version instead of the historical script's hardcoded 2.0.16 label.

**No new full oracle, target-model run or platform QC was performed.** Once
image builds succeed in the intended environment, run QC and one complete
oracle on this exact ZIP, retain the action trace and review every failed
criterion. Do not repeatedly rerun until a favorable score appears. Prior
four-dimension scores do not validate this new package.

## Future authoring

The root `TASK_TEMPLATE_STANDARD.md` is now the current configuration contract.
`TASK_AUTHORING_CONTEXT.md`, `MODEL_BREAKING_PLAYBOOK.md` and
`MODEL_BREAKING_TASK_EXECUTION_PROMPT.md` point to it and use five dimensions.
Run `python references/task-templates/check-standard.py projects/<task>` for
future tasks. Keep version 1.0.0 while this rule applies; track subsequent
revisions with dated evidence and source/package hashes outside task.toml.

`before-migration.zip` preserves the exact source present before this work.
`migrate.py` is a one-time migration record, not a reusable packaging command.
Use `package.py` to validate/rebuild the upload. Historical releases are intact.
