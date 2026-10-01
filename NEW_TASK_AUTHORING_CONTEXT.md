# New WebDev task authoring context

**1 October review entry point:** use [local QC](qc/README.md) and [review policy](qc/REVIEW_POLICY.md). Current user instructions require ONE audit round with a separate fresh reviewer for each of 53 quality rows, plus review of all 48 deterministic rows, using both workbook and skill. Finish and reconcile the round, then fix confirmed defects before another round. Do not repeat three full audits. Keep hash-bound evidence and shared harness policy unchanged; historical reports remain history. Justified timeout changes below five hours are authorized per lead guidance, but no automatic increase is permitted and current budgets remain unchanged without a measured reason.

Reviewed against the supplied repository sources on **26 September 2026**. Start here, then follow [TASK_AUTHORING_WORKFLOW.md](TASK_AUTHORING_WORKFLOW.md). These documents describe the new **staged** task family. Historical releases remain in their existing folders; their configuration is not the starter for new work.

The objective is more **accepted, fair, reproducible tasks per authoring hour**. A low model score, a successful helper command, or an earlier accepted reference alone does not establish acceptance.

The latest Colderwater source review also rejected the broad interpretation of "one workflow" used in the previous independence audit. Partial implementations must retain credit for independently useful outcomes. Shared browser scenarios can supply multiple independently scored observations without repeating their setup. Count and measure the actual judge workload; a 9,000-second allowance, a successful scripted browser probe or a complete workbook is not proof of full judge completion. See the superseding status in the Colderwater handoff before selecting an archive.

**Latest corrections, 27 September:** apply [QC_REGRESSION_PREVENTION.md](QC_REGRESSION_PREVENTION.md) before using the historical lessons below. It supersedes Colderwater's source-classifier recommendation and any suggestion that keyboard escape must be documented when the brief asks only for operability. Keep task metadata concise, distinguish evaluator failure from app failure, and require a real editor for draft-retention proof. The current candidate is identified in [COLDERWATER_HANDOFF_2026-09-27.md](COLDERWATER_HANDOFF_2026-09-27.md).

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

**External fonts, browser scripts, and CDN assets are permitted. An external backend or data service is not.** Do not reintroduce the older blanket offline or same-origin-asset gate. Self-authored offline wording is not an exception to this profile. A later explicit user override must be recorded with its source; copying a legacy restriction into new task notes does not supply that authorization. Restrictions on code entered by a product's users, such as sandbox snippets, are a separate product behavior and must not become a blanket restriction on the app's own assets.

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

Visual criteria use anchored Likert ratings (`points = 5`); objective behaviors use binary checks. The installed RewardKit 0.1.7 implementation was inspected in the built Ridgeline verifier: raw ratings are **1–5**, normalized as `(raw - 1) / 4`. Raw 1 contributes zero and raw 5 full credit. Match the anchors and missing-surface fallback to that scale; do not retain the starter's contradictory extra raw-0 anchor or assume division by 5. Evidence is in [rewardkit_runtime_source.json](deliverables/ridgeline-print-storefront/hardening-2026-09-26/rewardkit_runtime_source.json).

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
| Launch working directory | Corrected in Ridgeline: both sanitized app launches change to the entrypoint directory before executing Node. The actual verifier image passed a relative-static-path fixture before and after the single-use restart, running as UID 65534. See [harness_results.json](deliverables/ridgeline-print-storefront/hardening-2026-09-26/harness_results.json). The downloaded starter remains unchanged; apply this evidenced launcher correction when creating a new task. |
| Visual scale | Resolved by inspecting pinned RewardKit 0.1.7: `Likert(points=5)` requests raw 1–5 and normalizes `(raw-1)/4`. Ridgeline now uses matching anchors and raw 1 for unavailable surfaces. Preserve the Likert schema and use the corrected anchors when adapting the unchanged starter. No paid aesthetic judgment was performed. |
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

The initial foundation review checked documents, skills, template/configuration, workbook content, helper code and scorer boundaries. Subsequent local Docker/browser evidence is recorded per task: [Ridgeline round 2](deliverables/ridgeline-print-storefront/hardening-2026-09-26-round2/) and [Colderwater](deliverables/colderwater-playground-devtools/hardening-2026-09-26/). These local checks do not establish paid Oracle/model scores or platform acceptance.

