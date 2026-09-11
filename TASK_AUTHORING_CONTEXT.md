# Current WebDev Task Authoring Context

Updated: 2026-09-11

Today's complete lead guidance, QC and Oracle lessons, fixes, and open decisions
are recorded in [TASK_LEARNINGS_2026-09-11.md](TASK_LEARNINGS_2026-09-11.md).

Latest PatchPad correction: `1.0.0-rubric-coverage-provenance` explicitly grades
document line numbers, identifies all five prompt revisions as plain text,
logs exact verifier file hashes, and removes other-product wording. The latest
QC finding supersedes blanket removal of prompt-version markers: remove code
comments, retain version metadata. No new platform QC or Oracle pass is claimed.

## September 11: mandatory Bazaarbridge commerce template

Read `TASK_TEMPLATE_STANDARD.md` first. It is the current configuration and
manual-QC contract and supersedes all older four-dimension, timeout, model-key
and semantic-version rules below. Reference: `projects/bazaarbridge-marketplace-commerce/`.
Active PatchPad source is `projects/patchpad-editor-v2`, migrated from 2.0.16
to standard version `1.0.0`; new evidence lives in
`deliverables/patchpad-editor-v2/1.0.0-docketlight-procedures/`.
The three failed Oracle criteria now follow Docketlight's Setup / graded
observations structure. Setup navigation can adapt to the app while required
real editor actions and exact outcomes remain graded. Golden presentation now
uses a clear report heading, section emphasis, contained desktop scrolling and
larger readable revision previews. 29 browser regression groups and 108
structural checks passed; the preview is on localhost:3035. No new full Oracle
pass is claimed. The previous run analysis remains under 1.0.0-oracle-reliability.
All five September 11 supplied trials were reviewed: Oracle 0.8877, Gemini
0.5678, GPT-5.4 mini 0.5291, Haiku 0.3033 and no-op 0. The three failed Oracle
Functional checks pass local browser reproduction on unchanged golden code.
Their procedures now use immediate plain-text checkpoints, verified clipboard
targets, supported gutter anchors and bounded recovery for judge-only errors.
No new full Oracle is claimed; native judge action traces were not exported.
See RUN_REVIEW.md in that release for all 156 scored criterion observations.
The user subsequently adopted Docketlight's top-level judge weights:
Functional 0.6, Polish 0.2, Visual 0.2; Render and Constraints remain 1.0.
This replaces the previous 4/3/2 scored-dimension weights. Final test.sh
scoring remains gated 60/20/20. All individual criterion weights are preserved.
Four Functional verifier descriptions now allow the app's actual API identity
locations, selection-driven scroll container, indentation width and consistent
coordinate display base. Exact behaviors and all criterion weights are preserved.
The shared prompt explains normalization and conditional identity probes.
Fresh QC is needed after the Docketlight weight alignment. RewardKit 0.1.7's
built-in total still includes the positive gate judge weights; test.sh writes
the final gated 60/20/20 total. Credit for nonfunctional shells remains unresolved.
Additional potential verifier assumptions are recorded in the conversation
and are deferred at the user's request until QC flags them.
Code/config comments and prompt-version banners were removed at the user's
request; executable shebangs and meaningful Markdown headings remain.
The Visual prompt now has the explicit same-origin/server-backed browser gate
after the platform's missing-gate static finding; fresh platform QC is pending.
The main request is now a short product brief with seed/spec pointers; required
runtime and manifest details are consolidated in overview.md.
The user subsequently removed PatchPad responsiveness: Visual has five
equally weighted desktop-only criteria and retains its 20% reward share.
Historical run scores below do not validate this new five-dimension package.


## September 10: Agent bootstrap and release preflight

This entry supersedes older GridForge version notes below. GridForge is now
`2.0.10`; its upload ZIP is
`deliverables/gridforge/gridforge-v2-2.0.10-validation/gridforge-spreadsheet-v2.zip`.
Agent and verifier networking are public; the verifier remains separate.

