# Brickfall 2.0.2 — Harbor-managed judge template

Upload archive: `brickfall-breaker-arcade.zip` (30 files; exactly one `brickfall-breaker-arcade/` wrapper).
SHA-256: `d841ad86661e85b993bdf154b150e1d9050a8f0879e4ebeb53e6159dd98ad400`.

## Changes

- Agent and separate verifier remain public.
- `task.toml` forwards only the platform `OPENROUTER_API_KEY` placeholder, without the OpenAI key alias or base-URL override.
- All four dimensions retain Codex, `openai/gpt-5.6-luna`, high reasoning effort, and their existing criteria/weights.
- Removed task-side Codex, Playwright MCP/Chromium, RewardKit and judge-only Python installations, local Codex provider/MCP configuration, and the version-specific RewardKit source patch. Harbor must supply/configure the judge runtime.
- `test.sh` already had no key/provider setup and remains unchanged, including readiness and reward computation.
- Agent Dockerfile adds curl/coreutils and validates the existing certificate trust-store setup.
- Release markers updated consistently. Golden JavaScript, instruction bodies, all 27 criteria, shared browser gates, seeds and runtime dependency versions are unchanged.
- The archived `projects/brickfall-breaker-arcade-v0` is untouched.

## Validation and limitations

`package-audit.json` records 168 passing structural assertions, unchanged-behavior comparisons against the immutable 2.0.1 ZIP, source hashes, archive CRC/inventory and exact source-to-ZIP hashes. Scripts/text are LF; no reports, databases, dependencies or credentials are in the ZIP. Judge timeout sum 4,260s < wrapper 6,300s < verifier 7,200s. The pre-existing unspecified build timeout still uses the platform default.

Current-source tests passed offline in `brickfall-tests:2.0.1`, which supplies LOCAL test tools: shell/Node syntax, discovery (2 Render / 2 Constraints / 16 Functional / 7 Polish), empty-submission zero, all four fresh-context browser gates without state mutation, 12 browser regression groups, and golden runner startup/cleanup with stub aggregation. The injected 0.7 is only a harness calculation test, not an Oracle score.

Fresh verifier Docker build failed on local proxy DNS resolution (`ioclrndwg1.ds.indianoil.in`). The agent build stalled in its apt step and was cancelled; no completed new agent image was obtained. A container-only direct HTTPS diagnostic also timed out. No host network settings were changed.

Harbor must provision Codex, RewardKit, browser/MCP and OpenRouter provider configuration inside the separate verifier. This follows the lead's message but has NOT been confirmed by a completed platform run; the supplied BazaarBridge Dockerfile still installs these tools. The new image alone is no longer a self-contained judging environment.

No paid Oracle/model or platform QC was run. Local tests in the historical tool image do not validate the new Dockerfile or Harbor injection. Fresh platform infrastructure/QC and Oracle remain required; no score guarantee is made. Historical ZIPs and reports are unchanged.
