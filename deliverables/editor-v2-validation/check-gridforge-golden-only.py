"""Audit GridForge 2.0.7 against the retained 2.0.4 upload; no model calls."""
from pathlib import Path
import json
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1] / 'projects' / 'gridforge-spreadsheet-v2'
PREFIX = 'gridforge-spreadsheet-v2/'
BRIEF = {'instruction.md'} | {
    f'environment/assets/instructions/{name}.md'
    for name in ('overview', 'spreadsheet', 'collaboration', 'storage', 'interface')
}
MAPPING = """- In API probes, names such as baseRevision, workbookId, workbook, sheets,
  and cells identify logical fields, not mandatory JSON key spellings. Map
  them to the equivalent fields in the successful request and responses
  observed from this app. Preserve the exact probe count, invalid values,
  rejection statuses, and post-request equality checks. Never add an unused
  reference-shaped field and treat its acceptance as failed validation.
"""
VERSIONED = {'task.toml', 'environment/Dockerfile', 'tests/Dockerfile'} | {
    f'tests/{d}/{f}' for d in ('render', 'constraints', 'functional', 'polish')
    for f in ('judge.toml', 'prompt.md')
}
checks = []
with zipfile.ZipFile(OUT / 'gridforge-spreadsheet-v2-2.0.4-task.zip') as archive:
    previous = {n[len(PREFIX):]: archive.read(n) for n in archive.namelist()}
    current = {p.relative_to(ROOT).as_posix(): p.read_bytes() for p in ROOT.rglob('*') if p.is_file()}
    assert current.keys() == previous.keys()
    for name, data in current.items():
        old = previous[name]
        if name in BRIEF:
            assert data != old and b'workspace is offline' not in data.lower(), name
            result = 'product brief rewritten; requirements manually reviewed'
        elif name in VERSIONED:
            expected = old.replace(b'2.0.4', b'2.0.7')
            if name == 'task.toml':
                expected = expected.replace(b'network_mode = "public"', b'network_mode = "no-network"')
            if name == 'environment/Dockerfile':
                bootstrap = b"# Harbor's agent bootstrap checks these tools before starting the model.\nRUN apt-get update && apt-get install -y --no-install-recommends curl coreutils \\\n    && rm -rf /var/lib/apt/lists/*\n\n"
                assert data.count(bootstrap) == 1
                data = data.replace(bootstrap, b'')
            if name == 'tests/functional/prompt.md':
                assert data.count(MAPPING.encode()) == 1
                data = data.replace(MAPPING.encode(), b'')
            assert data == expected, name
            result = 'release marker; agent offline with bootstrap tools; Functional prompt clarifies observed field mapping'
        elif name in {'solution/app/package.json', 'solution/app/package-lock.json'}:
            before, after = json.loads(old), json.loads(data)
            before['version'] = '2.0.7'
            if 'packages' in before:
                before['packages']['']['version'] = '2.0.7'
            assert before == after, name
            result = 'only root release version changed'
        else:
            assert data == old, name
            result = 'byte-identical'
        checks.append({'file': name, 'result': result})
(OUT / 'gridforge-golden-only-comparison.json').write_text(json.dumps(checks, indent=2)+'\n', encoding='utf-8')
print(f'PASS: {len(checks)} files compared with 2.0.4; golden code and criteria unchanged; offline agent/bootstrap changes checked; brief and field mapping reviewed')
