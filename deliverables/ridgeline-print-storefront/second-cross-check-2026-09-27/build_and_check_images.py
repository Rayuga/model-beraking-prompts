"""Build frozen source under new tags and verify shipped public/verifier bytes."""
import hashlib
import json
from pathlib import Path
import subprocess
import time

root = Path.cwd()
cases = [('ridgeline-print-storefront', 'ridgeline', Path(__file__).resolve().parent)]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_snapshot(task):
    return {path.relative_to(task).as_posix(): digest(path)
            for subtree in ['environment', 'tests']
            for path in (task / subtree).rglob('*') if path.is_file()}


for slug, prefix, out in cases:
    task = root / 'projects' / slug
    out.mkdir(parents=True, exist_ok=True)
    report = {'task': slug, 'scope': 'Frozen-source actual image build and content assertions. No paid judging.', 'started_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'source_before_build': source_snapshot(task), 'builds': []}
    try:
        for role, directory in [('agent', 'environment'), ('verifier', 'tests')]:
            tag = f'{prefix}-{role}:20260927-second-crosscheck'
            command = ['docker', 'build', '--progress', 'plain', '--tag', tag, str(task / directory)]
            log_path = out / f'build-{role}-second-crosscheck.log'
            started = time.monotonic()
            with log_path.open('w', encoding='utf-8') as log:
                log.write(json.dumps(command) + '\n')
                log.flush()
                built = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=1800)
            assert built.returncode == 0, f'{tag} build failed; see {log_path}'
            image_id = subprocess.check_output(['docker', 'image', 'inspect', tag, '--format', '{{.Id}}'], text=True).strip()
            report['builds'].append({'role': role, 'tag': tag, 'image_id': image_id, 'seconds': round(time.monotonic() - started, 2), 'log': log_path.name})
            print(json.dumps({'task': slug, 'built': tag, 'image_id': image_id}), flush=True)

        agent_image = f'{prefix}-agent:20260927-second-crosscheck'
        probe = root / 'deliverables/probe_final_agent_image.js'
        report['agent'] = json.loads(subprocess.check_output(['docker', 'run', '--rm', '--network', 'none', '--mount', f'type=bind,source={probe},target=/local-probe.js,readonly', '-e', 'TASK_SLUG=' + slug, agent_image, 'node', '/local-probe.js'], text=True, encoding='utf-8', timeout=120))
        expected_public = {'/' + path.relative_to(task / 'environment').as_posix(): digest(path)
                           for directory in ['instructions', 'assets']
                           for path in (task / 'environment' / directory).rglob('*') if path.is_file()}
        assert report['agent']['sourceFiles'] == expected_public, 'Agent public instructions/assets differ from frozen source'
        report['agent_public_file_count'] = len(expected_public)
        report['agent_public_hashes_match'] = True

        expected_tests = {path.relative_to(task / 'tests').as_posix(): digest(path)
                          for path in (task / 'tests').rglob('*')
                          if path.is_file() and path.name not in {'.dockerignore', 'Dockerfile'}}
        assert len(expected_tests) == 15, f'Expected fifteen shipped verifier files, got {len(expected_tests)}'
        program = "import hashlib,json;from pathlib import Path;print(json.dumps({'files':{p.relative_to('/tests').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file() and p.name != '.dockerignore'},'private_app_present':Path('/app/server.js').exists(),'solution_present':Path('/solution').exists()}))"
        verifier_image = f'{prefix}-verifier:20260927-second-crosscheck'
        observed = json.loads(subprocess.check_output(['docker', 'run', '--rm', '--network', 'none', verifier_image, 'python3', '-c', program], text=True, encoding='utf-8', timeout=120))
        assert observed['files'] == expected_tests, {'different': [key for key in set(observed['files']) | set(expected_tests) if observed['files'].get(key) != expected_tests.get(key)]}
        assert not observed['private_app_present'] and not observed['solution_present'], 'Verifier contains a golden app/solution'
        report['verifier_source_hashes_match'] = True
        report['verifier_source_files'] = len(expected_tests)
        report['verifier_source_hashes'] = observed['files']
        report['verifier_private_solution_present'] = False
        report['chromium_version'] = subprocess.check_output(['docker', 'run', '--rm', '--network', 'none', verifier_image, '/usr/local/bin/chromium', '--version'], text=True, encoding='utf-8', timeout=120).strip()
        assert '152.' in report['chromium_version'], report['chromium_version']
        report['source_unchanged_during_build'] = source_snapshot(task) == report['source_before_build']
        assert report['source_unchanged_during_build'], 'Frozen source changed during image build/check'
        report['passed'] = True
        print(json.dumps({'task': slug, 'agent_passed': True, 'public_files': len(expected_public), 'verifier_files': len(expected_tests), 'chromium': report['chromium_version']}), flush=True)
    except Exception as error:
        report['passed'] = False
        report['error'] = str(error)
        raise
    finally:
        report['finished_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        (out / 'final_image_evidence.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
