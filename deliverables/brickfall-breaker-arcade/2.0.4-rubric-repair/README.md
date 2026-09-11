# Brickfall 2.0.4 - reported rubric repairs

Upload only `brickfall-breaker-arcade.zip` from this folder. It has one
`brickfall-breaker-arcade/` wrapper containing the same 30 allowlisted task
files. Historical releases and the v0 project are unchanged. PatchPad was not
edited during this Brickfall repair.

SHA-256: `0b58147e8b868a8c069fd52337e4c5de87e42a34056e0ce45ed625b792ca1cb5`.

## Reported findings and dispositions

These are local source repairs, not a claim of eight platform QC passes.
The screenshot's eight categories overlap across fewer underlying defects.

| Reported category | Repair and evidence |
| --- | --- |
| Achievable and unambiguous | overview.md states empty/absent drop serializes as empty string, preserving the trailing colon. physics.md explicitly preserves the paused drill's 1000-speed ball, with cap enforced by the end of its first fixed step. Independent workbook hashes match all ten required digests; real-browser loading/Advance matches 1000/520 and score 1400. The precise first-step instant was source-inspected, not separately browser-timed. |
| Timeouts fit the work | Agent 3600 -> 7200 seconds; Functional 2400 -> 6500; Polish 900 -> 2400; wrapper 6300 -> 11400; verifier 7200 -> 12600. Explicit build allowance 1800. Gate budgets remain 480 each. Judge sum 9860 leaves 1540 seconds in the wrapper, with additional outer startup/cleanup headroom. Build + agent + verifier totals 21600 seconds. |
| No unrequired grading | Empty-drop convention is now agent-visible rather than only an implementation choice. Existing R-after-refresh check is explicitly documented for the reloaded menu after a terminal run. |
| Independent/noncontradictory criteria | Terminal finish/records, receipt replay, refresh durability and R restart are separate scores; Multiball, Sticky and Last ball are separate; Extra life and Final wall are separate. Each original bundle retains its total weight. Later stability checks compare their actual baseline rather than automatically inheriting an earlier exact-outcome miss. |
| Outcome-based/browser-decidable | Five craft axes now have explicit low/mid/high anchors plus intermediate ratings; concrete semantic and input checks remain binary. HUD explicitly names score, lives, level, combo, active power-up and timer. Values need not occupy a prescribed single DOM panel. |
| Self-consistent descriptions | Removed the mobile criterion's waiver for missing required surfaces. Missing canvas, controls or leaderboard cannot receive full marks. |
| Graded/discriminating reward | Independent subfeature scores preserve partial functional success; five-point craft ratings provide a quality gradient instead of all-or-nothing aesthetic checks. |
| Binary/Likert fit | Five subjective quality criteria use `type = "likert"`, `points = 5`; the two objective Polish criteria remain binary. RewardKit 0.1.7 discovery and normalization were tested locally. |

## Scope and preservation

There are now 33 criteria: 2 Render, 2 Constraints, 22 Functional and 7 Polish.
Total Functional weight stays 31.5 and Polish stays 11. The three old bundle
weights remain 2 each. `package-audit.json` records the old-to-new criterion
mapping and verifies that all other Functional descriptions are identical.
The existing 60% Functional / 40% Polish aggregate is unchanged; gates carry
no final reward mass. This differs deliberately from the separate PatchPad
90/10 repair: this release addresses Brickfall's supplied rubric findings
without silently changing its aggregate. A future platform weight assessment
may still request a different split; no universal acceptance is claimed.

Golden server/client code, seed workbook/scenarios, runtime dependencies,
simple gate criteria, authentication/server-backing prerequisites and judge
tools remain unchanged. The Polish gate now uses valid lowest scores: 0 for
binary and 1 for five-point Likert, which normalizes to zero.

Both network modes remain public; verification is separate. Every dimension
uses Codex `openai/gpt-5.6-luna`, temperature 0; existing reasoning effort is
medium for Render/Constraints and high for Functional/Polish. The platform
OpenRouter key placeholder and baked tools are retained; test.sh contains no
provider-key setup/remapping. Release markers consistently say 2.0.4.

The older context contains historical versions and policy statements; the
actual current source and newest user instructions govern this release.
The human expert estimate remains 16 hours. The two-hour agent budget is a
configured automated-run allowance, not evidence that every valid build can
finish within it. New model run timing remains unmeasured.

## Fresh local validation

- `package-audit.json`: 174 local assertions, including TOML/JSON parse, LF/UTF-8,
  clean inventory, unchanged golden/seeds/dependencies, split weights, timeout
  hierarchy, prompt markers, independent digest derivation and ZIP/source equality.
- `build-results.json`: exact verifier image built successfully, including baked
  Codex/MCP/RewardKit and headless Chromium checks. Agent build stalled during
  Debian package downloads and hit the local 180-second diagnostic limit.
  A fresh agent build and secure HTTPS bootstrap are NOT established.
- Verifier image: `brickfall-preflight-verifier:2.0.4`, ID
  `sha256:19125bc806846441059b033915cabf7cbbaa1ca573feeb6c363f5173f752984a`.
  `image-check.json` compares all baked tests against current source hashes.
- `local-checks.json`: RewardKit discovers 2/2/22/7, including five actual Likert
  outputs. Server/client JavaScript and shell syntax, empty-submission zero,
  full runner using trusted dimension stubs, 100 actual aggregation cases and
  24 invalid-score rejections are tested. Injected 0.7 is NOT an Oracle score.
- `gate-regression.json`: four fresh-context browser prerequisites, wrong
  password, unauthenticated protected GET rejection and ranked-state nonmutation.
- `browser-regression.json`: twelve existing golden browser groups covering
  login/seeded leaderboard, frozen Mira checkpoint/reload, Polly's latest-ten
  history, all seven real-engine drills, start receipt replay/changed-payload
  rejection, saved-run reload, 375px layout and same-origin/error checks.
- `targeted.json`: eight new groups covering independently computed ten-level
  hashes, terminal finish/records, exact receipt retry, durable refresh, R
  restart, paused fast-ball fixture, Sticky manual/automatic release, and six
  semantic HUD values with all required mobile surfaces present.

The first local attempt failed because the new diagnostic selected every
button in the login form. That test-only selector was corrected to the exact
Enter arcade button; the golden was not changed. The initial log is retained
as `regression.log`, with subsequent rerun logs alongside it.

## Remaining limits and next step

No paid Oracle/model or official platform QC was launched. Local browser
checks are deterministic golden diagnostics, not the Codex judge executing
all 33 criteria. Subjective Likert ratings, complete independent multi-tab
security scenarios and a fresh agent bootstrap remain platform-run risks.
The current task changed instructions, criteria and timeouts, so previous
Oracle/model rewards do not validate this package or predict its new scores.
Run fresh platform QC and Oracle; Oracle 1.0 is not guaranteed.