## 11. Lessons from the two-task validation pass

Keep basic reachability and rendering in gates, ordinary usability in Polish, and visible presentation in Visual. Clear conventional styling can earn full visual credit; do not invent a branding requirement. Put meaningful difficulty in the requested product behavior. With full Polish and Visual scores, reward is `0.4 + 0.6 * functional` after the floor passes; the requested upper target of 0.7 therefore needs Functional at or below 0.5. This arithmetic is a planning constraint, not a prediction of model performance.

Revision and collision probes need different setups. Preserve an old revision deliberately for stale-save/delete tests, but use the current revision for title/filename validation so the refusal cannot be attributed to a stale version. Check unchanged stored fields and revisions after refusal, then demonstrate a valid recovery. A deleted identity must not be silently recreated by an old update.

For browser code runners, a parent timeout alone cannot establish that a tight loop stopped or that the host remained responsive. Define the supported execution boundary, exercise braced and unbraced loops and asynchronous callbacks in the shipped Chromium, and verify cancellation plus a new successful run. Last-good preview commitment must also handle unhandled Promise rejection timing, not only synchronous throws. User-source line numbers need exact JS and full-HTML fixtures.

Combine browser-created records with the real restart MCP helper and a fresh browser session. API persistence alone does not prove the UI can reload and continue saving afterward. Run unpaid harness fixtures separately from paid judging and label their synthetic scores explicitly.

Bind evidence to the final archive hashes. Verify one ZIP root, CRC, extracted file hashes, executable shell modes, LF shell line endings, no database/build-cache leakage, empty agent `/app`, and exact final instruction/verifier bytes in the images. Reuse earlier evidence only when the relevant source is unchanged, with that limitation stated.

Platform feedback on Colderwater exposed a missed mechanical rule: generic criterion IDs such as `keyboard`, `persistence` and `timeout` collide with ordinary words in participant-facing prose. The checker treats those literal matches as rubric leakage even when the prose is a legitimate product requirement. Rename internal IDs to distinctive task-specific identifiers; preserve the natural instructions and check semantics. Run [check_public_criterion_ids.py](scripts/check_public_criterion_ids.py) over the brief and all environment Markdown before packaging and on the extracted ZIP. The shared packager enforces this now. A semantic read for leaks is insufficient. Colderwater's original manual hygiene PASS is superseded by [the correction evidence](deliverables/colderwater-playground-devtools/instruction-hygiene-fix-2026-09-26/).

## 12. Ridgeline platform corrections: semantic checks need counterexamples

The platform rejected ten Ridgeline rubric judgments after our earlier local review. That review was too confident: a working golden and correct scoring arithmetic did not establish complete coverage, a sufficient backend gate, independent criteria or natural owner instructions. The old round-two PASS/NOTE report is historical and is superseded by [this correction and its evidence](deliverables/ridgeline-print-storefront/rubric-fix-2026-09-26/). Do not copy its verdicts into later tasks.

- Build the coverage map in both directions. Start from every requirement in the brief and notes, then identify its shipped criterion, observable evidence and golden proof. A separate developer test is not shipped grading coverage. Mark exact framework/database-engine requirements as browser-unobservable rather than pretending a network response proves them.
- Write product notes in an owner's voice, with ordinary explanations of business needs. Keep necessary technical setup in the integration note. A list of grader-approved alternatives rewritten as prose is still a test specification. Contractions alone do not prove naturalness; this remains a human review.
- Put an explicit prohibition on inspecting submitted implementation/source/comments in every judge prompt. Calling source "untrusted" is only an injection defense. Permit rendered DOM and, where appropriate, observed application data requests and same-origin probes so judges can establish actual behavior without reading implementation.
- Challenge each gate with a working-looking bad product. For a server-backed shop, a health endpoint plus static JSON is insufficient. Demonstrate a new browser-created order, a real write response, and retrieval of its reference from an independent empty-storage browser context. A second tab shares storage and is not this proof. Ridgeline's fixture deliberately returns HTTP 200 without storing anything; old observations succeed, new independent retrieval fails. Keep fixture evidence separate from a full measured score.
- Run the shared server prerequisite once before scored suites. Each scored prompt must explain that prerequisite and its own reload/data evidence without repeating purchases, inventing an order-list screen or requiring a reference from another judge's private browser session. Budget gate mutations in later stock arithmetic. Basic shared storage is a prerequisite; exact commercial rules and process-restart persistence remain scored behavior.
- Use separate checks for independently useful outcomes: catalogue discovery/filtering/ordering, basket reload/removal, receipt integrity/unknown-reference errors. Linked positive-control and mutation/rejection/readback steps still belong together. Preserve total dimension weight and examine both ordinary partial-credit changes and functional-floor crossings.
- Test the golden installer on a previously used workspace. Installation may reset the exact canonical golden database after confirming it is closed; ordinary app launch and verifier restart must retain data. Prove initial seed, real mutations, durable restart, active-install refusal, fresh reinstall and subsequent durable writes. Do not put a broad database deletion in the shared harness to satisfy a source regex.
- Bind final evidence to source and ZIP hashes. A 53-row workbook and 48-name inventory establish report completeness only. Label local assertions, browser observations, analytical score bounds, paid Oracle/model results and private platform acceptance separately.

