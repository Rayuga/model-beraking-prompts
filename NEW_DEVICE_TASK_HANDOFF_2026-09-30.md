# WebDev task authoring: complete handoff for another device

Prepared 30 September 2026. This document records the working agreements and repository state at handoff. It is for an authoring agent working on a newly assigned task, not an instruction file to ship inside an app task.

**Aim:** produce difficult, fair, complete WebDev tasks with a working golden solution, meaningful partial scores and defensible QC evidence. We want more accepted tasks, with fewer wasted portal attempts. Making a judge time out or fail a correct alternative implementation is not useful model difficulty.

**Current status:** the latest Colderwater fairness fixes have measured scripted browser evidence. They do **not** have a fresh complete QC clearance, a configured Oracle grade, a Luna score or a hosted pass. This handoff and push were requested **before** another QC round. See section 12 for the exact candidate and remaining blockers.

## 1. Read these first, in this order

1. [AGENTS.md](AGENTS.md): workspace obligations and authorization boundaries.
2. [qc/README.md](qc/README.md) and [qc/REVIEW_POLICY.md](qc/REVIEW_POLICY.md): current review process and corrections learned from failures.
3. [NEW_TASK_AUTHORING_CONTEXT.md](NEW_TASK_AUTHORING_CONTEXT.md) and [TASK_AUTHORING_WORKFLOW.md](TASK_AUTHORING_WORKFLOW.md): broader task authoring context. Some older sections are historical; apply the current policy where they conflict.
4. [WebDev Rubrics QC.xlsx](WebDev%20Rubrics%20QC.xlsx): read **both** Quality Checks and Deterministic Checks. Current inventory: **53 quality checks and 48 deterministic checks**. Internal Quality Checks contains interpretation notes; do not ship that internal sheet to a client.
5. [harbor-webdev-rubric-qc/SKILL.md](harbor-webdev-rubric-qc/SKILL.md), plus [staged contract](harbor-webdev-rubric-qc/references/staged-task-contract.md), [quality procedures](harbor-webdev-rubric-qc/references/quality-checks.md) and [deterministic procedures](harbor-webdev-rubric-qc/references/deterministic-checks.md).
6. [projects/webdev-task-template](projects/webdev-task-template): actual canonical files, not recollections of previous tasks.
7. [qc/CURRENT.md](qc/CURRENT.md), then the handoff and reports for the task actually assigned to you.

Authority is current user/lead instructions and workspace rules, the applicable current template/profile, then older examples and historical notes. Where these genuinely conflict, record the exact conflict instead of quietly changing shared policy. Do not use a previous task's passing report as permission to ignore the current profile.

Use the Harbor QC skill for task QC and announce its use. [codearena-task-breaker/SKILL.md](codearena-task-breaker/SKILL.md) can guide difficulty design when relevant, but several generic instructions there are superseded here: do not increase frozen budgets, import retired brief limits, or bundle independently useful outcomes merely to make a task harder. A task-builder skill referenced in older notes is not automatically installed; check availability before claiming to use it.

## 2. Models, Oracle and the score we want

These are different roles:

| Role | Current local standard / evidence | What it means |
|---|---|---|
| Target app builder | **GPT-5.6 Luna**, as recorded in current workspace onboarding | The model creates the submitted app. Confirm the selected builder in the actual run configuration; it is not selected by the task's judge environment. |
| App-scoring judge | `REWARDKIT_JUDGE="claude-code"`, `REWARDKIT_MODEL="z-ai/glm-5.3-flashx"`, through the frozen OpenRouter configuration | The `claude-code` runner name does not mean that Claude or Opus is the scoring model. Preserve the template values. |
| Oracle | The authored `solution/solve.sh` installs the golden app, then the configured verifier grades it | A successful browser script is not an Oracle grade. Oracle uses the same scoring contract as other submissions. |
| Portal source-QC reviewer | The user reports Opus 5.5 and three reviews | This configuration has not been independently verified. Do not relabel local reviews as that model or edit judge settings to imitate it. |

The local onboarding target is an Oracle score of at least **0.95** and a target-model score in **0.1-0.7**. Our engineering aim is **Oracle 1.0**, with all required features implemented and all unscored gates genuinely passing. The user's more specific Colderwater calibration preference is **0.4-0.5** for Luna. Use that as a working difficulty preference for discussion on another task, not an invented universal acceptance rule or a guaranteed prediction.

The shared reward policy is fixed:

