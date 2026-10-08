"""Synthetic score-policy arithmetic only; no application/judge measurement."""
from pathlib import Path
import hashlib
import importlib.util
import json
import tempfile

ROOT = Path(__file__).resolve().parents[6]
TASK = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r1/task'
SCORER = TASK / 'tests/tools/score.py'
spec = importlib.util.spec_from_file_location('frozen_score', SCORER)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
cases = [
    ('render_failure_even_with_maximal_scored_input', 0, 1, 1, 1, 1, 0),
    ('shared_storage_failure_even_with_maximal_scored_input', 1, 0, 1, 1, 1, 0),
    ('zero_function_maximal_craft', 1, 1, 0, 1, 1, 0),
    ('functional_floor_equality_maximal_craft', 1, 1, .05, 1, 1, 0),
    ('above_floor_positive_control', 1, 1, .06, 0, 0, .036),
]
observations = []
for name, render, constraints, functional, polish, visual, expected in cases:
    with tempfile.TemporaryDirectory(prefix='hireops-row39-') as tmp:
        folder = Path(tmp)
        (folder / 'gates').mkdir()
        (folder / 'scored').mkdir()
        gate_input = dict(render=render, constraints=constraints)
        scored_input = dict(functional=functional, polish=polish, visual=visual)
        (folder / 'gates/reward.json').write_text(json.dumps(gate_input))
        (folder / 'scored/reward.json').write_text(json.dumps(scored_input))
        status = module.main(folder)
        result = json.loads((folder / 'reward.json').read_text())
        assert result['reward'] == expected, (name, result, expected)
        observations.append(dict(case=name, synthetic_gate_input=gate_input,
            synthetic_scored_input=scored_input, result=result, return_code=status))
result = dict(input_sha256='6e0b8d2fb655781b3dbd8f4bde8d064dd48f8f7671ecd87f6a2db22b5c0aa8a1',
    scope='Synthetic score.py policy fixtures only. Inputs are invented dimension scores; no configured judge, application, Oracle or model scores measured.',
    source_sha256={p.relative_to(TASK).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in [SCORER, TASK / 'tests/scoring.toml']}, cases=observations)
Path(__file__).with_name('floor-policy-results.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({x['case']: x['result']['reward'] for x in observations}))
