# Current WebDev Task Authoring Context

Updated: 2026-09-03

This is the current shared standard for WebDev/RL task authoring in this
repository. It combines the latest admin instructions, the root validation
files, and the strongest patterns from the extracted BazaarBridge Marketplace
and OrbitalOps packages. Newer written admin guidance overrides this document.

## Authority and source snapshot

Use sources in this order:

1. The latest written admin/user instructions.
2. `Task QC - platform.docx` at the repository root.
3. `upload-checks-README.md.docx` at the repository root.
4. `RL_Task_QC_Scorecard.xlsx` at the repository root.
5. `Deliverables Tracker_- WebDev_.xlsx` at the repository root.
6. The extracted reference task folders:
   - `projects/bazaarbridge_marketplace/bazaarbridge-marketplace/bazaarbridge-marketplace/`
   - `projects/orbitalops/orbitalops/orbitalops/`

Archived tasks, exported runs, and `old-qc-and-formats/` are reference-only.
Do not include them in routine task QC unless the user specifically asks for
an archival comparison or investigation.

Validation-file hashes for the snapshot reviewed on 2026-09-02:

| File | SHA-256 |
| --- | --- |
| `Task QC - platform.docx` | `CDF6B22BB9874ABFE8046195E1C68EC49393405FBE44CE58D9825BC85AD60933` |
| `upload-checks-README.md.docx` | `744161548A8FF4E64F7174912385CC1A6D7B89B4DEF156E1060073B05F54E6BD` |
| `RL_Task_QC_Scorecard.xlsx` | `FFD729B652631E61BC120354C68B78908C45150DCC1A05D2B8D578E6690A7411` |
| `Deliverables Tracker_- WebDev_.xlsx` | `6378677E41320D1308AA99DEE06BF32AA4236EB38F7DE4123FBC2F2A2A386CD6` |

The root scorecard calls itself a 34-criterion rubric but contains 30
criterion rows. The platform QC document explicitly acknowledges this and
splits the available rows into 19 source-decidable checks and 11 run-dependent
checks. Do not invent the missing A1, A5, or B2 criteria.

## Current admin contract

### Naming

- Every task slug must contain exactly three lowercase words separated by
  dashes: `<word1>-<word2>-<word3>`.
- For the current Lite task, the canonical slug is `dropline-four-lite`.
- `task.toml` must use `name = "turing/<task_name>"`; therefore this task uses
  `name = "turing/dropline-four-lite"`.
- Use the same canonical slug for the task package folder, ZIP stem, and the
  ZIP's single top-level extracted folder.
- Product-facing copy may still use the display name `DropLine`.

The extracted references contain mixed legacy names. They are useful for
structure and verifier design, but the latest exactly-three-word kebab-case
instruction overrides their naming style.

### Required stack and trust model

- Browser: vanilla HTML, CSS, and JavaScript.
- Server: Node.js with Express.
- Durable store: SQLite.
- Authentication: server-issued unpredictable bearer tokens persisted in
  SQLite.
- The server derives account identity from the bearer token. It must not trust
  a browser-supplied user/account identifier.
- Sign-out revokes the stored token, and replaying it must fail.
- Protected data and writes require authentication and remain account-scoped.
- The application must not require public-network scripts, styles, fonts,
  images, APIs, or runtime package installation.

### Prompt and instruction files

- Preserve a real, human voice and record provenance. The platform static QC
  specifically expects real traffic or a real product/arena request rather
  than a model-synthesized prompt.
- Do not polish every prompt into generic, formal prose. Preserve natural
  terseness, casing, and harmless quirks where they exist in the source.
- Keep a short instruction in one file.
- If the complete instruction would exceed 20 lines, keep `instruction.md`
  concise and split the contract into focused mounted files.
- Every referenced instruction and artifact must be available to the agent and
  named by an absolute container path where the platform policy requires it.
- Keep the request unambiguous and achievable from the shipped environment and
  seed state.

### Verifiers and reward

Use exactly four verifier categories under `tests/`:

1. `render`
2. `constraints`
3. `functional`
4. `polish`

Do not include an `aesthetic` verifier. Move necessary visual hierarchy,
coherence, and production-readiness checks into Polish.

Every category judge must use:

