from pathlib import Path
import hashlib
import json
import os
import tomllib

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
BASE = ROOT / 'run-outputs/patchpad-editor-v2'
TASK = ROOT / 'projects/patchpad-editor-v2'
runs = []
with __import__('zipfile').ZipFile(OUT / 'before-oracle-reliability.zip') as archive:
    original = {dim:tomllib.loads(archive.read(f'patchpad-editor-v2/tests/{dim}/judge.toml').decode('utf-8')) for dim in ('render','constraints','functional','polish','visual')}
for result_path in sorted(BASE.glob('*/patchpad*/result.json')):
    trial = result_path.parent
    result = json.loads(result_path.read_text(encoding='utf-8'))
    agent = result['agent_info']
    model = (agent.get('model_info') or {}).get('name')
    reward = json.loads((trial / 'verifier/reward.json').read_text(encoding='utf-8'))
    record = dict(run=trial.parent.name, trial=trial.name, agent=model or agent['name'],
                  task_checksum=result['task_checksum'], reward=reward,
                  exception=result.get('exception_info'),
                  evidence=os.path.relpath(trial, OUT).replace('\\','/'))
    details_path = trial / 'verifier/reward-details.json'
    if details_path.exists():
        details = json.loads(details_path.read_text(encoding='utf-8'))
        record['dimensions'] = {}
        for dim, body in details.items():
            expected = {c['id']:c for c in original[dim]['criterion']}
            assert len(body['criteria']) == len(expected)
            for criterion in body['criteria']:
                ref = expected[criterion['id']]
                assert criterion['description'] == ref['description']
                assert criterion['weight'] == ref['weight']
            record['dimensions'][dim] = {'score':body['score'], 'criteria':[
                {k:c.get(k) for k in ('id','value','raw','weight','reasoning')} for c in body['criteria']]}
        record['functional_passed'] = sum(c['value']==1 for c in details['functional']['criteria'])
        record['rubric_matches_prior_upload'] = True
        expected_reward = 0.0 if reward['render']<=0 or reward['constraints']<=0 else round(0.6*reward['functional']+0.2*reward['polish']+0.2*reward['visual'],4)
        assert expected_reward == reward['reward']
    if agent['name']=='oracle':
        artifact = trial / 'artifacts/app'
        comparison = {}
        for file in (TASK / 'solution/app').rglob('*'):
            if file.is_file():
                name = file.relative_to(TASK / 'solution/app')
                comparison[name.as_posix()] = file.read_bytes() == (artifact / name).read_bytes()
        assert all(comparison.values())
        record['golden_source_matches_exported_app'] = comparison
    runs.append(record)
