# Staged webdev task contract

The shape the rubric assumes. Read this before judging structure, wiring, or the cross-file contract (checks 8–12, 15, 21–25, 43, 46, 49–51).

## Closed file list

```text
<task-slug>/
├── instruction.md
├── task.toml
├── environment/
│   ├── Dockerfile
│   ├── instructions/<note>.md          one or more operating notes
│   └── assets/seed_data.json           mounted at /assets/seed_data.json
├── solution/
│   ├── solve.sh
│   └── app/**                          golden app; entry app/server.js
└── tests/
    ├── Dockerfile
    ├── test.sh
    ├── scoring.toml
    ├── app_context.md
    ├── .dockerignore
    ├── gates/render/{judge.toml,prompt.md}
    ├── gates/constraints/{judge.toml,prompt.md}
    ├── scored/functional/{judge.toml,prompt.md}
    ├── scored/polish/{judge.toml,prompt.md}
    ├── scored/visual/{judge.toml,prompt.md}
    └── tools/{score.py,restart_mcp.py}
```

Must be absent: `tests/reward.toml`, any extra `tests/` entry, `NOTES.md`, `SOLUTION.md`, `.env`, zips, QC spreadsheets, saved trial runs, `node_modules`, `*.db`/`*.db-wal`, editor and OS junk. Mutable-container `artifacts` are declared in `task.toml` instead of shipped as files.

## `task.toml`

```toml
schema_version = "1.4"
artifacts = ["/app", "/assets"]

[task]
name = "turing/<task-slug>"        # must equal turing/<dirname>
description = "..."                # product, axes of difficulty, judge, dimension policy
keywords = ["...", "webdev", "turing", "full-stack"]

[metadata]
difficulty = "medium" | "hard"
difficulty_explanation = "..."
category = "programming"
tags = ["full-stack", "browser", "arena", "rl-training"]
provenance = "..."
arena_slice = "..."

[agent]
timeout_sec = 7200.0

[environment]
build_timeout_sec = 600.0
network_mode = "public"
cpus = 2
memory_mb = 4096

[verifier]
timeout_sec = 13200.0
environment_mode = "separate"

[verifier.env]                     # frozen block — must be exactly this
REWARDKIT_JUDGE = "claude-code"
REWARDKIT_MODEL = "z-ai/glm-5.3-flashx"
ANTHROPIC_BASE_URL = "https://openrouter.ai/api"
ANTHROPIC_AUTH_TOKEN = "${OPENROUTER_API_KEY}"
ANTHROPIC_API_KEY = ""

[verifier.environment]
network_mode = "public"
```

- `[task].version` is optional in this layout.
- `[environment].docker_image` must be absent while the Dockerfile has active build steps, and `allow_internet` must be omitted entirely.

## `tests/scoring.toml`

```toml
[gates]
render = 0.0
constraints = 0.0

[weights]
functional = 0.6
polish = 0.2
visual = 0.2

[floors]
functional = 0.05
```

All three tables are required. Weights are positive and sum to 1; every listed name has a directory (`tests/gates/<name>` for gates, `tests/scored/<name>` for weights). Gates stay at `0.0` and their criteria stay binary. Dimension weight lives here and nowhere else — a `weight` key inside a `judge.toml` `[judge]` block is a defect.

## `tests/test.sh`

Ordered contract:

1. `write_zero_reward` runs before anything else, and a trap calls `ensure_reward` on every exit path. Never `exec`. The zero record carries `reward`, all five dimensions, `gates_passed`, `floors_passed`, `weighted_score`, `graded`, `no_op`.
2. Refuses to grade when `/app/server.js` is missing, and rejects symlinks whose real target escapes `/app/node_modules`.
3. Copies `/app` aside, then launches the app unprivileged (`setpriv --reuid=65534`), with a sanitized `env -i` carrying `PATH`, `NODE_PATH`, `HOME`, `PORT`, `DB_PATH`.
4. Probes liveness on `/api/health` then `/` before invoking RewardKit.
5. Generates the restart helper by heredoc plus `sed` placeholder substitution, `chmod 755`, and exports `APP_RESTART_HELPER`.
6. Substitutes `{app_context}` from `tests/app_context.md` into every `tests/*/*/prompt.md`.
7. Runs the `gates` suite, then `python3 /tests/tools/score.py "$LOG_DIR"`: exit `0` continues, exit `1` stops on a real gate failure keeping the detailed record, anything else writes the plain zero.
8. Runs the `scored` suite, then `score.py` again; any failure writes the plain zero.

