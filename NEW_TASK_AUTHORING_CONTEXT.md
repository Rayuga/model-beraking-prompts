# New WebDev task authoring context

Reviewed against the supplied repository sources on **26 September 2026**. Start here, then follow [TASK_AUTHORING_WORKFLOW.md](TASK_AUTHORING_WORKFLOW.md). These documents describe the new **staged** task family. Historical releases remain in their existing folders; their configuration is not the starter for new work.

The objective is more **accepted, fair, reproducible tasks per authoring hour**. A low model score, a successful helper command, or an earlier accepted reference alone does not establish acceptance.

## 1. Sources and authority

| Source | What it establishes |
|---|---|
| Current task-specific user/lead instructions | Assigned scope, explicit exceptions, required runs, budget, and delivery destination. Preserve authorizations already given. |
| [Current template](projects/webdev-task-template/) and [staged contract](harbor-webdev-rubric-qc/references/staged-task-contract.md) | File layout, runtime, judge wiring, shared tools, scoring, and timeout baseline. |
| [WebDev Rubrics QC.xlsx](<WebDev Rubrics QC.xlsx>) | Authoritative quality and deterministic check inventory. |
| [Rubric QC skill](harbor-webdev-rubric-qc/SKILL.md), [quality procedures](harbor-webdev-rubric-qc/references/quality-checks.md), and [deterministic procedures](harbor-webdev-rubric-qc/references/deterministic-checks.md) | How to apply the workbook to this profile, known exceptions, evidence, and reporting. |
| [Onboarding guide](<WebDev Harbor Tasks - Onboarding Guide.docx>) | Its opening summary, section 3B, and sections 5–8 establish builder-model targets, claiming, and deliverables. Later technical sections contain older configuration. |
| [Acceptance criteria](<Webdev Task Acceptance Criteria for Trainers .docx>) | Confirms the score band and evidence pack; some configuration and operating targets conflict with the newer sources. |
| [Archived production guide](archive/NEW_TASK_DOS_AND_DONTS.md) and [older context](archive/TASK_AUTHORING_CONTEXT.md) | Previous outcomes and failure lessons. Use as historical evidence with their qualifications. |

The root workbook and the skill's [bundled workbook](harbor-webdev-rubric-qc/assets/WebDev_Rubrics_QC.xlsx) were compared: all four sheets have identical cell values. There are **53 quality checks** and **48 deterministic checkers** (35 WebDev and 13 common), regardless of formatting that extends a sheet beyond its populated rows.

Apply the current staged configuration to new tasks and the workbook's staged interpretation to QC. Record a genuine unresolved conflict with both sources; do not silently blend incompatible profiles. The administrative conflicts remaining below do not block authoring these documents or ordinary local preparation.

## 2. Builder model and grading model are different

| Role | Current supplied requirement | Where it is selected |
|---|---|---|
| App builder under evaluation | `gpt-5.6-luna` | Platform/model-run configuration; onboarding summary and section 3B. |
| Oracle | Deploys our reference app from `solution/` | Oracle run and `solution/solve.sh`. The finished app still goes through the verifier. |
| Grading model | `z-ai/glm-5.3-flashx` | `task.toml [verifier.env].REWARDKIT_MODEL`. |
| Judge runner | `claude-code` | `REWARDKIT_JUDGE` and the expected fallback in each `judge.toml`. |

GLM judging a Luna-built app is consistent. A runner named Claude Code does not mean the grading model is a Claude model. The verifier image also installs Codex and writes its `max` reasoning setting; that compatibility configuration does not change the active GLM judge selection.

The real stale conflict is the onboarding guide's later **verifier configuration** showing `codex + gpt-5.6-luna`. Use the current template, the guide's updated opening summary, and the staged QC skill for verifier wiring.

