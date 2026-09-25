# Common Ground Ballot r12

The supplied r11 Oracle scored 0.9206 overall and 0.8676 Functional. GPT scored
0.3716 overall and 0.1471 Functional. Preserve these as r11 results; there is
no scored Oracle result for this corrected r12 package yet.

The Oracle reported three failed criteria: distinct_sessions_and_global_revocation,
vote_retry_idempotency, and identified_turnout_without_choice_link. The latter
two explicitly report missing Open-state approval replay and one-participant
Member privacy evidence. The required actions were described in separate
bullets but omitted from the main ordered workflow. r12 puts them immediately
after the relevant votes, adds a pre-close evidence check, and explicitly
repeats the required privacy/replay observations at publication and each restart.

The original server's session revocation passed five fresh, independent browser
sequences: both ended credentials and both contexts returned 401 immediately
and after refresh; a subsequent fresh login succeeded. A public identity read
returns 200 with a null user, which does not grant protected access. The export
contains no detailed judge action trace, so the reported surviving session's
cause cannot be established. r12 requires waiting for the logout response,
accepting confirmation, retaining the correct credentials, and finishing all
revocation checks before the fresh-login positive control.

Two golden UI defects were independently reproduced and fixed. Rapid clicks
previously sent two login requests; the UI now allows only one authentication
request at a time. A simulated 503 on End all sessions previously hid the
workspace without ending the live session or showing the error. It now retains
the workspace and displays the failure so the user can retry. A confirmed
success or an already-ended 401 session returns to sign-in. The server's
revocation implementation is unchanged. These are demonstrated defects, not
proof of the cause of the exported Oracle's session failure.

Only solution/public/app.js and tests/functional/prompt.md changed inside the
ZIP compared with r11. All judge configurations, all 22 Functional criteria
and their 34 total weight, the 60/20/20 formula, shared browser gates, product
requirements, seed, task version 1.0.0 and provider configuration are unchanged.

Local validation passes 45 full browser groups with two real process restarts,
seven focused session/authentication groups, five runtime checks and 15 runner
harness cases. Both focused UI defects fail on original r11 and pass on r12.
The runner harness uses score stubs and does not call a model. The archived
source bytes and all prompt/configuration hashes are recorded with the ZIP.

The shared local ZIP checker was corrected to recognize the existing explicit
independent-scoring wording case-insensitively, extract the actual shared gate
without adjacent dimension instructions, and require the canonical weighted_mean
aggregation in all five dimensions. The original checker is preserved in this
report directory; the checker is not part of the uploaded task. Its negative
regressions and the final archive audit are recorded separately.

Exact clean image builds were attempted and failed because Docker could not
resolve the configured package proxy. Passing runtime checks used current task
files assembled with cached dependencies. This is not clean-build validation.

Upload common-ground-ballot.zip from the matching r12 delivery folder and run
the platform Oracle on that frozen checksum. The local environment has no
direct OpenAI key for the package's configured judge; an OpenRouter diagnostic
would be a different execution route and is not reported as a platform rerun.
Require all Functional criteria to pass and Oracle to meet the platform target;
if a check fails again, retain its action trace as well as reward-details.json.
Because the verifier sequence changed, rerun GPT on the same ZIP to establish
its new score too. No r12 score or platform QC pass is claimed here.
