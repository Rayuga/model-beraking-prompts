import argparse
import hashlib
import json
import stat
import sys
import tempfile
import tomllib
import zipfile
from decimal import Decimal
from pathlib import Path, PurePosixPath

parser = argparse.ArgumentParser()
parser.add_argument('task')
parser.add_argument('--out', required=True)
args = parser.parse_args()
task = Path(args.task).resolve()
out = Path(args.out).resolve()
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from check_public_criterion_ids import scan_task
from check_public_grader_terms import scan_task as scan_grader_terms
from check_public_network_policy import scan_task as scan_network_policy
from check_colderwater_regressions import check_task as check_colderwater

if task.name == 'colderwater-playground-devtools':
    regressions = check_colderwater(task)
    if not regressions['passed']:
        raise SystemExit('Packaging blocked: known Colderwater contract regression: ' + ', '.join(c['name'] for c in regressions['checks'] if not c['passed']))

hygiene = scan_task(task)
if not hygiene['passed']:
    raise SystemExit('Packaging blocked: public instructions contain criterion IDs: ' + ', '.join(hygiene['colliding_ids']))
grader_terms = scan_grader_terms(task)
if not grader_terms['passed']:
    raise SystemExit('Packaging blocked: inspect internal grading terms in public instructions: ' + ', '.join(sorted({m['term'] for m in grader_terms['matches']})))
network_policy = scan_network_policy(task)
if not network_policy['passed']:
    raise SystemExit('Packaging blocked: public network profile conflicts with app browser-asset policy')
out.mkdir(parents=True, exist_ok=True)
archive = out / (task.name + '.zip')
forbidden = {'.git', '.gitignore', '.packageignore', 'node_modules', '__pycache__', 'coverage.json', 'SHA256SUMS.txt', '.env', 'reward.toml'}
manifest = {}
files = sorted(p for p in task.rglob('*') if p.is_file())
for source in files:
    relative = source.relative_to(task)
    assert not set(relative.parts) & forbidden, relative
    assert source.suffix.lower() not in {'.db', '.sqlite', '.sqlite3', '.xlsx', '.zip', '.pyc', '.log'}, relative
    assert not source.is_symlink(), relative
    if source.suffix == '.sh':
        assert b'\r' not in source.read_bytes(), relative
    manifest[relative.as_posix()] = hashlib.sha256(source.read_bytes()).hexdigest()
for required in ('instruction.md', 'task.toml', 'environment/Dockerfile', 'environment/assets/seed_data.json', 'solution/solve.sh', 'solution/app/server.js', 'tests/.dockerignore', 'tests/Dockerfile', 'tests/test.sh', 'tests/app_context.md', 'tests/scoring.toml', 'tests/tools/score.py', 'tests/tools/restart_mcp.py'):
    assert required in manifest, required
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for source in files:
        member = zipfile.ZipInfo(task.name + '/' + source.relative_to(task).as_posix())
        member.create_system = 3
        member.external_attr = (stat.S_IFREG | (0o755 if source.suffix == '.sh' else 0o644)) << 16
        member.compress_type = zipfile.ZIP_DEFLATED
        bundle.writestr(member, source.read_bytes())
sha = hashlib.sha256(archive.read_bytes()).hexdigest()
extraction_workspace = tempfile.TemporaryDirectory(prefix='webdev-archive-check-')
extracted = Path(extraction_workspace.name)
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert len(bundle.namelist()) == len(files)
    for member in bundle.infolist():
        path = PurePosixPath(member.filename)
        assert path.parts[0] == task.name and '..' not in path.parts and '\\' not in member.filename
        if path.suffix == '.sh':
            assert (member.external_attr >> 16) & 0o111
    bundle.extractall(extracted)
    for relative, digest in manifest.items():
        assert hashlib.sha256((extracted / task.name / relative).read_bytes()).hexdigest() == digest, relative
configuration = tomllib.loads((extracted / task.name / 'task.toml').read_text(encoding='utf-8'))
assert scan_task(extracted / task.name)['passed'], 'Extracted archive has criterion-ID collisions'
assert scan_grader_terms(extracted / task.name)['passed'], 'Extracted archive has internal grading terms in public prose'
assert scan_network_policy(extracted / task.name)['passed'], 'Extracted archive conflicts with public browser-asset policy'
if task.name == 'colderwater-playground-devtools':
    assert check_colderwater(extracted / task.name)['passed'], 'Extracted archive has a known Colderwater contract regression'
assert configuration['task']['name'] == 'turing/' + task.name
dimensions = {}
for source in (extracted / task.name / 'tests').glob('*/*/judge.toml'):
    parsed = tomllib.loads(source.read_text(encoding='utf-8'))
    dimensions[source.parent.name] = {'criteria': len(parsed['criterion']), 'weight': float(sum(Decimal(str(item['weight'])) for item in parsed['criterion']))}
assert set(dimensions) == {'render', 'constraints', 'functional', 'polish', 'visual'}
expected_functional = {'ridgeline-print-storefront': (42, 35), 'colderwater-playground-devtools': (58, 32.7), 'hireops-recruiting-operations': (61, 45)}[task.name]
assert dimensions['functional'] == dict(zip(('criteria', 'weight'), expected_functional))
assert dimensions['polish']['criteria'] == {'ridgeline-print-storefront': 7, 'colderwater-playground-devtools': 7, 'hireops-recruiting-operations': 12}[task.name]
assert dimensions['visual']['criteria'] == 6
result = {'archive': archive.name, 'sha256': sha, 'bytes': archive.stat().st_size, 'files': len(files), 'single_root': task.name,
          'public_criterion_id_hygiene_passed': True,
          'public_grading_term_hygiene_passed': True,
          'public_network_policy_passed': True,
          'crc_passed': True, 'extraction_hash_match': True, 'shell_modes_passed': True, 'dimensions': dimensions,
          'source_sha256': manifest, 'oracle_measured': False, 'target_model_measured': False}
(out / 'candidate_manifest.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: value for key, value in result.items() if key != 'source_sha256'}, indent=2))
