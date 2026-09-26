#!/usr/bin/env python3
"""Apply the breaker's criteria and prompt discipline to a task, per profile.

Preserves briefs, criteria text and harness contracts. What it rewrites depends
on the task's profile:

  dimensions (CodeArena / retired dimensions layout)
    - functional criterion weights (surface/discovery 0.5, everything else 3.0)
    - the functional judge timeout floor (>=1800s) and reasoning effort (high)
    - the functional judge prompt (evidence discipline when missing)

  staged (tests/scoring.toml + tests/gates + tests/scored)
    - the functional judge prompt only, by default
    - the judge timeout, raised only when it still nests inside the scored budget
    - never a model, temperature, reasoning-effort or [judge].weight key: the
      staged rubric treats those as defects
    - with --rebalance, weights move onto the criteria carrying a probe while
      the dimension total is preserved, so task.toml's quoted total stays true

Usage: harden_criteria.py <task-folder> [--rebalance] [--dry-run]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from audit_task_source import (
    ADVERSARIAL_TOKENS,
    audit,
    detect_profile,
)

SURFACE_TOKENS = (
    "identity is visible",
    "identifies the signed-in",
    "summary derived",
    "useful summary",
    "populated service",
    "queue visibly",
    "wrong password",
    "sign-in",
    "workspace shows",
    "identity and role",
    "confirm the signed-in",
    "service detail",
    "detail visibly",
)
PROMPT_BLOCK = """
## Evidence discipline — read before grading anything

- A criterion passes only on evidence you gathered yourself for that
  criterion; never carry a verdict across criteria or claim a process restart
  the verifier did not perform.
- A criterion is a conjunction: every numbered leg must hold, no partial
  credit and no benefit of the doubt.
- Record the exact request shape the page sends (method, path, body, and the
  session credential it used). Replays use an in-page call from the app's own
  origin; never use curl or shell commands.
- A forged write is refused only when the response performs no write, exposes
  no protected data, the affected record re-reads unchanged, and no new
  activity or audit entry appeared. A hidden, missing or disabled control is
  not enforcement.
- Establish the owner's data or the valid action first (positive control),
  then verify the negative claim. Grade isolation and protected fields on the
  response body, not merely on what the UI hides.
- Do not guess URL paths or API routes except the app root and a health route;
  replaying recorded requests is always allowed.

