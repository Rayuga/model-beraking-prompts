#!/usr/bin/env python3
"""Harbor verifier for the MedCare Appointments task.

Runs after the agent phase. Starts the app on port 3000, resets the database,
then runs RewardKit against tests/rubric/browser: a claude-code CUA judge that
drives the UI (including live Stripe Checkout) through Playwright MCP. The
verifier grades the observable workflow only — it never calls the app's API
directly, so it never depends on guessing endpoint paths the submission
happens to choose.

Writes:
  /logs/verifier/reward.json  — numeric metrics only (Harbor requirement).
                                Includes `browser_passed`/`browser_total`
                                (parsed from RewardKit's reward-details.json,
                                since `rewardkit`'s own reward.json is just a
                                single aggregate score), `graded` (RewardKit
                                produced a real verdict), and `no_op` (the
                                submission never reached an operable state at
                                all — no package.json, a failed install, or
                                the app never served a single page — so the
                                browser judge could not perform a single
                                operation against it). `graded` and `no_op`
                                are independent: a judge/infra failure
                                against an app that did come up is graded=0,
                                no_op=0.
  /logs/verifier/reward.txt   — the single float reward (Harbor fallback)
  /logs/verifier/report.json  — full audit trail
  /logs/verifier/app-source/  — the graded submission's own source, minus
                                node_modules, so the app behind a score can
                                still be read and re-run after the container
                                is gone
"""
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
# Prefer localhost so Stripe success_url matches the rubric
# ("returned to MedCare on localhost:3000"). 127.0.0.1 also reaches the
# app, but a mismatch makes the post-Checkout assert fail even when payment
# and appointment creation succeeded.
BASE_URL = os.environ.get("BASE_URL") or os.environ.get("APP_PUBLIC_URL") or f"http://localhost:{PORT}"
if "127.0.0.1" in BASE_URL:
    BASE_URL = BASE_URL.replace("127.0.0.1", "localhost")
LOG_DIR = Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier"))
SCREENSHOTS_DIR = LOG_DIR / "screenshots"
# Lives under the verifier log dir (not /logs/artifacts/) so Harbor's default
# log download picks it up without needing a separate --artifact flag.
APP_SOURCE_DIR = LOG_DIR / "app-source"
TESTS_DIR = Path(__file__).resolve().parent

HEALTH_TIMEOUT_SEC = 90.0
DEFAULT_START_COMMAND = "npm start"
_START_BLOCK_RE = re.compile(r"```bash start\s*\n(.*?)```", re.DOTALL)

# Directories are created at the top of main() so the placeholder reward file
# can be written immediately after, surviving a SIGKILL.


def log(msg: str) -> None:
    print(f"[verifier] {msg}", flush=True)


def _run(cmd, **kw) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd, capture_output=True, text=True,
        encoding="utf-8", errors="replace", **kw,
    )


def _app_pid_file() -> Path:
    return LOG_DIR / "app.pid"


def _read_managed_pid() -> int | None:
    try:
        raw = _app_pid_file().read_text(encoding="utf-8").strip()
        pid = int(raw)
        return pid if pid > 0 else None
    except Exception:
        return None


def _clear_app_pid_file() -> None:
    try:
        _app_pid_file().unlink(missing_ok=True)
    except Exception:
        pass


def _stop_process_group(pid: int, *, wait_sec: float = 5.0) -> None:
    """Stop one process group — never sweep unrelated node processes."""
    if pid <= 0:
        return
    try:
        if hasattr(os, "killpg") and hasattr(os, "getpgid"):
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            except ProcessLookupError:
                return
            except OSError:
                try:
                    os.kill(pid, signal.SIGTERM)
                except ProcessLookupError:
                    return
        else:
            os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    except Exception:
        pass

    deadline = time.time() + wait_sec
    while time.time() < deadline:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return
        except Exception:
            break
        time.sleep(0.2)

    try:
        if hasattr(os, "killpg") and hasattr(os, "getpgid"):
            try:
                os.killpg(os.getpgid(pid), signal.SIGKILL)
            except ProcessLookupError:
                return
            except OSError:
                os.kill(pid, signal.SIGKILL)
        else:
            os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    except Exception:
        pass