GridForge release files now live together under `deliverables/gridforge/`, with
one existing version folder per release. `deliverables/gridforge/README.md`
identifies the latest upload. Each version contains only one task upload archive,
`gridforge-spreadsheet-v2.zip`. Duplicate `*-task.zip` aliases were removed only
after SHA-256 equality was verified; retained ZIP bytes and historical reports
are unchanged. Older report archive names refer to these former aliases.
The packager now emits only the canonical name for GridForge. Editable source
stays at `projects/gridforge-spreadsheet-v2/`; the older
`projects/gridforge-spreadsheet/` is a separate legacy task, not a delivery copy.
Inside each upload ZIP, retain the one `gridforge-spreadsheet-v2/` wrapper required
by the portal. Do not add the outer `gridforge/` release collection to the ZIP.

Platform run `run-ce624351` used OpenHands SDK `1.44.1` with
`gemini/gemini-3.7-flash`. It ended after about 12 seconds during agent setup:
`curl (77) error setting certificate file: /etc/ssl/certs/ca-certificates.crt`.
The minimal agent image installed curl with `--no-install-recommends` but did
not explicitly install `ca-certificates`. The previous local agent image also
confirmed the bundle was absent. No model execution or verification occurred;
the displayed zero is not a measured task score or a model-breaking result.

Fix: explicitly install `ca-certificates` in the AGENT Dockerfile, run
`update-ca-certificates`, and assert that the bundle is nonempty at build time.
Do not assume a successful verifier/Oracle run validates agent installation:
Oracle can bypass the OpenHands bootstrap, and the verifier is a different image.
Public network permission does not supply TLS trust roots or bootstrap tools.
Never work around this by disabling certificate verification.

Validation for this release: agent image built successfully; a certificate-
verified GET of the exact failed URL, `https://astral.sh/uv/install.sh`, returned
HTTP 200; all 34 local structural checks passed. Golden implementation, verifier
criteria/weights, and dependency versions are unchanged from 2.0.9. Only agent
trust-store setup and release metadata changed. The installer itself, remaining
SDK setup steps, paid model run, and fresh Oracle were NOT run in this validation.
The evidence is in `bootstrap-fix-report.json` beside the ZIP. This establishes
the fix for the observed error, not a guarantee of all later platform stages.

Before future uploads, build BOTH images and test the selected agent's bootstrap
prerequisites, including secure HTTPS from inside its exact image. Perform this
before spending time on platform QC. Preserve old ZIPs/evidence, compare changed
files, and update only root package versions, never dependency versions through
global text replacement. An updated ZIP may trigger platform QC again; do not
promise reuse of previous QC or bypass platform checks.

Common Ground QC work was interrupted for this diagnosis. Its saved 1.0.7 source
is not yet packaged or fully re-audited. Read
`deliverables/common-ground-ballot-1.0.7-validation/README.md` before continuing;
the historical 1.0.6 Oracle 1.0 must not be presented as a new 1.0.7 result.

## September 9 merge resolution

This update supersedes older network and current-version notes below. Active
sources are PatchPad `2.0.4` and GridForge `2.0.8`. Both agent and verifier
environments now use public networking, as requested. Dependency installation
during development is allowed; the required custom editor/grid and locally
served runtime resources remain part of each brief.

The merge retains incoming GridForge brief/bootstrap-tool fixes and PatchPad's
separate seed, custom-surface and unsaved-discard checks. It also retains the
locally tested PatchPad focus/clipboard fixes, Escape-to-Find behavior, flexible
word navigation, manifest parser contract and API documentation check. PatchPad
uses only `tests/app-lifecycle.sh` and one restart criterion, not two competing
lifecycle helpers or duplicate restart rewards. It has 35 criteria in total:
2 Render, 2 Constraints, 27 Functional and 4 Polish.

Previously exported ZIPs and run evidence remain historical, not evidence for
these merged source versions. Repackage before uploading. Static validation
does not establish a new Oracle pass; Docker was unavailable during this merge.

## Latest QC and PatchPad handoff

The latest supplied rubric is root `WebDev Rubrics QC.xlsx`: 53 rows in
`Quality Checks` and 58 listed checks in `Deterministic Checks`. Use this newer
rubric for current submissions where it supersedes the historical scorecard
below. The workbook lists checks, not executable platform-checker code.

