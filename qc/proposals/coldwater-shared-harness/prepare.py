"""Generate an unapplied, source-bound shared-template proposal; no canonical writes."""
from pathlib import Path
import difflib
import hashlib
import json
import zipfile
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TEMPLATE = ROOT / 'projects/webdev-task-template/tests/test.sh'
original = TEMPLATE.read_text(encoding='utf-8')
assert hashlib.sha256(TEMPLATE.read_bytes()).hexdigest() == 'bd68259276ca4b034654efc8a1723a4e702ed62dbe590af6201565f43eabe5aa'

stop = '''stop_app_group() {
  timeout 8 python3 - "$1" <<'PY'
import os
from pathlib import Path
import signal
import sys
import time

pid = int(sys.argv[1])
if pid <= 1:
    sys.exit("invalid application process group")

def running():
    for entry in Path("/proc").glob("[0-9]*/stat"):
        try:
            fields = entry.read_text().rsplit(")", 1)[1].split()
            if int(fields[2]) == pid and fields[0] not in ("Z", "X"):
                return True
        except (FileNotFoundError, ProcessLookupError):
            continue
    return False

for sig, grace in ((signal.SIGTERM, 5), (signal.SIGKILL, 1)):
    if not running():
        sys.exit(0)
    try:
        os.killpg(pid, sig)
    except ProcessLookupError:
        sys.exit(0)
    deadline = time.monotonic() + grace
    while time.monotonic() < deadline:
        if not running():
            sys.exit(0)
        time.sleep(0.1)
sys.exit("application process group did not terminate")
PY
}

'''

replacement = '''replacement_listens() {
  setpriv --reuid=65534 --regid=65534 --clear-groups python3 - "$1" <<'PY' >/dev/null 2>&1
import os
from pathlib import Path
import sys

process = Path("/proc") / sys.argv[1]
try:
    if process.joinpath("stat").read_text().rsplit(")", 1)[1].split()[0] in ("Z", "X"):
        sys.exit(1)
    sockets = {os.readlink(fd) for fd in process.joinpath("fd").iterdir()}
    for table in ("/proc/net/tcp", "/proc/net/tcp6"):
        for line in Path(table).read_text().splitlines()[1:]:
            fields = line.split()
            if (fields[1].split(":")[1] == "0BB8" and fields[3] == "0A"
                    and "socket:[" + fields[9] + "]" in sockets):
                sys.exit(0)
except (FileNotFoundError, ProcessLookupError):
    pass
sys.exit(1)
PY
}
'''

proposed = original.replace('cleanup() {\n', stop + 'cleanup() {\n', 1)
proposed = proposed.replace('    kill -- -"$APP_PID" 2>/dev/null || true\n    wait "$APP_PID" 2>/dev/null || true', '    stop_app_group "$APP_PID" || printf \'test.sh: application cleanup failed\\n\' >&2', 1)
marker = '''cat > "$LOG_DIR/app-restart.sh" <<'SH'
#!/bin/bash
set -euo pipefail
'''
assert proposed.count(marker) == 1
proposed = proposed.replace(marker, marker + '''SH
declare -f stop_app_group >> "$LOG_DIR/app-restart.sh"
cat >> "$LOG_DIR/app-restart.sh" <<'SH'
''' + replacement, 1)
old = '''  kill -- "-$old_pid" 2>/dev/null || true
  for _ in $(seq 1 50); do
    kill -0 -- "-$old_pid" 2>/dev/null || break
    sleep 0.1
  done'''
assert proposed.count(old) == 1
proposed = proposed.replace(old, '''  if ! stop_app_group "$old_pid"; then
    printf 'app-restart: old application did not terminate\\n' >&2
    exit 1
  fi''', 1)
old = '''for _ in $(seq 1 120); do
  if probe_ready; then
    ready=1'''
assert proposed.count(old) == 1
proposed = proposed.replace(old, '''for _ in $(seq 1 120); do
  kill -0 "$new_pid" 2>/dev/null || break
  if replacement_listens "$new_pid" && probe_ready && kill -0 "$new_pid" 2>/dev/null; then
    ready=1''', 1)
proposed = proposed.replace('''if ! run_suite scored 11100; then
  exit 0''', '''if ! run_suite scored 11100; then
  write_zero_reward
  exit 0''', 1)

for name, content in [('original-test.sh', original), ('proposed-test.sh', proposed)]:
    HERE.joinpath(name).write_text(content, encoding='utf-8', newline='\n')
patch = ''.join(difflib.unified_diff(original.splitlines(True), proposed.splitlines(True),
    fromfile='a/projects/webdev-task-template/tests/test.sh', tofile='b/projects/webdev-task-template/tests/test.sh'))
HERE.joinpath('shared-test-sh.patch').write_text(patch, encoding='utf-8', newline='\n')
HERE.joinpath('score.py').write_bytes(ROOT.joinpath('projects/webdev-task-template/tests/tools/score.py').read_bytes())
HERE.joinpath('scoring.toml').write_bytes(ROOT.joinpath('projects/webdev-task-template/tests/scoring.toml').read_bytes())
paths = ['AGENTS.md', 'qc/README.md', 'qc/REVIEW_POLICY.md', 'NEW_TASK_AUTHORING_CONTEXT.md', 'TASK_AUTHORING_WORKFLOW.md',
    'WebDev Rubrics QC.xlsx', 'harbor-webdev-rubric-qc/SKILL.md', 'harbor-webdev-rubric-qc/assets/WebDev_Rubrics_QC.xlsx',
    *['harbor-webdev-rubric-qc/references/'+name+'.md' for name in ['quality-checks', 'deterministic-checks', 'staged-task-contract']],
    *['projects/'+project+'/tests/'+file for project in ['webdev-task-template', 'colderwater-playground-devtools']
      for file in ['test.sh', 'tools/score.py', 'tools/restart_mcp.py', 'scoring.toml', 'Dockerfile']],
    *['qc/runs/coldwater-2026-09-30-committed-audit/per-row-review/rows/'+str(n)+'.json' for n in [21, 35, 49]],
    'qc/runs/coldwater-2026-09-30-committed-audit/coordinator-probe-evidence.json',
    'qc/runs/coldwater-2026-09-30-committed-audit/entrypoint-probe-results.json']
bindings = {p: hashlib.sha256(ROOT.joinpath(p).read_bytes()).hexdigest() for p in paths}
HERE.joinpath('source-bindings.json').write_text(json.dumps(bindings, indent=2)+'\n')

# Read actual authoritative workbook rows without installing a package or using network.
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
inventory = {}
with zipfile.ZipFile(ROOT / 'WebDev Rubrics QC.xlsx') as z:
    strings = [''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', ns)]
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    for index, sheet in enumerate(wb.find('s:sheets', ns), 1):
        rows = []
        for row in ET.fromstring(z.read(f'xl/worksheets/sheet{index}.xml')).findall('.//s:row', ns):
            cells = []
            for cell in row.findall('s:c', ns):
                value = cell.find('s:v', ns)
                text = '' if value is None else value.text
                cells.append(strings[int(text)] if cell.get('t') == 's' else text)
            if any(cells):
                rows.append({'row': int(row.attrib['r']), 'cells': cells})
        inventory[sheet.attrib['name']] = rows
HERE.joinpath('workbook-inventory.json').write_text(json.dumps(inventory, indent=2)+'\n')
print(json.dumps({'patch': str(HERE / 'shared-test-sh.patch'), 'canonical_sha256': bindings['projects/webdev-task-template/tests/test.sh'], 'proposed_sha256': hashlib.sha256(proposed.encode()).hexdigest(), 'workbook_sheets': list(inventory)}))
