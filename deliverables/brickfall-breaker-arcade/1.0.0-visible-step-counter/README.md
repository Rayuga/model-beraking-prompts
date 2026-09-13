# Brickfall: visible simulation-step counter contract

Task remains `brickfall-breaker-arcade`, version `1.0.0`. Upload only the ZIP
in this folder; previous archives and reports remain unchanged.

## Fix for the supplied platform rubric finding

The platform reported 45/45 static checks and 52/53 rubric checks on the preceding
package. It correctly identified that exact drill-step counts were graded even
though the instructions never explicitly required an observable counter.

`environment/assets/instructions/checkpoints.md` now requires a visible cumulative
simulation-step counter in lab telemetry. It begins at zero when a drill loads,
counts actual engine steps (including an early terminal step), accumulates across
Advance actions, freezes while paused and resets on the next drill load. Any clear
label is allowed; neither an animation-frame count nor elapsed time is a substitute.

The Functional shared prompt now reads that instructed visible counter rather
than treating an optional captured simulation result as sufficient. It explicitly
does not impose an extra ranked-play counter display. The prompt marker advances
to r2; the other four remain r1. The task's top-level instruction.md already points
to the eight `/instructions` files, so no duplicated rule was added there.

Exactly two task files changed. All 37 criterion definitions, weights, types,
expected values, golden source, task.toml, both Dockerfiles, runner and reward
configuration are unchanged. The prior mobile-overlay fix is included. Public
networking and the native Codex/gpt-5.6-luna/max configuration remain intact.

## Fresh local validation

Authoritative evidence is `attempt-1/`, not the preceding release's results.
The new focused browser test reads the actual visible lab telemetry and checks:

- Brick types: zero on load, then 120 steps.
- Power relay: 120, frozen during a real pause, then 240.
- Last ball: exactly one step before the life-lost stop.
- Sticky catch: 120 then 240 for the expiry checkpoint.
- All seven drill loads reset to zero and leave the ranked baseline unchanged.

The existing 36 browser groups were also rerun, making 41 groups in total.
They include auth gates, mechanics, terminal outcomes, receipts, two-tab conflict
handling, profile isolation, mobile touch, reduced motion and the overlay fix.
The runtime harness additionally tests syntax, no-op zero handling, new prompt
hashes, scheduling order, five-dimension CTRF, 135 reward calculations, 40 invalid
score cases, and a real process restart with every database table preserved.
The 116 local standard checks and archive/source integrity assertions are recorded
in standard-checks.json and package-audit.json. The latter includes the ZIP SHA-256.

## Limits

No paid Oracle/model run or full platform semantic QC was launched. Browser tests
use cached `brickfall-preflight-verifier:2.0.4` tooling with current source mounted
read-only in disposable offline containers. Exact Docker builds were not repeated
because neither Dockerfile changed; prior proxy/download build failures remain
unresolved. Packaged networking is public in both environments.

The local judge stub tests plumbing and arithmetic, not natural-language grading.
41 diagnostic groups are not an assertion that the LLM passed all 37 criteria.
The preceding release's QC_REVIEW.md documents remaining policy/coverage risks;
they were not silently redesigned in this two-file correction. Fresh platform
QC and Oracle are still required; no Oracle 1.0 guarantee is made.
