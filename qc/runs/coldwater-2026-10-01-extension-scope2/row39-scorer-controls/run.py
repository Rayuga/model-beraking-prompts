"""Synthetic scorer controls, not app judging or empirical weak-app rewards."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
TASK = ROOT / '.qc-cache/coldwater-2026-10-01-extension-scope2/task'
INPUT_SHA256 = 'ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8'
CASES = [
    ('render_failed', 0, 1, 1, 1, 1, 0),
    ('shared_storage_failed', 1, 0, 1, 1, 1, 0),
    ('both_gates_failed', 0, 0, 1, 1, 1, 0),
    ('functional_zero_presentation_max', 1, 1, 0, 1, 1, 0),
    ('functional_floor_equal_presentation_max', 1, 1, .05, 1, 1, 0),
    ('functional_just_above_floor_presentation_max', 1, 1, .050001, 1, 1, .43),
    ('all_dimensions_max', 1, 1, 1, 1, 1, 1),
]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

results = []
for name, render, constraints, functional, polish, visual, expected in CASES:
    case = OUT / name
    case.mkdir(exist_ok=False)
    for suite, values in [
        ('gates', dict(render=render, constraints=constraints)),
        ('scored', dict(functional=functional, polish=polish, visual=visual)),
    ]:
        (case / suite).mkdir()
        (case / suite / 'reward.json').write_text(json.dumps(values) + '\n')
    argv = [sys.executable, '-B', '-X', 'utf8', str(TASK / 'tests/tools/score.py'), str(case)]
    proc = subprocess.run(argv, text=True, encoding='utf-8', capture_output=True)
    (case / 'stdout.log').write_text(proc.stdout, encoding='utf-8')
    (case / 'stderr.log').write_text(proc.stderr, encoding='utf-8')
    reward = json.loads((case / 'reward.json').read_text())
    passed = reward['reward'] == expected and proc.returncode == (0 if render and constraints else 1)
    results.append(dict(name=name, argv=argv, returncode=proc.returncode,
                        expected_reward=expected, observed=reward, matched=passed))

index_path = ROOT / 'qc/runs/coldwater-2026-10-01-extension-scope2/raw-evidence-index.json'
index = json.loads(index_path.read_text())
gate_artifacts = index['artifacts']['current_actual_mcp_gate_probe']
artifact_checks = {p: dict(expected=h, actual=digest(ROOT / p), matches=digest(ROOT / p) == h)
                   for p, h in gate_artifacts.items()}
binding_path = ROOT / 'qc/runs/coldwater-2026-10-01-extension-scope2/row29-mcp-probe/source-binding.json'
binding = json.loads(binding_path.read_text())
binding_checks = {p: digest(TASK / p) == h for p, h in binding.items()}
record = dict(input_sha256=INPUT_SHA256, scope=__doc__, provider_invoked=False,
              configured_judge_invoked=False, app_invoked=False,
              source_sha256={p: digest(TASK / p) for p in ['tests/tools/score.py', 'tests/scoring.toml']},
              raw_index_sha256=digest(index_path), gate_artifacts_verified=artifact_checks,
              gate_source_binding_verified=binding_checks, results=results,
              all_matched=all(r['matched'] for r in results))
(OUT / 'RESULTS.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(all_matched=record['all_matched'],
                     gate_artifacts_verified=all(v['matches'] for v in artifact_checks.values()),
                     source_bindings_verified=all(binding_checks.values()),
                     rewards={r['name']: r['observed']['reward'] for r in results}), indent=2))
