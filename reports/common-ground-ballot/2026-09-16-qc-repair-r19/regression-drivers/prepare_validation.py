from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
OLD=ROOT/'reports/common-ground-ballot/2026-09-15-coverage-r16'
for name in ['validate.py','run-local.py','browser-regression.cjs','auth-gate.cjs','session-regression.cjs',
    'mcp-crosscheck.cjs','qc-score-regression.py','polish-regression.cjs','role-matrix.cjs','coverage-regression.cjs',
    'coverage_mutants.py','strict-regression.cjs','staff-regression.cjs','agent-smoke.cjs']:
    source=(OLD/name).read_text(encoding='utf-8').replace('20260915-r16','20260915-r17')
    if name=='run-local.py':
        source=source.replace('functional=43, polish=10','functional=49, polish=10').replace('all 62 criteria','all 68 criteria')
        source=source.replace("'roles','coverage']","'roles','coverage','recovery','boundaries']")
        source=source.replace("    elif args.mode=='coverage':", "    elif args.mode=='recovery':\n        browser(script='recovery-regression.cjs')\n    elif args.mode=='boundaries':\n        browser(script='strict-boundaries.cjs')\n    elif args.mode=='coverage':")
        source=source.replace("    APP.mkdir(exist_ok=True)","    APP.mkdir(exist_ok=True)\n    if os.environ.get('STRICT_APP') == 'gpt':\n        shutil.copytree('/model', APP, dirs_exist_ok=True)\n        subprocess.run(['chown','-R','65534:65534','/app'],check=True)\n        return",1)
    if name=='validate.py':
        source=source.replace("        command += ['--mount',", "        command += ['--mount',")
        anchor="    command += [IMAGES['verifier'], 'python3', '/validation/run-local.py', mode]"
        source=source.replace(anchor,"    if '--gpt' in sys.argv:\n        model = ROOT / 'run-outputs/common-ground-ballot/run-d9981dfb-d091-4621-b264-b4ef078bad3b/common-ground-ballot__Vjmb2mT/artifacts/app'\n        command += ['--env','STRICT_APP=gpt','--mount',f'type=bind,source={model},target=/model,readonly']\n"+anchor)
        source=source.replace("destination = OUT / ('validation-' + mode)","destination = OUT / ('validation-' + mode + ('-gpt' if '--gpt' in sys.argv else ''))")
    (OUT/name).write_text(source,encoding='utf-8',newline='\n')
(OUT/'Dockerfile.local-verifier').write_text('FROM ballot-verifier:20260915-r16-local\nRUN rm -rf /tests\nCOPY . /tests\nRUN chmod +x /tests/test.sh && chmod -R go-rwx /tests\nWORKDIR /tests\n',encoding='utf-8')
(OUT/'Dockerfile.local-agent').write_text('FROM ballot-agent:20260915-r15-local\nCOPY instructions/ /instructions/\nCOPY assets/ /assets/\nRUN chmod -R a+rX /instructions /assets\nWORKDIR /app\n',encoding='utf-8')

for name in ['check-standard.py','check-upload.py']:
    path=ROOT/'references/task-templates'/name
    source=path.read_text(encoding='utf-8')
    shutil.copyfile(path,OUT/(name+'.before'))
    if name=='check-standard.py':
        old="ballot_r16 = ballot_r15 and 'common-ground-ballot-polish-v1.0.0-r8' in (task/'tests/polish/prompt.md').read_text(encoding='utf-8')"
        new="ballot_r16 = ballot_r15 and bool(re.search(r'common-ground-ballot-polish-v1\\.0\\.0-r(?:[89]|[1-9][0-9]+)\\b', (task/'tests/polish/prompt.md').read_text(encoding='utf-8')))"
    else:
        old="ballot_r16=ballot_r15 and b'common-ground-ballot-polish-v1.0.0-r8' in files.get('tests/polish/prompt.md',b'')"
        new="ballot_r16=ballot_r15 and bool(re.search(rb'common-ground-ballot-polish-v1\\.0\\.0-r(?:[89]|[1-9][0-9]+)\\b',files.get('tests/polish/prompt.md',b'')))"
    assert old in source
    path.write_text(source.replace(old,new,1),encoding='utf-8',newline='\n')
print('r17 local validation drivers and current checker profile ready.')
