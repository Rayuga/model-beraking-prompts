from pathlib import Path
import json
import shutil
import subprocess
import sys
import tomllib

ROOT = Path.cwd()
OUT = Path(__file__).resolve().parent
OLD = OUT.parent / 'final-audit-2026-09-28'
TASK = ROOT / 'projects/ridgeline-print-storefront'
path = TASK / 'tests/scored/functional/judge.toml'
path.write_text(path.read_text().replace('facts belowuse', 'facts below use'), encoding='utf-8', newline='\n')

mapping = json.loads((OLD / 'outcome_map.json').read_text())
new_ids = ['ridgeline_catalogue_cards_show_price_and_stock', 'ridgeline_catalogue_offered_variant_details', 'ridgeline_print_photographs_match_details']
for group in mapping['mapping']:
    if group['original_id'] == 'ridgeline_catalogue_cards_and_variant_details':
        group['outcomes'] = [{'id': name, 'weight': '0.1'} for name in new_ids]
(OUT / 'outcome_map.json').write_text(json.dumps(mapping, indent=2))

source = (OLD / 'source_audit.py').read_text()
source = source.replace("== 40 and", "== 42 and")
source = source.replace("polish weight preserved across five independent outcomes", "polish weight preserved across seven outcomes")
source = source.replace("len(judges['polish']['criterion']) == 5", "len(judges['polish']['criterion']) == 7")
source = source.replace("'Labels, mobile fit, feedback, themes and keyboard view navigation'", "'Names, reachability and visible focus separated; total remains four'")
start = source.index("check('suite validates errors and incomplete observation'")
end = source.index("\ncheck('timeout nesting'", start)
source = source[:start] + '''check('suite orchestration matches current template', read(task/'tests/test.sh').split('run_suite() {',1)[1] == read(template/'tests/test.sh').split('run_suite() {',1)[1], 'Canonical suite scoring; no added whole-suite rejection of a row error')
check('no reasoning sentinel or suite-rejection instructions', all('EVALUATION_INCOMPLETE' not in read(p) for p in (task/'tests').rglob('*') if p.is_file()), 'Unavailable evidence must not invalidate observed unrelated outcomes')
''' + source[end:]
(OUT / 'source_audit.py').write_text(source, encoding='utf-8')

for name in ['golden', 'harness']:
    (OUT / name).mkdir(exist_ok=True)
for name in ['boundary-flow.js', 'run_mcp.py']:
    shutil.copyfile(OLD / 'golden' / name, OUT / 'golden' / name)
shutil.copyfile(OLD / 'launch_browser.py', OUT / 'launch_browser.py')
shutil.copytree(OLD / 'harness/fixtures', OUT / 'harness/fixtures', dirs_exist_ok=True)
runner = (OLD / 'harness/run_orchestration_regressions.py').read_text().replace('ridgeline-final-harness-', 'ridgeline-risk-harness-')
(OUT / 'harness/run_orchestration_regressions.py').write_text(runner)

inventory = subprocess.run([sys.executable, '-X', 'utf8', 'harbor-webdev-rubric-qc/scripts/list_checks.py', '--json'], capture_output=True, encoding='utf-8', check=True).stdout
(OUT / 'qc_inventory.json').write_text(inventory, encoding='utf-8')
print('Prepared source assertions, unchanged golden browser flow, and actual-shell orchestration.')
