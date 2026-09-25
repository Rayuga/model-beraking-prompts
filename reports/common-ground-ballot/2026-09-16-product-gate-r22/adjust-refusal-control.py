"""Model absent business-write methods without simulating session expiry."""
from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
diagnostic = HERE / 'diagnostic-attempt-2'
diagnostic.mkdir(exist_ok=True)
for variant in ('readonly', 'create_only'):
    shutil.copytree(HERE / ('gate-' + variant), diagnostic / ('gate-' + variant), dirs_exist_ok=True)
path = HERE / 'run-product-gate.py'
text = path.read_text(encoding='utf-8')
assert text.count('response.status(403)') == 2
path.write_text(text.replace('response.status(403)', 'response.status(405)'), encoding='utf-8', newline='\n')
path = HERE / 'product-gate-body.cjs'
text = path.read_text(encoding='utf-8')
text = text.replace('assert.equal(blocked.observedStatus,403', 'assert.equal(blocked.observedStatus,405')
path.write_text(text, encoding='utf-8', newline='\n')
