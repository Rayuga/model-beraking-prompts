# Common Ground Ballot package

The complete implementer brief is `instruction.md`. Copy the supplied foundation
and authoritative seed into `/app` before implementing the remaining workflows.
`solution/solve.sh` installs the reference application for Oracle runs.

Five verifier dimensions run serially. Each uses the adjacent `prompt.md` named by
its `judge.toml`. `tests/test.sh` creates private evaluator helpers under
`/opt/common-ground-verifier`; RewardKit discovers no root Python helper as a reward.
The lifecycle, provenance and score helpers are standalone executable verifier
commands with explicit Python shebangs; they are not application entrypoints and
are never copied into the submitted app. The application entrypoint remains
`node /app/server.js`, which `solution/solve.sh` installs.
The image retains the genuine Codex executable. The runner installs an idempotent
private PATH shim for trace collection and forwards login/version/help unchanged.

# Scoring contract

RewardKit 0.1.7 first writes its named weighted_mean aggregate, declared in reward.toml, using the numeric weights from each dimension's judge.toml. tests/test.sh then invokes its generated private scorer exactly once to replace that intermediate aggregate with the final gated result.

Render and Constraints use all_pass over their independently reported binary criteria. If either dimension is zero, the final reward is zero. Otherwise the scorer computes the normalized weighted mean of Functional, Polish and Visual. Their sole numeric weight definitions are each [judge].weight; the current values give 60%, 20% and 20%. Gate weights are positive for RewardKit's intermediate calculation but have no final reward mass. There are no ignored weight maps or duplicated numeric coefficients in the runner. Criterion weights only govern their own dimension.

The scorer requires every dimension to be a finite JSON number between zero and one, rejecting booleans, strings and missing values. The runner initializes zero results before launch and restores zeros on grading failure. graded=1 and no_op=0 are written only after successful final composition. Unit fixtures for this plumbing are not Oracle or model scores.

## Minimum working product

Render's all_pass gate includes one new-ballot journey: Coordinator creates and
opens, an eligible Member votes, then the Coordinator closes and publishes.
Refreshed protected records must retain that new voted/published outcome. This
prerequisite runs once on a separate fixture, in addition to workspace navigation;
it does not award extra final reward. Read-only seeded displays therefore get
Render zero and final reward zero, regardless of Polish/Visual scores. The shared
authentication gate and score formula are unchanged. Functional separately checks
that accepted single-choice and approval votes leave the ballot revision unchanged. The pinned runner discovers dimensions in alphabetical order and
runs one at a time, so Render's new fixture follows Functional's seed inspection.

## Verifier time budgets

The judge.toml files allocate 1,800 seconds to Render's authenticated navigation
and new-ballot journey, 1,200 to Constraints' authenticated SQLite inspection,
7,200 to Functional's four phases, and 900 each to Polish and Visual. These are
maximum durations, not fixed waits. The five serial ceilings total 12,000 seconds,
leaving 600 seconds inside the runner's 12,600-second limit; the standard outer
verifier limit remains 13,200 seconds. Functional reuses its accepted votes for
the new before/after revision comparison, without a new workflow or restart.

## Browser evidence runtime

Functional runs from `/opt/common-ground-verifier`, where its root-owned evidence
helper is within Playwright MCP's allowed file roots. It does not copy helper code
into the app or enable unrestricted file access. Helper request listeners and
interception predicates contain errors locally: a malformed matcher is recorded
as missing evidence and removed, rather than terminating the browser transport.
The prompt explains the unsafe-code VM's missing Node/browser globals and safe
string predicates. The evaluator must repair the capture and gather real evidence;
neither tool failures nor absent evidence grant credit.

## Draft review and account changes (r25)

The r25 release introduced 57 Functional criteria and 77 total criteria across the same five
verifier dimensions. Six new independently owned outcomes cover nonconflicting
field merging, explicit conflicting-field decisions, another edit during a
review, discarding a working copy, a lifecycle lock during review, and recovery
responses delivered after the browser changes account. Their weights total 14:
3 each for the three merge/review workflows, 1.5 each for discard and lifecycle
stopping, and 2 for delayed-response account isolation. Existing criterion and
dimension weights are unchanged. The brief states these product requirements;
the golden client implements them without changing the server or seed schema.

The pending-ownership check accepts a real identity preflight that stops a write,
including a signed-out body followed by a denied protected read. It does not
require the submission to send an unauthenticated mutation just to produce 401.
The three accepted-vote revision comparisons have explicit pre-vote evidence
checkpoints, and a shared tab is explicitly created in the same browser context.
The cross-tab check now also closes a tab while its Retry reply is held, requiring
explicit recovery in the surviving tab without a permanent busy flag. Render,
Constraints, Polish and Visual criteria/prompts are unchanged.

Local browser and mutation checks are recorded outside this upload. They are
regressions of the reference and verifier plumbing, not fresh model-judge scores.
The last platform r24 Oracle scored 0.9521; GPT-5.4-mini scored 0.7885. Those scores
are historical and do not establish the outcome of this new package.

## Reviewed rounds (r26)

Functional now has 66 criteria; the task has 86 across the same five verifiers.
Nine new outcomes cover round review/cancellation (3), atomic opening (4), draft
conflicts (4), whole-roster conflicts (4), malformed inputs (2), role enforcement
(1), original success receipts (4), original refusal receipts (4), and interrupted
round recovery (4). These add 30 to the previous Functional total of 73.5. Existing
criterion weights and all dimension weights remain unchanged. Full atomic and
receipt/recovery outcomes use the same weight 4 as existing durable staff-work
criteria; review and boundary weights reflect their narrower scope.

The golden implements one SQLite transaction and one operation receipt per round.
Review includes both active and paused membership revisions. Draft/roster changes
refuse the entire round; explicit re-review creates a new operation. Reordered
input sets keep receipt identity. The existing pending queue retains the complete
round and renders current records after Retry. The other four verifiers, runner,
Dockerfiles, supplied foundation and operational timeouts remain unchanged.
The Functional plan reuses four pairs, one outsider and the existing final
restart, with bounded probe/replay tables and an explicit persistence reserve.
No fresh autonomous Oracle/model/QC score is represented by local validation.
