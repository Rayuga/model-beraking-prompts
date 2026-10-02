import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[6]
index_path = root / "qc/runs/coldwater-2026-10-01-history-hardening-r3/raw-evidence-index.json"
manifest_path = root / "qc/runs/coldwater-2026-10-01-history-hardening-r3/manifest.json"
index = json.loads(index_path.read_text(encoding="utf-8"))
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
results = []
for rel, expected in index["artifacts"].items():
    path = root / rel
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    results.append({"path": rel, "expected": expected, "actual": actual, "match": actual == expected})

relevant = [
    "instruction.md",
    "environment/instructions/behaviour.md",
    "environment/instructions/security.md",
    "environment/instructions/overview.md",
    "environment/instructions/ui.md",
    "environment/instructions/policy.md",
    "environment/instructions/integration.md",
    "task.toml",
    "tests/scored/functional/judge.toml",
]
snapshot = root / manifest["cache"] / "task"
snapshot_checks = []
for rel in relevant:
    path = snapshot / rel
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    expected = manifest["inputs"]["task"][rel]
    snapshot_checks.append({"path": rel, "expected": expected, "actual": actual, "match": actual == expected})

rules_relevant = [
    "WebDev Rubrics QC.xlsx",
    "harbor-webdev-rubric-qc/SKILL.md",
    "harbor-webdev-rubric-qc/references/quality-checks.md",
    "harbor-webdev-rubric-qc/references/staged-task-contract.md",
    "projects/webdev-task-template/instruction.md",
    "projects/webdev-task-template/task.toml",
    "projects/webdev-task-template/environment/instructions/notes.md",
    "projects/webdev-task-template/tests/scored/functional/judge.toml",
]
rules = root / manifest["cache"] / "rules"
rules_checks = []
for rel in rules_relevant:
    path = rules / rel
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    expected = manifest["inputs"]["rules"][rel]
    rules_checks.append({"path": rel, "expected": expected, "actual": actual, "match": actual == expected})

policy_checks = []
for rel in ["qc/REVIEW_POLICY.md", "NEW_TASK_AUTHORING_CONTEXT.md", "TASK_AUTHORING_WORKFLOW.md"]:
    path = root / rel
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    expected = manifest["engine_inputs"][rel]
    policy_checks.append({"path": rel, "expected": expected, "actual": actual, "match": actual == expected})

proof_root = root / "qc/repairs/coldwater-2026-10-01-stricter-r3"
functional_coverage = json.loads((proof_root / "functional-coverage.json").read_text(encoding="utf-8"))
local_summary = json.loads((proof_root / "local-proof-summary.json").read_text(encoding="utf-8"))
observation_check = {
    "functional_coverage_count": len(functional_coverage),
    "functional_coverage_all_scripted_passed": all(row.get("passed") is True for row in functional_coverage),
    "summary_functional_criteria": local_summary.get("functional_criteria"),
    "summary_scope": local_summary.get("scope"),
    "summary_limits": local_summary.get("limits"),
}

output = {
    "index_input_matches_manifest": index["input_sha256"] == manifest["input_sha256"],
    "index_artifact_count": len(results),
    "index_mismatches": [r for r in results if not r["match"]],
    "snapshot_checks": snapshot_checks,
    "rules_checks": rules_checks,
    "policy_checks": policy_checks,
    "observation_check": observation_check,
    "note": "Hash checks establish byte identity only; they do not establish configured judge, Oracle, model, or portal results.",
}
out = Path(__file__).with_name("hash-check.json")
out.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"index_artifact_count": len(results), "index_mismatches": len(output["index_mismatches"]), "snapshot_mismatches": sum(not r["match"] for r in snapshot_checks), "rules_mismatches": sum(not r["match"] for r in rules_checks), "policy_mismatches": sum(not r["match"] for r in policy_checks), "index_input_matches_manifest": output["index_input_matches_manifest"]}))
