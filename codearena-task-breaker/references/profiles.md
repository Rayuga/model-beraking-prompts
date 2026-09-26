# Profiles

The three shapes this skill can be pointed at, what each one's contract is, and
which of the breaker's levers apply. Detect first — `scripts/audit_task_source.py`
reports `profile` and applies the right checks.

## Detection

| Shape | Marker | `profile` |
|---|---|---|
| Staged (global webdev template) | `tests/scoring.toml` and `tests/gates/` + `tests/scored/` | `staged` |
| Dimensions (CodeArena finalized, or the retired layout) | `tests/reward.toml` and `tests/<dimension>/judge.toml` | `dimensions` |
| Anything else | neither marker present | `unknown` — report it, do not guess |

Inside `dimensions`, treat a task as the **finalized CodeArena profile** when it
ships `tests/coverage.json` *and* has no `visual` dimension. A task with a
visual dimension belongs to the **retired** family: it declares its own judge
and model, and temperature and prompt-version stamps are not required of it.

## Facts per profile

| Fact | `staged` | `dimensions` |
|---|---|---|
| Dimension directories | `tests/gates/{render,constraints}`, `tests/scored/{functional,polish,visual}` | `tests/<dimension>/` |
| Reward policy | `tests/scoring.toml`: `[gates] render/constraints = 0.0`, `[weights] functional 0.6 / polish 0.2 / visual 0.2`, `[floors] functional 0.05` | `tests/reward.toml` `weights`/`[[reward]]`, or the arithmetic in `test.sh` / a `tests/*.py` helper |
| Suites | `test.sh` runs `run_suite gates <budget>` then `run_suite scored <budget>`, with `tests/tools/score.py` after each | one RewardKit run over `/tests` |
| Grading tool | `tests/tools/score.py` (policy in `scoring.toml`), `tests/tools/restart_mcp.py` for the persistence criterion | the task's own finalizer or inline arithmetic |
| Judge wiring | frozen `[verifier.env]`: `claude-code`, `z-ai/glm-5.3-flashx`, `ANTHROPIC_BASE_URL=https://openrouter.ai/api`, `ANTHROPIC_AUTH_TOKEN=${OPENROUTER_API_KEY}`, empty `ANTHROPIC_API_KEY` | task's own `[verifier.env]`; each `[judge]` may restate `judge`, must not contradict it |
| Prohibited in `[judge]` | `model`, `reasoning_effort`, `temperature`, `weight` | none of these are prohibited; the task's own contract governs |
| Prompts | `prompt.md` per dimension with `{app_context}` and `{criteria}`; scored prompts restate the in-dimension gate | `prompt.md` per dimension; gate language where the task declares it |
| Restart evidence | the judge calls the `restart_app` MCP tool; never a shell helper | whichever the task's own prompt names |
| Instruction contract | `instruction.md` plus rich notes under `environment/instructions/`, no line limit | `instruction.md` at most 20 lines with the contract split across at most six files |
| Seed | `environment/assets/seed_data.json` | `environment/assets/artifacts/` |
| Coverage map | none — the WebDev Rubrics QC workbook is the map | `tests/coverage.json`, >80% of requirements mapped to functional |
| Verifier image | `environment_mode = "separate"`, `[verifier.environment] network_mode = "public"`, no Docker labels required | separate verifier, pinned image labels where the task declares a `docker_image` |
| Delivery ZIP | `<task-slug>.zip`, no version suffix | `<task-slug>-<version>.zip` |

## Levers that differ

- **Enforcement share.** The 80% target is the finalized CodeArena measurement
  (`Σ weight(criteria ≥ 3.0) / Σ weight`). In `staged`, weights are graded
  rather than split surface/adversarial, so the same number measures something
  else: the share of weight sitting on criteria whose own text carries a
  refusal, forged replay or unchanged re-read. A share near half is normal
  there because eighteen of the functional criteria read the seeded desk. It is
  reported as a note, and a breaker pass raises it by folding a probe into an
  existing heavy criterion.
- **Timeouts.** `staged` nests three levels: every judge timeout < its suite
  budget, and `gates + scored` budgets < `[verifier].timeout_sec`. Raising a
  judge timeout is only legal while that still holds.
- **Weights.** Weight changes in `staged` must keep the dimension total, or
  every count quoted in `task.toml` goes stale in the same edit.
- **`harden_criteria.py`.** On `dimensions` it rewrites weights to
  0.5/3.0, raises the functional timeout floor and sets reasoning effort. On
  `staged` it touches none of those by default — writing a model,
  temperature, reasoning-effort or `[judge].weight` key into a staged
  `judge.toml` is itself a defect.

## Reference material

- `dimensions`: `$codearena-task-builder` (`task-contract.md`,
  `verifier-contract.md`, `upload-rules.md`) and `$codearena-task-qc`
  (`codearena-qc.md`, `platform-profile.md`).
- `staged`: `$harbor-webdev-task-builder` and `$harbor-webdev-rubric-qc`
  (`staged-task-contract.md`, `quality-checks.md`, `deterministic-checks.md`).
