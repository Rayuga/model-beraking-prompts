"""Read-only hash and baseline checks for quality row 20."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / "qc/runs/coldwater-2026-10-01-history-hardening-r3"
FROZEN = ROOT / ".qc-cache/coldwater-2026-10-01-history-hardening-r3/task"
SOURCE = ROOT / "projects/colderwater-playground-devtools"
INDEX = RUN / "raw-evidence-index.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_bytes(rel: str) -> bytes:
    return subprocess.run(
        ["git", "show", f"HEAD:{rel}"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
    ).stdout


index = json.loads(INDEX.read_text(encoding="utf-8"))
binding_rel = "qc/repairs/coldwater-2026-10-01-stricter-r3/attempt2/full-install-binding.json"
binding = json.loads((ROOT / binding_rel).read_text(encoding="utf-8"))
solution_files = sorted(path.relative_to(FROZEN).as_posix() for path in (FROZEN / "solution").rglob("*") if path.is_file())
file_checks = []
for rel in solution_files:
    frozen_hash = sha(FROZEN / rel)
    source_hash = sha(SOURCE / rel)
    committed_hash = hashlib.sha256(git_bytes(f"projects/colderwater-playground-devtools/{rel}")).hexdigest()
    installed_hash = binding["runtime"]["hashes"].get(rel.removeprefix("solution/app/")) if rel.startswith("solution/app/") else None
    expected_hash = binding["expected_solution_hashes"].get(rel.removeprefix("solution/app/")) if rel.startswith("solution/app/") else None
    file_checks.append({
        "path": rel,
        "frozen_sha256": frozen_hash,
        "matches_source": frozen_hash == source_hash,
        "matches_head": frozen_hash == committed_hash,
        "matches_installed_baseline": installed_hash == frozen_hash if installed_hash else None,
        "matches_binding_expected_hash": expected_hash == frozen_hash if expected_hash else None,
    })

artifacts = {}
for rel in [binding_rel, "qc/repairs/coldwater-2026-10-01-stricter-r3/local-proof-summary.json"]:
    actual = sha(ROOT / rel)
    artifacts[rel] = {"sha256": actual, "matches_index": actual == index["artifacts"][rel]}

lock = json.loads((FROZEN / "solution/app/package-lock.json").read_text(encoding="utf-8"))
packages = lock["packages"]
lock_entries = [value for key, value in packages.items() if key and "resolved" in value]
result = {
    "input_sha256": index["input_sha256"],
    "source_commit": subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip(),
    "solution_file_count": len(file_checks),
    "all_frozen_match_source": all(row["matches_source"] for row in file_checks),
    "all_frozen_match_head": all(row["matches_head"] for row in file_checks),
    "all_15_installed_app_files_match": sum(row["matches_installed_baseline"] is True for row in file_checks) == 15,
    "all_15_binding_expected_hashes_match": sum(row["matches_binding_expected_hash"] is True for row in file_checks) == 15,
    "files": file_checks,
    "indexed_artifacts": artifacts,
    "install_binding_passed": binding["passed"],
    "install_binding_all_solution_files_match": binding["all_solution_files_match"],
    "seed": json.loads((FROZEN / "environment/assets/seed_data.json").read_text(encoding="utf-8")),
    "lock_entries_with_resolved": len(lock_entries),
    "lock_entries_with_integrity": sum("integrity" in value for value in lock_entries),
}
out = Path(__file__).with_name("reference-check.json")
out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: value for key, value in result.items() if key not in {"files", "seed"}}, indent=2))
