"""Isolated score.py fixture for quality row 43; no RewardKit invocation."""
from __future__ import annotations

import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[6]
SCORER = ROOT / ".qc-cache/coldwater-2026-10-01-history-hardening-r3/task/tests/tools/score.py"
CASES = [
    ("failed_render_gate", {"render": 0.0, "constraints": 1.0}, None),
    ("passed_gates_only", {"render": 1.0, "constraints": 1.0}, None),
    ("failed_functional_floor", {"render": 1.0, "constraints": 1.0}, {"functional": 0.0, "polish": 1.0, "visual": 1.0}),
    ("threshold_functional_floor", {"render": 1.0, "constraints": 1.0}, {"functional": 0.05, "polish": 1.0, "visual": 1.0}),
    ("passed_weak_functional", {"render": 1.0, "constraints": 1.0}, {"functional": 0.06, "polish": 1.0, "visual": 1.0}),
    ("passed_all", {"render": 1.0, "constraints": 1.0}, {"functional": 1.0, "polish": 1.0, "visual": 1.0}),
]

out = {
    "scope": "Synthetic score.py inputs only; neither RewardKit nor test.sh nor a full configured judge was run.",
    "score_py": str(SCORER.relative_to(ROOT)).replace("\\", "/"),
    "score_py_sha256": hashlib.sha256(SCORER.read_bytes()).hexdigest(),
    "cases": [],
}
with tempfile.TemporaryDirectory() as temp:
    for name, gates, scored in CASES:
        path = pathlib.Path(temp) / name
        (path / "gates").mkdir(parents=True)
        (path / "gates/reward.json").write_text(json.dumps(gates))
        if scored is not None:
            (path / "scored").mkdir()
            (path / "scored/reward.json").write_text(json.dumps(scored))
        run = subprocess.run([sys.executable, "-B", str(SCORER), str(path)], capture_output=True, text=True)
        result = json.loads((path / "reward.json").read_text()) if (path / "reward.json").exists() else None
        out["cases"].append({"name": name, "gate_input": gates, "scored_input": scored, "exit_code": run.returncode, "result": result, "stderr": run.stderr})

print(json.dumps(out, indent=2))