Current documented acceptance is **Oracle >= 0.95** and **Luna 0.1–0.7 inclusive**, preferably away from the boundaries. Our engineering goal is Oracle 1.0 with every required behavior implemented and every objective Functional check passing. The acceptance threshold is not permission to leave a known golden-solution defect. A stronger task-specific user requirement still applies.

An exact model reward of 0.4 is not a general requirement. Older GPT-5.4-mini, GPT-5.4, Gemini, and Haiku results do not establish Luna performance under the new judge. Record the builder and grading model separately in every evaluation.

## 3. Current staged file and runtime contract

Use the template's actual files. This is the required shape, with task-specific notes and app files inside their designated directories:

```text
<task-slug>/
  instruction.md
  task.toml
  environment/
    Dockerfile
    instructions/integration.md
    instructions/<task-notes>.md
    assets/seed_data.json
  solution/
    solve.sh
    app/server.js
    app/<other-app-files>
  tests/
    .dockerignore
    Dockerfile
    test.sh
    app_context.md
    scoring.toml
    gates/render/{judge.toml,prompt.md}
    gates/constraints/{judge.toml,prompt.md}
    scored/functional/{judge.toml,prompt.md}
    scored/polish/{judge.toml,prompt.md}
    scored/visual/{judge.toml,prompt.md}
    tools/score.py
    tools/restart_mcp.py
```

### Task identity and configuration

- Folder and ZIP use the same lowercase kebab-case slug; `task.name = "turing/<slug>"`. Three words are preferred, not mandatory.
- Current `schema_version = "1.4"` and `artifacts = ["/app", "/assets"]`. Keep the template key set and resource/network settings; fill task-specific description and metadata truthfully.
- The staged contract describes difficulty as `medium` or `hard` and metadata category as `programming`. Describe the assigned product domain accurately in its task-specific metadata; do not confuse the assignment's domain with the configuration schema.
- `task.version` is optional under the staged contract and absent in the starter. Do not automatically add or bump it. Keep external source/ZIP hashes for traceability.
- `environment.docker_image` and `allow_internet` are omitted. The verifier runs in a separate image; both phases use `network_mode = "public"`.
- Replace every actual `CHANGE_ME`/`change-me` placeholder. Required prompt placeholders `{app_context}` and `{criteria}` are intentional and must remain in source.

The frozen verifier environment is:

```toml
[verifier.env]
REWARDKIT_JUDGE = "claude-code"
REWARDKIT_MODEL = "z-ai/glm-5.3-flashx"
ANTHROPIC_BASE_URL = "https://openrouter.ai/api"
ANTHROPIC_AUTH_TOKEN = "${OPENROUTER_API_KEY}"
ANTHROPIC_API_KEY = ""
```

A variable reference is not a live secret. Keep real credentials out of shipped files, images, source control, and evidence exports.

### Application and environment

The [integration note](projects/webdev-task-template/environment/instructions/integration.md) specifies one Node 22 process using the supplied Express, better-sqlite3, and Node built-ins. The images currently provide Express `5.1.0` and better-sqlite3 `12.4.1` through `NODE_PATH`.

The app starts as `node /app/server.js`, listens on `0.0.0.0:3000`, and serves UI and API. Seed input is `/assets/seed_data.json`. SQLite defaults to `/app/app.db`, honors `DB_PATH` when supplied, and survives a process restart without duplicate seeding. `GET /api/health` must answer promptly. Include these facts in agent-readable instructions/notes; a natural brief can point to the integration note.

**External fonts, browser scripts, and CDN assets are permitted. An external backend or data service is not.** Do not reintroduce the older blanket offline or same-origin-asset gate. More restrictive requirements only apply when explicitly part of the current task.

The agent image carries instructions and seed, with an essentially empty git-initialized `/app`. It must not contain the golden app, rubric, tests, or judge tooling. `solution/solve.sh` copies `solution/app/.` into `/app`; the supplied reference installer does not install packages. Keep the supported runtime available in both images.

### Time budgets

