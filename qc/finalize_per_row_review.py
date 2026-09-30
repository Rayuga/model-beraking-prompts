"""Assemble the dedicated audit while preserving every original agent report."""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
import argparse, hashlib, sys
import json

root = Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--run',required=True)
args=parser.parse_args()
base=(root/args.run).resolve()
assert base.is_relative_to(root/'qc/runs')
out = base / 'per-row-review'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
save = lambda p, value: p.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
summary = read(out / 'summary.json')
assert summary['dedicated_agents_completed'] == 53 and not summary['missing'] and not summary['invalid']
originals = [read(out / f'rows/{n:02d}.json') for n in range(1, 54)]
final = [dict(row) for row in originals]
adjudications = []
for path in sorted(out.glob('adjudication-*.json')):
    decision = read(path)
    assert decision['input_sha256'] == summary['input_sha256']
    number = decision['number']
    original = originals[number - 1]
    assert decision['id'] == original['id'] and decision['reviewer'] == original['reviewer']
    assert decision['evidence']
    if original['verdict'] == 'Pass' and decision['verdict'] == 'Fail':
        assert decision['counterexample'] and decision['suggested_fix']
    else:
        confirmation_path = (out / decision['independent_confirmation']).resolve()
        assert confirmation_path.is_relative_to(out)
        confirmation = read(confirmation_path)
        assert confirmation['number'] == number
        assert confirmation['input_sha256'] == summary['input_sha256']
        assert confirmation['reviewer'] != original['reviewer']
        assert confirmation['recommended_verdict'] == decision['verdict']
        assert confirmation['evidence']
        if original['verdict'] == 'Not exercised' and decision['verdict'] == 'Pass':
            artifacts = decision['new_measurement_artifacts']
            assert artifacts and all((root / p).is_file() and digest(root / p) == h for p, h in artifacts.items())
        else:
            assert original['verdict'] == 'Fail' and decision['verdict'] in ['Pass', 'Note']
            assert decision['refutation']
    final[number - 1] = decision
    adjudications.append({'number': number, 'from': original['verdict'], 'to': decision['verdict'], 'report': path.name})

checks = [{'id': r['id'], 'verdict': r['verdict'], 'severity': r['severity'] or '',
           'evidence': r['evidence'], 'finding': r['counterexample'] or '', 'action': r['suggested_fix'] or ''}
          for r in final]
findings = [{'id': f"Q{r['number']:02d}", 'check': r['id'], 'severity': r['severity'],
             'run_verdict': r['run_verdict'], 'title': r['id'], 'evidence': r['evidence'],
             'impact': r['counterexample'], 'fix': r['suggested_fix']}
            for r in final if r['verdict'] == 'Fail']
deterministic = read(out / 'deterministic.json')
payload = {'tasks': [{'name': 'Colderwater reconciled QC', 'checks': checks, 'findings': findings}],
           'deterministic': deterministic}
save(out / 'reconciled-findings.json', payload)

sys.path.insert(0,str(root/'scripts'))
from qc_pipeline import RUNTIME_ROWS, verify_frozen
manifest=read(base/'manifest.json')
assert not verify_frozen(base,manifest), 'Review inputs changed'
runtime=read(base/'runtime-evidence.json') if (base/'runtime-evidence.json').exists() else {}
runtime_gaps=[]
for key in sorted(RUNTIME_ROWS):
    record=runtime.get(key,{})
    artifacts=record.get('artifacts',{})
    if record.get('observed') is not True or record.get('input_sha256')!=manifest['input_sha256'] or not record.get('command') or not artifacts:
        runtime_gaps.append(key+': no current measured record')
    elif any(not (root/p).is_file() or digest(root/p)!=h for p,h in artifacts.items()):
        runtime_gaps.append(key+': evidence missing or changed')
status='BLOCKED' if runtime_gaps or any(r['risk'] or r['verdict']=='Fail' for r in final) else 'SOURCE_REVIEW_COMPLETE_RUNTIME_NOT_CLEARED'
result = {'status': status, 'input_sha256': summary['input_sha256'],
          'completed_utc': datetime.now(timezone.utc).isoformat(),
          'dedicated_reviewers': 53, 'max_parallel_workers': 3,
          'initial_verdicts': dict(Counter(r['verdict'] for r in originals)),
          'reconciled_verdicts': dict(Counter(r['verdict'] for r in final)),
          'deterministic_verdicts': dict(Counter(r['status'] for r in deterministic)),
          'adjudications': adjudications,
          'required_runtime_evidence_gaps': runtime_gaps,
          'report_sha256': {f'rows/{n:02d}.json': digest(out / f'rows/{n:02d}.json') for n in range(1, 54)},
          'adjudication_sha256': {p.name: digest(p) for p in out.glob('adjudication-*.json')},
          'independent_confirmation_sha256': {p.name: digest(p) for p in out.glob('confirmation-*.json')},
          'task_source_edited': False, 'portal_pass_claimed': False,
          'oracle_score_claimed': False, 'model_score_claimed': False,
          'measurement_limits': 'Local source/parser/scorer evidence, existing hash-matched scripted golden, and exact-image offline isolation measurements; no full configured judge, hosted QC or target-model run.'}
save(out / 'reconciled-summary.json', result)
lines = ['# Colderwater: reconciled 53-point QC', '',
         f'**{status}.** All 53 dedicated agent reviews are complete. Each reviewed one quality point independently using the frozen workbook and skill. Up to three workers ran concurrently.', '',
         'The 48 deterministic rows were separately applied locally: '+str(dict(Counter(r['status'] for r in deterministic)))+'. These are not executions of the private portal checker suite.', '',
         'Original reports are preserved. Any changed verdict below is a documented follow-up after independent review, with a concrete counterexample; no failure was outvoted. Full judge timing, Oracle and target-model scores remain unmeasured.', '',
         '| # | QC point | Initial | Reconciled | Evidence / remaining issue |',
         '|---|---|---|---|---|']
for old, row in zip(originals, final):
    report = next((d['report'] for d in adjudications if d['number'] == row['number']), f"rows/{row['number']:02d}.json")
    excerpt = (row['counterexample'] or row['evidence']).replace('|', '/').replace('\n', ' ')
    if len(excerpt) > 300:
        excerpt = excerpt[:297] + '...'
    lines.append(f"| {row['number']} | [{row['id']}]({report}) | {old['verdict']} | {row['verdict']} | {excerpt} |")
(out / 'QC_53_RECONCILED.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(json.dumps({k: result[k] for k in ['status', 'dedicated_reviewers', 'initial_verdicts', 'reconciled_verdicts', 'deterministic_verdicts', 'adjudications']}))
