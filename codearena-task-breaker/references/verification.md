# Deterministic verification and packaging

Run these before any model/Oracle measurement. All are local, deterministic,
and authorized; none invokes the configured judge. Commands are marked with the
profile they apply to: `[both]`, `[dimensions]`, `[staged]`.

## The staged profile (tests/scoring.toml + tests/gates + tests/scored)

```bash
# structural, wiring and share audit (detects the profile itself)
python "$SKILL_DIR/scripts/audit_task_source.py" <task>

# the staged QC layer: enumerate and verify completeness of the 53 checks
python "$HARBOR_WEBDEV_RUBRIC_QC/scripts/list_checks.py" --verify <findings.json>
python "$HARBOR_WEBDEV_RUBRIC_QC/scripts/build_report.py" <findings.json> -o <QC.xlsx> --client-safe
```

The staged contract, in the order a breaker pass touches it:

- Five dimensions: `tests/gates/{render,constraints}` and
  `tests/scored/{functional,polish,visual}`, each with `judge.toml` + `prompt.md`.
- `tests/scoring.toml` carries the policy (`[gates]` 0.0, `[weights]`
  0.6/0.2/0.2, `[floors] functional 0.05`); `tests/tools/score.py` applies it.
- No `[judge]` key may name a model, reasoning effort, temperature or weight.
  The frozen `[verifier.env]` block is the only judge wiring.
- Every prompt carries `{app_context}` and `{criteria}`; the scored prompts
  restate the in-dimension gate. `tests/app_context.md` supplies the context.
- The functional dimension alone declares the verifier restart MCP server,
  wired as `restart_mcp.py $APP_RESTART_HELPER`; `test.sh` exports that variable.
- `test.sh` writes a zero reward first, ensures it on every exit path, clears
  the app database before the first start so grading begins from the seed, then
  runs gates → scored with `tools/score.py` after each.
- Timeouts nest: judge < suite budget, and `gates + scored` <
  `[verifier].timeout_sec`. The reference task uses 1500 + 11100 inside 13200.
- Delivery is `<task-slug>.zip` with one root and no version suffix.

Weights are the one place a breaker pass can desync the package: they must keep
the dimension total, or the counts quoted in `task.toml` go stale in the same
edit.

## Zero-score triage (read before diagnosing a failing benchmark)

Before changing a task because a run scored zero, classify the failure from
the verifier artifacts:

- `reward.json` with `graded: 0` and `no_op: 1`, all dimensions zero, means
  the judge never produced a verdict.
- `rewardkit.log` / `test-stdout.txt` containing `ExceptionGroup`,
  "coroutine ... was never awaited", "Agent CLI 'codex' exited with code 1",
  `402 Payment Required`, `429`, model-not-found, or a browser-launch failure
  are verifier/provider faults, not rubric findings.
- `app.log` still showing the reference listening on 3000 confirms the task
  itself booted.

In those cases do not rework the brief, rubric, seed or reference. Fix the
credential/credit/environment issue and rerun. Run the provider probe first:

```bash
python "$SKILL_DIR/scripts/check_provider.py" --task <task-folder> --env-file <verifier .env>
```

`--task` reads the endpoint, model and key name the task declares, so the probe
works for the `claude-code` + `glm-5.3-flashx` wiring as well as the `codex` +
Luna one. Override with `--model`/`--base-url` only when testing a change.

Exit 0 means the judge's provider is reachable; exit 2 means credits/billing
and the run will fail before grading no matter what the task looks like.

## Source checks

```bash
python "$SKILL_DIR/scripts/audit_task_source.py" <task>              # [both]
python "$CODEARENA_TASK_BUILDER/scripts/validate_codearena_task.py" <task>   # [dimensions]
python "$CODEARENA_TASK_QC/scripts/audit_codearena_task.py" <task>           # [dimensions]
python "$CODEARENA_TASK_BUILDER/scripts/update_checksums.py" <task>          # [dimensions]
```

The auditor in this skill reports the detected profile, criterion count, unique
IDs, total weight, enforcement share, leniency phrases, answer-key phrases,
instruction line counts, judge wiring, reward policy tokens, timeout hierarchy
and coverage presence. A clean run has no `fail` findings — `note` findings are
informational and must not be rewritten into defects. The QC auditor may report a
missing `aesthetic` category for the finalized four-dimension profile; treat
that as a documented contract conflict and retain the four dimensions unless
the user explicitly asks for a five-dimension profile.

## Verifier image cache trap

`[dimensions]` — the staged profile ships no verifier Docker labels.

When the task version changes, bump BOTH verifier version labels in
`tests/Dockerfile`:

```dockerfile
LABEL org.turing.task="<task-slug>" \
      org.codearena.task="<task-slug>" \
      org.codearena.verifier-version="<new-version>" \
      org.turing.verifier-version="<new-version>"
```

If only one label style is present, add the other. A stale verifier-version
label lets the platform reuse an old cache entry; the symptom is both oracle
and nop trials failing before grading with `RewardFileNotFoundError` and
`/tests/test.sh: cannot execute: required file not found`, even though the
source Dockerfile is correct. Installing `bash` explicitly in the verifier
image also removes the interpreter ambiguity for `test.sh` scripts.

