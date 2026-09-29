"""Read-only comparison of the requested ZIP against the current task tree."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import tomllib
import zipfile

root = Path(__file__).resolve().parents[4]
task = root / "projects/colderwater-playground-devtools"
archive = root / "deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/colderwater-playground-devtools.zip"
prefix = "colderwater-playground-devtools"
with zipfile.ZipFile(archive) as zipped:
    names = [n for n in zipped.namelist() if not n.endswith("/")]
    differences = []
    for name in names:
        relative = PurePosixPath(name).relative_to(prefix)
        current = task / relative
        if not current.is_file() or current.read_bytes() != zipped.read(name):
            differences.append(str(relative))
    functional = tomllib.loads(zipped.read(prefix + "/tests/scored/functional/judge.toml").decode())
    report = {
        "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "archive_file_count": len(names),
        "workspace_differences_at_comparison_time": differences,
        "functional_count": len(functional["criterion"]),
        "functional_weight_sum": sum(c["weight"] for c in functional["criterion"]),
        "review_scope": "Static adversarial semantics; no provider/platform evaluation or golden verdict",
    }
    # Freeze only grading/public files as text evidence, never implementation.
    relevant = ["instruction.md", "tests/app_context.md", "tests/scored/functional/judge.toml"]
    relevant += ["environment/instructions/" + name + ".md" for name in ["overview", "behaviour", "integration", "policy", "security", "ui"]]
    relevant += ["tests/" + suffix + "/prompt.md" for suffix in ["gates/render", "gates/constraints", "scored/functional", "scored/polish", "scored/visual"]]
    report["reviewed_text_sha256"] = {name: hashlib.sha256(zipped.read(prefix + "/" + name)).hexdigest() for name in relevant}
destination = Path(__file__).with_name("snapshot_identity.json")
destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