The runner uses `--max-concurrent-agent 1`, so calculate **serial totals**, not just whether each individual judge fits.

| Budget | Seconds |
|---|---:|
| Agent | 7200 |
| Environment build | 600 |
| Render / Constraints judges | 600 each |
| Gates wrapper | 1500 |
| Functional / Polish / Visual judges | 9000 / 900 / 900 |
| Scored wrapper | 11100 |
| Whole verifier | 13200 |

The nominal arithmetic is `600 + 600 = 1200 < 1500`, `9000 + 900 + 900 = 10800 < 11100`, and `1500 + 11100 = 12600 < 13200`. Slack must also cover startup and orchestration. Long chains and tool retries can exhaust a valid-looking budget. Reduce unnecessary judge work before proposing changes to the common limits.

## 4. Scoring and weights

[scoring.toml](projects/webdev-task-template/tests/scoring.toml) is the only source of **dimension** weights. [score.py](projects/webdev-task-template/tests/tools/score.py) reads it after each suite.

- Render and Constraints use binary criteria with `all_pass`. Their policy thresholds are 0.0; a failed gate gives reward 0 and skips the scored suite.
- Functional, Polish, and Visual use `weighted_mean` within each dimension. Their final shares are 0.6, 0.2, and 0.2.
- The Functional floor is 0.05. A score **at or below** 0.05 gives final reward 0 even if the gates passed.
- Above the floor, final reward is `0.6F + 0.2P + 0.2V`, rounded by the supplied scorer to four decimal places.
- Individual `[[criterion]].weight` values express relative importance **inside** that dimension. They are neither the dimension's final share nor numbers whose average sets that share.
- `[judge].weight` is prohibited. Keep the expected `[judge].judge = "claude-code"`; prohibit `model`, `reasoning_effort`, `temperature`, and `weight` inside that table. Parse TOML tables when checking this—grep for every `weight =` would wrongly flag valid criterion weights.

Boundary examples were executed against the supplied scorer:

| Render / Constraints | F / P / V | Final reward |
|---|---|---:|
| 1 / 1 | 0.05 / 1 / 1 | 0.0000 |
| 1 / 1 | 0.06 / 1 / 1 | 0.4360 |
| 0 / 1 | 1 / 1 / 1 | 0.0000 |
| 1 / 1 | 1 / 1 / 1 | 1.0000 |

The 5% floor alone is not proof that shells score near zero. Work through a static mock, a seed viewer, an app that refuses everything, and a superficially polished partial app. Good scoring must reject the first three while giving useful partial credit to the fourth. Preserve the common formula; strengthen evidence and appropriate Functional criteria.

## 5. Verifier responsibilities

| Dimension | Scope |
|---|---|
| Render gate | Reachable, substantive app with no fatal rendering failure; the template checks protected-content/login basics when sign-in exists. |
| Constraints gate | A real locally served application with a backend, not a blank/static/broken shell. The current template explicitly excludes roles, persistence, and feature completeness from this gate. |
| Functional | Requested product workflows, server enforcement, data correctness, and durability. |
| Polish | Usability: containment/reachability, meaningful accessible controls, feedback, and coherent editing surfaces. |
| Visual | Rendered typography, colour/contrast, spacing/layout, hierarchy/scannability, overall craft, and responsive visual consistency. |

The starter has **six Visual criteria**, including responsiveness. Patchpad's earlier removal of responsiveness was task-specific and is not the new baseline. Polish's mobile reachability and Visual's responsive appearance must remain distinct observations.

Visual criteria use anchored Likert ratings (`points = 5` in the supplied files); objective behaviors use binary checks. Do not blindly convert craft to binary because older notes used that format. The Visual prompt's explicit 0–5 anchors versus RewardKit's generic 1–5 hint need an actual integration check before assuming normalization; see the preflight register below.

