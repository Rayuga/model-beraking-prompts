import importlib.util
import json
import re
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
OLD=OUT.parent/'2026-09-15-platform-qc-r14'
TASK=ROOT/'projects/common-ground-ballot'

for name in ['validate.py','run-local.py','browser-regression.cjs','auth-gate.cjs','agent-smoke.cjs','session-regression.cjs','mcp-crosscheck.cjs','polish-regression.cjs','staff-regression.cjs','strict-regression.cjs','Dockerfile.local-agent','Dockerfile.local-verifier','polish-negative.py']:
    text=(OLD/name).read_text(encoding='utf-8').replace('20260915-r14','20260915-r15')
    if name=='run-local.py':
        text=text.replace("'/tests/assets/artifacts/common_ground_seed.json'", "'/task/environment/assets/artifacts/common_ground_seed.json'")
        text=text.replace("subprocess.run(['bash', '/golden/solve.sh'], check=True)","subprocess.run(['bash', '/golden/solve.sh'], check=True)\n    shutil.rmtree('/assets')\n    if Path('/instructions').exists(): shutil.rmtree('/instructions')")
        text=text.replace('dict(render=1, constraints=3, functional=22, polish=6, visual=6)','dict(render=1, constraints=2, functional=38, polish=8, visual=6)').replace('all 38 criteria','all 55 criteria')
    if name=='Dockerfile.local-verifier':text=text.replace('COPY . /tests','RUN rm -rf /tests\nCOPY . /tests')
    (OUT/name).write_text(text,encoding='utf-8',newline='\n')

standard=ROOT/'references/task-templates/check-standard.py'
s=standard.read_text(encoding='utf-8')
s=s.replace("    centralized_ballot = cfg['task']['name'] == 'turing/common-ground-ballot' and 'composition' in reward_config", "    centralized_ballot = cfg['task']['name'] == 'turing/common-ground-ballot' and 'composition' in reward_config\n    ballot_r15 = centralized_ballot and (task/'tests/SCORING.md').is_file()")
s=s.replace("ids=={'public_control_responds'}", "ids==({'workspace_navigation'} if ballot_r15 else {'public_control_responds'})")
s=s.replace("ids=={'same_origin_shell','health_endpoint','sqlite_persistence'}", "ids==({'health_endpoint','sqlite_persistence'} if ballot_r15 else {'same_origin_shell','health_endpoint','sqlite_persistence'})")
s=s.replace("ids=={'responsive_workspace_navigation','accessible_keyboard_forms','persistent_action_feedback','theme_switch_preserves_workspace','comfortable_touch_targets','reduced_motion_preference'}", "ids==({'responsive_workspace_navigation','keyboard_control_operation','semantic_labels_and_landmarks','visible_and_managed_focus','persistent_action_feedback','theme_switch_preserves_workspace','comfortable_touch_targets','reduced_motion_preference'} if ballot_r15 else {'responsive_workspace_navigation','accessible_keyboard_forms','persistent_action_feedback','theme_switch_preserves_workspace','comfortable_touch_targets','reduced_motion_preference'})")
s=s.replace("        check(dim+' same-origin prerequisite','same-origin' in prompt.lower())", "        if ballot_r15:\n            check(dim+' public resource origins allowed','Do not restrict the origin' in prompt)\n        else:\n            check(dim+' same-origin prerequisite','same-origin' in prompt.lower())")
s=s.replace("{'reward':[],'composition':{'gates':['render','constraints'],'weighted_dimensions':['functional','polish','visual']}}", "{'reward':[{'name':'reward','aggregation':'weighted_mean'}] if ballot_r15 else [],'composition':{'gates':['render','constraints'],'weighted_dimensions':['functional','polish','visual']}}")
standard.write_text(s,encoding='utf-8',newline='\n')

upload=ROOT/'references/task-templates/check-upload.py';s=upload.read_text(encoding='utf-8')
s=s.replace("        composition=reward_config.get('composition')", "        composition=reward_config.get('composition')\n        ballot_r15=wrapper=='common-ground-ballot' and 'tests/SCORING.md' in files")
s=s.replace("{'reward':[],'composition':{'gates':['render','constraints'],'weighted_dimensions':['functional','polish','visual']}}", "{'reward':[{'name':'reward','aggregation':'weighted_mean'}] if ballot_r15 else [],'composition':{'gates':['render','constraints'],'weighted_dimensions':['functional','polish','visual']}}")
s=s.replace("criterion_ids=={'public_control_responds'}", "criterion_ids==({'workspace_navigation'} if ballot_r15 else {'public_control_responds'})")
s=s.replace("criterion_ids=={'same_origin_shell','health_endpoint','sqlite_persistence'}", "criterion_ids==({'health_endpoint','sqlite_persistence'} if ballot_r15 else {'same_origin_shell','health_endpoint','sqlite_persistence'})")
s=s.replace("criterion_ids=={'responsive_workspace_navigation','accessible_keyboard_forms','persistent_action_feedback','theme_switch_preserves_workspace','comfortable_touch_targets','reduced_motion_preference'}", "criterion_ids==({'responsive_workspace_navigation','keyboard_control_operation','semantic_labels_and_landmarks','visible_and_managed_focus','persistent_action_feedback','theme_switch_preserves_workspace','comfortable_touch_targets','reduced_motion_preference'} if ballot_r15 else {'responsive_workspace_navigation','accessible_keyboard_forms','persistent_action_feedback','theme_switch_preserves_workspace','comfortable_touch_targets','reduced_motion_preference'})")
upload.write_text(s,encoding='utf-8',newline='\n')

p=ROOT/'TASK_TEMPLATE_STANDARD.md';s=p.read_text(encoding='utf-8')
s=s.replace('# Current task template standard\n', '''# Current task template standard

## September 15: Common Ground r15 and the new TXT rubric

For Common Ground, the newly supplied task-implementation.txt supersedes the
earlier r14 empty-aggregate interpretation below. reward.toml must contain a
named [[reward]] with aggregation="weighted_mean" as well as composition roles.
The sole numeric dimension weights remain in judge.toml. RewardKit writes an
intermediate aggregate; score.py replaces it with the gated final composition.
tests/SCORING.md documents these separate roles. Do not reintroduce ignored
numeric maps or duplicate coefficients. Exercise the actual pinned RewardKit
writer and the final scorer, not just a hand-written formula.

The same TXT rubric permits external resources. Remove Common Ground's obsolete
local-resource constraint and keep the global authentication/backend gate free
of origin restrictions. Runtime assets needed from /assets must be baked into
/app during implementation; the verifier must not restore a missing embedded
seed. Split independently requested behaviors into separate verdicts while
preserving the prior total criterion weight and 60/20/20 dimension composition.
Render grades requested workspace navigation; Constraints grades health and
SQLite separately. Historical r14 packages remain immutable.
''',1)
p.write_text(s,encoding='utf-8',newline='\n')

for name in ['check-standard','check-upload']:
 spec=importlib.util.spec_from_file_location(name,ROOT/f'references/task-templates/{name}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 if name=='check-standard':
  result=m.validate(TASK);(OUT/'source-standard.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print('Standard',len(result['checks']))
print('Validation drivers copied; current profile added without replacing historical profiles.')
