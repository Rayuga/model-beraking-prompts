# Cross-device model-breaking task execution prompt

Use this file when assigning one of the three new tasks to a separate device or
agent. Start the session with:

```text
Read MODEL_BREAKING_TASK_EXECUTION_PROMPT.md and work on <task-name>.
```

Valid task names are:

- `common-ground-ballot`
- `coursemark-assessment-workspace`
- `pellmoor-job-pipeline`

Work on exactly the named task. Do not edit, repackage, rerun, rename, or clean
the other two tasks.

## Mission

Turn the named source task into a complete, fair, deterministic Harbor WebDev
task that separates a correct implementation from a polished but incomplete
one. Use the accepted DropLine, Brickfall, and BazaarBridge work as structural
and quality references, not as domain templates.

The task must be achievable by the golden solution, reliably verifiable through
real browser behavior, and difficult because of coupled state and downstream
effects. Do not manufacture difficulty through missing instructions, brittle
selectors, hidden routes, timing luck, judge trivia, or an application that
cannot start.

The primary target is `openrouter/openai/gpt-5.4-mini`. The formal accepted
reward band is `0.1 <= reward <= 0.7`; aim internally for `reward <= 0.5` while
remaining above `0.1`. The Oracle must score above `0.95` and pass every
Functional criterion. A genuine Haiku score of `0.0` is acceptable, but an
infrastructure failure, missing artifact, ungraded no-op, judge failure, or
application-start failure is not a valid model result.

Stay on the task until the requested task, runs, QC, reports, and clean delivery
package are complete, or until a genuine external blocker remains after safe
diagnosis and retries.

## Read before editing

Read these files completely and follow the newest rule when sources differ:

1. `MODEL_BREAKING_PLAYBOOK.md`
2. `TASK_AUTHORING_CONTEXT.md`
3. The named task's current `instruction.md`, `task.toml`, `environment/`,
   `solution/`, and `tests/`
4. Root validation references that exist locally:
   - `Task QC - platform.docx`
   - `upload-checks-README.md.docx`
   - `RL_Task_QC_Scorecard.xlsx`
   - `Deliverables Tracker_- WebDev_.xlsx`
5. Current accepted references for shape and quality:
   - `projects/dropline-four-lite/`
   - `projects/brickfall-breaker-arcade/`
   - `projects/bazaarbridge_marketplace/bazaarbridge-marketplace/bazaarbridge-marketplace/`

Also inspect the latest valid run evidence and QC reports for the references
when needed. Do not copy their domain rules, credentials, seed values, API
shapes, or verifier steps into the new task.

Before changing anything:

- Run `git status --short --branch` and preserve unrelated user changes.
- Confirm the named project folder resolves inside `projects/`.
- Inventory every existing source, asset, requirement, criterion, and expected
  artifact.
- Record the current task version and identify whether any existing evidence is
  valid for that exact version.
- Make a short fairness ledger mapping every intended invariant to an
  instruction or shipped asset and a verifier criterion.

## Canonical identity

Use the exact supplied three-word lowercase kebab-case slug everywhere the task
identity is expected:

```text
projects/<task-name>/
task.toml: name = "turing/<task-name>"
solution package name: <task-name>
tests/coverage.json task identity: turing/<task-name>
Docker task label: <task-name>
task ZIP: <task-name>.zip
ZIP wrapper: <task-name>/
```

Display headings may use normal capitalization and spaces. Database, seed, and
domain-record filenames are resources and do not need to repeat the full slug.
Remove stale former slugs from canonical metadata, runtime paths, prompt-version
comments, and scripts.

## Domain direction

Preserve useful behavior and assets already present in the downloaded source,
then deepen the task through realistic coupled workflows.

### `common-ground-ballot`

Category: Forms, Auth & Onboarding. Build a civic ballot and election-management
workspace. Strong differentiators include eligibility, draft ballots, one-time
submission, multiple ballot types, closing rules, exact deterministic tallying,
tie handling, result visibility, audit history, rejected-write safety,
idempotency, and account/role isolation.

### `coursemark-assessment-workspace`

