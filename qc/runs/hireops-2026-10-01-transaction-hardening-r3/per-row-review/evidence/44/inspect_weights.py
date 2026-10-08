from pathlib import Path
from decimal import Decimal
import hashlib
import json
import runpy
import subprocess
import sys
import tomllib

sys.stdout.reconfigure(encoding="utf-8")
root = Path(__file__).resolve().parents[6]
frozen = root / ".qc-cache/hireops-2026-10-01-transaction-hardening-r3"
run = root / "qc/runs/hireops-2026-10-01-transaction-hardening-r3"
out = Path(__file__).resolve().parent
tests = frozen / "task/tests"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
index_path = run / "raw-evidence-index.json"
index = json.loads(index_path.read_text())
checks = []
for entry in index["entries"]:
    path = root / entry["path"]
    actual = sha(path) if path.is_file() else None
    checks.append({"path": entry["path"], "expected": entry["sha256"], "actual": actual, "matches": actual == entry["sha256"]})
enumeration = subprocess.run([sys.executable, "-B", str(frozen / "rules/harbor-webdev-rubric-qc/scripts/list_checks.py"), "--workbook", str(frozen / "rules/WebDev Rubrics QC.xlsx"), "--json"], capture_output=True, text=True, encoding="utf-8")
if enumeration.returncode:
    raise RuntimeError(enumeration.stderr)
(out / "workbook-enumeration.json").write_text(enumeration.stdout, encoding="utf-8")
policy = tomllib.loads((tests / "scoring.toml").read_text())
dimensions = {}
for dimension in ["functional", "polish", "visual"]:
    path = tests / "scored" / dimension / "judge.toml"
    data = tomllib.loads(path.read_text(), parse_float=Decimal)
    criteria = data["criterion"]
    total = sum(c["weight"] for c in criteria)
    dimensions[dimension] = {
        "count": len(criteria), "total_weight": str(total), "aggregation": data["scoring"]["aggregation"],
        "criteria": [{"id": c["id"], "weight": str(c["weight"]), "maximum_total_reward_contribution": str(Decimal(str(policy["weights"][dimension])) * c["weight"] / total)} for c in criteria]
    }
functional = tomllib.loads((tests / "scored/functional/judge.toml").read_text(), parse_float=Decimal)["criterion"]
ordinary = sum(c["weight"] for c in functional if not c["id"].startswith("hro_change_"))
coordinated = sum(c["weight"] for c in functional if c["id"].startswith("hro_change_"))
total = ordinary + coordinated
scenarios = {
    "all_outcomes": {"functional": 1.0, "polish": 1.0, "visual": 1.0},
    "all_function_no_polish_no_visual": {"functional": 1.0, "polish": 0.0, "visual": 0.0},
    "all_behavior_no_visual": {"functional": 1.0, "polish": 1.0, "visual": 0.0},
    "visual_only": {"functional": 0.0, "polish": 0.0, "visual": 1.0},
    "nonfunctional_upper_bound_at_floor": {"functional": 0.05, "polish": 1.0, "visual": 1.0},
    "nonfunctional_upper_bound_above_floor": {"functional": 0.051, "polish": 1.0, "visual": 1.0},
    "ordinary_desk_without_any_coordinated_behavior": {"functional": float(ordinary / total), "polish": 3.0 / 9.0, "visual": 1.0}
}
score = runpy.run_path(str(tests / "tools/score.py"))["main"]
records = []
for name, values in scenarios.items():
    directory = out / "synthetic-score-inputs" / name
    (directory / "gates").mkdir(parents=True, exist_ok=True)
    (directory / "scored").mkdir(exist_ok=True)
    (directory / "gates/reward.json").write_text(json.dumps({"render": 1.0, "constraints": 1.0}), encoding="utf-8")
    (directory / "scored/reward.json").write_text(json.dumps(values), encoding="utf-8")
    exit_code = score(directory)
    records.append({"scenario": name, "synthetic_dimensions": values, "exit_code": exit_code, "actual_scorer_output": json.loads((directory / "reward.json").read_text())})
parser_path = run / "local/configured-inspection/results.json"
parser = json.loads(parser_path.read_text())
parser_bindings = {name: sha(tests / name) == expected for name, expected in parser["tests_sha256"].items()}
result = {
    "scope": "Row 44 source/weight inspection and actual canonical scorer execution on synthetic dimension inputs only. This is NOT an app judge grade, reward discrimination experiment, full judge timing, private deterministic checker execution, Oracle/model run or hosted QC.",
    "input_sha256": index["input_sha256"],
    "raw_index_sha256": sha(index_path), "indexed_artifact_count": len(checks), "index_hash_mismatches": [c for c in checks if not c["matches"]],
    "indexed_artifact_verification": checks,
    "source_hashes": {str(p.relative_to(root)).replace("\\", "/"): sha(p) for p in [tests / "scoring.toml", tests / "tools/score.py", *(tests / "scored" / d / "judge.toml" for d in dimensions), frozen / "rules/WebDev Rubrics QC.xlsx", frozen / "rules/harbor-webdev-rubric-qc/SKILL.md", frozen / "rules/projects/webdev-task-template/tests/scoring.toml"]},
    "template_policy_identical": (tests / "scoring.toml").read_bytes() == (frozen / "rules/projects/webdev-task-template/tests/scoring.toml").read_bytes(),
    "policy": policy, "dimensions": dimensions,
    "ordinary_functional_weight": str(ordinary), "coordinated_functional_weight": str(coordinated),
    "ordinary_max_total_reward_contribution": str(Decimal("0.6") * ordinary / total),
    "coordinated_max_total_reward_contribution": str(Decimal("0.6") * coordinated / total),
    "parser_artifact_sha256": sha(parser_path), "parser_artifact_scope": parser["kind"], "parser_current_source_bindings": parser_bindings,
    "runtime_evidence_file_exists": (run / "runtime-evidence.json").exists(),
    "synthetic_scorer_runs": records
}
(out / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: v for k, v in result.items() if k not in ("indexed_artifact_verification", "dimensions")}, indent=2))