Normalize every shipped shell script to LF line endings. A Windows-authored
CRLF `#!/bin/bash` becomes `#!/bin/bash\r`, which produces the same
`cannot execute: required file not found` failure even in a freshly built
image with bash installed. Before packaging, convert `tests/test.sh` and any
other executable script, then verify the byte content inside the ZIP (for
example `zip.read(...).count(b'\r') == 0`).

## Judge capacity and state cascades

`[both]`

When a batched judge leaves many criteria at "not completed", the agent
context is exhausted, not the reference. RewardKit 0.1.7 supports
`mode = "individual"` in `[judge]` for agent judges; each criterion then gets
its own judge invocation (`batched | individual` is the only valid pair).
After switching, raise the RewardKit budget and verifier timeout so the
hierarchy holds (`judge timeout` is per criterion).

Also keep global mutations off shared resources. Never suspend, demote or
freeze an account or record that later criteria still need in a continuous
database; add a dedicated sacrificial account for the identity test and
verify positive states in the deterministic smoke before and after it.

## Reference behavior

`[dimensions]`

```bash
node --check <task>/solution/server.js
# install the shipped lockfile into a scratch app and boot it
npm ci --no-audit --no-fund
node server.js
# run the per-chain smoke harness against a fresh database
node <task>/scratch/smoke.mjs
# stop, restart the process on the same database, assert persistence and
# idempotent seeding
```

Then walk the UI with a local Playwright CLI: login, wrong-password refusal,
all workspaces distinct, theme switch, 390x844 mobile containment.

`[staged]` — the reference is one bundled server plus a prebuilt page:

```bash
node --check <task>/solution/app/server.js          # the shipped entry
node --check <task>/solution/solve.sh 2>/dev/null || bash -n <task>/solution/solve.sh
# lay the reference out the way solve.sh does, then run it
mkdir -p /tmp/app && cp -a <task>/solution/app/. /tmp/app/
cd /tmp/app && NODE_PATH=<node_modules> PORT=3000 DB_PATH=/tmp/app/app.db node server.js
```

Then boot it in a real browser and walk the claims the rubric makes: the entry
URL answers, nothing shows before sign-in, a wrong password is refused, the
seeded figures render, a write through the app's own controls survives a second
browsing context, and a process restart over the same database preserves it.
Run the app on the platform it is graded on: on a Windows host
`res.sendFile(absolute path)` inside Express 5 can 404 the SPA fallback for a
task that is fine on Linux, so confirm any `/` failure in a Linux container
before calling it a finding.

## Packaging

`[dimensions]`

```bash
python "$CODEARENA_TASK_BUILDER/scripts/package_codearena_task.py" \
  --output <deliverables>/<task>-<version>.zip \
  --exclude .gitignore \
  --exclude SHA256SUMS.txt \
  --exclude tests/coverage.json \
  --exclude .playwright-cli \
  <task>
```

`[staged]` — one root, no version suffix, no checksums or coverage file:

```bash
# from the task folder, with the tree clean of caches and databases
python - <<'PY'
import zipfile, pathlib
task = pathlib.Path("<task>"); out = pathlib.Path("<deliverables>") / f"{task.name}.zip"
skip_dirs = {"__pycache__", "node_modules", ".git"}; skip_suffix = {".db", ".pyc", ".zip", ".log"}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for path in sorted(task.rglob("*")):
        rel = path.relative_to(task)
        if not path.is_file() or any(p in skip_dirs for p in rel.parts) or rel.suffix in skip_suffix:
            continue
        info = zipfile.ZipInfo(f"{task.name}/{rel.as_posix()}"); info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o755 if rel.suffix in {".sh", ".py"} else 0o644) << 16
        z.writestr(info, path.read_bytes())
PY
```

Verify the ZIP from an extracted copy, not in place: exactly one root matching
the task folder, no .gitignore/.packageignore/SHA256SUMS/coverage/.playwright-
cli/node_modules/databases/QC files/legacy judge dirs, the lockfile, all six
instruction files at most 20 lines, four judge dimensions, version and timeout
hierarchy current, criteria unique, and enforcement share at or above target.
Record the ZIP SHA256 and source checksums after the final edit.

For `staged`, verify instead: one root, no version suffix, 32-ish files with no
caches or databases, every TOML parses, `bash -n` clean on both scripts, exec
bits on `solve.sh`/`test.sh`/`tools/*.py`, the packaged `server.js` parses, no
placeholder markers anywhere, and the archive byte-identical to the tree.

## QC workbook

`[dimensions]` — run `$codearena-task-qc` against the reworked task and produce
a current post-rework workbook from the supplied RL Task QC Scorecard. Preserve
How to use and Rubric sheets, add a formula-driven QC Summary and one task sheet
with ID, Score, Evidence, Source/run, Finding, Corrective action and Status.
Label execution/model rows `Excluded - execution/model stage`; source-only
results should be 19 Pass, 0 Partial, 0 Fail, 11 Excluded. State the documented
profile conflict and the explicit no-model-run status.

`[staged]` — run `$harbor-webdev-rubric-qc` instead: answer all 53 checks in a
findings JSON, build the workbook with `--client-safe`, and keep the findings
sheet's status current (Fixed / Open / Closed / Not exercised). Every check gets
a verdict, including `N-A`; `build_report.py` refuses to write a workbook whose
findings do not answer all of them.
