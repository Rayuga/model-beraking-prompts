#!/usr/bin/env python3
"""Audit a browser-judged web task before and after a model-breaking pass.

Detects the task's profile first, then reads only source and reports the levers
this skill cares about: answer-key leaks, appearance-only leniency, criterion
weight distribution, enforcement share, profile wiring, timeout nesting and
prompt hygiene. No model, Oracle, or browser judge is invoked.

Profiles
  staged      tests/scoring.toml + tests/gates + tests/scored
              (the global webdev template: five dimensions, gates then scored,
              tools/score.py, app_context, verifier restart MCP tool)
  dimensions  tests/reward.toml + tests/<dimension>/judge.toml
              (the retired dimensions layout; four or five dimensions, with or
              without a visual dimension)

Exit status is 0 whenever the audit ran; failures are reported as issues.
"""

from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path

LENIENT = (
    "optional",
    "if possible",
    "if reachable",
    "if you can",
    "may be skipped",
    "partial credit",
    "benefit of the doubt",
    "where convenient",
)
ANSWER_KEYS = (
    "will be tested",
    "graders",
    "auditors intend",
    "the evaluator",
    "even when the server",
    "enforcement must live",
    "forged requests",
    "in this evaluation",
    "is not a pass",
)
ALLOWED_REWARD_POLICIES = (
    {"render": 0.0, "constraints": 0.0, "functional": 0.8, "polish": 0.2},
    {"render": 0.0, "constraints": 0.0, "functional": 0.6, "polish": 0.4},
)
VISUAL_REWARD_POLICY = {
    "render": 0.0,
    "constraints": 0.0,
    "functional": 0.6,
    "polish": 0.2,
    "visual": 0.2,
}
STAGED_WEIGHTS = {"functional": 0.6, "polish": 0.2, "visual": 0.2}
STAGED_GATES = {"render": 0.0, "constraints": 0.0}
STAGED_FLOORS = {"functional": 0.05}
FROZEN_STAGED_ENV = {
    "REWARDKIT_JUDGE": "claude-code",
    "REWARDKIT_MODEL": "z-ai/glm-5.3-flashx",
    "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
    "ANTHROPIC_AUTH_TOKEN": "${OPENROUTER_API_KEY}",
    "ANTHROPIC_API_KEY": "",
}
PROHIBITED_JUDGE_KEYS = ("model", "reasoning_effort", "temperature", "weight")
SPLIT_INSTRUCTION_NAMES = (
    "overview.md",
    "behaviour.md",
    "security.md",
    "ui.md",
    "integration.md",
    "policy.md",
)
INSTRUCTION_LAYOUT_ALIASES = (
    "environment/assets/instructions",
    "environment/instructions",
)
STAGED_DIMENSIONS = {
    "gates": ("render", "constraints"),
    "scored": ("functional", "polish", "visual"),
}
# The staged layout uses graded weights rather than a surface/adversarial split,
# so its enforcement share counts the criteria whose own text carries a probe.
ADVERSARIAL_TOKENS = (
    "forg",
    "refus",
    "replay",
    "4xx",
    "unauthor",
    "is not there",
    "unchanged",
    "no write",
    "does not apply",
    "killed",
)


def ok(issues: list[dict], severity: str, code: str, evidence: str) -> None:
    issues.append({"severity": severity, "id": code, "evidence": evidence})


def detect_profile(root: Path) -> str:
    if (root / "tests" / "scoring.toml").is_file() or (root / "tests" / "gates").is_dir():
        return "staged"
    if (root / "tests" / "reward.toml").is_file():
        return "dimensions"
    return "unknown"


def split_instruction_files(root: Path) -> list[Path]:
    for rel in INSTRUCTION_LAYOUT_ALIASES:
        directory = root / rel
        files = [directory / name for name in SPLIT_INSTRUCTION_NAMES]
        if all(path.is_file() for path in files):
            return sorted(files, key=lambda path: path.name)
    return [root / INSTRUCTION_LAYOUT_ALIASES[0] / name for name in SPLIT_INSTRUCTION_NAMES]


