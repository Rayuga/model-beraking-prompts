from pathlib import Path
import json,os,re
rows=[json.loads(s) for p in Path('/root/.claude/projects').rglob('*.jsonl') for s in p.read_text().splitlines()]
selected=[r for r in rows if r.get('type')=='system'][-3:]
text=json.dumps(selected)
for name in ['ANTHROPIC_AUTH_TOKEN','ANTHROPIC_API_KEY','OPENROUTER_API_KEY']:
 value=os.environ.get(name)
 if value:text=text.replace(value,'[REDACTED]')
text=re.sub(r'sk-[A-Za-z0-9_-]{12,}','[REDACTED]',text)
print(text[:7000])
