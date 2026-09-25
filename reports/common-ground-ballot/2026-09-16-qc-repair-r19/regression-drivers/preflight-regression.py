"""Check that the upload audit rejects missing or unweighted r17 coverage."""
import copy
import importlib.util
import json
from pathlib import Path
import re
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
archive = ROOT / 'deliverables/common-ground-ballot/2026-09-15-recovery-r17/common-ground-ballot.zip'
spec = importlib.util.spec_from_file_location('upload', ROOT / 'references/task-templates/check-upload.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
ids = ['user_wide_operation_namespace', 'durable_pending_staff_work', 'immutable_pending_retry',
       'independent_pending_actions', 'pending_actor_isolation', 'cross_tab_pending_resolution']
results = []
with zipfile.ZipFile(archive) as original, tempfile.TemporaryDirectory(prefix='ballot-r17-preflight-') as temporary:
    cases = []
    target = 'common-ground-ballot/tests/functional/judge.toml'
    source = original.read(target).decode('utf-8')
    for cid in ids:
        pattern = r'\[\[criterion\]\]\s*id = "' + re.escape(cid) + r'".*?(?=\[\[criterion\]\]|\Z)'
        block = re.search(pattern, source, re.S).group()
        cases.append(('missing-' + cid, target, source.replace(block, '').encode('utf-8')))
        zero = re.sub(r'^weight = .+$', 'weight = 0.0', block, count=1, flags=re.M)
        cases.append(('unweighted-' + cid, target, source.replace(block, zero).encode('utf-8')))
    for doc in ['environment/instructions/recovery.md', 'tests/functional/recovery.md']:
        cases.append(('missing-' + doc.replace('/', '-'), 'common-ground-ballot/' + doc, None))
    for name, changed_name, changed_bytes in cases:
        mutant = Path(temporary) / (name + '.zip')
        with zipfile.ZipFile(mutant, 'w') as output:
            for info in original.infolist():
                if info.filename == changed_name and changed_bytes is None:
                    continue
                output.writestr(copy.copy(info), changed_bytes if info.filename == changed_name else original.read(info))
        try:
            checker.audit(mutant)
        except AssertionError as error:
            message = str(error)
            assert any(word in message.lower() for word in ['recovery', 'r17', 'criterion weight']), message
            results.append({'name': name, 'rejected_by': message, 'passed': True})
        else:
            raise AssertionError('Incomplete r17 archive accepted: ' + name)
    assert original.testzip() is None
(OUT / 'preflight-regressions.json').write_text(json.dumps({'results': results}, indent=2) + '\n', encoding='utf-8')
print(f'PASS {len(results)} missing/unweighted r17 archive controls rejected')
