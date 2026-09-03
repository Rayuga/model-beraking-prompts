# Model-Breaking WebDev Playbook

Updated: 2026-09-04

This is the portable, day-to-day operating guide for creating, hardening,
running, and delivering model-breaking Harbor WebDev tasks in this repository.
It distills the current repository rules, our run history, and the three
external methodology notes reviewed on 2026-09-04. For exact current platform
fields and task-specific status, also read `TASK_AUTHORING_CONTEXT.md`.

## Source priority

When sources disagree, use this order:

1. The newest written admin or platform instruction.
2. The current upload checker and QC scorecard.
3. `TASK_AUTHORING_CONTEXT.md` and a known-good current reference task.
4. This playbook.
5. Older tasks, run exports, and archived examples.

The external notes are methodology references, not authority over newer admin
requirements:

| Reference | SHA-256 |
| --- | --- |
| `delivery-v3.md` | `22D2E61C13DFF589F7738B633007872584F2ADF323941DA44678B2E37BECB021` |
| `restructure-v2.md` | `0C20D1B7BBB2101C60FEADDE6EBBAC9BF4FA88FD80844E648C3550FEFE018169` |
| `MODEL_BREAKING_PROMPT.md` | `F8997D2962158DA8DB8C638AF1DC0E5B87427FF929117C12AD7B8AE1E57882FB` |

## What model-breaking means

A valid model-breaking task separates a complete, correctly enforced solution
from an attractive or mostly working imitation. Difficulty must come from
reasoning, state transitions, and enforcement. It must not come from hidden
requirements, vague judging, broken infrastructure, or an Oracle failure.

Use two score targets:

- Formal platform keeper band: `0.1 <= frontier reward <= 0.7`, unless newer
  admin guidance changes it.
- Internal hill-climbing target: ask reviewers and hardening agents to aim for
  `<= 0.5`. This leaves margin and follows an underpromise, overdeliver policy.

A low score is valid only when the model built and booted a real app, the judge
actually exercised it, `graded=1`, `no_op=0`, and the failures describe product
behavior. A build crash, missing artifact, timeout, or global browser-gate
failure is not a model-breaking result.

## Domain selection

Prefer domains with coupled state and meaningful downstream consequences.
Our empirical heuristic is:

- Pure billing, finance arithmetic, and direct formula checks are often easy
  for frontier models.
- Payroll, civil/permit workflows, games, approvals, scheduling, and lifecycle
  systems are often more discriminating because one action affects several
  records or states.
- Do not manufacture difficulty with obscure trivia. Choose a domain where a
  real user would care about ordering, ownership, reversals, replay, terminal
  states, or stale writes.

Treat this as a selection heuristic, not a guarantee. Measure with a valid run.

## The Ripple Effect

Do not spend most reward on a direct calculation or first-order result. Test
the secondary and tertiary effects of a user action.

```text
action A -> immediate state B -> dependent state C -> persisted/reloaded state
```

A strong verifier performs A and checks the exact expected B and C. When the
contract promises durability, it then reloads or reauthenticates and checks the
same state again.

Connect Four example:

1. Play the exact move that wins a round.
2. Verify the board and winning cells, not only the winner text.
3. Verify score and match history changed exactly once.
4. Undo the winning move and verify play reopens, the winning treatment clears,
   the score reverses, and the matching history entry is removed.
5. Redo and verify the same result returns exactly once after reload.

The arithmetic is easy. Keeping the board, turn, score, history, undo stack,
and persisted state consistent is the model-breaking part.

## Reusable lifecycle roles

Keep these roles separate. Combining them into one giant prompt makes it easy
to lose the task contract or package an unvalidated revision.

### 1. Idea and model-breaker role

Input: domain idea, current task, sample reference, current score, target score,
whether an Oracle run is allowed, and whether a ZIP is required.

Responsibilities:

- Identify answer-key leaks, appearance-only checks, and cheap reward weight.
- Find state transitions with useful Ripple Effects.
- Preserve a fairness anchor for every invariant being tested.
- Deepen existing criteria before adding many sibling criteria.
- Predict which high-value criteria should distinguish a shallow solution.

