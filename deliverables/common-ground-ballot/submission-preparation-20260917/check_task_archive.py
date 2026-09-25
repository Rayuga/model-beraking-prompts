from pathlib import Path
import hashlib
import importlib.util
import json
import stat
import sys
import zipfile

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
archive = HERE.parent / 'final-submission-20260917/common-ground-ballot.zip'
spec = importlib.util.spec_from_file_location('r27_checks', ROOT / 'reports/common-ground-ballot/2026-09-17-review-safety-r27/validate-package.py')
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)
with zipfile.ZipFile(archive) as z:
    checks.check('Final ZIP CRC valid', z.testzip() is None)
    infos = z.infolist()
    checks.check('Final ZIP unique case-insensitive paths', len(infos) == len({i.filename.casefold() for i in infos}))
    checks.check('Final ZIP single correct wrapper', all(i.filename.startswith('common-ground-ballot/') for i in infos))
    files = {i.filename.split('/', 1)[1]: z.read(i) for i in infos}
    source = ROOT / 'projects/common-ground-ballot'
    checks.check('Final ZIP source equality', files == {p.relative_to(source).as_posix(): p.read_bytes() for p in source.rglob('*') if p.is_file()})
    for i in infos:
        mode = i.external_attr >> 16
        checks.check('Portable file ' + i.filename, i.create_system == 3 and stat.S_ISREG(mode) and mode & 0o444 == 0o444)
        if i.filename.endswith('.sh'):
            checks.check('Executable shell ' + i.filename, mode & 0o111 == 0o111)
counts = checks.validate(files)
result = dict(passed=len(checks.checks), failed=0, counts=counts, criteria_total=sum(counts.values()), zip_sha256=hashlib.sha256(archive.read_bytes()).hexdigest(), checks=checks.checks, platform_qc=False)
(HERE / 'final-task-checks.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'checks'}, indent=2))
