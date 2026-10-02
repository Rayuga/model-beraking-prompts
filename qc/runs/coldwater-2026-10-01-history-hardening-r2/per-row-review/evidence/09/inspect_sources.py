"""Row 09 source inspection only; not a private checker or runtime test."""
import hashlib
import json
from pathlib import Path
import tomllib
from openpyxl import load_workbook

ROOT = Path.cwd()
RUN = ROOT / 'qc/runs/coldwater-2026-10-01-history-hardening-r2'
CACHE = ROOT / '.qc-cache/coldwater-2026-10-01-history-hardening-r2'
OUT = Path(__file__).parent

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

manifest = json.loads((RUN / 'manifest.json').read_text(encoding='utf-8'))
checks = []
for section in ('task', 'rules'):
    for rel, expected in manifest['inputs'][section].items():
        path = CACHE / section / rel
        actual = digest(path)
        checks.append({'path': path.relative_to(ROOT).as_posix(), 'sha256': actual,
                       'matches_manifest': actual == expected})
for rel in ('qc/REVIEW_POLICY.md', 'qc/README.md'):
    actual = digest(ROOT / rel)
    checks.append({'path': rel, 'sha256': actual,
                   'matches_manifest': actual == manifest['engine_inputs'][rel]})

index = json.loads((RUN / 'raw-evidence-index.json').read_text(encoding='utf-8'))
artifact_hashes = []
for rel, expected in index['artifacts'].items():
    actual = digest(ROOT / rel)
    artifact_hashes.append({'path': rel, 'sha256': actual, 'matches_index': actual == expected})

task = tomllib.loads((CACHE / 'task/task.toml').read_text(encoding='utf-8'))
template = tomllib.loads((CACHE / 'rules/projects/webdev-task-template/task.toml').read_text(encoding='utf-8'))
environment = task['environment']
assert environment == template['environment']
assert environment['cpus'] == 2 and environment['memory_mb'] == 4096
assert environment['network_mode'] == 'public'
assert 'docker_image' not in environment and 'allow_internet' not in environment
assert 'env' not in environment
assert (CACHE / 'task/environment/Dockerfile').read_bytes() == (CACHE / 'rules/projects/webdev-task-template/environment/Dockerfile').read_bytes()
assert all(row['matches_manifest'] for row in checks)
assert all(row['matches_index'] for row in artifact_hashes)

workbook = load_workbook(CACHE / 'rules/WebDev Rubrics QC.xlsx', data_only=False)
rows = {}
for title in ('Quality Checks', 'Internal Quality Checks'):
    sheet = workbook[title]
    rows[title] = [{'cell': c.coordinate, 'value': c.value, 'comment': c.comment.text if c.comment else None}
                   for c in sheet[10] if c.value is not None or c.comment]

result = {
    'reviewer': 'row-reviewer-09',
    'input_sha256': manifest['input_sha256'],
    'scope': 'Source and configuration inspection only. No container, configured judge, model or portal run.',
    'command': 'python -X utf8 -B qc/runs/coldwater-2026-10-01-history-hardening-r2/per-row-review/evidence/09/inspect_sources.py',
    'environment': environment,
    'environment_matches_frozen_template': True,
    'dockerfile_matches_frozen_template': True,
    'workbook_row_09': rows,
    'source_hashes': checks,
    'raw_index_sha256': digest(RUN / 'raw-evidence-index.json'),
    'raw_index_artifact_hashes': artifact_hashes,
    'raw_index_limit': 'Hashes verified only; no scripted observations are treated as configured grades or resource-limit measurements.',
    'manual_inspection': 'Read all eight environment files and task.toml. Dockerfile has only NODE_PATH ENV, copies only instructions and assets, and uses synthetic turing@local.invalid identity. Seed contains an empty snippets array. No secret literals found.',
    'counterexample_analysis': {
        'weak_app': 'A static shell could share this sound environment and satisfy row 09; this row does not grade app functionality. It provides no basis for granting reward to that shell.',
        'conforming_alternative': 'A conforming app may fetch its editor or font from a CDN, or install frontend build tools over the public network. The public row and skill explicitly permit this; the older internal no-network annotation is not applied.',
        'environment_failure': 'A literal provider key in environment ENV or task [environment.env], an overriding docker_image, or an offline network setting would violate this row. None is present in the candidate.'
    }
}
(OUT / 'source-inspection.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'source_hashes_verified': len(checks), 'raw_artifact_hashes_verified': len(artifact_hashes), 'environment': environment, 'output': (OUT / 'source-inspection.json').relative_to(ROOT).as_posix()}, indent=2))
