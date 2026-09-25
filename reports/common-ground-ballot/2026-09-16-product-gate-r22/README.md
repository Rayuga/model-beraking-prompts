# Common Ground Ballot r22: minimum working product

The supplied screenshot reports static 45/45 and rubric 52/53. Its remaining
finding is valid: authenticated, SQLite-backed seeded displays can collect
presentation points and several read-only Functional points without implementing
the ballot lifecycle. This release makes a real completed ballot journey a
prerequisite for any final reward.

[Upload the r22 ZIP](../../../deliverables/common-ground-ballot/2026-09-16-product-gate-r22/common-ground-ballot.zip).

Only `tests/render/judge.toml`, `tests/render/prompt.md` and the package README
changed from r21. The other 26 files, including the natural brief, golden app,
starter, seed, runtime helpers, other four verifiers, timeouts and score formula,
are byte-identical. No additional product requirement was introduced.

Render's existing `all_pass` aggregation now includes `working_ballot_journey`:
create a uniquely named two-choice ballot, Open, accept an eligible Member's vote
in another context, Close and Publish. Refreshed protected records and the visible
result must retain that particular voted outcome. Seeded records, optimistic
messages and a successful HTTP status alone cannot pass. The core journey is
five writes, once; optional roster setup is explicitly allowed. There is no extra
process restart or repeated recovery/receipt matrix. Detailed Functional checks
retain their existing scope and weights.

| Local browser control | Observed outcome | Maximum final reward with every other criterion perfect |
| --- | --- | --- |
| Unchanged golden, fresh database | Completed the journey and both-context reload | 1 remains possible; not a full Oracle score |
| Same golden database, second fresh ballot | Completed again with the earlier published/voted fixture retained | 1 remains possible; not a full Oracle score |
| Authenticated read-only app | Create refused with HTTP 405 | 0 |
| Creation-only app | Draft created; Open refused with HTTP 405 | 0 |
| Cosmetic Publish success | Publish returned 200; refreshed record remained Closed | 0 |

These are real browser runs through pinned Playwright MCP 0.0.79 against disposable
copies of the golden server. Negative controls preserve authentication, populated
backend reads and the full styled UI. The observed prerequisite verdicts were
then fed through the actual installed RewardKit aggregation and unchanged final
scorer, deliberately setting every other criterion to 1. This proves the reward
ceiling for the controls; it does not substitute for autonomous judging.

Additional checks passed:

- Installed RewardKit discovery and scheduling, with offline judge responses:
  serial Constraints, Functional, Polish, Render, Visual; peak concurrency one.
  Render's new fixture therefore cannot affect Functional's initial seed check.
- 30 runner checks: real golden Node startup as an unprivileged user, restart
  retaining session/data, private helper permissions, all five dimensions and
  70 criteria discovered, idempotent genuine Codex forwarding, final composition
  and evidence provenance. RewardKit verdicts in this runner test are doubles.
- 294 local archive checks: 29 files, one wrapper, exact source-byte agreement,
  required layout and reference task configuration, executable shell files,
  all five verifier folders, maximum reasoning, unchanged shared auth gates,
  no provider-key names in the Dockerfiles or runner.

There are still five serial judge passes: Render 2 criteria, Constraints 2,
Functional 50, Polish 10 and Visual 6. Render retains its 600-second budget. The
targeted script duration is not a measurement of autonomous judge reasoning time.

The first refusal controls used HTTP 403, which invokes the golden client's
session-recovery path; the capture harness timed out and those attempts were
rejected, not counted as passes. Their artifacts remain in `diagnostic-attempt-1`
and `diagnostic-attempt-2`. Final controls use 405 to model missing business-write
methods and require an actually captured refusal. This does not change any
shipped task file or relax the gate.

Fresh platform QC, full scored Oracle and model runs are still pending. Local
validation used cached pinned dependency layers with the final verifier files;
it was not a fresh download build. No Oracle 1.0, 53/53 QC or model-score range
is claimed.

Evidence: [browser runs](gate-run-results.json),
[observed control score ceilings](order-score/observed-control-score-results.json),
[actual scheduler and aggregation](order-score/order-and-score-results.json),
[runner checks](runtime-smoke/runtime-smoke-results.json),
[archive validation](zip-validation.json),
[byte comparison](package-manifest.json),
[independent review](independent-review.md).

SHA-256: `68786691e1f87a0a747fe6e40b52d48b420da73394267ec652cf8afcc983aeb2`.
