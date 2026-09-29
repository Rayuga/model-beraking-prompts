import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
task = root / 'projects/ridgeline-print-storefront'
result = {'task': task.name, 'scope': 'Actual rebuilt image contents, not paid judging'}
agent_image = 'ridgeline-agent:20260926-rubric-fix'
verifier_image = 'ridgeline-verifier:20260926-rubric-fix'
command = ['docker', 'run', '--rm', '--network', 'none', '--mount',
           f'type=bind,source={root / "deliverables/probe_final_agent_image.js"},target=/local-probe.js,readonly',
           '-e', 'TASK_SLUG=' + task.name, agent_image, 'node', '/local-probe.js']
result['agent'] = json.loads(subprocess.check_output(command, text=True, encoding='utf-8'))
for relative, digest in result['agent']['sourceFiles'].items():
    assert hashlib.sha256((task / 'environment' / relative.lstrip('/')).read_bytes()).hexdigest() == digest, relative
expected = {p.relative_to(task / 'tests').as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (task / 'tests').rglob('*') if p.is_file() and p.name not in {'.dockerignore', 'Dockerfile'}}
program = "import hashlib,json;from pathlib import Path;print(json.dumps({p.relative_to('/tests').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file() and p.name != '.dockerignore'}))"
observed = json.loads(subprocess.check_output(['docker', 'run', '--rm', '--network', 'none', verifier_image, 'python3', '-c', program], text=True, encoding='utf-8'))
assert observed == expected, [k for k in set(observed) | set(expected) if observed.get(k) != expected.get(k)]
result['verifier_source_hashes_match'] = True
result['verifier_source_files'] = len(expected)
result['image_ids'] = {role: subprocess.check_output(['docker', 'image', 'inspect', tag, '--format', '{{.Id}}'], text=True).strip()
                       for role, tag in [('agent', agent_image), ('verifier', verifier_image)]}
Path(__file__).with_name('final_image_evidence.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'agent_passed': True, 'verifier_files': len(expected), 'image_ids': result['image_ids']}, indent=2))