All prompts use Playwright, the localhost URL, untrusted-submission language, and `{app_context}` / `{criteria}`. Each scored prompt includes its browser prerequisite and scores other criteria independently after it passes. One normal criterion failure must not stop grading the rest.

[app_context.md](projects/webdev-task-template/tests/app_context.md) centralizes the app name, URL, usable accounts, and key screens. It must agree with the agent-facing notes and seed. Avoid copying account lists into every prompt.

The QC skill treats a usable identity/account surface as a house convention: sign-in is not automatically an unrequested feature merely because the main brief omits the word. Document usable accounts when applicable, and flag a criterion that depends on an identity surface the product does not actually provide.

Functional grading uses the app's observed UI/network requests. It must not guess endpoint names, read source as behavioral proof, run shell commands, or repair the submission. Only Functional declares the `verifier` MCP server. Its final persistence criterion calls `restart_app` **once**, waits for reported completion, and re-reads the same database. Reloading the page is not a server restart.

Criteria share state. Allocate records and order steps so one criterion does not consume another's setup; later dimensions must tolerate earlier legitimate mutations. Give each negative check a matching successful control and observable post-action evidence. A hidden button or a 4xx alone does not prove enforcement.

A coherent multi-step flow can be one binary criterion. Independence means avoiding duplicate observations, incompatible requirements, and unrelated failures chained together; it does not mean one click per criterion.

## 6. Lessons we keep from earlier tasks

| Earlier problem | Rule for new work |
|---|---|
| Gambit referenced asset paths missing from the uploaded environment | Verify every brief path, Docker `COPY`, artifact transfer, and the extracted ZIP itself. |
| Gambit could start from a different working directory at grade time | Match the real launch user, environment, CWD, paths, and restart procedure. Resolve hidden runtime assumptions centrally. |
| Patchpad demanded a particular save URL, scroll container, indentation width, or cursor-column convention | Grade the requested outcome. Require a specific implementation convention only when the brief explicitly needs it. |
| Card colours, empty-state explanation, or extra hidden deck fields were graded without a requirement | Compare both directions: requirement → criterion and criterion → requirement. |
| A brief required line numbers but no criterion actually checked them | Cover all requested deliverables, including visible requirements that the golden happens to implement. |
| A polished dead app earned substantial points | Check substantive interaction, positive controls, actual state changes, and the shell/floor cases. Keep Visual about appearance. |
| Conflicting 4/3/2 versus 60/20/20 configurations | Dimension policy lives in one place; criterion weights remain separate. Removing comments cannot fix live arithmetic. |
| Large serial budgets exceeded the wrapper | Sum all judges in each suite and leave orchestration slack. |
| Copied prompts named another product or described five-point ratings for binary checks | Read every final prompt against the actual app and criterion types. |
| A zero or missed checkpoint was treated as a successful model break | Identify provider/tool/harness faults, submitted-app faults, golden faults, and incomplete judge evidence separately. |
| A passing source folder produced a broken ZIP | Run validation on an extracted candidate and tie every run to that exact source/package. |
| Rerunning QC hid a real inconsistency | Fix the underlying mismatch; a stochastic pass does not refute a reproducible defect. |

Keep the brief human and clear. Remove grader vocabulary and exact test probes, while retaining every business fact needed to infer the expected behavior. Do not erase a requirement merely to lower a model score. Keep runtime details in a linked integration note rather than dropping them.

Earlier user preferences such as comment removal remain relevant when applied to a delivery: remove ordinary code/config comments safely, preserve shebangs, meaningful Markdown, literal data, and shared-tool behavior. The new QC sources do not make every comment a defect. Likewise they do not require old prompt-version markers, `APP_MANIFEST.md`, `reward.toml`, or a 20-line instruction cap.

### Choosing tasks and using successful references

