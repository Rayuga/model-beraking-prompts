"""Offline RewardKit discovery and shell/JS syntax checks; never calls a judge."""
from pathlib import Path
import os, json, subprocess
os.environ.update(REWARDKIT_JUDGE='codex', REWARDKIT_MODEL='gpt-5.6-luna', REWARDKIT_REASONING_EFFORT='max')
from rewardkit.runner import discover

rewards=discover('/tests',workspace='/app')
names=[r.name for r in rewards]
assert set(names)=={'render','constraints','functional','polish','visual'}, names
for p in [*Path('/tests').glob('*.sh'),Path('/solution/solve.sh')]:
    subprocess.run(['bash','-n',str(p)],check=True)
for p in Path('/solution/app').rglob('*.js'):
    subprocess.run(['node','--check',str(p)],check=True)
Path('/results/runtime-schema.json').write_text(json.dumps({'scope':'Offline discovery and syntax only; no judge calls','reward_dimensions':names,'syntax':'passed'},indent=2)+'\n')
print('PASS five-dimension RewardKit discovery and shell/JS syntax')