Category: Education. Build an instructor/student assessment workspace. Strong
differentiators include attempt state, autosaved answers, deadlines, rubric
grading, score recalculation, publish/retract behavior, feedback visibility,
role and course isolation, resubmission rules, concurrent grading, and durable
history.

### `pellmoor-job-pipeline`

Category: Recruiting / Hiring Operations. Build a candidate hiring pipeline.
Strong differentiators include legal stage transitions, interviews, evaluator
feedback, offer/rejection terminal states, reopening rules, stage history,
derived funnel totals, duplicate candidates, stale updates, role enforcement,
and durable audit state.

These are design directions, not permission to invent unchecked requirements.
Every retained or added feature must be instruction-backed, implemented by the
golden solution, mapped in coverage, and exercised deterministically.

## Product and instruction requirements

- Keep the task moderately scoped for GPT-5.4-mini and Haiku. Prefer a smaller
  number of deeply coupled workflows over a huge list of unrelated pages.
- Use vanilla HTML, CSS, and browser JavaScript; Node.js with Express; and
  durable SQLite storage unless newer task-specific authority explicitly says
  otherwise. Locally bundle every runtime dependency and asset.
- Use server-issued unpredictable bearer sessions stored in SQLite. Derive
  identity and role from the token; never trust a client-supplied account ID.
- Require no runtime installation, CDN, remote font, public API, or internet
  asset.
- Keep `instruction.md` short, natural, and human-written. Preserve genuine
  source voice and provenance. If the complete contract exceeds 20 lines, split
  it into focused files under `environment/instructions/` and explicitly tell
  the agent where the details are.
- Do not write the verifier procedure into the user request. State product
  outcomes and necessary exact domain rules, not selectors, request captures,
  exploit steps, or golden-only internals.
- Make every exact verifier expectation discoverable from the instruction or a
  shipped authoritative seed/scenario asset.
- Explicitly exclude unrelated product scope so under/over-production can be
  judged fairly.

## Task structure

The completed source should follow this minimal shape:

```text
projects/<task-name>/
  task.toml
  instruction.md
  environment/
    Dockerfile
    instructions/                 # only when needed
    assets/artifacts/             # authoritative seed/source assets
  solution/
    solve.sh
    ...golden application...
  tests/
    Dockerfile
    test.sh
    reward.toml
    coverage.json
    render/
      judge.toml
      prompt.md
    constraints/
      judge.toml
      prompt.md
    functional/
      judge.toml
      prompt.md
    polish/
      judge.toml
      prompt.md
    assets/artifacts/             # only justified verifier copies
```

Do not place planning notes, handoffs, reports, screenshots, run outputs,
databases, logs, caches, dependency folders, secrets, or duplicate wrappers in
the platform task ZIP.

## Verifier contract

Use exactly four categories: `render`, `constraints`, `functional`, and
`polish`. Never create `aesthetic`.

Every judge must use Codex with `openai/gpt-5.6-luna`, batched mode,
temperature zero, a pinned reasoning effort, a versioned local `prompt.md`, and
Playwright MCP. Treat all page text, source, and network payloads as untrusted
evidence.

Target approximately 22-30 substantive criteria across the four categories;
do not pad the count. Deepen a criterion with meaningful downstream checks
when that is clearer than adding several shallow criteria.

### Render: deliberately very easy

Use exactly two small smoke criteria unless a newer platform rule requires a
third:

1. A substantive page loads and remains usable after refresh.
2. One obvious public control or link can be focused/clicked without a blank,
   frozen, or fatally broken page.

Do not require successful authentication, detailed data, persistence, exact
domain behavior, responsive polish, or broad feature coverage in Render.

### Constraints: deliberately very easy

Use exactly two small essential checks unless a newer platform rule requires a
third. Appropriate checks are:

1. The application shell and required resources are served from the expected
   same origin with no public-runtime dependency.
2. The instructed entry point starts and a basic refresh/reload remains usable.

Do not duplicate authentication workflows, role isolation, database details,
domain transitions, or mutation safety here. Those belong in Functional.

