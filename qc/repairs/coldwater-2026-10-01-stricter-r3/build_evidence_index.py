"""Bind the current scripted golden artifacts to the prepared QC candidate."""
from pathlib import Path
import hashlib
import json

root = Path.cwd()
here = Path(__file__).resolve().parent
run = root/'qc/runs/coldwater-2026-10-01-history-hardening-r3'
manifest = json.loads((run/'manifest.json').read_text(encoding='utf-8'))
proof = json.loads((here/'local-proof-summary.json').read_text(encoding='utf-8'))
assert proof['scripted_passed'] and proof['functional_criteria'] == 82
artifacts = {
    file.relative_to(root).as_posix(): hashlib.sha256(file.read_bytes()).hexdigest()
    for file in sorted(here.rglob('*')) if file.is_file()
}
index = {
    'scope': 'Exact-current full-install scripted browser evidence, not a configured judge, Oracle, Luna or portal run',
    'input_sha256': manifest['input_sha256'],
    'source_commit': 'dabcf740',
    'artifacts': artifacts,
    'observations': [
        '82 functional criteria map to passing scripted facts across runtime, history and post-restart phases.',
        'A clean full solve.sh install placed all 15 solution files under /app; the server ran from /tmp and used image-global SQLite.',
        'Both gate probes and six polish probes passed; visual screenshots and mobile viewport inspection are not Likert grades.',
        'Actual container restart preserved the complete recorded library and history before retry and a later successful Save.',
        'A two-handler HTML element and exact leading-space filename roundtrip passed focused golden regressions.',
    ],
    'limits': [
        'No exact-current configured Oracle, Luna, visual Likert, or full judge timing result is present.',
        'The first fixture run lacked a local freeze flag; the second reused that run’s database and hit ambiguous duplicate test selectors. Both attempts are preserved separately. The final pass used a new empty database.',
        'Shared restart and private-prompt process-argument isolation findings remain unresolved in the template/runner.',
        'An artifact index binds evidence bytes; it does not establish an independent QC verdict.',
    ],
}
(run/'raw-evidence-index.json').write_text(json.dumps(index, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'artifacts':len(artifacts),'input_sha256':index['input_sha256']}))
