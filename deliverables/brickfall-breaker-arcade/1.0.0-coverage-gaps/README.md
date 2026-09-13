# Brickfall: three coverage gaps repaired

Prepared September 12, 2026. Task name `brickfall-breaker-arcade`, version `1.0.0`.
Upload only [brickfall-breaker-arcade.zip](brickfall-breaker-arcade.zip).

SHA-256: `e41998a64346e553627ab7ce9263c129c4dcaad66bec8c45aaff71ab887c8c1a`

## Why this release exists

The supplied v5 platform result passed 45/45 static checks and 52/53 authoring
rubric checks. The failing coverage row identified three genuine blind spots:
best score was never observed increasing, forged identity claims were never
probed, and completion was never demonstrated with a solid brick surviving.
The preceding visible-counter fix is retained; this is a different issue.

## Changes

Three independent binary Functional criteria, each weight 1.0, are appended:

1. `solid_bricks_do_not_block_completion`: load the Final wall fixture and
   require completion with zero breakable bricks while its solid remains intact.
   This does not rescore the bonus graded by the existing criterion.
2. `bearer_identity_overrides_client_claims`: use actual protected-read and Start
   requests with Polly's real token and Dev's supplied identity. Accept either
   strict rejection or ignoring those claims; require token-owned data/writes and
   Dev nonmutation. Use a fresh operation id/current revision so receipt or stale
   rejection cannot mask an identity vulnerability. No guessed opaque ids,
   invented endpoints, arbitrary snapshots or token substitution are allowed.
3. `terminal_score_increases_best`: finish Dev's actual higher-scoring ranked
   run and require best to rise to the observed terminal score and survive reload.
   This runs last, after checks that rely on his old best/checkpoint. Its terminal
   score is not hardcoded, so normal gameplay variation is accepted.

All previous 37 criterion definitions and weights are unchanged. There are now
40 criteria: 2 Render, 2 Constraints, 25 Functional, 5 Polish, 6 Visual. The final
60/20/20 split is unchanged. Adding weights necessarily changes each existing
Functional criterion's normalized share; no old numeric weight was reduced.

Final wall's supplied scenario now includes one intact solid away from the ball
path. Both scenario copies agree. The golden server adds that single fixture
brick; original completion/score logic and all client gameplay JavaScript are
unchanged. Final wall still completes at 15,100. The existing empty-drop, speed
cap, visible counter, mobile overlay and other fixes remain.

Functional prompt r3 states the added probes' narrow authorization and safe
ordering. task.toml changes only its explanatory metadata count/coverage text.
Networking, model, reasoning effort, Dockerfiles, runner, budgets and reward
formula are unchanged. Six task files changed, verified in package-audit.json.

## Fresh local evidence

Final-source evidence: `attempt-1/`.

- 119 local configuration/structural checks passed.
- 44 real-browser diagnostic groups passed: all previous 41 plus the three new
  coverage groups. `passed-browser-groups.json` lists the exact groups.
- Solid-brick positive witness: Final wall moves from one normal/one solid to
  completed, 15,100, zero breakables and one surviving solid; ranked state unchanged.
- Forged-identity witness: Polly read/write with Dev identity claims remain
  Polly-owned; Polly's accepted fresh Start increments once; Dev stays unchanged.
- Best-score witness: real normal gameplay finishes Dev at 24,575 versus his
  previous 6,200; the new best is visible and survives reload. Polly best unchanged.
- Existing syntax, no-op, provenance, five-dimension output, serial ordering,
  135 reward calculations, 40 malformed-score rejections and all-table process
  restart persistence passed again.
- ZIP has exactly one wrapper and 32 source-matching task files. CRC, member
  contents and every source hash are verified. Reports, diagnostics, databases,
  caches, credentials and node_modules are outside the task ZIP.

## Remaining limits

No paid Oracle/model or full platform semantic rubric run was performed. Tests
use current source mounted read-only in disposable offline containers with cached
`brickfall-preflight-verifier:2.0.4` tooling. Task networking remains public in
both environments. Dockerfiles did not change; exact image builds remain unverified
after earlier local proxy/download failures.

These are positive local browser witnesses, not executed platform LLM grades or
negative-control runs against every conceivable broken implementation. The new
identity test locally exercises the golden app's ignore-extra-claims branch;
the allowed strict-rejection branch and optional opaque-id branch were not
executed against another app. Best-score completion takes real gameplay time and
may vary; no timeout or Oracle 1.0 guarantee is made. Previously documented
presentation-floor/reference-normalization policy risks remain unchanged.

Next step: fresh platform QC, then Oracle/model runs. Historical archives/results
are preserved and must not be presented as this release's platform outcome.