Suggested invocation:

```text
Apply the model-breaking workflow to <task path>.
Current valid frontier score: <score>.
Internal target: <= 0.5; formal keeper band: 0.1-0.7.
Oracle runs allowed: <yes/no>. Repackage when done: <yes/no>.
Do not change harness contracts or remove fairness anchors.
```

### 2. Restructure and compliance role

Input: a raw or older task and one known-good current reference task.

Responsibilities:

- Convert structure and metadata to the latest Harbor and QC contract.
- Preserve behavior and domain constants while relocating content.
- Keep the visible instruction natural and short; split details only according
  to the current admin rule.
- Build the requirement-to-criterion coverage map.
- Validate package naming, single ZIP wrapper, images, seeds, prompts, and
  reward wiring before paid runs.

Suggested invocation:

```text
Restructure <task path> to the current repository contract using <reference>
for shape only. Preserve domain behavior and constants. Report every semantic
change separately from structural changes. Run static and upload checks.
```

### 3. Builder and Oracle role

Build the complete golden solution first. The reference is executable proof of
what the instruction and verifiers mean, not a mockup.

An effective working pattern is to build the app in one assistant/session and
grade or audit it in another, such as building with ChatGPT/Codex and reviewing
with Cursor/Claude. The value is independent context and less confirmation
bias, not the specific brand of tool.

- Exercise the golden through `solution/solve.sh` and the same staging path the
  Oracle uses.
- Run every verifier path against the golden.
- If a hero verifier fails, decide whether the golden is wrong, the verifier is
  nondeterministic, or the requirement is not derivable. Never assume the model
  is at fault.
- The Oracle must satisfy the current aggregate threshold and every Functional
  criterion required by the current contract.

### 4. Frontier grading role

Run the target model only after static QC and a valid Oracle. Read criterion
reasoning, not just the aggregate number.

- Confirm the app built and rendered.
- Separate genuine product failures from judge mistakes and harness failures.
- Reproduce surprising hero failures against the model app.
- Treat false positives and false negatives as verifier bugs to fix.
- Re-run only after a material task, golden, seed, or rubric change.

### 5. Delivery role

Run only after the task is frozen and the required Oracle/frontier evidence is
valid.

- Read rewards from each job's own authoritative reward output. Never type a
  remembered score into a report.
- Package the exact current admin deliverable set. `delivery-v3.md` describes a
  seven-file set, but newer tracker requirements override it if they request
  additional model-run evidence.
- Sanitize job exports and scan every ZIP, workbook, document, and log for API
  keys, bearer tokens, private paths, databases, caches, and `codex-home`.
- A packaging-only change does not require a new model run. Any material task,
  seed, golden, or verifier change does.

## Hardening the brief fairly

The brief should describe a real product problem, not reveal the verifier.

- Remove sentences that say how or where a behavior will be tested.
- Prefer natural symptoms over an implementation recipe.
- Do not provide reproduction steps that hand the model the exact exploit.
- Do not delete facts needed to infer the expected behavior.
- Keep the minimum fairness anchor for every tested invariant.
- Natural language is not permission to be ambiguous. Exact values and domain
  boundaries must remain available when the judge expects exact values.

Maintain a fairness ledger while hardening:

| Invariant tested | Instruction/asset anchor | Criterion | Revert first? |
| --- | --- | --- | --- |
| What must always hold | Why a developer could infer it | Exact criterion ID | Rank |

If the frontier drops below the healthy band, restore missing anchors before
weakening the verifier.

## Deterministic verifier recipe

Each criterion should be independently executable and all-or-nothing:

1. State the exact starting user, workspace, record, or freshly created data.
2. Establish a positive control so an empty or refusal-only app cannot pass.
3. Perform exact visible actions or a narrowly justified same-origin replay.
4. Assert exact observable values, ordering, counts, and identities.
5. For a rejected write, re-read state and prove nothing changed.
6. For persistence, reload or reauthenticate and repeat the assertion.
7. Fail when a required interaction path cannot be executed; do not silently
   substitute another path.