```text
If either gate fails, reward = 0.
If Functional <= 0.05, reward = 0.
Otherwise reward = 0.6 * Functional + 0.2 * Polish + 0.2 * Visual.
```

If Polish and Visual are both 1, the reward is `0.4 + 0.6 * Functional`. Therefore a nonzero 0.4-0.5 target actually requires Functional just above 0.05 and no higher than about 0.1667; Functional 0.08-0.15 gives 0.448-0.49. Do not promise 0.4 merely because the difficult checks look demanding. Measure the model. Do not change weights, the floor, gates or judging fairness to force a preferred number.

Keep render, basic usability and visual expectations straightforward and attainable by a competent model app. Concentrate difficulty in legitimate functional behavior. A working but incomplete app should retain the credit it earned. A beautiful inert shell should fail a genuine core prerequisite, rather than collect style points for a product that does nothing.

## 3. Set up the other device without losing evidence

The repository is `https://github.com/Rayuga/model-beraking-prompts.git`. These commands are examples for the operator to run in an appropriate parent directory:

```powershell
git -c core.autocrlf=false clone https://github.com/Rayuga/model-beraking-prompts.git
Set-Location model-beraking-prompts
git config core.autocrlf false
git status --short
git log -1 --oneline
git switch -c task/<assigned-slug>
```

Open the repository root in VS Code so AGENTS.md and relative links apply. Replace `<assigned-slug>` with the actual assigned task. Confirm that the task is still claimed/available; Ridgeline's older claim must not be assumed current. Use a separate branch/worktree per author or device. Coordinate ownership before two agents change shared files. Fetch and integrate the other branch deliberately; do not force-push, hard-reset someone else's work, or use an old ZIP as the source of truth.

Useful local tools: Git, Python 3.11+ with `openpyxl`, Node 22, Docker with Linux containers, and Bash/WSL for shell checks. Install dependencies during setup as needed, following the task lockfile and template. The delivered app must not install packages at startup. On a fresh Windows environment, a local Python environment can be created with:

```powershell
py -3.12 -m venv .tools/qc-venv
.tools/qc-venv/Scripts/python.exe -m pip install openpyxl
.tools/qc-venv/Scripts/python.exe scripts/qc_pipeline.py --help
```

Use that Python executable in subsequent commands if `python` is not the configured interpreter. Linux users can use the equivalent venv executable. Do not copy the previous device's `C:/Users/...` interpreter paths into project scripts.

Portability boundaries:

- `.gitattributes` preserves the hash-bound Colderwater inputs, template, QC skill and review evidence. Shell entrypoints retain LF. Do not normalize old evidence after cloning: a line-ending change changes its hash.
- `.qc-cache/` is ignored and **does not arrive through Git**. Existing reports remain readable, but reconciliation needs the corresponding frozen snapshot. For new work, run `prepare` with a new unique run name. Do not replace a historical manifest with newly prepared bytes to make it appear current. Reconstruction of an old cache is valid only if every restored input matches its manifest; no automatic restore command is supplied here.
- Docker images, running containers, local databases, credentials, `node_modules` and tool caches are not transferred. Rebuild/reinstall the required local tools. A cached image tag in an old log is not an image available on the new device.
- Reviewed local logs under `qc/runs/` are committed because they are evidence. Keep provider secrets out of logs and Git; configuration placeholders such as `${OPENROUTER_API_KEY}` are not actual credentials.
- Keep source under `projects/<slug>`, evidence under `qc/runs/` or `deliverables/`, and handoffs outside task folders. Do not ship our QC workbook, skill, reports or internal notes inside a submitted task.

The cleanup already recorded in [qc/cleanup/2026-09-29.json](qc/cleanup/2026-09-29.json) removed duplicate archive-validation extractions and reproducible Python caches. Unique evidence, original ZIPs and reference tasks remain. The manifest records a restore commit. Do not repeat broad cleanup on another machine. Preview the bounded cleanup script before applying any future cleanup.

## 4. What may change, and what must stay canonical

The staged layout is:

```text
projects/<slug>/
  instruction.md
  task.toml
  environment/
    Dockerfile
    instructions/*.md
    assets/seed_data.json
  solution/
    solve.sh
    app/server.js
    app/...source and built application assets...
  tests/
    Dockerfile
    .dockerignore
    test.sh
    app_context.md
    scoring.toml
    tools/score.py
    tools/restart_mcp.py
    gates/{render,constraints}/{judge.toml,prompt.md}
    scored/{functional,polish,visual}/{judge.toml,prompt.md}
```

