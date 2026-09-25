from pathlib import Path
import re
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT/'projects/common-ground-ballot'
PREVIOUS = ROOT/'reports/common-ground-ballot/2026-09-16-qc-repair-r19'
NAMES = {'app-lifecycle.py':'app-lifecycle', 'prompt-provenance.py':'prompt-provenance', 'score.py':'score'}

with zipfile.ZipFile(HERE/'before-r20.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(TASK.rglob('*')):
        if path.is_file(): archive.write(path,path.relative_to(TASK).as_posix())

runner_path = TASK/'tests/test.sh'
runner = runner_path.read_text(encoding='utf-8')
for old,new in NAMES.items():
    runner = runner.replace('python3 /opt/common-ground-verifier/'+old, '/opt/common-ground-verifier/'+new)
    runner = runner.replace('/opt/common-ground-verifier/'+old, '/opt/common-ground-verifier/'+new)
    runner = runner.replace("'"+old+"'", "'"+new+"'")
    pattern = r"(cat > /opt/common-ground-verifier/"+re.escape(new)+r" <<'COMMON_GROUND_HELPER_\d+'\n)"
    runner,count = re.subn(pattern,r'\1#!/usr/local/bin/python3\n',runner)
    assert count == 1, new
runner = runner.replace('chmod 700 /opt/common-ground-verifier/codex-trace.py',
'''# These commands belong to the verifier. The submission entry is /app/server.js.
chmod 700 /opt/common-ground-verifier/app-lifecycle \\
  /opt/common-ground-verifier/prompt-provenance /opt/common-ground-verifier/score \\
  /opt/common-ground-verifier/codex-trace.py''')
runner_path.write_text(runner,encoding='utf-8',newline='\n')
for prompt in (TASK/'tests').glob('*/prompt.md'):
    content = prompt.read_text(encoding='utf-8')
    content = content.replace('python3 /opt/common-ground-verifier/app-lifecycle.py restart', '/opt/common-ground-verifier/app-lifecycle restart')
    content = content.replace('tests/score.py', '/opt/common-ground-verifier/score')
    content = re.sub(r'(Prompt version: common-ground-ballot-\w+-v1\.0\.0-)r19',r'\g<1>r20',content)
    prompt.write_text(content,encoding='utf-8',newline='\n')
readme = TASK/'README.md'
content = readme.read_text(encoding='utf-8')
content = content.replace('The image retains the genuine Codex executable.',
'''The lifecycle, provenance and score helpers are standalone executable verifier
commands with explicit Python shebangs; they are not application entrypoints and
are never copied into the submitted app. The application entrypoint remains
`node /app/server.js`, which `solution/solve.sh` installs.
The image retains the genuine Codex executable.''')
readme.write_text(content,encoding='utf-8',newline='\n')
sources = HERE/'runtime-sources'
sources.mkdir(exist_ok=True)
for name,marker,body in re.findall(r"cat > /opt/common-ground-verifier/([^ ]+) <<'(COMMON_GROUND_HELPER_\d+)'\n([\s\S]*?)\n\2\n",runner):
    (sources/name).write_text(body+'\n',encoding='utf-8',newline='\n')

# Retain the comprehensive layout validator and explicitly evolve its assertions
# for executable helper names and the new prompt version. Historical reports stay intact.
validator = (PREVIOUS/'validate-package.py').read_text(encoding='utf-8')
validator = validator.replace('r19 upload', 'r20 upload').replace("check('r19 prompt version", "check('r20 prompt version").replace('-v1.0.0-r19\'', '-v1.0.0-r20\'')
validator = validator.replace("if name.endswith('.py'): ast.parse(body)", "if not name.endswith('.js'): ast.parse(body)")
validator = validator.replace("REPORT/'before-r19.zip'", "REPORT/'before-r20.zip'")
(HERE/'validate-package.py').write_text(validator,encoding='utf-8',newline='\n')
print('Private executable helpers installed; app/golden/rubric/weights unchanged.')
