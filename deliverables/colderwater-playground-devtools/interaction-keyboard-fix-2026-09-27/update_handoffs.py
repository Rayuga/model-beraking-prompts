"""Point active handoffs at the final replacement without rewriting old archives."""
import json
from pathlib import Path

out = Path(__file__).resolve().parent
root = out.parents[2]
candidate = json.loads((out / 'candidate_manifest.json').read_text(encoding='utf-8'))
binding = json.loads((out / 'final_candidate_binding.json').read_text(encoding='utf-8'))
assert candidate['sha256'] == binding['candidate_sha256']
rel = out.relative_to(root).as_posix()
text = f'''# Colderwater handoff — 27 September 2026

This is the current Colderwater handoff. It supersedes older candidate and validation snapshots in the master/parallel handoffs. Ridgeline remains separately bound in [its own current handoff](RIDGELINE_HANDOFF_2026-09-27.md); this fix did not modify that task. Read later user messages for authorization and new platform findings.

## Current upload

- Source: `projects/colderwater-playground-devtools/`.
- [Replacement ZIP]({rel}/colderwater-playground-devtools.zip).
- SHA-256: `{candidate['sha256']}`.
- {candidate['files']} files, {candidate['bytes']} bytes, one root; verified CRC, safe paths, extraction hashes and executable LF shell files.
- 33 Functional binary criteria / total weight49.5; two gates; four Polish binary criteria / weight4; six raw1–5 Visual criteria.45 task criteria, distinct from the QC sheet's53 judgments.
- [Current QC report]({rel}/QC_FINAL.md), [client-safe workbook]({rel}/QC_FINAL.xlsx), [candidate binding]({rel}/final_candidate_binding.json), [full evidence index]({rel}/GOLDEN_CRITERION_EVIDENCE.json).

The earlier `d254c73e6ebe…` upload in `cross-check-2026-09-27/` is immutable history. The internal `b9e6ad857823…` draft is preserved under `draft-b9e6ad857823/`; it preceded the final explicit keyboard/input handler coverage. Use the current SHA above.

## Latest corrections

The platform reported two genuine gaps that our earlier review missed. First, the brief did not define whether a completed HTML preview could handle a click after the original five seconds expired. Public behaviour/security notes now distinguish initial Run, unfinished work, later interaction after successful completion, and invalidated execution. A later deliberate interaction gets its own five-second budget; callbacks and additional interactions while work is pending cannot extend it. Stop, failure and replacement invalidate the old execution. Restoring the last-good rendering may produce a static snapshot without live handlers.

Functional language dispatch explicitly observes delayed click, keyboard and input handlers, then confirms CSS does not revive old handlers. Recovery observes an interaction's six-second callback, a second harmless click while pending, timeout without the late marker, rollback and another successful saved Run. The golden runtime already supports these outcomes; no runtime logic was changed.

Second, three Tab stops and Run/Save/Clear shortcuts did not establish pointer-free example/library access. Polish now prepares one harmless saved record independently, then uses keyboard events to leave the editor, select an example, open its own saved record and return to the editor. Native/documented keys, ordinary keyboard-handled warnings and legitimate disabled controls are accommodated. The shared context was corrected to permit only this setup save while preserving existing records and keeping Visual read-only. Functional retains shortcut behavior; Visual retains aesthetics.

The golden already supported Escape then Tab to leave its editor, but did not describe it. Its footer now shows the hint and the editor references it through `aria-describedby`. The pinned TypeScript/Vite build emits `index-XwoWsDAE.js`, SHA `7b8997263bb1fdab556c00198bfaa540507517fc5b12b6b5df35b2c56904c88e`. Server, runtime, styles, dependencies, examples and installer are unchanged. Exact source/build/served correspondence is recorded in `keyboard-evidence-binding.json`.

## Evidence and reuse

Current source and extracted-source audits each pass90 assertions; delta checks preserve all IDs, types, weights, ordering, model wiring, timeouts, gates and scoring. Rebuilt agent/verifier images match all seven public files and15 verifier files. Archive and source hashes match all50 files.

Five fresh keyboard/help groups passed on the delivered bundle:31 actual key events, visible focus, own saved record restored, zero route writes, continued authored execution, and help fitting desktop/mobile in both themes. Five actual installed-MCP interaction groups plus the expanded exact language fixture passed on the final bundle, covering late handlers, original and interaction shared budgets, rollback/recovery, later input and cancelled-callback suppression. The first driver's modal-handling failure is preserved separately; it was an automation issue, not a golden defect. An independent reviewer checked the changed contracts and final evidence.

The report covers53 quality dispositions and48 documented deterministic dispositions, explicitly carrying forward unchanged scopes. The private platform checker implementations were unavailable. This is not a fresh run of every rubric criterion. Unchanged prior browser/runtime/backend/privacy/restart/scorer evidence remains linked with its original scope. The canonical scorer's20 synthetic cases prove arithmetic, not Oracle1.0.

Earlier fixes remain intact: authored-Run and server-library gates; cancellation without an unrequested supersession notice; bounded private-file exposure checks with harmless redirects permitted; debounce-reset and CSS isolation witnesses; independent presentation ownership; and the repaired restart helper that proves old-group exit and replacement-PID liveness. See [previous full review](deliverables/colderwater-playground-devtools/full-qc-2026-09-27/) and [previous restart/privacy cross-check](deliverables/colderwater-playground-devtools/cross-check-2026-09-27/) for unchanged evidence. Do not reuse their superseded ambiguity/keyboard coverage conclusions.

## Measurement and continuation

Keep the staged profile: judge `claude-code` / `z-ai/glm-5.3-flashx`, supplied builder `gpt-5.6-luna`,7200/13200 timeouts, public app network, local backend,60/20/20 shares and Functional strictly above0.05. The authored-snippet network restriction is separate from allowed app CDN assets.

No paid Oracle or target-model score is measured for this candidate. An earlier paid-run permission question remains unanswered in the available session; check for a later explicit reply before making paid calls. This handoff grants no spending or publication authority. Never print credentials or change model routes silently.

All weights are unchanged, but better coverage can affect results. The keyboard criterion contributes 0.05 overall reward; the two changed Functional criteria together contribute about 0.0606 with the same gate/floor outcome. These are conditional arithmetic bounds, not a model forecast. Prior provisional 0.55–0.75 functioning-model expectations remain unmeasured; neither Oracle 1.0 nor a model below 0.7 is guaranteed.

Preserve uncommitted/untracked work, prior archives and unrelated containers. No commit, push or upload was performed. Any further source change needs appropriate new proofs and a new artifact/hash binding. Shared prevention lessons are in `NEW_TASK_AUTHORING_CONTEXT.md` section18 and `TASK_AUTHORING_WORKFLOW.md`.
'''
for before, after in {
    'weight49.5': 'weight 49.5', 'weight4': 'weight 4', 'raw1': 'raw 1',
    'criteria.45': 'criteria. 45', "sheet's53": "sheet's 53", 'pass90': 'pass 90',
    'and15': 'and 15', 'all50': 'all 50', 'bundle:31': 'bundle: 31',
    'covers53': 'covers 53', 'and48': 'and 48', "scorer's20": "scorer's 20",
    'Oracle1.0': 'Oracle 1.0', '`,7200': '`, 7200', 'backend,60': 'backend, 60',
    'above0.05': 'above 0.05', 'section18': 'section 18',
}.items():
    text = text.replace(before, after)
