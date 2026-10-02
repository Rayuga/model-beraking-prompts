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
