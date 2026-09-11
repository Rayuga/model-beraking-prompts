# Brickfall 2.0.5 — latest shared configuration standard

Source remains `projects/brickfall-breaker-arcade/`.
Upload only `brickfall-breaker-arcade.zip` from this folder.

SHA-256: `3eec17241ae36825ad8db8c67100db859ea7a9f4301afcff430a4fdb91a4ea13`

## Last status before this change

The active revised source was 2.0.4, not the legacy 2.2.1 task. Version 2.0.4
contained the reported rubric repairs: explicit digest/paused-speed semantics,
split terminal and drill criteria, anchored Polish scales, six HUD values,
mobile completeness, and larger nested timeouts. Its local checks passed;
no fresh platform QC/Oracle result for that revision was established here.

The preserved legacy evaluation report records Oracle 1.0000 (Functional 1.0000),
GPT-5.4-mini 0.2182 (Functional 0), and Haiku 0.0000. Those are historical
2.2.1 results and cannot validate the revised 2.0.4 or this 2.0.5 package.

## Standard-only changes

```toml
[verifier.env]
OPENAI_API_KEY = "${OPENAI_API_KEY}"
REWARDKIT_JUDGE = "codex"
REWARDKIT_MODEL = "gpt-5.6-luna"
REWARDKIT_REASONING_EFFORT = "max"
```

- Every dimension now declares Codex, unprefixed gpt-5.6-luna and max effort.
  Previously the gate dimensions used medium and the others high.
- Removed the verifier Dockerfile's custom OpenRouter provider and extra global
  MCP configuration. It now uses the reference's minimal max/never/danger-full-
  access configuration; dimension MCP settings and the exact pinned RewardKit
  noninteractive-launcher patch remain intact.
- The agent Dockerfile now initializes `/app` as a git workspace, matching the
  shared template. Existing curl/coreutils/certificate assertions and pinned
  runtime dependencies are retained, including Brickfall's XLSX tooling.
- Both networks remain public and verification remains separate. There is no
  `active_target_model` or `active_target_reasoning_effort` metadata. No actual
  credential is embedded, and test.sh has no provider/key/login remapping.
- Task, package, image labels and all prompt markers now say 2.0.5.

The reference files remain in
`references/task-templates/patchpad-openai-2026-09-11/`; no shared template was
modified. The OpenAI Docs skill confirmed that the [official model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
supports max reasoning. That does not establish platform account access.

All 33 criteria and their descriptions/types/weights, 60/40 scoring, instructions,
golden gameplay/server code, seeds, readiness, runner, dependencies and timeouts
are preserved. In particular the prior rubric repairs were not reverted.
There are 2 Render, 2 Constraints, 22 Functional and 7 Polish criteria.

## Fresh unpaid validation

- 84 deterministic source/preservation/package checks passed. The prior 2.0.4
  ZIP's SHA is unchanged, all criterion definitions compare identically, and the
  new ZIP has exactly 30 source-matching files beneath one canonical wrapper.
- Shell/server/client JavaScript syntax and actual RewardKit discovery passed.
- Empty submission produced no-op zero. A trusted local RewardKit stub tested
  orchestration and aggregate 0.7; **this injected value is not an Oracle score**.
  All 100 injected aggregation cases, 24 invalid-score rejections and five-point
  Likert normalization checks passed.
- Existing browser suites passed on fresh current source: four dimension gate
  prerequisites, twelve general golden groups and eight targeted rubric-repair
  groups. They cover authentication, seeded state, all seven mechanics drills,
  snapshots/reload/history, receipt replay, terminal finish/refresh/restart,
  paused speed/capping, Sticky release, six semantic HUD values and mobile layout.
- Native OpenAI loopback transport smoke passed: exact Docker config and launcher
  patch, synthetic key, unprefixed model, max reasoning and noninteractive command.
  It used cached pinned tools, redirected requests to loopback with networking
  disabled, and obtained no real model response or score.
- Git whitespace checks passed. Initial local regression attempt failed because
  the copied test harness lacked its expected-digests fixture. Added that fixture
  to this evidence folder only; the complete second attempt passed with no app fix.

Runtime tests used cached `brickfall-preflight-verifier:2.0.4` tooling with
current source mounted, not a completed new image. Exact 2.0.5 builds were
attempted with bounded 60-second diagnostics: the verifier stalled downloading
from PyPI and the agent stalled at Debian package downloads. See build logs and
`build-results.json` for recorded outcomes. No dependency was removed to bypass
those failures, and no proxy or TLS settings were changed.

## Remaining limits

No fresh paid Oracle/model or official platform QC was run. Local tests do not
execute the full Codex rubric, subjective ratings or every independent multi-tab
security scenario. Exact new image builds and agent HTTPS bootstrap are not
established. Public networking follows the latest explicit instruction but
conflicts with older no-network/allowlist rubric wording; platform policy still
needs confirmation. Existing weighting and runtime-fallback review risks were
not silently redesigned in this configuration-only change.

Next: upload this exact ZIP for fresh QC/Oracle. Oracle 1.0 is not guaranteed.
Historical releases, the v0 task, PatchPad and both GridForge tasks were untouched.
