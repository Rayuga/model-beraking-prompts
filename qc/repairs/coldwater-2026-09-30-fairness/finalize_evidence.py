"""Bind completed scripted repair evidence without claiming a configured grade."""
from pathlib import Path
import hashlib
import json
import sys
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[3]
base = root / 'qc/runs/coldwater-2026-09-30-fairness-fix2'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = read(base / 'manifest.json')
sys.path.insert(0, str(root / 'scripts'))
from qc_pipeline import verify_frozen
assert not verify_frozen(base, manifest)
golden_path = base / 'golden/run-golden-20260930-113007/RESULTS.json'
focused_path = base / 'golden/focused-20260930-113157/RESULTS.json'
golden, focused = read(golden_path), read(focused_path)
inputs_path = base / 'golden/frozen_repair_inputs.json'
inputs = read(inputs_path)
assert inputs['round_input_sha256'] == manifest['input_sha256']
assert golden['passed'] and not golden['missing_fact_keys'] and not golden['failed_fact_keys']
assert len(golden['fresh_fact_keys']) == 64
assert focused['passed'] and len(focused['cases']) == 10
assert focused['round_input_sha256'] == manifest['input_sha256']
for record, path in [(golden, golden_path), (focused, focused_path)]:
    assert record['manifest_sha256'] == sha(inputs_path)
    for name, digest in record['driver_sha256'].items():
        assert sha(path.parent / 'drivers' / name) == digest, name
expected_app = {p[4:]: h for p, h in inputs['solution_files'].items() if p.startswith('app/')}
assert golden['actual_app_files'] == expected_app
assert golden['functional_sha256'] == inputs['functional_sha256']
assert golden['prompt_sha256'] == inputs['prompt_sha256']
assert golden['restart']['actual_calls'] == 1 and golden['restart']['pid_before'] != golden['restart']['pid_after']
surface = golden['surface']
assert len(surface['checks']) == 9 and all(row['pass'] for row in surface['checks'].values())
assert len(surface['runtime_edges']['results']) == 11 and surface['runtime_edges']['passed']
reviews = {}
for name in ['targeted-duration-review.json', 'targeted-independence-review.json', 'targeted-evidence-review.json']:
    record = read(base / name)
    assert record['input_sha256'] == manifest['input_sha256']
    reviews[name] = record.get('verdict', record.get('status'))
    assert str(reviews[name]).lower().startswith('pass'), (name, reviews[name])
matrix = []
for case in focused['cases']:
    assert case['passed']
    expectations = case['browser']['expectations']
    assert expectations and all(row['matched'] for row in expectations)
    matrix.append({'case': case['case'], 'expected_observed': {r['key']: r['actual'] for r in expectations}, 'seconds': case['wall_seconds']})