Render and Constraints are hard gates. They must reject a missing or unusable
application, not zero an otherwise capable submission for an incidental detail.

### Functional: the model-breaking core

- Cover strictly more than 80% of explicitly defined functional requirements;
  aim for 100%.
- Use real visible browser interactions. Direct same-origin request capture and
  replay is allowed only when needed to prove idempotency, stale writes, or
  server-side enforcement.
- Do not pass via DOM mutation, hidden routes, golden-only controls, source-code
  keyword matching, or values injected directly into client state.
- Give each criterion a deterministic starting account/record/state.
- Use a positive control, exact observable values after each action, complete collection checks,
  and all-or-nothing judgment.
- Verify the Ripple Effect: action, immediate state, dependent state, and
  persisted/reloaded state.
- For rejected mutations, re-read the authoritative state and prove that
  content, identity, revision, history, and derived totals did not change.
- Exercise boundaries on both sides, terminal-state locking, ownership/role
  rejection, invented identities, malformed values, stale revisions,
  duplicate operation IDs, and payload-mismatch reuse where relevant.
- Make retries and concurrency deterministic. Use fresh opaque operation IDs
  for fresh actions and persist original success and known-4xx receipts.
- Continue to independent criteria after a failure so the report stays useful.

### Polish

Test concrete instruction-backed interaction and product quality: responsive
layout, keyboard use, focus, accessible names/status, visible feedback, touch
targets, hierarchy, coherent styling, complete workflows, and reduced motion.
Do not use subjective taste as the main source of task difficulty.

## Coverage, seeds, and versions

- `tests/coverage.json` must define the functional denominator, map every
  requirement to live criterion IDs, enumerate all live criteria, and report
  measured Functional coverage.
- Keep the authoritative seed under `environment/assets/artifacts/`. A verifier
  copy is allowed only because the separate verifier cannot access the agent
  image; document this reason and require byte-identical SHA-256 values.
- Seed enough records to prove ordering, omission, caps, ownership, and boundary
  behavior rather than checking a single example.
- Record SHA-256 hashes for authoritative seeds and frozen golden files after
  the final edit.
- Any material instruction, seed, verifier, prompt, golden, or frozen-baseline
  change requires a semantic version bump everywhere: `task.toml`, coverage,
  Docker labels, prompt-version comments, package metadata when applicable, and
  reports.
- Packaging-only and report-only changes do not require model reruns.

## Reward and runner

Use only this policy:

```text
if render <= 0 or constraints <= 0:
    reward = 0
else:
    reward = 0.6 * functional + 0.4 * polish
```

Declare zero weights for Render/Constraints and `0.6/0.4` for
Functional/Polish in `reward.toml`. `tests/test.sh` must validate all four
finite scores in `[0,1]`, apply the hard gate itself, and atomically write the
final reward files. Every startup, judge, parse, timeout, or post-processing
failure must leave a complete zero record with all dimension fields.

The runner must reject missing entry files and unsafe symlinks, start from a
clean database, stage safely, run the app as an unprivileged user, use a bounded
readiness probe, guarantee private logs and reward files, and stop the app on
exit. If judge categories share one SQLite state, serialize them with
`rewardkit --max-concurrent-agent 1` or prove stronger isolation.

Keep timeout ordering valid:

```text
individual judge timeout < RewardKit/test.sh timeout < task verifier timeout
```

## Golden solution and unpaid checks

Build the complete golden implementation before paid model runs. It must use
the same public UI, server rules, and normal endpoints available to any correct
submission; do not add verifier-only shortcuts.

Before the first Oracle run:

1. Parse every JSON/TOML file and run syntax checks for shell, Node, and any
   additional language used.
2. Build both Dockerfiles from clean contexts.
3. Run `solution/solve.sh` through the same staging layout the Oracle uses.
4. Start as the verifier's unprivileged user and pass readiness, page load,
   refresh, and restart checks.
5. Exercise the golden workflows locally, including persistence and rejected
   write unchanged-state checks.
6. Verify every criterion has an instruction/asset anchor and every criterion
   is capable of passing.
