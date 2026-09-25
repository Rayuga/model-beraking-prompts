import hashlib
import json
from pathlib import Path
import zipfile

HERE = Path(__file__).resolve().parent
WORKSPACE = HERE.parents[2]
DELIVERY = HERE.parent / "1.0.0-r8-reliability-20260914"
TASK = DELIVERY / "task" / "pellmoor-job-pipeline"
PROJECT = WORKSPACE / "projects" / "pellmoor-job-pipeline"
RUNS = WORKSPACE / "run-outputs" / "pellmoor-job-pipeline"

def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

manifest = read(DELIVERY / "package-verification.json")
archive = DELIVERY / "pellmoor-job-pipeline.zip"
assert digest(archive) == manifest["zip_sha256"]
expected = manifest["source_sha256"]
with zipfile.ZipFile(archive) as zipped:
    assert zipped.testzip() is None
    entries = {p.filename: p for p in zipped.infolist() if not p.is_dir()}
    assert set(entries) == {"pellmoor-job-pipeline/" + name for name in expected}
    for name, sha in expected.items():
        assert digest(TASK / name) == sha, ("frozen source", name)
        assert digest(PROJECT / name) == sha, ("active source", name)
        assert hashlib.sha256(zipped.read("pellmoor-job-pipeline/" + name)).hexdigest() == sha, name

run_hashes = read(DELIVERY / "run-file-hashes.json")
run_files = {p.relative_to(RUNS).as_posix() for p in RUNS.rglob("*") if p.is_file()}
assert run_files == set(run_hashes), "Uploaded run file set changed"
for name, sha in run_hashes.items():
    assert digest(RUNS / name) == sha, name

standard = read(HERE / "standard-qc.json")
upload = read(HERE / "upload-qc.json")
assert standard["passed"] and upload["passed"]
assert upload["sha256"] == manifest["zip_sha256"]
gates = read(HERE / "render-constraints" / "gate-crosscheck.json")
assert gates["passed"] and all(c["passed"] for c in gates["checks"])
assert gates["product_state_unchanged"] and not gates["page_errors"]
for name, sha in gates["source_hashes"].items():
    assert expected[name] == sha, name
visual = read(HERE / "visual" / "results.json")
views = visual["results"]
assert len(views) == 88 and not visual["pageErrors"]
assert all(not v["horizontalOverflow"] for v in views)
assert all(v.get("actionsVisible", True) for v in views)
assert all((HERE / "visual" / "screenshots" / (v["name"] + ".png")).is_file() for v in views)

summary = {
    "date": "2026-09-15",
    "scope": "Local frozen r8 golden crosscheck; no new hosted Oracle score",
    "zip_sha256": manifest["zip_sha256"],
    "task_source_changed_this_crosscheck": False,
    "zip_frozen_source_and_active_source_match": True,
    "task_files_verified": len(expected),
    "uploaded_run_files_unchanged": len(run_hashes),
    "latest_uploaded_oracle": {
        "trial": "pellmoor-job-pipeline__sfvtUWB",
        "revision": "r7",
        "reward": 0.8386,
        "render": 1.0,
        "constraints": 1.0,
        "visual": 0.9583,
        "functional": 0.7449,
        "polish": 1.0
    },
    "fresh_local_checks": {
        "standard_qc": {"passed": True, "checks": len(standard["checks"])},
        "archive_qc": {"passed": True, "checks": len(upload["checks"])},
        "render_constraints": {
            "passed": True,
            "actual_mcp_checkpoints": len(gates["checks"]),
            "criteria_exercised": gates["criteria_exercised"],
            "product_records_unchanged": True
        },
        "visual": {
            "automated_bounds_and_browser_checks_passed": True,
            "screenshots": len(views),
            "batch_views_with_visible_actions": sum("actionsVisible" in v for v in views),
            "page_errors": 0,
            "viewports": ["1280x800", "390x844"],
            "themes": ["light", "dark"],
            "fixtures": ["seed", "expanded"],
            "manual_review": "visual/REVIEW.md",
            "score_assigned": False
        }
    },
    "environment_build": read(HERE / "environment" / "environment-build-status.json"),
    "verifier_build": read(HERE / "verifier-build-status.json"),
    "exact_images_verified": False,
    "fresh_hosted_oracle_run": False,
    "fresh_hosted_oracle_score": None,
    "browser_test_runtime": "Cached pellmoor-tests:2.0.3 with exact frozen r8 golden files copied and built"
}
(HERE / "crosscheck-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"integrity_passed": True, "task_files": len(expected), "run_files": len(run_hashes), "standard_checks": len(standard["checks"]), "archive_checks": len(upload["checks"]), "mcp_checkpoints": len(gates["checks"]), "visual_views": len(views)}))
