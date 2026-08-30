#!/usr/bin/env python3
"""Rubric-only Harbor verifier for Oriel Permitworks.

This file contains verifier plumbing only. It starts the submitted app, runs
each RewardKit browser-rubric segment in an isolated judge session against one
continuous SQLite state, restarts the app for the durability segment, and
combines the declared criterion weights. It does not call or assume any
business endpoint, response envelope, selector, button label, or heading.
"""
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
BASE_URL = (os.environ.get("BASE_URL") or os.environ.get("APP_PUBLIC_URL")
            or f"http://localhost:{PORT}")
LOG_DIR = Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier"))
APP_SOURCE_DIR = LOG_DIR / "app-source"
TESTS_DIR = Path(__file__).resolve().parent
RUBRIC_DIR = TESTS_DIR / "rubric" / "browser"
RUBRIC_FILE = RUBRIC_DIR / "browser.toml"
PROMPT_FILE = RUBRIC_DIR / "prompt.md"
SEGMENTS_FILE = RUBRIC_DIR / "segments.json"
SEGMENT_NOTE_MARKER = "<!-- SEGMENT_NOTE -->"

HEALTH_TIMEOUT_SEC = 180.0
BROWSER_BUDGET_SEC = float(os.environ.get("ORIEL_BROWSER_BUDGET_SEC", "76000"))
SEGMENT_TIMEOUT_SEC = float(os.environ.get("ORIEL_SEGMENT_TIMEOUT_SEC", "7200"))
DEFAULT_START_COMMAND = "npm start"
START_BLOCK_RE = re.compile(r"```bash start\s*\n(.*?)```", re.DOTALL)
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
        raw = json.loads(SEGMENTS_FILE.read_text(encoding="utf-8"))
        declared = raw.get("segments")
    except Exception as exc:
        log(f"segments.json unusable ({exc}); using one rubric session")
        return fallback
    if not isinstance(declared, list) or not declared:
        return fallback
    known = set(order)
    seen: set[str] = set()
    segments: list[dict] = []
    for index, segment in enumerate(declared, start=1):
        ids = [item for item in (segment.get("criteria") or [])
               if item in known and item not in seen]
        if not ids:
            continue
        seen.update(ids)
        segments.append({
            "id": str(segment.get("id") or f"segment-{index}"),
            "criteria": ids,
            "restart_app": bool(segment.get("restart_app")),
        })
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
        header + "\n".join(blocks[item] for item in segment["criteria"]),
        encoding="utf-8",
    )
    scope = ("Judge only the criterion or criteria below. Do not redo or undo work from "
             "other parts; later parts continue from the state you leave.")
    note = [
        f"This is part {position} of {total} of one continuous Oriel Permitworks evaluation.",
        "Earlier parts used this same database; only the judge and browser are fresh.",
        scope,
    ]
    if segment.get("restart_app"):
        note += ["", "The app process was stopped and started before this part. The data directory was not changed."]
    (dest / "prompt.md").write_text(
        prompt_text.replace(SEGMENT_NOTE_MARKER, "\n".join(note)), encoding="utf-8"
    )


