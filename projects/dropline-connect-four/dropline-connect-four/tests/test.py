#!/usr/bin/env python3
from __future__ import annotations

import json
import importlib.metadata
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

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

APP_DIR = Path(os.environ.get("APP_DIR", "/app"))
PORT = int(os.environ.get("PORT", "3000"))
BASE_URL = os.environ.get("BASE_URL") or os.environ.get("APP_PUBLIC_URL") or f"http://localhost:{PORT}"
BASE_URL = BASE_URL.replace("127.0.0.1", "localhost")
LOG_DIR = Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier"))
TESTS_DIR = Path(__file__).resolve().parent
APP_SOURCE_DIR = LOG_DIR / "app-source"
START_BLOCK_RE = re.compile(r"```bash start\s*\n(.*?)```", re.DOTALL)
DEFAULT_START_COMMAND = "npm start"
HEALTH_TIMEOUT_SEC = 90.0
INSTALL_TIMEOUT_SEC = 900
EXPECTED_CRITERIA = 26
EXPECTED_JUDGE_BACKEND = "codex"
EXPECTED_JUDGE_MODEL = "openai/gpt-5.6-luna"
EXPECTED_JUDGE_REASONING_EFFORT = "medium"
BROWSER_WEIGHT = 19.5
PREFLIGHT_WEIGHT = 0.5


def log(message: str) -> None:
    print(f"[verifier] {message}", flush=True)


def run(command, **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        **kwargs,
    )


