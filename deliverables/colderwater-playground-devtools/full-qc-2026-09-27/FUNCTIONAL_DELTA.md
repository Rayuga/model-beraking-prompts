# Functional changes and score implications

Baseline: archive `998f0ba6831f801686251412a2a7cffb6e38fd5807dae68e08042a7f78bc8686`. Current Functional source SHA-256 is recorded in `functional-crosswalk.json` and `functional-contract-checks.json`; the latter passes **31 fresh checks**. This report describes the owned Functional/public-note changes, not all other presentation/gate/golden edits in the task.

| Criterion | Before | Now | Reason |
| --- | ---: | ---: | --- |
| `fresh_cancel` | 3 | 2.5 | Actual replacement cancellation, isolation, old-output suppression and Stop/rollback remain; a separate supersession notice is optional. Public wording now explicitly ties feedback to Stop. |
| `cw_runtime_files_not_publicly_exposed` | absent | 0.5 | Three bounded browser HTTP probes close representative coverage of the existing internal-file confidentiality promise. Actual private content is required; status/MIME/name/truncation alone never proves exposure. |
| `language_dispatch` | 2.5 | 2.5 | A working log-only handler is clicked before CSS, then must not fire in the copied CSS document. Old-script/global checks stay. |
| `auto_run` | 2 | 2 | Later-edit debounce reset is now actually observed with measured delay/timestamps, alongside existing on/off/queued-cancel/manual controls. |
| `cw_theme_switch_legibility` | 0.5 | 0.5 | Legacy ID retained for traceability. Score actual theme changes and retained working state; remove aesthetic contrast/readability from Functional. |
| Other 28 criterion objects | 41.5 | 41.5 | IDs, names, descriptions, types and weights are exactly identical to the baseline. |
| Total | 32 criteria / 49.5 | 33 criteria / 49.5 | No scored policy, mode, MCP, timeout, environment or normalization change. |

The public notes preserve the existing runtime/product requirements. `behaviour.md` clarifies Stop feedback; `security.md` explains the already-required server entrypoint, manifest and database are private while ordinary public browser scripts are allowed. The Functional prompt permits one narrow HTTP-byte classification exception solely for the new confidentiality criterion. All other implementation-inspection bans remain. Metadata describes 33 criteria, the same 49.5 weight, the bounded coverage and the fact that Oracle/model scores remain unmeasured.

## Exact conditional score analysis

`check_functional_contract.py` derives unchanged-score possibilities from the actual 28 criterion weights, enumerates all changed-behavior assignments and runs the current `tests/tools/score.py` for the extremal examples. See `functional-score-delta.json` and `functional-score-witnesses/`. It runs with bytecode disabled so it does not create a task packaging artifact.

Let C mean real cancellation works, N mean the formerly demanded supersession notice exists, P mean the new bounded privacy probe passes, S mean actual theme switching works, L mean the old aesthetic legibility condition passes, H mean theme state is retained, D mean old dispatch passes, E mean its added handler-removal leg passes, A mean old auto-run passes, and R mean its added subsequent-edit reset passes. The changed raw contribution was:

`3*C*N + 0.5*S*L + 2.5*D + 2*A`

It is now:

`2.5*C + 0.5*P + 0.5*S*H + 2.5*D*E + 2*A*R`

Holding all other outcomes fixed and with both gates and the Functional floor passing before and after, the maximum raw increase is **3.5**: removal of the notice false-negative can restore 2.5, the newly independent privacy behavior contributes 0.5, and removal of Functional aesthetic scoring can restore 0.5. The added CSS/debounce legs only tighten their previous criteria. Theme state preservation may also reduce credit for a broken implementation.

The conditional unrounded reward bound is `0.6 * 3.5 / 49.5 = 0.042424...`. The exact **published rounded bound is +0.0425**. An attainable abstract weighting example with Polish=Visual=1 has raw Functional 2.75→6.25, producing 0.4333→0.4758 in the actual score helper. These are boolean behavior scenarios, not measurements of a candidate.

The floor is discontinuous. An abstract old raw 2.25 (below the strict 0.05 threshold) can become 5.75, changing final reward **0→0.4697** with Polish=Visual=1. This is a mathematical floor-unlock example, not the expected model shift. The new controlled runtime/privacy/working-state observations cannot be assumed passed by an inert shell. Root's separate adversarial gate fixtures are the relevant evidence for that question.

Visual/mobile criterion edits are outside this Functional bound. The task's actual paid Oracle and candidate-model outcomes, full judge duration and likely score band remain unknown until those runs occur. An all-correct golden is mathematically eligible for 1, but local browser success or synthetic harness reward 1 is not an Oracle result.

## Actual evidence, not inferred passes

The fresh supplemental Chromium records prove the changed cancellation, CSS-handler, measured debounce and theme sequences. Actual installed MCP records prove the bounded confidentiality requests, clearly exposed files, SPA/denial/public-code/frontend-manifest false-positive controls and large/unknown responses. The independent fresh restart rerun in `restart-full/` adds a direct equality check between the postrestart write response and a subsequent fresh read of Primary, while retaining the sibling and deletion controls.

`REQUIREMENT_COVERAGE.md` names the actual artifact and record for each public behavior, plus explicit implementation/security observability limits. All evidence stays outside the upload tree. These checks do not replace the independent complete-sheet review or a paid model evaluation.