User-identified passed references include [BazaarBridge](projects/bazaarbridge-marketplace-commerce/), [Docketlight](projects/docketlight-claims-insurance/), [TorqueBay](projects/torquebay-repair-operations/), and [Boardloom](projects/boardloom-infinite-canvas/). Use their domain mechanics and evidence design: reserve/cancel inventory, retry a payment without duplication, enforce scheduling/qualification rules, or keep canvas relationships stable after movement and reload. Their old configuration is not the new contract.

The [25 September production review](archive/NEW_TASK_DOS_AND_DONTS.md) records prior Oracle/model scores with caveats, including reused Oracle exports and deductions based on incomplete observations. Those are historical measurements under earlier configurations, not predictions for Luna graded by GLM or independently verified new-profile acceptance.

A practical starting hypothesis is one coherent product, 2–3 connected workflows, roughly 3–5 key screens, and perhaps 15–25 focused Functional criteria. These are planning estimates, not QC rules or a proven optimum. Choose scope from the assigned brief and judge effort. Form/table workflows may be cheaper to build and grade than complex editors/games; that is a planning judgment, not evidence of a higher acceptance rate.

Reuse validated infrastructure and components, but author distinct domain behavior. Do not make nouns-swapped clones. Track authoring hours, iteration count, verifier time/cost, all model attempts, and final acceptance; optimize from those measurements.

For stronger reference evidence, collect the exact accepted task ZIP plus matching platform QC, Oracle/Luna exports, and judge configuration under this staged profile. Include some rejected/revised examples and authoring/run costs when available. More task ZIPs without matching outcomes cannot establish which designs succeed most reliably.

## 7. Skills and helper limitations

The two supplied skills are repo-local files. Read their `SKILL.md` files directly; extraction into this repository does not prove they are registered as globally available skill commands.

| Skill | Use |
|---|---|
| [harbor-webdev-rubric-qc](harbor-webdev-rubric-qc/SKILL.md) | Source review and final QA for staged tasks. Review-only by default; edit task files when the user requested a fix pass. Apply all 48 deterministic checks and 53 quality judgments with evidence. |
| [codearena-task-breaker](codearena-task-breaker/SKILL.md) | Hardening an existing task after evidence shows it is too easy, or when the user asks for stricter behavior. Start with profile detection, the fairness map, actual run evidence, and run authorization. |

The breaker references `harbor-webdev-task-builder`, but that builder skill is not among the supplied workspace skill folders or the available skill catalog. Do not claim to have run it. Author with the supplied template and contracts; obtain the missing skill if a later assignment explicitly requires its tooling.

Apply the breaker's **staged** rules, not its retired-profile passages: no 20-line/six-file cap, no 80% adversarial-weight mandate, no version/checksum/coverage-file additions inside the task, no global binary conversion of Visual. Onboarding's >80% Functional behavior coverage is a different measure from the breaker's enforcement-weight share. Maintain coverage of every requested deliverable regardless of either percentage.

| Helper | What it proves / does not prove |
|---|---|
| [list_checks.py](harbor-webdev-rubric-qc/scripts/list_checks.py) | Enumerates checks, generates a findings skeleton, and validates much of its shape. It does not run platform checkers or examine a task. |
| [build_report.py](harbor-webdev-rubric-qc/scripts/build_report.py) | Builds an XLSX from supplied verdicts. A successful build can contain failures or unexercised checks; it is not a QC pass. Use `--client-safe` for external reports. |
| [audit_task_source.py](codearena-task-breaker/scripts/audit_task_source.py) | Read-only profile/source diagnostic. It returns exit 0 even with failures in its JSON. Inspect every finding. Its literal database-reset requirement disagrees with the supplied template; do not insert destructive DB clearing to satisfy a regex. |
| [harden_criteria.py](codearena-task-breaker/scripts/harden_criteria.py) | Mutates an existing task. For staged tasks it updates the Functional prompt and may raise a timeout; weights change with `--rebalance`. Preview with `--dry-run` and inspect all changes. It does not prove fairness or Oracle success. |
| [check_provider.py](codearena-task-breaker/scripts/check_provider.py) | Sends a real one-token request to the configured grading model using a chat-completions endpoint. This costs/uses provider capacity and does not exercise Claude Code's full protocol, browser MCP, or the restart tool. Run within an already-authorized measurement scope. |

