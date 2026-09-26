---
name: harbor-webdev-rubric-qc
description: QC a staged webdev RL task against the WebDev Rubrics QC workbook — 53 quality checks plus the deterministic checker list. Use before delivery, after a task is built or reworked on the staged layout (tests/gates + tests/scored, scoring.toml, tools/score.py), or when asked to review one of these tasks' instruction fairness, verifier wiring, rubric coverage, or reward soundness.
metadata:
  short-description: QC a staged webdev task against the 53-check rubrics workbook
---

# WebDev rubric QC

You are the last review before a staged webdev task ships. Decide, per check, whether the task measures the **submission** or the **harness** — a defect that attributes our own failure to the model is the most expensive one to miss, and a finding that isn't real costs nearly as much.

The rubric is `assets/WebDev_Rubrics_QC.xlsx` and it is authoritative: `Quality Checks` defines the 53 judgement checks, `Deterministic Checks` defines the mechanical checkers. Read both sheets completely before judging, and enumerate them with `scripts/list_checks.py` so none is silently skipped. The workbook also carries an `Internal Quality Checks` sheet with the team's own annotation of the checks — read it for interpretation, but never ship it to a client.

## Scope

Target the **staged** layout: `tests/gates/{render,constraints}` plus `tests/scored/{functional,polish,visual}`, `tests/scoring.toml`, `tests/tools/{score.py,restart_mcp.py}`, `tests/app_context.md`. [references/staged-task-contract.md](references/staged-task-contract.md) has the full closed file list, the frozen `[verifier.env]` block, and every cross-file agreement the checks enforce.

A task holding `tests/reward.toml` is the **retired dimensions layout**. The workbook still covers it (several checks are NOTE-only passes there), but only the retrofit checks apply — say so rather than forcing staged checks onto it.

Review-only by default: report, do not edit the task. Fix only when the user asks for a fix pass.

## Delivery profile

This project has explicit rules that override generic QC instincts. Apply them consistently and record any conflict instead of silently choosing a side:

- Network is **public** in both phases. `network_mode = "public"`, CDN or off-origin browser assets, an open verifier network, and a missing `allowed_hosts` allowlist are all correct. Never report them.
- Judge is **`claude-code`** with **`z-ai/glm-5.3-flashx`** through OpenRouter, wired by the frozen `[verifier.env]` block. A `judge = "claude-code"` fallback inside a `judge.toml` is expected; a model, reasoning effort, temperature, or weight there is a defect.
- Reward is **shaped** — functional 0.6 / polish 0.2 / visual 0.2 — behind two zero-weight gates and a functional floor.
- Org is `turing` for staged tasks.

## Two layers, in this order

1. **Deterministic layer** — apply every checker in `Deterministic Checks`: run it when the harness provides it, otherwise apply its documented behaviour by hand. These are mechanical and must not be hand-waved. [references/deterministic-checks.md](references/deterministic-checks.md) covers how to apply them, which are NOTE-only or overrides, and the manual procedure for the ones that carry the most weight.
2. **Judgement layer** — all 53 quality checks, each with a verdict. [references/quality-checks.md](references/quality-checks.md) gives the verification procedure per check, keyed by the workbook's check ids.

## Verdicts and severity

Per check: `Pass`, `Fail`, `Note` (real but not a defect), `N-A` (with the reason), or `Not exercised` (no run touched it).

Severity anchors on consequence, not interest:

| | Meaning |
|---|---|
| **P0** | Blocks delivery. Grading is wrong, a real secret or rubric file is exposed, the golden fails its own verifier, or the task cannot be scored. |
| **P1** | Materially distorts scores or the client will notice. Fix before shipping. |
| **P2** | Real but bounded. Fix when convenient. |
| **P3** | No observed impact; latent robustness only. |

A finding the runs refute cannot stay P0 or P1: drop it and rewrite the text to say what the runs showed. A finding with no runs to check it against keeps its severity but is marked `Not exercised`.

