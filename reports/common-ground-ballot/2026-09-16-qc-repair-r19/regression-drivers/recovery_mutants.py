"""Local negative recovery checks; this helper is not part of the upload task.

Run --check-snippets to validate the five precise edits without Docker.
Run --all --cached-dependencies to run each fault in its own disposable container.
Only the provisioned /app copy is mutated. Shipping solution files stay read-only.
The expected first failed browser group and its retained upstream exchanges must
both match; a build/launch error or unrelated browser failure is not a detection.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess


REPORT = Path(__file__).resolve().parent
ROOT = REPORT.parents[2] if len(REPORT.parents) > 2 else Path('/task')

MUTANTS = {
    'pending_cleared_on_restore': {
        'criterion': 'durable_pending_staff_work',
        'description': 'Discard the saved queue when the authenticated workspace is restored.',
        'edits': [(
            'function showApp() {\n  announceIdentity(state.user.id);',
            'function showApp() {\n  announceIdentity(state.user.id);\n'
            '  for (const entry of pendingFor(state.user.id)) localStorage.removeItem(pendingKey(entry.actorId, entry.id));',
        )],
        'group': 'create uncertainty survives reload and process restart without automatic replay',
        'minimum_passed': 0,
        'error_contains': 'Timeout',
    },
    'retry_gets_new_identifier': {
        'criterion': 'immutable_pending_retry',
        'description': 'Change only an explicit Retry into a fresh operation while retaining its business inputs.',
        'edits': [(
            'async function sendPending(entry) {',
            'async function sendPending(entry, isRetry = false) {',
        ), (
            'const result = await sendPending(entry);',
            'const result = await sendPending(entry, true);',
        ), (
            'response = await fetch(saved.url, { method: saved.method, headers: { "Content-Type": "application/json" }, body: saved.body });',
            'response = await fetch(saved.url, { method: saved.method, headers: { "Content-Type": "application/json" }, body: isRetry ? JSON.stringify({ ...JSON.parse(saved.body), operation_id: operationId() }) : saved.body });',
        )],
        'group': 'create Retry recovers its original success without overwriting a newer edit',
        'minimum_passed': 1,
        'error_contains': 'Retry changed method, target, or serialized inputs',
    },
    'one_resolution_clears_queue': {
        'criterion': 'independent_pending_actions',
        'description': 'Resolve every actor-owned entry when one selected operation is acknowledged.',
        'edits': [(
            'localStorage.removeItem(pendingKey(saved.actorId, saved.id));',
            'for (const pending of pendingFor(saved.actorId)) localStorage.removeItem(pendingKey(pending.actorId, pending.id));',
        )],
        'group': 'retrying one pending action leaves the other recognizable and unsent',
        'minimum_passed': 10,
        'error_contains': 'Timeout',
    },
    'refusal_skips_current_read': {
        'criterion': 'immutable_pending_retry',
        'description': 'Show the recovered original refusal but leave the current record stale in the UI.',
        'edits': [(
            'if (error.definitive && entry) await refreshRecovered(entry, error, user);',
            'if (error.definitive && entry) notify(`${error.message} The original action was refused. Review the current record before starting a new action.`, "error");',
        )],
        'group': 'saved stale-revision refusal survives newer state and resolves only its original attempt',
        'minimum_passed': 7,
        'error_contains': 'Recovery stale final current',
    },
    'staff_tray_shared_with_other_accounts': {
        'criterion': 'pending_actor_isolation',
        'description': 'Expose the Coordinator recovery queue to every signed-in role while keeping write authorization intact.',
        'edits': [(
            '  const actorId = state.user?.id;\n  if (!currentCoordinator(actorId)) {\n    tray.classList.add("hidden");',
            '  const actorId = state.user ? "user-ruth" : null;\n  if (!state.user) {\n    tray.classList.add("hidden");',
        )],
        'group': 'pending details and requests stay private across Arun and both Member sign-ins',
        'minimum_passed': 13,
        'error_contains': 'arun sees staff recovery',
    },
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def changed_source(source: str, name: str) -> str:
    for old, new in MUTANTS[name]['edits']:
        occurrences = source.count(old)
        assert occurrences == 1, (name, 'mutation anchor must match exactly once', occurrences, old)
        source = source.replace(old, new, 1)
    return source


def mutate(app: Path, name: str) -> dict:
    """Mutate the disposable container app, never a host source checkout."""
    assert app.resolve() == Path('/app'), 'Mutants may only modify the provisioned container /app'
    target = app / 'public/app.js'
    before = sha256(target)
    target.write_text(changed_source(target.read_text(encoding='utf-8'), name), encoding='utf-8')
    subprocess.run(['node', '--check', str(target)], check=True)
    return {'before_sha256': before, 'mutant_sha256': sha256(target)}


def exchange(out: Path, name: str, status: int | None = None) -> dict:
    value = json.loads((out / f'{name}-exchange.json').read_text(encoding='utf-8'))
    assert value['request']['method'] in ('POST', 'PATCH'), (name, value)
    assert value['request']['path'].startswith('/api/'), (name, value)
    assert json.loads(value['request']['body'])['operation_id'], name
    if status is not None:
        assert value['status'] == status, (name, value['status'], status)
    return value


def assert_expected_failure(out: Path, name: str) -> dict:
    spec = MUTANTS[name]
    report = json.loads((out / 'recovery-results.json').read_text(encoding='utf-8'))
    failed = [item for item in report['results'] if not item['passed']]
    assert len(failed) == 1, ('exactly one recorded first failure required', failed)
    assert failed[0]['name'] == spec['group'], ('unexpected failure', name, failed[0])
    assert spec['error_contains'] in failed[0]['error'], ('unexpected failure evidence', name, failed[0])
    assert report['passed'] >= spec['minimum_passed'], ('earlier positive controls were not completed', name, report)
    assert report['pageErrors'] == [], ('uncaught browser error is not a valid mutant witness', name, report['pageErrors'])

    create = exchange(out, 'create-lost', 201)
    assert create['delivery'] == 'drop' and create['response']['ballot']['id']
    if name == 'retry_gets_new_identifier':
        replay = exchange(out, 'create-retry', 201)
        original_body, replay_body = map(json.loads, (create['request']['body'], replay['request']['body']))
        assert original_body.pop('operation_id') != replay_body.pop('operation_id')
        assert original_body == replay_body, 'The negative case must change only retry identity'
        assert create['request']['path'] == replay['request']['path']
        assert replay['replay'] is None, 'The changed identifier unexpectedly returned the original receipt'
    elif name == 'one_resolution_clears_queue':
        original = exchange(out, 'unreadable-create', 201)
        other = exchange(out, 'server-error-create', 201)
        replay = exchange(out, 'queue-one-retry', 201)
        assert original['delivery'] == 'unreadable' and other['delivery'] == 'server-error'
        assert original['request'] == replay['request'] and replay['replay'] == 'true'
        assert original['response']['ballot']['id'] != other['response']['ballot']['id']
    elif name == 'refusal_skips_current_read':
        original = exchange(out, 'stale-refusal-lost', 409)
        replay = exchange(out, 'stale-refusal-retry', 409)
        newer = exchange(out, 'stale-newer-two', 200)
        assert original['request'] == replay['request'] and original['response'] == replay['response']
        assert replay['replay'] == 'true'
        assert newer['response']['ballot']['title'] == 'Recovery stale final current'
    elif name == 'staff_tray_shared_with_other_accounts':
        owned = exchange(out, 'owner-lost', 201)
        assert owned['response']['ballot']['title'] == 'Recovery private coordinator record'
        assert owned['delivery'] == 'drop'
    return {'name': name, 'criterion': spec['criterion'], 'detected': True,
            'expected_first_failure': spec['group'], 'positive_groups_before_failure': report['passed'],
            'failure': failed[0]['error']}


def inside(name: str) -> None:
    """Run the existing browser driver with a provision-only mutation wrapper."""
    out = Path('/results')
    out.mkdir(exist_ok=True)
    golden = Path('/golden/public/app.js')
    golden_before = sha256(golden)
    module_spec = importlib.util.spec_from_file_location('recovery_mutant_local_runner', '/validation/run-local.py')
    assert module_spec and module_spec.loader
    local = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(local)
    original_provision = local.provision
    hashes = {}

    def provision():
        original_provision()
        hashes.update(mutate(Path('/app'), name))

    local.provision = provision
    try:
        local.browser(script='recovery-regression.cjs')
    except subprocess.CalledProcessError as error:
        assert error.cmd == ['node', '/validation/recovery-regression.cjs'], ('infrastructure failed', error.cmd)
    else:
        raise AssertionError(f'Mutant survived: {name}')
    result = assert_expected_failure(out, name)
    assert sha256(golden) == golden_before, 'Read-only golden source changed'
    result.update(hashes, golden_sha256=golden_before)
    (out / 'mutant-verdict.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print('DETECTED', name, result['expected_first_failure'], flush=True)


def run_host(name: str, task: Path, image: str) -> dict:
    out = REPORT / 'recovery-mutants' / name
    out.mkdir(parents=True, exist_ok=True)
    command = ['docker', 'run', '--rm', '--network', 'none',
               '--env', 'NO_PROXY=localhost,127.0.0.1,::1', '--env', 'no_proxy=localhost,127.0.0.1,::1']
    for source, target, readonly in [(task / 'solution', '/golden', True), (task, '/task', True),
                                     (REPORT, '/validation', True), (out, '/results', False)]:
        command += ['--mount', f'type=bind,source={source},target={target}' + (',readonly' if readonly else '')]
    command += [image, 'python3', '/validation/recovery_mutants.py', '--inside', name]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
    (out / 'runner.log').write_text(result.stdout + '\n' + result.stderr, encoding='utf-8')
    assert result.returncode == 0, (name, 'mutant check failed or produced an unrelated failure', result.stdout[-2000:], result.stderr[-2000:])
    verdict = json.loads((out / 'mutant-verdict.json').read_text(encoding='utf-8'))
    print('DETECTED', name, flush=True)
    return verdict


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inside', choices=MUTANTS)
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--names', nargs='+', choices=MUTANTS)
    parser.add_argument('--check-snippets', action='store_true')
    parser.add_argument('--cached-dependencies', action='store_true')
    parser.add_argument('--frozen', action='store_true')
    parser.add_argument('--jobs', type=int, choices=(1, 2), default=2)
    args = parser.parse_args()
    if args.inside:
        inside(args.inside)
        return
    task = REPORT / 'frozen/common-ground-ballot' if args.frozen else ROOT / 'projects/common-ground-ballot'
    source_path = task / 'solution/public/app.js'
    before = sha256(source_path)
    if args.check_snippets:
        previews = REPORT / 'recovery-mutant-previews'
        previews.mkdir(exist_ok=True)
        original = source_path.read_text(encoding='utf-8')
        checks = []
        for name, spec in MUTANTS.items():
            preview = previews / f'{name}.js'
            preview.write_text(changed_source(original, name), encoding='utf-8')
            subprocess.run(['node', '--check', str(preview)], check=True)
            checks.append({'name': name, 'criterion': spec['criterion'], 'snippet_anchors_exact': True,
                           'javascript_parses': True, 'preview_sha256': sha256(preview)})
        assert sha256(source_path) == before
        (previews / 'checks.json').write_text(json.dumps({'golden_sha256': before, 'checks': checks}, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(checks, indent=2))
        return
    names = list(MUTANTS) if args.all else args.names
    if not names:
        print(json.dumps({name: {key: value for key, value in spec.items() if key != 'edits'} for name, spec in MUTANTS.items()}, indent=2))
        return
    image = 'ballot-verifier:20260915-r17' + ('-local' if args.cached_dependencies else '')
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        results = list(pool.map(lambda name: run_host(name, task, image), names))
    assert sha256(source_path) == before, 'Shipping golden source changed while checks were running'
    (REPORT / 'recovery-mutants-results.json').write_text(json.dumps({'golden_sha256': before,
        'detected': len(results), 'results': results}, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
