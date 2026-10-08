"""Repair the returned row32 finding; this cannot complete blocked R3 QC."""
from pathlib import Path
import hashlib
import json
import re
import tomllib

ROOT = Path(__file__).resolve().parents[3]
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r3'
TASK = ROOT / 'projects/hireops-recruiting-operations/hireops-recruiting-operations'
OUT = Path(__file__).resolve().parent / 'post-r3-permission-repair'
OUT.mkdir(exist_ok=True)
manifest = json.loads((RUN / 'manifest.json').read_text(encoding='utf-8'))
summary = json.loads((RUN / 'summary.json').read_text(encoding='utf-8'))
assert summary['status'] == 'INCOMPLETE' and summary['missing_reviewers'] == ['row-reviewer-46']
assert summary['valid_reviews'] == 53 and not summary['invalid']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = {p.relative_to(TASK).as_posix(): sha(p) for p in TASK.rglob('*') if p.is_file()}
assert before == manifest['inputs']['task'], 'Do not modify an unreviewed different candidate.'
judge = TASK / 'tests/scored/functional/judge.toml'
prompt = TASK / 'tests/scored/functional/prompt.md'
original = judge.read_text(encoding='utf-8')
old = tomllib.loads(original)
owners = ['hro_change_prepare_' + role for role in ['recruiter', 'comp', 'tier1', 'tier2', 'tier3', 'auditor']]
replacement = ('require403 with unchanged financial state and no new or changed valid saved preview from the denied attempt. '
    'Verify saved operation identities and stored intent through a fresh authorized product/history read; '
    'existing legitimate previews remain intact, while generic security/access logs are allowed.')
text = original
for owner in owners:
    pattern = r'(\[\[criterion\]\]\nid = "' + re.escape(owner) + r'"\n.*?)(?=\n\[\[criterion\]\]|\Z)'
    match = re.search(pattern, text, flags=re.S)
    assert match and match.group().count('require403 with unchanged financial state.') == 1
    text = text[:match.start()] + match.group().replace('require403 with unchanged financial state.', replacement) + text[match.end():]
parsed = tomllib.loads(text)
assert len(parsed['criterion']) == 145
changed = [a['id'] for a,b in zip(old['criterion'],parsed['criterion']) if a != b]
assert changed == owners
assert [{k:v for k,v in c.items() if k!='description'} for c in old['criterion']] == [{k:v for k,v in c.items() if k!='description'} for c in parsed['criterion']]
body = prompt.read_text(encoding='utf-8')
old_b5 = 'For each other demo account, prepare a valid otherwise eligible set and attempt commit against an eligible saved Finance draft:403 and unchanged financial state.'
new_b5 = ('For each other demo account, prepare a valid otherwise eligible set using a fresh operation key:403, unchanged financial state, '
    'and no new or changed valid saved preview from the denied attempt. Capture saved operation identities and stored intent before each attempt '
    'and re-read them through the observed authenticated product/history interface afterward; preserve existing legitimate previews and allow generic security/access logs. '
    'Separately attempt commit against an eligible saved Finance draft:403 and unchanged financial state.')
assert body.count(old_b5) == 1
body = body.replace(old_b5, new_b5)
judge.write_bytes(text.encode('utf-8'))
prompt.write_bytes(body.encode('utf-8'))
after = {p.relative_to(TASK).as_posix(): sha(p) for p in TASK.rglob('*') if p.is_file()}
paths = [p for p in before if before[p] != after[p]]
assert set(paths) == {'tests/scored/functional/judge.toml', 'tests/scored/functional/prompt.md'}
record = {'status':'PROVISIONAL_TASK_REPAIR_PENDING_COMPLETE_QC',
    'basis': 'R3 returned row32 finding accepted after all available contexts concluded and pipeline reconciliation. R3 remains INCOMPLETE because the row46 context was blocked by automated security checks. This is no waiver or new full QC round.',
    'prior_input_sha256': manifest['input_sha256'], 'changed_paths': paths, 'changed_criteria': owners,
    'criterion_count_unchanged': True, 'weights_unchanged': True, 'golden_unchanged': True,
    'shared_harness_policy_models_timeouts_unchanged': True, 'before_sha256': before, 'source_sha256': after,
    'configured_judge_measured': False, 'oracle_measured': False, 'target_model_measured': False}
(OUT / 'repair.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in record.items() if not k.endswith('sha256')},indent=2))
