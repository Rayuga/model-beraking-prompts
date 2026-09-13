import json
import subprocess
from pathlib import Path

from build_submission import HERE, ROOT

source = ROOT / 'deliverables/brickfall-breaker-arcade/submission-preparation-20260912/check_word.vbs'
script = source.read_text(encoding='utf-8')
script = script.replace('20260912', '20260913').replace('brickfall-breaker-arcade', 'patchpad-editor-v3')
script = script.replace('0.9583', '1.0000').replace('0.6094', '0.5605').replace('0.1689', '0.2233')
(HERE / 'check_word.vbs').write_text(script, encoding='utf-8')
completed = subprocess.run(['cscript.exe', '//Nologo', str(HERE / 'check_word.vbs')], capture_output=True, text=True, timeout=180)
(HERE / 'word-validation.log').write_text(completed.stdout + completed.stderr, encoding='utf-8')
print(completed.stdout)
if completed.returncode:
    print(completed.stderr)
    raise SystemExit(completed.returncode)
audit_path = HERE / 'package-audit.json'
audit = json.loads(audit_path.read_text(encoding='utf-8'))
audit['validation']['word_rendering_pending'] = False
audit['validation']['word_documents'] = json.loads((HERE / 'word-validation.json').read_text())
audit_path.write_text(json.dumps(audit, indent=2) + '\n', encoding='utf-8')