| Area | Rule |
|---|---|
| Task identity and descriptive metadata | Fill the template's task-specific fields accurately and briefly. No colleague attribution, QC marketing, extra keys or unsupported provenance. |
| Public brief, notes, seed, golden solution | Author the actual product. Keep instructions, fixtures, runtime and implementation consistent. |
| Task-specific prompts and criteria | **Editable**, including where no literal `CHANGE_ME` appears. The user explicitly clarified this. Preserve shared mechanics, headers/settings and supported schema. |
| `tests/test.sh`, both Dockerfiles, `tests/.dockerignore`, `tests/scoring.toml`, shared tools | Preserve canonical bytes. Do not change these to solve a task-local QC complaint. |
| Judge headers, MCP configuration and scoring headers | Preserve template values. Change task criterion definitions, not model settings or timeout. |
| `task.toml` structure, environment/verifier settings and timeout fields | Keep the template's exact keys and shared values. |
| `tests/app_context.md` and injected context contract | Preserve template-controlled content and placeholders; task-specific material must remain compatible with the injected contract. |

Current budgets are agent **7200s**, verifier **13200s**, gate suite **1500s**, scored suite **11100s**; judge timeouts are render **600s**, constraints **600s**, functional **9000s**, polish **900s**, visual **900s**. They fit arithmetically, but that is not proof that the judge can finish the requested browser work.

Legacy rules are not universal current rules. Do not restore `reward.toml`, old top-level 4/3/2 or 6/2/2 judge weights, or old version requirements into this template. In the current profile a `judge = "claude-code"` fallback inside `[judge]` is expected; a model, reasoning effort, temperature or weight there is a defect. Individual **criterion** weights are still valid. Copy the current template's schema, not a remembered instruction to remove every `judge` key.

The lead's utilibill review is especially relevant: adding `--chdir`, increasing 9000 to 9800, changing suite budgets, or changing the functional floor were prohibited template deviations. Older context sections suggesting launcher fixes or scaled budgets are superseded. If the canonical harness is defective, preserve evidence and request an approved shared fix; do not secretly repair just one task's harness.

## 5. Runtime contract to build and test against

Read the exact current template and integration note before implementation. Current essentials:

- The delivered app lives in `/app`, starts with `node /app/server.js`, listens on `0.0.0.0:3000`, and exposes the required `/api/health` endpoint.
- The template provides Node 22, Express 5.1.0 and better-sqlite3 12.4.1 through its environment. Keep the single-process contract and supported dependency arrangement.
- SQLite uses `/app/app.db` under the current contract; honor the configured `DB_PATH`. Resolve assets and other files using the entrypoint's location, not the launching shell's working directory.
- **Do not assume the working directory is `/app`.** The unchanged verifier may launch from `/tests`. An `express.static('public')` path that only works after manually changing directories is insufficient.
- The app must work under the verifier's low-privilege user, sanitized environment and filesystem permissions. Check writable database parent directories and startup paths.
- Bundle required runtime files into `/app`; do not depend on `/assets` remaining available in the grading container. Copy seed data needed by the running app during installation.
- Setup/network policy is public in this profile. Browser CDN assets and off-origin resources are permitted. Do not create an offline-assets gate. A playground's restrictions on **user-authored snippet execution** are a separate product requirement, not a ban on the app's legitimate network assets.
- `solve.sh` must install a repeatable fresh golden baseline. Reset only the intended disposable seed/database artifacts during installation. A later process restart must preserve the app's saved data; installing fresh and restarting are different operations.
- Commit source and the built assets actually served. Test the packaged implementation, not an uncommitted dev server that renders a different build.

The golden is one correct implementation. Its incidental choices, such as route shapes, labels, indentation size, scroll containers, coordinate bases, card colors or keyboard escape sequence, are not requirements unless the public task asks for them.

## 6. Authoring and difficulty: step-by-step

### A. Establish the baseline

Inspect the downloaded task/archive, current template and any actual run evidence. A downloaded starting ZIP is advice/source material, not a finished accepted task. Extract it into a bounded location and check archive shape. Record the initial source and intended product before editing. Use successful reference tasks to study clear contracts and evidence; do not import their marketplace wording, old harness or arbitrary verifier assumptions.

Before extensive work, confirm the chosen task and feature scope with the user's available context. Routine fixes are already within an authoring assignment; do not ask permission repeatedly. Unknown product choices that materially affect scope can be clarified while independent work continues.

