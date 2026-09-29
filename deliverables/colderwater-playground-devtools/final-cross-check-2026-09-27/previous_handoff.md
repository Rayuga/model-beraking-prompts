# Colderwater handoff — 27 September 2026

Current source: `projects/colderwater-playground-devtools/`. This pass fixes the eight latest source-QC findings. It supersedes the metadata-only09f4 archive and earlier interaction/keyboard review conclusions. Ridgeline was not changed in this pass; use its separate handoff.

## Current candidate

- [ZIP](deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/colderwater-playground-devtools.zip): `a017932304e19209de817cdd13070c4e0ff5f8e5b8e2af72eac1078cf53357b1`.
- 50 files, 848,280 bytes; verified one root, CRC, extraction hashes, executable shell modes and LF endings.
- 35 Functional binary criteria / total49.5;2 gates;4 Polish;6 Visual raw1–5 scales.47 task criteria, distinct from53 QC judgments.
- [Summary](deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/QC_FINAL.md), [client-safe workbook](deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/QC_FINAL.xlsx), [final29-check binding](deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/release_validation.json), [manifest](deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/candidate_manifest.json), [exact delta](deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/change_scope.json).

## Repairs

The brief only promised post-timeout usability, so Functional no longer demands host responsiveness while a loop runs. Polish accepts native/standard editor escape without documentation; the golden and an undocumented variant both pass real keyboard navigation. The requested Run/Save/Clear command-shortcut documentation remains.

Two formerly bundled2.5-weight checks each split into1.5+1.0: language dispatch versus delayed interactions, and original-run budget versus pending-interaction budget. Duplicate recovery save/reload work was removed; actual process restart now follows basic save/load. Auto-run negative windows exceed measured positive delay. Stale-save draft preservation requires a real second dirty editor, observed conflict and deliberate recovery; request replay alone cannot substitute for UI evidence.

Public security now explicitly reserves /app.db, /server.js and /package.json. The check observes denial, downloads or a working workspace fallback; the former64KiB source classifier and its exception are removed. The supplied network setup/count/cleanup recipes execute unchanged through actual MCP. Evaluator failure after one retry uses a trusted structured marker and produces an ungraded diagnostic, not a valid partial app score. The UI may still display the fallback zero and require a rerun.

The outer harness EXIT cleanup now has bounded TERM/KILL handling. Its report guard accepts installed RewardKit's legitimate raw-score equivalents while rejecting missing/malformed/inconsistent verdicts and evaluator errors. Canonical Python helpers, scoring, provider environment and budgets are unchanged.

task.toml remains short, with hard difficulty and programming category. The golden badge says Local library. Offline pinned rebuild proves the compiled JavaScript differs from the prior upload only by that badge text; server, runtime and installer are unchanged.

## Evidence and limits

- 90/90 local source assertions and90/90 extracted assertions; actual images match7 public and15 verifier files.
- 21 known-regression guards,15 mutation fixtures including13 bad contracts rejected; guards are enforced in source and extracted packaging.
- 5 shipped keyboard/UI groups plus5 help-removed groups;6 corrected Functional MCP scenarios.
- 15 privacy/network MCP groups plus3 opaque-frame counterexample controls.
- 40 final report-guard cases,4 final orchestration cases and7 cleanup controls (retained by exact cleanup/control-flow binding after the raw-format follow-up).
- [All47 criterion evidence map](deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/golden/GOLDEN_CRITERION_EVIDENCE.json):9 fresh criterion witnesses,0 pending rows, explicit reuse for unchanged behavior. It is not a full current judge run.
- Full53/48 review inventory:45 quality Pass/8 Note;34 deterministic local/manual Pass/10 Note/4 N-A. Private platform checkers were unavailable.

Independent review found no remaining concrete blocker in the inspected source and local evidence. Full paid judging, complete hosted duration, subjective ratings and model calibration remain unmeasured. Oracle1.0 and a model score below0.7 are not guaranteed. Both weight splits alone can restore at most0.03636 deserved final credit above the same floor/gates; other fairness corrections can affect outcomes.

The provider is still claude-code / z-ai/glm-5.3-flashx; builder target gpt-5.6-luna is selected outside task.toml. Keep7200/13200 timeouts, public app networking, one local backend,60/20/20 scoring and Functional strictly above0.05. App CDN permission is separate from authored-snippet network isolation.

No paid call, commit, push or upload was performed. The prior paid-run question remains unanswered in the available session; this handoff does not authorize spending. Existing localhost:3420 preview and its database were preserved; that container still has the earlier preview bundle. Preserve old archives, unrelated work and containers.

Before the next upload/change, use [QC_REGRESSION_PREVENTION.md](QC_REGRESSION_PREVENTION.md), the current authoring context/workflow and [the local rubric skill](harbor-webdev-rubric-qc/SKILL.md). Do not copy superseded classifier, mandatory escape-help,33-criterion or unbounded-cleanup claims from older reports.
