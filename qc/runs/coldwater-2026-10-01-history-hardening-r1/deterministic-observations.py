"""Independent local observations; not the client's private checker suite."""
import ast
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RUN = Path(__file__).resolve().parent
manifest = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
CACHE = ROOT / manifest["cache"]
TASK = CACHE / "task"
TEMPLATE = CACHE / "rules/projects/webdev-task-template"
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
out = {"input_sha256": manifest["input_sha256"], "scope": "Local deterministic observations only; no Docker image build, full judge, provider, Oracle, target-model or private portal checker run."}
out["hash_verification"] = {}
for group, base in [("task", TASK), ("rules", CACHE / "rules")]:
    expected = manifest["inputs"][group]
    out["hash_verification"][group] = {"files": len(expected), "mismatches": [f for f, h in expected.items() if not (base / f).is_file() or digest(base / f) != h]}
out["hash_verification"]["engine_mismatches"] = [f for f, h in manifest["engine_inputs"].items() if not (ROOT / f).is_file() or digest(ROOT / f) != h]
files = [p for p in TASK.rglob("*") if p.is_file()]
out["task_file_count"] = len(files)
out["node_modules_file_count"] = sum("node_modules" in p.parts for p in files)
out["native_artifacts"] = [p.relative_to(TASK).as_posix() for p in files if p.suffix in (".exe", ".node")]
out["better_sqlite3_native_bindings"] = [p.relative_to(TASK).as_posix() for p in (TASK / "solution/app/node_modules/better-sqlite3").rglob("*.node")]
out["canonical_comparison"] = {}
for name in ["tests/test.sh", "tests/tools/score.py", "tests/tools/restart_mcp.py", "tests/Dockerfile", "environment/Dockerfile", "tests/scoring.toml"]:
    out["canonical_comparison"][name] = {"task_sha256": digest(TASK / name), "template_sha256": digest(TEMPLATE / name), "equal": (TASK / name).read_bytes() == (TEMPLATE / name).read_bytes()}
out["verifier_env_matches_template"] = tomllib.loads((TASK / "task.toml").read_text())["verifier"]["env"] == tomllib.loads((TEMPLATE / "task.toml").read_text())["verifier"]["env"]
out["private_checker_on_path"] = shutil.which("check-required-files.py")
out["tests_files"] = [p.relative_to(TASK).as_posix() for p in (TASK / "tests").rglob("*") if p.is_file()]
textfiles = []
for p in files:
    try:
        textfiles.append((p, p.read_text(encoding="utf-8")))
    except UnicodeError:
        pass
out["source_scans"] = {}
for name, pattern in {
    "host_paths": r"/Users/[A-Za-z0-9_.-]+|/home/(?!agent|node|user|runner)[A-Za-z0-9_.-]+|[A-Z]:\\Users\\|Documents and Settings",
    "draft_markers": r"\bCHANGE[_-]?ME\b|\bTODO\b|\bFIXME\b|\bXXX\b|<placeholder>|lorem ipsum",
    "secrets": r"\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
}.items():
    hits = []
    for p, source in textfiles:
        for line, value in enumerate(source.splitlines(), 1):
            if re.search(pattern, value, re.I):
                hits.append({"path": p.relative_to(TASK).as_posix(), "line": line, "text": "[redacted potential secret]" if name == "secrets" else value[:240]})
    out["source_scans"][name] = {"count": len(hits), "first_party_count": sum("/node_modules/" not in x["path"] for x in hits), "hits": hits}
out["parsers"] = []
for p in TASK.glob("**/*.toml"):
    if "node_modules" in p.parts:
        continue
    data = tomllib.loads(p.read_text(encoding="utf-8"))
    item = {"path": p.relative_to(TASK).as_posix(), "toml_parsed": True}
    if "judge" in data:
        judge = data["judge"]
        criteria = data["criterion"]
        ids = [x["id"] for x in criteria]
        item.update({"criteria": len(criteria), "timeout": judge["timeout"], "ids_unique": len(ids) == len(set(ids)), "types": sorted({x["type"] for x in criteria}), "positive_weights": all(x["weight"] > 0 for x in criteria), "nonempty_descriptions": all(x["description"].strip() for x in criteria), "prompt_has_criteria": "{criteria}" in (p.parent / judge["prompt_template"]).read_text(encoding="utf-8"), "mcp": [x["name"] for x in judge["mcp_servers"]], "forbidden_judge_keys": sorted(set(judge) & {"model", "temperature", "reasoning_effort", "weight"})})
    out["parsers"].append(item)
