"""Collect independently written one-agent-per-check reports; never invent verdicts."""
from pathlib import Path
from collections import Counter
import argparse, hashlib, json, sys

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--run',required=True)
args=parser.parse_args()
base=(root/args.run).resolve()
assert base.is_relative_to(root/'qc/runs')
out=base/'per-row-review'
assignment=json.loads((out/'assignment.json').read_text(encoding='utf-8'))
manifest=json.loads((base/'manifest.json').read_text(encoding='utf-8'))
rows=[]; missing=[]; invalid=[]
for expected in assignment['checks']:
    path=out/f"rows/{expected['number']:02d}.json"
    if not path.exists(): missing.append(expected['number']); continue
    try:
        row=json.loads(path.read_text(encoding='utf-8-sig'))
        assert row['number']==expected['number'] and row['id']==expected['id']
        assert row['input_sha256']==assignment['input_sha256']
        assert row['verdict'] in {'Pass','Fail','Note','N-A','Not exercised'}
        assert isinstance(row['risk'],bool) and row['evidence'] and row['sources_read'] and row['reviewer']
        if row['verdict']=='Fail': assert row['counterexample'] and row['suggested_fix']
        rows.append(row)
    except Exception as e: invalid.append(f'{path.name}: {type(e).__name__}: {e}')
names=[r['reviewer'] for r in rows]
if len(names)!=len(set(names)): invalid.append('A reviewer was reused; each point needs a distinct agent context.')
for rel,digest in manifest['inputs']['task'].items():
    path=root/manifest['task']/rel
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=digest: invalid.append('Source drift: '+rel)
sys.path.insert(0,str(root/'scripts'))
from qc_pipeline import verify_frozen
invalid.extend(verify_frozen(base,manifest))
risks=[r for r in rows if r['risk'] or r['verdict']=='Fail']
status='INCOMPLETE' if missing or invalid else ('BLOCKED' if risks else 'SOURCE_REVIEW_COMPLETE_RUNTIME_NOT_CLEARED')
summary={'status':status,'input_sha256':assignment['input_sha256'],'dedicated_agents_completed':len(rows),'total':53,'missing':missing,'invalid':invalid,'verdicts':dict(Counter(r['verdict'] for r in rows)),'risks':[{'number':r['number'],'id':r['id'],'verdict':r['verdict'],'evidence':r['evidence'],'counterexample':r['counterexample'],'suggested_fix':r['suggested_fix']} for r in risks],'portal_pass_claimed':False}
(out/'summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
lines=['# Dedicated review of all 53 QC points','',f'**{status}** — {len(rows)}/53 separate agent reports.','',
       'One agent per quality check, as explicitly requested. Workers ran concurrently up to the session limit of three. No averaging or majority voting. Task source was kept unchanged. Earlier reviews remain historical evidence; this is a fresh audit of the identified candidate.','',
       'Scripted golden execution is separate from full judge timing, Oracle grading and target-model scores. A passing source row is not a portal guarantee.','',
       'The table links to each independent report, which retains full citations, witnesses and measurement limits. Short excerpts below are navigation aids, not replacement evidence.','',
       '| # | QC point | Verdict | Evidence / remaining issue |','|---|---|---|---|']
for e in assignment['checks']:
    r=next((r for r in rows if r['number']==e['number']),None)
    if r:
        ev=(r['counterexample'] or r['evidence']).replace('|','/').replace('\n',' ')
        if len(ev)>420: ev=ev[:417]+'...'
        lines.append(f"| {r['number']} | [{r['id']}](rows/{r['number']:02d}.json) | {r['verdict']} | {ev} |")
    else: lines.append(f"| {e['number']} | {e['id']} | Pending | No valid dedicated report yet. |")
(out/'QC_53_POINTS.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
if len(rows)==53 and not invalid:
    deterministic=json.loads((out/'deterministic.json').read_text(encoding='utf-8')) if (out/'deterministic.json').exists() else []
    findings=[{'id':f"Q{r['number']:02d}",'check':r['id'],'severity':r['severity'] or 'P2','run_verdict':r['run_verdict'],'title':r['id'],'evidence':r['evidence'],'impact':r['counterexample'] or 'Required evidence or assurance is missing.','fix':r['suggested_fix'] or 'Obtain the missing evidence.'} for r in rows if r['verdict']=='Fail']
    payload={'tasks':[{'name':'Colderwater 53 dedicated agents','checks':[{'id':r['id'],'verdict':r['verdict'],'severity':r['severity'] or '', 'evidence':r['evidence'],'finding':r['counterexample'] or '', 'action':r['suggested_fix'] or ''} for r in rows],'findings':findings}],'deterministic':deterministic}
    (out/'findings.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({k:summary[k] for k in ['status','dedicated_agents_completed','missing','invalid','verdicts']}))