"""


def classify_dimensions(description: str) -> float:
    lowered = description.lower()
    if any(token in lowered for token in SURFACE_TOKENS):
        return 0.5
    return 3.0


def split_criteria(text: str) -> list[str]:
    return re.split(r"(?m)^\[\[criterion\]\]\s*$", text)


def criterion_id(block: str) -> str | None:
    match = re.search(r'id = "([^"]+)"', block)
    return match.group(1) if match else None


def criterion_description(block: str) -> str:
    match = re.search(r'description = (?:"""([\s\S]*?)"""|"([^"]*)")', block)
    if not match:
        return ""
    return match.group(1) or match.group(2) or ""


def current_weight(block: str) -> float:
    match = re.search(r"(?m)^weight = ([\d.]+)", block)
    return float(match.group(1)) if match else 0.0


def set_weight(block: str, weight: float) -> str:
    return re.sub(r"(?m)^weight = [\d.]+", f"weight = {weight:g}", block, count=1)


def rewrite_weights_dimensions(text: str) -> tuple[str, list[tuple[str, float, float]]]:
    parts = split_criteria(text)
    changes: list[tuple[str, float, float]] = []
    for index, block in enumerate(parts[1:], start=1):
        name = criterion_id(block)
        if not name:
            continue
        weight = classify_dimensions(criterion_description(block))
        old = current_weight(block)
        if old != weight:
            parts[index] = set_weight(block, weight)
            changes.append((name, old, weight))
    return "[[criterion]]".join(parts), changes


def rebalance_staged(text: str) -> tuple[str, list[tuple[str, float, float]]]:
    """Move weight onto probed criteria while preserving the dimension total."""
    parts = split_criteria(text)
    blocks = parts[1:]
    weights = [current_weight(b) for b in blocks]
    total = sum(weights)
    probed = [
        any(token in criterion_description(b).lower() for token in ADVERSARIAL_TOKENS)
        for b in blocks
    ]
    if not total or not any(probed) or all(probed):
        return text, []
    points = max(1.0, round(total * 0.02, 2))
    changes: list[tuple[str, float, float]] = []
    for _ in range(200):
        donors = sorted(
            (i for i, p in enumerate(probed) if not p and weights[i] > 1.0),
            key=lambda i: -weights[i],
        )
        takers = sorted((i for i, p in enumerate(probed) if p), key=lambda i: weights[i])
        if not donors or not takers:
            break
        donor, taker = donors[0], takers[0]
        if weights[donor] - points < 1.0:
            break
        weights[donor] = round(weights[donor] - points, 2)
        weights[taker] = round(weights[taker] + points, 2)
    for index, block in enumerate(blocks, start=1):
        old = current_weight(block)
        if old != weights[index - 1]:
            parts[index] = set_weight(block, weights[index - 1])
            changes.append((criterion_id(block) or "?", old, weights[index - 1]))
    assert abs(sum(weights) - total) < 1e-6, "rebalance must preserve the dimension total"
    return "[[criterion]]".join(parts), changes


def suggestion_lines(text: str, limit: int = 3) -> list[str]:
    """Point at the weight that would move if a probe were folded in."""
    blocks = split_criteria(text)[1:]
    rows = [
        (
            criterion_id(block) or "?",
            current_weight(block),
            any(token in criterion_description(block).lower() for token in ADVERSARIAL_TOKENS),
        )
        for block in blocks
    ]
    heavy_unprobed = sorted((r for r in rows if not r[2]), key=lambda r: -r[1])[:limit]
    light_probed = sorted((r for r in rows if r[2]), key=lambda r: r[1])[:limit]
    out = [
        "heaviest criteria with no refusal or forged leg (candidates for a probe): "
        + ", ".join(f"{name} ({weight:g})" for name, weight, _ in heavy_unprobed)
    ]
    out.append(
        "lightest criteria that already carry one (candidates for more weight): "
        + ", ".join(f"{name} ({weight:g})" for name, weight, _ in light_probed)
    )
    return out


def harden_prompt(path: Path, dry_run: bool = False) -> bool:
    if not path.is_file():
        return False
    text = path.read_text(encoding="utf-8")
    lowered = text.lower()
    if "re-read" in lowered and "positive control" in lowered:
        return False
    if "{criteria}" in text:
        text = text.replace("{criteria}", PROMPT_BLOCK + "{criteria}")
    else:
        text = text.rstrip() + "\n" + PROMPT_BLOCK
    if not dry_run:
        path.write_text(text, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("task", type=Path)
    parser.add_argument("--rebalance", action="store_true", help="staged: move weight onto probed criteria, total preserved")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = args.task.resolve()
    profile = detect_profile(root)
    if profile == "unknown":
        print("unknown profile: no tests/scoring.toml and no tests/reward.toml", file=sys.stderr)
        return 3

    tests = root / "tests"
    judge = (
        tests / "scored" / "functional" / "judge.toml"
        if profile == "staged"
        else tests / "functional" / "judge.toml"
    )
    prompt = judge.parent / "prompt.md"
    if not judge.is_file():
        print(f"no functional judge at {judge}", file=sys.stderr)
        return 3

    text = judge.read_text(encoding="utf-8")
    header, _, rest = text.partition("[[criterion]]")
    notes: list[str] = []

    if profile == "dimensions":
        rewritten_rest, changes = rewrite_weights_dimensions("[[criterion]]" + rest)
        header = re.sub(
            r"(?m)^timeout = (\d+)",
            lambda m: f"timeout = {max(int(m.group(1)), 1800)}",
            header,
            count=1,
        )
        if 'reasoning_effort = "high"' not in header:
            header = re.sub(r'(?m)^reasoning_effort = "[^"]+"', 'reasoning_effort = "high"', header, count=1)
    else:
        scored_budget = 0
        test_sh = tests / "test.sh"
        if test_sh.is_file():
            match = re.search(r"run_suite scored (\d+)", test_sh.read_text(encoding="utf-8"))
            scored_budget = int(match.group(1)) if match else 0
        current = int(re.search(r"(?m)^timeout = (\d+)", header).group(1))
        room = scored_budget - 600 if scored_budget else 0
        if room and current < min(room, 9000):
            header = re.sub(r"(?m)^timeout = \d+", f"timeout = {min(room, 9000)}", header, count=1)
            notes.append(f"functional judge timeout raised {current} -> {min(room, 9000)} (scored budget {scored_budget})")
        elif not room:
            notes.append("could not read the scored budget from tests/test.sh; leave the judge timeout alone")
        rewritten_rest, changes = (
            rebalance_staged("[[criterion]]" + rest) if args.rebalance else ("[[criterion]]" + rest, [])
        )
        if args.rebalance and changes:
            notes.append("weights rebalanced onto probed criteria, dimension total preserved - no task.toml change needed")
        if not args.rebalance:
            notes.append(
                "staged profile: weights untouched by default. Prefer folding a refusal or forged replay into an "
                "existing heavy criterion; --rebalance only repoints weight and preserves the total."
            )
            notes.extend(suggestion_lines("[[criterion]]" + rest))

    if not args.dry_run:
        judge.write_text(header + rewritten_rest, encoding="utf-8")
    prompt_changed = harden_prompt(prompt, dry_run=args.dry_run)

    result = audit(root)
    print(f"profile={profile} rewritten weights: {len(changes)} (prompt updated: {prompt_changed})")
    for name, old, new in changes[:12]:
        print(f"  {name}: {old:g} -> {new:g}")
    for note in notes:
        print(f"  note: {note}")
    print(
        f"criteria={result['functional_criteria']} total_weight={result['total_weight']} "
        f"enforcement_share={result['enforcement_share']:.3f} fails="
        f"{sum(1 for i in result['issues'] if i['severity'] == 'fail')}"
    )
    return 0 if not any(i["severity"] == "fail" for i in result["issues"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