The active revised PatchPad task is `projects/patchpad-editor-v2/`, package
`turing/patchpad-editor-v2`, version `2.0.3`. The user explicitly requires this
name; do not rename it to patchpad-incident-editor. The latest platform result
reported 52/53 passed with only coverage failing; identity was not a remaining
failure. Other QC repairs are retained. Use the patchpad-editor-v2-2.0.3-task.zip archive; the previous
patchpad-incident-editor archive is superseded. The older submitted PatchPad
and GridForge tasks were not changed.

On September 7, nine platform findings were traced to overlapping problems:
hidden database-extension constraints, ambiguous stale-draft handling, a Tab
indentation/focus-traversal contradiction, an unstated visible match count,
platform-specific word boundaries, a version-suffixed identity, and missing
prompt version/copy-edit residue. The brief, reference, and tests were aligned.
Escape now leaves the editor for Find; Tab still indents. Both common word
boundary conventions are accepted, with exact coordinate/clipboard checks.

Evidence and the corrected task ZIP are under
`deliverables/patchpad-incident-editor-validation/`. Read
`patchpad_qc_rework.json` for the nine dispositions and 53-check inventory.
Local unpaid checks cover 22 browser regression groups, 11 manifest cases,
RewardKit discovery, syntax, and empty-submission zero scoring. This is not a
full Oracle or a new 53/53 platform verdict; upload QC and a complete Oracle
remain to be run. No paid model calls were made for this repair.

The final reported coverage gap concerned server restart idempotence and
manifest API-route documentation. Two Functional criteria now cover those
requirements, giving 33 total criteria (2 Render, 2 Constraints, 25 Functional,
4 Polish). `tests/app-lifecycle.sh` is trusted verifier infrastructure, shared
by test.sh and the restart criterion; it restarts npm start without resetting
SQLite or calling solve.sh. Judge terminal use is narrowly permitted to read
the manifest as documentation and invoke that helper. Golden tests verified
two process replacements preserve the saved report and entire revision history.
Disposable broken copies proved startup reseeding and missing route docs fail.
The harness was also tested with a local stub to verify restart cleanup and
score aggregation; that injected test score is explicitly not an Oracle result.

Oracle `run-74864554` (export under `run-outputs/patchpad-editor-v2/`) completed
on version 2.0.2: reward 0.8143, Functional 0.6905, other dimensions 1.0,
25/33 criteria passed, no-op zero. Both new coverage criteria passed. Eight
failures concerned Unicode, paste/cut, Find, restore Undo, and multi-caret paths.
The action trajectory was not exported; do not call every failure an app bug.
Local reproduction confirmed clicked Find Next and Restore Draft left button
focus, whereas held-modifier multi-caret and atomic paste/cut worked.

Version 2.0.3 returns focus after clicked Find/Undo/Redo/Replace and asynchronous
Restore Draft, while keyboard Find cycling keeps input focus. The verifier now
copies selected document text after Escape, establishes an exact paste baseline,
requires actual held modifiers and waits for clipboard/API completion without
issuing rescue actions. All eight failure paths have exact regression checks in
`oracle-failures-regression.cjs`, including both Alt/Control multi-carets and
keyboard/button restore Undo. Their local pass is not a fresh full Oracle score.

Keep the human product voice. Do not make requirements vague to induce model
failure or pin undocumented reference-only behavior. A prompt-version marker
helps trace evidence but does not make an LLM judge deterministic.

This is the current shared standard for WebDev/RL task authoring in this
repository. It combines the latest admin instructions, the root validation
files, and the strongest patterns from the extracted BazaarBridge Marketplace
and OrbitalOps packages. Newer written admin guidance overrides this document.

## Start here

Use `MODEL_BREAKING_PLAYBOOK.md` as the concise cross-device workflow. It
contains the reusable lifecycle roles, Ripple Effect verifier method, fair
hardening rules, run-validity checks, delivery boundary, and restart checklist.
Use this longer file for the exact current platform contract, historical
lessons, and active task status.

Three external methodology notes were reviewed and distilled into that
playbook on 2026-09-04. They remain secondary to current admin guidance:

