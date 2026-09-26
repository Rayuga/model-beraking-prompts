# Applying the deterministic layer

`Deterministic Checks` in the workbook lists 48 checkers: 35 webdev-specific and 13 common to every suite. They are mechanical, so they must not be hand-waved — but they are also where most false positives come from, because a dozen of them pass by design on this task shape.

## Running them

The checkers ship with the client's harness, not with this workspace — verify before assuming they are available:

```bash
command -v check-required-files.py || ls <harness>/checks/check-required-files.py
```

If the user supplies a runner, run it and record each checker's real output verbatim, including the ones that pass. If no runner is available, apply the documented behaviour by hand using the recipes below, and say in the report which checks were applied manually. Never mark a checker `Pass` on the strength of pattern-matching the task against its description alone.

## Checks that pass by design here

Reporting any of these as a defect is a false positive:

| Checker | Why it is not a finding |
|---|---|
| `check-canary.sh` | Overridden for this suite: webdev tasks ship a full app and use no canary-GUID convention. Passes with a NOTE. |
| `check-dockerfile-sanity.sh` | Overridden: apt-pinning policy differs by task shape and is owned by `check-dockerfiles.py`. Passes with a NOTE. |
| `check-instruction-suffix.sh` | Overridden: webdev briefs must not end with the terminal-bench "you have N seconds" suffix. Passes. |
| `check-instruction-states-offline-constraint.py` | NOTE-only, and the network is public, so there is no constraint to state. |
| `check-allowlist-matches-provider.py` | No allowlist on public network is a NOTE-only pass. |
| `check-no-cdn-or-remote-assets.py` | FAILs only when grade time is offline or allowlisted; here each hit is a NOTE. |
| `check-package-manifest-deps-preinstalled.py` | FAIL under no-network, NOTE under public network. |
| `check-reward-schema.py`, `check-reward-weights.py` | Retired dimensions layout only; NOTE-only pass on staged tasks. |
| `check-rubric-segments.py`, `check-app-manifest.py` | Legacy browser-rubric shape only; no-op pass when absent. |

Two more carry a staged-specific reading rather than a pass:

- `check-required-files.py` — staged layout means exactly the closed file list, with **no** `tests/reward.toml`, no stray `tests/` entries, and no `NOTES.md`, `SOLUTION.md` or `.env`.
- `check-task-name.py` — `[task].name` is `<org>/<dirname>` with `turing` for staged tasks; a shape or org mismatch is a NOTE.

## Recipes for the checks that carry the most weight

**`check-required-files.py`** — diff the tree against the closed list in `staged-task-contract.md`. A missing `tools/score.py` or `tools/restart_mcp.py` fails the checker outright. `tests/app_context.md` is not on the workbook's list, but `test.sh` reads it to substitute `{app_context}`, so a missing or empty one crashes the verifier — treat it as a P0 as well and say why the closed list understates it.

**`check-canonical-shared-files.py`** — `tests/tools/score.py` and `tests/tools/restart_mcp.py` are shared builds compared by code; comments, docstrings and the restart tool's display strings may differ, logic may not. With no known-good copy to diff against, assert the invariants instead: `score.py` resolves `../scoring.toml`, validates each dimension as a finite number in 0–1, requires gates then floors, and reports `gates_passed`/`floors_passed`/`weighted_score`; `restart_mcp.py` is single-use via a `.used` marker, runs the helper with a sanitized environment, times out at 55 s, and returns `isError` rather than raising.

**`check-scoring-policy.py`** — parse `tests/scoring.toml` with `tomllib` and assert: `[gates]` holds exactly `render` and `constraints` at `0.0` whose criteria are binary; `[weights]` are all positive and sum to 1; every weighted dimension has a `tests/scored/<name>` directory; `[floors]` names only weighted dimensions. Then read `test.sh` and confirm gates run before scored, `tools/score.py` runs after each suite, and the budgets nest inside `[verifier].timeout_sec`.

**`check-rubric-schema.py`** — parse every `tests/*/*/judge.toml` and assert: `[judge]` has `mode`, `timeout`, `isolated`, `prompt_template` containing `{criteria}`; **no** `model`, `reasoning_effort`, `temperature` or `[judge].weight`; a `judge = "claude-code"` fallback matches `REWARDKIT_JUDGE`; at least one Playwright MCP server; every criterion id unique, `type` in `binary|likert`, weight positive, description non-empty; and the functional dimension alone declares the `verifier` restart server.

