from pathlib import Path
import hashlib, json, zipfile

out = Path(__file__).resolve().parent
previous = out.parent / 'full-qc-2026-09-27'
archive = previous / 'colderwater-playground-devtools.zip'
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
assert digest == 'b34abc10a29b36cd30a62263f476eaa8e3b5328ca5dd75927b2d155721c988f1'
target = out / 'golden-extracted'
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    for item in bundle.infolist():
        candidate = (target / item.filename).resolve()
        assert candidate.is_relative_to(target.resolve())
    bundle.extractall(target)
task = target / 'colderwater-playground-devtools'
files = {p.relative_to(task / 'solution').as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
         for p in (task / 'solution').rglob('*') if p.is_file()}
prior = json.loads((previous / 'solution-final.json').read_text())
assert files == prior, {'different': [k for k in set(files) | set(prior) if files.get(k) != prior.get(k)]}
(out / 'golden-start.sh').write_text('#!/bin/bash\nset -euo pipefail\nbash /solution/solve.sh\ncd /app\nexec node server.js\n', encoding='utf-8', newline='\n')
(out / 'golden-archive-identity.json').write_text(json.dumps({'archive_sha256': digest, 'all_solution_files_equal_previous_final': True, 'solution_files': files}, indent=2) + '\n')
print(json.dumps({'archive_sha256': digest, 'solution_files': len(files), 'extracted': str(task)}))
