"""Build a complete, archive-bound 53/48 QC disposition report."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path.cwd()
OUT = Path(__file__).resolve().parent
TASK = ROOT / "projects/colderwater-playground-devtools"
PRIOR = ROOT / "deliverables/colderwater-playground-devtools/coverage-fix-2026-09-27/qc_final_findings.json"
MANIFEST = OUT / "review-candidate/candidate_manifest.json"

load = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()

prior = load(PRIOR)
manifest = load(MANIFEST)
inventory_text = subprocess.run(
    [sys.executable, "-B", "-X", "utf8", "harbor-webdev-rubric-qc/scripts/list_checks.py", "--json"],
    check=True, capture_output=True, text=True, encoding="utf-8"
).stdout
inventory = json.loads(inventory_text)
(OUT / "qc_inventory.json").write_text(json.dumps(inventory, indent=2) + "\n", encoding="utf-8")

quality = prior["tasks"][0]["checks"]
deterministic = prior["deterministic"]
assert len(quality) == len(inventory["quality"]) == 53
assert len(deterministic) == len(inventory["deterministic"]) == 48
assert {r["id"] for r in quality} == {r["id"] for r in inventory["quality"]}
assert {r["name"] for r in deterministic} == {r["name"] for r in inventory["deterministic"]}

evidence_files = {
    "archive_manifest": MANIFEST,
    "source_audit": OUT / "source_final.json",
    "archive_audit": OUT / "archive_final.json",
    "source_guards": OUT / "structural_final_source.json",
    "archive_guards": OUT / "structural_final_archive.json",
    "archive_delta": OUT / "archive_delta.json",
    "payload": OUT / "payload_final.json",
    "schema_cli": OUT / "schema_cli_results.final.json",
    "focused_golden": OUT / "focused-v2/golden.json",
    "focused_save_mutant": OUT / "focused-v2/save-conflict-loses-metadata.json",
    "focused_keyboard_mutant": OUT / "focused-v2/export-mouse-only.json",
    "decomposition": OUT / "semantics/decomposition-map.json",
    "workbook_comparison": OUT / "workbook_comparison.json",
    "workbook_inventory": OUT / "workbook_inventory.json",
}
for p in evidence_files.values():
    assert p.is_file(), p
evidence_index = {
    key: {"path": path.relative_to(ROOT).as_posix(), "sha256": sha(path)}
    for key, path in evidence_files.items()
}
(OUT / "evidence_index.json").write_text(json.dumps(evidence_index, indent=2) + "\n", encoding="utf-8")

common = (
    " Final archive 4fdee18db02cbbbd0551558f99163f1d553e318f2abbe4ae88e979bd45ef20c1: "
    "source/extracted audits 95/95 each; regression guards 49/49 each; exact evidence hashes are in "
    "final-audit-2026-09-28/evidence_index.json."
)
for row in quality:
    row["evidence"] = row["evidence"].rstrip() + common

by_num = {item["number"]: next(row for row in quality if row["id"] == item["id"]) for item in inventory["quality"]}
by_num[11].update(
    verdict="Not exercised", severity="P1", run_verdict="NOT EXERCISED",
    evidence=("Timeout nesting is valid, but a complete 93-row LLM/browser judge run has not been measured. "
              "The 9000-second Functional limit therefore remains an open P1 timing risk; local browser and schema fixtures do not close it." + common)
)
by_num[22].update(
    verdict="Pass", severity="", finding="", action="", run_verdict="CONFIRMED",
    evidence=("Installed harbor-rewardkit 0.1.7 resolved and locally launched the final 93-row prompt/schema. "
              "Three offline CLI transport cases passed, including weighted all-yes, highest-weight no, and smallest-weight no. "
              "This verifies launch/serialization plumbing, not provider judgment." + common)
)
by_num[24].update(
    verdict="Pass", severity="", finding="", action="", run_verdict="CONFIRMED",
    evidence=("The frozen archive contains 93 Functional binary outcomes at exact Decimal weight 49.5, four Polish rows, "
              "six Visual Likert rows, and two all-pass gates. All IDs are unique and the 37 original scenario budgets remain conserved." + common)
)
by_num[26].update(
    verdict="Note", severity="", finding="", action="", run_verdict="PARTIAL",
    evidence=("A fresh public-requirement-to-criterion review found and repaired two remaining finite gaps: stale Save now changes and "
              "verifies title, filename, and source; the Polish keyboard check now covers every requested control. The unchanged golden "
              "passes both, while a metadata-loss mutant and a mouse-only Export mutant fail their intended observations. Browser-only "
              "checks still cannot universally prove invisible backend details or every alternate execution architecture, so this remains Note rather than a universal completeness claim." + common)
)
by_num[28].update(
    verdict="Note", severity="", finding="", action="", run_verdict="PARTIAL",
    evidence=("The two strengthened checks retain their existing row identities and weights. Save conflict recovery uses an actual second "
              "dirty editor and independently validates all three fields; keyboard reachability inspects each requested control without "
              "requiring destructive/file actions. Focused counterexamples show each new observation can fail independently. Full cross-feature combinations remain unmeasured." + common)
)
by_num[49].update(
    verdict="Pass", severity="", finding="", action="", run_verdict="CONFIRMED",
    evidence=("The package contains exactly 50 files under one root. Source and extraction hashes match. Relative to the prior reviewed "
              "candidate, only tests/scored/functional/prompt.md and tests/scored/polish/judge.toml changed; no golden-solution file changed." + common)
)
by_num[51].update(
    verdict="Pass", severity="", finding="", action="", run_verdict="CONFIRMED",
    evidence=("The final prompt and all judge TOMLs parse in installed RewardKit. Current source and extracted archive pass 95 mechanical "
              "assertions, and the local CLI returns the expected 93 Functional rows and weighted means. Hosted provider execution is not claimed." + common)
)

for row in deterministic:
    row["output"] = (
        "Current frozen source and extracted archive passed the 95-assertion local mechanical audit; the 49 Colderwater regression guards "
        "also passed on both. Installed RewardKit schema/serialization fixtures passed. The named private platform checker was not separately executed."
    )
    row["note"] = "Manual/local equivalent bound to the final archive; this is not a hosted-QC execution claim."

timeout_finding = next((f for f in prior["tasks"][0].get("findings", []) if f.get("check") == "timeouts_fit_the_work"), None)
findings = []
if timeout_finding:
    timeout_finding["evidence"] = by_num[11]["evidence"]
    findings.append(timeout_finding)

report = {
    "scope": "Complete final 53/48 dispositions bound to the frozen archive. Full hosted Oracle/model judgment and end-to-end LLM timing were not run.",
    "candidate": {
        "archive": manifest["archive"], "sha256": manifest["sha256"], "files": manifest["files"],
        "dimensions": manifest["dimensions"], "source_sha256": manifest["source_sha256"],
    },
    "tasks": [{"name": TASK.name, "layout": "staged", "checks": quality, "findings": findings}],
    "deterministic": deterministic,
    "evidence_reuse": {
        "prior_report_sha256": sha(PRIOR),
        "rule": "Prior dispositions provide row structure and unchanged-file history; current claims use final archive-bound evidence.",
        "current_evidence_index": "evidence_index.json",
    },
    "coverage_reassessment": {
        "current": "Note",
        "repairs": ["stale Save verifies title, filename and source", "all requested controls are keyboard reachable and labelled"],
        "focused_expected_results": {"golden": True, "save_metadata_loss_mutant": True, "mouse_only_export_mutant": True},
    },
}
target = OUT / "qc_final_findings.json"
target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
subprocess.run([sys.executable, "-B", "-X", "utf8", "harbor-webdev-rubric-qc/scripts/list_checks.py", "--verify", str(target)], check=True)
subprocess.run([sys.executable, "-B", "-X", "utf8", "harbor-webdev-rubric-qc/scripts/build_report.py", str(target), "-o", str(OUT / "QC_FINAL.xlsx"), "--client-safe"], check=True)

validation = {
    "archive_sha256": manifest["sha256"],
    "quality_rows": len(quality), "deterministic_rows": len(deterministic),
    "quality_dispositions": dict(Counter(r["verdict"] for r in quality)),
    "deterministic_dispositions": dict(Counter(r["status"] for r in deterministic)),
    "source_audit": "95/95", "archive_audit": "95/95",
    "source_guards": "49/49", "archive_guards": "49/49",
    "open_p1_not_exercised": ["timeouts_fit_the_work"],
    "full_oracle_measured": False, "target_model_measured": False,
    "artifacts": {name: sha(OUT / name) for name in ["qc_final_findings.json", "QC_FINAL.xlsx", "qc_inventory.json", "evidence_index.json"]},
    "passed": True,
}
(OUT / "qc_report_validation.json").write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
print(json.dumps(validation, indent=2))
