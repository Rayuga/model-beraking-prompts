"""One fresh isolated real-browser restart; synthetic orchestration is not an Oracle."""
import hashlib
import json
from pathlib import Path
import subprocess

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TARGET = OUT / 'restart-full'
TARGET.mkdir(exist_ok=True)
(TARGET / 'logs').mkdir(exist_ok=True)
for name in ('harness_boot.sh', 'harness_rewardkit_stub.py', 'browser-restart-check.cjs'):
    source = (OUT / 'restart' / name).read_text(encoding='utf-8')
    if name == 'browser-restart-check.cjs':
        old = '      const after = await saved();\n'
        assert source.count(old) == 1
        source = source.replace(old, old + '      assert.deepEqual(after.find(row => row.id === before.primary.id), updated);\n')
        source = source.replace('without altering the sibling', 'with the new primary confirmed by a fresh read and without altering the sibling')
    (TARGET / name).write_text(source, encoding='utf-8', newline='\n')
command = ['docker', 'run', '--rm', '--name', 'colderwater-contract-restart-20260927', '--network', 'none',
    '--mount', f'type=bind,source={ROOT / "projects/colderwater-playground-devtools"},target=/source-task,readonly',
    '--mount', f'type=bind,source={TARGET},target=/local-evidence,readonly',
    '--mount', f'type=bind,source={TARGET / "logs"},target=/logs/verifier',
    '-e', 'HARNESS_CASE=golden', '-e', 'HARNESS_SECRET=must-not-reach-app',
    '-e', 'REWARDKIT_JUDGE=local-harness-stub', '-e', 'REWARDKIT_MODEL=not-a-real-model',
    'colderwater-verifier:20260927-fullqc', 'bash', '/local-evidence/harness_boot.sh']
process = subprocess.run(command, text=True, capture_output=True, timeout=300)
(TARGET / 'execution.log').write_text(process.stdout + process.stderr, encoding='utf-8')
phases = []
for line in process.stdout.splitlines():
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        continue
    if 'phase' in data:
        phases.append(data)
result = {'exit_code': process.returncode, 'passed': process.returncode == 0 and len(phases) == 2
          and all(p['passed'] for p in phases), 'phases': phases, 'command': command,
          'synthetic_score_is_not_oracle': True, 'real_chromium_actions_and_canonical_restart_mcp': True,
          'script_sha256': hashlib.sha256((TARGET / 'browser-restart-check.cjs').read_bytes()).hexdigest(),
          'functional_source_sha256': hashlib.sha256((ROOT / 'projects/colderwater-playground-devtools/tests/scored/functional/judge.toml').read_bytes()).hexdigest()}
(TARGET / 'restart-witness-results.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
raise SystemExit(0 if result['passed'] else 1)
