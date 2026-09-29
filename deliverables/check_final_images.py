import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
for slug, tag, directory in [
    ('ridgeline-print-storefront', 'ridgeline', 'hardening-2026-09-26-round2'),
    ('colderwater-playground-devtools', 'colderwater', 'hardening-2026-09-26')]:
    task = root / 'projects' / slug
    result = {'task': slug}
    image = tag + '-agent:20260926-hardening'
    command = ['docker', 'run', '--rm', '--network', 'none', '--mount',
               f'type=bind,source={root / "deliverables/probe_final_agent_image.js"},target=/local-probe.js,readonly',
               '-e', 'TASK_SLUG=' + slug, image, 'node', '/local-probe.js']
    result['agent'] = json.loads(subprocess.check_output(command, text=True, encoding='utf-8'))
    for relative, digest in result['agent']['sourceFiles'].items():
        assert hashlib.sha256((task / 'environment' / relative.lstrip('/')).read_bytes()).hexdigest() == digest, relative
    expected = {}
    for source in (task / 'tests').rglob('*'):
        if source.is_file() and source.name not in {'.dockerignore', 'Dockerfile'}:
            expected[source.relative_to(task / 'tests').as_posix()] = hashlib.sha256(source.read_bytes()).hexdigest()
    program = "import hashlib,json;from pathlib import Path;print(json.dumps({p.relative_to('/tests').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file() and p.name != '.dockerignore'}))"
    image = tag + '-verifier:20260926-hardening'
    observed = json.loads(subprocess.check_output(['docker', 'run', '--rm', '--network', 'none', image, 'python3', '-c', program], text=True, encoding='utf-8'))
    assert observed == expected, {'task': slug, 'different': [key for key in set(observed) | set(expected) if observed.get(key) != expected.get(key)]}
    result['verifier_source_hashes_match'] = True
    result['verifier_source_files'] = len(expected)
    result['image_ids'] = {}
    for role in ('agent', 'verifier'):
        result['image_ids'][role] = subprocess.check_output(['docker', 'image', 'inspect', tag + '-' + role + ':20260926-hardening', '--format', '{{.Id}}'], text=True).strip()
    target = root / 'deliverables' / slug / directory / 'final_image_evidence.json'
    target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'task': slug, 'agent_passed': True, 'verifier_source_hashes_match': True, 'images': result['image_ids']}))
