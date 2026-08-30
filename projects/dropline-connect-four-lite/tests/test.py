#!/usr/bin/env python3
"""Oriel-style segmented browser-rubric verifier for DropLine Lite."""
from __future__ import annotations

import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path


APP_DIR = Path(os.environ.get("APP_DIR", "/app"))
PORT = int(os.environ.get("PORT", "3000"))
BASE_URL = os.environ.get("BASE_URL") or f"http://localhost:{PORT}"
LOG_DIR = Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier"))
APP_SOURCE_DIR = LOG_DIR / "app-source"
TESTS_DIR = Path(__file__).resolve().parent
RUBRIC_DIR = TESTS_DIR / "rubric" / "browser"
RUBRIC_FILE = RUBRIC_DIR / "browser.toml"
PROMPT_FILE = RUBRIC_DIR / "prompt.md"
SEGMENTS_FILE = RUBRIC_DIR / "segments.json"
SEGMENT_NOTE_MARKER = "<!-- SEGMENT_NOTE -->"

HEALTH_TIMEOUT_SEC = 60.0
BROWSER_BUDGET_SEC = float(os.environ.get("DROPLINE_BROWSER_BUDGET_SEC", "3000"))
SEGMENT_TIMEOUT_SEC = float(os.environ.get("DROPLINE_SEGMENT_TIMEOUT_SEC", "600"))
START_COMMAND = f"python3 -m http.server {PORT} --bind 0.0.0.0 --directory {APP_DIR}"
CRITERION_ID_RE = re.compile(r'^id\s*=\s*"(.*?)"\s*$', re.MULTILINE)
CRITERION_WEIGHT_RE = re.compile(r"^weight\s*=\s*([0-9.]+)\s*$", re.MULTILINE)
CRITERION_MARKER = "[[criterion]]"


def log(message: str) -> None:
    print(f"[verifier] {message}", flush=True)


def criterion_count() -> int:
    try:
        return len(CRITERION_ID_RE.findall(RUBRIC_FILE.read_text(encoding="utf-8")))
    except Exception:
        return 0


def split_rubric(text: str) -> tuple[str, dict[str, str], list[str], dict[str, float]]:
    index = text.find(CRITERION_MARKER)
    if index < 0:
        return text, {}, [], {}
    header, body = text[:index], text[index:]
    chunks = body.split("\n" + CRITERION_MARKER)
    chunks = [chunks[0]] + [CRITERION_MARKER + chunk for chunk in chunks[1:]]
    blocks: dict[str, str] = {}
    order: list[str] = []
    weights: dict[str, float] = {}
    for chunk in chunks:
        match = CRITERION_ID_RE.search(chunk)
        if not match:
            continue
        criterion_id = match.group(1)
        blocks[criterion_id] = chunk.rstrip() + "\n"
        order.append(criterion_id)
        weight = CRITERION_WEIGHT_RE.search(chunk)
        weights[criterion_id] = float(weight.group(1)) if weight else 1.0
    return header, blocks, order, weights


def load_segments(order: list[str]) -> list[dict]:
    fallback = [{"id": "browser", "criteria": list(order)}]
    try:
        declared = json.loads(SEGMENTS_FILE.read_text(encoding="utf-8")).get("segments")
    except Exception as exc:
        log(f"segments.json unusable ({exc}); using one browser session")
        return fallback
    if not isinstance(declared, list) or not declared:
        return fallback
    known = set(order)
    seen: set[str] = set()
    segments: list[dict] = []
    for index, segment in enumerate(declared, start=1):
        ids = [item for item in (segment.get("criteria") or []) if item in known and item not in seen]
        if not ids:
            continue
        seen.update(ids)
        segments.append({"id": str(segment.get("id") or f"segment-{index}"), "criteria": ids})
    if not segments:
        return fallback
    missing = [item for item in order if item not in seen]
    if missing:
        segments[-1]["criteria"].extend(missing)
        log(f"appended undeclared criteria to final segment: {missing}")
    return segments


def write_segment(dest: Path, header: str, blocks: dict[str, str], segment: dict,
                  position: int, total: int, prompt_text: str) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "browser.toml").write_text(
        header + "\n".join(blocks[item] for item in segment["criteria"]), encoding="utf-8"
    )
    note = "\n".join([
        f"This is part {position} of {total} of the DropLine evaluation.",
        "This part uses a fresh isolated browser session against the same static file.",
        "Judge only the criteria below and do not repeat criteria from other parts.",
    ])
    (dest / "prompt.md").write_text(
        prompt_text.replace(SEGMENT_NOTE_MARKER, note), encoding="utf-8"
    )


