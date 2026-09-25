"""Connect observed browser control outcomes to the installed gated scorer.

Only the new prerequisite comes from browser evidence. All other criteria are
deliberately set to their maximum, so these are upper bounds, not model scores.
"""
import asyncio
import importlib
import json
import os
from pathlib import Path
import re

os.environ['REWARDKIT_JUDGE'] = 'codex'
os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'
from rewardkit.models import Score
from rewardkit.runner import discover, _run_all

module = importlib.import_module('rewardkit.reward')
runner = Path('/tests/test.sh').read_text()
source = re.search(r"cat > /opt/common-ground-verifier/score <<'COMMON_GROUND_HELPER_3'\n([\s\S]*?)\nCOMMON_GROUND_HELPER_3", runner)[1]
scope = {'__name__': 'scorer'}
exec(compile(source, 'generated-private-score', 'exec'), scope)
results = []

async def main():
    for variant in ('golden', 'readonly', 'create_only', 'publish_stub'):
        evidence = Path('/validation') / ('gate-' + variant)
        verdict = json.loads((evidence / 'mcp-recovery-product-gate-verdict.json').read_text())
        test = json.loads((evidence / 'mcp-recovery-product-gate-results.json').read_text())
        assert test['failed'] == 0, (variant, test)
        assert verdict['gatePassed'] == (variant == 'golden'), verdict
        if variant != 'golden':
            expected = {'readonly': 'create', 'create_only': 'open', 'publish_stub': 'fresh-published-record'}[variant]
            assert verdict['blocked']['name'] == expected, verdict
        rewards = discover('/tests')
        async def fake_agent(judge, criteria, weights, **kwargs):
            return [Score(name=criterion.name,
                          value=float(verdict['gatePassed']) if criterion.name == 'working_ballot_journey' else 1.0,
                          weight=weights[index] if weights else 1.0,
                          raw='Observed prerequisite; all other criteria assumed maximum')
                    for index, criterion in enumerate(criteria)], 'Offline upper-bound composition', []
        module.arun_agent = fake_agent
        await _run_all(rewards, max_concurrent_agent=1)
        data = {reward.name: reward.score for reward in rewards}
        maximum = scope['compose'](data, Path('/tests'))
        assert maximum == (1.0 if variant == 'golden' else 0.0), (variant, data, maximum)
        results.append({'variant': variant, 'passed': True,
                        'observed_workflow_passed': verdict['gatePassed'],
                        'blocked_at': verdict['blocked']['name'] if verdict['blocked'] else None,
                        'other_criteria_assumed_maximum': True, 'dimension_scores': data,
                        'maximum_possible_reward': maximum})

asyncio.run(main())
report = {'passed': len(results), 'failed': 0, 'scored_oracle': False,
          'scope': 'Observed targeted browser controls plus actual RewardKit aggregation and final scorer. Other criteria deliberately assumed perfect; no full Oracle or model score inferred.',
          'results': results}
Path('/results/observed-control-score-results.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
