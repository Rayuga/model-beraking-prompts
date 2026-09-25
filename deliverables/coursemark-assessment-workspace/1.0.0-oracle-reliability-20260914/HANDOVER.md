# Coursemark Oracle reliability repair

Upload `coursemark-assessment-workspace.zip` from this directory. SHA-256: `4181a6ac922c0ffa1b2698dd26f3fd04af9c17f0bfe83ce49f00ca2d58c3b52b`.

The 38-file archive contains the repaired task. Task version remains 1.0.0. All 66 criterion IDs, criterion weights, dimension weights, grading formula, timeout values, seed data and product requirements are unchanged. Functional is prompt r6; the other dimensions are r5.

## Changes

The latest uploaded Oracle scored 0.5865. Its seven Functional zeros described missing observations; the later Polish/Visual inspections also lacked needed fixtures, and Polish accidentally released its candidate. These historical findings are in the sibling `1.0.0-latest-run-analysis-20260914` directory.

- Checkpoints now persist original requests/results and before/after observations before later actions can lose them. The runner also exports judge stdout/stderr and current session traces. Missing evidence still cannot earn credit.
- Functional prepares and verifies a shared ledger with pending, missing, unweighted, excused and released-zero states, a numeric final, and an unreleased two-row written worksheet. A verifier-owned handoff manifest records actual IDs; subsequent judges must confirm the live state.
- Polish/Visual use scoped worksheet and batch-review targets and cancel previews, avoiding accidental individual release of their only candidate.
- Historical receipt replay keeps the original actor, method/path/body and historical revision. Intentional logout may be followed by fresh authentication as that same actor; revoked credentials remain separately refused.
- Initial and restarted app processes run from the entry file's directory, supporting relative static/seed paths in either normal or relocated runtimes.
- The golden has a shorter mobile header, readable long attempt IDs and status text, fitting mobile actions, and a Courses assessment schedule.

## Validation

| Check | Result |
|---|---:|
| Standard checker on source and extracted archive | 145 passed each |
| Archive checker on final ZIP | 421 passed |
| Golden API/browser regression groups | 45 passed |
| Evidence transport/runtime checks | 9 passed |
| Normal/relocated startup and restart checks | 24 passed |
| Rendered surface/overflow checks | 36 passed |
| Workspace layouts across five widths | 25 passed |
| Reward postprocessing cases | 10 passed |
| Independent invalid-seed controls | 9 rejected |

Actual RewardKit 0.1.7 discovery and five-dimension CLI/trace export were also exercised using explicitly synthetic CLI responses. The .58 reward in local runner logs tests reward arithmetic only; it is not an Oracle score. Screenshot/layout checks are not Visual judge scores.

The new handoff was verified with Nora's numeric final at 56%, Ben pending A-01 and missing Review, Ben's numeric released zero, Nora's documented excuses and unweighted A-04. The two-row review remained eligible after restart and after both viewport inspections. These are supported setup changes during verification, not changes to packaged seed data.

The first new local probe incorrectly demanded an explicit null hidden score, although the contract accepts absent or null. It was corrected to accept both; the original probe and failure remain in `probe-attempt-1/`. No product change or relaxed criterion was used to fix that probe.

## Remaining confirmation

Fresh image builds could not be completed locally: the verifier dependency download repeatedly timed out against PyPI, and the agent build stalled on Debian mirror access. Runtime tests used the cached `coursemark-tests:1.0.17` image with exact final task files. See `build-attempts.json`.

No platform rubric-source QC, paid Oracle or new model evaluation was run on this archive. Run platform QC and then Oracle/GPT on this exact checksum. Oracle 1.0 and any particular GPT score remain unconfirmed. The exported checkpoint/trace artifacts should make any remaining failure directly diagnosable.

Detailed evidence: `package-verification.json`, `runner-logs/`, `runtime/`, `cwd-runtime/`, `visual/`, `changes.diff` and `handoff-runtime.json`. Historical delivery ZIPs are preserved.