### B. Write a natural, precise product request

Explain who needs the app and what must work, in normal product language. Use short desk notes where useful. Being natural does not mean hiding requirements or making promises vague. Avoid a prose transcription of test steps, rubric IDs, probe addresses, expected score, evaluator names, or expressions such as "verifier files" in agent-facing notes.

Every requirement needs a reason in the product. Specify tricky semantics plainly: what survives a reload, what a stale save must preserve, whether title comparison is case-sensitive, what Stop means after completion, and which budget applies to a later interaction. Do not turn ambiguous text into a stricter hidden judge interpretation.

### C. Build a traceability ledger outside the submitted task

For each mandatory outcome record: public file/section, criterion ID, scenario/setup, observable pass/fail evidence, golden feature, and measured test evidence or an explicit gap. Review both directions:

1. A requested behavior must not be left ungraded.
2. A graded demand must not be absent from the public request.

Architecture promises need special care. Browser roundtrips can distinguish shared persistence from localStorage, but cannot prove that the backend specifically uses SQLite or Express, or absolutely prove that a server never evaluates source. Do not invent private-source inspection in a browser-only judge. Separate mandated shared-profile assurances from unnecessary task-added constraints and record any unresolved assurance-policy conflict.

### D. Put difficulty in useful stateful behavior

Good sources of difficulty include stale revisions, lost-update prevention, overlapping operations, server-enforced validation and atomicity, immutable historical receipts, asynchronous errors with correct source locations, bounded cancellation, recovery after failure and genuine process-restart durability. Choose the ones natural to the product.

Keep the total scope bounded. Adding many individually graded details can exceed the unchanged 9000s functional budget even when each one is reasonable. Reduce redundant navigation and share scenario setup. If scope must shrink, change the public request, rubric and golden expectation together with the user's direction; never silently delete checks for requirements still promised. Do not weaken requested complexity merely to hide false failures.

### E. Write fair, efficient criteria

- Score one coherent outcome per binary criterion. Setup/actions/readbacks can jointly prove that outcome. Separately useful promises need separate credit even if tested in one browser scenario.
- Share browser observations across criteria without inheriting a sibling's verdict. For example, failed whitespace trimming must not automatically erase collision refusal if ordinary valid writes still establish its control.
- Every negative needs a positive control: show Run/auto-run, a timer, a handler, a valid write or a transport actually works before giving credit for suppressing/refusing something.
- A setup fallback must establish equivalent evidence, not waive a requirement. Retain failure in the row that owns the broken feature. Examples: use a working JS fixture to test Stop if HTML dispatch is broken, while HTML dispatch still fails independently.
- Probe visible product outcomes using the allowed browser tools. Do not inspect hidden execution realms, classify private server code, assume an unstated API URL, or require browser context operations the available tools cannot perform.
- Use observed network requests and equivalent UI paths when route shapes are intentionally unspecified. Preserve positive control, request identity and relevant state when replaying requests.
- Avoid tiny timing distinctions that cannot be observed reliably through LLM tool calls. For cancellation/deadline tests, separate timing boundaries sufficiently and record evidence from the product. Fast automation is not the judge's interaction speed.
- Give each row a clear pass/fail boundary. Prompt, criterion and injected app context must agree on what missing evidence means. Do not introduce contradictory `EVALUATION_INCOMPLETE` branches for ordinary conforming apps.
- Use criterion IDs that do not collide with everyday words in the public instructions; previous IDs like `keyboard` or `timeout` triggered instruction-hygiene checks. Do not change natural product vocabulary merely to conceal a poor ID choice.
- Keep visual criteria visual, use the supported Likert anchors, and avoid charging the same broken mobile layout in both visual and polish. Keep meaningful accessibility/keyboard behaviors scoped and independently credited.

### F. Implement and verify the golden

Implement every public requirement and map it to the ledger. Test valid, invalid, stale, concurrent and recovery paths relevant to the product. Rebuild served assets after source changes. Run under the actual entrypoint, permissions, seed and database arrangement. A browser reload is not process-restart evidence.

Also test deliberate partial apps or bounded mutations. The golden proves a correct implementation can work; partial apps test whether the rubric assigns fair independent credit. Include a dead shell, no-op controls, a missing backend, a broken prerequisite with otherwise working siblings, and a plausible correct alternative where appropriate. Do not modify the real golden to manufacture those failures; use disposable variants with recorded hashes.

## 7. What each level of evidence proves

