# PatchPad 2.0.10 — Harbor-managed judge template

Upload archive: `patchpad-editor-v2.zip` (30 files; exactly one `patchpad-editor-v2/` wrapper).
SHA-256: `174dd9a0b2ca9cd2809c2ed9fd4da2aad5c63b2d9575a35ce66667919d0a162a`.

## Changes

- Agent and separate verifier remain public.
- `task.toml` forwards only the platform `OPENROUTER_API_KEY` placeholder, without the OpenAI key alias or base-URL override.
- All four dimensions retain Codex, `openai/gpt-5.6-luna`, high reasoning effort, and their existing criteria/weights.
- Removed task-side installation of Codex, Playwright MCP/Chromium, RewardKit and judge-only Python packages. Removed the task's Codex provider/MCP configuration; Harbor must supply and configure this runtime.
- `test.sh` already had no key/provider setup and is unchanged, as are startup readiness, manifest parsing, restart helper and reward computation.
- Agent Dockerfile now explicitly installs ca-certificates, curl and coreutils, updates the trust store and asserts a nonempty certificate bundle.
- Release metadata updated consistently. Golden JavaScript, instruction bodies, all 35 criteria, seeds and runtime dependency versions are unchanged.

## Validation and limitations

`package-audit.json` records 172 passing structural assertions, unchanged-behavior comparisons against the immutable 2.0.9 ZIP, source hashes, archive CRC/inventory and exact source-to-ZIP hashes. Scripts/text are LF, and no extra reports, databases, dependencies or credentials are in the ZIP. Judge timeout sum 10,550s < wrapper 12,000s < verifier 12,600s.

Current-source browser and harness tests run offline with the old `patchpad-preflight-tests:2.0.9` image supplying LOCAL test tools. They do not establish compatibility of the new verifier image or Harbor's tool injection. Fresh results belong only in this folder; historical results and ZIPs remain untouched.

The completed regression container exited 0. Passed: shell/Node syntax; RewardKit discovery (35 criteria); empty-submission zero; 5 valid and 6 invalid manifest cases; 6 QC browser groups; 6 baseline browser groups; 2 real persistence restarts with route-documentation checks; 8 previous-Oracle-failure groups; 6 Unicode/mouse/clipboard variants; 14 additional groups including server rejection and concurrent save behavior; harness startup/restart/cleanup and stub aggregation; 2 negative controls for reseeding/missing route docs; and 3 targeted document-end, scoped revision preview/restore-undo, and empty-line cut/fresh-Find checks. Fresh JSON evidence and logs are in this folder. No actual model was called.

Fresh agent and verifier Docker builds failed while resolving the local configured proxy `ioclrndwg1.ds.indianoil.in`. A container-only direct HTTPS diagnostic also timed out. No host proxy, DNS or security settings were changed. Therefore exact new-image builds and bootstrap HTTPS are NOT validated.

Harbor must provision the judge CLI, RewardKit, a working browser/MCP and OpenRouter provider configuration inside the separate verifier. This follows the lead's message, but the supplied BazaarBridge template still installs these dependencies and the actual platform provisioning mechanism has not been verified here. A standalone build is not a self-contained judging image anymore.

No paid Oracle/model or platform QC run was started. Do not call historical scores or local stub rewards a new Oracle result. Upload to the platform for fresh infrastructure/QC and Oracle validation before treating this release as accepted.
