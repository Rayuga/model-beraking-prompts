# Shared template and September 11 override

`supplied-template.txt` is the byte-for-byte user attachment. It includes pasted
Slack delimiters, a missing final Docker CMD bracket, and old OpenRouter settings.
The three adjacent reference files split that paste into usable files, remove
only those paste artifacts, and apply the user's later task.toml override:

```toml
[verifier.env]
OPENAI_API_KEY = "${OPENAI_API_KEY}"
REWARDKIT_JUDGE = "codex"
REWARDKIT_MODEL = "gpt-5.6-luna"
REWARDKIT_REASONING_EFFORT = "max"
```

These are references, not uploadable copies of PatchPad. Marketplace metadata,
five dimensions, reward weights and stale reference image labels must not be
copied into other tasks. Public agent networking and a separate public verifier
are retained. Credentials are injected by the platform, not stored here.

PatchPad 2.0.15 follows the template's two-stage verifier, pinned tools,
noninteractive RewardKit launcher patch and minimal Codex configuration. The
agent has the template's git/procps/sqlite3 and global Node dependencies and
initialized /app repository. Task-specific additions are deliberate:

- Keep curl/coreutils/CA checks for proven platform bootstrap prerequisites.
- Keep /opt/patchpad-deps with Express 5.2.1 in both images: the brief and golden
  solution use that supplied dependency tree. No database implementation change.
- Copy the existing assets/instructions folder to /instructions.
- Retain digest pins, browser/tool smoke assertions, seed staging and log paths.
- Keep PatchPad's existing timeout budgets, artifacts (including verifier logs),
  metadata and 35 criteria with 90% Functional / 10% Polish. These are task
  settings rather than shared structural format. Total configured build + agent
  + verifier budget is 21,600 seconds; inner judge ceilings sum to 10,550 seconds,
  inside a 12,000-second wrapper and 12,600-second verifier budget.

All four PatchPad judge configurations also use the unprefixed model and max.
No provider/login/key remapping is present in tests/test.sh. RewardKit 0.1.7's
CodexCLI.ensure_installed implements API-key login itself. The older target-agent
metadata is not a judge credential or judge routing configuration.

Official references inspected September 11:
[Codex authentication](https://developers.openai.com/codex/auth) and
[GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna).
Model documentation lists max reasoning; this does not guarantee a particular
platform account has access. See the release evidence for local validation and
any untested platform compatibility.