result = {
    'input_sha256': manifest['input_sha256'],
    'status': 'TARGETED_REPAIRS_VERIFIED_RELEASE_NOT_CLEARED',
    'functional_scripted_facts': 64, 'gate_scripted_facts': 2, 'polish_scripted_facts': 7,
    'additional_runtime_regressions': 11, 'focused_cases': matrix,
    'golden_wall_seconds': golden['wall_seconds'], 'focused_wall_seconds': focused['wall_seconds'],
    'restart': {key: golden['restart'][key] for key in ['actual_calls', 'pid_before', 'pid_after', 'wall_seconds']},
    'targeted_reviews': reviews, 'task_scope': read(base / 'change-scope.json'),
    'full_53_review_performed': False, 'configured_judge_executed': False,
    'oracle_score_claimed': False, 'model_score_claimed': False, 'visual_grade_measured': False,
    'completed_utc': datetime.now(timezone.utc).isoformat(),
}
(base / 'REPAIR_RESULTS.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
rows = '\n'.join('| ' + case['case'] + ' | ' + '; '.join(key.split('.')[-1] + ': ' + ('pass' if value else 'fail') for key, value in case['expected_observed'].items()) + ' |' for case in matrix)
report = f'''# Colderwater verifier fairness repairs

**The targeted repairs are verified. Release remains uncleared.** Frozen input: `{manifest['input_sha256']}`.

Only the Functional prompt and four criterion descriptions changed. All 64 Functional criteria, total weight 32.70, 23 protocols, public requirements, golden application bytes, other dimensions, shared harness and budgets are unchanged. This repairs false deductions on partial apps without removing requested features or altering reward policy.

## Before and after

| Check | Earlier | Now |
|---|---|---|
| Successful Run duration | A later preview click started the comparison timer, so preserving the original completed Run duration could fail. | The explicit Run schedules its own four-second timer. A completed Run need not update its duration after a later click. |
| Collision and empty-title refusal | Both depended on padded creation/update succeeding first. | Ordinary unpadded successful writes can establish their own controls. Trimming still fails independently. |
| Completed Stop | Its only positive handler observations came after long waits. | A currently working handler or one bounded fresh immediate-handler fallback establishes Stop's own control; delayed interaction can still fail. |
| S03 language setup | All completed-interaction evidence required HTML dispatch. | If HTML cannot establish a completed preview, an equivalent direct-JavaScript fixture is tried once. Real completion, live handlers and the same idle waits remain required; S02 keeps the HTML-dispatch failure. |

The fourth refinement was caught by targeted independent review of the first repair candidate. That original failure and both frozen candidates are preserved. The title fallback estimate was also corrected from a hard six-action allowance to roughly eight additional actions plus ordinary app dialogs. Planning estimates now total 454 ordinary UI actions, with bounded optional setups and one extra four-second Run. These estimates do not establish LLM-judge completion time.

## Fresh measured evidence

- Scripted golden: **64/64 Functional facts**, **2/2 gates**, **7/7 Polish facts**, **11/11 additional runtime regressions**; no missing required facts.
- One actual process restart: PID {golden['restart']['pid_before']} to {golden['restart']['pid_after']}.
- Ten focused browser cases matched their expected fact vectors, including deliberately failing outcomes. A `passed` focused case means the expected distinction was observed, not that the partial app received a perfect grade.
- Golden script wall time: {golden['wall_seconds']:.2f}s. Focused matrix: {focused['wall_seconds']:.2f}s. Neither is configured judge timing.
- Three independent targeted reviews cover duration fairness, independence/controls, and raw evidence/driver binding. They are not a new 53-row audit.
- All 50 structural assertions and 53 existing source-regression guards pass. Both shell scripts and the server entry parse; these local checks are not the private portal checker suite.

| Focused case | Observed results |
|---|---|
{rows}

The Run-duration-only case actually preserves the short original duration after a working four-second click timer, then passes the repaired Run-duration probe. Padded create-only, update-only and both-failed cases retain collision/empty-title credit while trimming fails. Expired handlers retain Stop credit only after the fresh live control. Broken HTML dispatch recovers S03 through an actually working JS fixture. A dead writer, never-working handlers and constant zero duration receive no corresponding credit.

Raw evidence: [full golden](golden/run-golden-20260930-113007/RESULTS.json), [focused cases](golden/focused-20260930-113157/RESULTS.json), [machine-readable summary](REPAIR_RESULTS.json). Executed driver copies and variant source/bundle hashes accompany those results. Both runtime launches used the cached verifier image `sha256:46fefc505dbcabf0d6cb4e54fea8f0880acde2f7896587750af967427598977d`, offline networking, disposable databases and UID/GID 65534; no provider calls or published ports. Variant builds used the existing pinned local Vite toolchain, with no package install.

Accepted-but-untrimmed titles are handled by actual identity/revision in the protocol and driver and received source review, but no dedicated runtime variant for that branch was executed. This finite matrix is not exhaustive proof over every implementation.

## Remaining boundaries

The inherited restart-helper counterexample, shared backend/artifact coverage-policy conflict, uncommitted golden baseline and missing full configured judge/workload/reward measurements remain unresolved. Shared files were preserved as required by workspace policy. The successful golden restart does not refute the different inherited counterexample. No Oracle 1, target-model score, visual judge grade or portal pass is claimed. No task upload, paid judge, ZIP, commit or push was performed.

Prior [53-point reconciliation](../coldwater-2026-09-30-postrepair-audit/per-row-review/RECONCILIATION.md) is historical evidence for different bytes; its verdict counts must not be relabeled as a complete current-candidate review.
'''
(base / 'REPAIR_REPORT.md').write_text(report, encoding='utf-8')
files = [p for p in base.rglob('*') if p.is_file() and p.name != 'evidence-binding.json']
binding = {'input_sha256': manifest['input_sha256'], 'input_mismatches': verify_frozen(base, manifest),
           'artifacts': {p.relative_to(root).as_posix(): sha(p) for p in files},
           'finalizer_sha256': sha(Path(__file__))}
(base / 'evidence-binding.json').write_text(json.dumps(binding, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': result['status'], 'functional': 64, 'focused_cases': len(matrix), 'reviews': reviews, 'bound_artifacts': len(files)}))