def reward_policy_tokens(policy: dict[str, float]) -> tuple[str, ...]:
    return (
        'data["render"] <= 0',
        'data["constraints"] <= 0',
        f'{policy["functional"]:g} * data["functional"]',
        f'{policy["polish"]:g} * data["polish"]',
        *(
            f'{value:g} * data["{key}"]'
            for key, value in policy.items()
            if key not in ("render", "constraints", "functional", "polish")
        ),
    )


def match_reward_policy(declared_weights: dict, has_visual: bool = False) -> dict[str, float] | None:
    policies = (VISUAL_REWARD_POLICY,) if has_visual else ALLOWED_REWARD_POLICIES
    for policy in policies:
        if all(
            abs(float(declared_weights.get(dimension, -1)) - expected) <= 1e-9
            for dimension, expected in policy.items()
        ):
            return policy
    return None


def weights_from_test_sh(test_sh: str) -> dict[str, float]:
    """Recover the reward weights when a task keeps them in test.sh arithmetic."""
    weights: dict[str, float] = {}
    for value, dimension in re.findall(r'([\d.]+)\s*\*\s*data\["(\w+)"\]', test_sh):
        weights[dimension] = float(value)
    for value, dimension in re.findall(r"([\d.]+)\s*\*\s*data\[['\"](\w+)['\"]\]", test_sh):
        weights.setdefault(dimension, float(value))
    for value, dimension in re.findall(r"([\d.]+)\s*\*\s*(?:scores|data|results)\[['\"](\w+)['\"]\]", test_sh):
        weights.setdefault(dimension, float(value))
    if 'data["render"] <= 0' in test_sh:
        weights["render"] = 0.0
    if 'data["constraints"] <= 0' in test_sh:
        weights["constraints"] = 0.0
    return weights


def weights_from_sources(root: Path, test_sh: str) -> dict[str, float]:
    """The policy may live in test.sh or in a helper the suite calls."""
    text = test_sh
    for helper in sorted((root / "tests").glob("*.py")):
        text += "\n" + helper.read_text(encoding="utf-8", errors="replace")
    return weights_from_test_sh(text)


def judge_files(root: Path, profile: str) -> list[Path]:
    tests = root / "tests"
    if profile == "staged":
        return sorted(tests.glob("*/*/judge.toml"))
    return sorted(path for path in tests.glob("*/judge.toml") if path.is_file())


def load_criteria(path: Path) -> list[dict]:
    try:
        config = tomllib.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    return config.get("criterion", [])


def grade_criteria(issues: list[dict], criteria: list[dict], label: str) -> tuple[int, float, float]:
    ids = [c.get("id") or c.get("name") for c in criteria]
    weights = [float(c.get("weight", 0)) for c in criteria]
    total = sum(weights)
    enforcement = sum(w for w in weights if w >= 3.0)
    if not ids:
        return 0, 0.0, 0.0
    if None in ids or len(ids) != len(set(ids)):
        ok(issues, "fail", "criteria_ids", f"{label}: criterion IDs missing or duplicated")
    if len(ids) < 8:
        ok(issues, "fail", "depth", f"{label}: only {len(ids)} functional criteria; expect a deep chain set")
    share = enforcement / total if total else 0.0
    if total and share < 0.80:
        severity = "fail" if label == "functional" and CODEARENA_CONTEXT["active"] else "note"
        ok(
            issues,
            severity,
            "enforcement_share",
            f"{label}: enforcement share {share:.1%} (weight on criteria at 3.0 or above); "
            "the 80% target belongs to the finalized CodeArena profile",
        )
    return len(ids), total, (enforcement / total if total else 0.0)


CODEARENA_CONTEXT = {"active": False}


