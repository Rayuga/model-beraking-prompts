"""Exercise the frozen scorer on synthetic dimension vectors only."""

import json
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[5]
SCORE = ROOT / ".qc-cache/coldwater-2026-10-01-history-hardening-r2/task/tests/tools/score.py"
OUT = Path(__file__).with_name("score_probe.json")

cases = {
    "polished_minimal": ({"render": 1, "constraints": 1}, {"functional": 0.10, "polish": 1, "visual": 1}),
    "conforming_plain": ({"render": 1, "constraints": 1}, {"functional": 1, "polish": 1, "visual": 0.5}),
    "functional_style_tradeoff": ({"render": 1, "constraints": 1}, {"functional": 0.70, "polish": 0, "visual": 0}),
    "failed_shared_save_gate": ({"render": 1, "constraints": 0}, {"functional": 1, "polish": 1, "visual": 1}),
    "functional_floor_boundary": ({"render": 1, "constraints": 1}, {"functional": 0.05, "polish": 1, "visual": 1}),
}

results = {}
with tempfile.TemporaryDirectory(dir=OUT.parent) as temp:
    for name, (gates, scored) in cases.items():
        case = Path(temp) / name
        for suite, values in (("gates", gates), ("scored", scored)):
            folder = case / suite
            folder.mkdir(parents=True)
            (folder / "reward.json").write_text(json.dumps(values), encoding="utf-8")
        proc = subprocess.run([sys.executable, "-B", str(SCORE), str(case)], capture_output=True, text=True)
        results[name] = {
            "input_gates": gates,
            "input_scored": scored,
            "exit_code": proc.returncode,
            "result": json.loads((case / "reward.json").read_text(encoding="utf-8")),
        }

OUT.write_text(json.dumps({"scope": "Synthetic score.py policy probe; no app or configured judge was run", "cases": results}, indent=2) + "\n", encoding="utf-8")
print(OUT)
