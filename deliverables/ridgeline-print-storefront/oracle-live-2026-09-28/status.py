import json,time
from pathlib import Path
root=Path('/logs/verifier')
result={'time':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'files':[]}
for p in root.rglob('*'):
 if p.is_file() and (p.name.endswith('.json') or p.name in ['rewardkit.log','app.log']):
  item={'path':str(p.relative_to(root)),'bytes':p.stat().st_size}
  if p.name in ['reward.json','completion.json']:
   try:item['result']=json.loads(p.read_text())
   except Exception:pass
  result['files'].append(item)
print(json.dumps(result))