```toml
[judge]
judge = "codex"
model = "openai/gpt-5.6-luna"
mode = "batched"
temperature = 0
prompt_template = "prompt.md"
```

Pin the prompt version, judge model, temperature, tools, and sampling behavior.
Keep `prompt.md` beside `judge.toml` so the judge configuration and common
anti-injection instructions are easy to review.

Functional verification must cover more than 80% of functionality. Define the
functional requirement denominator explicitly; do not claim coverage from raw
criterion count. Independently, every explicit requirement must map to at
least one assertion in some verifier category.

#### Render and Constraints simplification

Use this design rule when authoring or revising the hard-gate verifiers.

- Render should be an intentionally easy gate for a working submission, with
  only two or three simple criteria: the page loads into a usable visible UI,
  it still loads after refresh, and, when applicable, one obvious link or
  control can be clicked without breaking the page.
- Do not place detailed functionality, visual polish, or broad product
  coverage in Render. Those belong in Functional or Polish.
- Constraints should likewise contain only two or three clear, essential
  contract checks. Avoid duplicating Functional behavior or turning
  Constraints into a second comprehensive rubric.
- Render and Constraints remain hard gates, so their criteria should identify
  genuinely unusable or non-compliant submissions rather than make capable
  model submissions fail on incidental details.

The only accepted final reward policy is:

```text
if render <= 0 or constraints <= 0:
    reward = 0
else:
    reward = 0.6 * functional + 0.4 * polish
```

Use an explicit four-dimension declaration:

```toml
[[reward]]
name = "reward"
aggregation = "weighted_mean"
weights = { render = 0.0, constraints = 0.0, functional = 0.6, polish = 0.4 }
```

RewardKit does not supply the hard gate by itself. `tests/test.sh` must read and
validate all four dimension scores, apply the gate, and atomically replace the
final reward outputs. Startup, judge, parsing, or post-processing failure must
leave a complete zero-reward record with the same four dimension fields.

### Score targets

- Oracle/reference reward must be greater than `0.95`.
- Every Functional verifier must pass for the Oracle, even if its aggregate is
  already above `0.95`.
- The primary `gpt-5.4-mini` model reward must be from `0.1` through `0.7`.
- Haiku and Sonnet 4.5 runs are required delivery evidence. Record their exact
  scores. The earlier explicit Haiku exception permits a score below `0.7`,
  including zero; no separate Sonnet acceptance band has been supplied.
- A high aggregate may never hide a failed Oracle Functional criterion.

## Canonical Harbor package

```text
dropline-four-lite/
  task.toml
  instruction.md
  environment/
    Dockerfile
    instructions/                 # only when the contract is split
    assets/artifacts/             # authoritative source/seed assets
  solution/
    solve.sh
    ...golden solution files...
  tests/
    Dockerfile
    test.sh
    reward.toml
    coverage.json
    render/
      judge.toml
      prompt.md
    constraints/
      judge.toml
      prompt.md
    functional/
      judge.toml
      prompt.md
    polish/
      judge.toml
      prompt.md
    assets/artifacts/             # verifier-only copies when required
```

The package must not contain reports, run ZIPs, screenshots, generated
databases, logs, caches, secrets, handoffs, unrelated references, or duplicate
nested task wrappers.

## Root platform QC: 19 static-source checks

`Task QC - platform.docx` evaluates these from `instruction.md`, `task.toml`,
`environment/`, `solution/`, and `tests/` without running the task:

| ID | Required evidence |
| --- | --- |
| A2 | Real traffic/product-request provenance is recorded; the prompt is not model-synthesized. |
| A3 | The source prompt's natural voice and quirks are preserved. |
| A6 | One achievable interpretation; every required artifact is reachable. |
| B1 | A complete requirement-to-assertion matrix with no unchecked ask. |
| B3 | A real execution/render gate; static keyword matching is insufficient. |
| B4 | `all`/`every` requirements inspect the full collection, not one match. |
| C4 | Every expected type and literal agrees with the seed and write path. |
| C5 | Assertions and paths are live, valid, and capable of passing. |
| C6 | Runtime placeholders are resolved by the configured runner. |
| C7 | "Nothing else changed" uses whole-state or explicit comparison guards. |
| C8 | Legitimate app side effects are excluded from unchanged baselines. |
| C9 | LLM-graded facts and weighting arithmetic match the actual seed. |
| D2 | Render or Constraints failure hard-zeros all shaping terms. |
| D5 | Under/over-production is bounded where output length or scope matters. |
| E2 | Reference/baseline artifacts are versioned and their hashes recorded. |
| E3 | The verifier is offline or restricted to a pinned allowlist. |
| E4 | Judge model, temperature, and prompt version are pinned. |
| F2 | Judge prompts treat agent content as untrusted and resist injection. |
| F3 | A separate verifier keeps tests and rubrics out of the agent image. |

