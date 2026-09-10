# PatchPad 2.0.11 — separate-verifier tooling repair

Upload `patchpad-editor-v2.zip` from this folder, not the historical 2.0.10 ZIP.
Exactly one `patchpad-editor-v2/` wrapper contains 30 task files. Reports,
credentials, databases, node_modules and local test helpers are excluded.

SHA-256: `022fddb1882c7a811bbf3b18d835ce440bfb45badd2fc7fc60a07a18b4331f25`.

## Platform failure and fix

The supplied platform screenshot reports 44/45 Static checks passed and
`check-dockerfiles.py` failed: the verifier image did not provide Playwright
MCP, RewardKit or Chromium, although the judge invokes `playwright-mcp` and
expects `/usr/local/bin/chromium`. In 2.0.10 these tools had been removed under
the lead's Harbor-managed-tool guidance without verified separate-image
provisioning. This was a real package dependency gap, not a failed editor test.

The supplied Drawbill reference explicitly bakes its own verifier toolchain.
This repair follows that pattern while restoring PatchPad's prior pins:
Codex 0.151.0, Playwright MCP 0.0.79, RewardKit 0.1.7 and its Chromium build.
It does NOT adopt Drawbill's RewardKit 0.2.0, custom judge driver or key remapping.

The verifier Dockerfile now also checks all three command paths, the RewardKit
version, the browser executable and a real headless page launch at image build.
It creates /app and /logs/verifier artifact parents. Image-baked non-secret
Codex provider/MCP configuration points to OpenRouter and the actual browser.
Only the platform supplies OPENROUTER_API_KEY. No credential is embedded.

Preserved unchanged: public agent/public separate verifier; OpenRouter-only
task.toml wiring; Codex/openai/gpt-5.6-luna/high in all four dimensions;
test.sh (no key setup/remapping); all 35 criteria and weights; every instruction
body, seed, golden editor behavior, readiness/manifest/restart helper and
timeout budget. Other source differences from 2.0.10 are release markers only.
This deliberately replaces the unverified assumption that Harbor supplies the
tools in a plain separate verifier image; it is not literal adherence to the
earlier no-install lead message.

## Validation

- `package-audit.json`: 149 passing local structural assertions, unchanged
  semantics versus 2.0.10, LF/UTF-8 checks, exact inventory, archive CRC and
  byte/hash agreement for every source file. Criterion split remains
  2 Render / 2 Constraints / 27 Functional / 4 Polish.
- `tool-smoke.json`: the exact new build-time tool and browser assertions
  executed successfully in the existing tool image. A loopback-only fake
  provider received the correct model and Authorization header using only
  OPENROUTER_API_KEY, without OPENAI_API_KEY or login. Its intentional 401 is
  not a real provider failure, score or paid run.
- `mcp-smoke.json`: real stdio Playwright MCP initialization, tool discovery,
  Chromium navigation, page-content readback and browser close passed offline.
  The initial smoke expected inline snapshot text; this MCP version returns a
  snapshot-file link. The diagnostic was corrected to use read-only MCP page
  observation; no task source change was needed for that diagnostic assumption.
- `regression-result.json`, `release-progress.json`, `local-validation.json`
  and the individual browser/harness outputs record the freshly rerun
  current-source regression results; the container completed with exit 0.
  Passed: shell/Node syntax, 35-criterion discovery, empty-submission zero,
  five valid and six invalid manifest cases, six QC groups, six baseline
  groups, two real persistence restarts, eight prior-Oracle-failure groups,
  six Unicode/mouse/clipboard variants, fourteen additional groups including
  server rejection checks, harness lifecycle/stub aggregation, two negative
  controls, and three document-end/preview/cut-Find targeted checks.
  These overlapping local regression groups are not 35/35 Oracle scores.

Both exact new image builds were attempted and failed because the configured
local proxy hostname `ioclrndwg1.ds.indianoil.in` could not resolve, preventing
apt from downloading packages. See `agent-build.log`, `verifier-build.log` and
`build-results.json`. No host proxy/DNS settings were changed.

Local execution used `patchpad-preflight-tests:2.0.9`, which already carries the
restored pinned tools, with current source mounted read-only and fresh isolated
app state. Therefore the new Dockerfiles were NOT successfully rebuilt end to
end. Local tooling/auth checks demonstrate the restored path works with those
dependencies, not that the platform has accepted or built this ZIP.

No official platform static-check implementation, paid Oracle/model run or live
OpenRouter authentication was executed. Fresh platform QC and Oracle remain
required; no guarantee of 45/45 static, 53/53 rubric or Oracle 1.0 is made.
All historical releases and their scores remain unchanged. Drawbill, GridForge,
Brickfall and shared authoring/packaging files were not edited.
