from pathlib import Path
import hashlib, json, zipfile

out = Path(__file__).resolve().parent
previous = out.parent / 'rubric-followup-2026-09-26'
archive = previous / 'ridgeline-print-storefront.zip'
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
assert digest == '7502bd9c36e568b0d50e682e4030d0c6f9079b5467ae19992303b8d04f8dcca6'
target = out / 'golden-extracted'
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    for item in bundle.infolist():
        assert (target / item.filename).resolve().is_relative_to(target.resolve())
    bundle.extractall(target)
task = target / 'ridgeline-print-storefront'
files = {p.relative_to(task / 'solution').as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
         for p in (task / 'solution').rglob('*') if p.is_file()}
source = Path.cwd() / 'projects/ridgeline-print-storefront/solution'
current = {p.relative_to(source).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
assert files == current
(out / 'golden-start.sh').write_text('#!/bin/bash\nset -euo pipefail\nbash /solution/solve.sh\ncd /app\nexec node server.js\n', encoding='utf-8', newline='\n')
(out / 'golden-archive-identity.json').write_text(json.dumps({'archive_sha256': digest, 'solution_equals_current_source': True, 'solution_files': files}, indent=2) + '\n')
address = out / 'gate-address'
address.mkdir(exist_ok=True)
code = (out.parent / 'rubric-fix-2026-09-26/gate-address-browser-check.cjs').read_text(encoding='utf-8')
code = code.replace('20260926-hardening', '20260926-followup').replace('ridgeline-gate-address-20260926', 'ridgeline-crosscheck-runtime-20260927')
(address / 'probe.cjs').write_text(code, encoding='utf-8', newline='\n')
presentation = out / 'presentation'
presentation.mkdir(exist_ok=True)
code = (out.parent / 'hardening-2026-09-26/round2/browser-criteria.cjs').read_text(encoding='utf-8')
code = code.replace("const root = '/evidence/round2';", "const root = '/work/presentation';")
(presentation / 'probe.cjs').write_text(code, encoding='utf-8', newline='\n')
print(json.dumps({'archive_sha256': digest, 'solution_files': len(files), 'extracted': str(task)}))
