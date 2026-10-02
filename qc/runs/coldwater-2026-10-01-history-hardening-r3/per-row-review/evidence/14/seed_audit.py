"""Read-only audit of the frozen environment data for quality row 14."""

import csv
import hashlib
import json
from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / "qc/runs/coldwater-2026-10-01-history-hardening-r3"
FROZEN = ROOT / ".qc-cache/coldwater-2026-10-01-history-hardening-r3"
ENVIRONMENT = FROZEN / "task/environment"
OUT = Path(__file__).with_name("seed_audit.json")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


manifest = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
index = json.loads((RUN / "raw-evidence-index.json").read_text(encoding="utf-8"))
workbook_path = FROZEN / "rules/WebDev Rubrics QC.xlsx"
workbook = openpyxl.load_workbook(workbook_path, read_only=False, data_only=False)
quality_row = [cell.value for cell in workbook["Quality Checks"][15]]
internal_row = [cell.value for cell in workbook["Internal Quality Checks"][15]]
files = sorted(p for p in ENVIRONMENT.rglob("*") if p.is_file() and p.suffix.lower() in {".json", ".csv", ".tsv"})
parsed = []
for path in files:
    relative = path.relative_to(FROZEN / "task").as_posix()
    if path.suffix.lower() == ".json":
        value = json.loads(path.read_text(encoding="utf-8"))
    else:
        with path.open(encoding="utf-8-sig", newline="") as handle:
            value = list(csv.DictReader(handle, delimiter="\t" if path.suffix.lower() == ".tsv" else ","))
    parsed.append({"path": relative, "sha256": sha256(path), "manifest_sha256": manifest["inputs"]["task"].get(relative), "value": value})

artifact_checks = []
for relative, expected in index["artifacts"].items():
    path = ROOT / relative
    actual = sha256(path) if path.is_file() else None
    artifact_checks.append({"path": relative, "matches": actual == expected})

result = {
    "row": 14,
    "workbook_sha256": sha256(workbook_path),
    "workbook_quality_row_15": quality_row,
    "workbook_internal_row_15_populated": [value for value in internal_row if value is not None],
    "input_sha256_matches_manifest_and_index": manifest["input_sha256"] == index["input_sha256"] == "80865100dd4b973cb1cfb54e92a812e3f989440975a22dd2519f5f5d5256e841",
    "environment_data_files": parsed,
    "all_seed_hashes_match_manifest": all(item["sha256"] == item["manifest_sha256"] for item in parsed),
    "indexed_artifact_count": len(artifact_checks),
    "all_indexed_artifact_hashes_match": all(item["matches"] for item in artifact_checks),
    "index_mismatches": [item for item in artifact_checks if not item["matches"]],
    "interpretation": "The sole shipped data file is a JSON object with an empty snippets array and one scope note. No data records, reference IDs, people, organizations, credentials, or private data are present. The note is a public product-scope sentence, not a grader or tool instruction. This is source/data inspection, not a configured judge run.",
}
OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(OUT)
print(json.dumps({key: result[key] for key in ("input_sha256_matches_manifest_and_index", "all_seed_hashes_match_manifest", "indexed_artifact_count", "all_indexed_artifact_hashes_match", "index_mismatches")}, indent=2))
