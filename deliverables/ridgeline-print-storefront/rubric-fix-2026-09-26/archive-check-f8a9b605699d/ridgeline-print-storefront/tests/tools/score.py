#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import sys
import tomllib
from pathlib import Path

POLICY = Path(__file__).resolve().parent.parent / "scoring.toml"


def _score(data: dict, key: str) -> float:
    value = data.get(key)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"missing or non-numeric RewardKit dimension: {key}")
    value = float(value)
    if not math.isfinite(value) or not 0.0 <= value <= 1.0:
        raise ValueError(f"invalid RewardKit dimension {key}={value!r}")
    return value


def _read_json(path: Path) -> dict | None:
    return json.loads(path.read_text()) if path.is_file() else None


def main(log_dir: Path) -> int:
    policy = tomllib.loads(POLICY.read_text())
    gates: dict[str, float] = policy["gates"]
    weights: dict[str, float] = policy["weights"]
    floors: dict[str, float] = policy.get("floors", {})
    if unknown := set(floors) - set(weights):
        raise ValueError(f"floors on non-scored dimensions: {sorted(unknown)}")

    gate_data = _read_json(log_dir / "gates" / "reward.json")
    if gate_data is None:
        raise ValueError("gates suite produced no reward.json")
    scored_data = _read_json(log_dir / "scored" / "reward.json")

    scores = {k: _score(gate_data, k) for k in gates}
    gates_passed = all(scores[k] > floor for k, floor in gates.items())
    scored_ran = gates_passed and scored_data is not None
    for k in weights:
        scores[k] = _score(scored_data, k) if scored_ran else 0.0

    weighted = sum(w * scores[k] for k, w in weights.items()) / sum(weights.values())
    floors_passed = scored_ran and all(scores[k] > f for k, f in floors.items())
    reward = round(weighted, 4) if gates_passed and floors_passed else 0.0

    result = {
        **scores,
        "reward": reward,
        "gates_passed": int(gates_passed),
        "floors_passed": int(floors_passed),
        "weighted_score": round(weighted, 4),
        "graded": 1,
        "no_op": 0,
    }
    (log_dir / "reward.json").write_text(json.dumps(result, indent=2) + "\n")
    (log_dir / "reward.txt").write_text(f"{reward:.4f}\n")

    details: dict = {}
    for suite in ("gates", "scored"):
        details.update(_read_json(log_dir / suite / "reward-details.json") or {})
    (log_dir / "reward-details.json").write_text(json.dumps(details, indent=2) + "\n")

    def status(passed: bool, ran: bool = True) -> str:
        return "skipped" if not ran else ("passed" if passed else "failed")

    tests = [{"name": f"gate:{k}", "status": status(scores[k] > f)} for k, f in gates.items()]
    tests += [
        {"name": f"floor:{k}", "status": status(scores[k] > f, scored_ran)}
        for k, f in floors.items()
    ]
    tests += [
        {"name": f"scored:{k}", "status": status(scores[k] > 0, scored_ran)}
        for k in weights
    ]
    summary = {s: sum(t["status"] == s for t in tests) for s in ("passed", "failed", "skipped")}
    ctrf = {"tool": {"name": "rewardkit"}, "tests": tests, "summary": {**summary, "total": len(tests)}}
    (log_dir / "ctrf.json").write_text(json.dumps(ctrf, indent=2) + "\n")

    return 0 if gates_passed else 1


if __name__ == "__main__":
    try:
        sys.exit(main(Path(sys.argv[1])))
    except Exception as exc:
        print(f"score.py: {exc}", file=sys.stderr)
        sys.exit(2)
