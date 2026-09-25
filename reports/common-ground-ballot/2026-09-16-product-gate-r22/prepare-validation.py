from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PREVIOUS = ROOT/'reports/common-ground-ballot/2026-09-16-runtime-contract-r20'
source = (ROOT/'reports/common-ground-ballot/2026-09-16-natural-brief-r21/validate-package.py').read_text(encoding='utf-8')
source = source.replace('actual r21 upload','actual r22 upload')
source = source.replace("check('r20 prompt version ' + dimension, f'Prompt version: common-ground-ballot-{dimension}-v1.0.0-r20' in prompt)","check('expected prompt version ' + dimension, f'Prompt version: common-ground-ballot-{dimension}-v1.0.0-r{22 if dimension == \"render\" else 20}' in prompt)")
(HERE/'validate-package.py').write_text(source,encoding='utf-8',newline='\n')
for name in ('runtime-smoke.py','run-runtime-checks.py'):
    content = (PREVIOUS/name).read_text(encoding='utf-8')
    content = content.replace('all 69 criteria','all 70 criteria').replace("discovery['criteria_count'] == 69","discovery['criteria_count'] == 70")
    content = content.replace('20260916-r20-runtime-validation','20260916-r22-runtime-validation')
    (HERE/name).write_text(content,encoding='utf-8',newline='\n')
content = (PREVIOUS/'build-runtime.py').read_text(encoding='utf-8').replace('20260916-r20-runtime-validation','20260916-r22-runtime-validation').replace('exact r20 runner','exact r22 runner')
(HERE/'build-runtime.py').write_text(content,encoding='utf-8',newline='\n')
print('Prepared r22 validator/runtime check; only Render prompt version advances.')
