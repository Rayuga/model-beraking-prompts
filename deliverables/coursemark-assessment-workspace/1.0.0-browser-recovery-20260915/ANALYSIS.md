# Latest Coursemark run analysis and repair

The latest uploaded Oracle is **0.7909**, up from **0.5865**. The outstanding score loss is dominated by a timed-out Polish judge. This export does not demonstrate a widespread golden application failure.

| Dimension | Earlier Oracle | Latest Oracle |
|---|---:|---:|
| Functional | 0.5292 | 0.9849 |
| Polish | 0.6364 | 0.0000 |
| Visual | 0.7083 | 1.0000 |
| Render | 1.0000 | 1.0000 |
| Constraints | 1.0000 | 1.0000 |
| Final reward | 0.5865 | 0.7909 |

The final reward comes from reward.json. rewardkit.log's 0.9303 is an intermediate aggregate including gate dimensions and is not the final task score. Run provenance matches the September 14 reliability package. The eight exported golden application files match the shipped golden byte for byte.

## Why Polish became zero

Every Polish criterion has `error: judge timed out after 900s`; the accepted judge_output is empty. The shared browser gate was not an observed application failure.

The trace shows the configured Playwright MCP working initially, then returning `Transport closed`. The judge repeatedly attempted unavailable tools, launched its own HTTP/SSE server, debugged an omitted Chromium executable path and session failures, and wrote custom browser drivers inside /app. It collected 121 checkpoints and eventually emitted 17 yes verdicts and one no, but the dimension had already exceeded its deadline. Those late answers are diagnostic evidence only and were not used to rescore the run.

The interval to the next dimension was 2751.20 seconds (45.85 minutes), despite the 900-second limit. RewardKit kills its immediate CLI process and then drains stdout/stderr. The old trace wrapper executed the Node CLI launcher; surviving native children could keep those pipes open. A local negative control reproduces this inherited-pipe hang with the old wrapper. The repaired supervisor terminates the judge process group and uses a separate watchdog for parent SIGKILL, allowing timeout cleanup to complete promptly.

The first worker shutdown's underlying cause is not established by this export: the referenced native session JSONLs are absent from the downloaded tree. The new proxy records worker stderr and transport events, permits one fresh worker initialization, and returns an explicit unverified result for the interrupted call. It never replays that call. The recovery test kills a worker after a write is accepted and confirms that the write remains exactly once.

The late Polish no verdict claimed missing student accommodation text, but its checkpoints inspected Nora's Courses, Attempts and Gradebook views, not Assessments. The existing golden renders `+15 minutes accommodation` in Nora's Assessments view. The revised prompt directs the judge to the documented relevant view; a real browser check confirms the text without changing the golden.

## Two remaining Functional zeros

36 of 38 Functional criteria passed, including all seven heavily weighted worksheet/release/outcome criteria.

- `release_privacy_immutability_and_retry` (weight 1): the judge released AT-101 but did not retain and replay its exact original request in the same session. The revised sequence arms the response waiter before the release click and captures the original/replay results in the same bounded browser call. Local UI validation records an identical 200 replay and no second revision/event.
- `restart_persistence_and_seed_idempotence` (weight 1): the persisted state and receipt checks succeeded, but the final revoked-token probe was attempted from an about:blank page and did not complete. The revised probe uses an APIRequestContext with the captured absolute URL and original revoked token. Local validation confirms 401 refusal after restart from a blank page and a separate fresh Nora-token 200 positive control.

These two weights account for about 0.0090 of the overall score. Polish alone accounts for 0.20. If only Polish were 1 while the current Functional score stayed unchanged, the arithmetic result would be 0.9909; this is a hypothetical calculation, not a new Oracle result.

## Other latest model results

| Model | Final | Functional | Polish | Visual | Interpretation |
|---|---:|---:|---:|---:|---|
| GPT-5.4-mini | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Functional/Polish/Visual report no visible wrong-password error despite server 401. Render also lost browser transport. |
| Claude Haiku 4.5 | 0.0000 | 0.0000 | 0.1818 | 0.6667 | Constraints and Functional lack gate evidence after browser errors/transport closure; the zero cannot establish that all features failed. |
| Gemini 3.7 Flash | 0.6977 | 0.8004 | 0.5455 | 0.5417 | Several observed behavior/layout defects; one concurrency zero cites missing exact named setup evidence. |
| Nop | 0.0000 | 0.0000 | 0.0000 | 0.0000 | No application grade completed. |

Transport failures affect multiple models. Fix measurement reliability before using these results to harden the task further or predict a particular GPT score. The recorded results remain unchanged. Detailed per-criterion verdicts for all four graded submissions are in criterion-results.csv (264 rows).

## Delivered changes and validation

Changes are confined to verifier helpers, prompts, and the two Functional observation sequences. The golden application, seed, all 66 criterion IDs/weights, dimension weights, model configuration and timeout values are preserved. Functional prompt is r7; the other prompts are r6.

- A bounded transparent Playwright proxy keeps the client connection available after one worker loss, reports interrupted calls as unverified, and never replays saved mutations.
- Judge process-group supervision and a watchdog clean up native children on timeout or termination. Raw stdout/stderr still reach RewardKit unchanged.
- Batched checkpoint storage reduces repeated serialization/tool calls while preserving separate criterion evidence; malformed batches are rejected before writing.
- Polish uses a single planned pass, checks elapsed time, reserves time for final verdicts, and avoids rebuilding browser infrastructure. It verifies the visible dialog before inspecting checkbox children.
- Native session traces are exported to a shallow session-traces directory, avoiding the previous deeply nested export paths.

Passed 45 local API/browser regression groups and 11 transport/process/evidence checks, plus an old-wrapper timeout negative control and a hidden-checkbox timing reproduction. Actual RewardKit discovery and all five CLI/trace/postprocessor paths passed with explicitly synthetic CLI answers. Synthetic scores in these local logs are transport/arithmetic fixtures, not model scores.

The local handoff probe initially inspected a hidden checked checkbox from the previous viewport before the newly opened asynchronous dialog became visible. An independent Playwright reproduction confirms check() can return immediately on that hidden old control; the app correctly rejected the later empty preview. The probe now waits for the visible dialog. Original evidence is retained in probe-attempt-1/. No app or scoring requirement was changed to make that probe pass.

Fresh image builds remain unconfirmed locally because PyPI downloads timed out and Debian mirror access stalled. Runtime checks used the cached verifier image with current task files. Platform rubric-source QC and Oracle/model reruns on the new package remain required; no Oracle=1 or GPT target is claimed.
