# Colderwater criterion label crosswalk

This candidate changes only six criterion `id` and matching `name` values in `tests/scored/functional/judge.toml`. Every description, type, weight, criterion position, judge setting, prompt, instruction, asset, golden file and harness file is unchanged. The independent review proved the literal diff consists of exactly twelve label lines; the other 49 task files are byte-identical.

| Previous evidence label | Current label | Functional position |
| --- | --- | ---: |
| `timeout` | `cw_execution_budget_termination` | 5 |
| `rename` | `cw_title_change_uniqueness` | 16 |
| `duplicate` | `cw_independent_snippet_copy` | 17 |
| `themes` | `cw_theme_switch_legibility` | 21 |
| `keyboard` | `cw_keyboard_shortcut_actions` | 22 |
| `persistence` | `cw_process_restart_durability` | 24 |

Use this crosswalk when reading the preserved [fairness ledger](../hardening-2026-09-26/FAIRNESS_LEDGER.md) and [golden frontend coverage](../hardening-2026-09-26/GOLDEN_FRONTEND_VALIDATION.md). All other criterion identifiers are unchanged. Those documents and their runtime results remain historical evidence; they were not silently rewritten to imply a new test execution.

The previous semantic hygiene PASS was incomplete and was disproven by the platform static failure. Six ordinary product words were also criterion IDs, causing nine case-insensitive whole-token matches in public prose. No actual grader instructions were exposed, but the platform's literal collision rule still failed. The correction gives those private labels distinctive names while preserving the natural public requirements.

The independent scan covers all 36 current criterion IDs against all seven public files: zero remaining matches. This reproduces the reported collision class; it is not execution of the unavailable private platform checker or a guarantee of upload acceptance.

Previous candidate: `3d81cf152460f05677c33b5f0e067605338393b9817c92c5f87e0bdf1f745f8c`. Corrected candidate: `d250db516a70255c4c0ea05f8f5dff12ed3c94021625878bf7c3285b95dd7da0`.
