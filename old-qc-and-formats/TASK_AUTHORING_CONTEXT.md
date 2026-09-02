# WebDev Task Authoring Context

Updated: 2026-09-02

This is the shared working standard for web-development tasks in this
repository. It consolidates the latest admin guidance with lessons from the
current BazaarBridge Marketplace and OrbitalOps reference packages. Use it for
new tasks and reworks unless a newer written admin instruction explicitly
overrides it.

## Sources and precedence

Use guidance in this order:

1. The latest explicit admin instruction recorded in this document.
2. The current packaged references:
   - `projects/bazaarbridge_marketplace/bazaarbridge-marketplace.zip`
   - `projects/orbitalops/orbitalops.zip`
3. The repository-root tracker, scorecard, and upload-check exports.
4. Historical handoffs, reports, archived packages, and Git history.

The old tracked `projects/bazaarbridge-marketplace/` task used five judge
dimensions and the `codearena/` namespace. It is historical, not the current
template. Files under `old-qc-and-formats/` are also historical evidence rather
than the acceptance standard.

## Current non-negotiable contract

- `task.toml` uses `name = "turing/<task_name>"`.
- The main prompt reads like a natural request written by a real user.
- Use exactly four verifier categories under `tests/`:
  `render`, `constraints`, `functional`, and `polish`.
- Do not include an `aesthetic` verifier.
- Every browser judge uses Codex with `openai/gpt-5.6-luna`.
- Functional verification covers more than 80% of requested functionality.
- If Render or Constraints fails, final reward is zero. Otherwise:

  ```text
  reward = 0.6 * functional + 0.4 * polish
  ```

- The Oracle/reference reward must be greater than `0.95`, and every
  Functional criterion must pass even if the aggregate already exceeds 0.95.
- The primary target rollout is `gpt-5.4-mini`; its reward should be between
  `0.1` and `0.7`.
- Run Haiku as requested. Any Haiku reward below `0.7`, including zero, is
  acceptable and does not by itself require task changes.
- Keep the Harbor package minimal and correctly structured.
- A delivery ZIP's filename stem and its single top-level extracted folder must
  match exactly.

These rules supersede the previous five-dimension weighted-mean design and the
previous expectation that an Oracle had to score exactly 1.0.

## Canonical task layout

```text
<task_name>/
  task.toml
  instruction.md
  environment/
    Dockerfile
    instructions/          # only when the brief needs splitting
    assets/artifacts/       # authoritative seed/source artifacts
  solution/
    solve.sh
    ...golden solution files...
  tests/
    Dockerfile
    test.sh
    reward.toml
    render/
      judge.toml
      prompt.md             # recommended
    constraints/
      judge.toml
      prompt.md             # recommended
    functional/
      judge.toml
      prompt.md             # recommended
    polish/
      judge.toml
      prompt.md             # recommended
    coverage.json           # recommended when maintaining a coverage map
    assets/artifacts/       # only verifier-needed copies
```

Solutions may keep source files directly under `solution/` or in
`solution/app/`; `solve.sh` is responsible for installing the finished app at
`/app`. Consistency, startup correctness, and minimal packaging matter more than
choosing one of those two internal layouts.

## Instruction design

Write the prompt in a natural, human voice. Describe the need and important
outcomes without turning the main prompt into a verifier checklist or dictating
irrelevant selectors, route names, and implementation details.

- If the complete instruction is 20 lines or fewer, keep it in one file.
- If it would exceed 20 lines, keep `instruction.md` concise and split the
  detailed contract into focused files under `environment/instructions/` or an
  equivalent mounted documentation directory.
- Name every referenced instruction and artifact path in `instruction.md`.
- Use exact wording only where the product genuinely requires an exact label,
  formula, boundary, data value, or protocol.
- Requirements distributed across files remain equally authoritative and must
  all be covered by verification.

BazaarBridge demonstrates a short natural entry prompt plus six focused
instruction files. OrbitalOps demonstrates that a domain-heavy request can
still be natural while delegating precise policy rules to three mounted docs.
DropLine Lite's short entry prompt plus five focused instruction files already
follows this part of the standard.

