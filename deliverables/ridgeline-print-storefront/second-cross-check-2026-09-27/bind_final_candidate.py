"""Bind the replacement archive to scoped fresh and unchanged evidence."""
import difflib
import hashlib
import json
from pathlib import Path
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
task = root / 'projects/ridgeline-print-storefront'
prior = out.parent / 'cross-check-2026-09-27'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(name, value):
    (out / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

manifest = read(out / 'candidate_manifest.json')
old = read(prior / 'candidate_manifest.json')
files = manifest['source_sha256']
assert sha(out / manifest['archive']) == manifest['sha256']
assert len(files) == 51
assert {p.relative_to(task).as_posix(): sha(p) for p in task.rglob('*') if p.is_file()} == files
assert files.keys() == old['source_sha256'].keys()
changed = sorted(p for p in files if files[p] != old['source_sha256'][p])
assert changed == ['tests/scored/functional/judge.toml', 'tests/scored/functional/prompt.md', 'tests/scored/polish/judge.toml', 'tests/scored/polish/prompt.md', 'tests/test.sh']
golden = {p: digest for p, digest in files.items() if p.startswith('solution/')}
assert len(golden) == 19 and all(old['source_sha256'][p] == digest for p, digest in golden.items())
diffs = []
description_changes = {}
with zipfile.ZipFile(prior / old['archive']) as baseline:
    for name in changed:
        before = baseline.read(task.name + '/' + name).decode('utf-8')
        after = (task / name).read_text(encoding='utf-8')
        diffs.extend(difflib.unified_diff(before.splitlines(True), after.splitlines(True), fromfile='baseline/' + name, tofile='candidate/' + name))
        if name.endswith('judge.toml'):
            a, b = tomllib.loads(before), tomllib.loads(after)
            assert a.keys() == b.keys()
            assert {k:v for k,v in a.items() if k != 'criterion'} == {k:v for k,v in b.items() if k != 'criterion'}
            assert len(a['criterion']) == len(b['criterion'])
            description_changes[name] = []
            for x, y in zip(a['criterion'], b['criterion']):
                assert {k:v for k,v in x.items() if k != 'description'} == {k:v for k,v in y.items() if k != 'description'}
                if x['description'] != y['description']:
                    description_changes[name].append(y['id'])
(out / 'candidate.diff').write_text(''.join(diffs), encoding='utf-8')

for filename in ['final_source_audit.json', 'extracted_source_audit.json']:
    evidence = read(out / filename)
    assert (evidence['passed'], evidence['failed']) == (89, 0)
    assert evidence['source_hashes'] == files
images = read(out / 'final_image_evidence.json')
assert images['passed'] and images['source_unchanged_during_build']
assert images['source_before_build'] == {p: d for p,d in files.items() if p.startswith(('environment/', 'tests/'))}
runtime = read(out / 'golden/runtime-binding.json')
assert runtime['passed'] and runtime['same_golden_as_baseline_archive']
assert {'solution/' + p:d for p,d in runtime['all_19_installed_solution_hashes'].items()} == golden
observations = read(out / 'golden/boundary-observations.json')
assert observations['passed'] and not observations['pageErrors']
assert len(observations['checks']) == 8 and all(c['passed'] for c in observations['checks'])
mapping = read(out / 'golden/CRITERION_EVIDENCE.json')
assert mapping['passed'] and len(mapping['criteria']) == 37
assert mapping['current_rubric_hashes'] == {p:d for p,d in files.items() if p.endswith('/judge.toml')}
assert {'solution/' + p:d for p,d in mapping['current_solution_hashes'].items()} == golden
cleanup = read(out / 'harness/cleanup_fixed_probe_results.json')
assert cleanup['passed'] and cleanup['test_sh_sha256'] == files['tests/test.sh']
assert len(cleanup['results']) == 7 and all(c['passed'] for c in cleanup['results'])
orchestration = read(out / 'harness/orchestration_regression_results.json')
assert orchestration['passed'] and orchestration['test_sh_sha256'] == files['tests/test.sh']
assert len(orchestration['results']) == 4 and all(c['exit_code'] == 0 for c in orchestration['results'])
harness = read(out / 'harness/review_binding.json')
assert harness['passed'] and harness['current_test_sh_sha256'] == files['tests/test.sh']
assert all(c['passed'] for c in harness['checks'])
binding = {
    'passed': True,
    'candidate_sha256': manifest['sha256'], 'baseline_sha256': old['sha256'],
    'files': len(files), 'changed_files': changed, 'unchanged_files': len(files) - len(changed),
    'golden_files_hash_matched': len(golden),
    'criterion_descriptions_changed': description_changes,
    'all_ids_types_weights_order_and_scoring_preserved': True,
    'source_and_extracted_assertions': [89, 89],
    'current_images_exact_source_match': True,
    'public_image_files': images['agent_public_file_count'], 'verifier_image_files': images['verifier_source_files'],
    'fresh_actual_mcp_browser_groups': 8, 'fresh_actual_key_events': mapping['fresh_keyboard_events'],
    'fresh_cleanup_cases': 7, 'fresh_orchestration_cases': 4,
    'harness_independent_assertions': len(harness['checks']),
    'reused_scope': {
        'golden': 'All19 application/installer files unchanged.37-criterion map identifies fresh8-group supplements and exact older observations by file/hash. No aggregate old PASS is relabelled a rerun.',
        'restart': 'Generated restart shell helper and canonical restart MCP Python unchanged; prior5 lifecycle controls and all13-stock actual browser restart retained. Current four orchestration cases exercise real restart with repaired outer cleanup.',
        'scorer': 'Canonical scorer/scoring policy unchanged;20 prior synthetic arithmetic cases retained. Synthetic all-one/partial outputs do not establish Oracle or model scores.'
    },
    'oracle_measured': False, 'target_model_measured': False,
    'private_platform_checkers_executed': False,
}
write('final_candidate_binding.json', binding)
print(json.dumps({k:v for k,v in binding.items() if k not in ['reused_scope', 'criterion_descriptions_changed']}))
