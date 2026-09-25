from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tomllib
import zipfile

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TASK=ROOT/'projects/common-ground-ballot'
PREVIOUS=HERE.parent/'2026-09-17-conflict-review-r25'
s=(PREVIOUS/'write-review.py').read_text(encoding='utf-8')
insert="""
('Review a selected meeting round without writes','We sometimes put several decisions', ['round_review_and_cancel']),
('Commit every selected opening and fixed snapshot together','When she confirms a round', ['round_atomic_open']),
('Refuse any changed draft and explicitly review again','When she confirms a round', ['round_draft_conflict']),
('Whole-roster revisions, including change-and-return','The member list can change under her', ['round_roster_conflict']),
('Whole-round admissibility and required revision types',"I don't want a malformed selection", ['round_input_boundaries']),
('Server-enforced Coordinator authority for rounds',"I don't want a malformed selection", ['round_role_boundaries']),
('Canonical round identity, namespace and original success','For retries, order', ['round_success_receipt']),
('Original round refusals survive later confirmations','Changing the selection or a reviewed revision', ['round_refusal_receipts']),
('One durable original pending round and current-state refresh','An interrupted round belongs', ['round_pending_recovery']),
"""
s=s.replace(']\nmapped={criterion:',insert+']\nmapped={criterion:',1)
s=s.replace('all 57 Functional','all 66 Functional').replace('five dimensions/77 criteria','five dimensions/86 criteria').replace('57 independently','66 independently').replace('Wrote 57-row','Wrote 66-row')
override="""
notes.update({
  1:'First-person product request now explains the meeting use case for reviewing and opening a round.',
  4:'66-row Functional coverage map plus unchanged Render/Constraints/Polish/Visual ownership; no-active roster, malformed versions and cross-action round namespace explicitly covered.',
  6:'Four pairs and one outsider use existing accounts and normal UI. Leila remains at membership revision 1 until its boolean-type control; no reset is required.',
  11:'Standard agent 7200s; supplied SQLite/auth/session/shell foundation retained. Functional 7200s versus last measured old run 1929s; round plan reuses four pairs, bounded tables and the one restart, with a 20-minute persistence reserve. New full autonomous duration remains unmeasured. Sum12000 < runner12600 < outer13200.',
  17:'96 golden browser checks: 78 existing plus 18 real-MCP round checks, including 16 malformed packets, three role probes, a held initial reply and real restart.',
  18:'Golden server/client implement all nine round owners; other four verifier definitions and prompts are byte-identical.',
  26:'Every added round paragraph maps to one or more of nine distinct owners; existing presentation/runtime requirements retain their owners.',
  27:'Round preview, atomic commit, draft/roster conflicts, validation, permissions, canonical receipts, original refusals and recovery are all public requirements.',
  28:'Round permissions and input validation are split. Individual-ballot persistence excludes round records; atomic round persistence owns those records. Receipt computation and outgoing recovery identity have separate failure witnesses.',
  30:'Accepted mixed-method round is the positive control for all refusals; probes use current authorized inputs except the one changed variable.',
  31:'Both methods, all three denied roles, both draft conflict types, whole roster including paused Members, empty active roster, both revision locations/types and both success/refusal receipts have observations.',
  32:'Actual preview, confirmations, packets, protected records, audit, Member visibility and restart supply evidence; no route or schema is prescribed.',
  34:'Pinned MCP/browser exercised cancellation, re-review, stale confirmations, held initial response, reload, sign-in, current-state Retry, real restart and narrow viewport.',
  36:'All round fixtures are freshly created through UI; no round outcome is pre-seeded or hardcoded.',
  37:'Round mutations occur after seed checks; Leila revision-1 control reserved explicitly; later dimensions use current state.',
  38:'Missing round feature ends affected cases only. Direct observed server receipts remain independently testable when recovery UI fails, and vice versa.',
  44:'Functionality60%, Polish20%, Visual20%; gated shells0. New round outcomes weigh30/103.5 of Functional (17.39% overall). Complex atomic/receipt/recovery workflows use existing weight4 precedent; preview3, validation2, permissions1. Previous weights are unchanged.',
  47:'Pinned model/runtime and temperature0; Functional r26. Scripted passes do not imply deterministic autonomous judging.',
  48:'One extra round success and three round refusals reuse the final restart. Whole-round retention refreshes Closed/Open current state; original receipts never replace it.',
  53:'Association-specific anonymous ballots now include same-meeting opening against a reviewed roster; this is real product work, not a target-model exception.',
})
"""
s=s.replace("review=['# Local review",override+"\nreview=['# Local review",1)
s=s.replace('All six disposable mutations are detected.', 'Six r25 mutations were detected in the previous release; this release additionally detects six round defects: partial commit, status-only roster checks, order-sensitive receipts, missing original refusals, role bypass and updated-revision Retry.')
(HERE/'write-review.py').write_text(s,encoding='utf-8',newline='\n')
subprocess.run([sys.executable,str(HERE/'write-review.py')],check=True)

files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
with zipfile.ZipFile(HERE/'before-r26.zip') as z:
    changed=[name for name,data in files.items() if data!=z.read(name)]
    same=[name for name,data in files.items() if data==z.read(name)]
    old=tomllib.loads(z.read('tests/functional/judge.toml').decode())
    current=tomllib.loads(files['tests/functional/judge.toml'].decode())
    weights={c['id']:c['weight'] for c in current['criterion']}
    assert all(weights[c['id']]==c['weight'] for c in old['criterion'])
    assert sum(weights.values())==103.5
    for dim in ('render','constraints','polish','visual'):
        for n in ('judge.toml','prompt.md'): assert f'tests/{dim}/{n}' in same
    for n in ('tests/test.sh','tests/Dockerfile','environment/Dockerfile','solution/solve.sh'):assert n in same
    before=tomllib.loads(z.read('task.toml').decode());after=tomllib.loads(files['task.toml'].decode())
    assert all(before[k]==after[k] for k in ('schema_version','artifacts','agent','environment','verifier'))
(HERE/'change-review.json').write_text(json.dumps({'changed':sorted(changed),'unchanged':sorted(same),'previous_weights_unchanged':True,'functional_weight_total':103.5,'new_weight':30},indent=2)+'\n',encoding='utf-8')
projection={'measured_new_model_run':False,'reference_run':'r24 GPT-5.4-mini pArUoq4','previous_functional_points_retained':47.5,'functional_total':103.5,'functional':47.5/103.5,'polish':10/14,'visual':5/6,'conditional_reward':.6*47.5/103.5+.2*(10/14)+.2*(5/6),'target':.6,'assumptions':['All other historical verdicts repeat.','The six r25 new outcomes remain absent or defective as reproduced.','The unchanged previous GPT app earns none of the nine new round outcomes; UI replay confirms no round workflow.','A freshly built model submission and autonomous judge may produce different results.']}
(HERE/'previous-gpt-projection.json').write_text(json.dumps(projection,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'changed':sorted(changed),'conditional_reward':projection['conditional_reward']},indent=2))
