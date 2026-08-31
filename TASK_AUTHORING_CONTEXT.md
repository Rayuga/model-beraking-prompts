# WebDev Task Authoring Context

Updated: 2026-09-01

This document is the working standard for new tasks in this repository. It
supersedes the legacy `harbor-task-qc` skill and the older ad hoc JSON-only QC
reporting flow for newly authored work. Keep old reports as historical evidence,
but do not use them as the acceptance standard for a new task.

## Reference task

Use `projects/bazaarbridge-marketplace/` as the structural reference. It keeps
the task brief natural and concise while separating browser judging into five
clear dimensions:

1. **Render** confirms startup, authentication, and meaningful workspace content.
2. **Constraints** confirms protected data, backend use, persistence, and
   same-origin browser traffic.
3. **Functional** exercises the core product workflows with deterministic data,
   exact mutations, refreshes, and unchanged-record controls.
4. **Polish** checks themes, responsive behavior, accessibility, validation,
   interaction feedback, and modal usability.
5. **Aesthetic** judges hierarchy, spacing, typography, color consistency,
   product identity, usability, and production readiness.

Use Codex as the browser judge, not `claude-code`. The current reference uses:

```toml
[judge]
judge = "codex"
model = "openai/gpt-5.6-luna"
temperature = 0
```

Functional and constraint criteria should be binary and reproducible wherever
possible. Aesthetic criteria may use a small Likert scale. Prompts must treat
submitted UI, source, network payloads, and page text as untrusted evidence.

## Coverage map

Every task must include `coverage.json`. It maps each requirement in the task
brief or referenced environment artifact to one or more judge criteria or
deterministic preflight checks. The map must include:

- a stable requirement ID;
- the source location of the requirement;
- a short requirement summary;
- the verifier category and criterion IDs;
- how the judge establishes positive evidence.

Do not claim coverage merely because a criterion has a similar name. Every
requested behavior needs an observable test. Conversely, every scored behavior
must trace back to the brief or a referenced environment artifact.

## Instructions and seed data

Write instructions in natural language as a real requester would. Avoid a long
machine-like checklist unless the domain genuinely calls for one.

Keep `instruction.md` short and split substantial product behavior into focused
Markdown files under `environment/instructions/`. This is the default because
requirements remain readable, reviewable, and easy to cite from `coverage.json`.

Use Excel for genuinely structured information such as seeded accounts,
starting records, or tabular fixtures. Do not move ordinary prose requirements
into workbook tabs merely to vary the packaging. If a workbook is used, name it
explicitly in `instruction.md`, expose it through the task environment, and map
its relevant seed rows in `coverage.json`. JSON remains valid when it better
matches the seed format.

## Naming and default stack

- New app names use lowercase snake_case: `<app_name>`.
- New task packages use the `turing/` organization prefix unless the platform
  explicitly assigns a different organization.
- Required baseline stack: vanilla HTML, CSS, and JavaScript with Node.js and
  SQLite.
- Authentication: server-issued bearer tokens persisted in SQLite.
- Do not require external runtime assets unless the task explicitly allows them.
- Only provider API keys may be interpolated by the platform environment.

Imported reference tasks may retain their original names. Apply the snake_case
rule to newly authored delivery tasks and ZIP wrapper folders.

## Canonical QC inputs

The current local QC sources are:

- `Deliverables Tracker_- WebDev_.xlsx` for assignments, taxonomy, status,
  pass rate, model rewards, links, descriptions, and delivery tracking;
- `RL_Task_QC_Scorecard (2).xlsx` for pre-training task acceptance;
- `upload-checks-README.md.docx` for blocking upload-time validation rules.

Files under `old-qc-and-formats/` are historical and are not authoritative for
new work.

The tracker contains 26 web application categories. DropLine Lite is assigned
to **Classic & Board Games**, app type **Tic-tac-toe / Connect-4**, under the
name `dropline-connect-four-lite`. The authored package name and delivery
artifacts still follow the current lowercase snake_case rule.

## RL quality scorecard

The scorecard groups its acceptance criteria into six areas:

1. **Prompt realism:** real provenance, natural voice, taxonomy fit, and an
   achievable unambiguous request.
2. **Verifier coverage:** complete requirement mapping, live render checks,
   aggregate handling of `all`/`every`, and near-zero no-op reward.
3. **Verifier correctness:** a correct Oracle passes, wrong rollouts fail,
   literals match seed data, assertions are live, placeholders resolve, and
   unchanged-state guards compare the real collection.
