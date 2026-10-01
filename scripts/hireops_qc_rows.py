"""Prepare dedicated review prompts and collate actual agent reports; never invent verdicts."""
import argparse
import collections
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def prepare(run):
    manifest = read(run / "manifest.json")
    checklist = read(run / "checklist.json")
    snapshot = ROOT / ".qc-cache" / run.name
    target = run / "per-row-review"
    (target / "rows").mkdir(parents=True, exist_ok=True)
    (target / "prompts").mkdir(exist_ok=True)
    for row in checklist["quality"]:
        n = row["number"]
        destination = (target / "rows" / f"{n:02}.json").relative_to(ROOT).as_posix()
        prompt = f"""# Dedicated HireOps QC check {n:02}: {row['id']}

Review ONLY this quality row deeply. The user requests one independent agent per row, running up to three workers concurrently. Do not read peer reports or historical QC verdicts. Do not modify task files, rules, other reports or application databases. No provider calls or uploads.

Frozen task: {snapshot.relative_to(ROOT).as_posix()}/task
Logical slug: hireops-recruiting-operations (the snapshot folder named task is not a naming defect).
Input SHA256: {manifest['input_sha256']}
Workbook requirement: {row['what']}

Use BOTH the actual frozen rules/WebDev Rubrics QC.xlsx (read your Quality Checks row and its Internal annotation using python -X utf8/openpyxl) and rules/harbor-webdev-rubric-qc/SKILL.md, relevant references, and qc/REVIEW_POLICY.md. Canonical template and staged profile override legacy internal annotations. Read enough other workbook rows to establish ownership boundaries. Read all relevant task files; do not infer a verdict from inventory or a generated report.

Challenge a plausible incorrect app that might falsely pass and a valid alternative that might falsely fail. Cite concrete paths/lines and actual observations. Requirements such as Node/SQLite inherited from canonical policy are not browser-provable; record that policy limit precisely rather than invent source-inspection permission. Separate task-local issues from canonical harness issues. Do not relax complexity or financial semantics. Useful partial implementations retain independent earned credit.

Raw local evidence is in qc/runs/hireops-2026-10-01-repairs and the raw-evidence-index.json in this run when present. Read raw scripts/results, NOT other reviewers' summaries. Verify relevant source hashes before reusing evidence. Local HTTP/UI/MCP/fixture checks are not full configured Oracle/Luna/judge timing or empirical reward scores. Missing required full-run evidence is Not exercised with risk=true; do not manufacture a Pass. Read-only checks may run with python -X utf8 or .tools/hireops/node.exe; do not run a shared mutable database.

Write exactly one report to {destination}:
number={n}, id={json.dumps(row['id'])}, input_sha256={json.dumps(manifest['input_sha256'])}, reviewer=your unique agent name,
verdict=Pass|Fail|Note|N-A|Not exercised, risk=boolean,
severity=P0|P1|P2|P3|null, evidence=concrete detailed string,
counterexample=the actual challenge and result, suggested_fix=string|null,
run_verdict=CONFIRMED|REFUTED|PARTIAL|NOT EXERCISED,
sources_read=list of actual files/sections read.

Do not mark unseen material as read. Any Fail needs its witness and a scoped fix. A row has one verdict; related issues may be mentioned but don't write peer rows. Finish with a concise verdict and report path.
"""
        (target / "prompts" / f"{n:02}.md").write_text(prompt, encoding="utf-8")
    save(target / "assignment.json", {"input_sha256": manifest["input_sha256"], "rows": checklist["quality"], "policy": "one independent context per quality row; no automated verdicts"})
    print(target.relative_to(ROOT))


def collect(run):
    assignment = read(run / "per-row-review/assignment.json")
    reports = []
    missing = []
    for item in assignment["rows"]:
        path = run / "per-row-review/rows" / f"{item['number']:02}.json"
        if not path.exists():
            missing.append(item["number"])
            continue
        row = read(path)
        assert row["number"] == item["number"] and row["id"] == item["id"]
        assert row["input_sha256"] == assignment["input_sha256"]
        assert row["verdict"] in {"Pass", "Fail", "Note", "N-A", "Not exercised"}
        assert row.get("evidence") and row.get("counterexample") and row.get("sources_read")
        if row["verdict"] == "Fail":
            assert row.get("suggested_fix")
        reports.append(row)
    summary = {"input_sha256": assignment["input_sha256"], "completed": len(reports), "missing": missing,
               "counts": dict(collections.Counter(r["verdict"] for r in reports)),
               "risk_rows": [r["number"] for r in reports if r["risk"]],
               "reports_sha256": {f"{r['number']:02}.json": hashlib.sha256((run / 'per-row-review/rows' / f"{r['number']:02}.json").read_bytes()).hexdigest() for r in reports}}
    save(run / "per-row-review/collection.json", summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["prepare", "collect"])
    parser.add_argument("run")
    args = parser.parse_args()
    run = (ROOT / args.run).resolve()
    if ROOT not in run.parents:
        raise SystemExit("Run must be in workspace")
    (prepare if args.action == "prepare" else collect)(run)