7. Test reward arithmetic for gate-pass, Render-zero, Constraints-zero,
   malformed-score, and missing-output cases.
8. Run a no-op/refusal probe and require reward `<= 0.05`.
9. Run the current 19 source-decidable Task QC checks and all 26 upload rules.
10. Fix every P0/P1 and every deterministic source/package failure before a
    paid run. Record lower-severity exceptions honestly.

Do not call a browser-judge run deterministic merely because it passed once.
Remove dependence on wall-clock races, network timing, random generated IDs,
criterion ordering, or hidden state.

## Required run sequence

Never put a provider key in a tracked file, command transcript, report, task
ZIP, Git commit, or chat response. When a run is ready, ask the user to supply
or set `OPENROUTER_API_KEY` if it is not already present. Use it only in the
current process environment or a local ignored env file, do not echo it, and
redact it from logs and exports.

Use one Harbor job lane per machine by default. Parallelize only after proving
separate ports, containers, databases, job directories, and enough memory.

### Phase 1: initial Oracle

Run Oracle on the fully checked candidate. Accept it only when:

- the intended task version/checksum was used;
- the artifact exists and boots;
- `graded=1`, `no_op=0`, and no trial exception occurred;
- Render and Constraints pass;
- final reward is above `0.95`; and
- every Functional criterion passes individually.

If Oracle fails, inspect criterion reasoning and reproduce the failure. Decide
whether the defect is in the golden solution, verifier, instruction/asset
anchor, runner, or infrastructure. Fix the correct layer. Never weaken a valid
requirement merely to force a pass. Bump the version for material changes and
repeat static QC plus Oracle until valid.

### Phase 2: GPT-5.4-mini tuning

Run the untouched target through OpenHands using
`openrouter/openai/gpt-5.4-mini` with the current required reasoning effort and
version. Do not manually repair its collected artifact before scoring it.

Accept a GPT score only when the model was actually called, the artifact boots,
`graded=1`, `no_op=0`, both hard gates pass, all dimensions and expected
criteria were judged, and the reasoning describes concrete observations.

- If reward is above `0.7`, deepen fair Functional Ripple-Effect checks or
  coupled domain behavior. Prefer an internal final target at or below `0.5`.
- If reward is below `0.1`, first rule out provider, build, startup, artifact,
  judge, timeout, and hard-gate failures. If the run is valid but the task is
  unfairly opaque, restore fairness anchors or rebalance substantive criteria.
- If surprising failures appear, reproduce them against the untouched model
  artifact. Fix false positives and false negatives in the verifier.
- Do not tune against wording alone or reveal exact verifier scripts to the
  target model.

Every material tuning change invalidates the earlier Oracle and GPT evidence.
Bump the version, rebuild hashes/ZIP, rerun static QC, then rerun GPT as needed
until a valid untouched artifact lands in `0.1-0.7`.

### Phase 3: final Oracle on the frozen version

Once GPT is valid and in range, freeze the task. Run Oracle again against that
exact same version, task checksum, seed hashes, criterion set, judge model, and
reward formula. If the final Oracle exposes a golden defect, correct the golden
or appropriate source, bump/freeze again, and repeat both GPT and final Oracle
because the prior pair no longer represents one version.

Do not proceed until the final frozen version has both:

- valid GPT-5.4-mini in the accepted band; and
- valid Oracle above `0.95` with every Functional criterion passing.

### Phase 4: Haiku on the same frozen version

Run `openrouter/anthropic/claude-haiku-4.5` against the exact frozen version.
Use explicit model token metadata if the installed OpenHands/Harbor adapter
requires it. A score of `0.0` is acceptable only when the model genuinely ran,
produced an artifact, the artifact was handed to the verifier, and the result
is a real graded outcome (`graded=1`, `no_op=0`) with no infrastructure or judge
error. Diagnose and retry setup, zero-context, missing-token-metadata, provider,
build, startup, or verifier handoff failures; do not misreport them as model
failures.

Do not keep spending retries merely to raise a legitimate graded Haiku zero.
Record the actual failure mode and criterion evidence.