Ridgeline's correction preserves the canonical 60/20/20 policy and functional floor. With both revisions clearing the floor, the abstract redistribution upper bound is about +0.0806 reward; near the floor, newly earned partial credit can unlock the presentation contribution and cause a larger jump. This is an arithmetic bound, not a model prediction. A stricter valid server gate can also produce zero for a backendless builder. It is impossible to promise every model stays in 0.1–0.7 while honestly enforcing prerequisites; measure the revised candidate before claiming calibration.

## 13. Colderwater: a visible editor is not a working playground

The later Colderwater platform review also reported ten failures. The previous ID-only repair did not resolve these semantic problems. The old source review accepted a health-only server gate, missed public grading vocabulary and did not map every requirement to a shipped observation. Its affected PASS verdicts are superseded by [the rubric correction](deliverables/colderwater-playground-devtools/rubric-fix-2026-09-26/).

An editor widget can supply highlighting, brackets, indentation, pane resizing and themes without running or saving anything. Colderwater awarded those features 3/49.5 Functional weight, enough to clear the strict >0.05 floor. At 0.75 Polish and Visual, the old gate could admit a 0.3364 shell. Keep ordinary editor credit, but first prove the core product: a fresh authored Run must produce its marker in the preview and console, and a new saved snippet must be retrieved from the server in a clean independent browser context. Use separate inert-runner and localStorage-library negative fixtures, as one fake may expose only one gate's weakness.

Read coverage at the full scope actually promised. If the brief refuses five execution families, testing only eval does not cover Function, WebAssembly, Worker and dynamic import. If revision checks apply to save, rename and delete, exercise all three. If dirty warnings apply to opening, examples, a new draft and import, enumerate all transitions. A successful import does not prove auto-run-off prevents its execution. A case-sensitive uniqueness rule needs both an exact collision refusal and a differently cased positive example. Blank titles and path-like filenames need meaningful valid controls, current revisions and unchanged state after refusal.

Split independent export/import, origin isolation/unsupported execution, native/in-app warnings and distinct error-reporting paths when their failures otherwise erase unrelated credit. Keep each error's own good-preview control, exact authored line and recovery together. Added checks must fit the existing judge budgets and be proved against the golden; more criterion rows are not automatically better coverage.

Apply [check_public_grader_terms.py](scripts/check_public_grader_terms.py) alongside the criterion-ID scanner. It catches the actual "verifier files" leak in the prior ZIP and is now enforced by the shared packager on source and extraction. It flags only specific internal terms, not ordinary product words such as score, model or test. Treat it as a narrow regression guard, not a naturalness detector or proof of no semantic leaks.

A code playground's user-authored source and imported/downloaded files are legitimate product data. Explicit source-inspection bans must distinguish that data from the submitted application's implementation, comments and bundles; otherwise the prohibition can accidentally prevent the judge from testing save/load/export fidelity.

Gate order and data effects are part of the contract. A Save prerequisite may leave a real snippet before scored checks start. Do not assume an empty library, reuse another judge's private context, delete records as a hidden prerequisite or weaken independent controls. Public startup wording, examples, runtime evidence and the first functional criterion must agree about behavior when saved records already exist.

## 14. Follow-up: profile precedence, display scope and actual browser tools

