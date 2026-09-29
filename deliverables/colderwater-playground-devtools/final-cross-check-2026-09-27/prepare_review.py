from pathlib import Path
import json
import shutil

out = Path(__file__).resolve().parent
prior = out.parent / 'eight-issue-fix-2026-09-27'
for name in ['source_audit.py', 'qc_inventory.json']:
    shutil.copyfile(prior / name, out / name)
build = (prior / 'build_and_check_images.py').read_text(encoding='utf-8').replace('20260927-eight-issue-fix', '20260927-final-cross-check').replace('build-{role}-eight-issue-fix.log', 'build-{role}-final-cross-check.log')
(out / 'build_and_check_images.py').write_text(build, encoding='utf-8')
baseline = json.loads((prior / 'candidate_manifest.json').read_text(encoding='utf-8'))
(out / 'baseline_binding.json').write_text(json.dumps({'archive': '../eight-issue-fix-2026-09-27/' + baseline['archive'], 'sha256': baseline['sha256'], 'source_sha256': baseline['source_sha256'], 'scope': 'The previous archive remains immutable. New findings supersede its affected review conclusions.'}, indent=2) + '\n', encoding='utf-8')
print('Prepared final cross-check audit/build inputs with immutable a017 baseline.')
