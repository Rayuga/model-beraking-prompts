"""Read-only syntax and evidence-hash checks for the frozen row-51 candidate."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tomllib
import ast
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / "qc/runs/coldwater-2026-10-01-history-hardening-r3"
TASK = ROOT / ".qc-cache/coldwater-2026-10-01-history-hardening-r3/task"
OUTPUT = Path(__file__).with_name("checks.json")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def command(args: list[str], input_text: str | None = None) -> dict:
    result = subprocess.run(args, cwd=ROOT, input=input_text, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
    return {
        "command": args,
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


result: dict = {
    "scope": "Frozen row-51 syntax checks, not full configured judge execution",
    "toml": [],
    "shell": [],
    "json": [],
    "javascript": [],
    "python": [],
    "embedded_code": {},
    "raw_index": {},
    "frozen_manifest": {},
    "scripted_install": {},
}

for path in sorted(TASK.rglob("*.toml")):
    item = {"path": relative(path), "sha256": sha256(path)}
    try:
        with path.open("rb") as stream:
            data = tomllib.load(stream)
        item.update({"parses": True, "top_level_keys": list(data)})
    except Exception as error:
        item.update({"parses": False, "error": str(error)})
    result["toml"].append(item)

for path in sorted(TASK.rglob("*.sh")):
    raw = path.read_bytes()
    item = {
        "path": relative(path),
        "sha256": sha256(path),
        "has_crlf": b"\r\n" in raw,
        "has_bare_cr": b"\r" in raw.replace(b"\r\n", b""),
        "starts_with_bash_shebang": raw.startswith(b"#!/bin/bash\n") or raw.startswith(b"#!/usr/bin/env bash\n"),
    }
    item.update(command(["bash", "-n", relative(path)]))
    result["shell"].append(item)

test_source = (TASK / "tests/test.sh").read_text(encoding="utf-8")
solve_source = (TASK / "solution/solve.sh").read_text(encoding="utf-8")
restart_match = re.search(r"cat > \"\$LOG_DIR/app-restart\.sh\" <<'SH'\n(.*?)\nSH", test_source, re.DOTALL)
generated_shell = command(["bash", "-n"], restart_match.group(1)) if restart_match else {"error": "restart heredoc not found"}
embedded_python = []
for number, source in enumerate(re.findall(r"<<'PY'[^\n]*\n(.*?)\nPY", test_source, re.DOTALL), start=1):
    try:
        ast.parse(source, filename=f"test.sh Python heredoc {number}")
        embedded_python.append({"number": number, "parses": True})
    except Exception as error:
        embedded_python.append({"number": number, "parses": False, "error": str(error)})
node_match = re.search(r"node <<'NODE'\n(.*?)\nNODE", solve_source, re.DOTALL)
embedded_node = command(["node", "--check"], node_match.group(1)) if node_match else {"error": "Node heredoc not found"}
result["embedded_code"] = {
    "generated_restart_shell": generated_shell,
    "test_shell_python_heredocs": embedded_python,
    "solve_shell_node_heredoc": embedded_node,
}

for path in sorted(TASK.rglob("*.json")):
    item = {"path": relative(path), "sha256": sha256(path)}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        item.update({"parses": True, "top_level_type": type(data).__name__})
    except Exception as error:
        item.update({"parses": False, "error": str(error)})
    result["json"].append(item)

for path in sorted(TASK.rglob("*.py")):
    item = {"path": relative(path), "sha256": sha256(path)}
    try:
        ast.parse(path.read_text(encoding="utf-8"), filename=relative(path))
        item["parses"] = True
    except Exception as error:
        item.update({"parses": False, "error": str(error)})
    result["python"].append(item)

for path in sorted(TASK.rglob("*.js")) + sorted(TASK.rglob("*.mjs")):
    item = {"path": relative(path), "sha256": sha256(path)}
    item.update(command(["node", "--check", relative(path)]))
    if item["exit_code"] and path.name == "vendor.js":
        item["vite_esm_check"] = command(
            ["node", "--check", "--input-type=module"],
            path.read_text(encoding="utf-8"),
        )
    result["javascript"].append(item)

index_path = RUN / "raw-evidence-index.json"
index = json.loads(index_path.read_text(encoding="utf-8"))
hashes = []
for path_string, expected in index["artifacts"].items():
    path = ROOT / path_string
    actual = sha256(path) if path.is_file() else None
    hashes.append({"path": path_string, "expected": expected, "actual": actual, "matches": expected == actual})
result["raw_index"] = {
    "path": relative(index_path),
    "sha256": sha256(index_path),
    "input_sha256": index["input_sha256"],
    "artifact_count": len(hashes),
    "all_match": all(item["matches"] for item in hashes),
    "mismatches": [item for item in hashes if not item["matches"]],
}

manifest_path = RUN / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
frozen_mismatches = []
for area in ("task", "rules"):
    for name, expected in manifest["inputs"][area].items():
        path = (TASK if area == "task" else TASK.parent / "rules") / name
        actual = sha256(path) if path.is_file() else None
        if actual != expected:
            frozen_mismatches.append({"area": area, "path": name, "expected": expected, "actual": actual})
result["frozen_manifest"] = {
    "path": relative(manifest_path),
    "input_sha256": manifest["input_sha256"],
    "task_file_count": len(manifest["inputs"]["task"]),
    "rule_file_count": len(manifest["inputs"]["rules"]),
    "all_match": not frozen_mismatches,
    "mismatches": frozen_mismatches,
}

binding_path = ROOT / "qc/repairs/coldwater-2026-10-01-stricter-r3/attempt2/full-install-binding.json"
binding = json.loads(binding_path.read_text(encoding="utf-8"))
solution_mismatches = []
for name, expected in binding["expected_solution_hashes"].items():
    path = TASK / "solution/app" / name
    actual = sha256(path) if path.is_file() else None
    if actual != expected:
        solution_mismatches.append({"path": name, "expected": expected, "actual": actual})
result["scripted_install"] = {
    "path": relative(binding_path),
    "sha256": sha256(binding_path),
    "all_solution_files_match": binding["all_solution_files_match"] and not solution_mismatches,
    "solution_mismatches": solution_mismatches,
    "inspection_exit_code": binding["inspection"]["exit_code"],
    "health_exit_code": binding["health"]["exit_code"],
    "health_stdout": binding["health"]["stdout"],
    "server_logs": binding["logs"]["stdout"],
    "reported_passed": binding["passed"],
}

OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(OUTPUT)
print(json.dumps({
    "toml": [(item["path"], item["parses"]) for item in result["toml"]],
    "shell": [(item["path"], item["exit_code"], item["has_crlf"], item["has_bare_cr"]) for item in result["shell"]],
    "json_failures": [item for item in result["json"] if not item["parses"]],
    "python_failures": [item for item in result["python"] if not item["parses"]],
    "embedded_code": result["embedded_code"],
    "javascript_failures": [item for item in result["javascript"] if item["exit_code"] and item.get("vite_esm_check", {}).get("exit_code") != 0],
    "javascript_esm_adjustments": [(item["path"], item["vite_esm_check"]["exit_code"]) for item in result["javascript"] if "vite_esm_check" in item],
    "raw_index": result["raw_index"],
    "frozen_manifest": result["frozen_manifest"],
    "scripted_install": result["scripted_install"],
}, indent=2))
