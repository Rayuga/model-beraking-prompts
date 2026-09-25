"""Freeze and audit Common Ground r17. Neither phase runs implicitly.

freeze creates a new archive exclusively; an existing archive is never replaced.
finish requires the frozen bytes and complete local evidence, runs image smoke
checks, and copies the resulting authoring evidence beside the upload archive.
README.md is authored separately. Local checks are not platform QC or model runs.
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import importlib.util
import json
import math
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tomllib
import zipfile


ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
PREVIOUS = ROOT / 'reports/common-ground-ballot/2026-09-15-coverage-r16'
SOURCE = ROOT / 'projects/common-ground-ballot'
FROZEN = OUT / 'frozen/common-ground-ballot'
DELIVERY = ROOT / 'deliverables/common-ground-ballot/2026-09-15-recovery-r17'
ARCHIVE = DELIVERY / 'common-ground-ballot.zip'
DIMENSIONS = ('render', 'constraints', 'functional', 'polish', 'visual')
COUNTS = dict(render=1, constraints=2, functional=49, polish=10, visual=6)
ADDITIONAL = {
    'user_wide_operation_namespace': ('ballots.md: actor-wide identifiers across action families and independent person namespaces', 'environment/instructions/ballots.md'),
    'durable_pending_staff_work': ('recovery.md: retained uncertainty across reload, restart and sign-in for six staff actions', 'environment/instructions/recovery.md'),
    'immutable_pending_retry': ('recovery.md: exact original retry, trustworthy outcome handling and refreshed current records', 'environment/instructions/recovery.md'),
    'independent_pending_actions': ('recovery.md: several independently recognizable and actionable pending attempts', 'environment/instructions/recovery.md'),
    'pending_actor_isolation': ('recovery.md: original-account ownership across account changes and revoked sessions', 'environment/instructions/recovery.md'),
    'cross_tab_pending_resolution': ('recovery.md: shared-tab resolution, late-response safety and dismissal without undoing work', 'environment/instructions/recovery.md'),
}
UNCHANGED = ('solution/server.js', 'tests/score.py', 'tests/test.sh', 'tests/reward.toml')
IMAGES = {'agent': 'ballot-agent:20260915-r17-local', 'verifier': 'ballot-verifier:20260915-r17-local'}
BASE_IMAGES = {'agent': 'ballot-agent:20260915-r15-local', 'verifier': 'ballot-verifier:20260915-r16-local'}
INPUT_RUN = ROOT / 'run-outputs/common-ground-ballot/run-d9981dfb-d091-4621-b264-b4ef078bad3b/common-ground-ballot__Vjmb2mT'
# Counts are derived from each actual result. These minimums reject truncated
# evidence without forcing a new audit edit when useful groups are added.
MODES = {
    'browser': ('browser-results.json', 45), 'runtime': ('runtime-results.json', 5),
    'harness': ('harness-results.json', 19), 'coverage': ('coverage-results.json', 6),
    'polish': ('polish-results.json', 3), 'roles': ('roles-results.json', 40),
    'session': ('session-results.json', 7), 'mcp': ('mcp-results.json', 19),
    'mcp-recovery': ('mcp-recovery-results.json', 7),
    'recovery': ('recovery-results.json', 20), 'qc': ('qc-results.json', 115),
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return digest(path.read_bytes())


def read(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def tree(path: Path) -> dict[str, bytes]:
    assert path.is_dir(), path
    result = {}
    for file in sorted(path.rglob('*')):
        assert not file.is_symlink(), ('Unexpected task symlink', file)
        if file.is_file():
            result[file.relative_to(path).as_posix()] = file.read_bytes()
    assert result, path
    return result


def archive_files(path: Path) -> dict[str, bytes]:
    result = {}
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, ('Archive CRC failure', path)
        for info in archive.infolist():
            if info.is_dir():
                continue
            parts = PurePosixPath(info.filename).parts
            assert len(parts) > 1 and parts[0] == 'common-ground-ballot', info.filename
            assert '..' not in parts and '\\' not in info.filename and ':' not in info.filename, info.filename
            name = '/'.join(parts[1:])
            assert name not in result, ('Duplicate archive entry', name)
            result[name] = archive.read(info)
    assert result, path
    return result


def judges(files: dict[str, bytes]) -> dict:
    result = {dimension: tomllib.loads(files[f'tests/{dimension}/judge.toml'].decode('utf-8')) for dimension in DIMENSIONS}
    assert {dimension: len(value['criterion']) for dimension, value in result.items()} == COUNTS
    ids = [criterion['id'] for value in result.values() for criterion in value['criterion']]
    assert len(ids) == len(set(ids)) == sum(COUNTS.values())
    weights = {dimension: sum(criterion['weight'] for criterion in value['criterion']) for dimension, value in result.items()}
    assert weights['functional'] == 58 and weights['polish'] == 14, weights
    for value in result.values():
        for criterion in value['criterion']:
            assert isinstance(criterion['weight'], (float, int)) and math.isfinite(criterion['weight']) and criterion['weight'] > 0
    return result


def checkers() -> dict:
    results = {}
    for name in ('check-standard', 'check-upload'):
        path = ROOT / f'references/task-templates/{name}.py'
        spec = importlib.util.spec_from_file_location(name.replace('-', '_') + '_r17_package', path)
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        result = module.validate(FROZEN) if name == 'check-standard' else module.audit(ARCHIVE)
        assert result['passed'] is True and result['checks'], name
        write(OUT / f'{name}.json', result)
        results[name] = {'checks': len(result['checks']), 'checker_sha256': sha(path), 'passed': True}
    return results


def baseline_contract(files: dict[str, bytes], before: dict[str, bytes]) -> dict:
    for name in UNCHANGED:
        assert files[name] == before[name], ('Protected existing contract changed', name)
    assert files['instruction.md'] != before['instruction.md'], 'The stronger public request must be present'
    assert files['environment/instructions/ballots.md'] != before['environment/instructions/ballots.md']
    assert files['solution/public/app.js'] != before['solution/public/app.js']
    assert set(files) - set(before) == {'environment/instructions/recovery.md', 'tests/functional/recovery.md'}
    assert not (set(before) - set(files)), 'Existing task files were removed'
    return {'golden_server_unchanged': True, 'runner_and_scoring_formula_unchanged': True,
            'task_brief_changed': True, 'golden_frontend_changed': True,
            'protected_unchanged_files': list(UNCHANGED)}


def freeze() -> None:
    assert not ARCHIVE.exists(), 'Preserve the existing frozen archive; do not overwrite it'
    assert not FROZEN.exists(), 'Preserve the existing frozen task directory'
    files, before = tree(SOURCE), archive_files(OUT / 'source-before.zip')
    contract = baseline_contract(files, before)
    catalog = judges(files)
    changed = [name for name in sorted(set(files) | set(before)) if files.get(name) != before.get(name)]
    DELIVERY.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ARCHIVE, 'x', zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            info = zipfile.ZipInfo('common-ground-ballot/' + name, (2026, 9, 15, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    zipped = archive_files(ARCHIVE)
    assert zipped == files
    for name, data in zipped.items():
        target = FROZEN / name
        assert target.resolve().is_relative_to(FROZEN.resolve()), target
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    assert tree(FROZEN) == files
    checked = checkers()
    manifest = {'task': 'common-ground-ballot', 'revision': 'r17', 'task_version': '1.0.0',
        'archive': str(ARCHIVE.relative_to(ROOT)), 'sha256': sha(ARCHIVE), 'file_count': len(files),
        'criterion_counts': COUNTS, 'criterion_count': sum(COUNTS.values()),
        'criterion_weight_totals': {dimension: sum(c['weight'] for c in value['criterion']) for dimension, value in catalog.items()},
        'dimension_weights': {dimension: value['judge']['weight'] for dimension, value in catalog.items()},
        'changed_files': changed, 'added_files': sorted(set(files) - set(before)),
        'source_before_sha256': sha(OUT / 'source-before.zip'), 'checks': checked, **contract,
        'clean_build_attempted': False, 'clean_build_passed': False,
        'platform_qc': False, 'fresh_scored_oracle': False, 'fresh_gpt': False}
    write(OUT / 'freeze-manifest.json', manifest)
    write(OUT / 'source-hashes.json', {name: digest(data) for name, data in files.items()})
    differences = []
    for name in changed:
        try:
            old, new = before.get(name, b'').decode('utf-8'), files.get(name, b'').decode('utf-8')
            differences.extend(difflib.unified_diff(old.splitlines(True), new.splitlines(True), fromfile='r16/' + name, tofile='r17/' + name))
        except UnicodeDecodeError:
            differences.append(f'Binary file changed: {name}\n')
    (OUT / 'changes.diff').write_text(''.join(differences), encoding='utf-8')
    (DELIVERY / 'SHA256SUMS.txt').write_text(manifest['sha256'] + '  common-ground-ballot.zip\n', encoding='utf-8')
    print(json.dumps(manifest, indent=2))


def local_results() -> tuple[dict, dict, dict, list[Path]]:
    groups, sources = {}, []
    for mode, (filename, minimum) in MODES.items():
        path = OUT / ('validation-' + mode) / filename
        result = read(path)
        rows = result['results']
        assert len(rows) >= minimum, ('Incomplete mode evidence', mode, len(rows), minimum)
        assert all(row.get('passed') is True for row in rows), ('Failed local checks', mode)
        assert result.get('failed', 0) == 0, mode
        for error_field in ('errors', 'pageErrors'):
            assert not result.get(error_field), (mode, error_field, result.get(error_field))
        if 'passed' in result and not isinstance(result['passed'], bool):
            assert result['passed'] == len(rows), (mode, 'summary disagrees with rows')
        runner = path.parent / 'runner.log'
        assert runner.is_file() and runner.stat().st_size, ('Missing completed runner evidence', mode)
        groups[mode] = len(rows)
        sources.append(path)
    boundary_reports = {}
    for label, directory in [('golden', 'validation-boundaries'), ('gpt_existing_artifact', 'validation-boundaries-gpt')]:
        path = OUT / directory / 'strict-boundaries-results.json'
        result = read(path)
        rows = result['checks']
        assert rows and not result['errors'], ('Boundary driver error', label, result['errors'])
        assert any(row['name'] == 'Final Owen state paused' and row['passed'] for row in rows), ('Boundary suite is incomplete', label)
        passed, failed = sum(row['passed'] is True for row in rows), sum(row['passed'] is not True for row in rows)
        assert result['passed'] == passed and result['failed'] == failed
        if label == 'golden':
            assert result['app'] == 'golden' and failed == 0
            groups['boundaries'] = len(rows)
        else:
            assert result['app'] == 'gpt' and failed > 0, 'Existing GPT baseline did not expose a semantic failure'
        runner = path.parent / 'runner.log'
        assert runner.is_file() and runner.stat().st_size, ('Missing completed boundary runner', label)
        boundary_reports[label] = {'checks': len(rows), 'passed': passed, 'failed': failed,
            'driver_errors': 0, 'fresh_model_run': False,
            'scope': 'Local behavioral replay of the golden solution' if label == 'golden' else 'Local diagnostic replay of an existing GPT artifact; not a new score or a new model attempt',
            'failed_checks': [row['name'] for row in rows if row['passed'] is not True]}
        sources.append(path)
    mutants = read(OUT / 'recovery-mutants-results.json')
    assert mutants['detected'] == len(mutants['results']) == 5
    assert mutants['golden_sha256'] == sha(FROZEN / 'solution/public/app.js')
    for result in mutants['results']:
        assert result['detected'] is True and result['golden_sha256'] == mutants['golden_sha256']
        assert result['before_sha256'] == mutants['golden_sha256'] and result['mutant_sha256'] != result['before_sha256']
        verdict = read(OUT / 'recovery-mutants' / result['name'] / 'mutant-verdict.json')
        assert verdict == result, ('Mutant summary differs from its individual verdict', result['name'])
    sources.append(OUT / 'recovery-mutants-results.json')
    preflight = read(OUT / 'preflight-regressions.json')
    assert len(preflight['results']) == 14 and all(row['passed'] is True for row in preflight['results'])
    assert len({row['name'] for row in preflight['results']}) == 14
    assert all(row.get('rejected_by') for row in preflight['results'])
    sources.append(OUT / 'preflight-regressions.json')
    return groups, boundary_reports, mutants, sources


def provenance() -> dict:
    path = OUT / 'validation-harness/prompt-provenance.json'
    record = read(path)
    assert record['task'] == 'common-ground-ballot' and record['task_version'] == '1.0.0'
    assert set(record['judges']) == set(DIMENSIONS)
    for dimension in DIMENSIONS:
        for key, name in [('prompt_sha256', 'prompt.md'), ('judge_sha256', 'judge.toml')]:
            assert record['judges'][dimension][key] == sha(FROZEN / 'tests' / dimension / name), (dimension, key)
    for key, name in [('runner_sha256', 'test.sh'), ('reward_sha256', 'reward.toml'), ('score_sha256', 'score.py')]:
        assert record[key] == sha(FROZEN / 'tests' / name), key
    assert record['resource_sha256'] == {'functional/recovery.md': sha(FROZEN / 'tests/functional/recovery.md')}
    return record


def coverage(manifest: dict) -> dict:
    record = read(PREVIOUS / 'coverage.json')
    record['scope'] = 'Local requirement-to-verifier authoring map; not a platform QC verdict'
    record['review_update'] = 'r17 adds browser recovery and actor-wide operation namespaces. All previous criterion weights and dimension weights remain unchanged; selected descriptions are clarified. Functional total is 58.'
    record['archive_sha256'] = manifest['sha256']
    for cid, (source, file) in ADDITIONAL.items():
        record['requirements'].append({'id': 'REQ-R17-' + cid, 'source': source, 'source_files': [file], 'criteria': [cid]})
    # Structured numeric validation strengthens the existing input/version owners.
    record['requirements'].append({'id': 'REQ-R17-structured-numeric-inputs',
        'source': 'ballots.md: revisions and approval maximums reject structured/boolean/null/missing values without coercion',
        'source_files': ['environment/instructions/ballots.md'],
        'criteria': ['draft_input_validation', 'ballot_target_and_revision_validation', 'membership_input_validation']})
    catalog, clarified, old_ids, new_ids = [], [], set(), set()
    for dimension in DIMENSIONS:
        new = tomllib.loads((FROZEN / 'tests' / dimension / 'judge.toml').read_text(encoding='utf-8'))
        old = tomllib.loads((PREVIOUS / 'frozen/common-ground-ballot/tests' / dimension / 'judge.toml').read_text(encoding='utf-8'))
        assert new['judge'] == old['judge'], ('Dimension settings changed', dimension)
        by_id = {item['id']: item for item in new['criterion']}
        for criterion in old['criterion']:
            old_ids.add(criterion['id'])
            updated = by_id[criterion['id']]
            assert {k: v for k, v in updated.items() if k != 'description'} == {k: v for k, v in criterion.items() if k != 'description'}, ('Old criterion identity/weight/type changed', criterion['id'])
            if updated['description'] != criterion['description']:
                clarified.append(criterion['id'])
        for criterion in new['criterion']:
            new_ids.add(criterion['id'])
            owners = [requirement['id'] for requirement in record['requirements'] if criterion['id'] in requirement['criteria']]
            assert owners, ('Unmapped criterion', criterion['id'])
            catalog.append({'dimension': dimension, 'id': criterion['id'], 'type': criterion['type'],
                'weight': criterion['weight'], 'requirement_refs': owners})
    assert new_ids - old_ids == set(ADDITIONAL) and old_ids <= new_ids
    assert len(catalog) == len(new_ids) == sum(COUNTS.values())
    assert {cid for requirement in record['requirements'] for cid in requirement['criteria']} == new_ids
    record['criteria'] = catalog
    record['clarified_existing_descriptions'] = sorted(clarified)
    record['all_existing_criterion_weights_unchanged'] = True
    record['all_dimension_settings_unchanged'] = True
    score_rows = read(OUT / 'validation-qc/qc-results.json')['results']
    effects = {cid: next(row for row in score_rows if row['name'] == 'Individual criterion changes final score: ' + cid) for cid in ADDITIONAL}
    assert all(row['passed'] is True and 0 < row['final_reward'] < 1 for row in effects.values())
    record['new_criterion_score_effects'] = effects
    write(OUT / 'coverage.json', record)
    return record


def docker_json(command: list[str]):
    result = subprocess.run(command, check=True, capture_output=True, text=True, encoding='utf-8', errors='strict', timeout=180)
    return json.loads(result.stdout)


def input_run_audit() -> dict:
    before = archive_files(OUT / 'source-before.zip')
    exported = read(INPUT_RUN / 'verifier/prompt-provenance.json')
    matches = {}
    assert set(exported['judges']) == set(DIMENSIONS)
    for dimension in DIMENSIONS:
        for key, name in [('judge_sha256', 'judge.toml'), ('prompt_sha256', 'prompt.md')]:
            path = f'tests/{dimension}/{name}'
            expected, actual = digest(before[path]), exported['judges'][dimension][key]
            assert actual == expected, ('Input GPT run did not use the recorded r16 baseline', path)
            matches[path] = {'source_before_sha256': expected, 'exported_sha256': actual, 'matches': True}
    for key, name in [('runner_sha256', 'test.sh'), ('reward_sha256', 'reward.toml'), ('score_sha256', 'score.py')]:
        path = 'tests/' + name
        expected, actual = digest(before[path]), exported[key]
        assert actual == expected, ('Input GPT scoring provenance mismatch', path)
        matches[path] = {'source_before_sha256': expected, 'exported_sha256': actual, 'matches': True}
    scores = read(INPUT_RUN / 'verifier/reward.json')
    expected_scores = dict(reward=0.897, functional=0.9236, polish=0.7143, visual=1.0, render=1.0, constraints=1.0)
    assert all(scores[key] == value for key, value in expected_scores.items()), scores
    assert float((INPUT_RUN / 'verifier/reward.txt').read_text(encoding='utf-8').strip()) == scores['reward']
    assert round(.6 * scores['functional'] + .2 * scores['polish'] + .2 * scores['visual'], 4) == scores['reward']
    config = read(INPUT_RUN / 'config.json')
    assert config['agent']['model_name'] == 'gpt-5.4-mini'
    assert config['agent']['kwargs']['reasoning_effort'] == 'high'
    details = read(INPUT_RUN / 'verifier/reward-details.json')
    failures = {}
    for dimension in DIMENSIONS:
        output = json.loads(details[dimension]['judge_output'])
        for criterion in details[dimension]['criteria']:
            if criterion.get('raw') == 'no' or criterion.get('value') == 0:
                cid = criterion['id']
                verdict = output[cid] if cid in output else output
                assert verdict['score'] == 'no'
                failures[cid] = {'dimension': dimension, 'score': 'no', 'judge_reasoning': verdict['reasoning']}
    classifications = {
        'draft_input_validation': {
            'classification': 'Invalid-input witness was not established',
            'interpretation': 'The judge reported that a blank middle line was normalized into a valid two-choice submission. The export did not capture an actual submitted blank-choice refusal; this does not establish acceptance of an invalid stored ballot.',
            'evidence_terms': ('blank middle line', 'valid two-choice')},
        'roster_conflict_snapshot_chain': {
            'classification': 'Required restart evidence was omitted',
            'interpretation': 'The race, stale refusal and snapshots passed. The missing observation was Leila/Owen visibility after restart 1, so the old no does not by itself prove persistence loss.',
            'evidence_terms': ('restart 1', 'not separately captured')},
        'responsive_workspace_navigation': {
            'classification': 'Observed product layout defect',
            'interpretation': 'Members produced 648 px document/body width at a 390 px viewport. This was an actual horizontal-overflow observation.',
            'evidence_terms': ('648', '390', 'Members')},
        'unavailable_action_guidance': {
            'classification': 'Recorded-participation fixture was missing',
            'interpretation': 'Lifecycle guidance was present. The unmet observation concerned Leila having no recorded-participation ballot in the current Vote view; it was not a missing Open control.',
            'evidence_terms': ('Leila', 'recorded-participation')},
    }
    assert set(failures) == set(classifications), ('Unexpected input-run failures', failures)
    for cid, classification in classifications.items():
        for term in classification['evidence_terms']:
            assert term in failures[cid]['judge_reasoning'], (cid, term)
        failures[cid].update({key: value for key, value in classification.items() if key != 'evidence_terms'})
    record = {'scope': 'Audit of the supplied existing GPT export; no new scoring performed',
        'run_id': 'd9981dfb-d091-4621-b264-b4ef078bad3b', 'trial': 'common-ground-ballot__Vjmb2mT',
        'run_directory': str(INPUT_RUN.relative_to(ROOT)),
        'agent': {'model': config['agent']['model_name'], 'reasoning_effort': config['agent']['kwargs']['reasoning_effort'], 'name': config['agent']['name']},
        'scores': expected_scores, 'graded': scores.get('graded'), 'no_op': scores.get('no_op'),
        'export_files_sha256': {str(path.relative_to(INPUT_RUN)): sha(path) for path in [INPUT_RUN / 'config.json',
            INPUT_RUN / 'verifier/reward.json', INPUT_RUN / 'verifier/reward.txt', INPUT_RUN / 'verifier/reward-details.json', INPUT_RUN / 'verifier/prompt-provenance.json']},
        'source_before_zip_sha256': sha(OUT / 'source-before.zip'), 'baseline_provenance_matches': matches,
        'all_five_judges_prompts_and_scoring_match_r16_baseline': True, 'old_no_verdicts': failures,
        'oracle': {'reward': 1.0, 'source': 'User report in this conversation', 'export_available': False, 'independently_verified_from_export': False},
        'new_boundary_evidence_scope': 'Local diagnostics against this existing GPT artifact, not a rescored GPT run.',
        'fresh_scored_oracle': False, 'fresh_gpt': False, 'new_platform_qc': False}
    write(OUT / 'input-run-audit.json', record)
    return record


def image_provenance() -> dict:
    builds = read(OUT / 'validation-build---cached-dependencies.json')
    assert {item['kind'] for item in builds if item['phase'] == 'build' and item['passed'] is True} == set(IMAGES)
    expected = {path.relative_to(FROZEN / 'environment').as_posix(): sha(path)
        for directory in ('instructions', 'assets') for path in (FROZEN / 'environment' / directory).rglob('*') if path.is_file()}
    write(OUT / 'agent-expected-hashes.json', expected)
    smoke = docker_json(['docker', 'run', '--rm', '--network', 'none', '--mount',
        f'type=bind,source={OUT},target=/validation,readonly', IMAGES['agent'], 'node', '/validation/agent-smoke.cjs'])
    assert smoke['passed'] is True and smoke['no_golden_or_tests'] is True and smoke['native_sqlite'] is True
    write(OUT / 'agent-smoke-results.json', smoke)
    script = 'import hashlib,json;from pathlib import Path;p=Path("/tests");print(json.dumps({f.relative_to(p).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in p.rglob("*") if f.is_file()}))'
    verifier_hashes = docker_json(['docker', 'run', '--rm', '--network', 'none', IMAGES['verifier'], 'python3', '-c', script])
    assert verifier_hashes == {path.relative_to(FROZEN / 'tests').as_posix(): sha(path) for path in (FROZEN / 'tests').rglob('*') if path.is_file()}, 'Verifier image does not contain the exact frozen tests'
    write(OUT / 'verifier-image-tests-hashes.json', verifier_hashes)
    images = {}
    for kind, tag in IMAGES.items():
        current = docker_json(['docker', 'image', 'inspect', tag])[0]
        base = docker_json(['docker', 'image', 'inspect', BASE_IMAGES[kind]])[0]
        assert current['Os'] == base['Os'] == 'linux'
        base_layers = base['RootFS']['Layers']
        assert current['RootFS']['Layers'][:len(base_layers)] == base_layers, ('Cached base image mismatch', tag)
        log = OUT / f'build-{kind}-cached.log'
        assert log.is_file() and log.stat().st_size
        images[kind] = {'tag': tag, 'id': current['Id'], 'created': current['Created'],
            'os': current['Os'], 'architecture': current['Architecture'],
            'cached_base_tag': BASE_IMAGES[kind], 'cached_base_id': base['Id'],
            'rootfs_layers': current['RootFS']['Layers'],
            'assembly_dockerfile_sha256': sha(OUT / ('Dockerfile.local-' + kind)),
            'assembly_log_sha256': sha(log), 'frozen_input_hashes_verified': True}
    record = {'scope': 'Local cached-image assembly; the shipped Dockerfiles have not been clean-built for r17',
        'clean_build_attempted': False, 'clean_build_passed': False, 'images': images,
        'agent_smoke_passed': True, 'verifier_tests_match_frozen': True}
    write(OUT / 'image-provenance.json', record)
    write(OUT / 'image-hashes.json', {value['tag']: value['id'] for value in images.values()})
    return record


def finish() -> None:
    manifest = read(OUT / 'freeze-manifest.json')
    assert sha(ARCHIVE) == manifest['sha256']
    files = archive_files(ARCHIVE)
    assert files == tree(FROZEN) == tree(SOURCE), 'Archive, frozen task and current source differ'
    assert len(files) == manifest['file_count']
    assert read(OUT / 'source-hashes.json') == {name: digest(data) for name, data in files.items()}
    assert manifest['source_before_sha256'] == sha(OUT / 'source-before.zip')
    baseline_contract(files, archive_files(OUT / 'source-before.zip'))
    judges(files)
    checked = checkers()
    groups, boundary, mutants, sources = local_results()
    provenance()
    mapped = coverage(manifest)
    original_run = input_run_audit()
    images = image_provenance()
    audit = {**manifest, 'checks': checked,
        'standard_checks': checked['check-standard']['checks'], 'archive_checks': checked['check-upload']['checks'],
        'local_groups': groups, 'local_group_total': sum(groups.values()), 'boundary_evidence': boundary,
        'recovery_mutants_detected': mutants['detected'], 'all_existing_criterion_weights_unchanged': True,
        'malformed_archive_variants_rejected': 14,
        'input_run_audit': {'reward': original_run['scores']['reward'], 'model': original_run['agent'], 'all_baseline_provenance_matches': True, 'oracle_one_is_user_report_only': True},
        'all_existing_descriptions_unchanged': not bool(mapped['clarified_existing_descriptions']),
        'clarified_existing_descriptions': mapped['clarified_existing_descriptions'],
        'frozen_source_archive_and_provenance_match': True, 'recovery_addendum_hash_verified': True,
        'agent_inputs_match_r17_image': True, 'verifier_tests_match_r17_image': True,
        'cached_image_assembly_passed': True, 'image_provenance': images,
        'clean_build_attempted': False, 'clean_build_passed': False,
        'platform_qc': False, 'fresh_scored_oracle': False, 'fresh_gpt': False,
        'score_evidence_note': 'Scoring checks use synthetic verdicts; browser suites are unpaid local regressions. Existing GPT artifact boundary failures are diagnostics, not a fresh model score. A fresh platform Oracle/GPT/QC evaluation is still required.'}
    write(OUT / 'package-audit.json', audit)
    names = ['package-audit.json', 'freeze-manifest.json', 'source-hashes.json', 'changes.diff',
        'coverage.json', 'check-standard.json', 'check-upload.json', 'agent-expected-hashes.json',
        'input-run-audit.json',
        'agent-smoke-results.json', 'verifier-image-tests-hashes.json', 'image-provenance.json', 'image-hashes.json',
        'build-agent-cached.log', 'build-verifier-cached.log']
    for name in names:
        shutil.copyfile(OUT / name, DELIVERY / name)
    for path in sources:
        name = ('golden-' if path.parent.name == 'validation-boundaries' else 'existing-gpt-' if path.parent.name == 'validation-boundaries-gpt' else '') + path.name
        shutil.copyfile(path, DELIVERY / name)
    shutil.copyfile(OUT / 'validation-harness/prompt-provenance.json', DELIVERY / 'prompt-provenance.json')
    if (OUT / 'README.md').is_file():
        shutil.copyfile(OUT / 'README.md', DELIVERY / 'README.md')
    assert sha(ARCHIVE) == manifest['sha256'] and files == tree(FROZEN) == tree(SOURCE)
    print(json.dumps(audit, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('freeze', 'finish'))
    arguments = parser.parse_args()
    freeze() if arguments.phase == 'freeze' else finish()
