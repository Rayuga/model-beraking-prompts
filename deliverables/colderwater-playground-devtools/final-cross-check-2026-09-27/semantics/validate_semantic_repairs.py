"""Validate exactly the delegated grading-text edits against the reviewed ZIP."""
from pathlib import Path
import difflib
import hashlib
import json
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[3]
task = root / "projects/colderwater-playground-devtools"
archive = root / "deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/colderwater-playground-devtools.zip"
owned = ["tests/scored/functional/judge.toml", "tests/scored/functional/prompt.md", "tests/app_context.md"]
expected = {"initial_examples", "cw_completed_preview_interactions", "fresh_cancel", "cw_title_change_uniqueness", "cw_shared_run_deadline_recovery", "cw_pending_interaction_budget_nonextension"}
with zipfile.ZipFile(archive) as zipped:
    before = {name: zipped.read("colderwater-playground-devtools/" + name).decode("utf-8") for name in owned}
after = {name: (task / name).read_text(encoding="utf-8") for name in owned}
old = tomllib.loads(before[owned[0]])
new = tomllib.loads(after[owned[0]])
assert len(new["criterion"]) == 35
assert sum(c["weight"] for c in new["criterion"]) == 49.5
assert {k: v for k, v in old.items() if k != "criterion"} == {k: v for k, v in new.items() if k != "criterion"}
changed = []
for a, b in zip(old["criterion"], new["criterion"]):
    assert {k: v for k, v in a.items() if k != "description"} == {k: v for k, v in b.items() if k != "description"}
    if a["description"] != b["description"]:
        changed.append(b["id"])
assert set(changed) == expected, changed
for name in owned:
    safe = name.replace("/", "__")
    (out / ("before__" + safe)).write_text(before[name], encoding="utf-8")
    (out / ("after__" + safe)).write_text(after[name], encoding="utf-8")
    diff = "".join(difflib.unified_diff(before[name].splitlines(True), after[name].splitlines(True), fromfile="reviewed-zip/" + name, tofile="repaired-workspace/" + name))
    (out / (safe + ".diff")).write_text(diff, encoding="utf-8")
assert "Do not inspect submitted application implementation" in after[owned[1]]
assert "EVALUATION_INCOMPLETE:" in after[owned[1]]
assert "begin that criterion's own structured reasoning exactly with EVALUATION_INCOMPLETE:" in after[owned[2]]
checks = {
    "baseline_archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "functional_count": len(new["criterion"]),
    "functional_weight_sum": sum(c["weight"] for c in new["criterion"]),
    "criterion_ids_types_names_weights_order_unchanged": True,
    "judge_mcp_scoring_configuration_unchanged": True,
    "changed_criterion_descriptions": changed,
    "owned_files": owned,
    "after_sha256": {name: hashlib.sha256((task / name).read_bytes()).hexdigest() for name in owned},
    "source_ban_and_incomplete_protocol_preserved": True,
    "runtime_validation": "Delegated to cold_launch_review; not claimed by this script",
}
(out / "repair_validation.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
print(json.dumps(checks, indent=2))