For a WebDev product, D5 is best handled by a precise product scope: require
all necessary workspaces and workflows while explicitly excluding unrelated
features. Do not reward extra pages, verbose filler, or duplicated UI.

## Full scorecard: 11 run-dependent checks

The platform static QC deliberately removes these because they require real
execution evidence. They still belong in pre-delivery QC:

| ID | Required measurement |
| --- | --- |
| A4 | Domain and difficulty match the tracker/taxonomy allocation. |
| B5 | An unchanged/no-op rollout scores at most `0.05`. |
| C1 | Oracle/reference rollout scores at least `0.95`. |
| C2 | At least two knowingly wrong/adversarial rollouts score at most `0.2`. |
| C3 | Known-better rollouts monotonically outscore known-worse rollouts. |
| D1 | Sampled rewards contain at least four distinct values. |
| D3 | Passing only cheap gates earns at most `0.1`. |
| D4 | Reward standard deviation across at least eight rollouts is at least `0.15`. |
| E1 | The same rollout rescored three times receives the same reward. |
| F1 | A keyword-stuffed non-solution scores at most `0.2`. |
| F4 | A refusal or clarification-only rollout scores at most `0.05`. |

The source workbook also expects non-inverted reward ordering, frozen
baselines, true seed literals, injection resistance, and agent/test isolation.
Preserve run logs and calculations in the evaluation report.

## Upload checks: 26 structural rules

The Rules stage stops immediately on any error-severity failure. Check every
item locally before spending time on model runs.

### Environment and image

- Positive numeric agent/verifier timeouts; each at most 18,000 seconds and
  total build/agent/verifier time within 21,600 seconds.
- At most 4 CPU, 8 GiB memory, and 10 GiB disk for a non-GPU sandbox unless the
  platform policy is raised first.
- The agent environment must not copy or expose `solution/` or `tests/`.
- Network mode must meet project policy. Every allowlist mode declares hosts.
- GPU types, if used, must be recognized by the backend.
- Do not use `FROM --platform=...`.
- Compose, if used, must use named volumes rather than host bind mounts.

### Reproducibility

- Every base image has a tag or digest; do not rely on `latest`.
- Do not use bare `nproc` for build parallelism.
- Pin every pip/uv tool dependency version in Dockerfiles, `test.sh`, and
  `solve.sh`.
- Use `apt-get update`, avoid version-pinning apt packages, and clean
  `/var/lib/apt/lists/*`.
- When pytest tools are installed, use the configured versions (`pytest`
  8.3.4 and `pytest-json-ctrf` 0.3.6 under the documented default policy).
- Do not fetch tools with curl/wget/git from `tests/test.sh` at trial time.

### Metadata and naming

- The task folder slug remains within the eight-token limit.
- Use the `turing/` task-name prefix and make the task slug match the package
  folder.
- Declare a semantic task version and bump it for verifier, baseline, prompt,
  or contract changes.
- When the project enables the optional metadata check, include
  `difficulty_explanation`, `solution_explanation`, `category`, `subcategory`,
  and `persona`; category must be one of Science, Software, ML, Operations,
  Security, Hardware, or Media.
- Canary, instruction-suffix, and version enforcement checks are off by
  default unless project policy enables them.

### Instructions and verifier

- Mention files used by both tests and solution in `instruction.md` or
  `task.toml`.
- Prefer absolute container paths in instructions.
- A separate verifier bakes RewardKit, judge, browser, and other test tooling
  into `tests/Dockerfile`; it performs no trial-time install.
- Artifact paths contain no `..`; destinations are relative forward-slash
  paths and are not named `manifest.json`.
