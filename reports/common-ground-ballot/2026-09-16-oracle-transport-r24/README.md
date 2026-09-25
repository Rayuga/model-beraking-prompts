# Common Ground Ballot r24: Oracle browser-transport repair

The new r23 Oracle result is **0.4 overall, Functional 0, all other dimensions
1**. All 51 Functional verdicts say the global browser gate was incomplete or
the requirement was not tested. This is not evidence of 51 golden-app defects.
Functional stopped after 111.77 seconds, well below its 7,200-second limit.

[Upload r24](../../../deliverables/common-ground-ballot/2026-09-16-oracle-transport-r24/common-ground-ballot.zip).

## Confirmed cause

The exported prompts, judge files, runner, scoring policy and private helper
hashes match the frozen r23 ZIP. The exported golden application is byte-identical
to the local reference. Oracle trial: `common-ground-ballot__N3HksDo`, run
`3842c2ae-15a3-4d52-9533-7b7d3490a078`.

The Functional trace shows this sequence:

1. Playwright navigated to the real golden sign-in screen successfully.
2. Loading `/opt/common-ground-verifier/browser-evidence.js` failed because
   Playwright's allowed roots were `/app` and `/app/.playwright-mcp`.
3. The judge copied the helper into the app's output folder and loaded it there.
4. Its first wrong-password capture used `new URL(request.url())` in a request
   matcher. The unsafe-code VM has no global `URL` constructor. Our helper called
   that predicate from an unguarded event listener, so the exception escaped the
   tool handler and terminated the Playwright MCP process.
5. Subsequent tool calls returned `Transport closed`. The judge emitted 51 zero
   Functional verdicts without executing the business checks.

The exact exported call was reproduced locally against pinned MCP 0.0.79. It
exited with code 1 and `ReferenceError: URL is not defined` at the request listener.
The file-root denial reproduced too. [Original reproduction](reproduction/reproduction.json).

The intermediate `rewardkit.log` reward of 0.8 is not the final score. The
unchanged final scorer correctly composed Functional 0 and Polish/Visual 1 into
0.4 in `reward.json`.

## Repair

- Functional explicitly runs from `/opt/common-ground-verifier`. The original
  root-owned helper is within Playwright's allowed file roots. Nothing is copied
  into the submission, and unrestricted file access is not enabled.
- Both observation listeners and interception predicates contain matcher errors.
  Invalid synchronous predicates, asynchronous rejection and nonboolean results
  become retained `evidence-missing` outcomes with cleanup; they do not terminate
  the transport. Normal capture and interruption behavior is preserved.
- The Functional prompt explains the VM's unavailable globals, uses ordinary
  request-method/URL string predicates, and requires fixing/recollecting an
  automation error. A tool error grants no credit and is not an app refusal.
  Before repeating a mutation, the judge must inspect actual state and retained
  request/outcome so it does not manufacture a second action.

Only four files changed from r23: README, Functional judge/prompt, and the embedded
browser helper inside `tests/test.sh`. The other 25 files are byte-identical.
All 71 criterion descriptions, IDs and weights are unchanged. The golden app,
brief, starter, seed, timeouts, other four verifiers, score formula and mandatory
working-product gate are unchanged.

## Validation

- **9 real-MCP resilience checks passed.** The original crashing call now
  produces a retained matcher error; the same browser session then completes
  wrong-password rejection, valid login, populated protected reload and both
  credential-free refusal probes. Direct helper loading works from the configured
  private directory, including MCP workspace roots. Credentials remain redacted.
- **19 real-MCP recovery checks passed.** All six staff write families, lost
  replies, exact visible Retry, multiple pending items, account and tab isolation,
  malformed revision capture, unreadable/503 delivery, held stale requests and
  held replies, and evidence retention after a later assertion were exercised.
- **30 runner checks passed.** Actual final verifier files, real unprivileged
  golden startup/restart with retained session/data, all five dimensions and 71
  criteria discovered, private helper permissions and genuine Codex forwarding.
  Runner verdicts in this test are offline doubles, not a model evaluation.
- **294 ZIP checks passed.** One wrapper, 29 files, exact source bytes, portable
  shell executability, reference task configuration, permitted file layout,
  unchanged authentication gates, maximum reasoning and no provider-key names
  in the Dockerfiles or runner.

These tests use cached pinned dependency layers with the final verifier files;
they are not a clean dependency-download build. No local provider credential was
available for a fresh autonomous Oracle. Full platform QC and scored Oracle/model
runs remain pending. The repair reproduces and removes the demonstrated crash;
it does not establish a new Oracle score or guarantee completion of every
Functional case by the autonomous judge.

## Other supplied runs

| Agent/model | Final reward | Functional | Main recorded result |
| --- | --- | --- | --- |
| NOP | 0 | 0 | Correctly rejected before app grading |
| GPT-5.4-mini | 0 | 0 | Wrong-password response was not visibly rendered; shared gate failed |
| Claude Haiku 4.5 | 0 | 0.1239 | Missing/hidden workspaces and ineffective create/edit/vote controls; agent also exited nonzero |
| Gemini 3.7 Flash | 0 | 0.6429 | Hidden wrong-password rejection failed mandatory gates; incomplete validation/recovery evidence; agent authentication exception also recorded |

Those are the supplied model scores, not new scores for r24. They include app and
agent failures distinct from the reproduced Oracle transport failure. The rubric
was not weakened to raise their scores. The earlier GPT 0.897 is from a different
historical package/model run and is not a result for this release.

Evidence: [run audit](run-audit.json), [Oracle tool sequence](oracle-functional-tools.json),
[resilience results](resilience/resilience-results.json),
[recovery results](helper-integration/helper-results.json),
[runner results](runtime-smoke/runtime-smoke-results.json),
[archive validation](zip-validation.json), [change manifest](package-manifest.json).

SHA-256: `116e38d85b9a8417e71c71d349887733e94472ae3d50ee03b269658a31a7aaf0`.
