# Case Study — Brickfall Breaker Arcade (Full-Stack Canvas Game)

**Scores:** Oracle (reference) 100% · GPT-5.4 Mini 21.82% · Claude Haiku 4.5 0%

## 1. What the task is

Brickfall Breaker Arcade is a full-stack browser brick-breaker that combines a vanilla canvas game with a Node.js, Express, and SQLite backend. The task requires deterministic fixed-step physics, ten seeded walls, exact scoring and power-up rules, resumable runs, personal history, a global leaderboard, secure bearer-token authentication, optimistic concurrency, and idempotent persistence.

Three seeded players—Mira, Dev, and Polly—have different saved progress, checkpoints, and histories. Ranked play and a protected Mechanics Lab must use the same engine. The lab provides seven deterministic, non-scoring drills so collision handling, combo scoring, power-up replacement, multiball, sticky release, extra lives, and final-wall completion can be verified without altering ranked state.

The browser verifier runs against the live application at `localhost:3000`. It signs in through visible controls, exercises the real canvas and server workflows, reloads saved state, opens concurrent sessions, replays genuine mutation requests, and checks that accepted and rejected operations produce the exact durable outcome.

### Core features asked for

- Same-origin Node/Express/SQLite application with a vanilla canvas client.
- Salted account credentials and unpredictable SQLite-backed 64-hex bearer sessions.
- Account-wide sign-out and strict isolation of saves, progress, leaderboard data, and history.
- Ten exact seeded walls with normal, strong, and solid bricks.
- Fixed 1/120-second simulation, bounded ball speeds, face/corner collisions, anti-tunnelling, and at-most-once brick damage per step.
- Keyboard, pointer, and touch play with launch, pause, restart, steering, and Assist mode.
- Exact combo scoring, deterministic drops, and mutually exclusive wide, slow, multiball, and sticky effects.
- Complete frozen checkpoints containing damaged bricks, paddle, balls, drops, effects, and timers.
- Monotonic revisions, two-tab conflict recovery, operation receipts, terminal tombstones, and finish deduplication.
- Latest-ten personal history, inspectable snapshots, progression, final-wall completion, and exact leaderboard ordering.
- Responsive canvas and HUD, accessible state summaries, non-color cues, touch targets, visible feedback, and reduced-motion behavior.

## 2. What we actually verify

The suite contains 27 criteria: 2 Render, 2 Constraints, 16 Functional, and 7 Polish. Render and Constraints are hard entry gates. If either gate fails, the final reward is zero; otherwise reward is calculated as `0.6 × Functional + 0.4 × Polish`.

| Area | How it is graded |
| --- | --- |
| Render | Two browser smoke checks confirm page loading, refresh, field input, and basic control response. |
| Constraints | Two checks require a working same-origin application shell and a self-contained runtime that survives reload. |
| Functional | Sixteen weighted end-to-end criteria cover authentication, fixtures, checkpoints, terminal history, all walls, controls, deterministic mechanics, concurrency, idempotency, revocation, and account isolation. |
| Polish | Seven browser-visible criteria cover sign-in quality, mobile fit, hierarchy, semantic state, multimodal controls, canvas readability, product coherence, and reduced motion. |

The heaviest criterion is the two-tab revision, receipt, and duplicate-guard chain at weight 3.0. Most authentication, progression, physics, power-up, checkpoint, and security chains weigh 2.0. Because authenticated gameplay is foundational, a broken sign-in boundary prevents nearly every Functional criterion from being reached.

## 3. Where each model landed

### 🥇 Oracle (reference) — 100% (27 / 27)

The Oracle passed every Render, Constraints, Functional, and Polish criterion. It completed all 16 Functional chains, confirming that the task instructions, workbook and scenario fixtures, golden implementation, and verifier are mutually executable.

The reference application authenticated all seeded users, restored complete checkpoints, drove all ten walls and seven Mechanics Lab drills, calculated exact collisions and scores, enforced power-up and life rules, persisted terminal history, reconciled concurrent revisions, replayed idempotent receipts, revoked sessions account-wide, and kept player data isolated. It also met the responsive, accessible, canvas-readability, feedback, and reduced-motion requirements.

### 🥈 GPT-5.4 Mini — 21.82% (6 / 27 criteria passed)

**Succeeded at:** both Render checks, both Constraints checks, responsive shell/touch targets, and visual shell hierarchy.

GPT produced a substantive, coherent arcade shell that loaded from the same origin and survived a full refresh. Its public and game surfaces fit the 375×760 viewport, and its high-contrast desktop/mobile presentation had clear visual hierarchy.

