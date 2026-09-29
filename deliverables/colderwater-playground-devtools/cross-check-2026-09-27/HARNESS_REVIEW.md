# Independent extracted-archive harness review — 27 September 2026

This second pass found a **real restart false-success defect** in the previously frozen `b34abc10a29b36cd30a62263f476eaa8e3b5328ca5dd75927b2d155721c988f1` archive. A normal golden restart had passed earlier; that positive result did not establish what happened when the original process retained its listener after SIGTERM. The defect was inherited from the reference template. A separate review of browser evidence also exposed an untested redirect assumption in the new confidentiality probe; that was handed to the independent semantics reviewer.

The restart repair is complete in `projects/colderwater-playground-devtools/tests/test.sh`, SHA256 **`d983554cf01740acf24ba35f376181983a10c6a926315860123f382644eef6b1`**. The canonical `score.py`, `restart_mcp.py`, public runtime contract, image definitions, timeouts and initial launch flow are unchanged. The root coordinator will bind this source to a new archive; **the old b34 archive remains unmodified and still contains the reproduced defect**.

## Confirmed defect and repair

The extracted `tests/test.sh` restart heredoc sent SIGTERM to the recorded process group, waited up to five seconds, then launched another process regardless of whether the old one was still running. Its HTTP readiness probe could be answered by the old listener. It did not establish that the replacement survived startup. `restart_mcp.py` consequently trusted the helper's successful exit.

The [baseline reproduction](restart_probe_results.json) used that exact extracted heredoc and canonical MCP server in the pinned verifier image, with no network or paid judge:

| Case | Actual serving process | Tool outcome |
| --- | --- | --- |
| Normal termination | PID 7 → PID 68; old process exited | Correct success |
| Original server ignores SIGTERM | PID 79 → **PID 79**; replacement PID 140 logged `EADDRINUSE` | **Incorrect `isError: false` and “server was relaunched”** |

This can award the 2.5-weight restart criterion to an in-memory server whose original process never stopped. With gates/floor and other scores unchanged, that criterion contributes about 0.0303 of total reward. This is a real grading error, not a claim that the current golden uses that shortcut. It can also let a harness restart failure be mistaken for correct durability.

The authorized task-level fix is confined to the generated helper:

- `tests/test.sh:130` checks whether the old process group still has non-zombie members. It gives TERM five seconds, escalates surviving members to KILL, then confirms termination within a bounded additional interval.
- `tests/test.sh:133` checks replacement liveness by PID, not PGID. This avoids a new race before the background `setsid` process has established its group.
- `tests/test.sh:144` bounds the readiness body read to one byte. The helper need not consume an arbitrary response body to establish HTTP availability.
- `tests/test.sh:177` rejects an already answering listener after the old group stopped, before launching the replacement.
- `tests/test.sh:192` uses a real 30-second readiness deadline and checks that the replacement remains alive before accepting success. Failed startup returns a tool error.

The prior app-directory `cd` on both launches is retained. The canonical single-use MCP marker and 55-second helper timeout remain unchanged. The source review's finite waits fit within that timeout under ordinary scheduling; actual repaired cases completed in about 0.2–5.6 seconds. This is not a latency guarantee under arbitrary resource starvation.

The [final repaired-helper results](restart_fixed_probe_results.json) are bound to the exact repaired script hash. Five cases pass: ordinary termination; a resistant parent; a resistant child left in the old group; a replacement that exits before readiness; and a conflicting independent listener. The last two return MCP errors. A second call is refused in every case, preserving single use. Zombie parents do not cause unnecessary waiting or a false remaining-process verdict.

The [fresh harness regression report](harness_regression_results.json) records four orchestration cases plus the full browser restart witness. Each ran in its own disposable, network-disabled container against the repaired source:

- Relative-path server: app CWD, unprivileged UID, sanitized environment and persistence survive restart.
- Golden harness: normal startup, placeholder resolution, gate/scored orchestration and actual MCP restart work.
- Failed gate: scored suite is not invoked and reward remains zero.
- Missing app entry: the no-op zero record is produced.
- Golden browser restart: actual Chromium creates Primary, independently edits Copy, confirms deletion of a third record, then uses the real single-use restart MCP. A fresh browser checks exact records/revisions, runs both remaining snippets and saves a new Primary revision without changing Copy. [The log](harness_golden_browser_restart.log) records old PID 30 disappearing and new PID 215 alive.

