from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / '2026-09-15-r9-qc-repair'
OUT = HERE / 'golden-validation'
OUT.mkdir(exist_ok=True)
for name in ('golden-evidence-workflows.cjs','golden-setup.sh','rewardkit'):
    assert not (OUT/name).exists()
    shutil.copyfile(OLD/'golden-validation'/name, OUT/name)
setup = (OUT/'golden-setup.sh').read_text().replace('python3 /tests/rewardkit-compat.py\n','')
assert 'compat' not in setup
(OUT/'golden-setup.sh').write_text(setup, newline='\n')
driver = (OLD/'run-golden.py').read_text().replace('1.0.0-r9-qc-repair-20260915','1.0.0-r10-static-repair-20260915').replace('pellmoor-r9-golden','pellmoor-r10-golden').replace('Frozen r9','Frozen r10')
(HERE/'run-golden.py').write_text(driver,newline='\n')
print('Prepared frozen r10 golden/lifecycle regression without scoring patch')
