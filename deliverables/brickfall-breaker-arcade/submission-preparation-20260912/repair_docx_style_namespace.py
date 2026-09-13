import io
import json
import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from build_submission import HERE, OUT, sha, tree_hashes

audit_path = HERE / 'package-audit.json'
audit = json.loads(audit_path.read_text())
backup = HERE / 'word-attempt-1'
backup.mkdir(exist_ok=False)
repairs = []
for path in sorted(OUT.glob('*.docx')):
    assert sha(path.read_bytes()) == audit['files'][path.name]
    shutil.copy2(path, backup / path.name)
    with zipfile.ZipFile(path) as z:
        parts = {n: z.read(n) for n in z.namelist()}
    styles = ET.fromstring(parts['word/styles.xml'])
    removed = styles.attrib.pop('{http://schemas.openxmlformats.org/markup-compatibility/2006}Ignorable', None)
    assert removed == 'w14'
    parts['word/styles.xml'] = ET.tostring(styles, encoding='utf-8', xml_declaration=True)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data in parts.items():
            z.writestr(name, data)
    path.write_bytes(buffer.getvalue())
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
        assert z.read('word/document.xml') == parts['word/document.xml']
    repairs.append({'file': path.name, 'removed_stale_ignorable_namespace': removed, 'body_unchanged': True})
audit['files'] = tree_hashes(OUT)
audit['word_compatibility_repair'] = repairs
audit_path.write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps(repairs))
