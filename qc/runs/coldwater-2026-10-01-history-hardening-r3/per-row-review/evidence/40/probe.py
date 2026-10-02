"""Read-only row-40 source audit and synthetic scorer probe.

This does not invoke RewardKit or grade an app.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import tomllib
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / "qc/runs/coldwater-2026-10-01-history-hardening-r3"
OUT = RUN / "per-row-review/evidence/40"
FROZEN = ROOT / ".qc-cache/coldwater-2026-10-01-history-hardening-r3"
TASK = FROZEN / "task"
WORKBOOK = FROZEN / "rules/WebDev Rubrics QC.xlsx"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


index_path = RUN / "raw-evidence-index.json"
index = json.loads(index_path.read_text(encoding="utf-8"))
verified = {}
for relative, expected in index["artifacts"].items():
    path = ROOT / relative
    actual = digest(path) if path.is_file() else None
    verified[relative] = {"expected": expected, "actual": actual, "matches": actual == expected}

wb = load_workbook(WORKBOOK, data_only=True)
workbook_rows = {}
for sheet_name in ("Quality Checks", "Internal Quality Checks"):
    sheet = wb[sheet_name]
    for row in sheet:
        if row[2].value == "reward_is_graded_not_binary_and_discriminates":
            workbook_rows[sheet_name] = {
                "cells": {cell.coordinate: cell.value for cell in row if cell.value is not None},
                "comments": {cell.coordinate: cell.comment.text for cell in row if cell.comment},
            }
            break

dimensions = {}
for group, name in (("gates", "render"), ("gates", "constraints"),
                    ("scored", "functional"), ("scored", "polish"), ("scored", "visual")):
    path = TASK / "tests" / group / name / "judge.toml"
    conf = tomllib.loads(path.read_text(encoding="utf-8"))
    criteria = conf["criterion"]
    dimensions[name] = {
        "aggregation": conf["scoring"]["aggregation"],
        "count": len(criteria),
        "total_criterion_weight": sum(c["weight"] for c in criteria),
        "criterion_types": {t: sum(c["type"] == t for c in criteria) for t in {c["type"] for c in criteria}},
    }

functional = tomllib.loads((TASK / "tests/scored/functional/judge.toml").read_text(encoding="utf-8"))["criterion"]
functional_weights = {c["id"]: c["weight"] for c in functional}
total_functional_weight = sum(functional_weights.values())
minimal_ids = (
    "cw_js_html_filename_dispatch", "cw_js_fresh_document", "cw_later_interactions",
    "cw_console_level_stream", "cw_console_value_inspection",
)
richer_ids = minimal_ids + ("cw_literal_loop_deadline",)
cases = {
    "gate_failed_even_with_high_dimensions": {"render": 0.0, "constraints": 1.0, "functional": 1.0, "polish": 1.0, "visual": 1.0},
    "basic_gates_only": {"render": 1.0, "constraints": 1.0, "functional": 0.0, "polish": 0.5, "visual": 0.5},
    "below_functional_floor": {"render": 1.0, "constraints": 1.0, "functional": 0.04, "polish": 0.5, "visual": 0.5},
    "five_functional_criteria": {"render": 1.0, "constraints": 1.0, "functional": sum(functional_weights[x] for x in minimal_ids) / total_functional_weight, "polish": 0.5, "visual": 0.5},
    "six_functional_criteria": {"render": 1.0, "constraints": 1.0, "functional": sum(functional_weights[x] for x in richer_ids) / total_functional_weight, "polish": 0.5, "visual": 0.5},
    "complete_dimensions": {"render": 1.0, "constraints": 1.0, "functional": 1.0, "polish": 1.0, "visual": 1.0},
}

score_path = TASK / "tests/tools/score.py"
spec = importlib.util.spec_from_file_location("frozen_score_row40", score_path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
results = {}
for name, values in cases.items():
    log_dir = OUT / "synthetic-score-inputs" / name
    for suite in ("gates", "scored"):
        (log_dir / suite).mkdir(parents=True, exist_ok=True)
    (log_dir / "gates/reward.json").write_text(json.dumps({k: values[k] for k in ("render", "constraints")}), encoding="utf-8")
    (log_dir / "scored/reward.json").write_text(json.dumps({k: values[k] for k in ("functional", "polish", "visual")}), encoding="utf-8")
    exit_code = module.main(log_dir)
    result = json.loads((log_dir / "reward.json").read_text(encoding="utf-8"))
    results[name] = {"input": values, "score_exit_code": exit_code, "result": result}

report = {
    "scope": "Static frozen-source inspection and synthetic dimension inputs to exact frozen score.py; no app was graded by RewardKit.",
    "input_sha256": index["input_sha256"],
    "raw_evidence_index_sha256": digest(index_path),
    "indexed_artifact_count": len(verified),
    "indexed_artifacts_all_match": all(x["matches"] for x in verified.values()),
    "indexed_artifact_mismatches": [path for path, value in verified.items() if not value["matches"]],
    "runtime_evidence_record_exists": (RUN / "runtime-evidence.json").is_file(),
    "workbook_row": workbook_rows,
    "frozen_dimensions": dimensions,
    "functional_subsets": {
        "five_ids": minimal_ids,
        "five_weight": sum(functional_weights[x] for x in minimal_ids),
        "six_ids": richer_ids,
        "six_weight": sum(functional_weights[x] for x in richer_ids),
    },
    "synthetic_scorer_cases": results,
    "evidence_limit": "The indexed browser facts and synthetic score calculations contain no exact-current configured RewardKit score distribution for partial apps.",
}
(OUT / "probe-results.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "index_artifacts_all_match": report["indexed_artifacts_all_match"],
    "mismatches": report["indexed_artifact_mismatches"],
    "runtime_evidence_record_exists": report["runtime_evidence_record_exists"],
    "dimensions": dimensions,
    "synthetic_rewards": {k: v["result"]["reward"] for k, v in results.items()},
}, indent=2))
