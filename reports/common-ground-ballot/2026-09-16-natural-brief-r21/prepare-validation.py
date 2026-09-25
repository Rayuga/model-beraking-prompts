from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PREVIOUS = ROOT/'reports/common-ground-ballot/2026-09-16-runtime-contract-r20'
source = (PREVIOUS/'validate-package.py').read_text(encoding='utf-8')
source = source.replace('actual r20 upload', 'actual r21 upload')
source = source.replace("REPORT = Path(__file__).resolve().parent", "REPORT = Path(__file__).resolve().parent\nPREVIOUS = ROOT / 'reports/common-ground-ballot/2026-09-16-runtime-contract-r20'")
source = source.replace("REPORT/'runtime-sources'", "PREVIOUS/'runtime-sources'")
source = source.replace("REPORT/'before-r20.zip'", "PREVIOUS/'before-r20.zip'")
source = source.replace("('every protected workspace', 'starts at revision 1', 'by exactly one', 'distinct session credential', 'Pending actions', 'DB_PATH', 'SEED_PATH', '0.0.0.0')", "('visible wherever they\'re signed in', 'starts at revision 1', 'exactly one', 'distinct, unpredictable session credential', 'Pending actions', 'DB_PATH', 'SEED_PATH', '0.0.0.0')".replace("'visible wherever they're signed in'", '"visible wherever they\'re signed in"'))
(HERE/'validate-package.py').write_text(source,encoding='utf-8',newline='\n')
print('ZIP validator retained; public-text anchors updated to the rewritten sentences. Verifier prompt versions remain r20.')
