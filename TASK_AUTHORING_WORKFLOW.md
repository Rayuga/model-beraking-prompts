# New WebDev task authoring workflow

Read [NEW_TASK_AUTHORING_CONTEXT.md](NEW_TASK_AUTHORING_CONTEXT.md) first. This workflow turns the current staged contract into a repeatable authoring process. It also distinguishes source checks, local execution, paid grading, and platform acceptance.

Use the supplied rubric skill throughout design and final review. Use the breaker skill when hardening an existing task is in scope. Preserve the user's cleanup and unrelated work. Keep authoring reports outside the task folder.

Before accepting a rubric rewrite, test partial-feature counterexamples for every bundled outcome and distinguish a shared scenario from its scoring units. Measure the resolved RewardKit prompt and schema with the installed CLI builders: a larger rubric can exceed the operating system's per-argument launch limit even when all TOML parses. Record source size, browser work and measured full judge latency separately. Do not mark an unmeasured timeout concern resolved or remove the incomplete-evaluation guard to hide it.

Apply the latest [QC regression prevention steps](QC_REGRESSION_PREVENTION.md) during stages 2, 4, 5 and 6. In particular, test a valid alternative as well as the golden, read injected context with each criterion, distinguish tool failures, and rebind every changed candidate. Older Colderwater private-source classification and mandatory escape-help recommendations below are historical and superseded by that document.

## Roadmap

| Stage | Main source / skill | Result |
|---|---|---|
| 1. Orient and scope | Context, current assignment, onboarding | Claimed task, recorded scope and run budget |
| 2. Design and map requirements | Rubric QC checks 1–7, 26–44 | Natural brief, notes, seed plan, two-way coverage map |
| 3. Build and verify the golden app | Integration contract; QC checks 13–23 | Real app with local evidence for all required behavior |
| 4. Author browser verifiers | Staged contract; QC checks 24–48 | Five dimensions, fair procedures, independent verdicts |
| 5. Review source and local behavior | Rubric QC skill | 48 deterministic results and 53 judgments, with runtime gaps explicit |
| 6. Freeze and measure a candidate | Packaging contract, run instructions | Exact candidate ZIP, Oracle and target-model evidence |
| 7. Diagnose and iterate if needed | Breaker for difficulty; rubric QC for fairness | Justified changes and revalidation |
| 8. Final review and submission | Rubric QC and onboarding deliverables | Matching task/evidence pack and accurate status |

## 1. Orient and scope

**Read:** [context](NEW_TASK_AUTHORING_CONTEXT.md), [template](projects/webdev-task-template/), [staged contract](harbor-webdev-rubric-qc/references/staged-task-contract.md), and the current task assignment.

- Record the claimed task/category, human app name, slug, owner, deadline, user constraints, permitted changes, required model runs, and cost/run budget.
- Confirm the task is actually assigned/claimed before authoring a submission. Do not send tracker/team messages unless authorized.
- Default to the new template for new work. For an existing task, detect its profile before touching configuration.
- Record **builder model** and **judge model** separately. Current sources specify Luna as the evaluated builder and GLM through Claude Code as judge. Do not change verifier configuration to select the app-building model.
- Read the local skill files directly. There is no supplied staged-builder skill to invoke.
- Preserve existing paid-run authorization; ask only when required information or authorization is actually missing. This authoring process is not permission to start paid calls automatically.
- Keep a working evidence record under `deliverables/<slug>/authoring-qc/` or a comparable existing report directory, outside the upload tree.

**Done when:** scope and profile are clear, sources are identified, and the next action is authorized. The deadline/throughput document disagreement can be recorded without stopping independent design work.

## 2. Design the product, brief, seed, and coverage map

