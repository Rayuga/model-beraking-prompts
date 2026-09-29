import hashlib
import json
import tomllib
import zipfile
from decimal import Decimal
from pathlib import Path

root = Path.cwd()
out = Path(__file__).resolve().parent
task = root / 'projects/colderwater-playground-devtools'
read = lambda path: json.loads(path.read_text(encoding='utf-8'))
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
manifest = read(out / 'review-candidate/candidate_manifest.json')
baseline = read(out.parent / 'two-findings-fix-2026-09-27/candidate_manifest.json')
checks = []


def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})
    assert condition, name


current = {p.relative_to(task).as_posix(): sha(p) for p in task.rglob('*') if p.is_file()}
check('all50 current files equal frozen manifest', current == manifest['source_sha256'] and len(current) == 50)
check('only intended3 task files changed', {p for p in current if current[p] != baseline['source_sha256'][p]} == {
    'tests/scored/functional/judge.toml', 'tests/scored/functional/prompt.md', 'tests/app_context.md'})
check('all23 golden files unchanged', sum(p.startswith('solution/') for p in current) == 23 and all(
    digest == baseline['source_sha256'][p] for p, digest in current.items() if p.startswith('solution/')))
archive = out / 'review-candidate' / manifest['archive']
check('review archive SHA256 matches', sha(archive) == manifest['sha256'])
with zipfile.ZipFile(archive) as bundle:
    check('archive CRC and exact50 source bytes', bundle.testzip() is None and {
        p.removeprefix(task.name + '/'): hashlib.sha256(bundle.read(p)).hexdigest() for p in bundle.namelist()} == current)
extracted = archive.parent / ('archive-check-' + manifest['sha256'][:12]) / task.name
check('extracted task equals source', {p.relative_to(extracted).as_posix(): sha(p) for p in extracted.rglob('*') if p.is_file()} == current)
rows = tomllib.loads((task / 'tests/scored/functional/judge.toml').read_text(encoding='utf-8'))['criterion']
check('88 binary outcomes with49.5 total', len(rows) == 88 and all(c['type'] == 'binary' for c in rows) and
      sum(Decimal(str(c['weight'])) for c in rows) == Decimal('49.5'))
evidence_map = read(out / 'golden/FUNCTIONAL_EVIDENCE_MAP.json')
check('local map binds final archive and Functional inputs', evidence_map['archive_sha256'] == manifest['sha256'] and
      evidence_map['functional_sha256'] == current['tests/scored/functional/judge.toml'] and
      evidence_map['prompt_sha256'] == current['tests/scored/functional/prompt.md'])
mapped = {row['id']: row for row in evidence_map['all_current_criteria']}
check('all88 current criteria have exactly one map row', len(mapped) == len(rows) == len(evidence_map['all_current_criteria']) and
      set(mapped) == {row['id'] for row in rows})
for criterion in rows:
    row = mapped[criterion['id']]
    assert row['criterion_sha256'] == hashlib.sha256(json.dumps(criterion, sort_keys=True).encode()).hexdigest()
    witness = row['evidence']
    source = root / witness['path']
    assert sha(source) == witness['sha256']
    observed = read(source)
    for key in witness['json_pointer'].lstrip('/').split('/'):
        observed = observed[key.replace('~1', '/').replace('~0', '~')]
    assert observed['product_pass'] is True and observed['key'] == row['evidence_key']
    assert row['oracle_verdict'] is False
check('88 actual local pass facts resolve with matching criterion and raw evidence hashes', True)
guard = read(out / 'structural_guards.json')
check('33 current source guards pass', guard['passed'] and len(guard['checks']) == 33)
check('old rejected archive cannot pass current guard', not read(out / 'rejected_previous_archive_guard.json')['passed'])
qc = read(out / 'qc_final_findings.json')
quality = qc['tasks'][0]['checks']
check('all53quality and48deterministic dispositions recorded', len(quality) == 53 and len(qc['deterministic']) == 48)
check('full judge timing honestly remains unmeasured', next(c for c in quality if c['id'] == 'timeouts_fit_the_work')['verdict'] == 'Not exercised' and
      manifest['oracle_measured'] is False and manifest['target_model_measured'] is False)
artifacts = ['golden/RUNTIME_PROOF_SUMMARY.json', 'golden/FUNCTIONAL_EVIDENCE_MAP.json', 'golden/golden_evidence_binding.json',
             'harness/final_shared_review.json', 'qc_final_findings.json', 'QC_FINAL.xlsx', 'qc_report_validation.json']
report = {'candidate_sha256': manifest['sha256'], 'passed': True, 'checks': checks,
          'scope': 'Frozen local evidence and packaging validation; not platform acceptance or an Oracle score',
          'evidence_hashes': {name: sha(out / name) for name in artifacts},
          'provider_calls_authorized': False, 'full_judge_timing_measured': False}
(out / 'final_candidate_validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'checks': len(checks), 'candidate_sha256': manifest['sha256'], 'full_judge_timing_measured': False}))
