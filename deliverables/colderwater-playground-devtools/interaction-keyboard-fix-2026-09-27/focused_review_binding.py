"""Independent read-only binding for the bounded interaction/keyboard review."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import tomllib
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT / 'projects/colderwater-playground-devtools'
OLD = HERE / 'baseline-d254c73e6ebe/colderwater-playground-devtools'
parser = argparse.ArgumentParser()
parser.add_argument('--expected-sha', required=True)
args = parser.parse_args()
EXPECTED = args.expected_sha
EXTRACTED = HERE / f'archive-check-{EXPECTED[:12]}/colderwater-playground-devtools'
read = lambda name: json.loads((HERE / name).read_text(encoding='utf-8'))
sha = lambda data: hashlib.sha256(data).hexdigest()
manifest = read('candidate_manifest.json')
checks = []

def check(name, value, detail=None):
    checks.append(dict(name=name, passed=bool(value), detail=detail))

archive = HERE / manifest['archive']
check('archive_sha256', sha(archive.read_bytes()) == EXPECTED == manifest['sha256'])
check('archive_bytes', archive.stat().st_size == manifest['bytes'])
with zipfile.ZipFile(archive) as zipped:
    check('archive_crc', zipped.testzip() is None)
    files = {info.filename.split('/', 1)[1]: zipped.read(info) for info in zipped.infolist() if not info.is_dir()}
check('exact_inventory', set(files) == set(manifest['source_sha256']) and len(files) == 50)
check('source_archive_extracted_hashes', all(
    sha(data) == manifest['source_sha256'][path] == sha((TASK / path).read_bytes()) == sha((EXTRACTED / path).read_bytes())
    for path, data in files.items()))

changed_criteria = {}
dimensions = {}
for path in sorted(TASK.glob('tests/**/judge.toml')):
    rel = path.relative_to(TASK)
    current = tomllib.loads(path.read_text(encoding='utf-8'))
    old = tomllib.loads((OLD / rel).read_text(encoding='utf-8'))
    label = path.parent.name
    dimensions[label] = {'count': len(current['criterion']), 'weight': sum(c['weight'] for c in current['criterion'])}
    check(f'{label}_judge_configuration_unchanged', {k: v for k, v in current.items() if k != 'criterion'} == {k: v for k, v in old.items() if k != 'criterion'})
    check(f'{label}_ids_order_types_weights_unchanged', [dict((k, c[k]) for k in c if k != 'description') for c in current['criterion']] == [dict((k, c[k]) for k in c if k != 'description') for c in old['criterion']])
    changed_criteria[label] = [new['id'] for before, new in zip(old['criterion'], current['criterion']) if before['description'] != new['description']]
check('only_three_criterion_descriptions_changed', changed_criteria == {
    'constraints': [], 'render': [], 'functional': ['language_dispatch', 'recovery_persistence_chain'],
    'polish': ['labelled_controls_and_focus'], 'visual': []})
check('unchanged_functional_total', dimensions['functional'] == {'count': 33, 'weight': 49.5})
for path in ['task.toml', 'environment/Dockerfile', 'tests/Dockerfile', 'tests/test.sh', 'tests/scoring.toml', 'tests/tools/score.py', 'tests/tools/restart_mcp.py', 'solution/app/src/runtime.ts', 'solution/app/server.js', 'solution/app/src/style.css']:
    check(f'unchanged_{path}', (OLD / path).read_bytes() == (TASK / path).read_bytes())

interaction = read('interaction-mcp-results.json')
groups = interaction['observations']['observations']
check('interaction_actual_mcp_five_groups', interaction['passed'] and len(groups) == 5 and all(g['passed'] for g in groups), {g['name']: g['passed'] for g in groups})
check('interaction_served_source_binding', all(sha((TASK / 'solution/app' / path).read_bytes()) == value for path, value in interaction['source_binding'].items()))
check('interaction_exact_runtime_versions', interaction['mcp_version'] == 'Version 0.0.79' and '152.0.7977.8' in interaction['chromium_version'])
pending = next(g for g in groups if g['name'] == 'recovery_completed_preview_interaction_shared_timer_budget')
check('pending_interaction_discriminating_observations',
      1000 < pending['second_click_from_first_ms'] < 4000 and pending['timeout_from_first_ms'] < 8000
      and pending['observed_until_from_first_ms'] > 6000 and not pending['late_callback_logged']
      and pending['rolled_back'] and pending['fresh_saved_run_passed'], pending)
check('diagnostic_attempt_preserved', (HERE / 'interaction-mcp-attempt1-modal.json').is_file())
language = read('language-mcp-results.json')
language_groups = language['observations']['observations']
late = language_groups[0]
check('final_language_exact_mcp_control', language['passed'] and len(language_groups) == 1 and late['passed']
      and late['wait_after_observed_completion_ms'] >= 6000 and late['focused_input_wait_before_typing_ms'] >= 6000
      and late['late_handler_entries'] == {'click': 1, 'keyboard': 1, 'input': 1}
      and not late['css_preserved_handler'] and late['new_js_global'] == 'undefined', late)
check('final_language_source_binding', all(sha((TASK / 'solution/app' / path).read_bytes()) == value for path, value in language['source_binding'].items()))
functional = tomllib.loads((TASK / 'tests/scored/functional/judge.toml').read_text(encoding='utf-8'))
language_criterion = next(c for c in functional['criterion'] if c['id'] == 'language_dispatch')
html_fixture = next(line for line in language_criterion['description'].splitlines() if line.startswith('<!doctype html>'))
probe_fixture = re.search(r'const html = `([^`]+)`;', (HERE / 'interaction-mcp-probe.js').read_text(encoding='utf-8')).group(1)
check('final_language_authored_fixture_exact', html_fixture == probe_fixture)

keyboard = read('keyboard-proof-results.json')
check('keyboard_five_groups', keyboard['passed'] and len(keyboard['checks']) == 5 and all(g['passed'] for g in keyboard['checks']))
served = next(g['hashes'] for g in keyboard['checks'] if g['id'] == 'documented_escape_and_served_build')
check('keyboard_served_build_binding', all(sha((TASK / 'solution/app/public' / path.lstrip('/')).read_bytes()) == value for path, value in served.items()))
keyboard_route = next(g for g in keyboard['checks'] if g['id'] == 'keyboard_only_editor_examples_library_return')
check('keyboard_actual_route_observed', keyboard_route['onlyKeyboardActions'] and keyboard['chromium'] == '152.0.7977.8', keyboard_route)

images = read('final_image_evidence.json')
check('image_evidence_current_source', images['passed'] and images['agent_public_hashes_match'] and images['verifier_source_hashes_match']
      and all(sha((TASK / path).read_bytes()) == value for path, value in images['source_before_build'].items()),
      'Coordinator-executed image evidence independently hash-checked; no rebuild performed by this reviewer.')
report = {
    'scope': 'Independent hash/inventory/evidence binding, not a paid judgment or full QC inventory rerun.',
    'archive_sha256': EXPECTED, 'files': len(files), 'dimensions': dimensions,
    'changed_criterion_descriptions': changed_criteria,
    'checks': checks, 'passed': all(c['passed'] for c in checks),
    'evidence_sha256': {name: sha((HERE / name).read_bytes()) for name in [
        'interaction-mcp-results.json', 'language-mcp-results.json', 'interaction-mcp-probe.js', 'interaction-mcp-proof.py',
        'keyboard-proof-results.json', 'keyboard-proof.cjs', 'keyboard-evidence-binding.json',
        'final_image_evidence.json', 'candidate_manifest.json', 'change_scope.json']}
}
(HERE / 'focused_review_binding.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': report['passed'], 'checks': len(checks), 'failed': [c['name'] for c in checks if not c['passed']], 'sha256': EXPECTED}))
raise SystemExit(0 if report['passed'] else 1)
