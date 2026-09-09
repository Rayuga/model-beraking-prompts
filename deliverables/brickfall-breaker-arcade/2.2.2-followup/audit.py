"""Read-only task/archive comparison; write fresh evidence beside this script."""
import hashlib
import json
from pathlib import Path
import subprocess
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
prior = out.parent / '2.2.2-rubric'
task = root / 'projects/brickfall-breaker-arcade'
sha = lambda data: hashlib.sha256(data).hexdigest()
old = json.loads((prior / 'package-audit.json').read_text())
files = {p.relative_to(task).as_posix(): sha(p.read_bytes()) for p in task.rglob('*') if p.is_file()}
assert files == old['files']
archive = prior / 'brickfall-breaker-arcade.zip'
assert sha(archive.read_bytes()) == old['zip_sha256']
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist()) == 30
    assert {n.removeprefix('brickfall-breaker-arcade/'): sha(z.read(n)) for n in z.namelist()} == files
cfg = tomllib.loads((task / 'task.toml').read_text())
assert cfg['environment']['network_mode'] == cfg['verifier']['environment']['network_mode'] == 'public'
local = json.loads((out / 'local-checks.json').read_text())
assert local['syntax'] and local['noop_zero'] and local['golden_runner']
browser = json.loads((out / 'browser-regression.json').read_text())
state = json.loads(subprocess.check_output(['docker', 'inspect', 'brickfall-222-followup']))[0]['State']
assert state['Status'] == 'exited' and state['ExitCode'] == 0
report = dict(version='2.2.2', unchanged_source_and_archive=True, file_count=len(files),
              zip_sha256=old['zip_sha256'], public_agent_and_verifier=True,
              local_checks=local, browser=browser,
              unresolved_policy_rows=[9, 29, 39, 41],
              scope='Fresh local regression evidence; no paid Oracle/model or platform QC run.')
(out / 'followup-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'browser'}, indent=2))
