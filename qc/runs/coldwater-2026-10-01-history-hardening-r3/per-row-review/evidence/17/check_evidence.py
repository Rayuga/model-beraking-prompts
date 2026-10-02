import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[6]
index_path = root / "qc/runs/coldwater-2026-10-01-history-hardening-r3/raw-evidence-index.json"
index = json.loads(index_path.read_text(encoding="utf-8"))
hashes = {}
for name, expected in index["artifacts"].items():
    path = root / name
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
    hashes[name] = {"expected": expected, "actual": actual, "matches": actual == expected}

base = root / "qc/repairs/coldwater-2026-10-01-stricter-r3"
binding = json.loads((base / "full-install-binding.json").read_text(encoding="utf-8"))
solution = root / ".qc-cache/coldwater-2026-10-01-history-hardening-r3/task/solution/app"
solution_mismatches = {}
for name, expected in binding["expected_solution_hashes"].items():
    path = solution / name
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
    if actual != expected:
        solution_mismatches[name] = {"expected": expected, "actual": actual}
checks = {}
for name in (
    "runtime-results.json",
    "history-results.json",
    "post-results.json",
    "surface-results.json",
    "golden-regressions.json",
    "canvas-regression.json",
):
    data = json.loads((base / name).read_text(encoding="utf-8"))
    observations = data.get("observations", data.get("checks", data.get("cases", [])))
    checks[name] = {
        "scope": data.get("scope"),
        "status": data.get("status"),
        "passed": data.get("passed", data.get("all_observations_passed")),
        "observation_count": len(observations) if isinstance(observations, list) else len(observations),
        "failed_observations": [
            item.get("id") for item in observations
            if isinstance(item, dict) and item.get("status") not in (None, "observed pass")
        ] if isinstance(observations, list) else [
            key for key, item in observations.items() if not item.get("passed", item.get("pass"))
        ],
    }

out = {
    "input_sha256": index["input_sha256"],
    "indexed_artifacts": len(hashes),
    "matching_artifacts": sum(item["matches"] for item in hashes.values()),
    "mismatches": {name: item for name, item in hashes.items() if not item["matches"]},
    "solution_files_checked": len(binding["expected_solution_hashes"]),
    "solution_mismatches": solution_mismatches,
    "scripted_results": checks,
    "limits": index["limits"],
}
(Path(__file__).parent / "coverage-check.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
print(json.dumps(out, indent=2))
