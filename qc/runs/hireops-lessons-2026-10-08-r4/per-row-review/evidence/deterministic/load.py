import sys
from pathlib import Path
from rewardkit.runner import discover
from rewardkit.judges import build_prompt, _build_response_schema
import json
ctx=Path('/tests/app_context.md').read_text().strip()
for suite in ('gates','scored'):
    rs=discover('/tests/'+suite, workspace='/tmp')
    for r in rs:
        j=r.judge
        print(suite, r.name, type(j).__name__, getattr(j,'agent',None), j.mode, j.timeout, [m.name for m in j.mcp_servers], [ (m.command, list(m.args)) for m in j.mcp_servers if m.name=='verifier'], r.aggregation, len(r.criteria), r.weights)
        tmpl=r.system_prompt.replace('{app_context}',ctx)
        if j.mode=='individual':
            sizes=[len(build_prompt([c],template=tmpl).encode()) for c in r.criteria]
            print('  per-criterion prompt bytes max',max(sizes),'min',min(sizes))
            for c in r.criteria: _build_response_schema([c])
        else:
            print('  prompt bytes',len(build_prompt(r.criteria,template=tmpl).encode()))
            _build_response_schema(r.criteria)
print('LOADER_OK')