(root / 'COLDERWATER_HANDOFF_2026-09-27.md').write_text(text, encoding='utf-8')
for name in ['TWO_TASK_HANDOFF_2026-09-26.md', 'PARALLEL_AGENT_HANDOVER.md', 'handoffs/COLDERWATER_AGENT_PROMPT.md', 'handoffs/QC_AGENT_PROMPT.md']:
    path = root / name
    lines = path.read_text(encoding='utf-8').splitlines()
    target = '../COLDERWATER_HANDOFF_2026-09-27.md' if name.startswith('handoffs/') else 'COLDERWATER_HANDOFF_2026-09-27.md'
    found = False
    for index, line in enumerate(lines):
        if line.startswith(('**27 September second cross-check update:** Colderwater', '**27 September interaction/keyboard correction:** Current Colderwater')):
            lines[index] = f'**27 September interaction/keyboard correction:** Current Colderwater SHA `{candidate["sha256"]}` (33 Functional criteria, weight 49.5). Read [the current Colderwater handoff]({target}) first. It supersedes all older Colderwater candidate, validation and authorization snapshots below. Older text is historical. Ridgeline retains its separate current handoff and artifact binding.'
            found = True
    assert found, name
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print('Updated current Colderwater handoff and four supersession notices; Ridgeline bindings retained.')