def stop_managed_app() -> None:
    """Stop the app recorded in app.pid from a prior verifier run, if any."""
    pid = _read_managed_pid()
    if pid is not None:
        log(f"stopping prior managed app pid={pid}")
        _stop_process_group(pid)
    _clear_app_pid_file()
    time.sleep(0.3)


def _port_in_use() -> bool | None:
    """Return True if PORT is listening, False if free, None if unknown."""
    for cmd in (
        ["ss", "-ltn"],
        ["netstat", "-an"],
        ["lsof", "-nP", f"-iTCP:{PORT}", "-sTCP:LISTEN"],
    ):
        try:
            r = _run(cmd)
        except FileNotFoundError:
            continue
        if r.returncode != 0:
            continue
        out = r.stdout or ""
        if cmd[0] == "lsof":
            return bool(out.strip())
        # ss/netstat: look for LISTEN on our port
        if f":{PORT} " in out or f".{PORT} " in out or f":{PORT}\n" in out:
            return True
        return False
    return None


def wait_port_free(timeout: float = 15.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        in_use = _port_in_use()
        if in_use is False:
            return True
        if in_use is None:
            # No port-inspection tool available (rare); proceed optimistically.
            return True
        time.sleep(0.4)
    return False


def find_app_root() -> Path:
    candidates = [APP_DIR]
    try:
        for child in sorted(APP_DIR.iterdir()):
            if child.is_dir():
                candidates.append(child)
    except Exception:
        pass
    for c in candidates:
        if (c / "package.json").is_file() and (c / "src").is_dir():
            return c
    for c in candidates:
        if (c / "package.json").is_file():
            return c
    return APP_DIR


def _find_manifest(app_root: Path) -> Path | None:
    for cand in (app_root / "APP_MANIFEST.md", APP_DIR / "APP_MANIFEST.md"):
        if cand.is_file():
            return cand
    return None


def start_command_from_manifest(app_root: Path) -> str:
    manifest = _find_manifest(app_root)
    if manifest is None:
        return DEFAULT_START_COMMAND
    m = _START_BLOCK_RE.search(manifest.read_text(encoding="utf-8", errors="replace"))
    if not m:
        # Also accept a plain ```bash fence that looks like a start command
        plain = re.search(r"```bash\s*\n(.*?)```", manifest.read_text(encoding="utf-8", errors="replace"), re.DOTALL)
        if plain:
            cmd = " ".join(
                line.strip() for line in plain.group(1).strip().splitlines()
                if line.strip() and not line.strip().startswith("cd ")
            )
            if "npm" in cmd or "node" in cmd:
                return cmd or DEFAULT_START_COMMAND
        log("APP_MANIFEST.md declares no start block — using default start command")
        return DEFAULT_START_COMMAND
    cmd = " ".join(line.strip() for line in m.group(1).strip().splitlines() if line.strip())
    return cmd or DEFAULT_START_COMMAND


def snapshot_app_source(app_root: Path) -> None:
    """Copy the submission's own source into the verifier log dir.

    Harbor deletes the container once a run ends and downloads only /logs, so
    without this the app that produced the score is unrecoverable: there is no
    way to re-run a submission, or to read the code behind a failing check,
    after the fact. `node_modules` is left out because it would dwarf the rest
    of the log bundle and `package.json` reproduces it.
    """
    try:
        if APP_SOURCE_DIR.exists():
            shutil.rmtree(APP_SOURCE_DIR)
        shutil.copytree(
            app_root, APP_SOURCE_DIR,
            ignore=shutil.ignore_patterns(
                "node_modules", ".git", "*.db", "*.sqlite", "*.sqlite3",
                "*-journal", "*-wal", "*-shm", "*.log",
            ),
            symlinks=False, ignore_dangling_symlinks=True,
        )
        n = sum(1 for p in APP_SOURCE_DIR.rglob("*") if p.is_file())
        log(f"snapshotted {n} source files -> {APP_SOURCE_DIR}")
    except Exception as exc:
        # Never fatal: a missing snapshot costs a post-mortem, a raised
        # exception here would cost the whole grading run.
        log(f"could not snapshot app source: {exc}")


_DB_EXTS = (".db", ".sqlite", ".sqlite3")
_WIPE_MAX_DEPTH = 4
_WIPE_SKIP_DIRS = {"node_modules", ".git"}


def _is_db_filename(name: str) -> bool:
    return (name.endswith(_DB_EXTS) or name.startswith("app.db")
            or "-journal" in name or "-wal" in name or "-shm" in name)


def wipe_db(app_root: Path, *, max_depth: int = _WIPE_MAX_DEPTH) -> None:
    """Remove SQLite files anywhere under app_root, not just the top level.

    The previous version only looked in app_root and app_root/data. A
    submission that stores its database somewhere else nested (e.g. src/data/,
    storage/db/) would carry agent-era rows into the graded run undetected —
    a paid-booking cascade rubric like this one would then grade against
    stale state. Bounded depth keeps this from wandering arbitrarily far into
    a large tree; node_modules/.git are skipped by name since they are never
    where an app keeps its own database.
    """
    def _walk(dir_: Path, depth: int) -> None:
        if depth > max_depth:
            return
        try:
            entries = list(dir_.iterdir())
        except Exception:
            return
        for entry in entries:
            if entry.is_dir():
                if entry.name in _WIPE_SKIP_DIRS:
                    continue
                _walk(entry, depth + 1)
            elif entry.is_file() and _is_db_filename(entry.name):
                try:
                    entry.unlink()
                except Exception:
                    pass

    _walk(app_root, 0)


def _deps_look_complete(app_root: Path) -> bool:
    """True when node_modules holds every package the submission's own package.json declares.

    The previous check only asked "does node_modules exist" — true the moment
    /opt/medcare-deps (express + stripe) was copied in, even for a submission
    that declares a third dependency the seed doesn't cover. That submission
    would then fail to boot on a missing module and score 0 for a reason that
    has nothing to do with what it actually built.
    """
    nm = app_root / "node_modules"
    if not nm.is_dir():
        return False
    try:
        pkg = json.loads((app_root / "package.json").read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return True  # unreadable package.json — don't block install on this check
    for dep in (pkg.get("dependencies") or {}):
        if not (nm / dep / "package.json").is_file():
            return False
    return True


def ensure_node_modules(app_root: Path, *, attempts: int = 3) -> bool:
    """Install the submission's own dependencies — never assume express+stripe are enough.

    Keeps an existing, complete node_modules as-is. Otherwise seeds from the
    image-baked /opt/medcare-deps (network-avoiding for the two packages every
    submission needs) and then always runs an install pass against the
    submission's own package.json, so a submission with extra dependencies
    still gets them. Only a failing install is treated as failure.
    """
    if _deps_look_complete(app_root):
        return True
    nm = app_root / "node_modules"
    pre = Path("/opt/medcare-deps/node_modules")
    if pre.is_dir() and not nm.exists():
        log(f"seeding {nm} from preinstalled node_modules (express, stripe)")
        try:
            shutil.copytree(pre, nm)
        except Exception as exc:
            log(f"could not seed from {pre}: {exc}")
    lock = app_root / "package-lock.json"
    install_cmd = (
        ["npm", "ci", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"]
        if lock.is_file() else
        ["npm", "install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"]
    )
    last_err = ""
    for attempt in range(1, attempts + 1):
        r = _run(install_cmd, cwd=str(app_root))
        (LOG_DIR / "npm-install.log").write_text((r.stdout or "") + (r.stderr or ""))
        if r.returncode == 0 and _deps_look_complete(app_root):
            return True
        last_err = (r.stderr or r.stdout or "")[-800:]
        log(f"{install_cmd[1]} attempt {attempt}/{attempts} failed "
            f"(exit {r.returncode}): {last_err}")
        if attempt < attempts:
            time.sleep(2 * attempt)
    log(f"dependency install failed after {attempts} attempts: {last_err}")
    return False


def start_app(app_root: Path, start_cmd: str) -> subprocess.Popen:
    log(f"starting app: {start_cmd}")
    stdout_f = open(LOG_DIR / "app.stdout.log", "a", buffering=1)
    stderr_f = open(LOG_DIR / "app.stderr.log", "a", buffering=1)
    env = {**os.environ, "PORT": str(PORT), "HOST": "0.0.0.0",
           "APP_PUBLIC_URL": BASE_URL, "BASE_URL": BASE_URL}
    kwargs = {}
    if hasattr(os, "setsid"):
        kwargs["preexec_fn"] = os.setsid
    proc = subprocess.Popen(
        ["bash", "-lc", start_cmd],
        cwd=str(app_root),
        stdout=stdout_f, stderr=stderr_f, env=env,
        **kwargs,
    )
    (LOG_DIR / "app.pid").write_text(str(proc.pid))
    return proc


def stop_app(proc: subprocess.Popen | None) -> None:
    pid = proc.pid if proc is not None else _read_managed_pid()
    if pid is not None:
        _stop_process_group(pid)
    if proc is not None:
        try:
            proc.wait(timeout=1)
        except Exception:
            pass
    _clear_app_pid_file()
    wait_port_free()


def wait_healthy(timeout: float = HEALTH_TIMEOUT_SEC) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/health", timeout=3) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        try:
            with urllib.request.urlopen(f"{BASE_URL}/", timeout=3) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def _rewardkit_command() -> list[str]:
    exe = shutil.which("rewardkit")
    if exe:
        return [exe]
    return [sys.executable, "-m", "rewardkit"]


def _numeric_score(data: dict) -> float:
    if isinstance(data.get("reward"), (int, float)):
        return float(data["reward"])
    nums = [float(v) for v in data.values() if isinstance(v, (int, float))]
    if not nums:
        return 0.0
    return sum(nums) / len(nums)


def _iter_detail_blocks(details: dict | list | None) -> list[tuple[str, dict]]:
    """Normalize reward-details.json into (dimension, block) pairs."""
    if not details:
        return []
    if isinstance(details, list):
        return [(f"block_{i}", b) for i, b in enumerate(details) if isinstance(b, dict)]
    if not isinstance(details, dict):
        return []
    # Single reward object written at the root (rare).
    if "criteria" in details and isinstance(details.get("criteria"), list):
        return [("reward", details)]
    blocks: list[tuple[str, dict]] = []
    for name, block in details.items():
        if isinstance(block, dict) and isinstance(block.get("criteria"), list):
            blocks.append((str(name), block))
        elif isinstance(block, list):
            for i, sub in enumerate(block):
                if isinstance(sub, dict) and isinstance(sub.get("criteria"), list):
                    blocks.append((f"{name}[{i}]", sub))
    return blocks


def _criterion_rows(details: dict | list | None) -> list[dict]:
    rows: list[dict] = []
    for dim, block in _iter_detail_blocks(details):
        for c in block.get("criteria") or []:
            if not isinstance(c, dict):
                continue
            value = c.get("value")
            try:
                value_f = float(value) if value is not None else 0.0
            except (TypeError, ValueError):
                value_f = 0.0
            cid = c.get("id") or c.get("name") or "unnamed"
            passed = value_f > 0.0 and not c.get("error")
            rows.append(
                {
                    "dimension": dim,
                    "id": str(cid),
                    "name": str(c.get("name") or cid),
                    "value": value_f,
                    "weight": float(c.get("weight") or 1.0),
                    "passed": passed,
                    "error": c.get("error"),
                    "reasoning": (c.get("reasoning") or "").strip(),
                    "description": (c.get("description") or "").strip(),
                }
            )
    return rows


def print_rubric_breakdown(phase: str, details: dict | list | None, score: float) -> dict:
    """Print per-criterion pass/fail so Verifier Logs show more than the aggregate.

    Reward Kit only prints the numeric reward to stdout; criterion results live in
    reward-details.json. Harbor's platform Verifier Logs tab shows stdout, so we
    re-emit a readable breakdown here.
    """
    rows = _criterion_rows(details)
    summary = {
        "phase": phase,
        "score": round(float(score), 4),
        "passed": 0,
        "failed": 0,
        "total": len(rows),
        "criteria": rows,
    }
    if not rows:
        log(f"rubric-based [{phase}]: no per-criterion details in reward-details.json")
        print(
            f"[rubric] no criterion breakdown available for phase {phase} "
            f"(aggregate score={score:.3f})",
            flush=True,
        )
        return summary

    print(f"[rubric] --- phase: {phase} ({len(rows)} criteria) ---", flush=True)
    for i, row in enumerate(rows):
        verdict = "pass" if row["passed"] else "fail"
        if row["passed"]:
            summary["passed"] += 1
        else:
            summary["failed"] += 1
        print(
            f"[rubric]   {i:>2}. {verdict:<4} {row['id']}  "
            f"(value={row['value']:.3f}, weight={row['weight']:.1f})",
            flush=True,
        )
        note = row["error"] or row["reasoning"]
        if note:
            one_line = " ".join(str(note).split())
            if len(one_line) > 160:
                one_line = one_line[:157] + "..."
            print(f"[rubric]        {one_line}", flush=True)

    passed = summary["passed"]
    total = summary["total"]
    ratio = (passed / total) if total else 0.0
    print(
        f"[rubric] summary: {passed}/{total} criteria passed "
        f"(binary ratio={ratio:.3f}, rewardkit_score={score:.3f})",
        flush=True,
    )
    log(f"rubric-based [{phase}]: {passed}/{total} = {ratio:.3f} (score={score:.3f})")

    # Also persist a plain-text summary next to reward.json for Artifacts browsers.
    try:
        lines = [
            f"phase={phase}",
            f"rewardkit_score={score:.4f}",
            f"passed={passed}",
            f"failed={summary['failed']}",
            f"total={total}",
            "",
        ]
        for row in rows:
            mark = "PASS" if row["passed"] else "FAIL"
            lines.append(
                f"{mark}\t{row['id']}\tvalue={row['value']:.3f}\tweight={row['weight']:.1f}"
            )
            if row["error"] or row["reasoning"]:
                note = (row["error"] or row["reasoning"]).replace("\n", " ")[:300]
                lines.append(f"\t{note}")
        text = "\n".join(lines) + "\n"
        phase_dir = LOG_DIR / f"rewardkit-{phase}"
        phase_dir.mkdir(parents=True, exist_ok=True)
        (phase_dir / "criteria-summary.txt").write_text(text, encoding="utf-8")
        (LOG_DIR / f"rubric-{phase}-criteria.txt").write_text(text, encoding="utf-8")
        details_src = phase_dir / "reward-details.json"
        if details_src.exists():
            shutil.copy2(details_src, LOG_DIR / "reward-details.json")
    except Exception as exc:
        log(f"warn: could not write criteria summary files: {exc}")

    return summary


def _rewardkit_env() -> dict[str, str]:
    env = {
        **os.environ,
        "PORT": str(PORT),
        "BASE_URL": BASE_URL,
        "APP_PUBLIC_URL": BASE_URL,
        "REWARDKIT_JUDGE": os.environ.get("REWARDKIT_JUDGE", "claude-code"),
        "REWARDKIT_MODEL": os.environ.get("REWARDKIT_MODEL", "anthropic/claude-sonnet-5"),
        "ANTHROPIC_BASE_URL": os.environ.get("ANTHROPIC_BASE_URL", "https://openrouter.ai/api"),
        "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": os.environ.get(
            "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY", "1"
        ),
    }
    if "ANTHROPIC_AUTH_TOKEN" not in env and env.get("OPENROUTER_API_KEY"):
        env["ANTHROPIC_AUTH_TOKEN"] = env["OPENROUTER_API_KEY"]
    # Claude Code must not fall back to direct Anthropic API auth.
    env["ANTHROPIC_API_KEY"] = os.environ.get("ANTHROPIC_API_KEY", "")
    return env


def run_rewardkit_phase(app_root: Path, phase: str, tests_dir: Path) -> dict:
    log(f"running RewardKit phase {phase}: {tests_dir}")
    phase_dir = LOG_DIR / f"rewardkit-{phase}"
    phase_dir.mkdir(parents=True, exist_ok=True)
    out = phase_dir / "reward.json"
    details = phase_dir / "reward-details.json"
    cmd = [
        *_rewardkit_command(),
        str(tests_dir),
        "--workspace",
        str(app_root),
        "--output",
        str(out),
        "--max-concurrent-agent",
        "1",
        "--max-concurrent-llm",
        "1",
    ]
    timeout_sec = int(os.environ.get("REWARDKIT_TIMEOUT_SEC", "3600"))
    try:
        r = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=_rewardkit_env(),
            timeout=timeout_sec,
        )
    except subprocess.TimeoutExpired as exc:
        stdout = (exc.stdout or "") if isinstance(exc.stdout, str) else ""
        stderr = (exc.stderr or "") if isinstance(exc.stderr, str) else ""
        (phase_dir / "stdout.log").write_text(stdout)
        (phase_dir / "stderr.log").write_text(
            stderr + f"\nRewardKit timed out after {timeout_sec}s\n"
        )
        log(f"RewardKit phase {phase} timed out after {timeout_sec}s")
        return {
            "score": 0.0,
            "exit_code": 124,
            "error": f"RewardKit timed out after {timeout_sec}s",
            "reward_json": None,
            "details": None,
        }

    (phase_dir / "stdout.log").write_text(r.stdout or "")
    (phase_dir / "stderr.log").write_text(r.stderr or "")
    if r.stdout:
        print(r.stdout, end="", flush=True)
    if r.stderr:
        print(r.stderr, end="", flush=True)

    if not out.exists():
        err = (r.stderr or r.stdout or "RewardKit produced no reward.json")[-1200:]
        log(f"RewardKit phase {phase} produced no output (exit={r.returncode})")
        return {
            "score": 0.0,
            "exit_code": r.returncode,
            "error": err,
            "reward_json": None,
            "details": None,
        }

    try:
        data = json.loads(out.read_text())
    except Exception as exc:
        log(f"RewardKit phase {phase} output unreadable: {exc}")
        return {
            "score": 0.0,
            "exit_code": r.returncode,
            "error": f"output unreadable: {exc}",
            "reward_json": None,
            "details": None,
        }

    details_data = None
    if details.exists():
        try:
            details_data = json.loads(details.read_text())
        except Exception:
            details_data = None

    score = max(0.0, min(1.0, _numeric_score(data)))
    criteria_summary = print_rubric_breakdown(phase, details_data, score)
    # Top-level passed/total (not just nested in criteria_summary) so
    # write_reward() can populate browser_passed/browser_total the same way
    # regardless of which task's verifier produced this dict.
    passed = criteria_summary.get("passed", 0)
    total = criteria_summary.get("total", 0)
    log(f"RewardKit phase {phase}: score={score:.3f} exit={r.returncode}"
        + (f" ({passed}/{total} criteria passed)" if total else ""))
    return {
        "score": score,
        "passed": passed,
        "total": total,
        "exit_code": r.returncode,
        "reward_json": data,
        "details": details_data,
        "criteria_summary": criteria_summary,
        "error": None if r.returncode == 0 else (r.stderr or "")[-1200:],
    }


def write_reward(final: float, report: dict) -> None:
    browser = report.get("reward_breakdown", {}).get("browser", {}) or {}
    reward_json = {
        "reward": float(final),
        "browser_score": float(browser.get("score", 0.0)),
        "browser_passed": int(browser.get("passed", 0)),
        "browser_total": int(browser.get("total", 0)),
        # Default False, not True: every early-exit branch below sets
        # `graded` explicitly, so a caller that forgets to set it should
        # read as ungraded rather than silently reporting a clean pass.
        "graded": int(bool(report.get("graded", False))),
        # True only when the submission never reached an operable state at
        # all (no package.json, a failed install, or the app never served a
        # single page) — distinct from `graded`, which can be False for a
        # judge/infra failure against an app that *did* come up.
        "no_op": int(bool(report.get("no_op", False))),
    }
    (LOG_DIR / "reward.json").write_text(json.dumps(reward_json, indent=2))
    (LOG_DIR / "reward.txt").write_text(f"{float(final)}\n")
    (LOG_DIR / "report.json").write_text(json.dumps(report, indent=2, default=str))


def main() -> int:
    # ------------------------------------------------------------------ #
    # 1. Ensure log directories exist — done first so every subsequent    #
    #    helper that opens a file under LOG_DIR can succeed.              #
    # ------------------------------------------------------------------ #
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        print(f"[verifier] FATAL: cannot create log dir {LOG_DIR}: {exc}", flush=True)
        return 1

    # ------------------------------------------------------------------ #
    # 2. Write a placeholder 0.0 reward immediately — overwritten with    #
    #    the real score at the end, but survives SIGKILL or an unhandled  #
    #    exception before write_reward() is reached.                      #
    # ------------------------------------------------------------------ #
    try:
        (LOG_DIR / "reward.txt").write_text("0.0\n")
        (LOG_DIR / "reward.json").write_text(
            json.dumps({
                "reward": 0.0,
                "browser_score": 0.0,
                "graded": 0,
                "no_op": 1,
                "error": "verifier did not complete",
            }) + "\n"
        )
    except Exception:
        pass

    # ------------------------------------------------------------------ #
    # 3. Main body — always writes a real reward on every exit path.      #
    # ------------------------------------------------------------------ #
    try:
        app_root = find_app_root()
        log(f"APP_DIR={APP_DIR} app_root={app_root}")

        if not (app_root / "package.json").is_file():
            log(f"FAIL: no package.json in {app_root}")
            write_reward(0.0, {"taskId": "webdev/medcare-appointments", "reward": 0.0,
                               "graded": False, "no_op": True,
                               "error": f"no package.json in {app_root}",
                               "reward_breakdown": {}})
            return 0

        # Before anything below mutates the tree — wiping the database,
        # installing dependencies — capture what was actually delivered,
        # which is the only copy that outlives the container.
        snapshot_app_source(app_root)

        stop_managed_app()
        wait_port_free()
        wipe_db(app_root)

        if not ensure_node_modules(app_root):
            write_reward(0.0, {"taskId": "webdev/medcare-appointments", "reward": 0.0,
                               "graded": False, "no_op": True,
                               "error": "npm install / node_modules failed",
                               "reward_breakdown": {}})
            return 0

        start_cmd = start_command_from_manifest(app_root)
        proc = start_app(app_root, start_cmd)
        browser: dict = {"score": 0.0, "error": "not run"}
        # True only when the app never served a single page — the browser
        # judge could not perform a single operation against it, as opposed
        # to coming up and then failing criteria on the merits.
        no_op = False
        try:
            if not wait_healthy():
                stderr_tail = ""
                try:
                    stderr_tail = (LOG_DIR / "app.stderr.log").read_text(
                        encoding="utf-8", errors="replace")[-1200:]
                except Exception:
                    pass
                log(f"FAIL: app never became healthy within {HEALTH_TIMEOUT_SEC:.0f}s")
                if stderr_tail.strip():
                    log(f"app.stderr.log (tail):\n{stderr_tail}")
                no_op = True
                browser = {
                    "score": 0.0,
                    "error": "app unhealthy after start" + (
                        " — see app.stderr.log" if stderr_tail.strip() else ""
                    ),
                }
            else:
                browser = run_rewardkit_phase(
                    app_root, "browser", TESTS_DIR / "rubric" / "browser"
                )
        finally:
            stop_app(proc)

        final = max(0.0, min(1.0, float(browser.get("score", 0.0))))
        graded = not browser.get("error")

        report = {
            "taskId": "webdev/medcare-appointments",
            "reward": round(final, 4),
            "graded": graded,
            "no_op": no_op,
            "start_command": start_cmd,
            "reward_breakdown": {
                "formula": "browser",
                "browser": browser,
            },
            "criteria": (browser.get("criteria_summary") or {}).get("criteria", []),
            "criteria_passed": (browser.get("criteria_summary") or {}).get("passed"),
            "criteria_failed": (browser.get("criteria_summary") or {}).get("failed"),
            "criteria_total": (browser.get("criteria_summary") or {}).get("total"),
        }
        write_reward(final, report)
        log(f"final reward: {final:.4f}  "
            f"(browser {browser.get('passed', 0)}/{browser.get('total', 0)}="
            f"{float(browser.get('score', 0.0)):.3f}, graded={graded}, no_op={no_op})")
        return 0

    except BaseException as exc:
        msg = f"{type(exc).__name__}: {exc}"
        log(f"UNHANDLED EXCEPTION in verifier: {msg}")
        try:
            write_reward(0.0, {
                "taskId": "webdev/medcare-appointments",
                "reward": 0.0,
                "graded": False,
                "no_op": True,
                "error": msg,
                "reward_breakdown": {},
            })
        except Exception:
            pass
        if isinstance(exc, (SystemExit, KeyboardInterrupt)):
            raise
        raise SystemExit(1) from exc


if __name__ == "__main__":
    raise SystemExit(main())