| Evidence | Supports | Does not establish |
|---|---|---|
| Parse checks, source guards, template-byte comparison | Syntax, known regressions, shared configuration | Full 48 private portal checkers, semantic fairness, Oracle grade |
| Scripted golden browser checks | The exercised app outcomes with that script/environment | LLM interpretation, full judge completion time, visual score |
| Partial-app/correct-alternative tests | Distinguishing outcomes and credit independence for those cases | Exhaustive correctness across all implementations |
| Independent workbook + skill reviews | Source QC judgments and counterexamples for frozen inputs | Hosted acceptance or measurements that were not run |
| Full configured verifier run on golden | Actual Oracle grade and judge/tool behavior for that candidate | A later edited candidate's grade |
| Target-builder run plus configured verifier | Actual model score and failure causes | A guaranteed score on every future run |
| Hosted portal QC | The actual hosted outcome for that upload/version | Universal future agreement |

Get the golden working before treating a low model score as success. If a model scores zero, inspect gating, startup, judge errors, missing logs and reward aggregation before concluding the task is difficult. A timeout or infrastructure failure can masquerade as a model failure. Likewise, a script completing in two minutes cannot justify the LLM judge's 9000s budget.

Paid/provider runs and external uploads require existing user authorization. Preparing local files and running authorized local checks does not implicitly authorize provider spend or Slack messages. Missing access is an evidence gap, not a reason to write a fabricated Pass.

## 8. Run QC with BOTH the workbook and skill

### Default complete review

Freeze the task only after implementation and local tests are coherent:

```powershell
python scripts/qc_pipeline.py prepare projects/<slug> --run <unique-task-date-round>
```

This creates a manifest, frozen inputs, a checklist, preflight results and three reviewer instructions. It does **not** automatically run three models or the private portal checkers.

Launch the generated `reviewer-1.md`, `reviewer-2.md` and `reviewer-3.md` in **three separate parallel agent contexts**. Each must read the actual frozen workbook, skill and references, task and template and review **all 53 quality rows and all 48 deterministic rows**. Different starting perspectives are encouraged, but are not a division of the checklist. Do not let reviewers read each other's findings before finishing. Do not create three reports by rewriting one agent's answer.

Run provided mechanical checks where available; otherwise manually apply the workbook's documented check and label that honestly. The private portal executables are not supplied here. A generated workbook with all rows filled is not evidence that the checks passed.

Each failure needs the offending source anchor, a concrete conforming-app false-fail or defective-app false-pass example, consequence and suggested fix. Use Pass, Fail, Note, N-A with reason, or Not exercised. Do not promote missing evidence to Pass.

Then reconcile the **union**:

```powershell
python scripts/qc_pipeline.py reconcile qc/runs/<unique-task-date-round>
python scripts/qc_pipeline.py export qc/runs/<unique-task-date-round>
```

A credible failure from one reviewer is not outvoted by two passes. A fix changes inputs: freeze a new candidate. A mistaken finding can be refuted on the unchanged candidate only with evidence and an independent confirmation using the documented adjudication format. Keep original reports. Never repeatedly review unchanged bytes until a favorable result appears. Export may produce a report marked BLOCKED; that is not clearance.

### The user's additional one-agent-per-point audit

For Colderwater, the user also explicitly requested **53 separate contexts, one complete quality point per agent**, running up to the available concurrency limit (three workers in that environment). Those per-row audits are separate evidence from the default three full reviews. If asked to repeat that audit, preserve that interpretation: do not divide all rows among three broad reviewers and call it 53 independent reviews.

The default AGENTS.md readiness procedure still requires the three complete reviews. Per-row work is an additional audit when requested, unless the user explicitly replaces that procedure. Keep the deterministic inventory covered as well; 53 quality agents alone do not cover all 48 deterministic checks.

Helpers exist in `qc/prepare_per_row_review.py`, `qc/collect_per_row_review.py`, `qc/per_row_deterministic_review.py`, `qc/finalize_per_row_review.py` and `qc/export_per_row_review.py`. Some contain **Colderwater-specific bindings or adjudications**. Inspect them before use; do not blindly run those helpers against another task. The generic `scripts/qc_pipeline.py` workflow is the reusable starting point.

### Required measurement records

The pipeline requires hash-bound `runtime-evidence.json` records for:

1. `timeouts_fit_the_work`
2. `verifier_image_can_launch_and_grade`
3. `reward_is_graded_not_binary_and_discriminates`
4. `reward_ranking_is_monotone`

