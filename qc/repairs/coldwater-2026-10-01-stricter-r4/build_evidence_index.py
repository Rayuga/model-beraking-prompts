"""Bind unchanged golden files and targeted R4 scripted observations to QC R4."""
from pathlib import Path
import hashlib
import json

root = Path.cwd()
here = Path(__file__).resolve().parent
r3 = here.parent / "coldwater-2026-10-01-stricter-r3"
run = root / "qc/runs/coldwater-2026-10-01-history-hardening-r4"
task = root / "projects/colderwater-playground-devtools"
manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
install = json.loads((r3 / "full-install-binding.json").read_text(encoding="utf-8"))
baseline = json.loads((r3 / "local-proof-summary.json").read_text(encoding="utf-8"))
before = json.loads((here / "before-delta.json").read_text(encoding="utf-8"))
after = json.loads((here / "after-delta.json").read_text(encoding="utf-8"))
assert install["passed"] and install["all_solution_files_match"]
assert baseline["scripted_passed"] and baseline["functional_criteria"] == 82
assert before["passed"] and after["passed"]
assert len(before["checks"]) == 3 and len(after["checks"]) == 2
for relative, expected in install["expected_solution_hashes"].items():
    actual = hashlib.sha256((task / "solution/app" / relative).read_bytes()).hexdigest()
    assert actual == expected, relative
artifacts = {
    file.relative_to(root).as_posix(): hashlib.sha256(file.read_bytes()).hexdigest()
    for base in (r3, here)
    for file in sorted(base.rglob("*")) if file.is_file()
}
index = {
    "scope": "Exact-current golden app source plus R4 targeted scripted browser evidence; no configured judge, Oracle, Luna or portal result",
    "input_sha256": manifest["input_sha256"],
    "artifacts": artifacts,
    "observations": [
        "All 15 installed golden app files match the R4 solution source, which was not modified by this repair.",
        "R3 full-install scripted proof covered 82 functional criteria, both gates, six polish probes, canvas retention and real restart, on unchanged golden app bytes.",
        "R4 delta exercised the strengthened authored interactive Render gate and DOM-plus-console history inspection in the live golden app.",
        "After an actual restart, a storage-empty independent browser context read the whole saved library and every history; a second clean context read a new post-restart Save.",
    ],
    "limits": [
        "The R3 full scripted proof used the older wording for modified probes; R4 targeted observations cover those changed outcomes. Neither is a configured RewardKit result.",
        "Visual screenshots were inspected earlier, but visual Likert grades and an exact-current Oracle/Luna score remain unmeasured.",
        "Shared restart cleanup, mutable template dependencies, and private-prompt process-argument isolation findings remain unresolved in the template/runner.",
        "An artifact index binds evidence bytes; it does not establish an independent QC verdict.",
    ],
}
(run / "raw-evidence-index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"artifacts": len(artifacts), "input_sha256": index["input_sha256"]}))