It failed all 16 Functional criteria because of one lifecycle integration defect: the initial signed-out bootstrap rendered the sign-in form and then returned before binding its submit handler. Activating Sign in therefore caused a normal `GET` navigation instead of calling the authentication endpoint. No bearer token was issued, no authenticated identity was established, and every protected workflow remained unreachable.

Consequences included:

- Seeded users could not enter their game workspaces.
- The initial leaderboard, level manifest, constants, checkpoints, and personal histories could not be verified.
- Ranked play, pause/save/restore, Assist, manual takeover, and fresh wall selection were inaccessible.
- None of the seven deterministic mechanics drills could run.
- Terminal completion, progression, snapshot inspection, and latest-ten history could not be exercised.
- Two-tab revisions, idempotent receipts, duplicate guards, account-wide revocation, and player isolation could not be tested.
- Sign-in feedback and protected semantic game state were absent even though the shell itself looked complete.

This is a genuine integration failure rather than a server-startup problem. The route and client code could appear plausible in source, but the user-visible browser flow never connected them.

### 🥉 Claude Haiku 4.5 — 0% (3 / 27 criteria passed; gated final score)

**Succeeded at:** both Render checks and visual shell hierarchy.

Haiku rendered an attractive, substantive sign-in screen before and after refresh, and basic field/control interaction kept the page responsive. However, the application referenced `/game.js` without including that file. The server returned HTML for the request, causing `Unexpected token '<'`; `handleSignIn` was consequently undefined.

Both Constraints gates failed because the required same-origin runtime was incomplete. Sign-in raised a reference error without issuing an authentication request, so all 16 Functional criteria and six of seven Polish criteria failed. The game canvas, leaderboard, checkpoints, controls, Mechanics Lab, histories, telemetry, and protected responsive surface were unreachable.

The final 0% is a genuine gated model result. The completed model artifact was regraded with `graded=1` and `no_op=0`; it should not be confused with the earlier infrastructure handoff that incorrectly returned an ungraded no-op.

## 4. The largest failure cluster

The largest failure cluster is **authentication-to-game bootstrap integration**. Both model artifacts rendered convincing public shells, but neither established the authenticated state required to reach the actual product.

- **GPT-5.4 Mini:** the script existed, but the signed-out bootstrap returned before registering the sign-in handler. It passed both gates and two Polish checks, earning 0.2182, but failed all Functional criteria.
- **Claude Haiku 4.5:** the referenced game script was absent, so the browser could not define the sign-in handler. The incomplete runtime failed the Constraints gate and reduced the final reward to 0.0000.
- **Oracle:** passed all 27 criteria and demonstrated the complete authenticated gameplay, persistence, concurrency, and presentation contract.

The dependency is severe: one public-to-protected transition unlocks the leaderboard, player checkpoints, level data, ranked engine, Mechanics Lab, histories, concurrency probes, and security checks. When that boundary fails, downstream feature presence cannot be credited through source inspection alone.

## 5. What this tells us

- Authentication must be tested as a complete browser journey. A form, endpoint, and handler are insufficient unless the loaded page actually binds and invokes them.
- Easy Render and Constraints checks distinguish a usable shell from an empty or crashed submission. GPT received meaningful partial credit instead of an artificial zero.
- Hard gates still correctly penalize incomplete runtimes. Haiku rendered HTML, but its missing required script meant the application was not self-contained.
- Deterministic checkpoints make real-time game mechanics objectively testable without adding fake controls that bypass the production engine.
- Protected feature chains should be reached through visible product controls before request replays or concurrency probes are attempted.
- Complex persistence requires whole-snapshot verification. Bricks, balls, paddle, drops, effects, timers, scores, lives, level, and revision must restore together.
- Idempotency and concurrency need connected checks: exact replay, changed-payload reuse, stale revision, two-tab recovery, terminal deduplication, and durable receipts.
- Infrastructure failures must be separated from model failures. A zero-token or ungraded no-op does not describe implementation quality; the preserved artifact must be graded successfully before interpretation.
- Each model result represents one rollout and is descriptive rather than a stable population estimate.

## Evaluation note

Task version: v2.2.1. The Oracle passed 27/27 criteria. GPT's untouched rollout passed both gates and completed as a graded run. Haiku's final reported result comes from regrading the exact captured artifact after its first verifier handoff returned an invalid ungraded no-op; the regrade used the unchanged criteria and produced a valid gated zero.
