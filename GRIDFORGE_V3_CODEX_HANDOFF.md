# Gridforge v3 — Codex handoff

Work on `projects/gridforge-spreadsheet-v3` in
`F:\Documents\turing-workspace\model-beraking-prompts`. Bring it into the current
task standard, review rubric fairness and runtime reliability, validate the
golden solution, and produce a new upload ZIP with honest validation evidence.
Do the work, not just an audit or plan. The other Codex instance is working on
Brickfall; leave Brickfall and PatchPad source, releases, previews, and unrelated
working-tree changes alone. Do not stage or commit another instance's files.

Read these before changing anything:

1. `TASK_TEMPLATE_STANDARD.md` — current mandatory configuration.
2. `TASK_LEARNINGS_2026-09-11.md` — lead messages, findings, fixes and deferrals.
3. `TASK_AUTHORING_CONTEXT.md` and `MODEL_BREAKING_PLAYBOOK.md`.
4. Gridforge v3's entire brief, mounted specifications, seeds, solution,
   `task.toml`, Dockerfiles, runner, and all judge criteria/prompts.
5. `deliverables/gridforge/gridforge-v3-3.0.0-validation/` and other relevant
   Gridforge QC/run evidence. Do not assume v2 run results validate v3.

References available locally:

- `projects/bazaarbridge-marketplace-commerce/`: lead's configuration baseline.
- `projects/docketlight-claims-insurance/`: approved top-level judge weights
  and clear Setup / numbered graded-observation procedures.
- `projects/patchpad-editor-v2/`: current implementation of today's standard.
- `projects/torquebay-repair-operations/torquebay-repair-operations/`: newly
  supplied task that the user reports passed. Note the nested directory.
- `projects/boardloom-infinite-canvas/`: another user-reported passed task,
  useful for browser setup, accounts, fresh evidence and server-authority checks.

Inspect the new references before borrowing patterns. Their passed status does
not override the lead's current checklist. Boardloom currently has an older
four-dimension configuration, version and timeouts: do not copy those into
Gridforge. Preserve all supplied reference files.

Mandatory configuration:

- Exact Bazaarbridge `task.toml` keys; no extra metadata/configuration keys.
  Version stays literal `1.0.0`; do not rename the v3 project directory.
- Agent 7200 seconds, build 600, verifier 13200. Exact reference `verifier.env`.
- Follow reference Dockerfile/runner formats, adapting only actual task needs.
  No OpenAI/OpenRouter API-key mentions in either Dockerfile or `tests/test.sh`.
  Reasoning effort `max`; no inner `judge`, `model`, or reasoning override keys
  in `judge.toml`. Keep its required `[judge]` table.
- Five folders under `tests/`: render, constraints, functional, polish, visual.
  Judge budgets 600/600/9000/900/900, serial total 12000, wrapper 12600.
- Top judge weights: Render 1, Constraints 1, Functional 0.6, Polish 0.2,
  Visual 0.2. Preserve fair individual criterion weights; they are independent
  of top-level weights, not averaged to determine them.
- Exact final reward formula, with the gate first:

```python
if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]
```

- Remove authored task code/config comments; retain shebangs, meaningful
  Markdown requirements and original seed data. A new PatchPad QC result
  explicitly requires prompt-version identification. Preserve it as ordinary
  prompt text, not a code comment: record task version `1.0.0`, the dimension
  and an independently incremented prompt revision. Record and log exact prompt
  hashes so edits are traceable while task version remains fixed. This latest
  finding supersedes the earlier blanket removal of prompt-version banners.
- Explicit global browser prerequisite in every prompt. Include authentication
  only if Gridforge's brief requires it. Keep Visual appearance-only. Adapt
  reference visual dimensions to the spreadsheet; PatchPad's removal of
  responsiveness was a PatchPad-only decision, not permission to remove it here.

Review every criterion against the actual brief. Correct extra assumptions about
API shape, coordinate bases, scroll containers or input setup without reducing
required behavior. Separate flexible UI setup from exact graded actions. Keep
real keyboard/mouse/clipboard interactions, formulas, collaboration, persistence
and conflict safety. Preserve transient checkpoints and verify focus/targets.
Do not erase valid failures or add arbitrary retries to force Oracle success.
Use the new references where their procedures solve a concrete problem.

Latest PatchPad rubric lessons: build a requirement-to-criterion coverage map;
checking the cursor-position readout does not also check document line numbers.
Give every required behavior an explicit graded observation. Keep prompts
self-contained: say what Setup and graded observations mean directly, without
references to Docketlight, marketplace screens or another task's template.
Two recent PatchPad QC failures both cited absent prompt-version identifiers;
do not repeat that omission. Provenance metadata is not itself proof of full
determinism or offline operation.

Investigate the earlier serial-timeout failure: allowed judge time exceeded the
wrapper and left inadequate outer overhead. An earlier pass on another task is
not proof that the configuration is correct. Check weights across judge files,
reward.toml and final runner. Document the pinned RewardKit intermediate gate
weighting issue and potential credit for nonfunctional shells; do not silently
declare those resolved or change the required formula.

Preserve a before snapshot and historical run evidence. Make scoped fixes,
run the local standard checker, build exact images if available, exercise the
golden app in fresh isolated state, and reproduce important rubric paths.
Analyze existing Oracle/model failures against their exact source versions.
Run a fresh full Oracle if the environment is configured; otherwise state the
specific limitation and distinguish local tests from a full judge result.
Do not claim semantic QC or Oracle approval without the corresponding run.

Create a new dated Gridforge-only delivery folder, task ZIP, source/ZIP hashes,
check report and verifier before/after summary. Update Gridforge's delivery
pointer. Keep diagnostics outside the task ZIP. Do not overwrite old packages,
run exports or other tasks, and do not push or stage shared work indiscriminately.
Finish with the ZIP link, concrete changes, test results, and unresolved risks.
