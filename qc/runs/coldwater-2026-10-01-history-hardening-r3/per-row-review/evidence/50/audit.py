"""Independent row-50 inventory of the frozen task and indexed evidence."""

import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[6]
run = root / "qc/runs/coldwater-2026-10-01-history-hardening-r3"
task = root / ".qc-cache/coldwater-2026-10-01-history-hardening-r3/task"
index = json.loads((run / "raw-evidence-index.json").read_text(encoding="utf-8"))

files = sorted(p.relative_to(task).as_posix() for p in task.rglob("*") if p.is_file())
dirs = sorted(p.relative_to(task).as_posix() for p in task.rglob("*") if p.is_dir())
required = {
    "instruction.md", "task.toml", "environment/Dockerfile",
    "environment/assets/seed_data.json", "solution/solve.sh",
    "solution/app/server.js", "tests/Dockerfile", "tests/test.sh",
    "tests/scoring.toml", "tests/app_context.md", "tests/.dockerignore",
    "tests/tools/score.py", "tests/tools/restart_mcp.py",
}
for suite, dimension in (("gates", "render"), ("gates", "constraints"),
                         ("scored", "functional"), ("scored", "polish"),
                         ("scored", "visual")):
    for name in ("judge.toml", "prompt.md"):
        required.add(f"tests/{suite}/{dimension}/{name}")

allowed_variable = lambda p: (
    p.startswith("environment/instructions/") and p.endswith(".md")
    and "/" not in p[len("environment/instructions/"):]
) or p.startswith("solution/app/")
stray = sorted(set(files) - required - {p for p in files if allowed_variable(p)})
missing = sorted(required - set(files))
test_entries = sorted({p.split("/")[1] for p in files if p.startswith("tests/")})
forbidden_names = {"reward.toml", "NOTES.md", "SOLUTION.md", ".env", "coverage.json"}
forbidden_suffixes = (".zip", ".xlsx", ".db", ".db-wal", ".db-shm", ".pyc", ".bak", ".tmp", "~")
forbidden_dirs = {"node_modules", "__pycache__", ".git", "dist", ".cache"}
residue = sorted(p for p in files if Path(p).name in forbidden_names or p.endswith(forbidden_suffixes)
                 or any(part in forbidden_dirs for part in Path(p).parts))
hashed = {}
for rel, expected in index["artifacts"].items():
    path = root / rel
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    hashed[rel] = {"expected": expected, "actual": actual, "match": expected == actual}

public_index = (task / "solution/app/public/index.html").read_text(encoding="utf-8")
bundle_refs = [p for p in files if p.startswith("solution/app/public/assets/")
               and "/assets/" + Path(p).name in public_index]
runner_duplicate = ((task / "solution/app/public/runner.html").read_bytes() ==
                    (task / "solution/app/static/runner.html").read_bytes())
report = {
    "task_file_count": len(files), "task_directory_count": len(dirs), "files": files,
    "missing_required_files": missing, "unexpected_files": stray,
    "forbidden_or_residue": residue, "test_entries": test_entries,
    "operating_note_count": sum(p.startswith("environment/instructions/") for p in files),
    "public_bundle_refs_present": bundle_refs,
    "runner_build_copy_equals_source": runner_duplicate,
    "raw_index_artifact_count": len(hashed),
    "raw_index_missing_or_hash_mismatch": [p for p, result in hashed.items() if not result["match"]],
    "raw_index_input_sha256": index["input_sha256"],
    "runtime_scope": index["scope"],
}
out = Path(__file__).with_name("inventory.json")
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: v for k, v in report.items() if k != "files"}, indent=2))