def run_command(command: list[str], **kwargs) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(command, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", **kwargs)
    except FileNotFoundError:
        return subprocess.CompletedProcess(command, returncode=127, stdout="", stderr="command not found")


def kill_leftover_node() -> None:
    for command in (["pkill", "-9", "-f", "node"], ["killall", "-9", "node"]):
        try:
            subprocess.run(command, capture_output=True, timeout=5)
        except Exception:
            pass
    time.sleep(0.3)


def wait_port_free(timeout: float = 15.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        result = run_command(["ss", "-ltn"], timeout=10)
        if result.returncode == 0 and f":{PORT} " not in result.stdout:
            return True
        time.sleep(0.4)
    return False


def find_app_root() -> Path:
    candidates = [APP_DIR]
    try:
        candidates.extend(path for path in sorted(APP_DIR.iterdir()) if path.is_dir())
    except Exception:
        pass
    for candidate in candidates:
        if (candidate / "package.json").is_file():
            return candidate
    return APP_DIR


def find_manifest(app_root: Path) -> Path | None:
    for candidate in (app_root / "APP_MANIFEST.md", APP_DIR / "APP_MANIFEST.md"):
        if candidate.is_file():
            return candidate
    return None


def start_command_from_manifest(app_root: Path) -> str:
    manifest = find_manifest(app_root)
    if manifest is None:
        log("APP_MANIFEST.md missing; using npm start fallback")
        return DEFAULT_START_COMMAND
    match = START_BLOCK_RE.search(manifest.read_text(encoding="utf-8", errors="replace"))
    if not match:
        log("APP_MANIFEST.md has no start fence; using npm start fallback")
        return DEFAULT_START_COMMAND
    command = "\n".join(line.rstrip() for line in match.group(1).splitlines() if line.strip()).strip()
    return command or DEFAULT_START_COMMAND


def manifest_contract_error(app_root: Path) -> str | None:
    """Return a deterministic delivery failure while preserving startup fallback."""
    manifest = find_manifest(app_root)
    if manifest is None:
        return "delivery manifest check failed: APP_MANIFEST.md is missing"
    match = START_BLOCK_RE.search(manifest.read_text(encoding="utf-8", errors="replace"))
    if not match:
        return ("delivery manifest check failed: expected an opening fence whose "
                "info string is exactly `bash start`")
    command = "\n".join(line.strip() for line in match.group(1).splitlines() if line.strip()).strip()
    if not command:
        return "delivery manifest check failed: the `bash start` fence has no command"
    return None


def snapshot_source(app_root: Path) -> None:
    try:
        if APP_SOURCE_DIR.exists():
            shutil.rmtree(APP_SOURCE_DIR)
        shutil.copytree(
            app_root,
            APP_SOURCE_DIR,
            ignore=shutil.ignore_patterns(
                "node_modules", ".git", "*.db", "*.sqlite", "*.sqlite3",
                "*-journal", "*-wal", "*-shm", "*.log",
            ),
            symlinks=False,
            ignore_dangling_symlinks=True,
        )
        log(f"snapshotted submitted source to {APP_SOURCE_DIR}")
    except Exception as exc:
        log(f"source snapshot failed without affecting score: {exc}")


def wipe_databases(app_root: Path) -> None:
    for base in (app_root / "data", app_root):
        if not base.is_dir():
            continue
        for item in base.iterdir():
            name = item.name.lower()
            if item.is_file() and (name.endswith((".db", ".sqlite", ".sqlite3"))
                                   or "-journal" in name or "-wal" in name or "-shm" in name):
                try:
                    item.unlink()
                except Exception:
                    pass


def install_dependencies(app_root: Path) -> bool:
    if (app_root / "node_modules").is_dir():
        return True
    common = ["--include=dev", "--no-audit", "--no-fund", "--loglevel=error"]
    commands: list[tuple[str, list[str]]] = []
    if (app_root / "package-lock.json").is_file():
        commands.append(("npm ci", ["npm", "ci", *common]))
    # Agent-generated lockfiles are occasionally stale or skeletal. npm install
    # remains faithful to package.json while repairing the lock instead of
    # turning an otherwise runnable submission into an ungraded zero.
    commands.extend(("npm install", ["npm", "install", *common]) for _ in range(2))
    logs: list[str] = []
    for attempt, (label, command) in enumerate(commands, start=1):
        result = run_command(command, cwd=str(app_root), timeout=900)
        logs.append(f"=== attempt {attempt}/{len(commands)}: {label} ===\n"
                    + (result.stdout or "") + (result.stderr or ""))
        (LOG_DIR / "npm-install.log").write_text("\n".join(logs), encoding="utf-8")
        if result.returncode == 0 and (app_root / "node_modules").is_dir():
            return True
        log(f"dependency install attempt {attempt}/{len(commands)} ({label}) "
            f"failed with exit {result.returncode}")
        time.sleep(attempt * 2)
    return False


def start_app(app_root: Path, command: str) -> subprocess.Popen:
    log(f"starting submitted app: {command}")
    stdout_file = open(LOG_DIR / "app.stdout.log", "a", buffering=1)
    stderr_file = open(LOG_DIR / "app.stderr.log", "a", buffering=1)
    env = {**os.environ, "PORT": str(PORT), "HOST": "0.0.0.0",
           "npm_config_bin_links": "false"}
    env.pop("NODE_ENV", None)
    kwargs = {"preexec_fn": os.setsid} if hasattr(os, "setsid") else {}
    process = subprocess.Popen(["bash", "-lc", command], cwd=str(app_root),
                               stdout=stdout_file, stderr=stderr_file, env=env, **kwargs)
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
    kill_leftover_node()
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


def run_rewardkit(app_root: Path, phase: str, rubric_dir: Path, timeout: float) -> dict:
    phase_dir = LOG_DIR / f"rewardkit-{phase}"
    phase_dir.mkdir(parents=True, exist_ok=True)
    reward_path = phase_dir / "reward.json"
    details_path = phase_dir / "reward-details.json"
    command = [
        *rewardkit_command(), str(rubric_dir), "--workspace", str(app_root),
        "--output", str(reward_path), "--max-concurrent-agent", "1",
        "--max-concurrent-llm", "1",
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8",
                                errors="replace", env=rewardkit_environment(), timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        result = subprocess.CompletedProcess(
            command, returncode=-9,
            stdout=(exc.stdout or b"").decode("utf-8", "replace") if isinstance(exc.stdout, bytes) else (exc.stdout or ""),
            stderr=f"timed out after {timeout:.0f}s",
        )
    (phase_dir / "stdout.log").write_text(result.stdout or "", encoding="utf-8")
    (phase_dir / "stderr.log").write_text(result.stderr or "", encoding="utf-8")
    if not reward_path.exists():
        return {"error": (result.stderr or result.stdout or "RewardKit produced no reward")[-1200:],
                "exit_code": result.returncode, "details": None}
    try:
        details = json.loads(details_path.read_text(encoding="utf-8")) if details_path.exists() else None
    except Exception:
        details = None
    return {"error": None if result.returncode == 0 else (result.stderr or "")[-1200:],
            "exit_code": result.returncode, "details": details}


def criterion_summary(block: str, limit: int = 360) -> str:
    _, _, tail = block.partition('description = """')
    text, _, _ = tail.partition('"""')
    flat = " ".join(text.split())
    return flat if len(flat) <= limit else flat[:limit - 3] + "..."


def unprobed(reasoning: str) -> bool:
    text = (reasoning or "").strip().lower()
    # Match only exact strings the verifier itself writes when a criterion was not
    # actually judged, never the judge's free-text prose. A judge describing an
    # app-side timeout ("the request timed out after 30 seconds") must not be
    # mistaken for a verifier timeout. Real verifier timeouts are already tracked
    # by the criterion_timeout flag at the call site.
    return (
        text == "criterion was never judged"
        or text == "no reasoning returned"
        or text == "judge timed out"
        or text.startswith("browser budget exhausted")
    )


def run_segments(app_root: Path, holder: dict, start_command: str,
                 delivery_error: str | None = None) -> dict:
    try:
        rubric_text = RUBRIC_FILE.read_text(encoding="utf-8")
        prompt_text = PROMPT_FILE.read_text(encoding="utf-8")
    except Exception as exc:
        return {"score": 0.0, "passed": 0, "total": criterion_count(),
                "error": f"rubric unreadable: {exc}", "judge_infra_error": 1}
    header, blocks, order, weights = split_rubric(rubric_text)
    if not blocks:
        return {"score": 0.0, "passed": 0, "total": 0,
                "error": "no browser criteria declared", "judge_infra_error": 1}
    segments = load_segments(order)
    verdicts = {
        item: {"value": 0.0, "weight": weights.get(item, 1.0), "segment": None,
               "reasoning": "criterion was never judged", "timed_out": False, "probed": False}
        for item in order
    }
    reports: list[dict] = []
    errors: list[str] = []
    work_dir = Path(tempfile.mkdtemp(prefix="oriel-rubric-"))
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
            if segment.get("restart_app"):
                stop_app(holder.get("process"))
                holder["process"] = start_app(app_root, start_command)
                if not wait_healthy():
                    message = f"app did not return after restart before {segment['id']}"
                    errors.append(message)
                    for item in segment["criteria"]:
                        verdicts[item]["reasoning"] = message
                    reports.append({"id": segment["id"], "criteria": segment["criteria"], "error": message})
                    continue
            segment_dir = work_dir / segment["id"]
            write_segment(segment_dir, header, blocks, segment, position, len(segments), prompt_text)
            outcome = run_rewardkit(app_root, f"browser-{segment['id']}", segment_dir,
                                    min(SEGMENT_TIMEOUT_SEC, remaining))
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
            reports.append({"id": segment["id"], "criteria": segment["criteria"],
                            "ungraded": missing, "exit_code": outcome.get("exit_code"),
                            "error": outcome.get("error"), "timed_out": timeout_hit})
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

    if delivery_error and "delivery_manifest" in verdicts:
        verdicts["delivery_manifest"].update({
            "value": 0.0,
            "reasoning": delivery_error,
            "timed_out": False,
            "probed": True,
        })
        log(delivery_error)

    criteria = [{
        "id": item, "name": item, "value": verdicts[item]["value"],
        "weight": verdicts[item]["weight"], "segment": verdicts[item]["segment"],
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
    details = {"reward": {"score": score, "criteria": criteria, "kind": "segmented",
                           "segments": reports, "criteria_timed_out": timed_out,
                           "criteria_unprobed": unprobed_count,
                           "judge_infra_error": 0 if any_probed else 1}}
    merged_dir = LOG_DIR / "rewardkit-browser"
    merged_dir.mkdir(parents=True, exist_ok=True)
    (merged_dir / "reward-details.json").write_text(json.dumps(details, indent=2), encoding="utf-8")
    (merged_dir / "reward.json").write_text(json.dumps({"reward": score}, indent=2), encoding="utf-8")
    return {"score": score, "passed": passed, "total": len(criteria), "error": None,
            "segment_errors": errors or None, "criteria_timed_out": timed_out,
            "criteria_unprobed": unprobed_count, "judge_infra_error": 0 if any_probed else 1,
            "criteria": criteria}


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
    (LOG_DIR / "report.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")


def main() -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    (LOG_DIR / "reward.txt").write_text("0.0\n", encoding="utf-8")
    (LOG_DIR / "reward.json").write_text(
        json.dumps({"reward": 0.0, "browser_score": 0.0, "browser_passed": 0,
                    "browser_total": criterion_count(), "graded": 0, "no_op": 1}) + "\n",
        encoding="utf-8",
    )
    holder: dict[str, subprocess.Popen | None] = {"process": None}
    app_root: Path | None = None
    app_operable = False
    try:
        app_root = find_app_root()
        if not (app_root / "package.json").is_file():
            write_reward(0.0, {"taskId": "webdev/oriel-permitworks", "graded": False,
                               "no_op": True, "error": "no package.json found",
                               "reward_breakdown": {"formula": "browser", "browser": {
                                   "score": 0.0, "passed": 0, "total": criterion_count()}}})
            return 0
        snapshot_source(app_root)
        kill_leftover_node()
        wait_port_free()
        wipe_databases(app_root)
        if not install_dependencies(app_root):
            write_reward(0.0, {"taskId": "webdev/oriel-permitworks", "graded": False,
                               "no_op": True, "error": "dependency installation failed",
                               "reward_breakdown": {"formula": "browser", "browser": {
                                   "score": 0.0, "passed": 0, "total": criterion_count()}}})
            return 0
        start_command = start_command_from_manifest(app_root)
        delivery_error = manifest_contract_error(app_root)
        holder["process"] = start_app(app_root, start_command)
        if not wait_healthy():
            browser = {"score": 0.0, "passed": 0, "total": criterion_count(),
                       "error": "app did not serve its landing page"}
            no_op = True
        else:
            app_operable = True
            browser = run_segments(app_root, holder, start_command, delivery_error)
            no_op = False
        raw_score = max(0.0, min(1.0, float(browser.get("score", 0.0))))
        graded = (not browser.get("error") and not browser.get("segment_errors")
                  and not browser.get("judge_infra_error")
                  and not browser.get("criteria_timed_out")
                  and not browser.get("criteria_unprobed"))
        # An incomplete judge pass is diagnostic evidence, not a training
        # reward. Preserve its raw value for review but hard-zero the emitted
        # score so timeouts and infrastructure failures cannot look authentic.
        score = raw_score if graded else 0.0
        if not graded:
            browser["ungated_score"] = raw_score
            browser["score"] = 0.0
        report = {"taskId": "webdev/oriel-permitworks", "reward": round(score, 6),
                  "graded": graded, "no_op": no_op, "start_command": start_command,
                  "reward_breakdown": {"formula": "browser", "browser": browser}}
        write_reward(score, report)
        log(f"final browser reward {score:.4f} ({browser.get('passed', 0)}/{browser.get('total', 0)})")
        return 0
    except BaseException as exc:
        message = f"{type(exc).__name__}: {exc}"
        log(f"unhandled verifier error: {message}")
        try:
            write_reward(0.0, {"taskId": "webdev/oriel-permitworks", "graded": False,
                               "no_op": not app_operable, "error": message,
                               "reward_breakdown": {"formula": "browser", "browser": {
                                   "score": 0.0, "passed": 0, "total": criterion_count(),
                                   "judge_infra_error": 1}}})
        except Exception:
            pass
        return 1
    finally:
        stop_app(holder.get("process"))
        # Harbor collects /app after verification. Removing installed dependencies
        # avoids Windows artifact-copy failures on npm's symlinked .bin entries;
        # the dependency manifest and the pre-install source snapshot remain.
        if app_root is not None:
            dependencies = app_root / "node_modules"
            shutil.rmtree(dependencies / ".bin", ignore_errors=True)
            shutil.rmtree(dependencies, ignore_errors=True)
            if dependencies.exists():
                run_command(["rm", "-rf", "--", str(dependencies)], timeout=120)


if __name__ == "__main__":
    raise SystemExit(main())