**Use:** [quality procedures](harbor-webdev-rubric-qc/references/quality-checks.md), especially checks 1–7, 26–44, and 53. Borrow domain patterns from [the context's reference section](NEW_TASK_AUTHORING_CONTEXT.md#choosing-tasks-and-using-successful-references).

Choose a cohesive product and a small set of interacting rules. Write the core user journey, state transitions, actors, business consequences, and failure/recovery paths. Avoid adding every hard feature—races, approvals, complex editing, receipts—to every task.

Maintain this internal map outside the shipped task:

| Requirement / business reason | Brief or note anchor | Seed / actor / setup | Golden behavior | Criterion and dimension | Observable evidence | State needed afterward |
|---|---|---|---|---|---|---|
| Fill one row per requested behavior | Exact file/section | Include positive controls | Implementation or local probe | One owner per observation | UI, request, re-read, restart | Dedicated record or safe continuation |

Check both directions: every requirement is covered, and every criterion is justified by a requirement or an applicable documented convention. Onboarding's >80% Functional behavior coverage is not a substitute for covering the complete ask, and is not an 80% reward coefficient.

Write the main brief as a person's product request. Point clearly to `/instructions/` notes and `/assets/seed_data.json`. Keep the entry command, port, storage/`DB_PATH`, health path, dependencies, and network policy in the integration note. Do not hide required runtime facts to make the brief feel natural.

Use domain notes for roles, policies, examples, and edge cases. State the business rule clearly enough to infer a correct outcome; exclude grader vocabulary, criterion IDs, test literals, scoring weights, and step-by-step test scripts. Long notes can be split for readability; the staged profile has no 20-line cap.

Create synthetic, internally consistent seed records with useful boundaries and distinct rows for separate verification flows. Resolve all referenced IDs and calculate exact totals independently. Keep distinctive values that judges will create out of the seed and golden markup. Use an explicit scenario clock for graded date/time rules.

**Done when:** the full ask is achievable using the supplied environment, every expected outcome has a source, and the judge can demonstrate each important rule with its actual browser tools.

## 3. Instantiate the starter and build the golden app

**Read:** [environment Dockerfile](projects/webdev-task-template/environment/Dockerfile), [integration note](projects/webdev-task-template/environment/instructions/integration.md), and [solve.sh](projects/webdev-task-template/solution/solve.sh).

Copy the template into the assigned task folder. Fill task metadata and all authoring placeholders. Preserve the five nested dimensions, policy file, shared tools, frozen verifier environment, and nominal budgets.

Build the app under `solution/app/` with `server.js` as entry point. Follow the current Node/Express/SQLite contract. The golden deployer copies files into `/app`. Keep the agent-facing environment free of the reference implementation, rubric, or partial solution.

Verify the core UI and API together, including valid actions, visible refusals, state changes, re-reads, and server restart. Repeated seeding must not duplicate records. Check mobile and secondary/detail/empty surfaces relevant to the supplied polish and visual criteria; a polished home page alone does not cover them.

Use the exact verifier runtime assumptions: unprivileged app user, sanitized environment, `DB_PATH`, actual CWD, fallback app path, and persistent database. Apply the verified launch-directory and 1–5 Likert corrections recorded in the [shared preflight register](NEW_TASK_AUTHORING_CONTEXT.md#8-shared-preflight-register) when adapting the downloaded starter. Reproduce and resolve an actual contract mismatch instead of only adapting the golden to survive it.

External browser assets are permitted by the current integration note; external backend/data services are not. Do not introduce a blanket offline condition or require all requests to be same-origin. Compare task-authored notes against this profile: they cannot authorize their own exception. Run `scripts/check_public_network_policy.py <task>` before packaging and against the extracted candidate. A product-specific authored-snippet network restriction is separate from its app-asset policy.

**Done when:** every requested flow is implemented and exercised locally, with meaningful browser evidence as well as backend checks. Successful startup or API responses alone are insufficient.

## 4. Author the five verifier dimensions

**Use:** [rubric QC skill](harbor-webdev-rubric-qc/SKILL.md), [staged contract](harbor-webdev-rubric-qc/references/staged-task-contract.md), and [dimension responsibilities](NEW_TASK_AUTHORING_CONTEXT.md#5-verifier-responsibilities).

First fill `tests/app_context.md` with the correct app name, URL, accounts, and key screens. Cross-check credentials and entities against the agent-facing notes and golden data.

For each Functional criterion:

1. State a coherent full-credit outcome backed by the brief.
2. Establish the actor, record, state, and a successful control.
3. Perform the relevant action through the UI. For an enforcement probe, capture and replay the app's real request in-page; never guess paths, payloads, or session fields.
4. Observe the outcome and re-read relevant state. For a rejection, prove the forbidden business change did not happen. Do not punish legitimate side effects such as allowed audit logging.
5. Capture evidence at the specified checkpoint, before later actions overwrite it.
6. Leave later criteria's setup intact and make the expected pass/fail bar explicit.

Multi-leg criteria are appropriate for one interacting workflow. Avoid giant chains of unrelated features or giving the same observation multiple weights. Match controls by intent; do not require unstated wording, layouts, numerical display conventions, DOM structures, or route shapes.

Keep gates focused on the supplied prerequisites. Do not promote a difficult product feature into an all-task veto merely to lower model reward. Keep each scored dimension's browser prerequisite, injection-resistance instructions, and independent-scoring/continue-after-failure language.

Functional persistence is last: call `restart_app` once through the verifier MCP tool, wait for confirmation, and re-read earlier changes. No other criterion restarts the app. Later dimensions must tolerate the database state left by earlier ones.

Preserve positive criterion weights and honest importance. All dimension shares stay in `scoring.toml`. Read and calculate the serial timeout totals whenever procedures grow. Judge/tool retries consume real time.

Review Polish and Visual against this product. Keep the current six Visual topics, anchored ratings, and appearance-only scope; do not copy a sibling's screens or convert functional failures into visual deductions. Exercise responsive behavior rather than grading it from one desktop screenshot.

**Done when:** every check has a fair, executable procedure the golden can pass; a plausible incorrect app can fail the relevant check; no unrelated criterion inherits the failure.

## 5. Run local validation and source QC

**Use:** the [deterministic procedures](harbor-webdev-rubric-qc/references/deterministic-checks.md), then all [53 quality procedures](harbor-webdev-rubric-qc/references/quality-checks.md). Read the workbook sheets completely, including internal interpretation notes.

Validate at least the following through the documented checks:

- TOML/JSON parsing, JavaScript syntax, shell syntax, valid shebangs, and LF shell endings.
- Exact file tree, including hidden `tests/.dockerignore`; no stale grader directories or missing `app_context.md`.
- Every asset/instruction path exists, is copied to the correct image path, and will be present in the verifier where needed.
- Shared scorer/restart logic matches the approved baseline; runtime dependencies exist in both images.
- `[judge]` keys and `[[criterion]]` keys are checked as different TOML tables.
- Actual criterion counts/weight sums agree with any metadata claims; prompts resolve expected placeholders.
- Gates precede scoring; score policy and serial budgets agree; zero-reward/finalization paths remain intact.
- Browser startup, accounts, positive/negative controls, durability, idempotent seeding, and state allocation work under the real runtime assumptions.

Use the client checker runner when supplied. Otherwise apply the documented procedures manually and label the evidence accordingly. The downloaded skill contains inventory/report tools, not the client's 48 executable checkers.

Run a targeted local negative witness for important rules when useful: a blank/no-op submission, a seed-only viewer, a control that never writes, or a small deliberate violation of a key rule. Keep these outside the task ZIP. Confirm the intended observation detects the defect. An actual RewardKit regrade of a witness is still a paid judge run and needs authorization.

Complete a **source-review pass** before measurement. Record `Pass`, `Fail`, `Note`, `N-A` with a reason, or `Not exercised`. Runtime-dependent checks can remain `Not exercised` until the required run supplies evidence; do not invent passes to make a pre-run report look complete.

Use P0 for blocked/wrong grading or unsolvable golden behavior, P1 for material score distortion, and lower severities for bounded or latent issues. Every failure needs evidence, impact, and a concrete fix. Inspect findings against available runs and classify them as `CONFIRMED`, `REFUTED`, `PARTIAL`, or `NOT EXERCISED`. A refuted finding cannot remain P0/P1.

**Done when:** source and exercised local checks are sound, all 101 inventory items are accounted for, and remaining unmeasured items are explicit. A successfully generated spreadsheet is not sufficient evidence.

## 6. Freeze a candidate and run Oracle, then Luna

**Read:** [packaging contract](harbor-webdev-rubric-qc/references/staged-task-contract.md), onboarding sections 3B and 7, and [breaker verification guidance](codearena-task-breaker/references/verification.md) when that skill applies.

Create `<slug>.zip` with exactly one matching `<slug>/` root. Use forward-slash member names; include the complete environment assets and instructions. Preserve shell execute permissions and LF content. Do not ship reports, run outputs, live credentials, dependency caches, generated databases, `reward.toml`, old grader directories, `SHA256SUMS.txt`, or a new `coverage.json`.

Extract the candidate into a fresh location and compare it with the intended source. Check CRCs, required files, actual relative paths, shell modes, and file hashes. Do not rely on the source folder or an archive's display name alone. Keep the candidate hash in the external evidence record.

Run only within the user-authorized measurement scope. The breaker's provider preflight is itself a real request; pass `--task` so it reads this task's grading model. A successful ping does not prove full judge/MCP integration.

Run Oracle through the actual verifier on the candidate. Inspect gate outputs, every criterion verdict, scorer output, app/restart logs, and tool errors. Require Oracle >=0.95 under current published acceptance and implement/fix every legitimate required behavior; aim for 1.0. Resolve missing grading or known false failures before interpreting difficulty.

Then run the required Luna builder and grade the resulting app through the same judge configuration and task revision. Record all attempts, including failures and reruns. Do not switch models, filter away inconvenient samples, or call a reused Oracle export a fresh independent pass.

No-op/partial-app grading and additional comparison or repeat runs should follow the required evaluation plan and authorized budget. Repeat a near-boundary/flaky result when justified and authorized, not to hunt for a lower sample.

**Done when:** valid Oracle and target-model evidence exist for the candidate, or a specific failure is ready for diagnosis. Do not substitute a local smoke run for platform Oracle evidence.

## 7. Diagnose failures before changing difficulty

| Observed issue | Next action |
|---|---|
| Provider error, credit/rate limit, judge CLI or browser tool fails before useful grading | Diagnose the tool/provider path. Retain evidence; do not rewrite product requirements to explain the zero. |
| App entry missing, startup crash, bad package path, unreadable assets | Determine whether the submitted app violated the published contract or the harness added an unstated assumption. Fix the responsible side. |
| Oracle misses a legitimate criterion | Improve the golden app and rerun affected checks; do not weaken the requirement just to get Oracle through. |
| Criterion demands unstated details or uses an invalid probe | Rewrite the criterion to test the requested behavior, then revalidate both correct and incorrect witnesses. |
| Judge cannot finish or omits checkpoints | Reduce redundant work, clarify evidence order, check actual tool capability and budgets. Treat missing observations separately from demonstrated product defects. |
| Valid Luna reward >0.7 | Deepen requested domain interactions or existing evidence checks under the breaker skill; update the brief/seed/golden whenever the product requirement changes. |
| Valid Luna reward <0.1 | Check gates, fairness, dependencies, and genuine over-difficulty. Recover useful partial credit without overlooking real defects. |
| Valid Luna reward in 0.1–0.7 | Freeze when required QC/evidence are complete. Do not keep tuning toward an arbitrary 0.4. |

Do not classify by flags alone. In the supplied runner, initial zero records cover several early exits, including missing submissions. The scorer also sets `graded: 1` after the **gates** pass, before the scored suite has necessarily completed. Check `gates/reward.json`, `scored/reward.json`, both suite logs, criterion verdict counts, and the app log. Neither `graded: 0` nor `graded: 1` proves the cause or completeness of a run by itself.

For a hardening pass, read [codearena-task-breaker/SKILL.md](codearena-task-breaker/SKILL.md) and its staged profile rules. Keep the fairness map, positive controls, and a recoverable baseline. Its default helper may edit the Functional prompt/timeout; use `--dry-run` and review the diff. Do not rebalance automatically or copy its retired-profile rules.

Change one identifiable cause at a time. Repeat affected local checks and source QC, and obtain new Oracle/model evidence when semantic changes invalidate prior results. If a run is reused for a strictly non-semantic revision, state exactly what changed and why reuse is justified; never label it fresh.

## 8. Final review, packaging, and submission

Finish the same 48 deterministic and 53 quality checks with run evidence. Do not leave a blocking P0/P1, an untested required runtime path, or a misleading “all passed” claim. Record lesser notes and any evidence limitation honestly.

Rebuild only from the frozen source, extract and validate again, and ensure its content matches the measured candidate. If code, seed, instructions, rubric, or runtime semantics changed after measurement, revalidate the affected evidence.

Prepare the separate evidence pack:

- Task ZIP named `<slug>.zip` with one matching root.
- Oracle job-directory ZIP and required Luna job-directory ZIP(s), retaining platform names.
- Additional model exports only when required.
- Evaluation report with exact builder/judge configuration, scores, gate results, criterion-level failures, known flakes, and reused-run disclosure.
- Case study describing the product, domain challenges, verifier choices, and observed results.
- Client-safe QC workbook when requested by the submission workflow; always retain internal QC evidence outside the task ZIP.

Strip the `Internal Quality Checks` and `ChangeLogs Sheet Link` sheets from any external QC workbook using `--client-safe`, then inspect the result. Remove the generated blank example finding from the skeleton if there is no real finding.

Submit to the authorized destination and update status only when instructed/authorized. Preserve the distinction between “locally reviewed,” “platform QC passed,” “submitted,” and “Client Accepted.”

**Done when:** task and evidence artifacts match, the required automated/manual review status is accurately recorded, and the delivery is complete for the assigned scope.

## Commands for this Windows workspace

These commands are local and do not invoke a paid judge. Run from the repository root. Choose a real task slug before executing task-specific commands.

Use the bundled Python rather than assuming the `python` Windows Store alias works. If this path is absent on another machine, select Python 3.11+ with `openpyxl` and verify it first.

```powershell
$pythonExe = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
& $pythonExe -X utf8 -c "import sys, tomllib, openpyxl; print(sys.executable); print(openpyxl.__version__)"

$taskSlug = 'replace-with-assigned-slug'
$taskPath = Join-Path (Get-Location).Path "projects/$taskSlug"
$qcPath = Join-Path (Get-Location).Path "deliverables/$taskSlug/authoring-qc"
$findingsPath = Join-Path $qcPath 'findings.json'
if (-not (Test-Path -LiteralPath $taskPath)) { throw 'Task folder does not exist' }
New-Item -ItemType Directory -Force -Path $qcPath | Out-Null

& $pythonExe -X utf8 harbor-webdev-rubric-qc/scripts/list_checks.py
& $pythonExe -X utf8 codearena-task-breaker/scripts/audit_task_source.py $taskPath
```

Generate the findings skeleton as UTF-8 bytes. Windows PowerShell `>` redirection can produce UTF-16, and `Set-Content -Encoding UTF8` on older PowerShell can add a BOM; either may conflict with the helpers' JSON reader. Do not overwrite an existing completed findings file:

```powershell
if (Test-Path -LiteralPath $findingsPath) { throw 'Findings already exist; use the current file or a new review folder' }
& $pythonExe -X utf8 -c "from pathlib import Path; import subprocess,sys; data=subprocess.check_output([sys.executable,'-X','utf8','harbor-webdev-rubric-qc/scripts/list_checks.py','--template',sys.argv[1]]); Path(sys.argv[2]).write_bytes(data)" $taskSlug $findingsPath
```

Fill and inspect the findings before building a report:

```powershell
& $pythonExe -X utf8 harbor-webdev-rubric-qc/scripts/list_checks.py --verify $findingsPath
if ($LASTEXITCODE -ne 0) { throw 'Findings validation failed' }
& $pythonExe -X utf8 harbor-webdev-rubric-qc/scripts/build_report.py $findingsPath --output (Join-Path $qcPath 'qc-client.xlsx') --client-safe
if ($LASTEXITCODE -ne 0) { throw 'QC report build failed' }
```

In addition to those helper checks, independently compare the deterministic results with the inventory: exactly 48 distinct matching names, each with a status and evidence/reason. Verify evidence for every quality verdict and inspect unresolved failures. The helper does not enforce all of this.

Use `harden_criteria.py <task-folder> --dry-run` only for an in-scope hardening pass. Do not add `check_provider.py` to an automatic local-validation batch: it makes a real paid-provider request.

## Per-task handoff record

Keep this outside the shipped task:

```text
Task / assigned scope / owner:
Source folder and candidate ZIP:
Template baseline / source revision / ZIP SHA-256:
Explicit task-specific exceptions:
Builder model and run settings:
Judge runner / judge model / provider:
Run authorization and remaining budget:
Brief → golden → criterion map:
Deterministic results (48) and quality judgments (53):
Local browser / restart / negative-witness evidence:
Oracle run ID / source hash / fresh or reused / scores:
Luna run IDs / source hashes / scores:
Other required runs:
Confirmed defects, incomplete evidence, and next action:
Final artifacts / submitted status / acceptance evidence:
```

A future instance should read both base documents, the current task notes, this handoff record, and the relevant skill before editing. Resume the recorded next action; do not restore superseded archive rules or reinterpret old runs as evidence for a new revision.

For the final artifact pass, compare the extracted ZIP with the frozen source and rerun source checks against that extracted tree. Keep shell files LF both on disk and through Git checkout. Verify the exact built images contain the final notes and verifier bytes, with no golden files in the agent environment. A source parser, synthetic harness score and successful Docker build are distinct evidence; none substitutes for the measured Oracle/Luna runs.

Run `scripts/check_public_criterion_ids.py <task-folder>` before packaging and again on the extracted task. It exits nonzero when any criterion ID appears as a literal word/token in participant-facing Markdown. Ordinary words such as `keyboard` can be collisions; use distinctive internal IDs rather than delete legitimate product requirements. `deliverables/package_staged_candidates.py` now runs this guard automatically. This local check covers the observed ID-collision rule, not every behavior of the private instruction-hygiene checker.

## Required regression review after the Ridgeline feedback

Apply these during authoring and repeat affected checks before freezing a candidate. The original Ridgeline review missed them even though the golden and source assertions passed.

1. Extract requirements from the public brief and notes first. For each, record the shipped criterion, observable action/result and golden evidence. Then reverse the map and ensure each criterion is justified by public requirements. Explicitly identify browser-unobservable architecture requirements. Do not count an external smoke test as rubric coverage.
2. Read the brief aloud as an owner request. Move deployment instructions to integration notes, preserve business rules, and remove scoring vocabulary and verifier-shaped clauses. Evaluate voice manually; keyword checks and contractions cannot certify it.
3. Check all five prompts for an explicit source/implementation evidence ban, browser-based evidence instructions, and the correct prerequisite. "Untrusted" does not mean "do not inspect." Ensure the permitted browser/network tools can actually perform the observations.
4. Build and execute a plausible negative fixture against each critical prerequisite. For shared server data, use static seed responses plus localStorage writes and even a no-op successful POST. Require the gate to distinguish that fixture from the golden through a fresh independent browser retrieval. Do not credit a same-context reload as shared storage, nor infer the database engine from browser behavior.
5. Record every gate mutation and each subsequent criterion's stock/state allocation. Scored judges must not assume access to another judge's browser storage or generated reference. Use delta-based checks after earlier failures and stop a failed negative sequence before it drains fixtures needed later.
6. Inspect bundled criteria with counterexamples: can a working independent feature lose all credit because a different feature fails? Split when appropriate, retaining linked positive/negative/recovery legs for one behavior. Compute redistribution effects and floor crossings under the canonical scorer; do not adjust the policy to manufacture the target score.
7. Exercise golden installation on both empty and used workspaces, separately from normal process restart. An installation-only seed reset must target exact files and refuse active database use. Restart must preserve prior writes. Keep actual evidence for both lifecycles.
8. Freeze source; rerun affected source/browser/negative-fixture checks; rebuild and compare actual image contents; package and repeat checks on the extracted ZIP. Have the independent reviewer use the frozen manifest. Disclose reused evidence and unresolved subjective or measured-evaluation limits.

See [Ridgeline correction evidence](deliverables/ridgeline-print-storefront/rubric-fix-2026-09-26/) for executable installer, browser-mock, golden gate/address, source and score-bound examples. These are regression examples to adapt, not a replacement for the 53/48 task review or paid evaluation. Never repeat a previous local PASS after platform evidence disproves its rationale.

The subsequent Colderwater failures add these concrete checks to the same review:

- Run `scripts/check_public_grader_terms.py <task-folder>` alongside the criterion-ID scan, both before packaging and against extraction. Reproduce a known-bad public-vocabulary leak to verify the guard actually fails; a zero exit code on only the corrected source is weaker evidence.
- For a code runner, prove a newly authored snippet actually runs before editor-only features can unlock presentation credit. For its server library, prove a new save and clean-context retrieval. Execute separate negative fixtures for dead execution and browser-only storage.
- Expand every plural promise into coverage cases: each unsupported execution family, each revision-protected mutation, each dirty-navigation destination, and both positive/negative sides of filename/title rules. Record acceptance when auto-run is off as well as active execution after Run.
- Keep user-authored editor/file contents permitted as product evidence while prohibiting inspection of the application's implementation. Validate exact source line fixtures after splitting error paths.
- Budget gate-created records and avoid assuming a particular order between the two gate judges. Startup requirements and the first scored check must remain valid with that record present. Do not add destructive cleanup or advanced delete behavior to a basic Save gate.
- When a local browser test fails, distinguish a bad assertion about browser-tool behavior from an app defect. Native beforeunload cancellation may produce a pending navigation timeout rather than a specific ERR_ABORTED string; grade the observed retained draft and cancelled navigation, not a particular automation exception.

Use [Colderwater correction evidence](deliverables/colderwater-playground-devtools/rubric-fix-2026-09-26/) for these cases. Keep canonical scoring and report partial-credit/floor effects honestly; a repaired prerequisite can give an incomplete model zero even when the authoring target starts above zero.

The later [Ridgeline follow-up](deliverables/ridgeline-print-storefront/rubric-followup-2026-09-26/) adds four preflight steps:

1. Review every mandatory display assertion against a public display requirement. Data used to calculate a price, such as grams or a shipping-band name, is not automatically required receipt text.
2. Give independently useful controls separate outcomes, retaining their combined weight. Assign mobile usability and visual composition distinct evidence so the same overflow does not lose points twice.
3. Compare the brief, integration notes and all judges with the current public-network profile. Run the new network-policy guard on source and extraction, plus its known-bad regression cases. App CDN permissions and authored-snippet network restrictions are separate policies.
4. Exercise unusual browser setup through the actual MCP tool and exact flags. For simultaneous independent visitors, prove context creation, empty initial storage, both live contexts, reload isolation and cleanup that preserves the original MCP page. Include the tested tool recipe in the rubric; do not infer capability or impossibility from `--isolated` alone.

The 27 September Colderwater review adds these checks before the source freeze:

1. Interpret feedback requirements per action. Stop, timeout and supersession may have different public requirements; do not infer the same required notification for all three. Keep substantive lifecycle invariants strict.
2. List security promises individually. For each, identify an executable bounded counterexample before declaring it browser-unobservable. A static-root file leak can be observed even though comprehensive host security cannot be proved.
3. Exercise negative classifiers against both failing and permitted implementations. Include SPA fallback responses, ordinary public JavaScript and harmless JSON metadata. Restrict response inspection to classification, without execution or logging sensitive content. Record truncation or ambiguous evidence honestly.
4. For temporal/state requirements, add the distinguishing transition: a second edit inside a pending debounce, or a previously working handler after a CSS context replacement. Ordinary single-action smoke tests do not cover these promises.
5. Apply cross-task learnings to each candidate separately. Verify presentation ownership in both Polish and Visual and remove aesthetic deductions from functional mechanics.
6. Reconcile generic helper findings with the authoritative template and current sheet. A regex demanding an initial database deletion or rejecting the word "optional" can be stale or overbroad. Preserve the raw result and document the exact false-positive reason; do not silently label the helper as passing or change durable runtime behavior to satisfy it.
7. Bind fresh source/extraction checks, actual image bytes, criterion-level browser observations and independent 53/48 review to the same source. State all runtime or judgment gaps, especially when local groups are not an execution of the complete paid rubric.

The second Colderwater cross-check adds two adversarial preflight cases:

1. Prove process replacement separately from HTTP availability. Test a SIGTERM-resistant server and child, a replacement that exits, and an unrelated listener. Require the actual single-use MCP helper to report errors for unsuccessful replacement, verify old-group termination and new-PID liveness, then repeat the browser-created record/restart/fresh-read/save witness. Keep startup checks free of process-group creation races and all waits inside the MCP deadline.
2. Challenge private-file classifiers with redirects as well as ordinary bodies. Test same-origin public fallback, same-origin private-signature exposure, off-origin redirects with zero outbound requests, and genuine transport failure through the installed browser MCP. Use bounded observed redirect metadata without printing private payloads. Avoid a hidden no-redirect requirement and disclose uninspected destinations.

When these reveal a new defect after a source freeze, keep the earlier archive immutable, repair only the affected implementation or rubric, rerun focused proofs, compare unchanged golden hashes, and produce a replacement ZIP, manifest and review. Do not present the older report as proof for changed harness or prompt bytes.

For parallel tasks, explicitly list the reviewed task and its source hash in each progress/final report. A sibling's successful checks or repaired shared-pattern defect are not evidence that this task was checked. Reproduce and validate the affected behavior independently.

For every conditional product promise, identify a reachable state that distinguishes it from a plausible wrong implementation. Initial seed coverage can miss a condition that only appears after purchases, cancellation or another mutation. Keep a small independent outcome separate from unrelated checkout correctness, give it its own valid setup when earlier checks fail, preserve later stock allocations, and test both setup paths. Update criterion counts, metadata and packaging assertions together; retain the dimension's total weight and document floor effects separately from above-floor bounds.

For execution deadlines, explicitly map initial execution, pending callbacks, successful completion, later user interaction, Stop, error and supersession. Read the public wording as an independent implementer before consulting the golden's behavior. A completed preview's later interaction can start a fresh budget only when the brief says so; unfinished work must retain its original deadline. Test a delayed positive interaction and a negative case whose measured timing actually distinguishes an incorrect reset. Do not promise that a restored static snapshot revives cancelled handlers.

For keyboard-accessibility promises, perform a pointer-free route through the specific product surfaces: escape the editor, choose an example, load an independently prepared saved item and return to the workspace. Tab-stop counts and command shortcuts are insufficient coverage. Use normal or documented keys, inspect visible focus, prohibit programmatic focus/click shortcuts during the route, and check discoverability of editor escape. Keep keyboard operability in Polish and the separate shortcut behavior in Functional. Re-read the injected app context for any contradictory state/setup rules; permit only the necessary dedicated setup record and preserve earlier data. Rebuild and verify the delivered bundle when adding golden help text; a source-only change does not fix the shipped app.

For the final harness exit, run a separate resistant-process check even when restart tests pass. Assert bounded termination of parent/child process groups, preservation of valid or zero rewards and the original nonzero exit status. Re-run affected orchestration after repairing cleanup, while retaining unchanged helper/scorer evidence only by exact hash.

Before freezing a catalogue or durable-state rubric, write a concrete wrong implementation for each plural/boundary promise. Test a wholly sold-out item in the relevant filter, and record every required variant before restart rather than trusting a vague “all recorded” comparison. Verify observed local URL/credential handling and remove unrequested tie-order rules. For keyboard promises, prove real view changes separately from labels/focus, using ordinary or documented keys and harmless independent setup.

Reconcile all final workbook rows, including deterministic output text, with current counts and evidence. A newer summary can still contain old “24 criteria” or “unchanged test.sh” claims copied into individual rows. Reopen the client-safe workbook, compare every 53/48 entry to the final findings, bind the exact archive hash, and mark fresh versus reused observations explicitly.

At the final cross-check, exercise the installed result producer and its serializer with a local transport fixture. Empty optional fields may be omitted in legitimate CLI output; handwritten fixtures cannot establish that compatibility. Keep explicit malformed fields, incomplete evaluator markers and observed app failures as different cases. Preserve the failed assumption and supersede its old test expectation openly.

For provisional execution and state recovery, test a valid last-good overlay that hides candidate changes and blocks further input. Do not force hidden/disabled controls. A successful interaction must precede a failed interaction when testing latest-state rollback. Also test completed-preview Stop, successful unique padded-title writes and a saved edited example whose original remains unchanged. Choose an example language the app actually supplies. Keep the public contract and weights unchanged when these are already stated requirements.

Standard editor escape keys can satisfy navigation without app-provided help text. This supersedes earlier discoverability language in this document unless documentation itself is explicitly requested. Consult [the current prevention guide](QC_REGRESSION_PREVENTION.md) before packaging and keep hosted Oracle/target-model claims unmeasured until those actual runs exist.

Before finalizing privacy checks, compare public prose with the private candidate list. State the product boundary by data/file category; never fix a hidden requirement by publishing the exact finite probes. Exercise the concrete leaking implementation that blocks only the previously advertised paths. Preserve genuine public asset/data roles and source-inspection restrictions, and record the finite coverage limit.

Before finalizing criterion independence, map each setup operation to its separately graded owner. Restart needs ordinary independent saves, not Duplicate/Delete. Separate independently useful confirmation, stale-delete protection and deleted-identity update refusal; give each its own data. In server-only checks, perform offered confirmation if necessary without making its UI a scoring requirement. Missing Auto-run alone cannot invalidate an unrelated gate. Keep intrinsic controls such as a valid current-revision operation before testing its stale refusal. Review accepted evidence assumptions as well as code: the previous guard that required public probe filenames was enforcing a bad design.
