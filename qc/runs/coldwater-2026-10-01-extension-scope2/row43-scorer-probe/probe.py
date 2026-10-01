"""Synthetic scorer controls only: these do not measure configured judge rewards."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
TASK = ROOT / ".qc-cache/coldwater-2026-10-01-extension-scope2/task"
INPUT = "ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8"

cases = [
    ("failed_render_with_perfect_scored", {"render": 0, "constraints": 1}, {"functional": 1, "polish": 1, "visual": 1}, 1, 0.0),
    ("failed_constraints_with_perfect_scored", {"render": 1, "constraints": 0}, {"functional": 1, "polish": 1, "visual": 1}, 1, 0.0),
    ("only_gates", {"render": 1, "constraints": 1}, None, 0, 0.0),
    ("no_function_perfect_presentation", {"render": 1, "constraints": 1}, {"functional": 0, "polish": 1, "visual": 1}, 0, 0.0),
    ("exact_floor_perfect_presentation", {"render": 1, "constraints": 1}, {"functional": 0.05, "polish": 1, "visual": 1}, 0, 0.0),
    ("above_floor_perfect_presentation", {"render": 1, "constraints": 1}, {"functional": 0.06, "polish": 1, "visual": 1}, 0, 0.436),
    ("working_function_plain_presentation", {"render": 1, "constraints": 1}, {"functional": 1, "polish": 0, "visual": 0}, 0, 0.6),
]
observations = []
for name, gates, scored, expected_exit, expected_reward in cases:
    directory = OUT / name
    (directory / "gates").mkdir(parents=True, exist_ok=False)
    (directory / "gates/reward.json").write_text(json.dumps(gates), encoding="utf-8")
    if scored is not None:
        (directory / "scored").mkdir()
        (directory / "scored/reward.json").write_text(json.dumps(scored), encoding="utf-8")
    command = [sys.executable, "-B", "-X", "utf8", str(TASK / "tests/tools/score.py"), str(directory)]
    run = subprocess.run(command, text=True, capture_output=True)
    result = json.loads((directory / "reward.json").read_text())
    observed = {"case": name, "command": command, "exit_code": run.returncode,
                "stdout": run.stdout, "stderr": run.stderr, "reward": result,
                "passed": run.returncode == expected_exit and result["reward"] == expected_reward}
    observations.append(observed)
    print(name, "exit", run.returncode, "reward", result["reward"], "pass", observed["passed"])

index_path = ROOT / "qc/runs/coldwater-2026-10-01-extension-scope2/raw-evidence-index.json"
index = json.loads(index_path.read_text())
checks = []
for path, digest in index["artifacts"]["current_actual_mcp_gate_probe"].items():
    actual = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
    checks.append({"path": path, "sha256": actual, "matches_index": actual == digest})
binding_path = ROOT / "qc/runs/coldwater-2026-10-01-extension-scope2/row29-mcp-probe/source-binding.json"
binding = json.loads(binding_path.read_text())
binding_checks = {path: hashlib.sha256((TASK / path).read_bytes()).hexdigest() == digest for path, digest in binding.items()}
for path, digest in index["artifacts"]["unchanged_shared_harness_controls"].items():
    if "/original-gate_product_failure/" in path:
        actual = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
        checks.append({"path": path, "sha256": actual, "matches_index": actual == digest})

record = {"input_sha256": INPUT, "scope": "Synthetic supplied-dimension scorer tests and raw evidence hash verification; no configured judge, Oracle or model score.",
          "configured_judge_invoked": False, "provider_invoked": False,
          "scorer_sha256": hashlib.sha256((TASK / "tests/tools/score.py").read_bytes()).hexdigest(),
          "scoring_sha256": hashlib.sha256((TASK / "tests/scoring.toml").read_bytes()).hexdigest(),
          "test_sh_sha256": hashlib.sha256((TASK / "tests/test.sh").read_bytes()).hexdigest(),
          "raw_index_sha256": hashlib.sha256(index_path.read_bytes()).hexdigest(),
          "cases": observations, "artifact_hash_checks": checks,
          "mcp_source_binding_checks": binding_checks,
          "unmeasured": index["not_measured"]}
(OUT / "observations.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
assert all(item["passed"] for item in observations)
assert all(item["matches_index"] for item in checks)
assert all(binding_checks.values())
print("Verified artifacts", len(checks), "source bindings", len(binding_checks))
