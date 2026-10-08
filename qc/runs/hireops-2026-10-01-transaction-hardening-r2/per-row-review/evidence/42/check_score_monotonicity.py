from pathlib import Path
import hashlib, itertools, json, runpy, sys, time, tomllib
sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[6]
frozen = root / ".qc-cache/hireops-2026-10-01-transaction-hardening-r2/task"
out = Path(__file__).resolve().parent
assert out.is_relative_to(root / "qc/runs/hireops-2026-10-01-transaction-hardening-r2/per-row-review/evidence")
started = time.monotonic()
score_path = frozen / "tests/tools/score.py"
scorer = runpy.run_path(str(score_path), run_name="row42_score_arithmetic")
fixtures = out / "synthetic-fixtures"
for suite in ("gates", "scored"):
    (fixtures / suite).mkdir(parents=True, exist_ok=True)
def grade(v):
    (fixtures / "gates/reward.json").write_text(json.dumps(dict(zip(("render", "constraints"), v[:2]))))
    (fixtures / "scored/reward.json").write_text(json.dumps(dict(zip(("functional", "polish", "visual"), v[2:]))))
    exit_code = scorer["main"](fixtures)
    result = json.loads((fixtures / "reward.json").read_text())
    return {"dimensions": list(v), "score_py_exit": exit_code, "reward": result["reward"]}
axes = [[0, 1], [0, 1], [0, .0499, .05, .0501, .2, .5, 1], [0, 1/3, 2/3, 1], [0, 1/3, 2/3, 1]]
observed = {v: grade(v) for v in itertools.product(*axes)}
violations, comparisons = [], 0
for v, result in observed.items():
    for dimension, values in enumerate(axes):
        j = values.index(v[dimension])
        if j + 1 < len(values):
            higher = list(v); higher[dimension] = values[j + 1]; higher = tuple(higher)
            comparisons += 1
            if observed[higher]["reward"] < result["reward"]:
                violations.append([result, observed[higher]])
functional = tomllib.loads((frozen / "tests/scored/functional/judge.toml").read_text())
weight_sum = sum(c["weight"] for c in functional["criterion"])
aba_weight = next(c["weight"] for c in functional["criterion"] if c["id"] == "hro_change_aba")
examples = {
    "synthetic_all_dimensions_full_credit": grade((1, 1, 1, 1, 1)),
    "synthetic_identical_except_ABA_criterion_zero": grade((1, 1, (weight_sum - aba_weight)/weight_sum, 1, 1)),
    "synthetic_exact_functional_floor": grade((1, 1, .05, 1, 1)),
    "synthetic_above_functional_floor": grade((1, 1, .0501, 1, 1)),
    "synthetic_failed_constraints": grade((1, 0, 1, 1, 1)),
}
result = {
    "kind": "Direct execution of frozen score.py on synthetic dimension data; NOT app judge grades, app ranking, model or Oracle evidence",
    "command": "python -B " + str(Path(__file__).relative_to(root)).replace("\\", "/"),
    "input_sha256": "7e8adb4257e0b520304b0c4c7b2d16e184c9f951d54e3b3e77345643d59023f0",
    "score_py_sha256": hashlib.sha256(score_path.read_bytes()).hexdigest(),
    "scoring_toml_sha256": hashlib.sha256((frozen / "tests/scoring.toml").read_bytes()).hexdigest(),
    "grid_cases": len(observed), "coordinate_increase_comparisons": comparisons,
    "violations": violations, "examples": examples, "elapsed_sec": round(time.monotonic()-started, 3)
}
(out / "synthetic-monotonicity.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
