from pathlib import Path
import concurrent.futures, hashlib, json, shutil, subprocess, time

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = HERE / 'post-r2-local'
OUT.mkdir(exist_ok=True)
TASK = ROOT / 'projects/hireops-recruiting-operations/hireops-recruiting-operations'
OLD = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r2'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = {p.relative_to(TASK).as_posix(): sha(p) for p in TASK.rglob('*') if p.is_file()}
assert before == json.loads((HERE / 'round2-repairs.json').read_text())['task_sha256']

for name in ['install-lifecycle.py', 'targeted-golden.cjs', 'partial-recovery.cjs']:
    shutil.copyfile(OLD / 'local' / name, OUT / name)
s = (OLD / 'per-row-review/evidence/19/install-isolation.py').read_text()
s = s.replace("assert results['fresh_with_sleeper']['returncode'] != 0", "assert results['fresh_with_sleeper']['returncode'] == 0")
s = s.replace("assert not results['fresh_with_sleeper']['server_exists']", "assert results['fresh_with_sleeper']['server_exists']")
(OUT / 'install-isolation.py').write_bytes(s.encode('utf-8'))

image = 'hireops-verifier:20261001-hard-r2'
base = ['docker', 'run', '--rm', '--network', 'none', '-e', 'NODE_PATH=/usr/local/lib/node_modules',
        '-v', str(TASK / 'solution') + ':/solution:ro', '-v', str(OUT) + ':/evidence']
jobs = []
for name in ['install-isolation', 'install-lifecycle']:
    jobs.append((name, base + ['--entrypoint', 'python3', image, '/evidence/' + name + '.py']))
for name in ['targeted-golden', 'partial-recovery']:
    jobs.append((name, base + ['--entrypoint', 'node', image, '/evidence/' + name + '.cjs']))

def run(job):
    name, args = job
    start = time.monotonic()
    p = subprocess.run(args, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=240)
    log = OUT / (name + '.log')
    log.write_bytes(p.stdout)
    result = {'name': name, 'command': args, 'exit_code': p.returncode,
              'seconds': time.monotonic() - start, 'log': log.relative_to(ROOT).as_posix(), 'sha256': sha(log)}
    print(json.dumps(result), flush=True)
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(run, jobs))
after = {p.relative_to(TASK).as_posix(): sha(p) for p in TASK.rglob('*') if p.is_file()}
assert before == after
record = {'scope': 'Post-R2 installer defect repair, normal lifecycle/restart, golden display/recovery and isolated recovery witness only. No provider grade.',
          'source_sha256': before, 'source_unchanged': True,
          'runtime_image': json.loads(subprocess.check_output(['docker', 'image', 'inspect', image]))[0]['Id'],
          'commands': results, 'passed': all(r['exit_code'] == 0 for r in results)}
(OUT / 'verification.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
assert record['passed']