def write_reward(final: float, report: dict) -> None:
    browser = report.get("reward_breakdown", {}).get("browser", {}) or {}
    preflight = report.get("reward_breakdown", {}).get("preflight", {}) or {}
    reward = {
        "reward": float(final),
        "browser_score": float(browser.get("score", 0.0)),
        "browser_passed": int(browser.get("passed", 0)),
        "browser_total": int(browser.get("total", 0)),
        "preflight_passed": int(float(preflight.get("score", 0.0)) > 0),
        "graded": int(bool(report.get("graded", False))),
        "no_op": int(bool(report.get("no_op", False))),
        "judge_policy_match": int(judge_policy_matches()),
    }
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    (LOG_DIR / "reward.json").write_text(json.dumps(reward, indent=2), encoding="utf-8")
    (LOG_DIR / "reward.txt").write_text(f"{float(final)}\n", encoding="utf-8")
    (LOG_DIR / "report.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    (LOG_DIR / "run-metadata.json").write_text(json.dumps(run_metadata(), indent=2), encoding="utf-8")


def judge_policy_matches() -> bool:
    return (
        os.environ.get("REWARDKIT_JUDGE", EXPECTED_JUDGE_BACKEND) == EXPECTED_JUDGE_BACKEND
        and os.environ.get("REWARDKIT_MODEL", EXPECTED_JUDGE_MODEL) == EXPECTED_JUDGE_MODEL
        and os.environ.get("REWARDKIT_REASONING_EFFORT", EXPECTED_JUDGE_REASONING_EFFORT)
        == EXPECTED_JUDGE_REASONING_EFFORT
    )


def run_metadata() -> dict:
    try:
        rewardkit_version = importlib.metadata.version("harbor-rewardkit")
    except importlib.metadata.PackageNotFoundError:
        rewardkit_version = "unknown"
    try:
        codex_version = run(["codex", "--version"], timeout=10).stdout.strip() or "unknown"
    except (OSError, subprocess.SubprocessError):
        codex_version = "unknown"
    return {
        "task_name": "webdev/dropline-connect-four",
        "task_version": "1.1.0",
        "rubric_revision": "2026-08-28-dropline-26crit-luna-r2",
        "judge_backend": os.environ.get("REWARDKIT_JUDGE", EXPECTED_JUDGE_BACKEND),
        "judge_model": os.environ.get("REWARDKIT_MODEL", EXPECTED_JUDGE_MODEL),
        "judge_reasoning_effort": os.environ.get(
            "REWARDKIT_REASONING_EFFORT", EXPECTED_JUDGE_REASONING_EFFORT
        ),
        "judge_policy_match": judge_policy_matches(),
        "rewardkit_version": rewardkit_version,
        "codex_version": codex_version,
    }


def find_app_root() -> Path:
    candidates = [APP_DIR]
    if APP_DIR.is_dir():
        candidates.extend(path for path in sorted(APP_DIR.iterdir()) if path.is_dir())
    return next((path for path in candidates if (path / "package.json").is_file()), APP_DIR)


def snapshot_app_source(app_root: Path) -> None:
    try:
        if APP_SOURCE_DIR.exists():
            shutil.rmtree(APP_SOURCE_DIR)
        shutil.copytree(
            app_root,
            APP_SOURCE_DIR,
            ignore=shutil.ignore_patterns("node_modules", ".git", "*.log"),
        )
    except Exception as exc:
        log(f"could not snapshot app source: {exc}")


def start_command(app_root: Path) -> str:
    manifest = app_root / "APP_MANIFEST.md"
    if manifest.is_file():
        match = START_BLOCK_RE.search(manifest.read_text(encoding="utf-8", errors="replace"))
        if match:
            lines = [line.strip() for line in match.group(1).splitlines() if line.strip()]
            if lines:
                return " && ".join(lines)
    return DEFAULT_START_COMMAND


def dependencies_complete(app_root: Path) -> bool:
    node_modules = app_root / "node_modules"
    if not node_modules.is_dir():
        return False
    try:
        package = json.loads((app_root / "package.json").read_text(encoding="utf-8"))
    except Exception:
        return True
    return all((node_modules / dependency / "package.json").is_file() for dependency in (package.get("dependencies") or {}))


def ensure_dependencies(app_root: Path) -> bool:
    if dependencies_complete(app_root):
        return True
    baked = Path("/opt/dropline-deps/node_modules")
    if baked.is_dir() and not (app_root / "node_modules").exists():
        shutil.copytree(baked, app_root / "node_modules")
    if dependencies_complete(app_root):
        return True
    command = ["npm", "ci", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"] if (app_root / "package-lock.json").is_file() else ["npm", "install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"]
    try:
        result = run(command, cwd=str(app_root), timeout=INSTALL_TIMEOUT_SEC)
    except subprocess.TimeoutExpired as exc:
        output = (exc.stdout or "") + (exc.stderr or "")
        (LOG_DIR / "npm-install.log").write_text(
            output + f"\nDependency installation timed out after {INSTALL_TIMEOUT_SEC}s\n",
            encoding="utf-8",
        )
        return False
    (LOG_DIR / "npm-install.log").write_text((result.stdout or "") + (result.stderr or ""), encoding="utf-8")
    return result.returncode == 0 and dependencies_complete(app_root)


def architecture_checks(app_root: Path) -> list[str]:
    problems = []
    try:
        package = json.loads((app_root / "package.json").read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"package.json could not be parsed: {exc}"]

    dependencies = {
        str(name).lower()
        for section in ("dependencies", "devDependencies")
        for name in (package.get(section) or {})
    }
    if "express" not in dependencies:
        problems.append("Express is not declared as a dependency")

    disallowed = {
        "react", "react-dom", "vue", "@angular/core", "svelte",
        "phaser", "pixi.js", "kaboom", "melonjs",
    }
    forbidden_dependencies = sorted(dependencies & disallowed)
    if forbidden_dependencies:
        problems.append("disallowed framework dependencies: " + ", ".join(forbidden_dependencies))

    runtime_url = re.compile(
        r"(?:src|href)\s*=\s*[\"'](?:https?:)?//|(?:unpkg|jsdelivr|cdnjs|esm\.sh)",
        re.IGNORECASE,
    )
    for path in app_root.rglob("*"):
        if not path.is_file() or "node_modules" in path.parts or path.suffix.lower() not in {".html", ".js", ".css"}:
            continue
        try:
            source = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if runtime_url.search(source):
            problems.append(f"runtime CDN or external asset reference in {path.relative_to(app_root)}")
    return problems


def start_app(app_root: Path, command: str) -> subprocess.Popen:
    stdout = open(LOG_DIR / "app.stdout.log", "a", encoding="utf-8", errors="replace", buffering=1)
    stderr = open(LOG_DIR / "app.stderr.log", "a", encoding="utf-8", errors="replace", buffering=1)
    environment = {
        **os.environ,
        "PORT": str(PORT),
        "HOST": "0.0.0.0",
        "BASE_URL": BASE_URL,
        "APP_PUBLIC_URL": BASE_URL,
    }
    kwargs = {"preexec_fn": os.setsid} if hasattr(os, "setsid") else {}
    process = subprocess.Popen(
        ["bash", "-lc", command],
        cwd=str(app_root),
        stdout=stdout,
        stderr=stderr,
        env=environment,
        **kwargs,
    )
    (LOG_DIR / "app.pid").write_text(str(process.pid), encoding="utf-8")
    return process


def stop_app(process: subprocess.Popen | None) -> None:
    if process is None:
        return
    try:
        if hasattr(os, "killpg"):
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        else:
            process.terminate()
        process.wait(timeout=5)
    except Exception:
        try:
            if hasattr(os, "killpg"):
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
            else:
                process.kill()
        except Exception:
            pass


def healthy() -> bool:
    deadline = time.time() + HEALTH_TIMEOUT_SEC
    while time.time() < deadline:
        for endpoint in ("/health", "/"):
            try:
                with urllib.request.urlopen(f"{BASE_URL}{endpoint}", timeout=3) as response:
                    if response.status == 200:
                        return True
            except Exception:
                pass
        time.sleep(0.5)
    return False


def restart_preflight(app_root: Path, command: str) -> tuple[subprocess.Popen | None, dict]:
    problems = architecture_checks(app_root)
    first = start_app(app_root, command)
    try:
        if not healthy():
            problems.append("application did not become healthy on first start")
    finally:
        stop_app(first)
    second = start_app(app_root, command)
    if not healthy():
        problems.append("application did not become healthy after restart")
        stop_app(second)
        second = None
    score = 0.0 if problems else 1.0
    if score:
        log("stack/start/restart preflight passed")
    else:
        log("preflight problems: " + "; ".join(problems))
    return second, {"score": score, "passed": int(score > 0), "total": 1, "problems": problems}


def rewardkit_command() -> list[str]:
    executable = shutil.which("rewardkit")
    return [executable] if executable else [sys.executable, "-m", "rewardkit"]


def configure_codex_home() -> Path:
    # Keep Codex's executable helper links out of Harbor's collected artifacts.
    # Windows cannot stat those Linux symlinks while scrubbing a completed job.
    codex_home = Path(tempfile.gettempdir()) / "dropline-codex-home"
    codex_home.mkdir(parents=True, exist_ok=True)
    (codex_home / "config.toml").write_text(
        'model_provider = "openrouter"\n'
        'model_reasoning_effort = "medium"\n'
        'approval_policy = "never"\n'
        'sandbox_mode = "danger-full-access"\n'
        '[model_providers.openrouter]\n'
        'name = "OpenRouter"\n'
        'base_url = "https://openrouter.ai/api/v1"\n'
        'env_key = "OPENROUTER_API_KEY"\n'
        'wire_api = "responses"\n',
        encoding="utf-8",
    )
    return codex_home


def rewardkit_environment() -> dict[str, str]:
    return {
        **os.environ,
        "PORT": str(PORT),
        "BASE_URL": BASE_URL,
        "APP_PUBLIC_URL": BASE_URL,
        "CODEX_HOME": str(configure_codex_home()),
        "REWARDKIT_JUDGE": os.environ.get("REWARDKIT_JUDGE", "codex"),
        "REWARDKIT_MODEL": os.environ.get("REWARDKIT_MODEL", "openai/gpt-5.6-luna"),
        "REWARDKIT_REASONING_EFFORT": os.environ.get(
            "REWARDKIT_REASONING_EFFORT", EXPECTED_JUDGE_REASONING_EFFORT
        ),
    }


def numeric_score(data: dict) -> float:
    if isinstance(data.get("reward"), (int, float)):
        return float(data["reward"])
    values = [float(value) for value in data.values() if isinstance(value, (int, float))]
    return sum(values) / len(values) if values else 0.0


def criterion_rows(details) -> list[dict]:
    if isinstance(details, dict):
        blocks = [details] if isinstance(details.get("criteria"), list) else [value for value in details.values() if isinstance(value, dict) and isinstance(value.get("criteria"), list)]
    elif isinstance(details, list):
        blocks = [value for value in details if isinstance(value, dict) and isinstance(value.get("criteria"), list)]
    else:
        blocks = []
    rows = []
    for block in blocks:
        for criterion in block.get("criteria") or []:
            try:
                value = float(criterion.get("value") or 0)
            except Exception:
                value = 0.0
            rows.append({
                "id": criterion.get("id") or criterion.get("name"),
                "value": value,
                "passed": value > 0 and not criterion.get("error"),
                "error": criterion.get("error"),
                "reasoning": criterion.get("reasoning"),
            })
    return rows


def run_rewardkit(app_root: Path) -> dict:
    phase = LOG_DIR / "rewardkit-browser"
    phase.mkdir(parents=True, exist_ok=True)
    output = phase / "reward.json"
    details_path = phase / "reward-details.json"
    command = [
        *rewardkit_command(),
        str(TESTS_DIR / "rubric" / "browser"),
        "--workspace", str(app_root),
        "--output", str(output),
        "--max-concurrent-agent", "1",
        "--max-concurrent-llm", "1",
    ]
    timeout = int(os.environ.get("REWARDKIT_TIMEOUT_SEC", "13200"))
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=rewardkit_environment(),
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        (phase / "stdout.log").write_text(exc.stdout or "", encoding="utf-8")
        (phase / "stderr.log").write_text((exc.stderr or "") + f"\nRewardKit timed out after {timeout}s\n", encoding="utf-8")
        return {"score": 0.0, "passed": 0, "total": 0, "error": "RewardKit timed out"}
    (phase / "stdout.log").write_text(result.stdout or "", encoding="utf-8")
    (phase / "stderr.log").write_text(result.stderr or "", encoding="utf-8")
    if not output.is_file():
        return {"score": 0.0, "passed": 0, "total": 0, "error": (result.stderr or result.stdout or "RewardKit produced no reward")[-1200:]}
    data = json.loads(output.read_text(encoding="utf-8"))
    details = json.loads(details_path.read_text(encoding="utf-8")) if details_path.is_file() else None
    rows = criterion_rows(details)
    for index, row in enumerate(rows, start=1):
        log(f"rubric {index:02d}: {'pass' if row['passed'] else 'fail'} {row['id']} value={row['value']}")
    score = max(0.0, min(1.0, numeric_score(data)))
    return {
        "score": score,
        "passed": sum(1 for row in rows if row["passed"]),
        "total": len(rows),
        "reward_json": data,
        "details": details,
        "error": None if result.returncode == 0 else (result.stderr or "")[-1200:],
    }


def main() -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    placeholder = {
        "taskId": "webdev/dropline-connect-four",
        "reward": 0.0,
        "graded": False,
        "no_op": True,
        "error": "verifier did not complete",
        "reward_breakdown": {},
    }
    write_reward(0.0, placeholder)
    try:
        app_root = find_app_root()
        log(f"app_root={app_root}")
        if not (app_root / "package.json").is_file():
            placeholder["error"] = "no package.json"
            write_reward(0.0, placeholder)
            return 0
        snapshot_app_source(app_root)
        if not ensure_dependencies(app_root):
            placeholder["error"] = "dependency installation failed"
            write_reward(0.0, placeholder)
            return 0

        command = start_command(app_root)
        process, preflight = restart_preflight(app_root, command)
        if process is None:
            report = {
                "taskId": "webdev/dropline-connect-four",
                "reward": 0.0,
                "graded": True,
                "no_op": True,
                "start_command": command,
                "reward_breakdown": {"preflight": preflight, "browser": {"score": 0.0, "passed": 0, "total": 0, "error": "app unhealthy"}},
            }
            write_reward(0.0, report)
            return 0

        try:
            browser = run_rewardkit(app_root)
        finally:
            stop_app(process)

        browser_complete = browser.get("total") == EXPECTED_CRITERIA and not browser.get("error")
        final = ((float(preflight["score"]) * PREFLIGHT_WEIGHT) + (float(browser["score"]) * BROWSER_WEIGHT)) / (PREFLIGHT_WEIGHT + BROWSER_WEIGHT) if browser_complete else 0.0
        report = {
            "taskId": "webdev/dropline-connect-four",
            "reward": round(final, 4),
            "graded": browser_complete,
            "no_op": False,
            "start_command": command,
            "reward_breakdown": {
                "formula": "(preflight*0.5 + browser*19.5) / 20",
                "preflight": preflight,
                "browser": browser,
            },
        }
        write_reward(final, report)
        log(f"final reward: {final:.4f} ({preflight['passed'] + browser.get('passed', 0)}/{1 + browser.get('total', 0)} checks)")
        return 0
    except BaseException as exc:
        placeholder["error"] = f"{type(exc).__name__}: {exc}"
        write_reward(0.0, placeholder)
        if isinstance(exc, (SystemExit, KeyboardInterrupt)):
            raise
        raise


if __name__ == "__main__":
    raise SystemExit(main())
