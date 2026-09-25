# Common Ground Ballot: r17 Oracle failure

The new platform Oracle scored **0.7517 overall**, with **0.5862 Functional**
and **1.0 in each other dimension**. r17 is a failed candidate and should not
be rerun unchanged. The primary observed problem is incomplete or invalid
verifier evidence. Earlier scripted local checks did not establish that the
full autonomous judge workflow would complete; the earlier readiness claim
was too strong.

## What ran and how long

There are **five serial browser judges**, containing **68 criteria**:

| Judge dimension | Criteria | Oracle score |
| --- | ---: | ---: |
| Render | 1 | 1.0 |
| Constraints | 2 | 1.0 |
| Functional | 49 | 0.5862 |
| Polish | 10 | 1.0 |
| Visual | 6 | 1.0 |

Criteria are batched within each dimension; these are not 68 independent judge
runs. All five repeat the shared application/authentication gate. Functional
contains an extensive sequential workflow involving roles, request boundaries,
ballot lifecycle, privacy, exact receipts, roster changes, two restart sequences,
and recovery across six staff action families, accounts and tabs.

The exported Oracle verifier took **2,477.748 seconds (41 minutes 18 seconds)**;
the whole trial took **2,509.779 seconds (41 minutes 50 seconds)**. It finished
with `graded=1` and no reported exception. There is no timeout evidence, and the
Functional timeout is already 9,000 seconds. The export contains no per-dimension
durations. It cannot explain additional platform/UI time beyond this trial or
confirm the more-than-50-minute wall time the user observed.

## Where Oracle lost marks

Nine Functional criteria lost 24 out of 58 available Functional weight.

| Criterion or group | Lost weight | Exported reason |
| --- | ---: | --- |
| Five pending-work recovery criteria | 20 | Required actions and saved observations were not completed. |
| Roster conflict snapshot chain | 2 | Automation crashed before saving the request/response and three-row ledger. |
| Stale ballot revision refusal | 1 | Earlier Draft request had an extra invalid field; the correctly shaped request was made after the ballot was Open. |
| Identified staff turnout | 0.5 | Final reads worked, but the one-participant Ruth positive-control capture was missing. |
| Ballot target/revision validation | 0.5 | Judge alleged an omitted edit revision received HTTP 200; its actual request was not exported. |

Thus **23.5 of the 24 lost weight points explicitly concern missing evidence,
crashed automation, or an invalid probe**. The five recovery deductions do not
demonstrate that the corresponding golden behaviors failed. They also cannot
be converted into passes without completing the observations.

The remaining missing-revision allegation **did not reproduce** in a fresh
disposable copy of the actual exported Oracle app through the pinned Playwright
MCP 0.0.79. A genuine UI edit was captured and adapted with a fresh operation ID
and the actual `expected_revision` field removed. The serialized request was
saved before sending it against a current Draft. It returned **HTTP 400**, with
the ballot/roster/audit snapshot unchanged. A subsequent valid UI edit succeeded
with HTTP 200, advancing revision 2 to 3. This agrees with the earlier local
evidence and the server's pre-dispatch validation. Without the original platform
request capture, the cause of its reported HTTP 200 remains unknown.

The same narrow reproduction also completed one real recovery path: a create
committed while its response was dropped, the pending entry survived reload
without an automatic write, and explicit UI Retry sent the exact original
request. The server returned the original HTTP 201 receipt with replay marked
true, the pending entry cleared, and the business snapshot stayed unchanged.
All **three targeted checks passed**. This confirms those specific behaviors
and MCP compatibility; it is not a full scored Oracle rerun or proof that every
recovery scenario will complete under the autonomous judge.

## Package and log cross-check

The platform prompt, rubric, recovery addendum, runner and scorer hashes match
the frozen r17 package. The exported Oracle server and UI files are byte-identical
to the frozen golden. This is not an identified upload mismatch.

The final score was computed correctly. The separate `rewardkit.log` intermediate
aggregate includes the gate weights; `tests/score.py` correctly applies the
required final 60% Functional / 20% Polish / 20% Visual formula after the gates.

The export lacks the judge's raw tool trajectory, request captures, screenshots
and checkpoint ledgers. Its trajectory references are null. The exact automation
exception and alleged malformed request therefore cannot be recovered from this
export. The application log shows startups and no application error.

## Other supplied runs

NOP scored 0 as expected. The other new model run is **Claude Haiku 4.5**, not
GPT, and scored 0. Its exported frontend has concrete loading/navigation defects:
restored sessions do not load initial application data, and navigation removes
the heading that later navigation attempts to update. Health and SQLite worked,
but the application failed the shared browser gate. No fresh GPT run was supplied.

## Repair plan

1. Keep the five dimensions and the product requirements. Replace the single
   fragile Functional journey with four bounded phases: authentication/input
   boundaries; ballots/privacy/results; recovery/accounts/tabs; persistence.
   Save evidence immediately, and allow independent phases to continue after a
   helper or fixture failure.
2. Provide a small trusted browser helper for bounded request capture, isolated
   contexts, response interruption and evidence storage. Discover requests and
   selectors from the submitted UI; do not hardcode golden endpoints or DOM IDs.
3. Reuse observed staff exchanges for receipts, operation namespaces, recovery
   and audit checks while keeping criterion verdicts independent. Replace
   duplicate full restart/replay sequences with one comprehensive final restart
   ledger that preserves the required durability coverage.
4. Validate negative probes before sending them. An omitted-revision probe must
   prove the actual transmitted revision field is absent; a stale-only probe must
   target a current Draft with an otherwise valid body. Persist both request and
   response before assertions.
5. Retain raw judge/tool traces and dimension timings. Validate the complete
   revised workflow through pinned MCP, then require a **fresh scored platform
   Oracle run** before claiming Oracle readiness. Scripted component checks alone
   are insufficient. Do not fabricate passes for missing evidence.

No task, golden solution, scorer or ZIP has been changed by this diagnosis.
There is no repaired release yet. Increasing the timeout or adding more prose
alone would not address the demonstrated failures.

The pinned local integration was also inspected: RewardKit 0.1.7 does not expose
a trajectory/duration output flag, and `atif_trajectory` is an input rather than
an output setting. Codex 0.151.0 supports JSONL event output and a separate final
response file. A candidate verifier wrapper can save events, stderr, final
response and elapsed time separately per dimension/attempt, returning only the
final response to RewardKit and preserving the exit status. This integration
must be tested before packaging: passing the event stream directly to RewardKit
would break verdict parsing. Relevant session rollout files may provide fuller
tool evidence; never copy the entire Codex home or authentication files.

## Evidence

- [Machine-readable audit](run-audit.json), generated by [audit.py](audit.py).
- [Fresh targeted MCP results](mcp-reproduction/mcp-recovery-reproduction-results.json), with actual request/response evidence in the same folder.
- [Targeted MCP driver](mcp-failure-repro.cjs) and [disposable exported-app runner](run-mcp-repro.py).
- Oracle/NOP run: `run-7cc29c66-a32f-4a7a-bb93-bea23993c795`.
- Oracle trial: `common-ground-ballot__PoFcosA`; NOP trial: `common-ground-ballot__pyc8oFk`.
- Haiku run: `run-da46d1e1-1f11-4019-8af8-2e2c9ff64cba`, trial `common-ground-ballot__iK9n9ye`.
- Immutable r17 ZIP SHA-256: `51465c839d05a23574b787ff7e4d01aeb3118c82cb138d8b3be875ab5d73c3a2`.
