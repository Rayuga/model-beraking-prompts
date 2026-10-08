"""Focused checks on repaired bytes. No provider execution or QC-clearance claim."""
import concurrent.futures
import hashlib
import json
import re
import subprocess
import sys
import time
import tomllib
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RUN = Path(__file__).resolve().parent
LOCAL = RUN / 'local'
TASK = ROOT / 'projects/hireops-recruiting-operations/hireops-recruiting-operations'
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'scripts'))
import qc_pipeline

sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source = {p.relative_to(TASK).as_posix(): sha(p) for p in TASK.rglob('*') if p.is_file()}
original = json.loads((ROOT / 'deliverables/hireops-recruiting-operations/2026-10-01-current/candidate_manifest.json').read_text())['source_sha256']
structural = qc_pipeline.preflight(TASK, ROOT / qc_pipeline.TEMPLATE)
criteria = [c for p in (TASK / 'tests').glob('*/*/judge.toml') for c in tomllib.loads(p.read_text(), parse_float=Decimal)['criterion']]
ids = {c['id'] for c in criteria}
references = set()
for p in (TASK / 'tests').rglob('*'):
    if p.is_file() and p.suffix in {'.md', '.toml'}:
        references.update(re.findall(r'\bhro_[a-z0-9_]+\b', p.read_text()))
structural['dangling_criterion_references'] = sorted(references - ids)
structural['golden_unchanged'] = all(source[p] == h for p, h in original.items() if p.startswith('solution/'))
structural['functional_weight'] = str(sum(c['weight'] for c in tomllib.loads((TASK / 'tests/scored/functional/judge.toml').read_text(), parse_float=Decimal)['criterion']))
assert structural['passed'] and not structural['dangling_criterion_references'] and structural['golden_unchanged']
assert Decimal(structural['functional_weight']) == Decimal(45)
(RUN / 'structural.json').write_text(json.dumps(structural, indent=2) + '\n')
records = []

def run(name, command, timeout=180):
    started = time.time()
    p = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
    log = LOCAL / (name + '.log')
    log.write_bytes(p.stdout)
    result = {'name': name, 'command': command, 'exit_code': p.returncode,
              'duration_seconds': time.time() - started, 'log': log.relative_to(ROOT).as_posix(), 'log_sha256': sha(log)}
    print(json.dumps({k: result[k] for k in ('name', 'exit_code', 'duration_seconds')}), flush=True)
    return result

builds = [('agent-build-attempt2', ['docker', 'build', '-t', 'hireops-agent:20261001-repaired', str(TASK / 'environment')]),
          ('verifier-build-attempt2', ['docker', 'build', '-t', 'hireops-verifier:20261001-repaired', str(TASK / 'tests')])]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    records.extend(pool.map(lambda args: run(*args), builds))
assert all(r['exit_code'] == 0 for r in records)

base = ['docker', 'run', '--rm', '--network', 'none', '-e', 'NODE_PATH=/usr/local/lib/node_modules',
        '-e', 'LITELLM_LOCAL_MODEL_COST_MAP=True', '-v', str(LOCAL) + ':/evidence',
        '-v', str(TASK / 'solution') + ':/solution:ro']
image = 'hireops-verifier:20261001-repaired'
jobs = []
for kind in ('domain', 'ui'):
    cmd = base + ['-v', str(ROOT / 'scripts') + ':/work/scripts:ro',
                  '-v', str(TASK.parent) + ':/work/projects/hireops-recruiting-operations:ro',
                  '--entrypoint', 'bash', image, '/evidence/run-local.sh', kind]
    jobs.append((kind, cmd))
jobs += [('configured-inspection', base + ['--entrypoint', 'python3', image, '/evidence/inspect-configured.py']),
         ('coverage-witness', base + ['--entrypoint', 'node', image, '/evidence/coverage-witness.cjs']),
         ('gate-witness', base + ['--entrypoint', 'node', image, '/evidence/gate-witness.cjs'])]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    records.extend(pool.map(lambda args: run(*args), jobs))
images = {}
for image_name in ('hireops-agent:20261001-repaired', image):
    images[image_name] = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image_name]))[0]['Id']
current = {p.relative_to(TASK).as_posix(): sha(p) for p in TASK.rglob('*') if p.is_file()}
assert current == source
report = {'kind': 'Focused local checks only; no configured provider grade, Oracle, Luna or new full QC round',
          'passed': all(r['exit_code'] == 0 for r in records), 'source_sha256': source,
          'source_unchanged_during_checks': current == source, 'images': images, 'commands': records}
(RUN / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
assert report['passed']