def staged_enforcement_share(criteria: list[dict]) -> float:
    """Share of weight held by criteria that carry their own adversarial probe."""
    total = sum(float(c.get("weight", 0)) for c in criteria)
    if not total:
        return 0.0
    probed = sum(
        float(c.get("weight", 0))
        for c in criteria
        if any(token in str(c.get("description", "")).lower() for token in ADVERSARIAL_TOKENS)
    )
    return probed / total


def staged_grade(issues: list[dict], criteria: list[dict]) -> tuple[int, float, float]:
    ids = [c.get("id") or c.get("name") for c in criteria]
    if ids and (None in ids or len(ids) != len(set(ids))):
        ok(issues, "fail", "criteria_ids", "scored/functional: criterion IDs missing or duplicated")
    if 0 < len(ids) < 8:
        ok(issues, "fail", "depth", f"scored/functional: only {len(ids)} criteria; expect a deep chain set")
    total = sum(float(c.get("weight", 0)) for c in criteria)
    share = staged_enforcement_share(criteria)
    if criteria and share < 0.50:
        ok(
            issues,
            "note",
            "enforcement_share",
            f"scored/functional: {share:.1%} of the weight sits on criteria carrying an adversarial probe. "
            "The staged family pairs a read-only observation block with enforcement, so a share near half is normal; "
            "a breaker pass raises it by moving weight onto refused/forged legs rather than by adding read criteria.",
        )
    return len(ids), total, share


def common_leak_checks(issues: list[dict], root: Path, functional_text: str, functional_prompt: str) -> None:
    lenient_hits = [w for w in LENIENT if w in functional_text.lower()]
    if lenient_hits:
        ok(issues, "fail", "leniency", f"leniency phrases in functional judge: {sorted(set(lenient_hits))}")
    for token in ("untrusted", "re-read", "positive control"):
        if token not in functional_prompt.lower():
            ok(issues, "fail", "prompt_hygiene", f"functional prompt missing {token!r}")
    answer_hits: set[str] = set()
    for path in [root / "instruction.md", *split_instruction_files(root)]:
        if path.is_file():
            answer_hits.update(w for w in ANSWER_KEYS if w in path.read_text(encoding="utf-8").lower())
    if answer_hits:
        ok(issues, "fail", "answer_keys", f"possible answer-key leaks: {sorted(answer_hits)}")


def stage_budget(test_sh: str, stage: str) -> int:
    match = re.search(rf"run_suite {stage} (\d+)", test_sh)
    return int(match.group(1)) if match else 0


