# Colderwater status for the next session, 2 October 2026

Read this first when resuming Colderwater in a fresh session. Details are in `qc/repairs/coldwater-2026-10-02-strict/STRICT_CANDIDATE.md`.

## Where it stands

- Branch: `task/colderwater-editor-strict` (pushed). Not merged to `main`.
- Task: `projects/colderwater-playground-devtools`. 1 render gate, 2 constraints gates, 41 Functional (weight 57.5), 6 Polish, 3 Visual.
- Uploaded for a portal Oracle and Luna run on 2 October 2026:
  `deliverables/colderwater-playground-devtools/strict-candidate-2026-10-02/colderwater-playground-devtools.zip`,
  SHA256 `eda584641648eda308efee9036897333b58ff05cc64ddee13915815ea1fd7fa3`, frozen QC input `4f93c627…` (`qc/runs/coldwater-strict-2026-10-02-r7`).
- The user reported four portal tries remaining before this upload.

## Why the task was rebuilt

The 1 October candidate scored Oracle 1.0 and GPT-5.6 Luna 0.8564, above the 0.10-0.70 band. The task was hardened around a hand-built code editor, the run-lifecycle behaviour Luna failed, a live shared library and six Polish criteria.

## Evidence

- Scripted golden: all 50 gate, Functional and Polish checks pass on the uploaded bytes, launched as `tests/test.sh` launches the app, with a real restart. Rerun with
  `bash qc/repairs/coldwater-2026-10-02-strict/run_golden.sh <scratch-build-dir>` (needs the `cw-editor-agent-r3` and `cw-editor-verifier:current` Docker images).
- QC: two full 54-reviewer rounds (`qc/runs/coldwater-strict-2026-10-02-r2`, 18 quality fails; `-r3`, 10 quality fails), both BLOCKED, all findings fixed. Then a quick review: one full 53-check pass (`-r4/quick/reviewer-A.md`) and five judge-walk reviews covering every criterion (`-r5/quick`, `-r6/quick`). One real golden bug was found and fixed (Save did not end the typing run).
- No formal round has been run on the uploaded bytes.

## Not measured

- Oracle score, judge duration and Luna score for this version. The local judge cannot run: `z-ai/glm-5.3-flashx` through OpenRouter returned HTTP 401, no working key on this machine.
- QC rows 11, 40 and 42 stay "Not exercised" until a configured judge run exists.

## Known risks for the portal run

1. Judge time: 41 Functional criteria in one 9000-second session.
2. Judge tooling: triple click, modifier-click at a character and drag need coordinate mouse input; the judge notes allow it but it is unverified.
3. Stop and supersession need the judge to act within about four seconds; missing twice costs about 0.036 reward.
4. Luna may score zero if its editor fails a gate, or above 0.70 if it builds a solid editor. Estimate about 0.55, unmeasured.

## Next steps

1. When the portal run finishes, export both trials and read `reward-details.json`, Luna's trajectory and its built app before changing anything.
2. Decide whether a failure is the task's fault, Luna's own bug, or Luna being too strong (see `WebDev_guide.md`).
3. Pending cleanup the user asked for: deleting the superseded Colderwater runs, repairs and deliverables was blocked by the permission classifier. Everything is preserved in commit `bee4aab8`.
4. Uncommitted and not part of this task: `WebDev_guide.md`, `deliverables/package_staged_candidates.py` and the HireOps run folders.

## Portal run 1 (2 October 2026) and the gate change that followed

- Uploaded ZIP `eda58464…fd7fa3`. Export: `run-outputs/coldwater-playground-devtools/runs-export/runs-export/run-6e537d14-ec50-476a-b834-ef6107d02859`.
- **Luna: reward 0.** Constraints gate passed (real custom editor; saved record survived the storage clear). Render gate failed because Run never works in Luna's app: its injected console bridge has an unclosed function (`SyntaxError: Unexpected end of input`), the .js preview has no body (`document.body` is null), and its five-second timer is never cancelled on success. Luna built in about eight minutes and tested only with curl and `node --check`. The scored suites did not run, so this run says nothing about difficulty.
- **Oracle: reward 0.9833** (export `run-outputs/coldwater-playground-devtools/runs-export/runs-export/runs-export/run-4e686738-561e-4222-9cdd-bd2b5604e0c1`). Both gates passed, Functional 41 of 41, Polish 6 of 6, Visual 0.9167: `cw_visual_workspace_layout` got 4 of 5 because 'Replace all' wrapped alone onto a second toolbar line and the saved-snippet cards were cut at the panel edge. The whole Oracle trial took about 42 minutes, so the judge time budget is not a problem. The judge pressed Stop 146 ms after Run and started the superseding Run 286 ms after the old one, so the four-second windows are not a problem either. Nop scored 0.
- The user reported this used one try (three left).
- Change made afterwards, at the user's request: the render gate now only checks that the workspace loads, the editor accepts typed text and the page reloads (`cw_workspace_loads_and_takes_typing`). "Type a program and Run it" moved into Functional as `cw_basic_run_output` (weight 2.0). The in-dimension gate sentence in the three scored prompts matches. A broken Run now costs Functional points instead of zeroing the reward.
- Task after the change: 1 render gate, 2 constraints gates, 42 Functional (weight 59.5), 6 Polish, 3 Visual. Scripted golden: 51 of 51 gate, Functional and Polish checks pass. Frozen as `qc/runs/coldwater-strict-2026-10-02-r8`.
- After the Oracle result: the editor toolbar is now two tidy rows and the saved-snippet list wraps instead of being cut off, to recover the lost Visual point. Scripted golden: 51 of 51. Frozen as `qc/runs/coldwater-strict-2026-10-02-r9`; ZIP in `deliverables/colderwater-playground-devtools/strict-candidate-2026-10-02-v3`.
- Still unmeasured: Luna's score when its app is actually graded.
- Quick QC on the gate change (`qc/runs/coldwater-strict-2026-10-02-r9/quick`): gates and floor passed rows 7, 29, 35, 39, 40, 42, 43 (the weakest gate-passing app still scores 0 through the Functional floor). Consistency and visual reviews found small items, all fixed: the render gate no longer requires preview and console areas; `cw_basic_run_output` is weight 1.0 and allows console history; Run is no longer charged again in the long-line, narrow-width and feedback criteria; one control scale, styled history, pinned library header and room for ten editor lines in the golden.
- Current task: 1 render gate, 2 constraints gates, 42 Functional (weight 58.5), 6 Polish, 3 Visual. Scripted golden 51 of 51. Frozen as `qc/runs/coldwater-strict-2026-10-02-r10`; ZIP in `deliverables/colderwater-playground-devtools/strict-candidate-2026-10-02-v4`. v2 and v3 are superseded.
