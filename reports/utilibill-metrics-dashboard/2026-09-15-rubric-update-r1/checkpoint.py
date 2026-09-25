import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TASK = ROOT / 'projects/utilibill-metrics-dashboard'
REPORT = Path(__file__).resolve().parent

def repair(text):
    output = []
    index = 0
    while index < len(text):
        recovered = False
        if text[index] in '\u00c2\u00c3\u00e2\u00f0':
            for size in (4, 3, 2):
                part = text[index:index + size]
                try:
                    decoded = part.encode('cp1252').decode('utf-8')
                except (UnicodeEncodeError, UnicodeDecodeError):
                    continue
                if len(decoded) == 1 and ord(decoded) > 127:
                    output.append(decoded)
                    index += size
                    recovered = True
                    break
        if not recovered:
            output.append(text[index])
            index += 1
    return ''.join(output)

fixed = []
for path in TASK.rglob('*'):
    if path.is_file() and path.suffix in ('.js', '.md', '.py', '.toml', '.css', '.html', '.json', '.sh'):
        original = path.read_text(encoding='utf-8')
        corrected = repair(original)
        if corrected != original:
            path.write_text(corrected, encoding='utf-8', newline='\n')
            fixed.append(str(path.relative_to(TASK)))

for name in ('migrate.py', 'author_tests.py', 'finish_repairs.py'):
    path = REPORT / name
    source = path.read_text(encoding='utf-8').replace('.read_text()', '.read_text(encoding="utf-8")')
    path.write_text(source, encoding='utf-8', newline='\n')

archive = REPORT / 'work-in-progress-NOT-FOR-UPLOAD.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as out:
    for path in sorted(TASK.rglob('*')):
        if path.is_file():
            out.write(path, 'utilibill-metrics-dashboard/' + path.relative_to(TASK).as_posix())
(REPORT / 'checkpoint.json').write_text(json.dumps({'status':'unfinished', 'encoding_repairs':fixed, 'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'checkpoint':'saved', 'encoding_repairs':fixed}))
