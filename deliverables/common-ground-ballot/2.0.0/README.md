# Common Ground Ballot 2.0.0

Active source: `projects/common-ground-ballot/`.
Upload `common-ground-ballot.zip` from this directory, not the whole directory.
The ZIP must contain one `common-ground-ballot/` task wrapper.

## Template Changes

- Canonical task name `turing/common-ground-ballot`, version `2.0.0`.
- Original source preserved at `projects/common-ground-ballot-v0/`.
- Public agent and separate verifier networking.
- Only `OPENROUTER_API_KEY` is injected for judge credentials. No OpenAI-key
  compatibility alias and no key setup in `tests/test.sh`.
- All judges use Codex and `openai/gpt-5.6-luna` with max reasoning effort.
- No explicit Codex installation in the verifier Dockerfile. RewardKit owns
  CLI provisioning when Harbor has not already supplied it. OpenRouter provider
  settings are in the verifier image, not the application or test runner.
- Playwright MCP, Chromium and RewardKit remain installed as in the supplied
  BazaarBridge v2 template: no evidence was supplied that Harbor injects those
  dependencies. Do not remove them based on the Codex-only bootstrap check.
- Existing application dependencies, seed data, all 28 criteria, bounded health
  readiness, credential-free app launch and real restart checks are preserved.

## Local Evidence

The JSON files beside this README record browser regression, harness unit tests,
runtime dependency checks, agent prerequisites and judge bootstrap. The harness
uses an explicit score test double; it is not a scored Oracle run. The bootstrap
only installs/checks the CLI and configuration; it makes no model request.

`qc-preflight.json` records the source audit, 53 manual rubric dispositions,
limitations, source hashes and ZIP hash. Those are not 53 platform passes.
Public networking is intentional. Runner-owned Codex installation follows the
runner's latest-version policy; inspect `judge-bootstrap.json` for the local
version tested, not a guarantee of the version a future platform run installs.

Historical Oracle 1.0 belongs to the original 1.0.6 task in `../v0/` only.
No new paid Oracle/model run or platform upload is performed by these helpers.

Repackage after successful local checks from the repository root:

```powershell
python deliverables/common-ground-ballot/2.0.0/finalize-release.py --refresh-coverage
```