- For separate mode, keep `artifacts` top-level, copy tests into `/tests`, and
  create required artifact/log parent directories.

## Seed and baseline rules

- The authoritative seed belongs under `environment/assets/artifacts/`.
- The separate verifier cannot read `environment/`. A byte-identical copy may
  therefore live under `tests/assets/artifacts/` when the verifier needs it.
- Document why the test copy exists and verify equality by SHA-256.
- A golden solution may keep a co-located copy when it must seed independently;
  keep it byte-identical and versioned.
- Do not duplicate assets when deterministic prompts already contain every
  seed value they need.

OrbitalOps intentionally ships three byte-identical copies of its workbook;
their reviewed SHA-256 is
`3444B9EA947CD6C08647F5AE77E0D6CEF9A3A234DFB17CD8C47F1059C46AAA3E`.
DropLine's current authoritative workbook has SHA-256
`2EAE3582E4F71E3F6D66C031706EB0041D08C9465C08E1B878CF8AE907715626`.

## Verifier design learned from the references

### Render

Make Render a cheap hard gate with only two or three smoke checks: the page
loads into a usable visible UI, it still loads after refresh, and, when useful,
one obvious link, sign-in action, or control works without breaking the page.
Do not test bad-password handling, detailed persistence, exact game state, or
visual polish here. A blank, crashed, or unusable page must still fail.

### Constraints

Keep Constraints to two or three essential contract checks, such as the
same-origin full-stack workspace, authenticated access boundary, offline
operation, or durable reload behavior. Put detailed account isolation,
revocation, state-transition, and mutation-safety behavior in Functional unless
it is genuinely a task-wide hard constraint.

### Functional

Use exact end-to-end action sequences, boundary values on both sides,
whole-collection checks, persistence rechecks, terminal-state immutability,
and derived-value verification. Continue to independent criteria after one
failure. The Oracle must pass every Functional criterion.

### Polish

Combine interaction quality and the former visual-quality concerns here:
responsive layout, accessibility, keyboard behavior, focus, visible feedback,
hierarchy, coherence, and production readiness. Do not recreate an Aesthetic
directory.

### Runner safety

- Write zero reward before app startup.
- Reject missing entry files and symlinks.
- Stage the submission and run it as an unprivileged user.
- Use a bounded readiness loop and same-origin health check.
- Keep verifier logs private and guarantee reward files on every exit path.
- Validate every dimension as a finite number in `[0,1]` before calculating
  reward.
- If post-processing fails, restore zero rather than leaving an ungated mean.

## Operational learnings from DropLine and Brickfall

### Category isolation, ordering, and verifier budgets

- RewardKit 0.1.7 may evaluate AgentJudge categories concurrently by default.
  Categories that mutate the same SQLite database can therefore race and
  invalidate one another's baseline. Either isolate/reset state per category
  or run the categories serially with
  `rewardkit --max-concurrent-agent 1 /tests`.
- Render and Constraints should avoid persistent product mutations. Functional
  and Polish may mutate state only when their own setup and cleanup make the
  behavior deterministic.
- Criterion order matters within a mutating category. Run seed-import and
  baseline assertions before gameplay changes. Test archive cap/order behavior
  before later criteria generate additional completed records.
- Sum the configured category timeouts and keep the runner timeout above that
  total but below the platform verifier timeout. DropLine currently budgets
  `480 + 2400 + 900 + 480 = 4260` seconds, uses a 5280-second runner bound,
  and keeps the verifier limit at 5400 seconds.

### Idempotency, stale writes, and session safety

- Give every new-game, move, undo, and redo request its own opaque,
  high-entropy operation ID. Reusing a human-readable constant across an
  unrelated operation is not a valid test or implementation.
- Persist and replay the original HTTP status and response body for both
  successful mutations and known 4xx mutation failures.
- Test a successful duplicate after other state has advanced. Also replay a
  previously rejected stale request after later state changes and prove it
  still returns its original rejection without changing the fresh state.
- For optimistic concurrency, verify the stale revision response, re-read the
  authoritative state, and explicitly retry with a new operation ID and the
  current revision.
- A deliberately pending double activation may commit at most one move and one
  revision increment.
