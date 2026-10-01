# Shared WebDev harness correction, 1 October 2026

**Historical local trial, reverted at the user's request.** The live template
and Colderwater task now contain the original identical `tests/test.sh` bytes,
SHA256 `bd68259276ca4b034654efc8a1723a4e702ed62dbe590af6201565f43eabe5aa`.
This folder retains the tested correction and evidence outside the task.

The user authorized a local shared-template trial. The edited file was copied
from `projects/webdev-task-template/tests/test.sh` to
`projects/colderwater-playground-devtools/tests/test.sh`, then both were
restored. The previous template and task files are retained in the earlier
frozen QC run and in this folder as `original-test.sh`. The trial task input was
`8bb280783b2fc133e568bfeb4f33d2ce1f2e8529339419c97614000a877dc6ae`.

## What the harness is supposed to do

The harness starts the submitted server and decides whether it is ready for
browser grading. Its restart tool must stop that server, start a new process on
the same database, and report success only if the new process serves the app.
When the grader finishes or fails, the harness must end its server process and
write a reward record that accurately distinguishes an app result from a grader
failure. Those jobs are separate from the app's own feature requirements.

| Job | Previous behavior | Local correction |
|---|---|---|
| Check readiness | An HTTP read used a two-second socket timeout, but a response arriving in small pieces could keep it waiting. The repeated loop had no firm 30-second overall limit. | Each probe has a three-second process limit and reads only the first body byte. The whole readiness wait has a 30-second limit. It also verifies that the launched process owns the listening port. |
| Restart | The tool could report success while the old server still answered and the replacement had failed to bind the port. | Stop the old process group within a bounded grace period, then verify that the new live process owns port 3000 and answers HTTP before reporting success. A failed stop or replacement reports failure. |
| Cleanup | Waiting for an app that ignored TERM could hang. | Send TERM, then KILL if necessary, with an eight-second outer stop limit. Record cleanup failure and still ensure a reward record exists. |
| Scored-suite failure | A grader error or timeout could leave zero reward labelled as a successful grade. | Write the existing zero reward with `graded=0` and `no_op=1`. Keep suite logs and diagnostic files for inspection. |

This correction changes no dimension weights, reward formula, judge prompts,
criteria, Dockerfiles, app requirements, or configured suite/verifier budgets.
`restart_mcp.py` and the scoring files are unchanged. The local user
authorization applies to these shared harness corrections; it does not establish
that the hosted portal has adopted the same template. An upload of the edited
task could still fail a hosted check that compares against the portal's older
template. Confirm the shared-template rollout or an exception before relying on
this file as a portal-ready package.

## Measured validation

- `evidence/results.json` contains 11 controls against the edited exact source:
  all 11 pass. The five controls that exposed restart, cleanup, and failed-score
  defects fail against the original source. They run in the pinned offline
  verifier image with no host ports or provider calls.
- `evidence/readiness-results.json` uses a local server that never completes its
  response headers. The original probe exceeded its five-second test cutoff;
  the corrected probe stopped in 3.011 seconds and its full readiness wait in
  30.004 seconds. A healthy server passed in 0.404 seconds.
- The new frozen Colderwater golden run at
  `qc/runs/coldwater-2026-10-01-shared-harness-fix/golden` passed all 79
  scripted Functional facts, both gates, six Polish facts, 11 runtime
  regressions, and an actual generated-helper/MCP process restart.
- The new candidate's structural preflight passes; 64/64 task source guards,
  Bash syntax, and `git diff --check` pass. Template and Colderwater copies of
  `test.sh` have identical SHA256
  `11b0aab846879e475481edb9e8c91df495117a7f5b111cef87a8eac79abbed79`.

The corrected trial candidate's 53 independent quality rows and 48
deterministic rows were not reviewed; its status remains **INCOMPLETE**. Its
changed source bytes are no longer live. The restored task again matches the
earlier completed 53-row QC candidate, whose verdict remains **BLOCKED**.
Full configured AI judging, hosted Oracle and target-model scores remain
unmeasured. No upload, provider run or push was performed for this correction.
