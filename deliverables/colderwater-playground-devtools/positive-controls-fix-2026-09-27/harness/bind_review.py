"""Read-only exact archive/source/schema binding for the positive-control repair."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--manifest', type=Path, required=True)
parser.add_argument('--archive', type=Path, required=True)
args = parser.parse_args()
root = Path.cwd()
review = Path(__file__).resolve().parents[1]
old = review.parent / 'structural-review-2026-09-27'
load = lambda p: json.loads(p.read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = load(args.manifest)
main = load(review / 'source_audit_main.json')
extracted = load(review / 'source_audit_archive.json')
payload = load(review / 'harness/payload_results.json')
before, current = payload['results']
prior = load(old / 'qc_final_findings.json')
cli = load(old / 'harness/draft_schema_cli_results.json')
image = load(old / 'harness/final_verifier_image.json')
checks = []
def check(name, passed, evidence):
    checks.append({'name': name, 'passed': bool(passed), 'evidence': evidence})

archive_hash = sha(args.archive)
check('archive SHA matches frozen manifest', archive_hash == manifest['sha256'], archive_hash)
check('mechanical main and extracted source audits', main['failed'] == extracted['failed'] == 0 and main['passed'] == extracted['passed'], {'main': main['passed'], 'extracted': extracted['passed']})
check('source and extracted manifest identity', main['source_hashes'] == extracted['source_hashes'] == manifest['source_sha256'], len(main['source_hashes']))
with zipfile.ZipFile(args.archive) as archive:
    names = [n for n in archive.namelist() if not n.endswith('/')]
    matches = []
    for relative, expected in manifest['source_sha256'].items():
        found = [n for n in names if n == relative or n.endswith('/' + relative)]
        matches.append(len(found) == 1 and hashlib.sha256(archive.read(found[0])).hexdigest() == expected)
    check('archive CRC and exact file hashes', archive.testzip() is None and len(names) == len(matches) == 50 and all(matches), {'files': len(names), 'matched': sum(matches)})
semantic = {'judge': 'tests/scored/functional/judge.toml', 'prompt': 'tests/scored/functional/prompt.md', 'context': 'tests/app_context.md'}
check('installed builder proof binds final three files', all(current[k + '_sha256'] == manifest['source_sha256'][p] for k, p in semantic.items()), {k: current[k + '_sha256'] for k in semantic})
check('prior schema comparison binds rejected archive', all(before[k + '_sha256'] == prior['candidate']['source_sha256'][p] for k, p in semantic.items()) and prior['candidate']['sha256'] == '7d693e9cde4585aebfc2f1bd1678e8a36b644cbc5e8113def1e606b1c0406823', prior['candidate']['sha256'])
check('final prompt and schema launch locally', payload['candidate_launch_passed'], {'prompt_bytes': current['resolved_prompt_utf8_bytes'], 'schema_bytes': current['response_schema_utf8_bytes']})
check('response schema and scoring contract unchanged', payload['unchanged_response_schema'] and payload['unchanged_scoring_contract'], {'response_schema_sha256': current['response_schema_sha256'], 'rows': current['rows'], 'scope': 'Criterion descriptions and browser decision rules changed; no model-verdict reuse.'})
check('prior actual CLI schema fixtures bind unchanged contract and helpers', cli['passed'] and len(cli['results']) == 3 and cli['functional_count'] == current['rows'] == 88 and cli['binding']['draft_judge_sha256'] == before['judge_sha256'] and cli['binding']['test_sh_sha256'] == manifest['source_sha256']['tests/test.sh'] and cli['binding']['score_py_sha256'] == manifest['source_sha256']['tests/tools/score.py'], {'prior_results_sha256': sha(old / 'harness/draft_schema_cli_results.json'), 'scope': 'Three actual local CLI transport/aggregation cases only; not new browser or provider cases.'})
changed = {p: {'before': prior['candidate']['source_sha256'].get(p), 'after': h} for p, h in manifest['source_sha256'].items() if prior['candidate']['source_sha256'].get(p) != h}
check('only three semantic task files changed', set(changed) == set(semantic.values()) and len(manifest['source_sha256']) == 50, changed)
unchanged_image_tests = [c['file'] for c in image['checks'] if manifest['source_sha256'].get('tests/' + c['file']) == c['actual']]
check('prior verifier runtime scope is explicit', image['passed'] and len(unchanged_image_tests) == 12 and all(manifest['source_sha256'][p] == prior['candidate']['source_sha256'][p] for p in ['tests/Dockerfile', 'tests/.dockerignore']), {'runtime_image_id': image['image_id'], 'unchanged_shipped_test_files': unchanged_image_tests, 'stale_semantic_files_in_old_image': sorted(semantic.values()), 'final_image_rebuilt': False})
report = {
    'scope': 'Exact source/archive/schema plumbing binding only; no provider, hosted acceptance, full Oracle or complete workflow/timing claim.',
    'reviewed_archive': str(args.archive), 'reviewed_archive_sha256': archive_hash,
    'manifest': str(args.manifest), 'manifest_sha256': sha(args.manifest),
    'semantic_hashes': {k: current[k + '_sha256'] for k in semantic},
    'changed_files': changed, 'unchanged_files': {p: h for p, h in manifest['source_sha256'].items() if p not in changed},
    'checks': checks, 'passed': all(c['passed'] for c in checks),
    'superseded_claims': ['The prior bounded review missed the Auto-run enabled control, CSS copied-document survivor control, and S06 ambiguity/exposure overlap. Prior local passes did not establish platform acceptance.'],
    'limits': ['Response schema equality justifies transport/aggregation fixture reuse, not semantic verdict reuse.', 'Prior image supplies the installed runtime with candidate source mounted read-only; its three old semantic files are not claimed current.', '9000 seconds is 150 minutes; full model/browser trajectory timing remains unmeasured.', 'Incomplete observation never earns partial credit: unchanged harness rejects an incomplete evaluation.'],
}
(review / 'harness/final_review_binding.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': report['passed'], 'checks': len(checks), 'sha256': archive_hash}))
assert report['passed'], [c for c in checks if not c['passed']]