def run_command(command: list[str], **kwargs) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            command, capture_output=True, text=True, encoding="utf-8", errors="replace", **kwargs
        )
    except FileNotFoundError:
        return subprocess.CompletedProcess(command, returncode=127, stdout="", stderr="command not found")


def wait_port_free(timeout: float = 15.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        result = run_command(["ss", "-ltn"], timeout=10)
        if result.returncode == 0 and f":{PORT} " not in result.stdout:
            return True
        time.sleep(0.4)
    return False


def snapshot_source() -> None:
    try:
        if APP_SOURCE_DIR.exists():
            shutil.rmtree(APP_SOURCE_DIR)
        shutil.copytree(APP_DIR, APP_SOURCE_DIR, ignore=shutil.ignore_patterns(".git", "*.log"))
    except Exception as exc:
        log(f"source snapshot failed without affecting score: {exc}")


def start_app() -> subprocess.Popen:
    stdout_file = open(LOG_DIR / "app.stdout.log", "a", buffering=1)
    stderr_file = open(LOG_DIR / "app.stderr.log", "a", buffering=1)
    kwargs = {"preexec_fn": os.setsid} if hasattr(os, "setsid") else {}
    process = subprocess.Popen(
        ["bash", "-lc", START_COMMAND], cwd=str(APP_DIR),
        stdout=stdout_file, stderr=stderr_file, env={**os.environ, "PORT": str(PORT)}, **kwargs,
    )
    (LOG_DIR / "app.pid").write_text(str(process.pid), encoding="utf-8")
    return process


def stop_app(process: subprocess.Popen | None) -> None:
    if process is None:
        return
    try:
        if hasattr(os, "killpg") and hasattr(os, "getpgid"):
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        else:
            process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
    except Exception:
        pass
    wait_port_free()


def wait_healthy(timeout: float = HEALTH_TIMEOUT_SEC) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/", timeout=3) as response:
                if response.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def rewardkit_command() -> list[str]:
    executable = shutil.which("rewardkit")
    return [executable] if executable else [sys.executable, "-m", "rewardkit"]


def rewardkit_environment() -> dict[str, str]:
    env = {
        **os.environ,
        "PORT": str(PORT),
        "BASE_URL": BASE_URL,
        "APP_PUBLIC_URL": BASE_URL,
        "REWARDKIT_JUDGE": os.environ.get("REWARDKIT_JUDGE", "claude-code"),
        "REWARDKIT_MODEL": os.environ.get("REWARDKIT_MODEL", "openai/gpt-5.6-luna"),
        "ANTHROPIC_BASE_URL": os.environ.get("ANTHROPIC_BASE_URL", "https://openrouter.ai/api"),
        "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": os.environ.get(
            "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY", "1"
        ),
        "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
    }
    if "ANTHROPIC_AUTH_TOKEN" not in env and env.get("OPENROUTER_API_KEY"):
        env["ANTHROPIC_AUTH_TOKEN"] = env["OPENROUTER_API_KEY"]
    return env


def run_rewardkit(phase: str, rubric_dir: Path, timeout: float) -> dict:
    phase_dir = LOG_DIR / f"rewardkit-{phase}"
    phase_dir.mkdir(parents=True, exist_ok=True)
    reward_path = phase_dir / "reward.json"
    details_path = phase_dir / "reward-details.json"
    command = [
        *rewardkit_command(), str(rubric_dir), "--workspace", str(APP_DIR),
        "--output", str(reward_path), "--max-concurrent-agent", "1", "--max-concurrent-llm", "1",
    ]
    try:
        result = subprocess.run(
            command, capture_output=True, text=True, encoding="utf-8", errors="replace",
            env=rewardkit_environment(), timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        result = subprocess.CompletedProcess(
            command, returncode=-9,
            stdout=(exc.stdout or b"").decode("utf-8", "replace") if isinstance(exc.stdout, bytes) else (exc.stdout or ""),
            stderr=f"timed out after {timeout:.0f}s",
        )
    (phase_dir / "stdout.log").write_text(result.stdout or "", encoding="utf-8")
    (phase_dir / "stderr.log").write_text(result.stderr or "", encoding="utf-8")
    if not reward_path.exists():
        return {
            "error": (result.stderr or result.stdout or "RewardKit produced no reward")[-1200:],
            "exit_code": result.returncode,
            "details": None,
        }
    try:
        details = json.loads(details_path.read_text(encoding="utf-8")) if details_path.exists() else None
    except Exception:
        details = None
    return {
        "error": None if result.returncode == 0 else (result.stderr or "")[-1200:],
        "exit_code": result.returncode,
        "details": details,
    }


def criterion_summary(block: str, limit: int = 360) -> str:
    _, _, tail = block.partition('description = """')
    text, _, _ = tail.partition('"""')
    flat = " ".join(text.split())
    return flat if len(flat) <= limit else flat[:limit - 3] + "..."


def unprobed(reasoning: str) -> bool:
    text = (reasoning or "").strip().lower()
    return (
        text == "criterion was never judged"
        or text == "no reasoning returned"
        or text == "judge timed out"
        or text.startswith("browser budget exhausted")
    )


def run_segments() -> dict:
    try:
        rubric_text = RUBRIC_FILE.read_text(encoding="utf-8")
        prompt_text = PROMPT_FILE.read_text(encoding="utf-8")
    except Exception as exc:
        return {
            "score": 0.0, "passed": 0, "total": criterion_count(),
            "error": f"rubric unreadable: {exc}", "judge_infra_error": 1,
        }
    header, blocks, order, weights = split_rubric(rubric_text)
    if not blocks:
        return {"score": 0.0, "passed": 0, "total": 0, "error": "no criteria", "judge_infra_error": 1}
    segments = load_segments(order)
    verdicts = {
        item: {
            "value": 0.0, "weight": weights.get(item, 1.0), "segment": None,
            "reasoning": "criterion was never judged", "timed_out": False, "probed": False,
        }
        for item in order
    }
    reports: list[dict] = []
    errors: list[str] = []
    work_dir = Path(tempfile.mkdtemp(prefix="dropline-rubric-"))
    deadline = time.time() + BROWSER_BUDGET_SEC
    try:
        for position, segment in enumerate(segments, start=1):
            for item in segment["criteria"]:
                verdicts[item]["segment"] = segment["id"]
            remaining = deadline - time.time()
            if remaining <= 60:
                message = f"browser budget exhausted before {segment['id']}"
                errors.append(message)
                for item in segment["criteria"]:
                    verdicts[item]["reasoning"] = message
                reports.append({"id": segment["id"], "criteria": segment["criteria"], "error": message})
                continue
            segment_dir = work_dir / segment["id"]
            write_segment(segment_dir, header, blocks, segment, position, len(segments), prompt_text)
            outcome = run_rewardkit(
                f"browser-{segment['id']}", segment_dir, min(SEGMENT_TIMEOUT_SEC, remaining)
            )
            if outcome.get("error"):
                errors.append(f"{segment['id']}: {outcome['error']}")
            reward = ((outcome.get("details") or {}).get("reward") or {})
            timeout_hit = "timed out" in str(outcome.get("error") or "").lower()
            graded_ids: set[str] = set()
            for criterion in reward.get("criteria") or []:
                criterion_id = str(criterion.get("id") or criterion.get("name") or "").strip()
                if criterion_id not in verdicts:
                    continue
                graded_ids.add(criterion_id)
                reasoning = str(criterion.get("reasoning") or "").strip()
                criterion_timeout = timeout_hit or "timed out" in str(criterion.get("error") or "").lower()
                probed = bool(reasoning) and not criterion_timeout and not unprobed(reasoning)
                verdicts[criterion_id].update({
                    "value": 1.0 if probed and float(criterion.get("value", 0) or 0) > 0 else 0.0,
                    "reasoning": reasoning or ("judge timed out" if criterion_timeout else "no reasoning returned"),
                    "timed_out": criterion_timeout,
                    "probed": probed,
                })
            missing = [item for item in segment["criteria"] if item not in graded_ids]
            reports.append({
                "id": segment["id"], "criteria": segment["criteria"], "ungraded": missing,
                "exit_code": outcome.get("exit_code"), "error": outcome.get("error"),
                "timed_out": timeout_hit,
            })
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

    criteria = [{
        "id": item,
        "name": item,
        "value": verdicts[item]["value"],
        "weight": verdicts[item]["weight"],
        "segment": verdicts[item]["segment"],
        "description": criterion_summary(blocks[item]),
        "reasoning": verdicts[item]["reasoning"],
        "timed_out": verdicts[item]["timed_out"],
    } for item in order]
    total_weight = sum(item["weight"] for item in criteria) or 1.0
    earned = sum(item["weight"] for item in criteria if item["value"] > 0)
    score = max(0.0, min(1.0, earned / total_weight))
    passed = sum(1 for item in criteria if item["value"] > 0)
    timed_out = sum(1 for item in criteria if item["timed_out"])
    unprobed_count = sum(1 for item in order if not verdicts[item]["probed"])
    any_probed = any(verdicts[item]["probed"] for item in order)
    details = {"reward": {
        "score": score,
        "criteria": criteria,
        "kind": "segmented",
        "segments": reports,
        "criteria_timed_out": timed_out,
        "criteria_unprobed": unprobed_count,
        "judge_infra_error": 0 if any_probed else 1,
    }}
    merged_dir = LOG_DIR / "rewardkit-browser"
    merged_dir.mkdir(parents=True, exist_ok=True)
    (merged_dir / "reward-details.json").write_text(json.dumps(details, indent=2), encoding="utf-8")
    (merged_dir / "reward.json").write_text(json.dumps({"reward": score}, indent=2), encoding="utf-8")
    return {
        "score": score,
        "passed": passed,
        "total": len(criteria),
        "error": None,
        "segment_errors": errors or None,
        "criteria_timed_out": timed_out,
        "criteria_unprobed": unprobed_count,
        "judge_infra_error": 0 if any_probed else 1,
        "criteria": criteria,
    }


def write_reward(score: float, report: dict) -> None:
    browser = report.get("reward_breakdown", {}).get("browser", {}) or {}
    total = int(browser.get("total", 0) or criterion_count())
    numeric = {
        "reward": float(score),
        "browser_score": float(browser.get("score", 0.0)),
        "browser_passed": int(browser.get("passed", 0) or 0),
        "browser_total": total,
        "graded": int(bool(report.get("graded", False))),
        "no_op": int(bool(report.get("no_op", False))),
        "criteria_timed_out": int(browser.get("criteria_timed_out", 0) or 0),
        "criteria_unprobed": int(browser.get("criteria_unprobed", 0) or 0),
        "judge_infra_error": int(browser.get("judge_infra_error", 0) or 0),
    }
    (LOG_DIR / "reward.json").write_text(json.dumps(numeric, indent=2), encoding="utf-8")
    (LOG_DIR / "reward.txt").write_text(f"{float(score)}\n", encoding="utf-8")
    (LOG_DIR / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


def main() -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    (LOG_DIR / "reward.txt").write_text("0.0\n", encoding="utf-8")
    (LOG_DIR / "reward.json").write_text(json.dumps({
        "reward": 0.0,
        "browser_score": 0.0,
        "browser_passed": 0,
        "browser_total": criterion_count(),
        "graded": 0,
        "no_op": 1,
    }) + "\n", encoding="utf-8")
    process: subprocess.Popen | None = None
    app_operable = False
    try:
        if not (APP_DIR / "index.html").is_file():
            write_reward(0.0, {
                "taskId": "webdev/dropline-connect-four-lite",
                "graded": False,
                "no_op": True,
                "error": "no /app/index.html found",
                "reward_breakdown": {"formula": "browser", "browser": {
                    "score": 0.0, "passed": 0, "total": criterion_count(),
                }},
            })
            return 0
        snapshot_source()
        if not wait_port_free():
            write_reward(0.0, {
                "taskId": "webdev/dropline-connect-four-lite",
                "graded": False,
                "no_op": True,
                "error": f"port {PORT} was already occupied",
                "reward_breakdown": {"formula": "browser", "browser": {
                    "score": 0.0, "passed": 0, "total": criterion_count(),
                }},
            })
            return 0
        process = start_app()
        if not wait_healthy():
            browser = {
                "score": 0.0, "passed": 0, "total": criterion_count(),
                "error": "static app did not serve its landing page",
            }
            no_op = True
        else:
            app_operable = True
            browser = run_segments()
            no_op = False
        raw_score = max(0.0, min(1.0, float(browser.get("score", 0.0))))
        graded = (
            not browser.get("error")
            and not browser.get("segment_errors")
            and not browser.get("judge_infra_error")
            and not browser.get("criteria_timed_out")
            and not browser.get("criteria_unprobed")
        )
        score = raw_score if graded else 0.0
        if not graded:
            browser["ungated_score"] = raw_score
            browser["score"] = 0.0
        report = {
            "taskId": "webdev/dropline-connect-four-lite",
            "reward": round(score, 6),
            "graded": graded,
            "no_op": no_op,
            "start_command": START_COMMAND,
            "reward_breakdown": {"formula": "browser", "browser": browser},
        }
        write_reward(score, report)
        log(f"final browser reward {score:.4f} ({browser.get('passed', 0)}/{browser.get('total', 0)})")
        return 0
    except BaseException as exc:
        message = f"{type(exc).__name__}: {exc}"
        log(f"unhandled verifier error: {message}")
        try:
            write_reward(0.0, {
                "taskId": "webdev/dropline-connect-four-lite",
                "graded": False,
                "no_op": not app_operable,
                "error": message,
                "reward_breakdown": {"formula": "browser", "browser": {
                    "score": 0.0,
                    "passed": 0,
                    "total": criterion_count(),
                    "judge_infra_error": 1,
                }},
            })
        except Exception:
            pass
        return 1
    finally:
        stop_app(process)


if __name__ == "__main__":
    raise SystemExit(main())