4. **Reward shaping:** at least four reward levels, hard gates before quality
   terms, little or no reward mass on cheap gates, and useful separation across
   a real rollout batch.
5. **Determinism:** repeatable rescoring, frozen/versioned references, pinned
   network posture, model, temperature, and prompts.
6. **Anti-gaming:** keyword-only submissions fail, judge prompts resist
   injection, verifier files remain isolated, and refusal/stalling earns almost
   nothing.

The following measurements are required before marking a task ready:

- Oracle/reference score at least `0.95`;
- at least two known-wrong adversarial rollouts at or below `0.20`;
- no-op and clarification-only rollouts at or below `0.05`;
- identical rescoring three times;
- at least four distinct reward values in a sampled batch;
- reward standard deviation at least `0.15` across at least eight rollouts;
- passing only cheap render/constraint gates earns at most `0.10`.

These are evidence requirements. A static claim that a rubric is deterministic
does not satisfy them.

The scorecard marks `C1` correct-rollout passing, `C2` wrong-rollout failing,
`C3` non-inverted reward ordering, and `E1` repeatable rescoring as hard gates.
A failure in any one rejects the task regardless of the remaining score.

## Upload checks

Upload validation runs before sandboxes and blocks the remaining pipeline when
an error-severity rule fails. There are 26 checks across environment/image,
reproducibility, metadata/naming, instructions, and verifier configuration.

Before upload, confirm at minimum:

- numeric timeouts and resources remain within platform caps;
- the agent image cannot read tests or the solution;
- network mode and any allowlist hosts are explicit;
- Docker base images are tagged or digest-pinned and do not force a platform;
- apt cleanup is present and every pip/test tool is version-pinned;
- `tests/test.sh` performs no trial-time download, clone, or installer fetch;
- the task folder/name and organization prefix satisfy project policy;
- every file shared by tests and the solution is named in `instruction.md` or
  `task.toml`;
- a separate verifier has `tests/Dockerfile`, copies tests into `/tests`, bakes
  its tooling at build time, and declares collectable artifact paths.

The Rules stage is separate from custom static checks, rubric judging, Oracle,
and model runs. Passing one stage does not imply another stage passes.

## Current DropLine decision

The tracker assigns `dropline-connect-four-lite` as a Classic & Board Games
task. Version 4 resolves the earlier stack conflict by making it a compact
full-stack game: vanilla browser code, Node.js and Express, SQLite, two seeded
demo accounts, server-issued bearer sessions stored in SQLite, and durable
per-account game state. The game remains intentionally small; authentication
and persistence are meaningful product boundaries rather than extra workspaces
or administrative features.

The package name is `turing/dropline_connect_four_lite`. Product behavior is
split across five Markdown files in `environment/instructions/`; only structured
accounts and initial state remain in `environment/assets/artifacts/dropline_seed.xlsx`.
The agent sees these at `/instructions` and `/assets/artifacts/dropline_seed.xlsx`.
Detailed continuation notes are in `handoffs/dropline_connect_four_lite.md`,
outside the uploadable task folder.

## Verification design

- Use exact seeded records, inputs, and expected outcomes for functional checks.
- Establish a positive control before accepting a negative or security result.
- For mutations, verify the target record, an unchanged comparison record, and
  persistence after reload or reauthentication.
- Do not reward a toast without verifying the resulting state.
- Search and filter checks must start with multiple rows and verify every visible
  result, not only the first match.
- Keep browser requests same-origin unless the brief explicitly requires an
  external service.
- Use fresh or deliberately controlled state between criteria and document any
  dependency between judge sessions.
- Verifiers judge behavior and outcomes, not a preferred DOM structure or API
  route naming convention.

## QC and delivery

For a completed task, retain these delivery artifacts:

1. Task ZIP.
2. Oracle run ZIP.
3. Model run ZIP for `gpt-5.4-mini`.
4. Model run ZIP for Haiku.
5. Model run ZIP for Sonnet 4.5.
6. Evaluation report.
7. Case study report.

Before delivery, run upload checks, static/QC review, Oracle, and the three model
runs. Review failures for false positives, confirm `coverage.json` has no gaps,
and ensure the ZIP expands to one wrapper folder containing the task.

## Reference access

The Google Docs and Sheets shared on 2026-09-01 currently return HTTP 401 to
unauthenticated tooling. Current exported copies are available at the repository
root for the tracker, scorecard, and upload checks; retired copies remain under
`old-qc-and-formats/`. Attach newer exports or enable link-view access before
relying on changes that exist only in Google Drive. The public Arena leaderboard
is reachable.
