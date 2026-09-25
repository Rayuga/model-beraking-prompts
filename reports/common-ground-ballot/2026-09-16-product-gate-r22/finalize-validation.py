from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
judge = ROOT / 'projects/common-ground-ballot/tests/render/judge.toml'
text = judge.read_text(encoding='utf-8')
old = 'Use one fixture and five normal business writes; no edit, negative-probe matrix, receipt replay or extra process restart is needed.'
new = 'The core journey uses one fixture and five normal business writes; conditional roster setup is described in the prompt. No edit, negative-probe matrix, receipt replay or extra process restart is needed.'
assert old in text
judge.write_text(text.replace(old, new), encoding='utf-8', newline='\n')

diagnostic = HERE / 'diagnostic-attempt-1'
diagnostic.mkdir(exist_ok=True)
shutil.copy2(HERE / 'gate-run-results.json', diagnostic / 'gate-run-results.json')
for variant in ('readonly', 'create_only'):
    shutil.copytree(HERE / ('gate-' + variant), diagnostic / ('gate-' + variant), dirs_exist_ok=True)

check = HERE / 'check-order-and-score.py'
text = check.read_text(encoding='utf-8')
text = text.replace('scorer = {}\n', '').replace("exec(compile(score_source,'generated-private-score','exec'), {'__name__':'scorer'}, scorer)\n", '')
check.write_text(text, encoding='utf-8', newline='\n')
