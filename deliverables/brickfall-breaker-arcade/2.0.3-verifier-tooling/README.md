# Brickfall 2.0.3 — separate-verifier tooling repair

Upload `brickfall-breaker-arcade.zip` from this folder. It contains exactly one
`brickfall-breaker-arcade/` wrapper and 30 task files. Historical ZIPs, the v0
project and other task releases are untouched.

SHA-256: `3ddae2ebc0fbfc9bbbe11a25894d615183c956cc00149a44adf793dd199e313c`.

## Repair

Applied the same missing-verifier-tool repair as PatchPad. Brickfall 2.0.2
removed judge dependencies under the unverified Harbor-supplied-tool assumption.
The actual platform check reported for PatchPad requires them in the separate
image, and Drawbill explicitly supplies them. This release removes that
dependency on unverified Harbor injection; it does not claim the older lead
no-install message and current static-check requirement are identical.

Restored Brickfall's previous pinned Codex 0.151.0, Playwright MCP 0.0.79,
RewardKit 0.1.7 and Chromium build, plus non-secret OpenRouter/MCP image
configuration. Restored Brickfall's prior version-asserted RewardKit command
patch for noninteractive MCP access; no RewardKit/model version upgrade.
Added build-time checks for the commands, RewardKit version, exact browser
executable and a real headless page launch, and image-time artifact parents.

Public networking for agent and separate verifier remains unchanged.
task.toml still uses only the platform OPENROUTER_API_KEY placeholder, with no
OpenAI alias. test.sh is byte-identical to 2.0.2 and has no key remapping/setup.
No credentials are embedded in task files.

All 27 criteria, their weights, prompts apart from release markers, seeds,
game implementation, browser gates, readiness and reward formula are unchanged.
Codex/openai/gpt-5.6-luna is unchanged in every dimension. Existing effort
settings are preserved: medium for Render/Constraints; high for
Functional/Polish, with high in task-level judge settings. This repair does
not quietly change their judging behavior.

## Fresh unpaid evidence

- `package-audit.json`: 145 passing local structural assertions, including
  unchanged criteria/configuration behavior, LF/UTF-8 for text, identical seed
  XLSX bytes, clean archive inventory/CRC and every member matching source.
- `local-checks.json` / `regression-result.json`: current-source offline
  regression completed with exit 0. Shell/Node syntax, RewardKit discovery
  (2 Render / 2 Constraints / 16 Functional / 7 Polish), empty-submission zero,
  golden runner startup/cleanup and trusted-stub aggregation all passed.
- `gate-regression.json`: all four fresh-context browser prerequisites passed,
  including unauthenticated denial and ranked-state nonmutation.
- `browser-regression.json`: all twelve browser groups passed, covering game
  mechanics checkpoints, persistence/request replay and mobile/same-origin
  rendering. The harness's injected 0.7 is a calculation test, NOT an Oracle.
- `tool-smoke.json`: exact new Dockerfile tool/browser assertions passed, and
  a fake loopback provider received the correct model and Authorization header
  using only OPENROUTER_API_KEY. Its intentional 401 tests transport only;
  no real provider call, key or model score was involved.
- `mcp-smoke.json`: real stdio MCP initialization, tool discovery, Chromium
  navigation, read-only page observation and browser close passed offline.

The fresh exact verifier image `brickfall-preflight-verifier:2.0.3` built
successfully, including its command/version and browser-launch assertions.
Image ID: `sha256:2e55c469ad4dc56f3321498d371df8276421d23c2a20a71be91b7f1852cbcccd`.
After an initial pass in the older tool image, the local regressions, real MCP
round trip and loopback-only provider wiring test were rerun in this exact new
verifier image. The final JSON evidence identifies that image explicitly.

The fresh agent build stalled at the Debian apt download step and was stopped
by the local 240-second build-attempt timeout. That local diagnostic timeout is
not a task configuration change. Therefore a fresh agent build and its HTTPS
bootstrap remain unvalidated. No host network/proxy settings were changed.
Exact build attempts/results are recorded in `build-results.json` and both
`*-build.log` files. A successful verifier image is not an agent-build pass.

No paid Oracle/model or official platform static/rubric run was launched.
Run fresh platform QC and Oracle on this ZIP; neither static 45/45 nor Oracle
1.0 is guaranteed. No instruction/criterion was weakened to improve a score.

The judge budgets remain 4260s total < 6300s wrapper < 7200s verifier. Agent
timeout remains 3600s. The pre-existing unspecified image-build timeout still
uses the platform default; no local claim establishes that live policy value.
The archive itself is LF even if Git warns about future autocrlf conversion.