for name in ["environment/assets/seed_data.json", "solution/app/package.json", "solution/app/package-lock.json", "solution/app/tsconfig.json"]:
    json.loads((TASK / name).read_text(encoding="utf-8"))
    out["parsers"].append({"path": name, "json_parsed": True})
for name in ["tests/tools/score.py", "tests/tools/restart_mcp.py"]:
    ast.parse((TASK / name).read_text(encoding="utf-8"))
    out["parsers"].append({"path": name, "python_ast_parsed": True})
out["commands"] = []
for name in ["tests/test.sh", "solution/solve.sh"]:
    command = [shutil.which("bash"), "-n", str(TASK / name)]
    result = subprocess.run(command, capture_output=True)
    out["commands"].append({"command": command, "exit": result.returncode, "stdout": result.stdout.decode(), "stderr": result.stderr.decode(), "crlf": b"\r\n" in (TASK / name).read_bytes()})
for name in ["solution/app/server.js", "solution/app/vite.config.mjs"]:
    command = ["node", "--check", str(TASK / name)]
    result = subprocess.run(command, capture_output=True)
    out["commands"].append({"command": command, "exit": result.returncode, "stdout": result.stdout.decode(), "stderr": result.stderr.decode()})
result = subprocess.run(["node", "--input-type=module", "--check"], input=(TASK / "solution/app/src/vendor.js").read_bytes(), capture_output=True)
out["commands"].append({"command": "node --input-type=module --check < frozen solution/app/src/vendor.js", "exit": result.returncode, "stderr": result.stderr.decode()})
native_probe = "const {createRequire}=require('node:module');const r=createRequire(process.argv[1]);console.log('node='+process.version+' platform='+process.platform);console.log('resolved='+r.resolve('better-sqlite3'));try{const D=r('better-sqlite3');const db=new D(':memory:');console.log('memory database opened');db.close()}catch(e){console.log(e.message);process.exitCode=1}"
command = ["node", "-e", native_probe, str(TASK / "solution/app/server.js")]
result = subprocess.run(command, capture_output=True)
out["commands"].append({"command": command, "exit": result.returncode, "stdout": result.stdout.decode(), "stderr": result.stderr.decode(), "limit": "Memory-only dependency resolution on the local Windows runtime, not Node 22/Linux or a full verifier run."})
policy_ns = {"__file__": str(TASK / "tests/tools/score.py"), "__name__": "independent_qc_probe"}
exec(compile((TASK / "tests/tools/score.py").read_text(), str(TASK / "tests/tools/score.py"), "exec"), policy_ns)
out["scorer_fixture_observations"] = []
for name, gate, scored in [("gate_failure", {"render": 0, "constraints": 1}, {"functional": 1, "polish": 1, "visual": 1}), ("functional_floor", {"render": 1, "constraints": 1}, {"functional": 0.05, "polish": 1, "visual": 1}), ("half_scores", {"render": 1, "constraints": 1}, {"functional": 0.5, "polish": 0.5, "visual": 0.5}), ("full_scores", {"render": 1, "constraints": 1}, {"functional": 1, "polish": 1, "visual": 1})]:
    directory = RUN / "deterministic-scorer-fixtures" / name
    for suite, data in [("gates", gate), ("scored", scored)]:
        (directory / suite).mkdir(parents=True, exist_ok=True)
        (directory / suite / "reward.json").write_text(json.dumps(data), encoding="utf-8")
    code = policy_ns["main"](directory)
    out["scorer_fixture_observations"].append({"name": name, "exit": code, "result": json.loads((directory / "reward.json").read_text()), "limit": "Synthetic dimension-result input validates arithmetic only, not real app discrimination or judge ranking."})
out["runtime_evidence_present"] = (RUN / "runtime-evidence.json").is_file()
out["raw_evidence_index_present"] = (RUN / "raw-evidence-index.json").is_file()
path = RUN / "deterministic-observations.json"
path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"artifact": str(path.relative_to(ROOT)), "sha256": digest(path), "files": out["task_file_count"], "node_modules_files": out["node_modules_file_count"], "hash_verification": out["hash_verification"]}, indent=2))
