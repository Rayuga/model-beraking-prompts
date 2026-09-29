from pathlib import Path
import json
import tomllib
import hashlib

ROOT = Path(__file__).resolve().parents[3]
TASK = ROOT / "projects/colderwater-playground-devtools"
HERE = Path(__file__).resolve().parent
judge = tomllib.loads((TASK / "tests/scored/functional/judge.toml").read_text(encoding="utf-8"))
metadata = tomllib.loads((TASK / "task.toml").read_text(encoding="utf-8"))
criteria = {c["id"]: c for c in judge["criterion"]}
checks = []
def record(name, condition, detail=None):
    checks.append({"check": name, "passed": bool(condition), "detail": detail})
    assert condition, (name, detail)

record("24 unique functional criteria", len(judge["criterion"]) == len(criteria) == 24)
record("positive weights total 49.5", all(c["weight"] > 0 for c in criteria.values()) and sum(c["weight"] for c in criteria.values()) == 49.5)
record("binary weighted-mean functional dimension", all(c["type"] == "binary" for c in criteria.values()) and judge["scoring"]["aggregation"] == "weighted_mean")
record("frozen functional budget and runner", judge["judge"]["timeout"] == 9000 and judge["judge"]["judge"] == "claude-code")
record("no forbidden judge overrides", not ({"model","reasoning_effort","temperature","weight"} & judge["judge"].keys()))
prompt = (TASK / "tests/scored/functional/prompt.md").read_text(encoding="utf-8")
record("both prompt substitutions once", prompt.count("{app_context}") == prompt.count("{criteria}") == 1)
record("explicit public browser prerequisite", "Global browser gate" in prompt and "There is no sign-in" in prompt)
record("self-contained final restart setup", "It first creates its own durable controls" in prompt and "restart_app exactly once" in criteria["cw_process_restart_durability"]["description"])
record("metadata factual criterion count and weight", "24 binary functional criteria" in metadata["metadata"]["difficulty_explanation"] and "49.5" in metadata["metadata"]["difficulty_explanation"])
record("metadata installed raw scale", "RewardKit 0.1.7 raw 1-5" in metadata["metadata"]["difficulty_explanation"])
record("metadata no unmeasured pass assertion", "Golden oracle should score 1.0" not in metadata["metadata"]["difficulty_explanation"])
record("canonical empty seed", json.loads((TASK / "environment/assets/seed_data.json").read_text(encoding="utf-8"))["snippets"] == [])

description = criteria["error_lines_preview"]["description"]
samples = {}
definitions = [
    ("bad_js", "Enter exactly these four lines as bad.js, with no added leading blank line:\n", "\nRun it.", "items.forEeach", 4, 4),
    ("bad_html", "Enter exactly this nine-line bad.html document:\n", "\nRun it.", "undefinedFunctionCall", 6, 9),
    ("timer_error", "Enter these two lines as delayed-error.js:\n", "\nRun and wait", "throw new Error", 2, 2),
    ("promise_error", "Enter these two lines as rejected-promise.js:\n", "\nRun and wait", "Promise.reject", 2, 2),
]
for name, start, end, marker, expected_line, expected_length in definitions:
    text = description.split(start, 1)[1].split(end, 1)[0]
    rows = text.splitlines()
    found = next(i for i, row in enumerate(rows, 1) if marker in row)
    record(name + " exact authored line", found == expected_line and len(rows) == expected_length, {"actual_line":found,"expected_line":expected_line,"line_count":len(rows)})
    samples[name] = {"source":text,"expected_error_line":expected_line,"line_count":len(rows)}
instruction_files = [TASK / "instruction.md", *(TASK / "environment/instructions").glob("*.md"), TASK / "tests/app_context.md", TASK / "tests/scored/functional/prompt.md"]
record("six focused instruction notes", len(list((TASK / "environment/instructions").glob("*.md"))) == 6)
record("no retired asset path in active brief", all("/assets/artifacts/task_scope.json" not in p.read_text(encoding="utf-8") for p in instruction_files))
record("no forced dark initial theme", "may be light or dark" in criteria["cw_theme_switch_legibility"]["description"])
record("complete bracket-pair fixture", "complete matching pair" in criteria["editor_basics"]["description"])
record("title collision uses current revision", "CURRENT revision" in criteria["cw_title_change_uniqueness"]["description"])
record("stale delete and deleted update both required", "old revision" in criteria["delete_confirm"]["description"] and "previously loaded Target" in criteria["delete_confirm"]["description"] and "recreating/upserting" in criteria["delete_confirm"]["description"])
output = {"kind":"source/rubric validation only; not a runtime or paid judge verdict","passed":all(c["passed"] for c in checks),"checks":checks,"source_line_fixtures":samples,"sha256":{str(p.relative_to(TASK)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [TASK / "task.toml",TASK / "tests/scored/functional/judge.toml",TASK / "tests/scored/functional/prompt.md"]}}
(HERE / "contract_checks.json").write_text(json.dumps(output,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"passed":output["passed"],"checks":len(checks),"criteria":len(criteria),"weight":sum(c["weight"] for c in criteria.values()),"line_fixtures":len(samples)}))