| File | SHA-256 |
| --- | --- |
| `delivery-v3.md` | `22D2E61C13DFF589F7738B633007872584F2ADF323941DA44678B2E37BECB021` |
| `restructure-v2.md` | `0C20D1B7BBB2101C60FEADDE6EBBAC9BF4FA88FD80844E648C3550FEFE018169` |
| `MODEL_BREAKING_PROMPT.md` | `F8997D2962158DA8DB8C638AF1DC0E5B87427FF929117C12AD7B8AE1E57882FB` |

The colleague lessons incorporated there are: use an internal `<= 0.5` target
to leave margin under the formal keeper ceiling; prefer coupled lifecycle,
payroll, civil, and game behavior over easy standalone calculations; grade
secondary and tertiary consequences through the Ripple Effect; revalidate hero
verifiers when they unexpectedly fail; and use parallel local runs only after
proving isolation and resource headroom.

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

Archived tasks and exported runs are reference-only. Removed legacy folders,
including the former `old-qc-and-formats/` archive, are not required because
the durable lessons have been consolidated into the two root context files.
Do not include archived material in routine task QC unless the user explicitly
asks for an archival comparison or investigation.

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

Use exactly five verifier categories under `tests/`: `render`, `constraints`,
`functional`, `polish`, and `visual`. Each contains `judge.toml` and `prompt.md`.
Use the matching reference judge configuration; keep `[judge]` but omit the
`judge` and `model` keys and add no configuration keys. Inherit common provider,
model and max reasoning from the reference task environment and Docker setup.
See `TASK_TEMPLATE_STANDARD.md` for exact keys, common timeouts and visual anchors.
Keep appearance in Visual and concrete interaction usability in Polish.

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
    reward = 0.6 * functional + 0.2 * polish + 0.2 * visual