RewardKit outputs are deliberately stubbed only for these harness checks. Their synthetic reward of 1 is **not** a paid Oracle verdict. The app, browser, SQLite reads/writes and restart tool in the browser witness are real.

## Fresh contract comparison

I reread the skill's current `references/staged-task-contract.md` and all five extracted judge/prompt pairs. [The independent comparison](harness_contract_comparison.json) derives facts from the extracted archive and the current template, rather than importing previous PASS statuses.

| Area | Finding |
| --- | --- |
| Task identity and schema | Exact template key inventory; `turing/colderwater-playground-devtools` matches the archive directory. Agent, environment and verifier sections equal the template, including the frozen judge/model environment block and public networks. |
| Dockerfiles and exclusions | Agent Dockerfile, verifier Dockerfile and verifier `.dockerignore` are byte-identical to the current template. No new image-definition deviation was introduced. The tested verifier image is `sha256:f4a50d007a01c9f5394c609a958e1156847bd6e541724adbe48273e95ab98442`. |
| Canonical scorer/restart server | Both Python files are byte-identical and AST-identical to the template. `scoring.toml` is byte-identical. Policy resolution remains one directory above `tests/tools/`. |
| Scoring | Both gates have zero reward mass; Functional/Polish/Visual are 0.6/0.2/0.2. Functional must be strictly above 0.05. Binary gates use `all_pass`; scored dimensions use `weighted_mean`. Six visual raw 1–5 scales agree with the pinned runtime's normalization. No top-level judge weight/model/temperature/reasoning override exists. |
| Budgets | Gate sum 1,200 < suite 1,500. Scored sum 10,800 < suite 11,100. Suite budgets total 12,600 < verifier 13,200. Actual full paid judge latency is still unmeasured. |
| Tool wiring | All five judges launch the pinned Playwright MCP with headless, isolated Chromium and no sandbox. Functional alone adds `/tests/tools/restart_mcp.py` with the expected literal `$APP_RESTART_HELPER` argument. No obsolete `browser_run_code` name is required. |
| Prompt inputs | Each of the five prompts contains the live URL and both template tokens before runtime substitution. The shared context consistently specifies no sign-in, one public saved library, independent browser state and one continuing database. |
| Permissions and environment | `/tests` and verifier logs remain inaccessible to the app UID; app startup uses UID/GID 65534 and sanitized `env -i` with only the documented runtime values. Writable app-copy fallback, `DB_PATH`, port 3000 and app-directory CWD remain consistent. |
| State assumptions | Gates leave one dedicated saved record. Functional criteria use their own records and the final criterion alone restarts. Polish/Visual neither modify saved records nor depend on another judge's generated identity. A reload is not substituted for process restart. |

The extracted harness differed from the template only in the already justified app-CWD launch correction before this new repair. The comparison artifact includes both that diff and the extracted-to-repaired restart diff. Canonical equality alone did not establish restart correctness; the adversarial lifecycle witness was necessary.

## Browser tools and confidentiality handoff

The actual installed `browser_run_code_unsafe` and browser contexts already have fresh, pinned-runtime evidence in the prior full-QC directory, including bounded readers, clean-context creation and cleanup, file-type controls and large benign prefixes. I reread those scripts as part of this crosscheck rather than treating their final `passed` fields as proof of untested cases.

That reread found `full-qc-2026-09-27/actual-mcp-probe.js:45` using `fetch(..., {redirect: 'error'})`. It had no redirect fixture. This rejects an ordinary same-origin redirect as well as an external one. The shipped confidentiality text also called opaque off-origin redirects incomplete while saying only positive private-file evidence should fail, leaving a correct harmless redirect at risk of a false failure.

The semantics reviewer separately reproduced the same-origin false failure through the pinned MCP and validated bounded same-origin following, positive private-file recognition and zero requests to forbidden off-origin destinations. They own the resulting Functional judge/prompt wording and final redirect evidence. This report does not claim the original proof covered redirects or overwrite that reviewer's result.

No other concrete harness, tool-configuration or scoring mismatch was identified in this bounded second pass. Private platform checks, paid Oracle performance, target-model scores, full paid-run duration and exhaustive security remain outside these local proofs. Mutable upstream image tags and remote judge behavior still limit future rebuild/run reproducibility; exact image identity and this run's tool/runtime evidence are recorded. All probe containers used `--rm`; no shared database or another agent's container was used.