For protected mutations, consider identity, role, ownership, invented IDs,
malformed values, omitted fields, ordering, replay, idempotency, stale state,
terminal transitions, and client-supplied derived values. Alter only the field
needed for the probe, using the request shape discovered from the normal UI.

Do not prescribe golden-only endpoints, selectors, payloads, or database
schemas. Judge outcomes. Keep Render and Constraints cheap and stable; put
most discriminating behavior in Functional, with interaction and visual quality
in Polish under the current four-category contract.

## Weighting and runtime

- Give smoke/discovery checks low weight.
- Give coupled enforcement and Ripple Effect checks meaningful weight.
- Avoid concentrating reward on easy arithmetic or cosmetic presence.
- Prefer adding a discriminating leg to an existing criterion over multiplying
  criteria and browser sessions.
- Keep every criterion fair and independently diagnosable even when it is
  conjunctive.
- When a criterion becomes heavier, preserve the timeout hierarchy:
  judge segment < RewardKit runner < Harbor verifier timeout.

Track the share of reward that requires real enforcement rather than rendered
appearance. A useful internal target is at least 75 percent, but do not game the
number by labeling a UI assertion as enforcement.

## Running efficiently

Safe default: one Harbor run per machine. Shared ports, container names,
databases, and memory can make parallel jobs contaminate or crash each other.

Observed optimization on one 8 GB machine: two Oracle runs sometimes work, as
does one frontier run plus one Oracle. Use that only after proving the jobs have
separate job directories, containers, ports, and data paths. Monitor memory and
Docker progress. If either run stalls, swaps heavily, loses its app, or produces
infrastructure errors, discard the result and return to one lane.

Parallelism saves time only when it preserves valid evidence.

## Run validity checklist

Before accepting any score, confirm:

- The run used the intended current task version and rubric digest.
- The target and judge identities match the current admin contract.
- The app artifact exists, boots, and passes the health/readiness gate.
- `graded=1`, `no_op=0`, with no errored trial.
- All expected dimensions and criteria were actually judged.
- Judge reasoning describes concrete UI/API observations.
- Reward post-processing used the declared gate and formula.
- Oracle and frontier used the same task and verifier revision.

Do not count rapid zeroes, missing reward files, global browser-gate failures,
provider credit errors, or agent-install failures as model scores.

## Cross-device restart checklist

On another Windows device:

```powershell
git clone https://github.com/Rayuga/model-beraking-prompts.git
cd model-beraking-prompts
git config core.longpaths true
git pull --ff-only origin main
git status -sb
```

Then:

1. Read this file and `TASK_AUTHORING_CONTEXT.md`.
2. Read the active task's `instruction.md`, mounted instructions/assets,
   `task.toml`, `tests/coverage.json`, and four judge prompts.
3. Read the latest valid Oracle/frontier `result.json`, reward output, and
   criterion reasoning. Do not work from a copied job's task source.
4. Confirm Docker and Harbor versions before running.
5. Enter provider keys only through a local ignored env file or session
   environment. Never paste keys into tracked commands, context, or reports.
6. Check `git status` before editing and stage only the active task/context.

Record task version, source commit, last valid run names, scores, known false
positives, next action, and required re-runs in the task handoff before moving
devices again.

## Definition of done

- Current structure and upload checks pass with no open P0/P1.
- Every tested invariant has a fairness anchor and coverage mapping.
- Golden behavior is verified through the real Oracle staging path.
- Oracle is valid and every required Functional criterion passes.
- Frontier is valid, built a usable app, and lands in the accepted band.
- Hero failures are genuine, reproducible product failures.
- Reward emphasizes enforcement and Ripple Effects, not easy calculations.
- Task and run packages contain no secrets, caches, databases, or private paths.
- Delivery artifacts match the exact current tracker contract.
- Cross-device handoff records the commit, version, runs, scores, and next step.
