# Common Ground Ballot r23

The latest screenshot reports static 45/45 and rubric 51/53. This release
addresses both reported findings: insufficient mandatory-gate time budgets and
missing coverage for accepted votes leaving the ballot revision unchanged.

[Upload r23](../../../deliverables/common-ground-ballot/2026-09-16-budget-revision-r23/common-ground-ballot.zip).

## Time allocation

| Dimension | Previous limit | New limit |
| --- | --- | --- |
| Render | 10 minutes | 30 minutes |
| Constraints | 10 minutes | 20 minutes |
| Functional | 150 minutes | 120 minutes |
| Polish | 15 minutes | 15 minutes |
| Visual | 15 minutes | 15 minutes |

These are ceilings, not fixed waits. Reallocating within the existing budget
gives Render time for authentication, six workspaces and the new ballot journey,
and Constraints time for authentication plus read-only database inspection.
Functional retains the largest allocation and reuses its existing successful
votes for the new revision comparisons. There are no new fixtures or restarts
required by that criterion.

The five serial limits still total 12,000 seconds. The unchanged runner allows
12,600 seconds and the standard platform verifier allows 13,200 seconds, leaving
600 seconds at each enclosing boundary. `task.toml`, its agent timeout and its
verifier environment are byte-identical to r22 and continue matching the reference
operational configuration. Actual RewardKit discovery confirmed these effective
judge timeouts. This checks allocation and nesting; a fresh autonomous run is
still needed to measure completion within them.

## Accepted-vote revision coverage

New Functional criterion `accepted_votes_preserve_ballot_revision` compares the
same ballot's real revision immediately before and after the existing accepted
Owen/Leila Courtyard votes and Leila's Verifier approval. It requires accepted
participation and fresh protected reads before any intervening staff action.
It fails increments, decrements or resets. It does not infer correctness from
the seed revision, a cached display or a later relative Close increment.

The natural brief already requires this behavior. It and the golden app are
unchanged. The criterion has its own positive weight of 0.75; the existing 50
Functional criteria retain their exact descriptions, IDs and weights. Other
dimensions retain their coverage, including r22's mandatory working-product gate.

Pinned Playwright MCP browser tests used the seeded Courtyard and an equivalent
new approval fixture, with real sign-ins, UI submissions, recorded participation
and refreshed protected records:

| Disposable app | Courtyard after Owen / after Leila | Approval vote | New check |
| --- | --- | --- | --- |
| Unchanged golden | 4 to 4 / 4 to 4 | 2 to 2 | Pass |
| Increment on every accepted vote | 4 to 5 / 5 to 6 | 2 to 3 | Fail |
| Increment on single-choice only | 4 to 5 / 5 to 6 | 2 to 2 | Fail |
| Increment on approval only | 4 to 4 / 4 to 4 | 2 to 3 | Fail |

All four apps still passed the relative Close increment control. This reproduces
the specific loophole: correct later lifecycle increments cannot establish that
earlier votes preserved the revision. The golden source was never patched;
mutations were made only in disposable test-container copies.

## Validation and scope

- All four targeted browser controls passed their expected assertions.
- 30 runner checks passed, including exact verifier bytes, genuine Codex
  forwarding, real unprivileged golden startup/restart, retained sessions/data,
  five discovered dimensions and 71 criteria. Runner verdict inputs are doubles.
- Actual RewardKit aggregation and the unchanged private scorer passed offline
  fixtures: all-perfect remains 1; failing only the new criterion reduces the
  score; a failed working-product gate still forces zero. These are not model scores.
- 294 ZIP checks passed: one wrapper, 29 files, exact source bytes, portable
  executable shell files, required layout/configuration, maximum reasoning,
  unchanged shared authentication gates and helper-source integrity.
- Only five files changed from r22: README, the Render/Constraints/Functional
  judge files, and the Functional prompt. The other 24 files are byte-identical.

The initial report-only browser driver needed a local variable rename and a
reload capture correction: a fresh read must belong to the new document, rather
than an earlier request whose body disappears on navigation. Those failed harness
attempts are excluded from the final passing results. Their retained errors are
under `initial-harness-failures`; no shipped task change was made for them.

Validation used cached pinned dependency layers with the final verifier files,
not a fresh dependency-download build. Fresh platform QC and full autonomous
Oracle/model runs remain pending. No Oracle 1.0, guaranteed timeout sufficiency,
53/53 QC or new model-score range is claimed.

Evidence: [browser outcomes](revision-results.json),
[golden revision observations](revision-golden/revision-verdict.json),
[effective budgets and scoring](budget-score/budget-and-score-results.json),
[runner checks](runtime-smoke/runtime-smoke-results.json),
[ZIP checks](zip-validation.json), [byte comparison](package-manifest.json).

SHA-256: `e0a9d37a0ec9188749abdc46808c19c97a4124e1939b2c96e2c5d8de29145798`.
