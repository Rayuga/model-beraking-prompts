import openpyxl,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[4]
w=openpyxl.load_workbook(root/'.qc-cache/coldwater-2026-09-29-round3/rules/WebDev Rubrics QC.xlsx',data_only=True)
for s in w:
 if len(sys.argv)>1 and s.title!=sys.argv[1] and not(sys.argv[1]=='--other' and s.title not in ['Quality Checks','Deterministic Checks','Internal Quality Checks']):continue
 for i,r in enumerate(s.values,1):
  if any(x is not None for x in r):print(s.title,i,tuple(x for x in r if x is not None))