The next Ridgeline screenshot exposed five failed judgments in the first correction; the first two were one hidden-display defect. Current evidence is in [Ridgeline follow-up](deliverables/ridgeline-print-storefront/rubric-followup-2026-09-26/) and the related [Colderwater network correction](deliverables/colderwater-playground-devtools/network-policy-fix-2026-09-26/). Use their manifests and summaries instead of the superseded candidate hashes above.

- Compare public task notes with the authoritative template, not merely with the tests. The earlier review treated our own legacy offline wording as a valid task exception, despite the staged profile expressly allowing browser CDN assets. That reasoning was circular. Both tasks now permit app fonts/scripts/CDN assets; Colderwater's separate authored-snippet network restriction remains valid. Run [check_public_network_policy.py](scripts/check_public_network_policy.py) on source and extraction; the packager enforces it. This narrow guard passes the current template and reproduces both previous failures.
- Separate calculation inputs from requested display. Seed grams and named shipping bands can determine the required postage amount without obliging the UI to print those inputs. Audit every use of "shows", "displays", exact strings and visual coordinates against an explicit public requirement.
- Review independent controls individually. Search, size filtering and paper filtering can fail separately; so can title and price ordering. Preserve the old combined weight when separating them. Keep genuinely interacting positive-control/refusal/readback steps together.
- Assign each presentation observation an owner. In Ridgeline, Polish owns mobile reachability and overflow; Visual evaluates desktop craft and cross-viewport composition. Do not make one mobile overlap lose points in two dimensions.
- Verify browser capabilities through the actual MCP protocol with the exact installed flags. `--isolated` does not prevent `browser_run_code_unsafe` from creating an additional context. The follow-up demonstrated two live independent baskets, reload isolation, clean shutdown of the added context and continued use of the original MCP page. Include a tested lifecycle recipe when ordinary tab tools do not expose the required setup.
- State score effects separately. Small weight-preserving splits can increase partial credit, removal of unrequested labels can restore additional credit, and removal of an invalid gate can restore an entire earned score. Bounds conditional on passed gates/floor do not bound those gate or floor transitions. Measure actual difficulty after correcting fairness.

## 15. Colderwater full review: evidence for every promise

The 27 September review follows another three platform failures against the network-policy candidate. Two failures describe the same issue: the public note clearly asked for feedback after Stop, while the cancellation criterion also demanded a notification when a new Run replaced the old one. Clarify the public Stop request and grade replacement by actual termination, fresh state and suppressed late output. Do not add an unrequested notice merely to justify an existing probe.

The third failure exposed a coverage mistake: the notes promised private runtime files would not be served, but the coverage ledger dismissed that whole promise as an invisible architecture detail. An HTTP request returning the SQLite database or server implementation is observable. Separate observable confidentiality outcomes from an unobservable claim about the whole security architecture. Use representative, bounded content-classified requests, working controls and benign-response counterexamples. A status code, MIME type or filename alone is insufficient. Ambiguous evidence remains unresolved; three negative URLs do not prove exhaustive secrecy.

When a confidentiality probe must classify an exposed implementation response, explicitly scope that exception in the judge prompt. It may classify bounded bytes without executing or displaying them; it must not become permission to read implementation code to award unrelated functionality. Continue to allow user-authored snippet text as ordinary product data.

Review sibling tasks independently. Ridgeline's correction of mobile usability duplicated in Visual had not automatically corrected Colderwater. Polish owns mobile reachability, operability, clipping and overflow; Visual owns composition. Functional theme checks should prove the toggle and preserved work, while aesthetics own contrast and readability.

Expand temporal promises into their own observed transitions. A single successful auto-run does not prove subsequent edits restart the debounce interval. Applying CSS without rerunning scripts does not prove copied elements have lost old event handlers. Establish positive controls, observe the distinguishing transition and avoid hidden timing constants.

Current evidence belongs in [Colderwater full QC](deliverables/colderwater-playground-devtools/full-qc-2026-09-27/). Its final manifest and report supersede earlier local PASS claims only after the recorded final checks complete. Preserve failed fixture attempts as diagnostic history. Synthetic all-one score inputs establish scorer arithmetic, not Oracle 1.0. Browser success establishes only the observations actually executed; aesthetic anchors and paid judge execution remain distinct.

## 16. Second Colderwater cross-check: test the harness and permitted alternatives

