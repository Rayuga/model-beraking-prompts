"""Compare 2.0.3 with the retained 2.0.2 upload; no judge/model calls."""
from pathlib import Path
import json
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1] / 'projects' / 'gridforge-spreadsheet-v2'
PREFIX = 'gridforge-spreadsheet-v2/'
VERSIONED = {'task.toml', 'environment/Dockerfile', 'tests/Dockerfile'}
VERSIONED.update(f'tests/{d}/{f}' for d in ('render', 'constraints', 'functional', 'polish')
                 for f in ('judge.toml', 'prompt.md'))
GOLDEN = {'solution/app/public/js/app.js', 'solution/app/public/index.html',
          'solution/app/public/styles.css'}
checks = []
with zipfile.ZipFile(OUT / 'gridforge-spreadsheet-v2-2.0.2-task.zip') as archive:
    previous = {n[len(PREFIX):]: archive.read(n) for n in archive.namelist() if not n.endswith('/')}
    current = {p.relative_to(ROOT).as_posix(): p.read_bytes() for p in ROOT.rglob('*') if p.is_file()}
    assert current.keys() == previous.keys(), 'Task file set changed'
    for name, data in current.items():
        old = previous[name]
        if name in GOLDEN:
            assert old != data, name
            result = 'golden implementation updated'
        elif name == 'environment/assets/instructions/spreadsheet.md':
            addition = b'Provide at least 80 rows and 20 columns, from A to T.\n\n'
            assert data.count(addition) == 1 and data.replace(addition, b'') == old, name
            result = 'only approved minimum grid-size clarification added'
        elif name in VERSIONED:
            assert old.replace(b'2.0.2', b'2.0.3') == data, name
            result = 'only release/version marker changed'
        elif name in {'solution/app/package.json', 'solution/app/package-lock.json'}:
            before, after = json.loads(old), json.loads(data)
            before['version'] = '2.0.3'
            if 'packages' in before:
                before['packages']['']['version'] = '2.0.3'
            assert before == after, name
            result = 'only root package version changed; dependencies unchanged'
        else:
            assert old == data, name
            result = 'byte-identical'
        checks.append({'file': name, 'result': result})
(OUT / 'gridforge-golden-only-comparison.json').write_text(json.dumps(checks, indent=2)+'\n', encoding='utf-8')
print(f'PASS: {len(checks)} files checked against 2.0.2; scoring/runtime unchanged; only approved grid-size clarification in instructions')
