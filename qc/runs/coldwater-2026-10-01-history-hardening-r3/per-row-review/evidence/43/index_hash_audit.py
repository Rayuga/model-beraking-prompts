"""Verify all current raw evidence index entries for row 43."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[6]
index = root / "qc/runs/coldwater-2026-10-01-history-hardening-r3/raw-evidence-index.json"
data = json.loads(index.read_text())
bad = []
for relative, expected in data["artifacts"].items():
    path = root / relative
    if not path.is_file():
        bad.append({"path": relative, "actual": "missing", "expected": expected})
    else:
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            bad.append({"path": relative, "actual": actual, "expected": expected})

print(json.dumps({
    "index_sha256": hashlib.sha256(index.read_bytes()).hexdigest(),
    "input_sha256": data["input_sha256"],
    "artifact_count": len(data["artifacts"]),
    "mismatches": bad,
    "scope": data["scope"],
}, indent=2))