**`check-verifier-contract.py`** — `bash -n tests/test.sh`, then confirm by reading: valid shebang, a zero reward written before grading, an `ensure_reward` on every exit path, no `exec`, a liveness probe before RewardKit, the two-suite staged flow, and `APP_RESTART_HELPER` exported and referenced by the functional `judge.toml`.

"No `exec`" means no shell `exec` that would replace the process and skip the reward trap — `find /app -type f -exec chmod a+r {} +` is not a violation, and the shipped scripts all contain it. Search for `^\s*exec\s` rather than the bare word.

**`check-runtime-contract-strings.py`** — the port in `test.sh` equals the port in every judge prompt URL and in the brief; the entry file `test.sh` launches is named in the brief and created by `solve.sh`; a non-`/` liveness path is stated; every environment variable `test.sh` injects is named somewhere the agent can read.

**`check-rubric-prompt.py`** — every prompt is substantial, opens the app's localhost URL, carries the untrusted-submission line, and has honest-failure language; scored prompts also restate the in-dimension browser gate. It understands the `{app_context}` placeholder, so an unsubstituted placeholder in the source file is expected and not a defect.

**`check-batched-independence-wording.py`** — scored dimensions must tell the judge to score each criterion independently and continue after a failure; telling it to stop at the first failure is a FAIL. Gate dimensions (`all_pass`) are exempt.

**`check-probe-not-in-seed.py`** — collect every distinctive value the criteria tell the judge to create, then grep the seed and the reference markup for each one. Any hit means the probe is pre-satisfied.

**`check-instruction-hygiene.py`** and **`check-instruction-content.py`** — the brief and notes must not leak rubric vocabulary, criterion ids, judge sentinels or placeholders, must not overlap criterion text verbatim at length, must exceed roughly 40 words, and must contain no draft markers.

**`check-dockerfiles.py`**, **`check-dockerfile-references.sh`**, **`check-runtime-deps-in-both-images.py`** — both images pinned, self-contained, no `COPY` of `solution/` or `tests/` into the agent image, the verifier image copying its own `/tests` and running `restart_mcp.py` with `python3`, and every npm runtime dependency of the app present in both images.

**`check-solve-contract.py`** — `solve.sh` is valid bash with a shebang and no CRLF, writes the app to `/app`, writes nothing into `/tests`, `/logs/verifier` or `/solution`, and does not `pkill` or set `NODE_ENV=production`. Solve-time installs are a NOTE on public network.

**`check-demo-accounts-agree.py`** — the demo account emails and passwords stated in the brief match the ones every judge prompt actually signs in with, in both directions. Skipped when the brief names no email. Drift here silently makes correct apps ungradeable, so treat a mismatch as a P1 at least.

**`check-no-trialforge-judge-keys.py`** — no half-migrated grader files from a sibling suite: no TrialForge text-answer keys (`files`, `target_claims`) inside a `judge.toml`, and no Toolathon `tests/<dim>/check.py` or `tests/expected/` directories. Relevant in a workspace that builds several task shapes side by side.

## Grep recipes

```bash
# placeholders and draft markers
grep -rniE 'CHANGE[_-]?ME|TODO|FIXME|XXX|<placeholder>|lorem ipsum' <task>/instruction.md <task>/environment

# author-machine paths
grep -rnE '/Users/[a-z]+|/home/[a-z]+|C:\\\\Users|Documents and Settings' <task> --include='*.md' --include='*.toml' --include='*.js' --include='*.json'

# grader vocabulary in the brief
grep -rniE 'judge|rubric|criteri|dimension|reward|weight|score\.py|playwright|glm|claude|/tests' <task>/instruction.md <task>/environment/instructions

# prohibited judge keys
grep -rnE '^\s*(model|reasoning_effort|temperature|weight)\s*=' <task>/tests/*/*/judge.toml

# shell hygiene
find <task> -name '*.sh' -exec bash -n {} \; -exec grep -l $'\r' {} \;

# TOML and JSON parse
python3 -c "import tomllib,sys;[tomllib.load(open(p,'rb')) for p in sys.argv[1:]]" <task>/task.toml <task>/tests/scoring.toml <task>/tests/*/*/judge.toml
```