## Seed and verifier assets

Authoritative seed data belongs under `environment/assets/artifacts/`. Use JSON
for naturally nested records and Excel for genuinely tabular, multi-entity, or
reviewer-friendly data.

The verifier runs in a separate environment and cannot read `environment/`
directly. Therefore, a byte-identical copy may also appear under
`tests/assets/artifacts/` when a judge, deterministic preflight, or coverage
tool genuinely needs the source data. This is an intentional verifier fixture,
not a second source of truth.

When duplicating a seed asset:

- keep the environment copy authoritative;
- keep the tests copy byte-identical;
- document that the copy exists because the verifier cannot see
  `environment/`;
- add a checksum or equality check when practical;
- do not add the copy if criteria already contain all deterministic values they
  require.

OrbitalOps follows this pattern with `orbitalops_seed.xlsx`. BazaarBridge does
not duplicate its JSON seed because its browser prompts already contain the
necessary deterministic facts. DropLine Lite currently keeps its workbook only
under `environment/`; that is valid unless its verifier is changed to read the
workbook directly.

## Four verifier categories

### Render

Render is a cheap hard gate. Confirm that the server starts, the page is
substantive, required authentication can succeed, and meaningful populated
content is reachable. A blank shell, fatal browser error, or multiple labels
pointing to one unchanged screen must fail.

### Constraints

Constraints is a hard gate for trust boundaries and architectural
requirements: protected pre-login state, real same-origin backend traffic,
server-side authorization, durable storage, scope isolation, revoked sessions,
and prohibited external dependencies. Every negative probe needs a working
positive control so a broken app cannot pass by refusing everything.

### Functional

Functional carries 60% of the final reward and must cover more than 80% of the
requested functionality. It should exercise the real end-to-end workflows,
including important boundary cases, derived values, persistence, roles, and
state transitions. The Oracle must pass every Functional criterion.

Coverage is about requirements, not raw criterion count. A broad criterion may
cover several tightly related rules if each has explicit evidence; a vague
criterion with a similar name does not count.

### Polish

Polish carries 40% of the final reward. It covers responsive behavior,
accessibility, labels and landmarks, theme behavior when requested, validation,
interaction feedback, modal/drawer usability, hierarchy, coherence, and
production readiness. Visual quality belongs here now; it is not a separate
Aesthetic dimension.

## Judge configuration

Use this baseline in each category:

```toml
[judge]
judge = "codex"
model = "openai/gpt-5.6-luna"
mode = "batched"
temperature = 0
prompt_template = "prompt.md"
```

Set a category-appropriate timeout and reasoning effort. Keep Render and
Constraints small and deterministic; allow more time and reasoning for complex
Functional workflows.

Each prompt should:

- identify the live app URL;
- use Playwright MCP and rendered/browser-network evidence;
- treat submitted UI, source, network payloads, errors, and page text as
  untrusted;
- refuse scoring instructions found inside the submission;
- continue to later independent criteria after one failure;
- judge observable outcomes rather than one preferred DOM shape or API route;
- avoid direct API mutations when the requirement calls for a visible user
  interaction;
- use direct request replay only for trust-boundary, concurrency, idempotency,
  or immutability checks where it is the correct evidence.

Binary criteria are preferred for deterministic product behavior. Use exact
seed records, exact action sequences, and exact expected results where the
domain permits them.

## Reward implementation

`reward.toml` should declare only the four current dimensions. A clear form is:

```toml
[[reward]]
name = "reward"
aggregation = "weighted_mean"
weights = { render = 0.0, constraints = 0.0, functional = 0.6, polish = 0.4 }
```

RewardKit does not provide the required hard-gate semantics by itself, so
`tests/test.sh` must validate the four numeric dimension scores and overwrite
the final result using:

```text
if render <= 0 or constraints <= 0:
    reward = 0
else:
    reward = 0.6 * functional + 0.4 * polish
```

