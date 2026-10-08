from pathlib import Path
import hashlib,json,sys
RUN=Path(__file__).resolve().parent; ROOT=RUN.parents[2]
m=json.loads((RUN/'manifest.json').read_text())
c=json.loads((RUN/'review-contexts.json').read_text())
for arg in sys.argv[1:]:
    n=int(arg)
    if not any(x['row']==n for x in c['quality_contexts']):
        c['quality_contexts'].append({'row':n,'agent':f'/root/hard_r2_{n:02}','fork_turns':'none','assignment':f'per-row-review/prompts/{n:02}.md'})
if len(sys.argv)>1:
    (RUN/'review-contexts.json').write_text(json.dumps(c,indent=2)+'\n')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
drift={}
for section,base,files in [('task',ROOT/m['task'],m['inputs']['task']),('engine',ROOT,m['engine_inputs'])]:
    for p,h in files.items():
        actual=sha(base/p)
        if actual!=h:drift[section+':'+p]={'frozen':h,'current':actual}
for section,base,files in [('task',ROOT/m['task'],m['inputs']['task']),('frozen-task',ROOT/m['cache']/'task',m['inputs']['task']),('frozen-rules',ROOT/m['cache']/'rules',m['inputs']['rules'])]:
    actual_files={p.relative_to(base).as_posix():sha(p) for p in base.rglob('*') if p.is_file()}
    if actual_files!=files:
        drift[section+':tree']={'extra':sorted(set(actual_files)-set(files)),'missing':sorted(set(files)-set(actual_files)),'changed':sorted(p for p in set(actual_files)&set(files) if actual_files[p]!=files[p])}
rows=[]
for p in sorted((RUN/'per-row-review/rows').glob('[0-9][0-9].json')):
    r=json.loads(p.read_text());rows.append({'number':r['number'],'verdict':r['verdict'],'risk':r['risk']})
status={'input_sha256':m['input_sha256'],'dispatched_quality':sorted(x['row'] for x in c['quality_contexts']),'completed_quality':rows,'deterministic_complete':(RUN/'per-row-review/deterministic.json').exists(),'drift':drift}
(RUN/'progress.json').write_text(json.dumps(status,indent=2)+'\n')
completed={r['number'] for r in rows}
print(json.dumps({'completed_quality':len(rows),'dispatched_pending':sorted(x['row'] for x in c['quality_contexts'] if x['row'] not in completed),'not_dispatched':sorted(set(range(1,54))-{x['row'] for x in c['quality_contexts']}),'deterministic_complete':status['deterministic_complete'],'risk_rows':[r['number'] for r in rows if r['risk']],'drift':drift}))
