import hashlib
import json
from pathlib import Path
import subprocess
import time

root = Path.cwd()
run = root / 'qc/runs/hireops-2026-10-01-transaction-hardening-r3'
out = run / 'per-row-review/evidence/20'
manifest = json.loads((run / 'manifest.json').read_text())
frozen = root / manifest['cache'] / 'task'
binding_file = run / 'committed-reference.json'
binding = json.loads(binding_file.read_text())
index_file = run / 'raw-evidence-index.json'
index = json.loads(index_file.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
binding_entry = next(e for e in index['entries'] if e['path'] == binding_file.relative_to(root).as_posix())
assert sha(binding_file) == binding_entry['sha256']
assert manifest['input_sha256'] == binding['input_sha256'] == index['input_sha256']
git_checks = []
for name, expected in manifest['inputs']['task'].items():
    command = ['git', 'show', f'{binding["commit"]}:{manifest["task"]}/{name}']
    data = subprocess.check_output(command)
    actual = hashlib.sha256(data).hexdigest()
    assert actual == expected == sha(frozen / name) == binding['task_sha256'][name], name
    git_checks.append({'path': name, 'sha256': actual})
image = 'hireops-verifier:20261001-hard-r3'
inspection_command = ['docker', 'image', 'inspect', image, '--format', '{{.Id}}']
image_id = subprocess.check_output(inspection_command, text=True).strip()
command = ['docker', 'run', '--rm', '--name', 'hireops-row20-determinism-r3', '--network', 'none', '--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev', '--mount', f'type=bind,source={frozen / "solution/app"},target=/frozen,readonly', '--mount', f'type=bind,source={out},target=/probe,readonly', '--entrypoint', 'node', image, '/probe/seed-probe.cjs']
start = time.monotonic()
result = subprocess.run(command, capture_output=True, text=True, timeout=90)
(out / 'stdout.json').write_text(result.stdout, encoding='utf-8')
(out / 'stderr.log').write_text(result.stderr, encoding='utf-8')
record = {
    'input_sha256': manifest['input_sha256'],
    'scope': 'Read-only Git byte comparison and isolated actual SQLite seed/rule execution; not configured judging or a model/portal score.',
    'commit': binding['commit'], 'git_blob_command_pattern': f'git show {binding["commit"]}:{manifest["task"]}/<path>',
    'git_checks': git_checks, 'all_37_committed_files_match_frozen': len(git_checks) == 37,
    'raw_index_sha256_at_read': sha(index_file), 'verified_index_artifact': {'path':binding_file.relative_to(root).as_posix(),'sha256':sha(binding_file)},
    'image': image, 'image_id': image_id, 'image_inspect_command':inspection_command,
    'command': command, 'elapsed_seconds': time.monotonic()-start, 'exit_code':result.returncode,
    'artifacts': {p.relative_to(root).as_posix():sha(p) for p in [out/'seed-probe.cjs',out/'run-probe.py',out/'stdout.json',out/'stderr.log']}
}
(out / 'observations.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'exit_code':result.returncode,'image_id':image_id,'files_verified':len(git_checks),'stdout':result.stdout,'stderr':result.stderr},indent=2))
raise SystemExit(result.returncode)