A successful HTTP readiness response does not prove a process restart occurred. The inherited restart helper reported success when the old server ignored SIGTERM and the replacement exited with an address-in-use error. Check that the old process group has stopped, force termination after a bounded grace period, reject a remaining listener, and verify that the replacement process stays alive while becoming ready. Treat zombies as exited. Check the new PID rather than immediately assuming its process group has already been established. Exercise normal exit, a resistant parent, a resistant child, a failed replacement and a foreign listener through the actual restart MCP. Keep the whole helper below the MCP timeout and preserve ordinary database durability. A supplied template can contain a reproducible defect; record the deviation and leave its canonical scoring and MCP Python files unchanged.

Negative HTTP probes must distinguish exposed private contents from a permitted response strategy. A harmless redirect is not evidence of a leaked database or server file. Browser fetch with `redirect: 'error'` rejects valid fallback redirects; manual fetch can expose only an opaque response even when Playwright observes the status and Location. Exercise the exact MCP capabilities, follow only bounded observed same-origin redirects, never follow an off-origin destination, and keep incomplete transport evidence distinct from a completed bounded observation. Include a redirect to a real synthetic private signature as a failing control. Record coverage limits without requiring a specific status, route layout or fallback implementation.

The replacement candidate and focused regressions are recorded in [the second cross-check](deliverables/colderwater-playground-devtools/cross-check-2026-09-27/). Prior archive evidence may be reused only for unchanged, hash-matched files; earlier claims that the restart helper and redirect handling had no defect are superseded by the reproduced counterexamples.

## 17. Ridgeline cross-check: scope and distinguishing states

A Colderwater review does not cover Ridgeline. State which task was reviewed, track a separate candidate hash and complete each task's own requirement, harness and golden checks. Ridgeline reproduced the inherited restart defect independently; the repair was applied to its task harness and tested with storefront orders, retries, cancellations and all thirteen stock values.

Read the supplied seed for the state that distinguishes a requirement from a plausible wrong implementation. Ridgeline promises a grid price based on the cheapest offered edition even when that edition sells out. Its initial seed only has a more expensive sold-out edition or a completely sold-out print, so an available-only minimum with an all-sold-out fallback can pass the initial checks. The later Slack Water state provides the missing counterexample: A3 is exhausted, A2 remains, and the grid must retain the cheaper A3 price.

Give that independently useful display behavior its own small criterion rather than make an entire atomic-checkout flow fail because of it. Reassign existing display weight to keep total weight stable. Observe the actual state; if an earlier failed scenario did not establish it, create the needed state through a valid independent checkout without consuming the next criterion's edition. Prove both the normal and alternate setup against the golden. Record small conditional score changes separately from possible functional-floor crossings.

Apply presentation ownership across both tasks. Polish may verify actual theme changes and working return navigation while Visual owns palette, contrast and aesthetic readability. Preserve existing stronger business behavior instead of using a readability deduction to manufacture difficulty. The final evidence is in [Ridgeline cross-check](deliverables/ridgeline-print-storefront/cross-check-2026-09-27/).

## 18. Colderwater: completed previews and real keyboard navigation

The next platform review found two gaps that the earlier local review missed. An implementation matching the golden is not proof that the public contract permits only that interpretation. The five-second execution budget did not say whether a button in a completed HTML preview could still work later. Define the lifetime of the current completed preview separately from work that is still pending: a later user interaction starts its own bounded execution, while timers, Promise callbacks and interactions during unfinished work do not extend the existing budget. Stop, errors and a replacement Run invalidate the old execution. A restored last-good rendering need not revive its scripts or handlers. Test both the delayed successful interaction and the distinguishing pending-budget case.

A promise of navigation without a pointer needs a usable product route. Three Tab stops and working Run/Save/Clear shortcuts do not prove that an example or saved snippet can be opened. Exercise editor escape, example selection, a dedicated saved-library item and return to the workspace using ordinary keyboard actions. Allow native controls and documented alternatives, prepare the record independently, and do not use programmatic focus or DOM clicks to conceal inaccessible controls. If Tab indents in the editor, make its escape sequence discoverable. Keep this operability evidence in Polish; avoid repeating Functional shortcut semantics or Visual aesthetics. Re-read injected shared context as well as the dimension prompt: this repair initially conflicted with an old sentence forbidding Polish writes. Permit only its dedicated setup record, preserve existing records, and keep Visual read-only.