- Test all-session logout with two separately issued tokens for the same
  account. After a rejected or replayed action, re-read state and prove the
  rejection caused no mutation.

### Undo, redo, and terminal archive identity

- A completed archive record is not only its winner. Its identity includes the
  result, board, move list, completion time/order, and round identity.
- Undoing a terminal move removes that exact record and reverses the score.
  Redo restores the same record exactly once; it must not create a new
  completion timestamp or a duplicate archive entry.
- Starting a new game or making a new branch after undo clears the redo stack.
- Test exact terminal undo/redo early enough that unrelated generated archive
  entries do not make cap and order assertions ambiguous.

### Seed collections and latest-ten views

- To prove a ten-item cap, seed or create more than ten records. DropLine uses
  11 completed matches so the verifier can check newest-first order and the
  omission of the oldest entry.
- Expose the total completed-record count separately from the ten records
  displayed in the current view.
- Check exact order and exact omission rather than only counting ten cards.
- Keep environment, verifier, and golden seed copies byte-identical and record
  their SHA-256 hashes.
- Validate workbook-provided redo stacks by redoing the exact seeded move and
  revision, then undoing it so later checks recover their baseline.

### Browser-verifier observability

- Never grade a behavior that the instructions do not require. Every verifier
  criterion must point to an instruction clause or an explicitly mapped
  requirement.
- A generic browser verifier cannot directly prove a physical SQLite schema.
  Verify the observable contract instead: bearer-token issuance and use,
  reload persistence, distinct sessions, account isolation, and global token
  revocation. Do not force a golden-only endpoint or schema solely to make an
  internal implementation detail inspectable.
- Prefer visible UI controls. Network capture and controlled replay are a
  narrow exception for request idempotency and stale-write behavior.
- Put explicit seeded credentials in verifier prompts. When a scenario needs a
  boundary value, perform the exact steps that create it; do not assume the
  app's default range, revision, board, or focus state.
- If a test expects an empty board, start a new game first. Check keyboard
  focus after a nonterminal move because terminal-state controls may correctly
  be disabled.
- Test reduced motion by emulating the media query and verifying that animation
  and transition duration is materially reduced.
- Polish criteria should grade concrete instruction-backed qualities: readable
  type, focus visibility, contrast, spacing, distinguishable pieces, responsive
  layout, status feedback, and a clear winner state.

### Version, baseline, and ZIP integrity

- Any instruction, judge, golden solution, or frozen-baseline change requires
  a semantic version bump across `task.toml`, package metadata,
  `tests/coverage.json`, Docker labels, and judge-prompt version comments.
- Recompute seed and golden-file hashes only after the final content edit, then
  rebuild the task ZIP. Brickfall demonstrated why this order matters: an HTML
  change left stale coverage hashes until version 1.0.1 refreshed the entire
  baseline.
- The ZIP must contain exactly one top-level directory whose name matches the
  ZIP stem. Compare the ZIP file inventory and bytes against the source, test
  every entry's CRC, and reject absolute paths, traversal, duplicate wrappers,
  and unexpected files.
- Build packages from tracked or explicitly allowlisted source files. Do not
  package a dirty runtime directory containing ignored `node_modules`, SQLite
  databases, WAL/SHM files, logs, caches, or screenshots.

### Run evidence and local naming

- Friendly outer run-directory names may include the model/outcome and a short
  run-ID prefix. Preserve the complete run UUID inside Harbor JSON.
- Never rename nested Harbor trial directories or standard files such as
  `result.json`, `config.json`, and `lock.json`; exported viewers and trial
  mappings use those exact names and the stored `trial_name`.
- Treat exported transcripts as immutable evidence. Do not normalize their
  whitespace or rewrite them merely to reduce a Git diff.
- Keep secrets, raw databases, and generated logs out of commits. Run an exact
  external-secret scan before committing evidence; use `.gitignore` for raw DB
  and log artifacts.
- An infrastructure failure is not a task/model score. The current DropLine
  GPT-5.4-mini attempt identified as `run-c866d723` stopped because the Daytona
  organization had depleted credits; do not report it as a valid model or NOP
  result.
- Existing successful DropLine exports belong to older task versions. They are
  useful for diagnosis but do not replace fresh Oracle and required-model runs
  for version 6.0.1.