assert len(runs)==5 and len({r['task_checksum'] for r in runs})==1
(OUT / 'run-analysis.json').write_text(json.dumps(runs,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
text = ['# PatchPad Oracle and model run review', '',
        'Reviewed all four supplied run folders: one Oracle, one no-op and three model trials.',
        'All five trials identify the same platform task checksum. All 39 recorded criterion',
        'descriptions and weights match the Docketlight-weight upload before this repair.',
        'The exported Oracle app is byte-identical to the current golden app.', '',
        '| Submission | Final reward | Functional | Functional passes | Polish | Visual |',
        '| --- | ---: | ---: | ---: | ---: | ---: |']
for r in runs:
    scores=r['reward']
    text.append(f"| {r['agent']} | {scores['reward']:.4f} | {scores['functional']:.4f} | {str(r.get('functional_passed','not graded')) + ('/27' if 'functional_passed' in r else '')} | {scores['polish']:.4f} | {scores['visual']:.4f} |")
text += ['', '## Oracle diagnosis', '',
    'Oracle scored 0.8877, with Render, Constraints and Polish all 1.0. Three',
    'Functional checks lost 2.5 of 20.75 criterion-weight units. All three pass',
    'a fresh local browser reproduction against the unchanged exported/golden code:', '',
    '- Tab: the judge reported a result-assembly exception that lost intermediate text. Separate persisted checkpoints reproduce the full Tab, Shift+Tab, Undo and Redo sequence successfully.',
    '- Autoscroll: the judge reported real scrolling and ALPHA-0010 through ALPHA-0060 selected, but rejected its own gutter starting point. The brief does not forbid a supported gutter selection. Local real glyph-start drag and exact 51-line keyboard selection both pass.',
    '- Clipboard: the judge cut EXTERNAL-C instead of targeting EXTERNAL-B plus its tab and CELL. The corrected setup selects that exact second line; paste, copy, cut, one Undo, whole-document copy and reload discard all pass locally.', '',
    'These are evidence/procedure failures in the supplied Oracle reasoning, supported by the local reproductions. Native judge tool-call transcripts were not included, so this review cannot reconstruct every original action independently.', '',
    'Visual scored 0.8: typography, spacing, hierarchy and craft were each rated 4/5, while colour was 5/5. RewardKit 0.1.7 normalizes raw 4 to 0.75, not 0.8. The judge described a cramped preview, weak report-section hierarchy and blank lower scroll space. Local screenshots support the preview concern. These visual findings are not erased or reclassified as judge errors.', '',
    'If the three Functional checks pass on a fresh judge run and all other scores stay unchanged, the arithmetic would be 0.6*1 + 0.2*1 + 0.2*0.8 = 0.96. This is a conditional calculation, not a new Oracle score or a guarantee of platform acceptance.', '',
    '## Model analysis', '',
    '### Gemini 3.7 Flash — 0.5678', '',
    'Passed 14/27 Functional checks. The judge explicitly missed initial list and dirty-state evidence, skipped Undo before the Delete leg, failed tail/middle setup, and replaced NEXT on line 19 instead of line 18. Those verdicts do not establish the corresponding product defects. Unicode and Find failures also involved toolbar focus or stale selection. Some drag and multi-caret results used wrong glyph positions. Restore/Undo was reported incorrect, but without a native action trace its cause remains uncertain. Visible history overflow was independently identified by both Polish and Visual; the exported layout should be investigated as a product defect. No corrected model score is claimed.', '',
    '### Claude Haiku 4.5 — 0.3033', '',
    'All 27 Functional verdicts were zero, but the reasons are mixed. Clear defects include incorrect seed expansion (ALPHA-1 instead of ALPHA-0001), doubled typing/movement/deletion, failed clipboard insertion, and a revision preview exception. Exported source corroborates these: src/db.js ignores generatedLineNumberWidth; the hidden input and its ancestor both route keydown to handleKeyDown without stopping propagation; the constructor sets this.previewRevision=null, shadowing the method of the same name. The hidden textarea alone is not a constraint violation when only used as keyboard plumbing. Later API/restart checks were unverified after Playwright transport failure, not demonstrated server failures. Its roughly 30% reward came entirely from Polish and Visual, illustrating the outstanding score-floor concern; it does not establish that every workflow was broken.', '',
    '### GPT-5.4 mini — 0.5291', '',
    'Passed 7/27 Functional checks. Clear defects include unpadded seed markers and accepting string baseRevision; server.js explicitly expands with String(i) and coerces numeric strings in parseInteger. The reported final invalid-save probe returned HTTP 200. Other zeros were caused or complicated by lost dialog/checkpoint evidence, typing on the wrong line, clipboard commands while a Find button had focus, and incomplete restart observations. Multi-caret and restore failures need a valid focused reproduction before being called confirmed product defects. Low score alone is not evidence that all these features are absent.', '',
    '### No-op — 0', '',
    'The no-op submission returned reward 0 with graded=0 and no_op=1; it was not a complete 39-criterion judge evaluation.', '',
    '## Changes and validation', '',
    'Only three Functional descriptions and the shared Functional prompt changed. They now use numbered steps, immediate plain-text checkpoint capture, verified focus/targets, supported gutter anchors for offscreen selection, and one bounded restart of a demonstrably invalid unsaved-only judge attempt. An observed app failure cannot be retried into a pass; saved/API/restart criteria cannot use that recovery.', '',
    'All IDs, individual and judge weights, 39 criteria, runtime, golden code, brief, Visual rules and final gated 60/20/20 formula are preserved. The first four fairness fixes remain. Other previously deferred design/keybinding assumptions remain deferred.', '',
    'Local browser evidence: oracle-three-results.json, oracle-checkpoints.json and oracle-three-failures.cjs.log. This uses a cached Linux verifier image with real Chromium keyboard, mouse and clipboard operations, on a fresh disposable app and without network access. It is not a full LLM Oracle run. The configured OpenAI credential is unavailable in the local environment, so a fresh complete Oracle must run on the platform.', '',
    'The archive passes 108 local structural checks and exact preservation/ZIP validation. Local checks cannot certify the platform semantic rubric review.', '',
    '## Complete criterion evidence', '',
    'The following are the exported judge observations, not silently revised verdicts. Full scores, weights and provenance are also in run-analysis.json.', '']
for r in runs:
    text += ['### '+r['agent'], '', f"Run: `{r['run']}`; [original trial]({r['evidence']}/result.json).", '']
    for dim,body in r.get('dimensions',{}).items():
        text += ['#### '+dim, '']
        for c in body['criteria']:
            text.append(f"- **{c['id']}** — {c['value']}: {c.get('reasoning') or 'No reasoning supplied.'}")
        text.append('')
(OUT / 'RUN_REVIEW.md').write_text('\n'.join(text)+'\n',encoding='utf-8')
print('Reviewed all five trials; original scores and all 156 graded criterion verdicts preserved.')
