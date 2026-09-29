from pathlib import Path
import json
import subprocess
import sys

root=Path('/usr/local/lib/python3.12/site-packages/rewardkit')
matches=[]
for p in root.glob('*.py'):
    lines=p.read_text().splitlines()
    for i,line in enumerate(lines):
        if 'likert' in line.lower() or 'points - 1' in line or '/ criterion.points' in line:
            matches.append({'file':p.name,'line':i+1,'context':'\n'.join(lines[max(0,i-3):i+7])})
result={'rewardkit_source_evidence':matches}
print(json.dumps(result,indent=2))