Each record needs `observed: true`, the current `input_sha256`, the actual command and an `artifacts` mapping of raw evidence paths to SHA256. Reviewers must assess whether the actual logs support the claim. Schema-valid JSON does not prove the run happened. Do not fill these with scripted timing as a substitute for configured-judge timing. Missing required measurements remain blockers.

## 9. Recurring failures and what we learned

| Failure pattern | Prevention |
|---|---|
| Public promise has no probe; probe demands an unrequested UI choice | Maintain two-way requirement/criterion coverage and review correct alternative implementations. |
| Fix one line and introduce a new interpretation elsewhere | Recheck brief, all prompts, criteria, golden, tools and workload together on the new candidate. |
| Huge protocol with dozens of rows times out and zeros the run | Measure the configured judge, share setup, bound scope; do not increase canonical budgets or assume fast scripts prove completion. |
| A dead feature earns negative-test credit | Establish an actually successful matching positive control. |
| One binary row combines several useful features | Reuse the scenario but award independent outcomes independently. Avoid duplicating full flows merely to split rows. |
| Gate accepts static health/JSON while backend is fake | Require an appropriate real core operation and independent-context readback where shared persistence is required. Do not put advanced edge cases in global gates. |
| Successful app test depends on a source-private assumption | Use supported observable UI/network evidence and publicly required behavior. |
| Global failure caused by hidden source-reading, one-second timing or unavailable context tooling | Design the probe around available tools and a stable observable boundary. |
| Exact secret-file probe addresses appear in public notes | State the product protection goal without enumerating hidden grader fixtures; grade a bounded justified sample. |
| "No networking" applied to a public-network task | Separate app asset/network policy from user-code sandbox policy. Preserve the profile's public networking. |
| Oracle fails because an old DB survives installation or paths depend on CWD | Test clean installation and later restart separately; use app-relative absolute paths. |
| Old source, stale bundle or older ZIP submitted | Bind source, built assets, tests, template, evidence and the final ZIP to exact hashes. |
| Template modified to silence a QC complaint | Restore the canonical file and surface a shared-profile blocker with a reproducible case. |
| Previous PASS treated as proof after edits | Keep candidate/version history. A pass belongs to the bytes and evidence reviewed. |

The increased failure count across Colderwater rounds was not proof of a portal bug. We changed candidates, earlier reviews missed cases, fixes exposed other interactions, and some weaknesses were inherited from shared infrastructure. Identical source **and** rules/checker/runtime inputs with differing verdicts can support a claim of review variability; different uploads with the same check name cannot establish nondeterminism. Preserve hashes, quoted findings, check IDs and counterexamples before attributing cause.

If the portal uses a stronger or different reviewer, practical defenses are independent adversarial review, concrete alternative implementations, measured tool feasibility and raw evidence. An extra authorized review by the same available model can help; it does not replace tests or guarantee agreement. Do not claim we used a model that was not actually available.

## 10. Golden, model, packaging and release sequence

1. Finish the golden and freeze a coherent candidate. Record the requirement ledger and local scripted evidence, including actual restart where relevant.
2. Perform independent source QC using both sources and reconcile every credible finding. Run the requested additional per-row audit when applicable.
3. Obtain full configured judge/Oracle and required reward/workload evidence for the same candidate with authorization. Iterate on confirmed product/rubric defects. Keep infrastructure failures distinct.
4. Measure the target builder with the unchanged scoring contract. Inspect criterion-level results and actual app behavior. If hardening is needed, add justified public behavior and golden support, then invalidate and rerun affected evidence. Do not punish correct implementations just to lower the score.
5. Reconcile against current bytes immediately before packaging. A change to source, workbook, skill, template, checker or review policy invalidates the corresponding clearance.
6. Build the archive with the expected task root: `task.toml`, `instruction.md`, `environment/`, `solution/`, `tests/` visible at the required archive root, not accidental nested archives. Include hidden required files such as `tests/.dockerignore`. Exclude reports, local DBs, caches, credentials and development dependencies.
7. Verify archive integrity, manifest/file list and extracted bytes. Record ZIP SHA256 and source/input SHA256 with the run reports. Inspect the archive's actual content; the filename is not proof.
8. Give the user the exact archive path and honest status. Upload/send only when authorized. Preserve portal results against the exact upload/version and do not spend scarce retries without a reviewed candidate.

Packaging helpers and older ZIPs under `deliverables/` are historical until verified against the current candidate. No current Colderwater upload-ready ZIP is asserted by this handoff.

