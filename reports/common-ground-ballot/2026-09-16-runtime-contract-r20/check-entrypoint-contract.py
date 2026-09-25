"""Focused regression for the reported filename-classification failure.

The platform checker source is not present locally; this reproduces the three
reported interpreter/script matches and independently checks genuine app delivery.
"""
from pathlib import Path
import ast
import json
import re
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT/'projects/common-ground-ballot'
checks = []
def check(name,passed):
    assert passed,name
    checks.append(name)

with zipfile.ZipFile(HERE/'before-r20.zip') as archive:
    before = {name:archive.read(name) for name in archive.namelist()}
old_runner = before['tests/test.sh'].decode()
runner = (TASK/'tests/test.sh').read_text(encoding='utf-8')
pattern = r'\b(?:python3?|node)\s+(/[^\s"\']+\.(?:py|js))\b'
old_names = {Path(p).name for p in re.findall(pattern,old_runner)}
new_names = {Path(p).name for p in re.findall(pattern,runner)}
check('reproduces all three screenshot filename matches on r19', old_names == {'app-lifecycle.py','prompt-provenance.py','score.py'})
check('no verifier helper is an interpreted app-script launch in r20', not new_names)
solve = (TASK/'solution/solve.sh').read_text(encoding='utf-8')
check('actual Node app entry exists and is installed by solve', (TASK/'solution/server.js').is_file() and '/server.js" /app/server.js' in solve)
check('brief and runner agree on actual app entry', 'node /app/server.js' in (TASK/'instruction.md').read_text(encoding='utf-8') and 'APP_ENTRY="/app/server.js"' in runner)
for directory in ('solution','environment'):
    check(directory+' bytes unchanged', all(p.read_bytes() == before[p.relative_to(TASK).as_posix()] for p in (TASK/directory).rglob('*') if p.is_file()))
for name in ('instruction.md','task.toml','tests/Dockerfile','tests/reward.toml'):
    check(name+' bytes unchanged', (TASK/name).read_bytes() == before[name])
for dimension in ('render','constraints','functional','polish','visual'):
    name = f'tests/{dimension}/judge.toml'
    check('all criteria and settings unchanged '+dimension,(TASK/name).read_bytes() == before[name])
helpers = {name:body+'\n' for name,marker,body in re.findall(r"cat > /opt/common-ground-verifier/([^ ]+) <<'(COMMON_GROUND_HELPER_\d+)'\n([\s\S]*?)\n\2\n",runner)}
for name in ('app-lifecycle','prompt-provenance','score'):
    body = helpers[name]
    check(name+' has explicit interpreter',body.startswith('#!/usr/local/bin/python3\n'))
    ast.parse(body)
    check(name+' body parses',True)
    check(name+' called directly',bool(re.search(r'(?:^|\n)(?:  |if ! )?/opt/common-ground-verifier/'+name+r'(?:\s|$)',runner)))
check('three executables receive private mode700', 'chmod 700 /opt/common-ground-verifier/app-lifecycle \\\n  /opt/common-ground-verifier/prompt-provenance /opt/common-ground-verifier/score \\\n' in runner)
check('functional restart calls executable directly','Run ONCE: /opt/common-ground-verifier/app-lifecycle restart.' in (TASK/'tests/functional/prompt.md').read_text(encoding='utf-8'))
for prompt in (TASK/'tests').glob('*/prompt.md'):
    content = prompt.read_text(encoding='utf-8')
    check('no obsolete helper references '+prompt.parent.name,not any(name in content for name in ('app-lifecycle.py','prompt-provenance.py','score.py')))
report = {'passed':len(checks),'failed':0,'platform_checker_executed':False,'old_reported_matches':sorted(old_names),'new_matches':sorted(new_names),'checks':checks}
(HERE/'entrypoint-contract-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k != 'checks'},indent=2))
