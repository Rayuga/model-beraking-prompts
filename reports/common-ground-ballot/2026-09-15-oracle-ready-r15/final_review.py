import json
import re
import tomllib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
TASK=ROOT/'projects/common-ground-ballot'
OUT=Path(__file__).resolve().parent
p=TASK/'tests/functional/judge.toml';s=p.read_text(encoding='utf-8')
old=next(c for c in tomllib.loads(s)['criterion'] if c['id']=='close_transition_and_vote_boundary')
marker='[[criterion]]\nid = "close_transition_and_vote_boundary"'
start=s.index(marker);end=s.index('[[criterion]]',start+len(marker))
blocks=[]
for id,desc in [
 ('ballot_close_transition','As Ruth, close Courtyard through the visible control. Require Closed status, exactly one revision advance, and the same definition and participation after a protected reread and reload. This grades the accepted Close transition only. Closed-state vote refusal and release timing have separate criteria.'),
 ('closed_vote_refusal','Use Future roster probe and eligible, unparticipated Owen for the shared Closed-state checkpoint. Open his valid Yes voting form while Open, then close the ballot as Ruth. With Owen\'s actual request shape, a fresh operation ID and current Closed revision, attempt that otherwise valid vote. Require refusal and unchanged participation, turnout, content, revision and audit. An already-participated user, stale version or malformed input does not prove this boundary. The earlier successful Open vote on Courtyard supplies its request-shape positive control. The shared workflow provides a clean fallback if another failure consumed Future.')]:
 blocks.append(f'[[criterion]]\nid = "{id}"\nname = "{id}"\ntype = "binary"\nweight = 0.375\ndescription = """\n{desc}\n"""\n\n')
s=s[:start]+''.join(blocks)+s[end:]
s=s.replace("2. Confirm no participant identity is shown beside either result and the result survives refresh.","2. Require the result to survive refresh. Choice anonymity is graded separately by anonymous_choice_separation.")
s=s.replace('published_approval_tally and published_single_choice_tie','published_approval_tally and published_single_choice_tie')
p.write_text(s,encoding='utf-8',newline='\n')
p=TASK/'tests/functional/prompt.md';s=p.read_text(encoding='utf-8')
s=s.replace('close_transition_and_vote_boundary','ballot_close_transition / closed_vote_refusal')
s=s.replace('retained ballot/roster/audit records, ; receipt','retained ballot/roster/audit records; receipt')
s=s.replace('observed observed','observed').replace('Direct observed fetch','Direct fetch').replace('observed page','app page')
s=s.replace('owns the original operation receipt','does not re-grade receipt persistence')
p.write_text(s,encoding='utf-8',newline='\n')
p=OUT/'criterion-migration.json';m=json.loads(p.read_text(encoding='utf-8'))
m['mapping']['close_boundary_and_hidden_results']=['ballot_close_transition','closed_vote_refusal','unpublished_results_hidden'];m['functional_after']=39
p.write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
p=OUT/'run-local.py';s=p.read_text(encoding='utf-8').replace('functional=38','functional=39').replace('all 55 criteria','all 56 criteria');p.write_text(s,encoding='utf-8',newline='\n')
assert sum(c['weight'] for c in tomllib.loads((TASK/'tests/functional/judge.toml').read_text(encoding='utf-8'))['criterion'])==34
print('Final criterion count: 56; Functional 39 with total weight 34.')
