# Colderwater interaction contract and keyboard coverage recheck

The two latest screenshot findings were real. Earlier broad coverage/no-ambiguity conclusions for archive `d254c73e6ebe94b2001ed782b136707c9cc3c5391c35c0bcd7fd66705d0c8a25` were too strong. This report supersedes those conclusions for these scopes; it does not erase prior evidence.

## What was wrong and what changed

The old public brief only described one five-second run and “active run” updates. Its HTML-handler criterion nevertheless expected a completed preview to respond later. A reasonable implementation could retire that old context after its first deadline and fail the criterion. `environment/instructions/behaviour.md:11` and `environment/instructions/security.md:3` now explain that the current successful execution remains interactive, a deliberate later action starts a fresh bounded interaction, and pending work never gets its deadline extended. Stopped, failed and replaced contexts remain dead. `environment/instructions/behaviour.md:13` explicitly permits static rollback so the fix does not accidentally require reviving old handlers.

`tests/scored/functional/judge.toml:46` now observes delayed click, keyboard and input handlers after completion. The input is focused before its six-second idle wait: clicking it immediately before typing would let an incorrect click-only implementation mask broken keyboard/input handling. The following CSS leg observes all three handlers removed and does not require any particular retained input value. `tests/scored/functional/judge.toml:476` checks a six-second callback started by a new interaction. Another click while it is pending must not unlock that callback; timeout, rollback, absent late output and successful saved recovery are observed together.

The keyboard coverage omission is handled in the companion `KEYBOARD_RECHECK.md`. Polish now performs a bounded real keyboard route from the editor through examples and a dedicated saved snippet and back. It permits documented editor escape keys and native focus styling; it does not regrade shortcuts or persistence. The golden only needed an Escape-then-Tab help/accessible-description change. This subtask changed no golden runtime code.

## Fresh browser evidence

- `interaction-mcp-results.json`: five groups passed through installed Playwright MCP0.0.79 and Chromium152.0.7977.8, with network disabled and a fresh disposable golden process. Original four-second delayed loop timed out4998ms after Run. The new interaction's second click occurred2177ms after its first click while status was Waiting; timeout was5200ms after the first click. Its six-second callback never appeared, the previous render returned, and the original saved snippet still loaded and ran. Late keyboard/input and stopped/replaced callbacks passed too.
- `language-mcp-results.json`: exact final expanded HTML fixture passed. Delayed click at6102ms after observed completion; focused keyboard/input after6107ms idle; one marker for each. CSS retained no old handler or repeated script; fresh JS had no prior global. Only this affected group was repeated after its fixture expanded.
- Runtime SHA256 `d2fc0471003dd6a2107918be7a2d69f3a96027ec4c56266e6dd9b035a30efd86` equals the prior archive's runtime. Final bundle SHA256 `7b8997263bb1fdab556c00198bfaa540507517fc5b12b6b5df35b2c56904c88e` is the current help-only build and matches both successful MCP proofs.
- `interaction-mcp-attempt1-modal.json` retains the first external driver's failed result parsing. MCP returned an actual discard-dialog state instead of a completed result. The corrected driver uses `browser_handle_dialog` through the protocol and retrieves the continuing callback's observations. This was a proof-driver limitation, not an application timeout failure.

## Fairness, score and limits

The added timer leg uses ordinary supported source. A reset-on-second-click bug would let the six-second callback finish inside its wrongly extended deadline, so its visible success cannot masquerade as the required timeout merely because the outer observation allowance is eight seconds. Positive controls and pending-state observations prevent absence-only passes. The prompt allows one repeat if automation misses the pending setup window.

There are still33 Functional criteria with total49.5, four Polish criteria and six Visual criteria;45 overall including two gates. No criterion IDs, weights, gates or scoring arithmetic changed. These are clearer public requirements and stronger observations, not eased bars. Conditional on the same gates/floor outcome, the two changed Functional criteria together represent `0.6 * 5 / 49.5 = 0.060606...` reward; the changed Polish criterion represents0.05. This is a contribution bound, not a predicted model-score change. The fixed Functional floor can introduce a larger discontinuity near its threshold.

`semantic-coverage.json` maps the changed promises both ways. `qc_semantic_scoped_findings.json` enumerates all53 quality and48 deterministic sheet entries and distinguishes this subtask's changed-scope evidence from unexercised whole-task checks. The coordinator's final report owns complete image/harness/archive checks and evidence reuse. No paid Oracle, target-model run or proprietary platform QC was run here; browser success does not guarantee future judge acceptance or an Oracle reward of1.

## Frozen owned files

- `environment/instructions/behaviour.md`: `b20fb10d3eb372cd2b77fc247a3c37fe364a227737742eaa93704e5938c2902a`
- `environment/instructions/security.md`: `da12801813e41b9a31039ec3fd33c3be47721da9d1b64564e33127fb302a6e72`
- `tests/scored/functional/judge.toml`: `e9841a72c9ec23bdbed03d4837649c1970bd5b28f1afee417f9ca0f3a028040f`
- `tests/scored/functional/prompt.md`: `90c9c14fa9b96279d82cbe6f8ea8a12d32d0409a7537f2edab9fb4d36c68035f`
