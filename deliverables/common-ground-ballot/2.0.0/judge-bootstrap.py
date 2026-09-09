"""Exercise RewardKit's own CLI provisioning without a model/API request."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import tomllib

os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'
assert not any(os.environ.get(k) for k in ['OPENROUTER_API_KEY','OPENAI_API_KEY','CODEX_ACCESS_TOKEN'])
from rewardkit.agents import get_agent

out = Path('/results/judge-bootstrap.json')
before = shutil.which('codex')
started = time.monotonic()
report = {'type':'Runner-owned Codex provisioning; no Oracle, judge generation or paid provider call',
          'preinstalled_codex':before,'results':[]}
try:
    assert before is None, 'This test requires the no-Codex base image'
    agent = get_agent('codex')
    agent.ensure_installed()
    version = subprocess.check_output(['codex','--version'],text=True).strip()
    config = tomllib.loads(Path('/root/.codex/config.toml').read_text())
    assert config['model_providers']['openrouter']['env_key']=='OPENROUTER_API_KEY'
    assert config['model_provider']=='openrouter'
    assert agent.model_args('openai/gpt-5.6-luna')==['-m','openai/gpt-5.6-luna']
    assert not Path('/root/.codex/auth.json').exists()
    servers=json.loads(subprocess.check_output(['codex','mcp','list','--json'],text=True))
    assert any(s.get('name')=='playwright' for s in servers)
    report.update(codex_version=version,elapsed_seconds=round(time.monotonic()-started,2))
    report['results'].append({'name':'RewardKit automatically provisions Codex and preserves OpenRouter config/model prefix without OpenAI login','passed':True})
    print(json.dumps(report),flush=True)
except Exception as error:
    report['results'].append({'name':'Runner-owned Codex bootstrap','passed':False,'error':str(error)})
    print(json.dumps(report),flush=True)
    raise
finally:
    out.write_text(json.dumps(report,indent=2)+'\n')