### Git and Windows repository handling

- On this workspace, repository-wide `git add -A` can fail because an archived
  nested repository contains an overlong Windows object path. Stage only the
  active task, context, ZIP, or run-evidence paths being delivered; do not edit
  archived exports to work around the issue.
- A directory rename appears as deletions plus untracked files until staged.
  Inspect the staged result and final tree rather than relying only on Git's
  rename percentage. Identical empty files can also produce surprising rename
  pairings without changing the final content.
- Before pushing, fetch the remote, check branch divergence, scan the staged
  material for secrets, commit only the intended paths, push, then verify a
  clean worktree and `HEAD == origin/main`.

## What changed from the older five-dimension pattern

| Older pattern | Current requirement |
| --- | --- |
| Render, Constraints, Functional, Polish, Aesthetic | Exactly Render, Constraints, Functional, Polish |
| Generic/five-way weighted mean | Hard gates, then `0.6 Functional + 0.4 Polish` |
| Visual craft isolated in Aesthetic | Visual craft and production readiness live in Polish |
| Judge prompt embedded in TOML | Versioned `prompt.md` referenced by `judge.toml` |
| Coverage inferred from criteria | Explicit requirement/assertion matrix and measured Functional coverage `>80%` |
| Mixed legacy task slugs | Exactly three lowercase dash-separated words |
| One or two model artifacts | Oracle plus gpt-5.4-mini, Haiku, and Sonnet 4.5 run ZIPs |
| Static review alone | 19 source checks plus 11 measured run checks and 26 upload rules |

BazaarBridge is the clearer reward implementation because `reward.toml`
declares the weights and `test.sh` applies the gate. OrbitalOps is the clearer
seed-isolation example and includes `tests/coverage.json`. Use the strongest
part of each; do not copy reference inconsistencies.

## Required delivery folder

The final delivery folder must contain these artifact classes:

1. Task ZIP.
2. Oracle run ZIP.
3. A model run ZIP for each required model:
   - gpt-5.4-mini
   - Haiku
   - Sonnet 4.5
4. Evaluation report.
5. Case study report.

Unless the platform exports a single documented multi-model archive, this is
seven files: one task, one Oracle, three model runs, and two reports. Keep them
outside the Harbor task ZIP. Recommended organization:

```text
deliverables/dropline-four-lite/
  dropline-four-lite.zip
  dropline-four-lite-oracle-run.zip
  dropline-four-lite-gpt-5-4-mini-run.zip
  dropline-four-lite-haiku-run.zip
  dropline-four-lite-sonnet-4-5-run.zip
  dropline-four-lite-eval-report.<approved-format>
  dropline-four-lite-case-study-report.<approved-format>
```

Inspect the task ZIP central directory. It must contain exactly one top-level
folder named `dropline-four-lite/`, matching the ZIP stem exactly.

## Tracker allocation for DropLine

The updated tracker provides two relevant facts:

- Taxonomy sheet: `Classic & Board Games` -> `Tic-tac-toe / Connect-4`, with
  assigned app name `dropline-connect-four-lite`.
- Active work sheet: task `dropline-connect-four`, category `Board Game`, with
  a description that includes complete win/draw detection, move history,
  undo/redo, persistent scores, keyboard controls, responsive play, and reload
  restoration.

The tracker uses `dropline-connect-four` for the earlier package. The current
Lite rework uses the distinct three-word slug `dropline-four-lite` so the
existing project history is not overwritten.

The task owner resolved the scope discrepancy on 2026-09-02: the Lite task now
includes move history, undo, and redo. Version 5.0.0 adds all three to the
instructions, golden solution, coverage map, and Functional verification.

## Current DropLine Lite audit

Working source reviewed:
`projects/dropline-four-lite/`

### Current implementation (version 6.0.1)

- The working folder, npm package, task name, and delivery slug use
  `dropline-four-lite`.
- `task.toml` uses `turing/dropline-four-lite` and version `6.0.1`.
- The natural main instruction is at most 20 lines. Every mounted instruction
  file is also at most 20 lines; dedicated `concurrency.md` and `records.md`
  keep the new contract explicit rather than hiding requirements in judges.