### Phase 5: any currently required additional target

Check the newest tracker/admin instruction. If Sonnet 4.5 is still required,
run and export it on the same frozen version after Haiku. GPT-5.6-luna is the
judge model and is not a substitute for a required target-model rollout.

## Post-run QC

After the final Oracle, GPT, and Haiku runs:

- Re-run the 19 source checks and 26 upload checks against the frozen package.
- Complete the run-dependent RL scorecard using authoritative result files,
  not remembered scores.
- Recompute every category score from criterion weights and recompute the final
  reward from the hard-gate formula.
- Confirm exact criterion ID uniqueness and expected counts in every run.
- Confirm Oracle, GPT, and Haiku use the same frozen task version/checksum.
- Distinguish root failures from downstream blocked criteria.
- Confirm model failures are genuine product defects rather than judge,
  infrastructure, startup, or timeout defects.
- Rescore surprising hero failures when justified and preserve the untouched
  original artifact.
- Scan source, runs, reports, and every ZIP for provider keys, bearer tokens,
  `.jwt_secret`, private paths, databases, WAL/SHM files, caches, and accidental
  dependency trees. Sanitize copies without rewriting original evidence.

No unresolved P0/P1 is allowed. Record optional scorecard measurements that
were not run as open evidence gaps, not as false passes.

## Delivery

Create a delivery directory outside the task source. Include the current
tracker-required artifacts, normally:

- `<task-name>.zip`
- `<task-name>-oracle-run.zip`
- `<task-name>-gpt-5-4-mini-run.zip`
- `<task-name>-haiku-run.zip`
- `<task-name>-sonnet-4-5-run.zip` when still required
- `<task-name>-eval-report.docx`
- `<task-name>-case-study-report.md` or the currently approved format
- QC workbook/JSON when requested, outside the platform task ZIP

The evaluation report must follow the successful DropLine-style presentation:
product overview, overall score table, feature/subfeature coverage, complete
verifier matrix, per-model evidence, interpretation, packaging/QC, remaining
observations, and evidence locations. Mark ungraded dimensions as `N/G`; never
turn missing evidence into a reported failure or pass.

The task ZIP must contain exactly one top-level `<task-name>/` wrapper and only
allowlisted task files. Verify entry CRCs, reject absolute/traversal paths,
compare every ZIP file byte-for-byte with the frozen source, and record SHA-256.
Run outputs and reports never go inside the platform ZIP.

## Git and cross-device handoff

- Do not use repository-wide `git add -A`; stage only the active task and its
  approved delivery/evidence files.
- Never overwrite or delete unrelated dirty-worktree changes.
- Do not commit API keys, generated databases, raw secrets, caches, or local
  overrides.
- Commit or push only when the user asks. Before pushing, fetch, check
  divergence, scan staged files, push, and verify `HEAD == origin/main`.
- Leave a concise handoff containing task slug, version, source commit, package
  hash, exact run directories, Oracle/GPT/Haiku scores, criterion failures,
  known infrastructure incidents, QC status, and the next required action.

## Definition of done

Do not call the task finished until all of these are true:

- Exact three-word naming is consistent.
- Structure and all applicable upload checks pass.
- Requirements are fair, instruction-backed, and mapped to deterministic
  assertions with Functional coverage above 80%.
- Render and Constraints are small, stable, and easy for a working app.
- Golden solution passes locally and through final Oracle.
- Final Oracle is above `0.95` with every Functional criterion passing.
- Untouched GPT-5.4-mini is a valid graded run in `0.1-0.7`, preferably at or
  below the internal `0.5` target.
- Haiku ran on the same frozen version and any zero is a genuine graded result.
- Required additional target-model evidence is present.
- No P0/P1 or unexplained verifier anomaly remains.
- Task ZIP is exact, minimal, clean, secret-free, and independently validated.
- Reports and run ZIPs are accurate, sanitized, and outside the task ZIP.

At completion, report what changed, final version and hashes, verifier counts,
coverage, exact run scores, valid model failure modes, QC status, delivery
locations, and any genuinely optional open measurements.