def audit_staged(root: Path, config: dict, issues: list[dict]) -> dict:
    tests = root / "tests"
    required = [
        "test.sh",
        "Dockerfile",
        "scoring.toml",
        "app_context.md",
        "tools/score.py",
        "tools/restart_mcp.py",
        "gates/render/judge.toml",
        "gates/render/prompt.md",
        "gates/constraints/judge.toml",
        "gates/constraints/prompt.md",
        "scored/functional/judge.toml",
        "scored/functional/prompt.md",
        "scored/polish/judge.toml",
        "scored/polish/prompt.md",
        "scored/visual/judge.toml",
        "scored/visual/prompt.md",
    ]
    missing = [rel for rel in required if not (tests / rel).is_file()]
    if missing:
        ok(issues, "fail", "structure", f"staged task missing: {missing}")
    for retired in ("reward.toml", "coverage.json"):
        if (tests / retired).is_file():
            ok(issues, "fail", "structure", f"staged task must not ship tests/{retired}")
    if (root / "SHA256SUMS.txt").is_file():
        ok(issues, "note", "structure", "staged tasks ship no SHA256SUMS.txt")

    scoring_path = tests / "scoring.toml"
    if scoring_path.is_file():
        try:
            scoring = tomllib.loads(scoring_path.read_text(encoding="utf-8"))
            gates = scoring.get("gates", {})
            weights = scoring.get("weights", {})
            floors = scoring.get("floors", {})
            if {k: float(v) for k, v in gates.items()} != STAGED_GATES:
                ok(issues, "fail", "reward_policy", f"gates must be {STAGED_GATES}, found {gates}")
            if {k: float(v) for k, v in weights.items()} != STAGED_WEIGHTS:
                ok(issues, "fail", "reward_policy", f"weights must be {STAGED_WEIGHTS}, found {weights}")
            if {k: float(v) for k, v in floors.items()} != STAGED_FLOORS:
                ok(issues, "fail", "reward_policy", f"floors must be {STAGED_FLOORS}, found {floors}")
        except Exception as exc:
            ok(issues, "fail", "reward_policy", f"unparseable tests/scoring.toml: {exc}")

    functional = tests / "scored" / "functional" / "judge.toml"
    functional_text = functional.read_text(encoding="utf-8") if functional.is_file() else ""
    criteria = load_criteria(functional) if functional.is_file() else []
    count, total, share = staged_grade(issues, criteria)

    for path in judge_files(root, "staged"):
        suite, dimension = path.parts[-3], path.parts[-2]
        text = path.read_text(encoding="utf-8", errors="replace")
        try:
            judge = tomllib.loads(text).get("judge", {})
        except Exception as exc:
            ok(issues, "fail", "rubric_parse", f"{suite}/{dimension}: unparseable judge.toml: {exc}")
            continue
        for key in ("mode", "timeout", "isolated", "prompt_template"):
            if key not in judge:
                ok(issues, "fail", "judge_wiring", f"{suite}/{dimension}: [judge] missing {key}")
        for key in PROHIBITED_JUDGE_KEYS:
            if key in judge:
                ok(issues, "fail", "judge_wiring", f"{suite}/{dimension}: prohibited [judge].{key}")
        servers = {s.get("name") for s in judge.get("mcp_servers", [])}
        if "playwright" not in servers:
            ok(issues, "fail", "judge_wiring", f"{suite}/{dimension}: no playwright MCP server")
        wants_restart = dimension == "functional" and suite == "scored"
        if ("verifier" in servers) != wants_restart:
            ok(issues, "fail", "judge_wiring", f"{suite}/{dimension}: verifier restart server should be {'present' if wants_restart else 'absent'}")
        if wants_restart:
            server = next(s for s in judge["mcp_servers"] if s.get("name") == "verifier")
            args = " ".join(str(a) for a in server.get("args", []))
            if "restart_mcp.py" not in args or "$APP_RESTART_HELPER" not in args:
                ok(issues, "fail", "judge_wiring", "functional: verifier server must run restart_mcp.py with $APP_RESTART_HELPER")
        prompt = path.parent / "prompt.md"
        prompt_text = prompt.read_text(encoding="utf-8") if prompt.is_file() else ""
        for token in ("{app_context}", "{criteria}"):
            if token not in prompt_text:
                ok(issues, "fail", "prompt_hygiene", f"{suite}/{dimension}: prompt missing {token}")
        if "localhost:3000" not in prompt_text:
            ok(issues, "fail", "prompt_hygiene", f"{suite}/{dimension}: prompt does not open the app URL")
        if suite == "scored" and "gate" not in prompt_text.lower():
            ok(issues, "fail", "prompt_hygiene", f"{suite}/{dimension}: scored prompt must restate the in-dimension gate")
        for criterion in load_criteria(path):
            ctype = criterion.get("type")
            if suite == "gates" and ctype != "binary":
                ok(issues, "fail", "rubric_schema", f"{suite}/{dimension}: gate criteria must be binary")
            if ctype not in ("binary", "likert"):
                ok(issues, "fail", "rubric_schema", f"{suite}/{dimension}: criterion {criterion.get('id')} has type {ctype!r}")
            if float(criterion.get("weight", 0)) <= 0:
                ok(issues, "fail", "rubric_schema", f"{suite}/{dimension}: criterion {criterion.get('id')} has a non-positive weight")

    app_context = tests / "app_context.md"
    if app_context.is_file():
        context = app_context.read_text(encoding="utf-8")
        for heading in ("## Application", "## Accounts", "## Key screens"):
            if heading not in context:
                ok(issues, "fail", "app_context", f"tests/app_context.md missing {heading!r}")

    test_sh = (tests / "test.sh").read_text(encoding="utf-8") if (tests / "test.sh").is_file() else ""
    checks = {
        "zero reward written before grading": "write_zero_reward" in test_sh,
        "reward ensured on exit": "ensure_reward" in test_sh,
        "no shell exec": not re.search(r"(?m)^\s*exec\s+\S+", test_sh),
        "gates run before scored": test_sh.find("run_suite gates") < test_sh.find("run_suite scored") if "run_suite gates" in test_sh and "run_suite scored" in test_sh else False,
        "score.py runs after each suite": test_sh.count("tools/score.py") == 2,
        "restart helper exported": 'export APP_RESTART_HELPER=' in test_sh,
        "app database cleared before grading": bool(re.search(r"rm -f \"\$APP_DB\"", test_sh)),
    }
    for label, passed in checks.items():
        if not passed:
            ok(issues, "fail", "verifier_contract", f"tests/test.sh: {label}")

    gates_budget = stage_budget(test_sh, "gates")
    scored_budget = stage_budget(test_sh, "scored")
    verifier_timeout = int(config.get("verifier", {}).get("timeout_sec", 0) or 0)
    judge_timeouts = {
        path.parts[-2]: int(tomllib.loads(path.read_text(encoding="utf-8"))["judge"]["timeout"])
        for path in judge_files(root, "staged")
        if (path.parts[-3], path.parts[-2]) in {("gates", d) for d in STAGED_DIMENSIONS["gates"]} | {("scored", d) for d in STAGED_DIMENSIONS["scored"]}
    }
    if not (gates_budget and scored_budget and verifier_timeout):
        ok(issues, "fail", "timeout_hierarchy", "could not read the suite budgets or verifier timeout")
    else:
        if any(judge_timeouts.get(d, 0) >= gates_budget for d in STAGED_DIMENSIONS["gates"]):
            ok(issues, "fail", "timeout_hierarchy", "a gate judge timeout must be below the gates budget")
        if any(judge_timeouts.get(d, 0) >= scored_budget for d in STAGED_DIMENSIONS["scored"]):
            ok(issues, "fail", "timeout_hierarchy", "a scored judge timeout must be below the scored budget")
        if gates_budget + scored_budget >= verifier_timeout:
            ok(issues, "fail", "timeout_hierarchy", f"suite budgets {gates_budget}+{scored_budget} must nest inside verifier {verifier_timeout}")

    verifier = config.get("verifier", {})
    if verifier.get("environment_mode") != "separate":
        ok(issues, "fail", "verifier_isolation", "staged tasks run the verifier separately")
    declared_env = {k: ("" if v == "" else v) for k, v in verifier.get("env", {}).items()}
    for key, expected in FROZEN_STAGED_ENV.items():
        if declared_env.get(key, "<missing>") != expected:
            ok(issues, "fail", "judge_wiring", f"[verifier.env].{key} must be {expected!r}")
    artifacts = config.get("artifacts", [])
    if sorted(artifacts) != ["/app", "/assets"]:
        ok(issues, "fail", "artifacts", f"staged artifacts must be ['/app', '/assets'], found {artifacts}")
    if "version" in config.get("task", {}):
        ok(issues, "note", "version_policy", "[task].version is optional in the staged layout")

    common_leak_checks(
        issues,
        root,
        functional_text,
        (tests / "scored" / "functional" / "prompt.md").read_text(encoding="utf-8")
        if (tests / "scored" / "functional" / "prompt.md").is_file()
        else "",
    )
    return {
        "profile": "staged",
        "functional_criteria": count,
        "total_weight": round(total, 2),
        "enforcement_share": round(share, 3),
        "gates_budget": gates_budget,
        "scored_budget": scored_budget,
        "verifier_timeout": verifier_timeout,
    }


