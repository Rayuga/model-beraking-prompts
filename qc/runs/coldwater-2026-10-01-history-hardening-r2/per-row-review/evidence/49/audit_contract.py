import hashlib
import json
import re
import tomllib
from pathlib import Path

root = Path(__file__).resolve().parents[6]
frozen = root / '.qc-cache/coldwater-2026-10-01-history-hardening-r2'
task = frozen / 'task'
template = frozen / 'rules/projects/webdev-task-template'
tests = task / 'tests'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read(path):
    return path.read_text(encoding='utf-8')

task_config = tomllib.loads(read(task / 'task.toml'))
policy = tomllib.loads(read(tests / 'scoring.toml'))
judges = {str(p.relative_to(tests)).replace('\\', '/'): tomllib.loads(read(p))
          for p in sorted(tests.glob('*/*/judge.toml'))}
prompts = {str(p.relative_to(tests)).replace('\\', '/'): read(p)
           for p in sorted(tests.glob('*/*/prompt.md'))}
notes = sorted((task / 'environment/instructions').glob('*.md'))
functional = prompts['scored/functional/prompt.md']
protocols = re.findall(r'^### (S\d{2}) \u2014', functional, re.M)
raw = json.loads(read(root / 'qc/runs/coldwater-2026-10-01-history-hardening-r2/raw-evidence-index.json'))
bad_raw = [p for p, sha in raw['artifacts'].items()
           if not (root / p).is_file() or digest(root / p) != sha]

shared = ['tests/test.sh', 'tests/tools/score.py', 'tests/tools/restart_mcp.py',
          'tests/Dockerfile', 'tests/scoring.toml']
result = {
    'input_sha256': raw['input_sha256'],
    'raw_artifact_count': len(raw['artifacts']),
    'raw_artifact_bad_hash_or_missing': bad_raw,
    'workbook_sha256': digest(frozen / 'rules/WebDev Rubrics QC.xlsx'),
    'skill_sha256': digest(frozen / 'rules/harbor-webdev-rubric-qc/SKILL.md'),
    'note_count': len(notes),
    'note_files': [p.name for p in notes],
    'seed_snippets': json.loads(read(task / 'environment/assets/seed_data.json'))['snippets'],
    'task_artifacts': task_config['artifacts'],
    'judge_env': {'REWARDKIT_JUDGE': task_config['verifier']['env']['REWARDKIT_JUDGE'],
                  'REWARDKIT_MODEL': task_config['verifier']['env']['REWARDKIT_MODEL']},
    'judge_fallbacks': {k: d['judge']['judge'] for k, d in judges.items()},
    'scoring': policy,
    'criterion_counts': {k: len(d['criterion']) for k, d in judges.items()},
    'criterion_weights': {k: sorted(set(c['weight'] for c in d['criterion']))
                          for k, d in judges.items()},
    'protocol_count': len(protocols),
    'protocols': protocols,
    'prompt_port_3000': {k: 'http://localhost:3000' in v for k, v in prompts.items()},
    'prompt_context_placeholder': {k: '{app_context}' in v for k, v in prompts.items()},
    'prompt_criteria_placeholder': {k: '{criteria}' in v for k, v in prompts.items()},
    'shared_template_matches': {p: digest(task / p) == digest(template / p) for p in shared},
}
out = Path(__file__).with_name('contract_audit.json')
out.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
