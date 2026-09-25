import json
from pathlib import Path
from rewardkit.runner import discover

results = {}
for label, path in [('before', '/evidence/source-before-repair/tests'), ('after', '/source/tests')]:
    try:
        rewards = discover(path)
        results[label] = {'passed': True, 'rewards': [r.name for r in rewards]}
    except Exception as error:
        results[label] = {'passed': False, 'error': str(error)}
assert not results['before']['passed'], results
assert results['after']['passed'], results
Path('/evidence/rewardkit-discovery.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
