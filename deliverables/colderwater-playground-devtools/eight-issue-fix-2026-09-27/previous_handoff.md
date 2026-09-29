# Colderwater handoff — 27 September 2026

**Current metadata-only update:** Use [the new ZIP](deliverables/colderwater-playground-devtools/metadata-cleanup-2026-09-27/colderwater-playground-devtools.zip), SHA `09f4f6cb3647f7d8395a4367fa931c1fb2ac56713bc25df431bd10b6a8b88f7e` (50 files, 844239 bytes). Only four descriptive fields in task.toml changed; the other 49 files match the candidate below. Read [the change and validation note](deliverables/colderwater-playground-devtools/metadata-cleanup-2026-09-27/METADATA_CLEANUP.md). The interaction/keyboard fixes and behavioral evidence below remain applicable to unchanged code, but their source/archive hashes are historical. The separately discovered unbounded final-cleanup issue remains pending. Oracle/model scores are still unmeasured.

This is the current Colderwater handoff. It supersedes older candidate and validation snapshots in the master/parallel handoffs. Ridgeline remains separately bound in [its own current handoff](RIDGELINE_HANDOFF_2026-09-27.md); this fix did not modify that task. Read later user messages for authorization and new platform findings.

## Current upload

- Source: `projects/colderwater-playground-devtools/`.
- [Replacement ZIP](deliverables/colderwater-playground-devtools/interaction-keyboard-fix-2026-09-27/colderwater-playground-devtools.zip).
- SHA-256: `dc2ed5acde5addbdea6f7d4f49ad2c94e77a0decfccab54573967cb9a1cb4672`.
- 50 files, 846187 bytes, one root; verified CRC, safe paths, extraction hashes and executable LF shell files.
- 33 Functional binary criteria / total weight 49.5; two gates; four Polish binary criteria / weight 4; six raw 1–5 Visual criteria. 45 task criteria, distinct from the QC sheet's 53 judgments.
- [Current QC report](deliverables/colderwater-playground-devtools/interaction-keyboard-fix-2026-09-27/QC_FINAL.md), [client-safe workbook](deliverables/colderwater-playground-devtools/interaction-keyboard-fix-2026-09-27/QC_FINAL.xlsx), [candidate binding](deliverables/colderwater-playground-devtools/interaction-keyboard-fix-2026-09-27/final_candidate_binding.json), [full evidence index](deliverables/colderwater-playground-devtools/interaction-keyboard-fix-2026-09-27/GOLDEN_CRITERION_EVIDENCE.json).

The earlier `d254c73e6ebe…` upload in `cross-check-2026-09-27/` is immutable history. The internal `b9e6ad857823…` draft is preserved under `draft-b9e6ad857823/`; it preceded the final explicit keyboard/input handler coverage. Use the current SHA above.

## Latest corrections

The platform reported two genuine gaps that our earlier review missed. First, the brief did not define whether a completed HTML preview could handle a click after the original five seconds expired. Public behaviour/security notes now distinguish initial Run, unfinished work, later interaction after successful completion, and invalidated execution. A later deliberate interaction gets its own five-second budget; callbacks and additional interactions while work is pending cannot extend it. Stop, failure and replacement invalidate the old execution. Restoring the last-good rendering may produce a static snapshot without live handlers.

Functional language dispatch explicitly observes delayed click, keyboard and input handlers, then confirms CSS does not revive old handlers. Recovery observes an interaction's six-second callback, a second harmless click while pending, timeout without the late marker, rollback and another successful saved Run. The golden runtime already supports these outcomes; no runtime logic was changed.

Second, three Tab stops and Run/Save/Clear shortcuts did not establish pointer-free example/library access. Polish now prepares one harmless saved record independently, then uses keyboard events to leave the editor, select an example, open its own saved record and return to the editor. Native/documented keys, ordinary keyboard-handled warnings and legitimate disabled controls are accommodated. The shared context was corrected to permit only this setup save while preserving existing records and keeping Visual read-only. Functional retains shortcut behavior; Visual retains aesthetics.

The golden already supported Escape then Tab to leave its editor, but did not describe it. Its footer now shows the hint and the editor references it through `aria-describedby`. The pinned TypeScript/Vite build emits `index-XwoWsDAE.js`, SHA `7b8997263bb1fdab556c00198bfaa540507517fc5b12b6b5df35b2c56904c88e`. Server, runtime, styles, dependencies, examples and installer are unchanged. Exact source/build/served correspondence is recorded in `keyboard-evidence-binding.json`.

## Evidence and reuse

Current source and extracted-source audits each pass 90 assertions; delta checks preserve all IDs, types, weights, ordering, model wiring, timeouts, gates and scoring. Rebuilt agent/verifier images match all seven public files and 15 verifier files. Archive and source hashes match all 50 files.

Five fresh keyboard/help groups passed on the delivered bundle: 31 actual key events, visible focus, own saved record restored, zero route writes, continued authored execution, and help fitting desktop/mobile in both themes. Five actual installed-MCP interaction groups plus the expanded exact language fixture passed on the final bundle, covering late handlers, original and interaction shared budgets, rollback/recovery, later input and cancelled-callback suppression. The first driver's modal-handling failure is preserved separately; it was an automation issue, not a golden defect. An independent reviewer checked the changed contracts and final evidence.

The report covers 53 quality dispositions and 48 documented deterministic dispositions, explicitly carrying forward unchanged scopes. The private platform checker implementations were unavailable. This is not a fresh run of every rubric criterion. Unchanged prior browser/runtime/backend/privacy/restart/scorer evidence remains linked with its original scope. The canonical scorer's 20 synthetic cases prove arithmetic, not Oracle 1.0.

Earlier fixes remain intact: authored-Run and server-library gates; cancellation without an unrequested supersession notice; bounded private-file exposure checks with harmless redirects permitted; debounce-reset and CSS isolation witnesses; independent presentation ownership; and the repaired restart helper that proves old-group exit and replacement-PID liveness. See [previous full review](deliverables/colderwater-playground-devtools/full-qc-2026-09-27/) and [previous restart/privacy cross-check](deliverables/colderwater-playground-devtools/cross-check-2026-09-27/) for unchanged evidence. Do not reuse their superseded ambiguity/keyboard coverage conclusions.

## Measurement and continuation

Keep the staged profile: judge `claude-code` / `z-ai/glm-5.3-flashx`, supplied builder `gpt-5.6-luna`, 7200/13200 timeouts, public app network, local backend, 60/20/20 shares and Functional strictly above 0.05. The authored-snippet network restriction is separate from allowed app CDN assets.

No paid Oracle or target-model score is measured for this candidate. An earlier paid-run permission question remains unanswered in the available session; check for a later explicit reply before making paid calls. This handoff grants no spending or publication authority. Never print credentials or change model routes silently.

All weights are unchanged, but better coverage can affect results. The keyboard criterion contributes 0.05 overall reward; the two changed Functional criteria together contribute about 0.0606 with the same gate/floor outcome. These are conditional arithmetic bounds, not a model forecast. Prior provisional 0.55–0.75 functioning-model expectations remain unmeasured; neither Oracle 1.0 nor a model below 0.7 is guaranteed.

Preserve uncommitted/untracked work, prior archives and unrelated containers. No commit, push or upload was performed. Any further source change needs appropriate new proofs and a new artifact/hash binding. Shared prevention lessons are in `NEW_TASK_AUTHORING_CONTEXT.md` section 18 and `TASK_AUTHORING_WORKFLOW.md`.
