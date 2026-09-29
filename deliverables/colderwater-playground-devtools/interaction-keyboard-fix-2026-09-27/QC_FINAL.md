# Colderwater interaction and keyboard fixes

Both reported source-level defects are corrected. The earlier local review missed the ambiguous completed-preview lifetime and the mouse-only navigation counterexample; its affected conclusions are superseded. This report does not establish platform acceptance or Oracle 1.0.

## Upload

- [Replacement ZIP](colderwater-playground-devtools.zip): `dc2ed5acde5addbdea6f7d4f49ad2c94e77a0decfccab54573967cb9a1cb4672`.
- 50 files, 846187 bytes; one root; verified CRC, paths, extraction hashes and executable LF shell files.
- Supersedes immutable `d254c73e6ebe…` in `../cross-check-2026-09-27/`.
- Nine existing paths changed and one built JS asset was replaced. Forty files are byte-identical. [Exact delta](change_scope.json).

## Repairs

1. The public notes now say a successfully completed current preview remains interactive. A later deliberate action gets a new five-second budget; interactions and callbacks during pending work do not extend that budget. Stop/error/replacement invalidate old execution, and rollback may restore a static picture. The shared judge context and Functional prompt agree. The language probe waits beyond completion before clicking and typing; recovery also observes the pending interaction deadline and absent late callback.
2. Polish now tests a bounded keyboard route through the editor, examples and its own saved snippet. Normal/documented keys, keyboard-handled warnings and disabled controls are accommodated. Its setup preserves existing records; shared instructions explicitly permit that one save. Functional still owns Run/Save/Clear shortcut behavior, and Visual remains read-only.
3. The golden displays and exposes to assistive technology its existing “Escape, then Tab” editor escape. Only help text/accessible linkage and its rebuilt bundle changed. Runtime, server, styles, dependencies and installer are unchanged.

## Executed evidence

| Check | Result |
| --- | --- |
| Source/extracted source assertions | 90/90 each |
| Intended file/config/criterion delta | Passed; IDs/types/order/weights preserved |
| Golden keyboard/help proof | 5/5 groups; 31 key events; zero page errors |
| Actual installed-MCP interaction proof | 5/5 groups plus expanded exact language fixture on final golden bundle |
| Agent/verifier image contents | Exact 7 public inputs / 15 verifier files |
| Archive/current source hashes | 50/50 matched |
| 53 quality dispositions | {'Pass': 46, 'Note': 7}; unchanged scopes explicitly carried forward |
| 48 documented deterministic dispositions | {'NOTE': 11, 'PASS': 33, 'N-A': 4}; local/manual equivalents |

Read [independent focused review](FOCUSED_INDEPENDENT_REVIEW.md), [keyboard proof](KEYBOARD_RECHECK.md), [interaction proof](interaction-mcp-results.json), [expanded language proof](language-mcp-results.json), [current binding](final_candidate_binding.json) and [criterion evidence index](GOLDEN_CRITERION_EVIDENCE.json). The old harness/scorer/privacy and unchanged product witnesses remain linked with their original scope. They were not rerun or relabelled as fresh. Both changed-flow proofs used the exact final golden bundle. The initial MCP driver's modal-handling failure is retained as diagnostic history and does not describe a product failure.

## Scores and remaining limits

All 33 Functional criteria retain total weight 49.5; four Polish and six Visual criteria retain their weights. The 60/20/20 formula, functional floor, gates, models and timeouts are unchanged. The changed keyboard criterion contributes 0.05 overall reward; the two changed Functional criteria together contribute `0.6 × 5 / 49.5 ≈ 0.0606`. These are conditional contribution bounds with the same gate/floor outcome, not predicted score changes. Floor crossings must be considered separately.

There is no new measured Oracle or target-model score. Local golden observations passed the affected checks, but complete paid judging, subjective aesthetics, full-suite timing and the platform's private checkers remain unmeasured. The earlier provisional 0.55–0.75 functioning-model estimate is not validated by this repair. No guarantee of Oracle 1.0 or a model score below 0.7 is made. No paid call, commit, push or platform upload was performed.