## 11. Keeping several agents/devices coordinated

- Assign one task owner per branch. Keep task changes scoped to `projects/<assigned-slug>` plus that task's evidence and handoff.
- Use unique QC run names. Freeze before reviewers start; reviewers write only their assigned outputs and do not edit task sources during the audit.
- Share the commit, current input hash, source paths, latest report and unresolved findings in each handoff. "All fixed" without the candidate and evidence is insufficient.
- Before integrating work, inspect `git status` and `git diff`. Preserve unrelated user changes. Never delete unique reports to make the workspace look clean.
- Ordinary local editing and reviews can proceed within the assignment. External messages, task uploads and provider spend require existing authorization. Do not repeatedly seek permission for already-authorized reversible work.
- Keep progress updates concise: what changed, what the evidence shows, what remains uncertain and the next step. Avoid promising that the portal cannot find another issue.

## 12. Exact Colderwater state at this handoff

Source: [projects/colderwater-playground-devtools](projects/colderwater-playground-devtools).

Latest repair candidate: [coldwater-2026-09-30-fairness-fix2](qc/runs/coldwater-2026-09-30-fairness-fix2/REPAIR_REPORT.md).

```text
input_sha256 = 4bc53a3f24e6fa46739f9f07d31b7fb8d8c763e796effa0a5200bbdf430b5867
```

This digest covers the pipeline's task and rules inputs; the manifest also records checker/policy engine hashes. Verify both before reusing evidence.

| Item | Status |
|---|---|
| Current dimensions | 1 Render, 1 Constraints, 64 Functional, 7 Polish, 6 Visual criteria. Functional total weight 32.70; 23 shared protocols. |
| Latest fairness changes | Run-duration observation belongs to its own explicit Run; title-refusal checks can establish controls through valid unpadded writes; completed Stop gets a fresh live control; a bounded JS fixture can establish S03 independently of broken HTML dispatch. |
| Complexity/settings | Those latest fixes changed only the Functional prompt and four descriptions. Public scope, golden bytes, weights and canonical settings were retained relative to the immediately preceding candidate. Earlier accumulated golden/runtime fixes are also included in this push. |
| Scripted golden | 64/64 Functional facts, 2/2 gates, 7/7 Polish facts and 11/11 extra runtime regressions passed. One real restart observed, PID 16 to 345. |
| Focused partial apps | All 10 expected outcome vectors matched, including deliberate failures. A focused case marked pass means the expected distinction was observed, not that its app earned full credit. |
| Script wall times | Golden 126.54s; focused matrix 123.01s. These are not configured LLM judge durations. |
| Targeted review | Three independent targeted fairness/evidence reviews passed. This is not a new complete 53-row audit. |
| Local mechanical evidence | 50 structural assertions, 53 existing source-regression guards and three parse checks passed at that candidate. These are not the 48 private portal executables. |
| Full configured judge / Oracle / Luna / visual grade | Not measured for this candidate. No Oracle 1 or model-score guarantee. |
| Release | **NOT CLEARED**. No new task QC was performed just to write and push this handoff. |

Read the [machine-readable repair results](qc/runs/coldwater-2026-09-30-fairness-fix2/REPAIR_RESULTS.json), [raw golden results](qc/runs/coldwater-2026-09-30-fairness-fix2/golden/run-golden-20260930-113007/RESULTS.json), [focused results](qc/runs/coldwater-2026-09-30-fairness-fix2/golden/focused-20260930-113157/RESULTS.json) and [evidence binding](qc/runs/coldwater-2026-09-30-fairness-fix2/evidence-binding.json). The ten-case matrix is finite; accepted-but-untrimmed title behavior received source review but did not have its own dedicated runtime variant.

The prior complete [postrepair per-row audit](qc/runs/coldwater-2026-09-30-postrepair-audit/per-row-review/RECONCILIATION.md) reported **39 Pass, 9 Fail, 4 Not exercised, 1 Note** for earlier bytes. The still older `hardening/per-row-review/RECONCILIATION.md` open in the user's IDE reported **36 Pass, 11 Fail, 5 Not exercised, 1 Note**. Neither count is a full review of the latest fairness-fix2 candidate. Preserve those originals; do not relabel them green after a targeted fix.

Still unresolved or requiring fresh evidence:

