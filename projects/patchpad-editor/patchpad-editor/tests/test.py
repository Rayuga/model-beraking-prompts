#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import signal
import subprocess
import sys
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
if "127.0.0.1" in BASE_URL:
    BASE_URL = BASE_URL.replace("127.0.0.1", "localhost")
LOG_DIR = Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier"))
TESTS_DIR = Path(__file__).resolve().parent
APP_SOURCE_DIR = LOG_DIR / "app-source"
HEALTH_TIMEOUT_SEC = 90.0
DEFAULT_START_COMMAND = "npm start"
START_BLOCK_RE = re.compile(r"```bash start\s*\n(.*?)```", re.DOTALL)


def log(msg: str) -> None:
    print(f"[verifier] {msg}", flush=True)


def run(cmd, **kwargs) -> subprocess.CompletedProcess:
    kwargs.setdefault("timeout", 600)
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kwargs)


def write_reward(final: float, report: dict) -> None:
    browser = report.get("reward_breakdown", {}).get("browser", {}) or {}
    reward_json = {
        "reward": float(final),
        "browser_score": float(browser.get("score", 0.0)),
        "browser_passed": int(browser.get("passed", 0)),
        "browser_total": int(browser.get("total", 0)),
        "graded": int(bool(report.get("graded", False))),
        "no_op": int(bool(report.get("no_op", False))),
    }
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    (LOG_DIR / "reward.json").write_text(json.dumps(reward_json, indent=2), encoding="utf-8")
    (LOG_DIR / "reward.txt").write_text(f"{float(final)}\n", encoding="utf-8")
    (LOG_DIR / "report.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")


def find_app_root() -> Path:
    candidates = [APP_DIR]
    try:
        candidates += [p for p in sorted(APP_DIR.iterdir()) if p.is_dir()]
    except Exception:
        pass
    for candidate in candidates:
        if (candidate / "package.json").is_file():
            return candidate
    return APP_DIR


def start_command(app_root: Path) -> str:
    for manifest in (app_root / "APP_MANIFEST.md", APP_DIR / "APP_MANIFEST.md"):
        if manifest.is_file():
            text = manifest.read_text(encoding="utf-8", errors="replace")
            match = START_BLOCK_RE.search(text)
            if match:
                return " ".join(line.strip() for line in match.group(1).splitlines() if line.strip()) or DEFAULT_START_COMMAND
    return DEFAULT_START_COMMAND


def snapshot_app_source(app_root: Path) -> None:
    try:
        if APP_SOURCE_DIR.exists():
            shutil.rmtree(APP_SOURCE_DIR)
        shutil.copytree(
            app_root,
            APP_SOURCE_DIR,
            ignore=shutil.ignore_patterns("node_modules", ".git", "*.db", "*.sqlite", "*.sqlite3", "*-wal", "*-shm", "*.log"),
        )
    except Exception as exc:
        log(f"could not snapshot app source: {exc}")


def wipe_db(app_root: Path) -> None:
    for path in app_root.rglob("*"):
        if "node_modules" in path.parts or ".git" in path.parts:
            continue
        if path.is_file() and (path.name.endswith((".db", ".sqlite", ".sqlite3")) or "-wal" in path.name or "-shm" in path.name):
            try:
                path.unlink()
            except Exception:
                pass