The affected earlier semantic PASS claims are superseded by [the interaction and keyboard correction](deliverables/colderwater-playground-devtools/interaction-keyboard-fix-2026-09-27/). Preserve earlier archives, distinguish reused unchanged evidence from new tests, and measure Oracle/model scores separately from local golden behavior.

## 19. Ridgeline second review: concrete witnesses and bounded final cleanup

The [second Ridgeline review](deliverables/ridgeline-print-storefront/second-cross-check-2026-09-27/QC_FINAL.md) exposed gaps even after a previous complete review. Treat the old PASS as scoped evidence, not proof that a new counterexample cannot exist.

Keyboard promises need actual product navigation, not only a few Tab stops. Assign labels/reachability/focus and real view transitions to distinct outcomes; allow normal/documented keys and harmless setup, without adding a purchase to a basic Polish check. Use real key events, never programmatic focus/click as a substitute.

Filter coverage must include the public boundary it claims to test. A paper filter tested only on prints with available stock cannot expose omission of wholly sold-out prints. Likewise, a restart comparison of “every recorded variant” is incomplete when setup explicitly records only one. State the entire required collection before the transition, include zero values and compare actual observations after it. Keep earlier failed verdicts separate from setup state.

Do not prescribe tie stability, endpoint/schema or target origin unless the public request does. Follow the app's observed local URL and credential policy; localhost and another permitted loopback origin can reach the same required server. Remove hidden restrictions while keeping the requested outcome strict.

Test final EXIT cleanup independently of the restart helper. A bounded restart does not prevent an unbounded final wait. Reproduce a resistant parent, surviving child, already-exited process, missing app, failed gate and original nonzero status; verify valid reward survives cleanup. Bound TERM/KILL waits and ignore zombies. Record any task-only deviation from an inherited template and bind affected fixtures to final hashes.

Cross-task defects need explicit scope. Finding an identical old helper in a sibling task is a follow-up, not evidence that the sibling was fixed. Preserve its current artifact and state the limitation until its own tests/package/handoff are updated.

## 20. Final Colderwater cross-check: real serializers and valid alternatives

The [final cross-check](deliverables/colderwater-playground-devtools/final-cross-check-2026-09-27/QC_FINAL.md) found a real harness defect after earlier mock tests passed: RewardKit 0.1.7 omits empty reasoning during serialization. Schema-valid omission must be accepted; explicit nonstring values and evaluator-error markers remain invalid. Test the installed producer CLI, not only handcrafted result JSON.

Optional provisional rendering must stay optional in every criterion and shared prompt. A correct app may keep its last-good preview visible and block further input while candidate work is pending. Observe the original deadline and final state, without forcing hidden controls or a second handler log. Before a rollback probe, commit a successful interaction so a broken implementation cannot pass by restoring only the original Run. Cover Stop after completed execution, successful padded-title create/rename and an edited example saved separately from its built-in original. These close public-behavior gaps without adding criterion weights or prescribing an example language.

Use [the prevention guide](QC_REGRESSION_PREVENTION.md) and exact source/ZIP/image bindings. Current guards catch known regressions; they do not guarantee platform acceptance or a measured Oracle score. Standard Escape then Tab does not require a help label merely to satisfy keyboard operability; earlier guidance above requiring discoverability is superseded unless the public request explicitly asks for that documentation.

## 21. Platform feedback after the final cross-check

The platform rejected two designs that our local review accepted. Listing the exact three privacy probes in the public note leaked the test boundary; blocking only those URLs still exposed other working files. Describe the privacy outcome by category, keep representative probes private, accept actual intended public assets and run the concrete deny-only-known-paths counterexample. Do not restore source classification or claim finite probes prove complete confidentiality. This supersedes the earlier public reserved-URL advice.

Restart setup required Duplicate and Delete, which double-penalized unrelated missing features. Create independent records with ordinary New/Save instead. Split confirmation/deletion, stale-delete refusal and no resurrection into separate 1.0 contributions, preserving their combined3.0 and Functional49.5. Positive controls must establish the same tested operation, not add separately graded feature prerequisites. Server-only deletion checks do not require a confirmation UI. The current inventory is37 Functional and49 total task criteria. A passing golden proves one complete app works; test partially implemented and valid alternative apps to assess fairness.
