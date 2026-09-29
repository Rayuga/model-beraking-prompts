import hashlib
import json
from pathlib import Path

root = Path.cwd()
out = Path(__file__).resolve().parent
task = root / 'projects/colderwater-playground-devtools'
baseline = json.loads((out.parent / 'two-findings-fix-2026-09-27/candidate_manifest.json').read_text(encoding='utf-8'))
sha = lambda data: hashlib.sha256(data).hexdigest()
source = {p.relative_to(task).as_posix(): p.read_bytes() for p in task.rglob('*') if p.is_file()}
assert {p: sha(data) for p, data in source.items()} == baseline['source_sha256'], 'Source changed since rejected baseline; inspect before staging'
changes = {
    'tests/scored/functional/judge.toml': out / 'semantics/draft/judge.toml',
    'tests/scored/functional/prompt.md': out / 'semantics/draft/prompt.md',
    'tests/app_context.md': out / 'semantics/draft/app_context.md',
}
drafts = {p: f.read_bytes() for p, f in changes.items()}
fingerprint = sha(b''.join(name.encode() + b'\0' + data for name, data in sorted(drafts.items())))
staged = out / 'candidates' / fingerprint[:12] / task.name
staged.mkdir(parents=True, exist_ok=False)
for name, data in (source | drafts).items():
    target = staged / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
assert all(f.read_bytes() == drafts[p] for p, f in changes.items()), 'Draft changed while staging'
manifest = {p: sha(data) for p, data in (source | drafts).items()}
assert len(manifest) == 50
assert all(manifest[p] == digest for p, digest in baseline['source_sha256'].items() if p.startswith('solution/'))
report = {
    'staged_task': staged.relative_to(root).as_posix(),
    'draft_fingerprint': fingerprint,
    'rejected_baseline_zip': baseline['sha256'],
    'changed_files': {p: {'before': baseline['source_sha256'][p], 'after': sha(data)} for p, data in drafts.items()},
    'source_sha256': manifest,
    'golden_23_files_unchanged': True,
    'status': 'Unreleased candidate for local checks; no Oracle or platform result claimed',
}
(out / 'staged_candidate.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: report[key] for key in ['staged_task', 'draft_fingerprint', 'status']}))
