# Colderwater coverage repair

The user authorized fixing the concrete gaps found in the last-attempt review. This repair changes the Functional rubric, its browser protocol and the shared judge context. It does not change public requirements, provider configuration, timeout allowances, the score formula, or the golden implementation.

| Finding | Previous evidence | New evidence and scoring |
| --- | --- | --- |
| CSS global isolation | A later JavaScript Run observed a fresh global, which did not establish the preceding CSS state. | Positively identify the authored global before CSS, then observe its absence in the matching current CSS execution state before another Run. Separate 0.10 weight. |
| CSS pending timers | The ordinary CSS copy only observed old scripts/handlers. | A timer actually fires once; queue it again, replace it with CSS while pending, then observe beyond its due time. Separate 0.10 weight; script/handler credit becomes 0.20. |
| Stale Rename draft retention | A replay could prove server refusal while the visible editor discarded unsaved work. | Two real editors, exact dirty fields, actual conflict or deliberate prevention, then deliberate latest/reapply/readback. Split the existing 1.50 into server 0.75 and draft 0.75. |
| Stale Delete draft retention | Same server-only evidence gap. | Equivalent real dirty-editor flow with independent records. Split the existing 1.00 into server 0.50 and draft 0.50. |
| Supported imports | Only JavaScript files exercised the importer. | Exact lowercase JS, HTML and CSS import, own-language edit, Save and reload. Existing 0.60 unchanged. |
| Uppercase extension layers | Import and server Save shared one binary outcome. | Independently observe all three uppercase extensions at each layer. Split 0.20 into import 0.10 and saved filename 0.10. |

There are 93 Functional binary outcomes across the same 37 shared protocols. Every original protocol's weight total is preserved, and the Functional total remains 49.50. The final dimension formula remains 60% Functional, 20% Polish and 20% Visual after gates/floor. More outcome rows do not add reward mass or guarantee any particular model score.

Valid alternatives remain accepted: proactive conflict prevention, deliberately unavailable Rename/Delete while dirty with useful feedback and recovery, optional recovery controls, different layouts, static CSS copies, hidden pending previews, and different execution architectures. Server replays cannot substitute for actual dirty-editor evidence. Positive controls are observed facts, not a requirement that another whole criterion pass.

## Focused browser results

Four disposable offline runs used the exact frozen candidate and pinned browser. The golden passed current CSS global freshness, the controlled pending-timer replacement, exact import/edit/save/load for all six lowercase/uppercase extensions, and actual two-editor Rename/Delete retention and recovery. No golden changes were necessary.

Three deliberately broken variants were detected: preserving the old CSS execution context retained the global and fired the cancelled timer; clearing the editor on conflict lost all three dirty fields while server refusal/recovery still worked; a JS-only importer rejected HTML/CSS while the independently tested uppercase server-save layer still worked. These are scoped observations of the repaired behavior, not 93 fresh end-to-end judge verdicts. The exact authored-realm code block extracted from the final prompt also passed through installed Playwright MCP 0.0.79 using browser_run_code_unsafe over stdio JSON-RPC: the assigned value was observed before CSS and absent in the fresh current CSS realm. This was a separate offline compatibility probe, not an LLM judgment.

The archive has one task root, 50 files, valid CRC, executable shell-file modes and matching extracted hashes. Its SHA-256 is `f86708344b0861aad8a48049996c7b72266c29d6d68bf377358a0c5810aad6ae`. All 23 shipped golden files match the earlier candidate byte for byte.

## Evidence boundaries

The final manifest, mechanical reports, semantic review and focused browser proofs accompany this report. Local source guards are not the private platform checker executables. Scripted browser observations and local RewardKit transport fixtures are not a full LLM Oracle run.

The CSS global probe has a specific observation limit: some virtual execution architectures may not expose their actual authored realm through permitted browser observations. It cannot award an absence from an unrelated frame or fail an app for not using native iframes. After one bounded matching retry, that genuine observation limitation is reported as incomplete. A missing CSS feature, missing current target or observed runtime failure remains a product failure. This limitation is disclosed rather than hidden by implementation inspection.

Full judge timing, Oracle score and target-model score are unmeasured. No paid provider call or platform attempt is part of this repair. The prior coverage Hold is superseded only for the concrete gaps demonstrated by the new source and focused evidence; it is not a guarantee of source-QC acceptance.
