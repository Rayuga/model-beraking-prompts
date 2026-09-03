# Brickfall Breaker Arcade — Evaluation Report

## Evaluated package

- Task: `turing/brickfall-breaker-arcade`
- Version: `2.2.1`
- Task archive: `brickfall-breaker-arcade.zip`
- Task archive SHA-256: `9BEF39A6F1A02D1EC902CB09AAB1E8E15D822A9F44C7B5E93808376AF529F10F`
- Inventory: 31 files beneath one `brickfall-breaker-arcade/` wrapper
- Reward: zero when Render or Constraints fails; otherwise `0.6 * Functional + 0.4 * Polish`

## Verifier and coverage review

The package has exactly four categories: 2 Render, 2 Constraints, 16 Functional,
and 7 Polish criteria. `tests/coverage.json` defines 14 functional requirements;
all 14 map to live Functional criteria, for 100% Functional coverage. All 27
criterion IDs are unique, all four judges are pinned to Codex with
`openai/gpt-5.6-luna`, and the canonical verifier network is allowlisted to
`openrouter.ai`.

Formal post-run QC passed 29/29 executable assertions, all 19 active upload
rules, and four voluntarily satisfied optional rules; the other three disabled
rules are not applicable. This covers both Docker images, shell/Node/JSON/TOML
syntax, frozen hashes, exact seed-copy equality, no-op scoring, reward
post-processing, task inventory, and archive structure. No generated database,
dependency tree, log, cache, or literal API key is present in the task archive.

## Scored runs

| Run | Reward | Render | Constraints | Functional | Polish | Functional passes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Oracle | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 16/16 |
| GPT-5.4-mini, high | 0.2182 | 1.0000 | 1.0000 | 0.0000 | 0.5455 | 0/16 |
| Claude Haiku 4.5, high | 0.0000* | 0.0000 | 0.0000 | 0.0000 | 0.0000 | n/a |
| No-op probe | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | n/a |

The Oracle exceeds 0.95 and passes every Functional criterion. GPT-5.4-mini is
inside the required 0.1–0.7 band. Its implementation rendered a coherent shell,
but its signed-out bootstrap created the login form without attaching the submit
handler. Submitting therefore performed a GET navigation rather than the required
same-origin sign-in request, leaving every authenticated Functional workflow
inaccessible. The Oracle result demonstrates that this is a model-artifact
failure rather than an impossible criterion or broken golden path.

The corrected Haiku run made genuine model calls (8,076,748 input tokens and
118,863 output tokens) and completed without a trial exception. Harbor's verifier
nevertheless returned `graded=0`, `no_op=1`, and reward `0.0`; a replay confirmed
that the captured server boots, so this is retained as a completed zero run rather
than represented as a graded capability verdict. This follows the project rule
that Haiku only needs to run and may score zero. Earlier setup and zero-context
attempts remain diagnostic evidence only.

## Delivery evidence

- `gpt-run.zip` — SHA-256 `DFDA397DE6C02EEE076CF224C7070AD99BBA68852FF2A1D32364C8CB10915BC6`
- `oracle-run.zip` — SHA-256 `BEE530B16488BA1E6729C358B2DD65553C2B010832FF9DC85DF5F24A7CADAA4B`
- `haiku-run.zip` — SHA-256 `95D8AFAAB18D1168D02D373F78D344988EC267288190B10B4091D422B0F09C9F`; completed Haiku zero-run evidence with internal JWT secret excluded
- `Brickfall_Post_Run_QC.xlsx` — root scorecard plus upload, run, and findings sheets
- `brickfall-qc-findings.json` — machine-readable QC evidence and open measurements

The sanitized GPT archive contains 1,906 files including its complete artifact,
trajectory, and final v2.2.1 regrade; OpenHands' internal `.jwt_secret` was
excluded. The Oracle archive contains 17 files and its complete 27-criterion
result. Neither archive contains a literal OpenRouter key.

## Remaining evidence note

The strict 30-row scorecard has 23 passing rows, one partial row, and six open
measurement rows. The open rows require two adversarial scores at or below 0.2,
four distinct rewards, at least eight runs for standard deviation, one identical
rollout rescored three times, and dedicated keyword-stuffing/refusal probes.
Injection protection is present in the prompts but remains partial until tested
with an injected artifact. These are additional robustness measurements, not
source or golden-solution defects. Sonnet 4.5 also remains absent if the strict
multi-model delivery checklist is enforced. Report generation does not require
GPT-5.4-mini or Oracle to be rerun.
