"""Read-only syntax and source-binding checks for quality row 51."""

from __future__ import annotations

import hashlib
import ast
import json
import subprocess
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
FROZEN = ROOT / ".qc-cache/coldwater-2026-10-01-history-hardening-r2/task"
EVIDENCE = ROOT / "qc/repairs/coldwater-2026-10-01-stricter-r2/full-install-binding.json"
INDEX = ROOT / "qc/runs/coldwater-2026-10-01-history-hardening-r2/raw-evidence-index.json"


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


result: dict = {"frozen_task": rel(FROZEN), "toml": [], "shell": [], "json": [], "node_syntax": [], "python_syntax": []}

tomls = [FROZEN / "task.toml", FROZEN / "tests/scoring.toml", *sorted((FROZEN / "tests").glob("*/*/judge.toml"))]
for path in tomls:
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        result["toml"].append({"path": rel(path), "sha256": sha256(path), "ok": True, "top_keys": list(data)})
    except Exception as exc:
        result["toml"].append({"path": rel(path), "ok": False, "error": repr(exc)})

for path in sorted(FROZEN.rglob("*.sh")):
    raw = path.read_bytes()
    run = subprocess.run(["bash", "-n", str(path)], text=True, capture_output=True)
    result["shell"].append({"path": rel(path), "sha256": sha256(path), "bash_n_exit": run.returncode,
                            "stderr": run.stderr, "crlf_count": raw.count(b"\r\n"),
                            "bare_cr_count": raw.count(b"\r") - raw.count(b"\r\n"),
                            "lf_count": raw.count(b"\n"), "shebang": raw.split(b"\n", 1)[0].decode("ascii", "replace")})

test_source = (FROZEN / "tests/test.sh").read_text(encoding="utf-8")
generated_restart = test_source.split("cat > \"$LOG_DIR/app-restart.sh\" <<'SH'\n", 1)[1].split("\nSH\n", 1)[0]
restart_check = subprocess.run(["bash", "-n"], input=generated_restart, text=True, capture_output=True)
result["generated_restart_shell"] = {"source": rel(FROZEN / "tests/test.sh"),
                                      "bash_n_exit": restart_check.returncode, "stderr": restart_check.stderr}

for path in sorted((FROZEN / "tests/tools").glob("*.py")):
    try:
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        result["python_syntax"].append({"path": rel(path), "sha256": sha256(path), "ok": True})
    except Exception as exc:
        result["python_syntax"].append({"path": rel(path), "ok": False, "error": repr(exc)})

for path in [FROZEN / "environment/assets/seed_data.json", FROZEN / "solution/app/package.json",
             FROZEN / "solution/app/package-lock.json", FROZEN / "solution/app/tsconfig.json"]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        result["json"].append({"path": rel(path), "sha256": sha256(path), "ok": True,
                               "top_keys": list(data) if isinstance(data, dict) else None})
    except Exception as exc:
        result["json"].append({"path": rel(path), "ok": False, "error": repr(exc)})

app = FROZEN / "solution/app"
for path in [app / "server.js", app / "vite.config.mjs", app / "src/vendor.js", app / "public/assets/index-BND_83dE.js"]:
    # vendor.js is imported by Vite as a browser ES module although package.json
    # marks the Node server package as CommonJS. Parse it in the correct grammar.
    if path.name == "vendor.js":
        command = ["node", "--input-type=module", "--check"]
        run = subprocess.run(command, input=path.read_bytes(), capture_output=True)
    else:
        command = ["node", "--check", str(path)]
        run = subprocess.run(command, text=True, capture_output=True)
    result["node_syntax"].append({"path": rel(path), "sha256": sha256(path),
                                  "command": command, "node_check_exit": run.returncode,
                                  "stderr": run.stderr.decode("utf-8", "replace") if isinstance(run.stderr, bytes) else run.stderr})

index = json.loads(INDEX.read_text(encoding="utf-8"))
installation = json.loads(EVIDENCE.read_text(encoding="utf-8"))
expected_artifact_hash = index["artifacts"][rel(EVIDENCE)]
frozen_hashes = {path.relative_to(app).as_posix(): sha256(path) for path in app.rglob("*") if path.is_file()}
expected_solution_hashes = installation["expected_solution_hashes"]
result["install_binding"] = {
    "artifact": rel(EVIDENCE), "recorded_sha256": expected_artifact_hash,
    "actual_sha256": sha256(EVIDENCE), "artifact_hash_matches": sha256(EVIDENCE) == expected_artifact_hash,
    "reported_install_passed": installation["passed"],
    "reported_health_status": installation["health"]["stdout"].split(" ", 1)[0],
    "reported_entry_cmdline": installation["runtime"]["cmdline"],
    "reported_sqlite_module": installation["runtime"]["sqliteResolved"],
    "frozen_solution_hashes_match_installed": {key: frozen_hashes.get(key) == value == installation["runtime"]["hashes"].get(key)
                                                   for key, value in expected_solution_hashes.items()},
}
result["all_syntax_ok"] = (all(x["ok"] for x in result["toml"] + result["json"] + result["python_syntax"])
                           and all(x["bash_n_exit"] == 0 and x["crlf_count"] == 0 and x["bare_cr_count"] == 0 for x in result["shell"])
                           and result["generated_restart_shell"]["bash_n_exit"] == 0
                           and all(x["node_check_exit"] == 0 for x in result["node_syntax"]))
result["binding_ok"] = (result["install_binding"]["artifact_hash_matches"]
                        and all(result["install_binding"]["frozen_solution_hashes_match_installed"].values()))

out = Path(__file__).with_name("checks.json")
out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"all_syntax_ok": result["all_syntax_ok"], "binding_ok": result["binding_ok"],
                  "toml_count": len(result["toml"]), "shell_count": len(result["shell"]),
                  "json_count": len(result["json"]), "node_syntax_count": len(result["node_syntax"]),
                  "python_syntax_count": len(result["python_syntax"])}))
