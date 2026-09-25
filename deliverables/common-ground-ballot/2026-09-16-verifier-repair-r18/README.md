# Common Ground Ballot r18

[Download common-ground-ballot.zip](common-ground-ballot.zip).

This repairs the verifier workflow that left r17 Oracle checks incomplete.
It is a locally validated repair candidate. **A fresh scored platform Oracle
run and platform QC are still required; Oracle 1.0 has not been established for
this ZIP.** The local workspace has no configured platform runner or required
judge credential, so no substitute model was used to manufacture a score.

## Changes

- Functional now uses four phases with independent fixtures and saved completion
  records. A failed capture or assertion must not abandon independent later
  checks. The prompt was reduced from 6,536 to 3,340 words.
- One comprehensive final restart checks sessions, structural records, results,
  receipts, roster snapshots and pending work. Repeating the full restart ledger
  a second time is no longer required. Product durability requirements remain.
- A trusted browser helper captures actual requests and upstream outcomes before
  assertions, retains them across tool calls, bounds waits, and supports dropped,
  held, malformed and failed response delivery. It loads through the pinned
  Playwright MCP tool's supported `filename` argument.
- Negative probes verify the real field and current fixture state. Direct probes
  use native browser calls in separate arm/send/collect steps; a stalled draft
  convenience method was removed after local reproduction.
- Each Codex judge call now records redacted events, stderr, final output and
  timing under `/logs/verifier/judges/<dimension>/attempt-*/`. RewardKit receives
  only the final verdict in its usual mode. Relevant session rollouts are retained
  without copying authentication files. Helper and wrapper hashes are included
  in prompt provenance.

There are still **five verifier dimensions and 68 criteria**: Render 1,
Constraints 2, Functional 49, Polish 10, Visual 6. Every criterion ID, type and
weight is unchanged. The public instructions, golden solution, seed, task
metadata, timeouts, judge model/effort settings and final scoring formula are
byte-identical to r17. Only verifier implementation and procedure files changed.

## Validation

| Check | Passed |
| --- | ---: |
| Standard configuration checks | 179 |
| ZIP/archive checks | 472 |
| Trace-wrapper cases | 8 |
| Runtime and isolation groups | 5 |
| Runner/scoring cases | 19 |
| Golden recovery groups | 23 |
| Golden input-boundary cases | 58 |
| Actual pinned MCP helper integration groups | 19 |

The final six rows total **132 local regression groups**. They include all six
interrupted staff action families, account/tab isolation, exact retry, omitted
revision returning 400, held-request stale refusal, unreadable/503 delivery,
reload before acknowledgment, bounded missing capture, and evidence surviving a
later assertion failure. These are scripted behavior/integration tests, not a
scored autonomous judge run.

The verifier image was assembled using the existing pinned r17 dependencies and
the new runtime files. Every `/tests` file in the tested image matches the ZIP.
This was not a clean dependency-download build. The next platform runtime has
not been measured; fewer repeated steps do not establish a guaranteed duration.

See [package-audit.json](package-audit.json) and the individual result files in
this directory. Failed development attempts are preserved outside the ZIP in
the authoring report directory. Historical r17 remains unchanged and marked
failed.

SHA-256: `35809a2ac0264b81e238bb5c80d670132f67c68c9de075f646504a1577fb88e8`.

Upload this r18 ZIP for the next platform QC/Oracle run. Inspect its new judge
event/timing files if any required observation is missing. Do not infer a new
Oracle or GPT score from the old runs or the local pass counts.
