# DropLine Four Lite case study

## Product

DropLine Four Lite is an authenticated, server-backed Connect Four game. It
combines exact game rules with persistent per-user state, Undo/Redo branching,
completed-match replay, optimistic concurrency, idempotent mutations, keyboard
operation, and a responsive interface.

## Evaluation design

The task uses 22 scored browser criteria: two constraints, thirteen functional,
two render, and five polish criteria. Render and constraints are zero-weight
dimensions enforced as hard gates. Tests use visible browser interactions and
same-origin network evidence. The final golden artifact was evaluated without
changing state or verifier files during the run.

## Results

- Consolidated Oracle on version 6.0.3: 1.0000.
- Untouched GPT-5.4-mini artifact: 0.3642.
- Untouched Claude Haiku 4.5 artifact: 0.0000 after hard gates, with a raw
  functional score of 0.6842.
- Deterministic no-op: 0.0000.

The model passed core gravity, horizontal/vertical/diagonal wins, Undo/Redo
branching, reset persistence, duplicate-request protection, multi-tab conflict
handling, and cross-tab sign-out revocation. It failed Jordan seeded-data
loading, immediate archive synchronization, protected-state cleanup on sign
out, post-Redo focus retention, and related polish checks.

Haiku passed most gameplay and persistence checks but used a relative Express
static directory. Starting `/app/server.js` exactly as instructed therefore
failed to serve `/app/public/index.html`, causing the constraints and render
gates to fail. Its polish judge also timed out, but that was not the cause of
the already hard-gated zero.

## Quality controls

The final upload contains exactly 28 task files, uses LF text, preserves Unix
0755 modes for shell scripts, retains platform allowlisted networking, excludes
planning and QC material, and has no embedded API key. Frozen fixture and
golden-solution hashes are recorded in task metadata. The QC workbook audits
cleanly; remaining recommendations concern additional statistical rollouts,
server-restart persistence coverage, exact stack inspection, and base-image
pinning rather than a known platform blocker.

The formal RL scorecard records 52/58 (89.7%), with 23 Pass, 6 Partial, and no
Fail criteria. Its Conditional Accept verdict is driven by the unmeasured
eight-rollout distribution and three-repeat judge consistency gates.