Budgets must nest: judge timeouts < their suite budget, gate budget + scored budget < `[verifier].timeout_sec`. The reference task uses gates `1500`, scored `11100`, verifier `13200`.

## `tests/<suite>/<dimension>/judge.toml`

```toml
[judge]
judge = "claude-code"          # fallback is expected; it must not name a model
mode = "batched"
timeout = 600
isolated = false
prompt_template = "prompt.md"

[[judge.mcp_servers]]
name = "playwright"
transport = "stdio"
command = "playwright-mcp"
args = ["--headless", "--isolated", "--executable-path=/usr/local/bin/chromium", "--no-sandbox"]

[scoring]
aggregation = "all_pass"       # gates; scored dimensions use "weighted_mean"

[[criterion]]
id = "..."
name = "..."
type = "binary"                # "likert" with points = 5 is allowed in scored dimensions
weight = 1.0
description = """..."""
```

Prohibited inside `[judge]`: `model`, `reasoning_effort`, `temperature`, `weight`. Criterion `id`s are unique per file, types are `binary` or `likert`, weights are positive, descriptions non-empty, and `prompt_template` contains `{criteria}`.

The functional dimension also declares the restart server:

```toml
[[judge.mcp_servers]]
name = "verifier"
transport = "stdio"
command = "/usr/local/bin/python3"
args = ["/tests/tools/restart_mcp.py", "$APP_RESTART_HELPER"]
```

That literal `$APP_RESTART_HELPER` is correct: RewardKit expands environment variables in MCP arguments, and `test.sh` exports the variable before the suites run. The judge must call the `restart_app` tool; no prompt may send the judge to a shell, and the tool is single-use so no other criterion can restart the process.

## `prompt.md` and `app_context.md`

Every prompt opens the app's `http://localhost:3000` URL, carries the untrusted-submission line, and contains `{app_context}` and `{criteria}`. Each scored prompt restates the in-dimension browser gate that hard-zeros a blank or static shell; the gate dimensions carry the real gate. No prompt may require a same-origin check, name a route the brief does not, or derive a verdict from the submission's source.

`app_context.md` holds `## Application` (Name, URL), `## Accounts`, and `## Key screens`. It is the single place accounts and screens live; prompts inherit it rather than restating it.

## `tests/tools/`

- `score.py` must sit exactly one level under `tests/`: it resolves its policy as `Path(__file__).parent.parent / "scoring.toml"`, so moving it into a subfolder breaks scoring silently until the first run.
- `restart_mcp.py` is a stdio MCP server exposing one single-use `restart_app` tool. It runs the helper with a sanitized environment and a 55-second timeout, and reports structured errors rather than throwing.
- Both files are shared builds: `check-canonical-shared-files.py` compares them against a known build by code, so comments and display strings may differ but logic may not drift.

## Cross-file agreements

Check 49 asks for these to agree everywhere they appear, not just to be individually plausible:

| Fact | Stated in | Consumed by |
|---|---|---|
| port `3000` | instruction and notes | `test.sh`, judge prompts, `app_context.md` |
| entry `/app/server.js` | instruction and integration note | `test.sh`, `solution/solve.sh` |
| database path honoring `DB_PATH` | instruction | `test.sh`, restart helper |
| seed at `/assets/seed_data.json` | instruction | `task.toml` artifacts, `solve.sh`, criteria |
| fixed clock | instruction and notes | seed data, criteria figures |
| accounts | brief and integration note | `app_context.md`, criteria |
| judge agent and model | `task.toml` `[verifier.env]` only | RewardKit invocation |
| dimension weights | `scoring.toml` only | `tools/score.py` |
| restart helper variable | `test.sh` export | functional `judge.toml`, functional prompt |
| quoted criterion counts | `task.toml` description/provenance | the actual `[[criterion]]` blocks |