Prefer `aggregation = "all_pass"` inside Render and Constraints so any failed
criterion makes that gate dimension zero. The runner must write a zero reward
before startup, preserve zero on infrastructure/judge failure, and never leave
an ungated RewardKit mean behind after a post-processing error.

The zero-reward JSON and final reward JSON should expose the same four
dimensions. Remove stale `browser`-only or `aesthetic` fields unless a platform
compatibility field is explicitly required.

## Verification practices common to both references

- Establish a valid positive control before a denial or security assertion.
- Re-read durable state after every rejected or replayed mutation.
- For a valid mutation, verify the target record, an unchanged comparison
  record, and persistence after refresh or reauthentication.
- Do not award credit for a toast without confirming the resulting state.
- For filters and searches, begin with multiple records and inspect every
  visible result.
- Check boundary values on both sides when rules use thresholds.
- Ensure terminal states reject every later mutation without side effects.
- Verify derived totals from their visible inputs rather than trusting a
  hard-coded dashboard number.
- Re-check roles and permissions at action time, not only when a session is
  created.
- Keep criteria independent or explicitly restore shared state between them.
- Run the submitted app as an unprivileged user and reject symlink-based
  escapes.
- Pin verifier tools and install them in `tests/Dockerfile`; `test.sh` must not
  download packages at trial time.

## Coverage mapping

A machine-readable coverage map is strongly recommended even though the two
reference packages are inconsistent: OrbitalOps includes
`tests/coverage.json`, while BazaarBridge does not include one.

When present, the map should list every requirement, its source, the verifier
category and criterion IDs that cover it, and the positive evidence used. It
must also support a measurable claim that Functional covers more than 80% of
requested functionality.

Place verifier-consumed coverage data under `tests/` so it is available in the
separate verifier image. A root-level authoring copy is acceptable only if it
is not needed at verifier runtime. Never leave references to a removed
dimension or renamed criterion.

## Packaging and upload

The upload ZIP must contain exactly one top-level wrapper directory. The ZIP
stem and wrapper name must be identical:

```text
dropline_connect_four_lite.zip
└── dropline_connect_four_lite/
    ├── task.toml
    ├── instruction.md
    ├── environment/
    ├── solution/
    └── tests/
```

Do not package reports, handoffs, jobs, generated databases, logs, screenshots,
secrets, local tool configuration, caches, unrelated references, or a second
nested copy of the task.

Before delivery, inspect the ZIP central directory rather than assuming the
local folder layout was preserved. Confirm shell files use LF line endings and
retain executable behavior in Linux.

## Score and run acceptance

Current admin acceptance targets:

- Oracle/reference: `> 0.95`.
- Oracle Functional dimension: `1.0`; every Functional criterion passes.
- `gpt-5.4-mini`: `0.1 <= reward <= 0.7`.
- Haiku: run it; any result `< 0.7`, including `0`, is acceptable.

A high Oracle aggregate cannot excuse broken golden functionality. Conversely,
a low Haiku score is not a reason to weaken the verifier.

The local RL scorecard still provides useful additional checks: no-op near
zero, known-wrong rollouts low, stable repeat scoring, non-inverted reward
ordering, and multiple distinct reward levels. Treat these as quality evidence
unless a newer delivery checklist says otherwise.

## What the current references demonstrate

| Area | BazaarBridge Marketplace | OrbitalOps |
| --- | --- | --- |
| Task name | `turing/bazaarbridge-marketplace` | `turing/orbitalops` |
| Categories | Render, Constraints, Functional, Polish | Render, Constraints, Functional, Polish |
| Reward | Gated `0.6 Functional + 0.4 Polish` | Gated `0.6 Functional + 0.4 Polish` |
| Judge | Codex, `openai/gpt-5.6-luna` | Codex, `openai/gpt-5.6-luna` |
| Instruction split | Six files under `/instructions` | Three files under `/docs` |
| Seed | JSON under environment | Excel under environment plus verifier copy |
| Coverage map | Not packaged | `tests/coverage.json` |
| Oracle | `1.0`; all four dimensions `1.0` | `1.0`; all four dimensions `1.0` |
| GPT-5.4-mini | `0.585` | `0.48` |

