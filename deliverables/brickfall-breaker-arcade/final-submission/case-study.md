# Brickfall Breaker Arcade — Case Study

## Goal

Brickfall turns a browser brick-breaker into a difficult but objectively
verifiable full-stack task. The implementation must combine a vanilla canvas
game with Node.js, Express, SQLite, bearer-token authentication, durable account
state, exact seeded walls, deterministic mechanics, and revision-safe concurrent
writes.

## Difficulty design

The task avoids relying on subjective game feel alone. A workbook and scenario
manifest freeze ten level layouts, speed limits, accounts, leaderboards, saved
checkpoints, and seven mechanics drills. Those drills exercise the same engine
used by ranked play while keeping ranked state unchanged. Exact fixed-step
outcomes cover collisions, combo scoring, power-up replacement, multiball,
sticky release, life thresholds, and final-wall completion.

The server side adds interacting invariants that simple visual clones miss:
unpredictable SQLite-backed bearer tokens, account-wide revocation, complete
snapshot restoration, monotonic revisions, optimistic two-tab reconciliation,
idempotent success and 4xx receipts, terminal tombstones, latest-ten personal
history, and isolated account state.

## Verifier separation

Render contains only two smoke checks for loading, refreshing, and basic control
interaction. Constraints contains two hard-gate checks for same-origin delivery
and a self-contained reload. This keeps capable model submissions from receiving
zero for incidental product details.

Functional uses 16 weighted end-to-end criteria and covers all 14 functional
requirements. It starts with seed and authentication checks, then progresses
through checkpoint restoration, terminal behavior, every wall, controls,
mechanics drills, concurrency, idempotency, revocation, and account isolation.
Polish holds responsive layout, accessibility, interaction quality, canvas
readability, visual hierarchy, and reduced-motion behavior. No separate
Aesthetic category is used.

## Results and model failure mode

The Oracle scored 1.0 and passed all 27 criteria, including 16/16 Functional
criteria. GPT-5.4-mini scored 0.2182: both cheap gates passed and the shell earned
partial Polish credit, but Functional scored zero.

The main failure was a lifecycle integration bug rather than missing backend
intent. The model generated a sign-in endpoint and a client submit handler, but
the initial signed-out bootstrap returned after rendering the form and never
bound that handler. The browser consequently submitted with GET, issued no token,
and could not reach any protected workflow. The result illustrates why the task
tests behavior through the browser instead of rewarding the presence of plausible
routes, labels, or source-code keywords.

The Haiku attempts also exposed evaluation-infrastructure edge cases. Explicit
model token metadata fixed the initial zero-context loop, and the corrected run
made 8,076,748 input-token and 118,863 output-token calls without a trial
exception. Its first verifier handoff returned an ungraded no-op even though the
captured server booted during replay. Regrading that exact artifact produced a
valid zero (`graded=1`, `no_op=0`): the sign-in shell rendered, but Haiku omitted
the referenced `/game.js`, so `handleSignIn` was undefined and all authenticated
functionality remained unreachable. This separates the transient Harbor handoff
failure from the genuine model failure.

## Lessons

- Easy hard gates successfully distinguished a rendered product from a complete
  product: the model received partial credit instead of an artificial zero.
- Deterministic seeded checkpoints made complex real-time mechanics inspectable
  without accepting fake state controls in place of the real engine.
- Authentication must be exercised before dependent workflows; source presence
  alone cannot prove that the UI actually reaches protected state.
- Serialized verifier categories prevent independent browser judges from racing
  on the same SQLite baseline.
- Golden acceptance must require every Functional criterion, even when aggregate
  reward already exceeds 0.95.
- Packaging-only changes do not invalidate scored artifacts; contract, verifier,
  seed, or golden changes require a version bump and rerun.
- A zero with zero model tokens is an invalid rollout; run reports must separate
  agent infrastructure failures from genuine low model scores.
