# DropLine Four Lite case study

## Product

DropLine Four Lite is an authenticated, server-backed Connect Four game. It
combines exact game rules with persistent per-account state, Undo/Redo
branching, completed-match replay, optimistic concurrency, idempotent
mutations, cross-tab session revocation, keyboard operation, and a responsive
interface.

## Evaluation design

The task has 22 scored browser criteria: two Render, two Constraints, thirteen
Functional, and five Polish. Render and Constraints are hard gates. If either
fails, reward is zero; otherwise reward is `0.6 * Functional + 0.4 * Polish`.
All runs use visible browser interactions and same-origin network evidence.

Version 6.0.3 uses public task and verifier networking, longer judge windows
for the dense browser suites, and one matching top-level ZIP folder. Oracle,
GPT-5.4-mini, and Haiku all ran against the identical task checksum
`c7400c4c34da652f7e4d050c40a063e4aa4fd4ffeacd3b6aa4ecd092d10aa528`.

## Results

- Oracle: 1.0000. All 22 criteria passed and all 13 Functional criteria passed.
- GPT-5.4-mini: 0.5390. Render and Constraints passed, Functional was 0.6316,
  and Polish was 0.4. The agent finished normally with no exception or no-op.
- Claude Haiku 4.5: 0.3327. Render and Constraints passed, Functional was
  0.4211, and Polish was 0.2. All criteria returned populated reasoning.
- Deterministic no-op: 0.0000.

GPT implemented most game rules and state workflows. Its main misses were
immediate archive reversal after Undo, visible full-column feedback, exact
idempotent/stale multi-tab response behavior, cross-tab sign-out navigation,
and some replay/feedback polish. These are concrete application failures, not
judge failures, and place the primary model inside the required 0.1–0.7 band.

Haiku passed both hard gates and a broad set of gameplay checks. It missed
parts of seeded Undo state, immediate archive synchronization, keyboard focus,
rapid duplicate handling, replay semantics, mobile column-label clarity, and
score presentation. After producing its graded artifact, Haiku executed
`pkill -f "node /app/server.js"`. Because the task prompt itself contains that
text, the pattern also matched OpenHands and caused exit 143. This model-caused
exception is preserved transparently; it did not prevent the complete verifier
from returning all 22 reasoned criterion results.

## Quality controls

The task ZIP contains exactly 28 files beneath `dropline-four-lite/`, excludes
authoring and runtime artifacts, contains no API key, and has forward-slash ZIP
entries. Both `task.toml` network modes are public. All 26 documented upload
checks and all 9 run-evidence checks pass. The golden solution scored 1.0, GPT
is in band, all three runs share the exact v6.0.3 checksum, and no accepted
verifier result contains a judge-timeout warning or empty reasoning.

Source-decidable QC is 18/19. The packaged `solution/app/server.js` contains
mixed LF/CRLF line endings; its raw byte hash does not match the LF-normalized
hash recorded in task metadata. This does not change executed behavior or run
scores, but it prevents a clean byte-exact baseline claim. The scored package
was not silently changed after the runs.

The Windows-built ZIP records both shell scripts as mode `0666`. This caused no
observed failure: the verifier Dockerfile applies `chmod +x` to `test.sh`, and
the Oracle and model runs all executed the exact archive successfully.

Resolve the baseline-hash issue before claiming fully clean QC. Other
follow-ups are deterministic server-restart persistence coverage, mechanical
stack inspection, optional base-image digest pinning, and additional
rollout/regrade samples if the statistical scorecard gates are enforced.
