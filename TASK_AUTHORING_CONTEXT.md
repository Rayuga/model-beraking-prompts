# Current WebDev Task Authoring Context

Updated: 2026-09-02

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
7. Historical material under `old-qc-and-formats/`.

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
| C7 | “Nothing else changed” uses whole-state or explicit comparison guards. |
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

Make Render a cheap hard gate. Require startup, a substantive same-origin
page, protected pre-login state, a rejected bad password, a successful seeded
login, and meaningful populated content. A blank or always-deny app must fail.

### Constraints

Test trust boundaries with positive controls: same-origin server mutations,
server-side identity, account/role isolation, durable SQLite state, token
revocation, stored-value authority, and absence of required external assets.
After every rejected/replayed action, re-read state and prove nothing changed.

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
  was `0.92`, above the target band. Haiku reached Functional `0.5556`, while
  the latest Oracle/NOP attempt never started because Daytona reported depleted
  organization credits. Version 6.0.1 adds written, deterministic full-stack
  difficulty plus serialized browser judging and requires fresh platform runs.
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
| Run evidence | Missing | Existing runs cover older versions; no version 6.0.1 Oracle/mini/Haiku/Sonnet evidence is present. |
| Delivery set | Partial | The validated task ZIP is assembled; Oracle/model run ZIPs and the two reports await platform results. |

The local source preflight emulating the documented rules passes all 26 upload
checks and all 19 source-decidable scorecard items. This is not a platform
Rules result; treat the platform checks as unverified until an upload passes.

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
