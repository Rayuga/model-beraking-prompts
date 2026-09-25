# Pellmoor review-candidate validation

This is a locally checked review candidate. It has no new platform Oracle or
GPT score and is not certified as meeting the 0.1–0.7 target band.

## Completed

| Check | Result | Evidence |
|---|---|---|
| Historical provenance, score arithmetic and verdict coverage | Five trials, 208 graded criterion outcomes; 181 original files unchanged | `run-review.json`, `criterion-results.csv` |
| Standard configuration | 131 checks pass; 52 criteria, unchanged weights and IDs | `standard-qc.json` |
| Golden base regressions | 19 groups pass | `regressions.json` |
| Golden assessment/capacity/retry workflows | Nine groups pass, including actual managed restarts | `hardening-regressions.json` |
| Authentication shared gate | Valid login and refresh; separate anonymous protected read before/after wrong-password UI attempt; original session remains valid | `gate-regression.json` |
| Responsive geometry | 1280, 390 and 320px in both themes; no page/drawer/card overflow or clipped SVG text | `visual-regressions.json` |
| Root-working-directory regression | Old launcher HTTP 500; corrected launcher HTTP 200 | `launcher-regression.json` |
| GPT targeted diagnostics | Six probes reproduce malformed acceptance and duplicate activity events | `gpt-targeted-probes.json` |
| Real runner with synthetic scores | Reward 0.58 and five CTRF dimensions | `runner-logs/` |
| Empty submission | Zero reward, graded=0, no_op=1 | `noop-logs/` |
| Actual reward postprocessor | Eleven valid/invalid score cases pass | `package-verification.json` |
| Archive | 32 files, one task-named wrapper, exact source-byte match, LF text and executable shell modes | `package-verification.json` |

Golden tests used the existing `pellmoor-tests:2.0.3` image, ID
`sha256:cd99ba75c15926810073b209e6a54d3159bfa17b82af4e28647becaec7033b13`.
The final golden sources were compiled inside that image. The tests run the
real revised runner with a local stub replacing only the paid rewardkit call.
The 0.58 value is deliberately synthetic aggregation evidence, not Oracle
quality evidence. The checked-in source contains the real rewardkit invocation.

Screenshots include both themes, desktop/mobile workspaces, manager drawers,
coordinator panel controls and sign-in. Inspection of the first mobile image
revealed clipped funnel text despite the initial overflow checks passing.
The chart was corrected and actual SVG text-bound checks were added; subsequent
checks pass. Successful login also clears stale signed-out feedback. The saved
`before-funnel-text-fix.png` and `validation-attempt-1.json` preserve that earlier
local state.

The launcher witness is a minimal Express reproduction of the relative-static
pattern in Haiku's exported source, run with the exact old/new launch commands.
It establishes the working-directory bug, not Haiku's full corrected score.
Its diagnostic health endpoint precedes static middleware so readiness itself
is not blocked by the permission error being measured.

GPT diagnostics use unmodified exported source and a disposable fresh database
in the cached runtime. Global Express/SQLite versions come from that runtime;
this is not a reconstructed model npm installation or a complete model rerun.
Original model output and evidence are read-only and remain unchanged.

## Exact-image build limitation

Both repository Dockerfiles were submitted to Docker builds. The verifier
build reached pip installation but repeatedly timed out reaching PyPI, then
failed with no available distribution result. This does not establish that
the pinned PyYAML release is invalid. The environment build stalled fetching
the Debian package index. Full logs are `verifier-build.log` and
`environment-build.log`; environment build was cancelled after 616 seconds without completing
the Debian index request, beyond the 600-second task build budget. See
`environment-build-status.json`.

These attempts are not successful exact-image validation. Some final prompt
and instruction clarifications were completed after the build contexts were
captured. Rebuild the final archive's environment and verifier contexts once
dependency networking works. No task dependency versions, build instructions
or timeouts were changed to bypass this limitation.

## Frozen artifacts and remaining evaluation

Use `pellmoor-job-pipeline-review-candidate.zip`; its hash is in
`package-verification.json`. `pellmoor-job-pipeline-review-candidate-r1.zip`
is a preserved intermediate snapshot before the explicit per-action activity
count observation. It is superseded and should not be submitted.

The current task ZIP excludes the review reports, diagnostic scripts, model
outputs, screenshots and all old source snapshots. The version remains 1.0.0.
The common verifier environment, max judge effort, five verifier folders,
reference timeouts and gated 60/20/20 reward formula are preserved. Task code
and configuration contain no added commentary; Markdown requirements,
prompt-version identifiers and shell shebangs are retained.

After exact builds succeed, run full Oracle and GPT evaluations on the frozen
artifact and retain all attempts. The Oracle Visual=1.0 target remains
unconfirmed. GPT may still exceed 0.7: stricter observations are not evidence
of a lower score until rerun. `HARDENING_PROPOSAL.md` describes a separate
product-workflow extension if further difficulty is needed.
