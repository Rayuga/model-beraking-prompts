#!/usr/bin/env python3
"""Enumerate the WebDev Rubrics QC checks so none is silently skipped.

Modes:
  (default)        print the checks as a readable list
  --json           print them as JSON
  --template NAME  print a findings skeleton covering every check
  --verify FILE    check a findings file for missing, unknown or duplicated ids

Requires openpyxl (the bundled workspace Python provides it).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKBOOK = SKILL_ROOT / "assets" / "WebDev_Rubrics_QC.xlsx"

VERDICTS = ["Pass", "Fail", "Note", "N-A", "Not exercised"]
SEVERITIES = ["P0", "P1", "P2", "P3"]
RUN_VERDICTS = ["CONFIRMED", "REFUTED", "PARTIAL", "NOT EXERCISED"]


def load_workbook(path: Path):
    try:
        from openpyxl import load_workbook
    except ImportError:  # pragma: no cover - environment guard
        raise SystemExit(
            "list_checks.py needs openpyxl; run it with the bundled workspace Python"
        )
    if not path.is_file():
        raise SystemExit(f"rubric workbook not found: {path}")
    return load_workbook(path, data_only=True)


def load_checks(path: Path):
    workbook = load_workbook(path)
    quality: list[dict] = []
    deterministic: list[dict] = []

    if "Quality Checks" in workbook.sheetnames:
        for row in workbook["Quality Checks"].iter_rows(min_row=2, values_only=True):
            if row[0] is None or not row[2]:
                continue
            quality.append(
                {
                    "number": int(row[0]),
                    "block": str(row[1] or "").split(" - ")[0].strip(),
                    "id": str(row[2]).strip(),
                    "what": " ".join(str(row[3] or "").split()),
                }
            )
    if "Deterministic Checks" in workbook.sheetnames:
        for row in workbook["Deterministic Checks"].iter_rows(min_row=2, values_only=True):
            if not row[0]:
                continue
            deterministic.append(
                {
                    "name": str(row[0]).strip(),
                    "source": str(row[1] or "").strip(),
                    "what": " ".join(str(row[2] or "").split()),
                }
            )
    if not quality:
        raise SystemExit("no checks found: is this the WebDev Rubrics QC workbook?")
    return quality, deterministic


def check_duplicates(items: list[dict], key: str, label: str) -> list[str]:
    seen: list[str] = []
    problems: list[str] = []
    for item in items:
        value = item[key]
        if value in seen:
            problems.append(f"duplicate {label} in workbook: {value}")
        seen.append(value)
    return problems


def verify(payload: dict, quality: list[dict], deterministic: list[dict]) -> list[str]:
    problems: list[str] = []
    known_ids = [c["id"] for c in quality]
    known_checkers = {d["name"] for d in deterministic}

    tasks = payload.get("tasks") or []
    if not isinstance(tasks, list) or not tasks:
        return ["findings JSON has no 'tasks' list"]

    for task in tasks:
        name = task.get("name") or "(unnamed task)"
        answered = [c.get("id") for c in task.get("checks") or []]
        missing = [i for i in known_ids if i not in answered]
        unknown = [i for i in answered if i not in known_ids]
        duplicated = sorted({i for i in answered if answered.count(i) > 1})
        if missing:
            problems.append(
                f"{name}: {len(missing)} check(s) unanswered -> {', '.join(missing)}"
            )
        if unknown:
            problems.append(f"{name}: unknown check id(s) -> {', '.join(unknown)}")
        if duplicated:
            problems.append(f"{name}: duplicated check id(s) -> {', '.join(duplicated)}")
        for entry in task.get("checks") or []:
            verdict = entry.get("verdict")
            if verdict not in VERDICTS:
                problems.append(
                    f"{name}/{entry.get('id')}: verdict {verdict!r} is not one of {VERDICTS}"
                )
            severity = entry.get("severity")
            if severity and severity not in SEVERITIES:
                problems.append(
                    f"{name}/{entry.get('id')}: severity {severity!r} is not one of {SEVERITIES}"
                )
            if verdict == "Fail" and not (entry.get("evidence") and entry.get("action")):
                problems.append(
                    f"{name}/{entry.get('id')}: a Fail needs both evidence and a corrective action"
                )
        for finding in task.get("findings") or []:
            run = finding.get("run_verdict")
            if run and run not in RUN_VERDICTS:
                problems.append(
                    f"{name}/{finding.get('id')}: run_verdict {run!r} is not one of {RUN_VERDICTS}"
                )
            if run == "REFUTED" and finding.get("severity") in ("P0", "P1"):
                problems.append(
                    f"{name}/{finding.get('id')}: a REFUTED finding cannot stay P0/P1"
                )

    for entry in payload.get("deterministic") or []:
        checker = entry.get("name")
        if checker and checker not in known_checkers:
            problems.append(f"deterministic: unknown checker name {checker!r}")
        if not entry.get("status"):
            problems.append(f"deterministic/{checker}: missing status")

    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--json", action="store_true", help="emit JSON instead of text")
    parser.add_argument("--template", metavar="TASK_NAME", help="emit a findings skeleton")
    parser.add_argument("--verify", type=Path, help="report coverage problems in a findings file")
    parser.add_argument(
        "--deterministic-only", action="store_true", help="list only the deterministic checkers"
    )
    args = parser.parse_args()

    quality, deterministic = load_checks(args.workbook)
    problems = check_duplicates(quality, "id", "check id") + check_duplicates(
        deterministic, "name", "checker name"
    )

    if args.verify:
        payload = json.loads(args.verify.read_text(encoding="utf-8"))
        problems += verify(payload, quality, deterministic)
        if problems:
            print(f"NOT COVERED — {len(problems)} problem(s):", file=sys.stderr)
            for problem in problems:
                print(f"  - {problem}", file=sys.stderr)
            return 1
        print(
            f"COVERED — {len(payload.get('tasks', []))} task(s) answer all "
            f"{len(quality)} quality checks and {len(deterministic)} deterministic checker names resolve"
        )
        return 0

    if args.template:
        payload = {
            "tasks": [
                {
                    "name": args.template,
                    "checks": [
                        {
                            "id": c["id"],
                            "verdict": "",
                            "severity": "",
                            "evidence": "",
                            "finding": "",
                            "action": "",
                        }
                        for c in quality
                    ],
                    "findings": [
                        {
                            "id": "F1",
                            "check": "",
                            "severity": "P2",
                            "run_verdict": "",
                            "title": "",
                            "evidence": "",
                            "impact": "",
                            "fix": "",
                        }
                    ],
                }
            ],
            "deterministic": [
                {"name": d["name"], "status": "", "output": "", "note": ""}
                for d in deterministic
            ],
        }
        print(json.dumps(payload, indent=2))
        return 0

    if args.json:
        print(
            json.dumps(
                {"quality": quality, "deterministic": deterministic}, indent=2
            )
        )
        return 0

    if not args.deterministic_only:
        print(f"QUALITY CHECKS ({len(quality)})")
        block = None
        for c in sorted(quality, key=lambda x: x["number"]):
            if c["block"] != block:
                block = c["block"]
                print(f"\n  block {block}")
            print(f"  {c['number']:>2}. {c['id']}")
    print(f"\nDETERMINISTIC CHECKS ({len(deterministic)})")
    for d in deterministic:
        print(f"  [{d['source'] or '?'}] {d['name']}")

    for problem in problems:
        print(f"\nWARNING: {problem}", file=sys.stderr)
    return 0 if not problems else 1


if __name__ == "__main__":
    raise SystemExit(main())