- The solution uses vanilla HTML/CSS/JS, Node.js, Express, and SQLite.
- It reads the authoritative Excel seed, hashes passwords with per-account
  scrypt salts, issues unpredictable bearer tokens, persists sessions, revokes
  tokens on sign-out, derives identity server-side, and isolates account state.
- It implements server-owned gravity, turns, four-direction wins, draws,
  terminal locking, move history, repeated branching undo/redo, terminal-score
  reversal/restoration, and durable reload/sign-in persistence.
- Version 6 imports distinct workbook boards, totals, histories, redo stacks,
  revisions, round ids, and all 11 completed matches. SQLite transactions reject
  stale two-tab writes, persist successful and rejected mutation receipts, revoke
  every account token on sign-out, and maintain a latest-ten idempotent archive.
- The client shows revisions, reconciles stale state, suppresses duplicate
  activation, retains keyboard focus, and renders a separate accessible replay
  board with step, Previous, Next, and Close controls.
- Exactly four verifier categories remain. Former Aesthetic criteria now live
  in Polish.
- Render and Constraints each contain two short smoke/contract criteria. They
  avoid persistent game mutations so concurrently evaluated dimensions cannot
  overwrite one another's expected account state.
- Every judge pins Codex, `openai/gpt-5.6-luna`, temperature zero, a versioned
  `prompt.md`, and Playwright MCP.
- `reward.toml` declares only the 0.6 Functional/0.4 Polish weights, while
  `test.sh` validates all dimensions and implements the Render/Constraints
  hard gate with complete zero-output fallback. Agent judges run serially so
  one mutating category cannot corrupt another category's SQLite baseline.
- `tests/coverage.json` maps 18 requirements and reports all 15 functional
  requirements covered by Functional (`100%`). There are 13 Functional
  criteria with total criterion weight 19; the five new behavior groups carry
  weight 10 without making them a global gate.
- Baseline solution and seed hashes are recorded. The verifier seed copy is
  byte-identical and documented as required by separate-verifier isolation.
- Docker images are tagged, pip/npm verifier tools are versioned, apt metadata
  is cleaned, runtime fetching is absent, and the agent image does not copy
  tests or solution.
- Historical version 5.1.1 GPT-5.4-mini passed Functional `1.0` and Polish
  `0.8`; after correcting an unsupported Render-helper check its implied reward
  was `0.92`, above the target band. Haiku reached Functional `0.5556`. A later
  Oracle/NOP attempt and the current version 6.0.1 GPT-5.4-mini attempt never
  started because Daytona reported depleted organization credits. Version
  6.0.1 adds written, deterministic full-stack difficulty plus serialized
  browser judging and requires fresh successful platform runs.
- Version 6 has passed local API, real-Chromium, exact-draw/undo/redo regression,
  two-tab conflict, all-session revocation, 11-record/latest-ten archive lifecycle,
  request-result replay, keyboard-focus, 375-pixel replay, and reduced-motion checks.

### Remaining platform and delivery work

1. Run the current platform's 19 source checks and 26 upload Rules checks.
2. Build both Dockerfiles and run the packaged task in the platform environment.
3. Run Oracle, gpt-5.4-mini, Haiku, and Sonnet 4.5 and evaluate the 11
   run-dependent scorecard measurements.
4. Confirm Oracle is greater than 0.95 with every Functional criterion passing
   and the primary model lands in the accepted reward band.
5. Export the required run ZIPs, evaluation report, and case-study report.

### Current high-risk QC items

| Check | Current status | Reason |
| --- | --- | --- |
| A2 real provenance | Platform confirmation needed | Metadata truthfully identifies the tracker assignment and task owner's live request; the platform must decide whether that provenance meets its real-traffic bar. |
| A3 natural source voice | Addressed in source | The main prompt retains lowercase, terse human wording instead of formal checklist prose. |
| B1 complete mapping | Addressed in source | All 18 requirements map to live criterion IDs; concurrency and records requirements are instruction-backed. |
| D2 hard gate | Addressed in source | The runner validates four dimensions and applies the exact gate/formula. |
| E2 frozen/hash-recorded baseline | Addressed in source | Version 6.0.1 records both seed copies and golden-file SHA-256 values. |
| Functional `>80%` | Addressed in source | Defined denominator is 15 functional requirements; Functional covers all 15 (`100%`). |
| Four categories only | Addressed in source | Only Render, Constraints, Functional, and Polish remain. |
| Three-word dash naming | Addressed in source | Source/task/npm/delivery slugs use `dropline-four-lite`. |
| Docker/platform checks | Unverified | Docker and platform validation are intentionally left for the platform run. |
| Run evidence | Insufficient | Existing scored runs cover older versions, and the version 6.0.1 attempt is only a Daytona depleted-credit failure; no successful current Oracle/mini/Haiku/Sonnet evidence is present. |
| Delivery set | Partial | The validated task ZIP is assembled; Oracle/model run ZIPs and the two reports await platform results. |