## Evidence standard

- Quote the offending line. Cite `path:line` when you are sure and `path:section` when you are not — never invent a line number.
- Every check gets a verdict, including `N-A`. An unanswered check is an unfinished review.
- For every Fail, state what a model could do to be graded wrongly or what the client would see, then give a fix that fits in a sentence.
- Where runs exist, add a per-finding run verdict: `CONFIRMED` (quote the observation), `REFUTED`, `PARTIAL` (say which half), or `NOT EXERCISED`.
- Never upgrade an unmeasured claim to Pass. Say what the task does well as well — a report that only lists problems reads as noise.

## Known false positives

Do not report these; they waste the client's time and devalue the real findings.

- **Sign-in that the brief never asked for.** These products ship an identity or account surface by house convention, so a criterion that signs in is not "grading the unrequired" (checks 23, 27). Flag only when no usable identity surface exists and a criterion depends on one.
- **One criterion covering a whole flow.** Criteria deliberately bundle several interacting rules into one conjunctive bar; that is not duplication between them (checks 26, 28, 33). Independence means no two criteria grade the same observable or demand incompatible products — not one rule per criterion.
- **Likert versus weighted.** The internal note says scoring practice is binary plus weights, while the shipped visual dimension uses `type = "likert"` with `points = 5` and described anchors. Judge check 41 against the shipped format: flag craft criteria that are binary (lost gradation) or likert blocks with missing anchors, not the presence of likert.
- **Credentials the profile expects.** Demo passwords in the brief and `${VAR}` templates in `task.toml` are intentional. Flag real secrets or personal data in seed data, the solution, or the agent image — and treat a live credential in `task.toml` as a delivery-time strip, not an authoring defect (check 52).
- **`coverage.json` and `seed_data.json` flagged as stray files** (check 50) are a known checker false positive under review. Report them as `Note`, never as blockers.
- **Legacy-shape no-ops.** `check-reward-schema.py`, `check-reward-weights.py`, `check-rubric-segments.py`, `check-app-manifest.py` and `check-canary.sh` pass by design on staged tasks.

## Workflow

1. **Orient.** Map the task tree, confirm staged versus legacy, locate the shipped ZIP and any runs. Count criteria per dimension and reconcile against any count quoted in a description. Read the two rubric sheets and enumerate them with the script.
2. **Deterministic layer.** Apply every checker, recording its real output verbatim when it runs.
3. **Structure and wiring** — blocks B, C and the structural half of E: identity, network posture, frozen verifier block, timeout nesting, Dockerfiles, scoring policy, judge schema, prompt resolution.
4. **Semantic layer** — blocks A, D and F: instruction fairness against criteria coverage against reference coverage, then the cross-file runtime contract and the closed folder list.
5. **Report.** Build it with `scripts/build_report.py`, then inspect the result: every check answered, no verdict contradicting its own evidence, no refuted item sitting at P0/P1, every quoted count re-derived.
6. **Deliver.** The completed XLSX plus a short summary of gate status, strongest evidence, blockers, and anything unmeasured. Strip the `Internal Quality Checks` sheet when the report leaves the team.

## Bundled resources

| File | Read when |
|---|---|
| `assets/WebDev_Rubrics_QC.xlsx` | Always — the authoritative checks and the reporting base |
| `references/staged-task-contract.md` | Before judging structure, wiring or the cross-file contract |
| `references/quality-checks.md` | The judgement layer — how to verify each of the 53 checks |
| `references/deterministic-checks.md` | The deterministic layer — how to apply each checker |
| `scripts/list_checks.py` | Enumerating checks so none is skipped |
| `scripts/build_report.py` | Building the deliverable workbook from a findings JSON |

Both scripts need `openpyxl`; the bundled workspace Python already has it. `build_report.py` refuses to write a workbook whose findings do not answer every check, so a passing build is itself evidence that the review was complete.
