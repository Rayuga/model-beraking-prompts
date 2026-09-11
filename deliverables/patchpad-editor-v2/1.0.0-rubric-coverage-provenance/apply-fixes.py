from pathlib import Path
import json
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/patchpad-editor-v2'
before = OUT / 'before-rubric-fixes.zip'
assert not before.exists(), 'Preserve the existing baseline; do not rerun this migration'
with zipfile.ZipFile(before, 'x', zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(TASK.rglob('*')):
        if p.is_file():
            archive.writestr('patchpad-editor-v2/' + p.relative_to(TASK).as_posix(), p.read_bytes())

def write(p, text):
    p.write_text(text, encoding='utf-8', newline='\n')

for dim in ('render', 'constraints', 'functional', 'polish', 'visual'):
    p = TASK / f'tests/{dim}/prompt.md'
    text = p.read_text(encoding='utf-8')
    text = text.replace('follow the Docketlight separation: actually reach the named setup state, then\ngrade every numbered observation.', 'first reach the named setup state, then grade every numbered observation.')
    text = text.replace('palette; do not demand marketplace screens or extra themes.', 'palette.')
    text = text.replace('Each criterion has integer anchors from 0 through 5, following the reference\ntemplate: 5 is its best described presentation, and 0 means that quality is', 'Each criterion has integer anchors from 0 through 5: 5 is its best described\npresentation, and 0 means that quality is')
    prefix = f'Task version: 1.0.0\nPrompt version: patchpad-editor-v2-{dim}-v1.0.0-r1\n\n'
    write(p, prefix + text)

p = TASK / 'tests/functional/judge.toml'
text = p.read_text(encoding='utf-8')
end = 'A consistent zero-based or one-based display is acceptable; incorrect movement, inconsistent counters, document changes, or loss of editor focus fails.'
addition = '''

During the first-line, fifth/sixth-line and final-line observations above,
also require visible document line numbers associated with the corresponding
rendered logical lines. Check that their labels identify those lines correctly
using a consistent zero-based or one-based line-number convention, including
after scrolling to the final line. Record the labels together with the text
they identify. A cursor-position status readout alone does not satisfy the
document line-number requirement. Do not require a particular gutter element,
placement or all offscreen lines to exist in the DOM; virtualized numbering is
acceptable when the visible labels identify the correct document lines.
Missing or incorrectly associated line numbers fail this criterion.
'''
assert text.count(end) == 1
write(p, text.replace(end, end + addition))

p = TASK / 'tests/test.sh'
text = p.read_text()
anchor = 'write_zero_reward\ntrap cleanup EXIT\n'
provenance = '''

if ! python3 - "$LOG_DIR/prompt-provenance.json" <<'PY'
import hashlib
import json
import re
import sys
from pathlib import Path

root = Path('/tests')
sha256 = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
record = {"task": "patchpad-editor-v2", "task_version": "1.0.0", "judges": {}}
for dimension in ("render", "constraints", "functional", "polish", "visual"):
    prompt = root / dimension / 'prompt.md'
    text = prompt.read_text(encoding='utf-8')
    task_version = re.search(r'^Task version: (.+)$', text, re.MULTILINE)
    prompt_version = re.search(r'^Prompt version: (.+)$', text, re.MULTILINE)
    if not task_version or task_version.group(1).strip() != record['task_version'] or not prompt_version:
        raise ValueError(f'Missing or inconsistent prompt version: {dimension}')
    record['judges'][dimension] = {
        'task_version': task_version.group(1).strip(),
        'prompt_version': prompt_version.group(1).strip(),
        'prompt_sha256': sha256(prompt),
        'judge_sha256': sha256(root / dimension / 'judge.toml'),
    }
record['runner_sha256'] = sha256(root / 'test.sh')
record['reward_config_sha256'] = sha256(root / 'reward.toml')
Path(sys.argv[1]).write_text(json.dumps(record, indent=2) + '\\n')
print('Prompt provenance: ' + json.dumps(record, sort_keys=True), flush=True)
PY
then
  write_zero_reward
  exit 0
fi
'''
assert text.count(anchor) == 1
write(p, text.replace(anchor, anchor + provenance))
print('Updated one Functional observation, all five prompt identifiers and runner provenance logging.')