def audit_dimensions(root: Path, config: dict, issues: list[dict]) -> dict:
    tests = root / "tests"
    functional = tests / "functional" / "judge.toml"
    visual = tests / "visual" / "judge.toml"
    has_visual = visual.is_file()
    functional_text = functional.read_text(encoding="utf-8") if functional.is_file() else ""
    criteria = load_criteria(functional) if functional.is_file() else []
    count, total, share = grade_criteria(issues, criteria, "functional")

    coverage_present = (tests / "coverage.json").is_file()
    # The finalized CodeArena profile is the four-dimension one; a task that also
    # carries a visual dimension belongs to the retired dimensions family, which
    # declares its own judge and ships no prompt-version stamps.
    codearena = coverage_present and not has_visual
    CODEARENA_CONTEXT["active"] = codearena
    expected_judge = config.get("verifier", {}).get("env", {}).get("REWARDKIT_JUDGE", "codex")
    expected_model = config.get("verifier", {}).get("env", {}).get("REWARDKIT_MODEL", "openai/gpt-5.6-luna")
    if codearena:
        # The finalized CodeArena/BazaarBridge profile pins the Codex/Luna judge.
        if expected_judge != "codex":
            ok(issues, "fail", "judge_wiring", "CodeArena tasks declare REWARDKIT_JUDGE = codex")
        if expected_model != "openai/gpt-5.6-luna":
            ok(issues, "fail", "judge_wiring", "CodeArena tasks declare REWARDKIT_MODEL = openai/gpt-5.6-luna")
    else:
        ok(
            issues,
            "note",
            "judge_wiring",
            f"retired dimensions layout: accepting the task's own judge={expected_judge!r} model={expected_model!r}; "
            "per-dimension judge/model must match it, and temperature/prompt-version stamps are not required",
        )

    judge_wiring = []
    for path in judge_files(root, "dimensions"):
        text = path.read_text(encoding="utf-8", errors="replace")
        name = path.parent.name
        try:
            judge = tomllib.loads(text).get("judge", {})
        except Exception as exc:
            judge_wiring.append(f"{name}:parse:{exc}")
            continue
        if judge.get("judge") is not None and judge.get("judge") != expected_judge:
            judge_wiring.append(f"{name}:judge")
        if judge.get("model") is not None and judge.get("model") != expected_model:
            judge_wiring.append(f"{name}:model")
        if codearena:
            if judge.get("temperature") != 0:
                judge_wiring.append(f"{name}:temperature")
            if "prompt version" not in text.lower():
                judge_wiring.append(f"{name}:prompt_version")
    if judge_wiring:
        ok(issues, "fail", "judge_wiring", "; ".join(judge_wiring))

    reward_text = (tests / "reward.toml").read_text(encoding="utf-8") if (tests / "reward.toml").is_file() else ""
    test_sh = (tests / "test.sh").read_text(encoding="utf-8") if (tests / "test.sh").is_file() else ""
    reward_policy = None
    declared: dict = {}
    try:
        parsed = tomllib.loads(reward_text)
        declared = parsed.get("weights") or parsed.get("reward", [{}])[0].get("weights") or {}
    except Exception as exc:
        ok(issues, "fail", "reward_policy", f"invalid tests/reward.toml: {exc}")
    if not declared:
        declared = weights_from_sources(root, test_sh)
    if declared:
        reward_policy = match_reward_policy(declared, has_visual=has_visual)
    if reward_policy is None:
        allowed = "0.6/0.2/0.2 with visual" if has_visual else "0.6/0.4 or legacy 0.8/0.2"
        ok(
            issues,
            "fail" if declared else "note",
            "reward_policy",
            f"could not read the declared browser profile policy ({allowed}) from tests/reward.toml or tests/test.sh; found {declared or 'nothing'}",
        )
    else:
        for token in reward_policy_tokens(reward_policy):
            if token not in test_sh:
                ok(issues, "fail", "test_floor", f"test.sh missing {token}")

    instruction_files = [root / "instruction.md", *split_instruction_files(root)]
    over_lines = []
    for path in instruction_files:
        if path.is_file():
            line_count = len(path.read_text(encoding="utf-8").splitlines())
            if line_count > 20:
                over_lines.append(f"{path.relative_to(root).as_posix()} ({line_count})")
    if codearena and over_lines:
        ok(issues, "fail", "instruction_lines", "; ".join(over_lines))

    if codearena:
        try:
            cov = json.loads((tests / "coverage.json").read_text(encoding="utf-8"))
            reqs = cov.get("requirements", [])
            if not reqs or not cov.get("prompt_version"):
                ok(issues, "fail", "coverage_shape", "coverage.json lacks prompt_version or requirements")
            else:
                functional_reqs = sum(
                    1 for item in reqs if any(str(a).startswith("functional.") for a in item.get("assertions", []))
                )
                if functional_reqs / len(reqs) <= 0.80:
                    ok(issues, "fail", "functional_coverage", f"{functional_reqs}/{len(reqs)} functional")
        except Exception as exc:
            ok(issues, "fail", "coverage_parse", str(exc))

    judge_timeout = 0
    if functional.is_file():
        try:
            judge_timeout = int(tomllib.loads(functional_text).get("judge", {}).get("timeout", 0))
        except Exception:
            pass
    budget_match = re.search(r"timeout\s+(\d+)\s+rewardkit", test_sh)
    budget = int(budget_match.group(1)) if budget_match else 0
    verifier_timeout = int(config.get("verifier", {}).get("timeout_sec", 0) or 0)
    if not (0 < judge_timeout < budget < verifier_timeout):
        ok(
            issues,
            "fail",
            "timeout_hierarchy",
            f"hierarchy invalid: judge {judge_timeout}, budget {budget}, verifier {verifier_timeout}",
        )
    common_leak_checks(
        issues,
        root,
        functional_text,
        (tests / "functional" / "prompt.md").read_text(encoding="utf-8")
        if (tests / "functional" / "prompt.md").is_file()
        else "",
    )
    return {
        "profile": "dimensions",
        "version": config.get("task", {}).get("version"),
        "functional_criteria": count,
        "total_weight": round(total, 2),
        "enforcement_share": round(share, 3),
        "judge_timeout": judge_timeout,
        "budget": budget,
        "verifier_timeout": verifier_timeout,
    }


def audit(root: Path) -> dict:
    issues: list[dict] = []
    root = root.resolve()
    if not root.is_dir():
        ok(issues, "fail", "structure", f"task directory does not exist: {root}")
        return {"task": root.name, "profile": "unknown", "issues": issues}
    task_toml = root / "task.toml"
    if not task_toml.is_file():
        ok(issues, "fail", "structure", "missing task.toml")
        return {"task": root.name, "profile": "unknown", "issues": issues}
    config = tomllib.loads(task_toml.read_text(encoding="utf-8"))
    profile = detect_profile(root)
    if profile == "staged":
        metrics = audit_staged(root, config, issues)
    elif profile == "dimensions":
        metrics = audit_dimensions(root, config, issues)
    else:
        ok(issues, "fail", "structure", "unknown profile: neither tests/scoring.toml nor tests/reward.toml is present")
        metrics = {"profile": "unknown"}
    return {"task": root.name, **metrics, "issues": issues}


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {Path(sys.argv[0]).name} <task-folder>", file=sys.stderr)
        return 2
    result = audit(Path(sys.argv[1]))
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