1. **Inherited restart-helper counterexample.** On a different conforming runtime, the canonical helper can time out waiting for the old process, launch a replacement into `EADDRINUSE`, and accept health from the old listener. The golden's successful restart does not refute it. See [inherited counterexample](qc/runs/coldwater-2026-09-30-repair3/inherited-restart-counterexample.json). It affects several QC rows through one shared cause. Seek an approved shared-template fix; do not patch task-local harness bytes.
2. **Shared backend/artifact assurance conflict.** Browser-only outcomes cannot establish every mandated technology or non-evaluation assurance. Record a scoped policy decision or use an approved verification mechanism. Do not claim it proven by roundtrips or add forbidden source inspection.
3. **Missing configured-judge workload, launch and reward measurements.** The four required runtime-evidence rows remain open until actual evidence exists.
4. **Fresh full review after repairs.** Targeted confirmations do not substitute for the next complete frozen audit.

The [handoff integrity record](handoffs/PUSH_VALIDATION_2026-09-30.json) records 446 staged input/evidence hash matches, intact document links and 21 passing QC-orchestration unit tests. These checks validate this transfer, not task acceptance.

The earlier audit also flagged the golden's uncommitted baseline. The commit accompanying this document records the repaired source, served bundle and evidence together. Verify its committed blobs against the latest manifest on the other device. This addresses recording the baseline, not the remaining behavioral/policy findings. Historical reports intentionally retain the status they had when written.

No new app features, shared harness changes, portal uploads or paid runs are part of this documentation/push step. Ridgeline remains available as source/history in the repository, but the user reported someone else claimed it; confirm assignment before restarting work there.

## 13. Copy this prompt into the new Codex instance

```text
You are working in the model-beraking-prompts repository on a separate device.
Assigned task: <task slug and downloaded source location>.
Branch: <task branch>. Work only on this assigned task and its evidence unless a
shared change is explicitly needed and authorized.

Read NEW_DEVICE_TASK_HANDOFF_2026-09-30.md, AGENTS.md, qc/README.md,
qc/REVIEW_POLICY.md, NEW_TASK_AUTHORING_CONTEXT.md and TASK_AUTHORING_WORKFLOW.md.
Read the actual current webdev-task-template. Use BOTH WebDev Rubrics QC.xlsx
(all 53 quality + 48 deterministic rows) and harbor-webdev-rubric-qc/SKILL.md
with its references. Current instructions override historical template advice.

Our goal is a fair, difficult, natural product task with a complete golden app.
The target builder is GPT-5.6 Luna under the recorded local standards; confirm
the actual run selection. The scoring judge is the template's GLM model through
claude-code. Aim for Oracle 1.0; never claim it without a full configured run.
The user prefers meaningful midrange model scores, around 0.4-0.5 when feasible;
do not alter reward policy or invent hidden requirements to manufacture that.
Keep basic gates/polish/visual fair and attainable; put difficulty in requested
stateful functional behavior. Measure model performance instead of promising it.

Inspect the current source and Git status first. Treat the downloaded ZIP as a
starting point. Build a two-way requirement/criterion/golden/probe ledger, then
implement a complete golden solution and fair independent criteria. Preserve
canonical harness files, budgets, judge settings and scoring policy. Task-specific
prompts and criteria are editable. Do not assume the launch CWD is /app.

Test the golden and plausible correct/partial alternatives with positive controls.
Preserve raw commands, hashes, results and actual restart evidence. Local browser
checks are not Oracle grades or judge-timeout measurements. Do not reuse stale
reports, old ZIPs or missing .qc-cache snapshots as current clearance.

Before declaring readiness, use scripts/qc_pipeline.py prepare and run its three
reviewer prompts in three parallel independent contexts, each covering every
quality and deterministic row. Reconcile the union; one credible failure blocks.
If I ask for the additional per-point audit, use 53 separate quality contexts,
not three batches. Preserve original reviews and freeze new bytes after fixes.
Missing runtime evidence must remain explicit. Do not edit shared infrastructure
to silence QC; report an inherited defect with its concrete reproduction.

Keep task source under projects/<slug>, reports/ZIPs outside it. Use unique run
names. Do not upload, message others or spend on provider runs without existing
authorization. Continue authorized local work autonomously. Report what changed,
what was actually tested, remaining blockers and the exact candidate paths/hashes.
```

For a status handoff at the end of work, include: task/branch/commit, input hash, changed files and rationale, criterion counts, current coverage ledger, raw test paths, review outcomes and unresolved counterexamples, measurements still missing, and the exact ZIP hash if one was produced. State the next action explicitly so another agent can continue without reconstructing this conversation.