def deps_complete(app_root: Path) -> bool:
    nm = app_root / "node_modules"
    if not nm.is_dir():
        return False
    try:
        pkg = json.loads((app_root / "package.json").read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return True
    return all((nm / dep / "package.json").is_file() for dep in (pkg.get("dependencies") or {}))


def ensure_deps(app_root: Path) -> bool:
    if deps_complete(app_root):
        return True
    pre = Path("/opt/patchpad-deps/node_modules")
    nm = app_root / "node_modules"
    if pre.is_dir() and not nm.exists():
        shutil.copytree(pre, nm)
    cmd = ["npm", "ci", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"] if (app_root / "package-lock.json").is_file() else ["npm", "install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"]
    for attempt in range(1, 4):
        result = run(cmd, cwd=str(app_root))
        (LOG_DIR / "npm-install.log").write_text((result.stdout or "") + (result.stderr or ""), encoding="utf-8")
        if result.returncode == 0 and deps_complete(app_root):
            return True
        log(f"dependency install attempt {attempt}/3 failed: {(result.stderr or result.stdout)[-600:]}")
        time.sleep(attempt * 2)
    return False


def start_app(app_root: Path, command: str) -> subprocess.Popen:
    stdout = open(LOG_DIR / "app.stdout.log", "a", encoding="utf-8", errors="replace", buffering=1)
    stderr = open(LOG_DIR / "app.stderr.log", "a", encoding="utf-8", errors="replace", buffering=1)
    env = {**os.environ, "PORT": str(PORT), "HOST": "0.0.0.0", "BASE_URL": BASE_URL, "APP_PUBLIC_URL": BASE_URL}
    kwargs = {"preexec_fn": os.setsid} if hasattr(os, "setsid") else {}
    proc = subprocess.Popen(["bash", "-lc", command], cwd=str(app_root), stdout=stdout, stderr=stderr, env=env, **kwargs)
    (LOG_DIR / "app.pid").write_text(str(proc.pid), encoding="utf-8")
    return proc


def stop_app(proc: subprocess.Popen | None) -> None:
    if proc is None:
        return
    try:
        if hasattr(os, "killpg"):
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        else:
            proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        try:
            if hasattr(os, "killpg"):
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            else:
                proc.kill()
        except Exception:
            pass


def wait_healthy() -> bool:
    deadline = time.time() + HEALTH_TIMEOUT_SEC
    while time.time() < deadline:
        for url in (f"{BASE_URL}/health", f"{BASE_URL}/"):
            try:
                with urllib.request.urlopen(url, timeout=3) as response:
                    if response.status == 200:
                        return True
            except Exception:
                pass
        time.sleep(0.5)
    return False


def rewardkit_command() -> list[str]:
    exe = shutil.which("rewardkit")
    return [exe] if exe else [sys.executable, "-m", "rewardkit"]


def rewardkit_env() -> dict[str, str]:
    env = {
        **os.environ,
        "PORT": str(PORT),
        "BASE_URL": BASE_URL,
        "APP_PUBLIC_URL": BASE_URL,
        "REWARDKIT_JUDGE": os.environ.get("REWARDKIT_JUDGE", "claude-code"),
        "REWARDKIT_MODEL": os.environ.get("REWARDKIT_MODEL", "anthropic/claude-sonnet-5"),
        "ANTHROPIC_BASE_URL": os.environ.get("ANTHROPIC_BASE_URL", "https://openrouter.ai/api"),
        "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": os.environ.get("CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY", "1"),
        "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
    }
    if "ANTHROPIC_AUTH_TOKEN" not in env and env.get("OPENROUTER_API_KEY"):
        env["ANTHROPIC_AUTH_TOKEN"] = env["OPENROUTER_API_KEY"]
    return env


def numeric_score(data: dict) -> float:
    if isinstance(data.get("reward"), (int, float)):
        return float(data["reward"])
    nums = [float(v) for v in data.values() if isinstance(v, (int, float))]
    return sum(nums) / len(nums) if nums else 0.0


def criteria_rows(details):
    rows = []
    if isinstance(details, dict):
        blocks = [details] if isinstance(details.get("criteria"), list) else [v for v in details.values() if isinstance(v, dict) and isinstance(v.get("criteria"), list)]
    elif isinstance(details, list):
        blocks = [v for v in details if isinstance(v, dict) and isinstance(v.get("criteria"), list)]
    else:
        blocks = []
    for block in blocks:
        for c in block.get("criteria") or []:
            value = c.get("value") or 0
            try:
                value = float(value)
            except Exception:
                value = 0
            rows.append({"id": c.get("id") or c.get("name"), "value": value, "passed": value > 0 and not c.get("error"), "error": c.get("error"), "reasoning": c.get("reasoning")})
    return rows


def run_rewardkit(app_root: Path) -> dict:
    phase_dir = LOG_DIR / "rewardkit-browser"
    phase_dir.mkdir(parents=True, exist_ok=True)
    out = phase_dir / "reward.json"
    details_path = phase_dir / "reward-details.json"
    cmd = [
        *rewardkit_command(),
        str(TESTS_DIR / "rubric" / "browser"),
        "--workspace", str(app_root),
        "--output", str(out),
        "--max-concurrent-agent", "1",
        "--max-concurrent-llm", "1",
    ]
    timeout = int(os.environ.get("REWARDKIT_TIMEOUT_SEC", "3600"))
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", env=rewardkit_env(), timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        (phase_dir / "stdout.log").write_text(exc.stdout or "", encoding="utf-8")
        (phase_dir / "stderr.log").write_text((exc.stderr or "") + f"\nRewardKit timed out after {timeout}s\n", encoding="utf-8")
        return {"score": 0.0, "error": "RewardKit timed out", "passed": 0, "total": 0}
    (phase_dir / "stdout.log").write_text(result.stdout or "", encoding="utf-8")
    (phase_dir / "stderr.log").write_text(result.stderr or "", encoding="utf-8")
    if result.stdout:
        print(result.stdout, end="", flush=True)
    if result.stderr:
        print(result.stderr, end="", flush=True)
    if not out.exists():
        return {"score": 0.0, "error": (result.stderr or result.stdout or "RewardKit produced no reward")[-1000:], "passed": 0, "total": 0}
    data = json.loads(out.read_text(encoding="utf-8"))
    details = json.loads(details_path.read_text(encoding="utf-8")) if details_path.exists() else None
    rows = criteria_rows(details)
    passed = sum(1 for row in rows if row["passed"])
    for i, row in enumerate(rows):
        verdict = "pass" if row["passed"] else "fail"
        print(f"[rubric] {i:02d}. {verdict} {row['id']} value={row['value']}", flush=True)
    score = max(0.0, min(1.0, numeric_score(data)))
    return {"score": score, "passed": passed, "total": len(rows), "reward_json": data, "details": details, "error": None if result.returncode == 0 else (result.stderr or "")[-1000:]}


def main() -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    write_reward(0.0, {"taskId": "webdev/patchpad-editor", "reward": 0.0, "graded": False, "no_op": True, "error": "verifier did not complete", "reward_breakdown": {}})
    try:
        app_root = find_app_root()
        log(f"app_root={app_root}")
        if not (app_root / "package.json").is_file():
            write_reward(0.0, {"taskId": "webdev/patchpad-editor", "reward": 0.0, "graded": False, "no_op": True, "error": "no package.json", "reward_breakdown": {}})
            return 0
        snapshot_app_source(app_root)
        wipe_db(app_root)
        if not ensure_deps(app_root):
            write_reward(0.0, {"taskId": "webdev/patchpad-editor", "reward": 0.0, "graded": False, "no_op": True, "error": "dependency install failed", "reward_breakdown": {}})
            return 0
        command = start_command(app_root)
        proc = start_app(app_root, command)
        browser = {"score": 0.0, "error": "not run", "passed": 0, "total": 0}
        no_op = False
        try:
            if not wait_healthy():
                no_op = True
                browser = {"score": 0.0, "error": "app unhealthy", "passed": 0, "total": 0}
            else:
                browser = run_rewardkit(app_root)
        finally:
            stop_app(proc)
        final = float(browser.get("score", 0.0))
        report = {
            "taskId": "webdev/patchpad-editor",
            "reward": round(final, 4),
            "graded": not browser.get("error"),
            "no_op": no_op,
            "start_command": command,
            "reward_breakdown": {"formula": "browser", "browser": browser},
        }
        write_reward(final, report)
        log(f"final reward: {final:.4f} ({browser.get('passed', 0)}/{browser.get('total', 0)} criteria)")
        return 0
    except BaseException as exc:
        write_reward(0.0, {"taskId": "webdev/patchpad-editor", "reward": 0.0, "graded": False, "no_op": True, "error": f"{type(exc).__name__}: {exc}", "reward_breakdown": {}})
        if isinstance(exc, (SystemExit, KeyboardInterrupt)):
            raise
        raise


if __name__ == "__main__":
    raise SystemExit(main())
