"""Source-only evidence for quality row 12; no Docker/provider/checker runs."""
import copy
import hashlib
import json
from pathlib import Path
import re
import tomllib
import openpyxl

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/coldwater-2026-10-01-history-hardening-r2'
FROZEN = ROOT / '.qc-cache/coldwater-2026-10-01-history-hardening-r2'
OUT = Path(__file__).parent

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

manifest = json.loads((RUN / 'manifest.json').read_text(encoding='utf-8'))
verified = []
for group in ('task', 'rules'):
    for relative, expected in manifest['inputs'][group].items():
        path = FROZEN / group / relative
        actual = sha(path)
        verified.append({'path': str(path.relative_to(ROOT)).replace('\\', '/'), 'sha256': actual, 'matches': actual == expected})

index_path = RUN / 'raw-evidence-index.json'
index = json.loads(index_path.read_text(encoding='utf-8'))
index_hashes = []
for relative, expected in index['artifacts'].items():
    actual = sha(ROOT / relative)
    index_hashes.append({'path': relative, 'sha256': actual, 'matches': actual == expected})

task_text = (FROZEN / 'task/task.toml').read_text(encoding='utf-8')
task = tomllib.loads(task_text)
docker = (FROZEN / 'task/environment/Dockerfile').read_text(encoding='utf-8')
steps = [{'line': n, 'text': line} for n, line in enumerate(docker.splitlines(), 1) if re.match(r'^\s*(RUN|COPY|ADD)\s', line, re.I)]
template = tomllib.loads((FROZEN / 'rules/projects/webdev-task-template/task.toml').read_text(encoding='utf-8'))
template_docker = (FROZEN / 'rules/projects/webdev-task-template/environment/Dockerfile').read_text(encoding='utf-8')
def shadows(config):
    return bool(steps) and 'docker_image' in config['environment']

broken_text = task_text.replace('[environment]\n', '[environment]\ndocker_image = "node:22-bookworm-slim"\n', 1)
broken = tomllib.loads(broken_text)
conforming_text = task_text.replace('[environment]\n', '[environment]\n# docker_image intentionally omitted: Dockerfile builds inputs\n', 1)
conforming = tomllib.loads(conforming_text)
workbook_path = FROZEN / 'rules/WebDev Rubrics QC.xlsx'
workbook = openpyxl.load_workbook(workbook_path, data_only=False)
workbook_rows = {}
for sheet in ('Quality Checks', 'Internal Quality Checks'):
    workbook_rows[sheet] = [{'cell': c.coordinate, 'value': c.value, 'comment': c.comment.text if c.comment else None} for c in workbook[sheet][13] if c.value is not None or c.comment]

result = {
    'reviewer': 'row-reviewer-12',
    'input_sha256': manifest['input_sha256'],
    'command': 'python -B qc/runs/coldwater-2026-10-01-history-hardening-r2/per-row-review/evidence/12/review_probe.py',
    'scope': 'Manual source review with independent TOML parsing and in-memory controls. No Docker build, private checker, configured judge, Oracle, model or portal run.',
    'source_hashes': verified,
    'all_frozen_manifest_hashes_match': all(x['matches'] for x in verified),
    'policy_hash': {'path': 'qc/REVIEW_POLICY.md', 'sha256': sha(ROOT / 'qc/REVIEW_POLICY.md'), 'matches_manifest': sha(ROOT / 'qc/REVIEW_POLICY.md') == manifest['engine_inputs']['qc/REVIEW_POLICY.md']},
    'workbook_rows': workbook_rows,
    'task_environment': task['environment'],
    'active_build_steps': steps,
    'template_environment': template['environment'],
    'dockerfile_equals_template': docker == template_docker,
    'controls': {
        'frozen_has_shadow': shadows(task),
        'broken_prebuilt_base_has_shadow': shadows(broken),
        'conforming_comment_only_has_shadow': shadows(conforming),
        'broken_consequence': 'Selecting the plain node image while retaining RUN/COPY would skip dependency installation and omit /instructions and /assets. This is an in-memory configuration witness, not a platform execution.',
        'conforming_alternative': 'A comment mentioning docker_image does not set the parsed key and must not cause a false failure.',
        'app_boundary': 'A static broken app can pass this narrow wiring check; app functionality is outside row 12. Changing app behavior does not introduce a prebuilt-image override.'
    },
    'raw_evidence_index': {
        'sha256': sha(index_path),
        'input_sha256_matches': index['input_sha256'] == manifest['input_sha256'],
        'artifact_hashes': index_hashes,
        'all_hashes_match': all(x['matches'] for x in index_hashes),
        'use': 'Integrity verified only. Scripted product observations are not needed to decide this static row and establish no configured grades.'
    }
}
assert result['all_frozen_manifest_hashes_match']
assert result['policy_hash']['matches_manifest']
assert result['raw_evidence_index']['all_hashes_match']
assert not shadows(task) and shadows(broken) and not shadows(conforming)
(OUT / 'source-observations.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'frozen_hashes_verified':len(verified), 'raw_artifacts_verified':len(index_hashes), 'active_build_steps':len(steps), 'docker_image_present': 'docker_image' in task['environment'], 'controls':result['controls'], 'evidence_sha256':sha(OUT / 'source-observations.json')}, indent=2))