```

Use the reference five-dimension declaration:

```toml
[[reward]]
name = "reward"
aggregation = "weighted_mean"
weights = { render = 0.0, constraints = 0.0, functional = 0.6, polish = 0.2, visual = 0.2 }
```

RewardKit does not supply the hard gate by itself. `tests/test.sh` must read and
validate all five dimension scores, apply the gate, and atomically replace the
final reward outputs. Startup, judge, parsing, or post-processing failure must
leave a complete zero-reward record with the same five dimension fields.

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
    visual/
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
- Put exact deterministic verifier values in the mounted instructions or a
  verifier-visible scenario asset. Never make the judge infer hidden timing,
  scoring, seed, or checkpoint state from the golden implementation.
- Expose semantic gameplay telemetry for browser verification: stable entity
  identifiers, held/moving state, positions, velocities, active effects, and a
  bounded event stream. Canvas pixels alone are too ambiguous for exact rules.
- Exercise every mutating route's operation receipt, including successful and
  known-4xx replays, revision conflicts, and operation-ID payload mismatches.
- A latest-ten history needs both ten retained snapshots and tombstones for
  older terminal run IDs; otherwise a pruned run can be submitted again.
- Prevent autosave from racing level-complete, finish, or progress mutations.
  Freeze conflicting controls while a mutation is pending and reconcile stale
  responses from authoritative server state.
- Check pointer behavior through overlays as well as visual appearance; an
  invisible full-screen layer can leave a polished game entirely unplayable.

### Version, baseline, and ZIP integrity

- Keep the standard version `1.0.0`. Any instruction, judge, golden solution or
  frozen-baseline change requires new source/ZIP hashes, dated release evidence
  and fresh validation, without overwriting historical packages.
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
- Keep secrets and disposable runtime databases/logs out of commits. A captured
  model database or log may be retained only when it is required to reproduce a
  run artifact, is contained in the evidence archive, and passes an exact
  external-secret scan. Never include `.jwt_secret`, expanded API environment,
  or raw completion dumps.
- An infrastructure failure is not a task/model score. The current DropLine
  GPT-5.4-mini attempt identified as `run-c866d723` stopped because the Daytona
  organization had depleted credits; do not report it as a valid model or NOP
  result.
- A numeric reward is invalid when a judge timed out, reasoning is blank, the
  agent was killed by provider failure before finishing, or the task version,
  checksum, or configuration differs from the submitted package. Never repair
  those cases with a detached verifier-only rerun and present it as an untouched
  end-to-end run.
- For Windows PowerShell, JSON-valued `--ak` arguments need escaped inner quotes
  so Harbor receives an object. Validate with `--print-config`; otherwise a
  value such as `model_info` becomes a string and OpenHands raises
  `'str' object has no attribute 'get'` before model execution.
- DropLine v6.0.3 now has exact-package Oracle, GPT-5.4-mini, and Haiku evidence
  sharing task checksum
  `c7400c4c34da652f7e4d050c40a063e4aa4fd4ffeacd3b6aa4ecd092d10aa528`.

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

### Current implementation and evidence (version 6.0.3)

- The working folder, npm package, task name, and delivery slug use
  `dropline-four-lite`.
- `task.toml` uses `turing/dropline-four-lite` and version `6.0.3`.
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
- Both `[environment]` and `[verifier.environment]` use `network_mode =
  "public"`. Harbor Docker does not support verifier `allowlist`; retaining it
  creates an immediate launcher error and invalidates end-to-end grading.
- Constraints has a 900-second judge timeout, Functional 2400 seconds, Polish
  1800 seconds, and Render 480 seconds. A timed-out dimension with blank
  reasoning is infrastructure failure, not a genuine zero.
- The upload ZIP contains 28 files beneath exactly one
  `dropline-four-lite/` wrapper. `tests/coverage.json` remains an authoring file
  and is intentionally excluded from the platform archive.
- Version 6 has passed local API, real-Chromium, exact-draw/undo/redo regression,
  two-tab conflict, all-session revocation, 11-record/latest-ten archive lifecycle,
  request-result replay, keyboard-focus, 375-pixel replay, and reduced-motion checks.
- Exact v6.0.3 Oracle scored `1.0000`: all four dimensions and all 22 criteria
  passed, including 13/13 Functional criteria.
- Exact v6.0.3 GPT-5.4-mini scored `0.5390`: Render `1.0`, Constraints `1.0`,
  Functional `0.6316`, and Polish `0.4`. OpenHands 0.62.0 reached `FINISHED`,
  with no exception or no-op, and every criterion has non-empty reasoning.
- Exact v6.0.3 Haiku scored `0.3327`: Render `1.0`, Constraints `1.0`,
  Functional `0.4211`, and Polish `0.2`; all 22 criteria have reasoning and no
  judge timed out. Haiku built the graded app but then self-terminated
  OpenHands with `pkill -f "node /app/server.js"`, producing exit 143. Preserve
  this as a transparent model-caused exception rather than infrastructure zero.

### Remaining platform and delivery work

1. Run the final static/upload QC after refreshing all v6.0.3 reports and hashes.
2. Upload the nested `dropline-four-lite.zip` and confirm the platform's own
   batch checks accept the public network configuration.
3. Run Sonnet 4.5 only if the strict multi-model delivery checklist is enforced;
   the reviewer-requested Oracle, GPT-5.4-mini, and Haiku runs are complete.
4. Add eight-rollout and three-repeat statistics only if those scorecard rows
   are treated as mandatory rather than unmeasured follow-up.

### Current high-risk QC items

| Check | Current status | Reason |
| --- | --- | --- |
| A2 real provenance | Platform confirmation needed | Metadata truthfully identifies the tracker assignment and task owner's live request; the platform must decide whether that provenance meets its real-traffic bar. |
| A3 natural source voice | Addressed in source | The main prompt retains lowercase, terse human wording instead of formal checklist prose. |
| B1 complete mapping | Addressed in source | All 18 requirements map to live criterion IDs; concurrency and records requirements are instruction-backed. |
| D2 hard gate | Addressed in source | The runner validates four dimensions and applies the exact gate/formula. |
| E2 frozen/hash-recorded baseline | Partial in scored package | Version 6.0.3 records both seed copies and golden-file SHA-256 values, but packaged `solution/app/server.js` has mixed LF/CRLF bytes and does not match its recorded LF-normalized hash. |
| Functional `>80%` | Addressed in source | Defined denominator is 15 functional requirements; Functional covers all 15 (`100%`). |
| Four categories only | Addressed in source | Only Render, Constraints, Functional, and Polish remain. |
| Three-word dash naming | Addressed in source | Source/task/npm/delivery slugs use `dropline-four-lite`. |
| Docker/runtime checks | Passed locally | Exact v6.0.3 Oracle, GPT, and Haiku launched and completed the full verifier under Docker. |
| Run evidence | Addressed | All three runs share the exact submitted task checksum; GPT is 0.5390 and Oracle is 1.0000 with 13/13 Functional passes. |
| Haiku agent exit | Transparent model failure | Haiku's artifact received a complete 0.3327 grade, but its final broad `pkill` command self-terminated OpenHands with exit 143. |
| Delivery set | Addressed for requested runs | Nested task ZIP, Oracle/GPT/Haiku evidence ZIPs, evaluation report, case study, and QC files are grouped under the final package. |

The post-run local preflight emulating the documented rules passes all 26 upload
checks and 18 of 19 source-decidable scorecard items. The sole failure is the
packaged `server.js` byte-hash mismatch caused by mixed line endings; correcting
it would change the exact task checksum and therefore requires new run evidence.
This is not a platform
Rules result; treat the platform checks as unverified until an upload passes.

## Current Brickfall audit snapshot

Working source reviewed:
`projects/brickfall-breaker-arcade/`

- The canonical three-word slug is `brickfall-breaker-arcade` and the current
  task version is `2.2.1`.
- It has exactly four verifier categories: 2 Render, 2 Constraints,
  16 Functional, and 7 Polish criteria. Render or Constraints failure gates the
  reward to zero; otherwise the reward is `0.6 * Functional + 0.4 * Polish`.
- The long contract is split into eight mounted instruction files of no more
  than 20 lines. Exact level manifests, constants, seeded checkpoints, drill
  outcomes, concurrency rules, receipt replay, latest-ten history, and terminal
  run tombstones are instruction-backed and verifier-visible.
- The v2.2.1 Oracle scored `1.0` in Render, Constraints, Functional and Polish.
  All 27 criteria passed, including every one of the 16 Functional criteria.
- The v2.2.1 GPT-5.4-mini regrade scored `0.2182`: Render `1.0`, Constraints
  `1.0`, Functional `0.0`, and Polish `0.5455`. The model's initial signed-out
  bootstrap rendered its form without binding the submit handler, so sign-in
  became a GET navigation and every authenticated Functional scenario remained
  inaccessible. This is a model-artifact failure, not a golden/verifier failure.
- Formal post-run local QC passed 29/29 executable assertions, all 19 active
  upload rules, and four optional rules; three disabled rules are not applicable.
  The checks cover TOML/JSON/Node/shell syntax, both Docker images and their baked
  tooling, no-op scoring at `0.0`, reward post-processing, package/ZIP structure,
  run-result parsing, and the model/Oracle thresholds. Functional coverage
  remains 14/14 (`100%`).
- The task ZIP contains exactly 31 allowlisted source files beneath one matching
  wrapper directory, and its extracted contents match the reviewed source.
  Runtime dependencies, databases, logs, caches, screenshots, and temporary test
  material are excluded. Both canonical Dockerfiles build successfully.
- The canonical verifier remains restricted to `openrouter.ai`. Disposable local
  run mirrors used public verifier networking only because this Windows Docker
  kernel cannot enforce Harbor's nft allowlist; that local workaround was not
  copied into the canonical task.
- Early Haiku attempts failed during setup or entered a zero-context condenser
  loop. The corrected run supplied explicit 200,000-input/8,192-output metadata,
  made 8,076,748 input-token and 118,863 output-token calls, and completed without
  an exception. Its first verifier handoff returned an ungraded no-op, but a
  regrade of the exact artifact produced a valid zero: Render `1.0`, Constraints
  `0.0`, Functional `0.0`, Polish `0.2727`, `graded=1`, and `no_op=0`. Haiku
  omitted the referenced `/game.js`, leaving `handleSignIn` undefined. The local
  Docker regrade used public verifier networking because Harbor regrade cannot
  enforce allowlists in Docker; all criterion files matched the canonical task.
  Sonnet 4.5 remains absent if the strict multi-model checklist is enforced.
- Post-run deliverables include `eval-report.md`, `case-study.md`,
  `qc-report.xlsx`, and `qc-findings.json`. The strict
  30-row scorecard records 23 passes, one partial, and six open measurement rows;
  those gaps require more robustness artifacts and are not source/golden defects.
- The drive-ready grouped copy is under
  `deliverables/brickfall-breaker-arcade/final-submission/`. It contains the task,
  GPT, and Oracle ZIPs plus the evaluation, case-study, and QC reports. Each ZIP
  stem matches its single internal wrapper (`brickfall-breaker-arcade/`,
  `gpt-run/`, `oracle-run/`, and `haiku-run/`), and every grouped copy matches its
  reviewed source SHA-256. The Haiku archive is sanitized, valid graded-zero evidence.
- Run-evidence validation confirms GPT and Oracle used the same frozen task
  checksum, every category returned its expected unique criteria, category
  scores recompute from criterion weights, and final rewards recompute from the
  hard-gate formula. GPT's 16 Functional failures are valid user-visible misses,
  but 15 are downstream authentication-blocked checks caused by its initial
  bootstrap returning before binding the sign-in handler; they are not 16
  independent root defects. Its five Polish failures also match the artifact.

## Current package snapshots

These hashes identify the packages assembled after the latest reviewed source
changes. Any later task edit invalidates the corresponding row and requires a
new semantic version, hash, and ZIP build.

| Task | Version | Source files in ZIP | ZIP SHA-256 |
| --- | --- | ---: | --- |
| `dropline-four-lite` | `6.0.3` | 28 | `A30778752EEAA2214C0B47CD93126E1EC866231267B0758EA5BDE1959A4FB98E` |
| `brickfall-breaker-arcade` | `2.2.1` | 31 | `9BEF39A6F1A02D1EC902CB09AAB1E8E15D822A9F44C7B5E93808376AF529F10F` |

## Brickfall cross-device handoff

As of 2026-09-04, `brickfall-breaker-arcade` version 2.2.1 is source-complete,
post-run checked and packaged. Do not rerun GPT-5.4-mini or Oracle merely for
packaging or documentation changes: their final evidence is exported under
`run-outputs/brickfall-breaker-arcade/gpt-run/`, `oracle-run/`, and `haiku-run/`,
with delivery archives `gpt-run.zip`, `oracle-run.zip`, and `haiku-run.zip`. Their
SHA-256 values are
`DFDA397DE6C02EEE076CF224C7070AD99BBA68852FF2A1D32364C8CB10915BC6`,
`BEE530B16488BA1E6729C358B2DD65553C2B010832FF9DC85DF5F24A7CADAA4B`, and
`1D39C21188234921E507EF1D48C701F8B40B14093C2F5BA5AE8534E0070270BA`.

The canonical task archive is
`deliverables/brickfall-breaker-arcade/brickfall-breaker-arcade.zip`; it contains
one matching wrapper and exactly 31 files. GPT-5.4-mini is inside the target band
at `0.2182`, and Oracle is `1.0` with 16/16 Functional passes. A rerun is required
only after changing the task contract, verifier, seed assets, or golden solution.
Haiku is complete for the stated project rule and is recorded at a valid graded
`0.0`; its exact captured artifact passed Render but failed Constraints because
the generated application omitted the referenced `/game.js`.
Sonnet 4.5 remains absent if the strict root delivery checklist applies.

## Final pre-delivery checklist

### Source and structure

- Canonical three-word lowercase dash-separated slug everywhere required.
- `turing/<task_name>` matches the package folder.
- Exactly five verifier directories, including Visual; no Aesthetic directory.
- Natural prompt with truthful provenance and no unchecked requirement.
- Correct stack and SQLite-backed bearer authentication.
- Minimal Harbor structure; no unrelated or generated files.
- Seed and baseline hashes recorded; version 1.0.0 with new checksums for changes.

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