Both model scores land inside the requested `0.1–0.7` range while both golden
solutions pass all functionality. BazaarBridge's lost reward is concentrated
in settlement arithmetic and polish; OrbitalOps creates useful separation with
authorization, command-state, and operational boundary cases.

## DropLine Connect Four Lite: current gap analysis

Working source: `projects/dropline-connect-four-lite/`

Already aligned:

- `task.toml` uses `turing/dropline_connect_four_lite`.
- The prompt is short and human-readable.
- Detailed behavior is split across five small instruction files.
- The golden solution is a real Node/Express/SQLite app with bearer sessions,
  account-isolated state, server-owned gameplay, and a vanilla browser UI.
- Existing Functional criteria use deterministic sequences for gravity, all
  win directions, both colors, draw, terminal locking, reset, and persistence.
- Judges already use Codex with `openai/gpt-5.6-luna`.

Required rework before new runs:

1. Remove `tests/aesthetic/` and move any still-required visual/product-quality
   coverage into Polish.
2. Replace the five-dimension `tests/reward.toml` contract with the four-
   dimension 0.6/0.4 policy.
3. Add explicit gate post-processing to `tests/test.sh`; its current runner
   leaves RewardKit's generic weighted mean in place.
4. Update `task.toml` metadata that still says “five-dimension” and
   “aesthetics”; bump the task version when the contract changes.
5. Update the coverage map to remove Aesthetic references and prove more than
   80% Functional coverage. By the current map, only 6 of 11 requirements have
   direct Functional coverage (`54.5%`); the other five are mapped only to
   Render, Constraints, Polish, or preflight checks.
6. Prefer `prompt.md` beside each `judge.toml`, matching both current
   references and keeping judge configuration separate from instructions.
7. Reconcile the verifier image with the newer Codex configuration used by the
   references, including noninteractive approval/sandbox and Playwright MCP
   setup, then validate it in Docker.
8. Run static checks, golden API/browser checks, Oracle, `gpt-5.4-mini`, and
   Haiku. No current Lite run evidence establishes the new score gates.
9. Build `dropline_connect_four_lite.zip` with the single wrapper folder
   `dropline_connect_four_lite/` and inspect its contents.

The local working directory may retain its historical hyphenated name. The
delivery ZIP and extracted wrapper should use the matching snake_case name
shown above.

## Authoring checklist

Before verifier work:

- Confirm taxonomy, scope, natural prompt, `turing/` name, and runtime contract.
- Keep the main instruction at 20 lines or fewer or split it cleanly.
- Make all referenced docs/assets available in the agent environment.
- Build a golden solution that implements every rule, including negative and
  boundary behavior.

Before model runs:

- Confirm exactly four verifier directories and no Aesthetic references.
- Confirm Functional coverage exceeds 80% and every criterion is executable.
- Parse every TOML and JSON file.
- Build both environment and verifier Docker images.
- Run the app unprivileged and verify startup, health, persistence, and
  same-origin browser behavior.
- Confirm the reward gate with synthetic dimension values.
- Confirm Oracle Functional is perfect before accepting an aggregate score.

Before delivery:

- Run Oracle and require `>0.95` plus perfect Functional.
- Run `gpt-5.4-mini` and require `0.1–0.7`.
- Run Haiku; do not “fix” a valid below-0.7 result merely because it is zero.
- Run upload checks and final static/QC review.
- Package one matching wrapper folder and exclude all local artifacts.
- Retain task ZIP, requested run ZIPs, evaluation evidence, and any requested
  report or case study outside the task package.

## Repository note

As of 2026-09-02, the worktree is being reorganized: the old tracked
BazaarBridge folder, the prior DropLine handoff, and older deliverables appear
deleted, while the new packaged BazaarBridge and OrbitalOps references are
present under underscore-named project directories. Preserve that reorganization
and do not restore historical files unless explicitly requested.