The local source preflight emulating the documented rules passes all 26 upload
checks and all 19 source-decidable scorecard items. This is not a platform
Rules result; treat the platform checks as unverified until an upload passes.

## Current Brickfall audit snapshot

Working source reviewed:
`projects/brickfall-breaker-arcade/`

- The canonical three-word slug is `brickfall-breaker-arcade` and the current
  task version is `1.0.1`.
- The task follows the same Harbor structure and four verifier-category model
  as DropLine. Its long contract is split into mounted instruction files.
- The golden browser game includes the instruction-backed status message,
  score/lives/level/combo display, active power-up, controls, level selection,
  and global leaderboard behaviors.
- A late instruction, Render-helper, and golden title/dedication change required
  a version bump. Package metadata, prompt comments, coverage metadata, and
  golden hashes were refreshed together before rebuilding the ZIP.
- The task ZIP contains 27 source files. Ignored runtime `node_modules`, SQLite
  database/WAL/SHM files, and other generated material are not packaged.
- This snapshot records structural and baseline consistency, not final task
  acceptance. Brickfall still needs its complete platform upload checks,
  current Oracle/model runs, score-band analysis, and final delivery reports.

## Current package snapshots

These hashes identify the packages assembled after the latest reviewed source
changes. Any later task edit invalidates the corresponding row and requires a
new semantic version, hash, and ZIP build.

| Task | Version | Source files in ZIP | ZIP SHA-256 |
| --- | --- | ---: | --- |
| `dropline-four-lite` | `6.0.1` | 29 | `41D832B381379DB4F328DAF6F0A415E50A11C7E06209CD85BBDE4BF8EDD875B4` |
| `brickfall-breaker-arcade` | `1.0.1` | 27 | `54D1BF16CC6AEC98B03932FE2ADCA429ED881EC97EDAC9A1D70A828CD8510CAE` |

## Final pre-delivery checklist

### Source and structure

- Canonical three-word lowercase dash-separated slug everywhere required.
- `turing/<task_name>` matches the package folder.
- Exactly four verifier directories; no Aesthetic references.
- Natural prompt with truthful provenance and no unchecked requirement.
- Correct stack and SQLite-backed bearer authentication.
- Minimal Harbor structure; no unrelated or generated files.
- Seed and baseline hashes recorded; task version bumped for changes.

### Static and upload QC

- All 19 platform source criteria pass.
- All 26 enabled upload rules pass; warnings are reviewed.
- Every explicit requirement maps to an assertion.
- Functional coverage is calculated and strictly greater than 80%.
- Every judge prompt is pinned and injection-resistant.
- Reward post-processing is tested for gate pass, render fail, constraints
  fail, malformed input, and missing output.

### Runtime QC

- No-op and refusal-only rollouts score at most 0.05.
- Two adversarial/wrong rollouts and keyword stuffing score at most 0.2.
- Oracle is greater than 0.95 and every Functional criterion passes.
- Primary model score is within the accepted band.
- Rewards produce at least four values and standard deviation at least 0.15
  across eight or more rollouts.
- Same rollout rescored three times is stable.
- Reward ordering is monotone from bad to good.

### Delivery

- Task ZIP stem equals its single wrapper folder.
- Oracle run ZIP included.
- gpt-5.4-mini, Haiku, and Sonnet 4.5 run ZIPs included.
- Evaluation report includes static, upload, runtime, score, and failure
  evidence.
- Case study explains task design, verifier separation, model failure modes,
  and final lessons without being placed inside the task ZIP.
