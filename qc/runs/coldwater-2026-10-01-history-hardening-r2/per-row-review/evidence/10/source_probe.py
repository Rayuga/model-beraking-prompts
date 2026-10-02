"""Row 10 source checks only; no private checker, Docker, or provider run."""
from pathlib import Path
import copy
import hashlib
import json
import re
import tomllib

RUN = Path("qc/runs/coldwater-2026-10-01-history-hardening-r2")
CACHE = Path(".qc-cache/coldwater-2026-10-01-history-hardening-r2")
manifest = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
index_path = RUN / "raw-evidence-index.json"
index = json.loads(index_path.read_text(encoding="utf-8"))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def env_bytes(data):
    return re.search(rb"(?m)^\[verifier.env\]\r?\n(.*?)(?=^\[|\Z)", data, re.S).group(1)

task_path = CACHE / "task/task.toml"
template_path = CACHE / "rules/projects/webdev-task-template/task.toml"
task = tomllib.loads(task_path.read_text(encoding="utf-8"))
template = tomllib.loads(template_path.read_text(encoding="utf-8"))
judges = {
    p.relative_to(CACHE / "task").as_posix(): tomllib.loads(p.read_text(encoding="utf-8"))["judge"]
    for p in sorted((CACHE / "task/tests").glob("*/*/judge.toml"))
}

def config_ok(config, judge_configs):
    return (
        config["verifier"]["environment_mode"] == "separate"
        and config["verifier"]["env"] == template["verifier"]["env"]
        and all(j.get("judge") == "claude-code" and not ({"model", "reasoning_effort", "temperature", "weight"} & set(j)) for j in judge_configs.values())
    )

same_environment = copy.deepcopy(task)
same_environment["verifier"]["environment_mode"] = "same"
overridden_judges = copy.deepcopy(judges)
next(iter(overridden_judges.values()))["model"] = "other-model"
evidence = {
    "input_sha256": manifest["input_sha256"],
    "scope": "Custom source/parser checks only, not configured judge execution or the private deterministic checker suite.",
    "frozen_hashes": {
        part: {"count": len(manifest["inputs"][part]), "mismatches": [rel for rel, expected in manifest["inputs"][part].items() if sha(CACHE / part / rel) != expected]}
        for part in ("task", "rules")
    },
    "policy_hash_matches_manifest": {rel: sha(Path(rel)) == manifest["engine_inputs"][rel] for rel in ("qc/REVIEW_POLICY.md", "qc/README.md")},
    "index": {
        "sha256": sha(index_path),
        "input_matches": index["input_sha256"] == manifest["input_sha256"],
        "artifacts_checked": len(index["artifacts"]),
        "mismatches": [rel for rel, expected in index["artifacts"].items() if sha(Path(rel)) != expected],
        "scope": "Artifact hashes verified; scripted observations are not configured grades and are not used to establish this structural row.",
    },
    "environment_mode": task["verifier"]["environment_mode"],
    "verifier_env_assignment_bytes_equal_template": env_bytes(task_path.read_bytes()) == env_bytes(template_path.read_bytes()),
    "verifier_env_values_equal_template": task["verifier"]["env"] == template["verifier"]["env"],
    "verifier_dockerfile_bytes_equal_template": (CACHE / "task/tests/Dockerfile").read_bytes() == (CACHE / "rules/projects/webdev-task-template/tests/Dockerfile").read_bytes(),
    "base_images": [line for line in (CACHE / "task/tests/Dockerfile").read_text(encoding="utf-8").splitlines() if line.startswith("FROM ")],
    "judge_wiring": {rel: {"judge": j.get("judge"), "forbidden_keys": sorted({"model", "reasoning_effort", "temperature", "weight"} & set(j))} for rel, j in judges.items()},
    "custom_source_controls": {
        "current_config_accepted": config_ok(task, judges),
        "in_memory_shared_environment_rejected": not config_ok(same_environment, judges),
        "in_memory_judge_model_override_rejected": not config_ok(task, overridden_judges),
    },
    "configured_judge_run": False,
    "provider_credential_validity_measured": False,
}
assert all(not entry["mismatches"] for entry in evidence["frozen_hashes"].values())
assert all(evidence["policy_hash_matches_manifest"].values())
assert not evidence["index"]["mismatches"] and evidence["index"]["input_matches"]
assert evidence["verifier_env_assignment_bytes_equal_template"]
assert evidence["verifier_dockerfile_bytes_equal_template"]
assert all(evidence["custom_source_controls"].values())
out = RUN / "per-row-review/evidence/10/source_probe.json"
out.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
print(json.dumps(evidence, indent=2))
