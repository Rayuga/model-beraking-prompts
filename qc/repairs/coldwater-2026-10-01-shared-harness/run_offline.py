"""Run only pinned offline disposable local proof containers; retain every attempt."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument('mode', choices=['golden', 'matrix', 'refusal', 'style'])
parser.add_argument('--expected-sha', required=True)
parser.add_argument('--case')
parser.add_argument('--scenarios')
parser.add_argument('--skip-golden', action='store_true')
args = parser.parse_args()
run = ROOT / 'qc/runs/coldwater-2026-10-01-shared-harness-fix'
manifest = json.loads((run / 'manifest.json').read_text())
assert len(args.expected_sha) == 64 and manifest['input_sha256'] == args.expected_sha
evidence = run / 'golden'
image = 'sha256:46fefc505dbcabf0d6cb4e54fea8f0880acde2f7896587750af967427598977d'
stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
label = 'selection' if args.case and ',' in args.case else args.case or 'all'
logs = evidence / ('host-' + args.mode + '-' + label + '-' + stamp)
logs.mkdir()
command = ['docker', 'run', '--pull', 'never', '--rm', '--network', 'none', '--shm-size', '1g', '--mount', f'type=bind,source={ROOT / manifest["cache"] / "task"},target=/task,readonly', '--mount', f'type=bind,source={evidence},target=/evidence', '-e', 'CW_MANIFEST=frozen_repair_inputs.json']
if args.case:
    command += ['-e', ('CW_CASES=' if ',' in args.case else 'CW_CASE=') + args.case]
if args.scenarios:
    command += ['-e', 'CW_SCENARIOS=' + args.scenarios]
if args.skip_golden:
    command += ['-e', 'CW_SKIP_GOLDEN=1']
launchers={'golden':'launch_workflow.py','matrix':'launch_lifecycle_matrix.py','refusal':'launch_refusal_matrix.py'}
if args.mode == 'style':
    command += ['--mount', f'type=bind,source={Path(__file__).resolve().parent / "style-probe"},target=/probe,readonly']
command += [image, 'python3', '/probe/launch.py' if args.mode == 'style' else '/evidence/drivers/' + launchers[args.mode]]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
binding = {'round_input_sha256': manifest['input_sha256'], 'image_id': image, 'actual_command_argv': command, 'network': 'none', 'published_ports': [], 'readonly_task': True, 'provider_or_platform': False, 'started_at': stamp, 'frozen_inputs_sha256': sha(evidence / 'frozen_repair_inputs.json'), 'driver_sha256': {p.name: sha(p) for p in (evidence / 'drivers').iterdir() if p.is_file()}}
(logs / 'command.json').write_text(json.dumps(binding, indent=2) + '\n')
inspect = subprocess.run(['docker', 'image', 'inspect', image], capture_output=True, text=True)
(logs / 'image-inspect.json').write_text(inspect.stdout)
(logs / 'image-inspect-stderr.log').write_text(inspect.stderr)
assert inspect.returncode == 0, inspect.stderr
assert json.loads(inspect.stdout)[0]['Id'] == image
clock = time.monotonic()
with (logs / 'console.log').open('w', encoding='utf-8') as output:
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
    for line in process.stdout:
        output.write(line)
        output.flush()
        print(line, end='', flush=True)
    code = process.wait()
binding.update(returncode=code, wall_seconds=time.monotonic() - clock, console_sha256=sha(logs / 'console.log'))
(logs / 'RESULT.json').write_text(json.dumps(binding, indent=2) + '\n')
print(json.dumps({'host_evidence': str(logs.relative_to(ROOT)), 'returncode': code}))
raise SystemExit(code)