A read-only check of the reporting code confirmed that `--verify` accepts a findings object with all 53 judgments marked `Not exercised` and no deterministic rows. Independently require exactly all 48 deterministic checker names once each, a result/reason for each, and evidence for every quality verdict. Report completeness and task acceptance are separate claims.

The actual deterministic checker implementations belong to the client's harness and are not bundled with these two skills. When unavailable, apply the documented procedure manually and label it manual. Never present `list_checks.py` output as execution of those checkers.

## 8. Shared preflight register

These are evidence-backed follow-ups for the first completed staged task and whenever the common harness changes. They are not claimed platform failures.

| Item | Status and next action |
|---|---|
| Launch working directory | Source confirms the verifier image uses `WORKDIR /tests`; initial and restart launches do not `cd` to the app directory. Reproduce a normal relative-path app under the actual verifier. A correct app must not be penalized for an unstated launch assumption. Resolve any demonstrated mismatch in the shared template/integration contract before multiplying it across tasks. |
| Visual scale | Source has `points = 5`, explicit 0–5 anchors, and a warning about generic 1–5 hints. Check pinned RewardKit output and normalization in a real controlled run. Preserve the supplied schema while investigating; do not assume `score / 5`. |
| Full integration | Validate image builds, transfer of `/app` and `/assets`, browser launch, GLM judge CLI, context substitution, ordered suites, all criterion outputs, and one process restart on a completed task. Source parsing and a provider ping cannot establish these. |
| Report helper coverage | Confirmed omission of deterministic completeness enforcement. Keep the independent inventory/evidence check described above. |
| Source audit mismatch | Confirmed literal DB-reset heuristic absent in the template. Review semantics and profile rules rather than changing the common harness just to quiet the helper. |

Use shared validation results only for the same harness revision. Record any approved baseline change and update both this context and future task starters. Do not rewrite the reference app to conceal a harness defect that would still affect another correct implementation.

## 9. Operational rules and unresolved document conflicts

Onboarding says to claim an Available task before building, stay within its assigned brief/category, and let the claimer own its runs and submission. Day-one guidance is one active claim; steady-state guidance permits up to three. Do not stockpile claims. Release blocked work with a progress note when appropriate; partially uploaded work needs a clean handoff/lead direction. Submitted work should be marked Submitted/Done, not unclaimed.

Two operating targets conflict between the supplied documents:

- **Review deadline:** onboarding says 15 hours; acceptance criteria says 10. Until clarified, plan for review within 10 hours. This is distinct from the agreed 15-hour no-status-change auto-unclaim rule.
- **Throughput:** onboarding says 10/week; acceptance says both 8/week and 2/day (10/week). Both describe about four hours AHT. Treat these as targets to clarify with the pool owner, not measured throughput or reasons to omit QC.

Required evidence pack: task ZIP, Oracle job ZIP, Luna job ZIP(s), other models only when required, evaluation report, and case study. Keep platform job ZIP names. A source review, Oracle pass, or upload success is not final Client Accepted status; the guides require automated and manual QC.

## 10. Keeping this base accurate

When a lead changes the standard, record the instruction's date, affected profile, source, and exact changed rule; then reconcile template, prompts, scoring, workflow, and packaging. Keep old results labeled with their original builder/judge/source revision. Archive superseded guidance rather than restoring it into the active starter.

This review checked the local documents, skills, template/configuration, workbook content, helper code, and scorer boundaries. It did **not** run a new completed app through Docker, a paid judge, or platform QC. Those remain per-task/shared-baseline evidence to collect through [the workflow](TASK_AUTHORING_WORKFLOW.md).
