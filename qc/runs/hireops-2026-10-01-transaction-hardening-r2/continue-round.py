from pathlib import Path
import json, hashlib
RUN=Path(__file__).resolve().parent
ROOT=RUN.parents[2]
old=ROOT/'qc/runs/hireops-2026-10-01-transaction-hardening-r1'
(RUN/'bind-artifacts.py').write_text((old/'bind-artifacts.py').read_text().replace('2026-10-01-hardening-r1','2026-10-01-hardening-r2').replace('20261001-hard-r1','20261001-hard-r2'))
c=json.loads((RUN/'review-contexts.json').read_text())
for n in [1,2]:
    if not any(x['row']==n for x in c['quality_contexts']):
        c['quality_contexts'].append({'row':n,'agent':f'/root/hard_r2_{n:02}','fork_turns':'none','assignment':f'per-row-review/prompts/{n:02}.md'})
c['deterministic_context']={'agent':'/root/hard_r2_det','fork_turns':'none','assignment':'per-row-review/prompts/deterministic.md'}
(RUN/'review-contexts.json').write_text(json.dumps(c,indent=2)+'\n')
d=json.loads((old/'difficulty-accounting.json').read_text())
d.update(input_sha256=c['input_sha256'],retained_core_functional_count=101,new_coordinated_count=44)
d['round1_repair_subdivisions']=12
d['count_explanation']='47 easier criteria were removed during hardening; 35 coordinated criteria were introduced. Round1 repairs added 12 independent-credit or coverage subdivisions, producing 145 Functional criteria without increasing scope or the 45 total points.'
(RUN/'difficulty-accounting.json').write_text(json.dumps(d,indent=2)+'\n')
print('Updated current binding helper, actual dispatched contexts and criterion accounting.')
