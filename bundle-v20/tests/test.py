#!/usr/bin/env python3
"""Harbor verifier for the GearVault Enterprise task.

Runs after the agent phase. Starts the app on port 3000, resets the database,
then runs RewardKit twice — against tests/rubric/pricing and tests/rubric/browser —
with a claude-code CUA judge that drives the UI (including live Stripe Checkout)
through Playwright MCP. Splitting the journey does two things: it decouples the
pricing score from the payment hand-off, and it gives each judge session a fresh
context budget for a smaller slice of work. The
verifier itself does not call the app's HTTP API directly; the RewardKit CUA
judge drives the UI and also replays forged in-page fetch requests to prove
server-side enforcement without depending on a fixed route map.

Writes:
  /logs/verifier/reward.json  — numeric metrics only (Harbor requirement).
                                Grading runs in TWO independently-scored phases
                                against one shop Postgres:
                                  reward = 0.15 * pricing + 0.85 * browser
                                `pricing` grades the surface, the seeded catalog
                                and the money pipeline and pays for nothing, so a
                                correct pricing implementation is rewarded even
                                when the Stripe journey later fails. `browser`
                                grades the paid journey, the gates, the counter,
                                damage and isolation.
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
# ("returned to GearVault on localhost:3000"). 127.0.0.1 also reaches the
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

# Phase weights, set proportional to each phase's share of criterion weight.
# The pricing phase carries 10.0 of the rubric's 65.5 total weight (15.3%) across
# 7 of its 43 criteria, so it takes ~0.15 of the reward and the journey phase
# takes most of the rest. An earlier revision gave pricing 0.30 — double its
# share — as extra insurance against cascade. Proportional is the more neutral
# rule and is what a reviewer recomputing the split would expect to find.
#
# DURABILITY is its own phase because it can only be graded after the app process
# has been stopped and started again. It re-reads what the journey established
# and asserts it survived. An app that kept its books in process memory looks
# perfect for two phases and then loses everything here — which is precisely the
# distinction worth 0.20 of the reward.
#
# The anti-cascade protection that motivated the split survives this change: a
# submission whose money pipeline is correct but whose Stripe hand-off fails
# still banks 0.15, against ~0.03 under the single-phase rubric this replaced.
# That was the point — not the size of the number, but that it is not zero.
PRICING_WEIGHT = 0.15
BROWSER_WEIGHT = 0.65
DURABILITY_WEIGHT = 0.20

HEALTH_TIMEOUT_SEC = 90.0
# Let the port and any child processes settle before starting the app again.
RESTART_SETTLE_SEC = 3.0
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
            r = _run(cmd, timeout=5)
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


# APP_MANIFEST.md is authored by the graded submission and is then executed by
# the verifier, so it is an untrusted-input path into the grading container.
# Accept only the shapes that are actually a start command. Anything else falls
# back to `npm start` rather than being run.
_SAFE_START_RE = re.compile(
    r"""^(?:
          npm\ start
        | npm\ run\ [A-Za-z0-9:._-]+
        | npm\ run\ [A-Za-z0-9:._-]+\ --
        | node\ [A-Za-z0-9._/-]+\.[cm]?js
        | node\ --[A-Za-z0-9=._-]+\ [A-Za-z0-9._/-]+\.[cm]?js
      )$""",
    re.VERBOSE,
)


def _sanitize_start_command(cmd: str) -> str:
    """Return cmd if it is a recognised start command, else the default.

    Rejects shell metacharacters outright: a manifest is a declaration of how to
    boot the app, never a place to chain commands. The verifier environment holds
    the judge credentials, so a submission must not be able to run arbitrary
    shell here just by writing a fenced block.
    """
    cmd = " ".join(cmd.split())
    if not cmd:
        return DEFAULT_START_COMMAND
    if any(ch in cmd for ch in ";|&$`><\n\\"):
        log(f"APP_MANIFEST.md start command rejected (shell metacharacters): {cmd!r}")
        return DEFAULT_START_COMMAND
    if not _SAFE_START_RE.match(cmd):
        log(f"APP_MANIFEST.md start command rejected (unrecognised form): {cmd!r}")
        return DEFAULT_START_COMMAND
    return cmd


def start_command_from_manifest(app_root: Path) -> str:
    manifest = _find_manifest(app_root)
    if manifest is None:
        return DEFAULT_START_COMMAND
    text = manifest.read_text(encoding="utf-8", errors="replace")
    m = _START_BLOCK_RE.search(text)
    if not m:
        # Also accept a plain ```bash fence that looks like a start command
        plain = re.search(r"```bash\s*\n(.*?)```", text, re.DOTALL)
        if plain:
            cmd = " ".join(
                line.strip() for line in plain.group(1).strip().splitlines()
                if line.strip() and not line.strip().startswith("cd ")
            )
            if "npm" in cmd or "node" in cmd:
                return _sanitize_start_command(cmd)
        log("APP_MANIFEST.md declares no start block — using default start command")
        return DEFAULT_START_COMMAND
    cmd = " ".join(line.strip() for line in m.group(1).strip().splitlines() if line.strip())
    return _sanitize_start_command(cmd)


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
    wipe_postgres()


def wipe_postgres() -> None:
    """Reset the shop Postgres schema so the app re-seeds on start."""
    try:
        r = _run(
            ["psql", DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-c",
             "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"],
            timeout=20,
        )
        if r.returncode == 0:
            log("wiped shop Postgres public schema")
        else:
            log(f"postgres wipe skipped: {(r.stderr or r.stdout or '')[-200:]}")
    except Exception as exc:
        log(f"postgres wipe skipped: {exc}")


def start_postgres() -> None:
    if POSTGRES_START.is_file():
        log(f"starting shop Postgres: {POSTGRES_START}")
        try:
            r = _run(["bash", str(POSTGRES_START)], timeout=40)
            if r.returncode != 0:
                log(f"postgres start script: {(r.stderr or r.stdout or '')[-400:]}")
        except Exception as exc:
            log(f"postgres start script failed: {exc}")
    deadline = time.time() + 25
    while time.time() < deadline:
        try:
            r = _run(["pg_isready", "-h", "127.0.0.1", "-p", "5432"], timeout=3)
            if r.returncode == 0:
                log("shop Postgres ready")
                return
        except Exception:
            pass
        time.sleep(0.4)
    log("shop Postgres did not become ready")


def _deps_look_complete(app_root: Path) -> bool:
    """True when node_modules holds every package the submission's own package.json declares.

    The previous check only asked "does node_modules exist" — true the moment
    /opt/gearvault-deps (express + stripe) was copied in, even for a submission
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
    image-baked /opt/gearvault-deps (network-avoiding for the two packages every
    submission needs) and then always runs an install pass against the
    submission's own package.json, so a submission with extra dependencies
    still gets them. Only a failing install is treated as failure.
    """
    if _deps_look_complete(app_root):
        return True
    nm = app_root / "node_modules"
    pre = Path("/opt/gearvault-deps/node_modules")
    if pre.is_dir() and not nm.exists():
        log(f"seeding {nm} from preinstalled node_modules (express, stripe)")
        try:
            shutil.copytree(pre, nm)
        except Exception as exc:
            log(f"could not seed from {pre}: {exc}")
    lock = app_root / "package-lock.json"
    install_cmd = (
        ["npm", "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"]
        if lock.is_file() else
        ["npm", "install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"]
    )
    last_err = ""
    for attempt in range(1, attempts + 1):
        try:
            r = _run(install_cmd, cwd=str(app_root), timeout=180)
        except subprocess.TimeoutExpired as exc:
            last_err = f"npm timed out after 180s: {exc}"
            log(f"{install_cmd[1]} attempt {attempt}/{attempts} failed: {last_err}")
            if attempt < attempts:
                time.sleep(2 * attempt)
            continue
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


VENDOR_PORT = int(os.environ.get("VENDOR_PORT", "3101"))
VENDOR_SCRIPT = Path(os.environ.get("VENDOR_SCRIPT", "/opt/gearvault-vendors/server.js"))
POSTGRES_START = Path(os.environ.get("POSTGRES_START", "/opt/gearvault-postgres/start.sh"))
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgres://gearvault:gearvault@127.0.0.1:5432/gearvault"
)


def start_vendors() -> subprocess.Popen | None:
    if not VENDOR_SCRIPT.is_file():
        log(f"vendor desks missing at {VENDOR_SCRIPT}")
        return None
    log(f"starting vendor desks: {VENDOR_SCRIPT}")
    stdout_f = open(LOG_DIR / "vendors.stdout.log", "a", buffering=1)
    stderr_f = open(LOG_DIR / "vendors.stderr.log", "a", buffering=1)
    env = {**os.environ, "VENDOR_PORT": str(VENDOR_PORT)}
    kwargs = {}
    if hasattr(os, "setsid"):
        kwargs["preexec_fn"] = os.setsid
    proc = subprocess.Popen(
        ["node", str(VENDOR_SCRIPT)],
        stdout=stdout_f, stderr=stderr_f, env=env,
        **kwargs,
    )
    (LOG_DIR / "vendors.pid").write_text(str(proc.pid))
    deadline = time.time() + 20
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{VENDOR_PORT}/health", timeout=1) as resp:
                if resp.status == 200:
                    log("vendor desks healthy")
                    return proc
        except Exception:
            time.sleep(0.25)
    log("vendor desks did not become healthy")
    return proc


def stop_vendors(proc: subprocess.Popen | None) -> None:
    if proc is None:
        return
    _stop_process_group(proc.pid)
    try:
        proc.wait(timeout=2)
    except Exception:
        pass


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


_UNREACHED_HINTS = (
    "not tested", "never tested", "never got", "never reached", "not reached",
    "could not be exercised", "could not even be exercised", "could not be run",
    "was never", "never executed", "never attempted", "blocked before",
    "foreclos", "precondition", "no longer reachable", "not reachable",
    "before this criterion", "destroyed", "unable to probe", "did not get to",
)
_OBSERVED_HINTS = (
    "returned 200", "returned 201", "returned 4", "returned 5", "status 200",
    "wrongly succeeded", "was accepted", "succeeded", "leaked", "instead of",
    "should have been refused", "was not refused", "no bind", "missing",
    "reads literally", "does not", "did not", "gap", "bypass",
)


def _infer_failure_kind(reasoning: str) -> str:
    """Best-effort label when the judge omitted its required prefix.

    Diagnosis only — the reward never depends on this. Prefer `unreached` on a tie:
    calling a stalled run an observed defect is the more misleading of the two errors,
    because it reads as evidence the submission is broken when it may be untested.
    """
    if not reasoning:
        return "unknown"
    low = reasoning.lower()
    if any(h in low for h in _UNREACHED_HINTS):
        return "unreached"
    if any(h in low for h in _OBSERVED_HINTS):
        return "observed"
    return "unknown"


def _numeric_score(data: dict) -> float | None:
    """The reward RewardKit reported, or None if it did not report one.

    Deliberately NOT a mean over whatever numbers happen to be in the dict. A
    schema change or a partial write would make that fallback return a
    plausible-looking float that nothing downstream could distinguish from a
    real score, silently poisoning a batch. Absent `reward` is an
    infrastructure failure and is surfaced as one (graded=False), not scored.
    """
    reward = data.get("reward")
    if isinstance(reward, bool) or not isinstance(reward, (int, float)):
        return None
    return float(reward)


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
            reasoning_raw = (c.get("reasoning") or "").strip()
            # The judge prefixes its reasoning so an unreached criterion is
            # distinguishable from one it probed and saw fail. Both score zero;
            # only the diagnosis differs. Anything unprefixed is left "unknown"
            # rather than guessed at.
            if passed:
                failure_kind = ""
            elif reasoning_raw.upper().startswith("UNREACHED"):
                failure_kind = "unreached"
            elif reasoning_raw.upper().startswith("OBSERVED-FAIL"):
                failure_kind = "observed"
            else:
                # The judge is asked for an explicit prefix, but it does not always
                # comply, and a report where every failure reads "unclassified" is
                # useless for triage. Fall back to the language the reasoning actually
                # uses. This never changes a score — only the diagnosis label.
                failure_kind = _infer_failure_kind(reasoning_raw)
            rows.append(
                {
                    "dimension": dim,
                    "id": str(cid),
                    "name": str(c.get("name") or cid),
                    "value": value_f,
                    "weight": float(c.get("weight") or 1.0),
                    "passed": passed,
                    "failure_kind": failure_kind,
                    "error": c.get("error"),
                    "reasoning": reasoning_raw,
                    "description": (c.get("description") or "").strip(),
                }
            )
    return rows


# ---------------------------------------------------------------------------
# Feature and gate scoring
#
# See tests/rubric/features.toml. Criteria are grouped into features; some are
# gates. A gate failure zeroes its whole feature rather than costing only its own
# weight, because a submission must not be able to average away an authorization
# bypass by passing twenty cosmetic checks.
#
# With every criterion passing this is exactly a weighted mean, so the reference
# solution is unaffected.
# ---------------------------------------------------------------------------
def _load_features(phase: str) -> list[dict]:
    path = TESTS_DIR / "rubric" / "features.toml"
    if not path.exists():
        return []
    try:
        import tomllib
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except Exception as error:
        log(f"features.toml unreadable ({error}) — falling back to plain weighted mean")
        return []
    return [f for f in data.get("feature", []) if f.get("phase") == phase]


def apply_gates(phase: str, rows: list[dict]) -> tuple[float | None, list[dict]]:
    """Return (phase score, per-feature detail) or (None, []) if unmapped.

    Returns None when the feature map does not cover this phase's criteria, so
    the caller keeps RewardKit's own score rather than inventing one.
    """
    features = _load_features(phase)
    if not features:
        return None, []
    by_id = {r["id"]: r for r in rows}
    mapped = {cid for f in features for cid in f.get("criteria", [])}
    unmapped = sorted(set(by_id) - mapped)
    missing = sorted(mapped - set(by_id))
    if unmapped or missing:
        log(f"features.toml does not match phase {phase} "
            f"(unmapped={unmapped}, missing={missing}) — plain weighted mean")
        return None, []

    detail: list[dict] = []
    total_w = 0.0
    earned = 0.0
    for f in features:
        cids = f["criteria"]
        gates = [g for g in f.get("gates", []) if g in by_id]
        f_weight = sum(float(by_id[c].get("weight") or 0.0) for c in cids)
        got = sum(float(by_id[c].get("weight") or 0.0) for c in cids if by_id[c]["passed"])
        failed_gates = [g for g in gates if not by_id[g]["passed"]]
        raw = (got / f_weight) if f_weight else 0.0
        score = 0.0 if failed_gates else raw
        detail.append({
            "feature": f["name"],
            "weight": round(f_weight, 3),
            "score": round(score, 4),
            "score_before_gates": round(raw, 4),
            "failed_gates": failed_gates,
            "criteria_passed": sum(1 for c in cids if by_id[c]["passed"]),
            "criteria_total": len(cids),
        })
        total_w += f_weight
        earned += score * f_weight
        if failed_gates:
            log(f"[{phase}] GATE FAILED in {f['name']!r}: {', '.join(failed_gates)} "
                f"-> feature scores 0.0 (was {raw:.3f})")
    return (earned / total_w if total_w else 0.0), detail


def print_rubric_breakdown(phase: str, details: dict | list | None, score: float) -> dict:
    """Print per-criterion pass/fail so Verifier Logs show more than the aggregate.

    Reward Kit only prints the numeric reward to stdout; criterion results live in
    reward-details.json. Harbor's platform Verifier Logs tab shows stdout, so we
    re-emit a readable breakdown here.
    """
    rows = _criterion_rows(details)
    gated_score, features = apply_gates(phase, rows)
    effective = float(score) if gated_score is None else float(gated_score)

    summary = {
        "phase": phase,
        "score": round(effective, 4),
        "score_rewardkit": round(float(score), 4),
        "features": features,
        "passed": 0,
        "failed": 0,
        "total": len(rows),
        # Split the failures so a run blocked early is distinguishable from a
        # run that was fully probed and got things wrong. Both score the same;
        # only one of them tells you the submission is bad.
        "failed_observed": sum(1 for r in rows if r.get("failure_kind") == "observed"),
        "failed_unreached": sum(1 for r in rows if r.get("failure_kind") == "unreached"),
        "failed_unclassified": sum(1 for r in rows if r.get("failure_kind") == "unknown"),
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
    if features:
        print(f"[rubric] features ({phase}):", flush=True)
        for f in features:
            flag = f"  GATE FAILED: {', '.join(f['failed_gates'])}" if f["failed_gates"] else ""
            print(f"[rubric]   {f['feature']:<48} "
                  f"{f['criteria_passed']}/{f['criteria_total']} "
                  f"score={f['score']:.3f} (w={f['weight']}){flag}", flush=True)
    print(
        f"[rubric] summary: {passed}/{total} criteria passed "
        f"(binary ratio={ratio:.3f}, rewardkit_score={score:.3f}, "
        f"gated_score={effective:.3f}; "
        f"failures: {summary['failed_observed']} observed, "
        f"{summary['failed_unreached']} unreached, "
        f"{summary['failed_unclassified']} unclassified)",
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

    raw = _numeric_score(data)
    if raw is None:
        log(f"RewardKit phase {phase}: no numeric `reward` in output — infra failure")
        return {
            "score": 0.0,
            "exit_code": r.returncode,
            "error": "RewardKit output carried no numeric `reward` field",
            "reward_json": data,
            "details": details_data,
        }
    score = max(0.0, min(1.0, raw))
    criteria_summary = print_rubric_breakdown(phase, details_data, score)
    # The gate map may have zeroed one or more features. That verdict, not
    # RewardKit's plain weighted mean, is this phase's score.
    score = float(criteria_summary.get("score", score))
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
    breakdown = report.get("reward_breakdown", {}) or {}
    browser = breakdown.get("browser", {}) or {}
    pricing = breakdown.get("pricing", {}) or {}
    durability = breakdown.get("durability", {}) or {}
    reward_json = {
        "reward": float(final),
        "pricing_score": float(pricing.get("score", 0.0)),
        "pricing_passed": int(pricing.get("passed", 0)),
        "pricing_total": int(pricing.get("total", 0)),
        "browser_score": float(browser.get("score", 0.0)),
        "browser_passed": int(browser.get("passed", 0)),
        "browser_total": int(browser.get("total", 0)),
        "durability_score": float(durability.get("score", 0.0)),
        "durability_passed": int(durability.get("passed", 0)),
        "durability_total": int(durability.get("total", 0)),
        # 1 when the app failed to come back up at all after the restart.
        "restart_failed": int(bool(durability.get("restart_failed"))),
        # How many whole features were disqualified by a gate failure. Non-zero
        # means the submission failed something the authoring guide calls
        # unshippable — an authorization bypass, a double charge, a lost ledger.
        "features_gated_out": int(sum(
            1
            for ph in (pricing, browser, durability)
            for f in ((ph.get("criteria_summary") or {}).get("features") or [])
            if f.get("failed_gates")
        )),
        # Failure diagnosis, not score. `observed` means the judge probed the
        # criterion and the app was wrong; `unreached` means it never got to ask.
        # Both contribute zero, but only the first says the submission is bad.
        "failed_observed": int(report.get("criteria_failed_observed", 0) or 0),
        "failed_unreached": int(report.get("criteria_failed_unreached", 0) or 0),
        "failed_unclassified": int(report.get("criteria_failed_unclassified", 0) or 0),
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
            write_reward(0.0, {"taskId": "webdev/gearvault-enterprise", "reward": 0.0,
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
        start_postgres()
        wipe_db(app_root)

        if not ensure_node_modules(app_root):
            write_reward(0.0, {"taskId": "webdev/gearvault-enterprise", "reward": 0.0,
                               "graded": False, "no_op": True,
                               "error": "npm install / node_modules failed",
                               "reward_breakdown": {}})
            return 0

        start_cmd = start_command_from_manifest(app_root)
        vendor_proc = None
        vendor_proc = start_vendors()
        proc = start_app(app_root, start_cmd)
        pricing: dict = {"score": 0.0, "error": "not run"}
        browser: dict = {"score": 0.0, "error": "not run"}
        durability: dict = {"score": 0.0, "error": "not run"}
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
                # Two independently-scored phases against the same shop Postgres.
                # `pricing` pays for nothing, so it leaves the ledger clean for
                # `browser`. Scoring them separately is what stops one fumbled
                # Stripe hand-off from zeroing a correct pricing pipeline: a
                # submission that gets the money right banks PRICING_WEIGHT of
                # the reward whether or not the journey ever gets off the ground.
                pricing = run_rewardkit_phase(
                    app_root, "pricing", TESTS_DIR / "rubric" / "pricing"
                )
                browser = run_rewardkit_phase(
                    app_root, "browser", TESTS_DIR / "rubric" / "browser"
                )

                # ---- The restart. ----
                # Stop the app and start it again against the SAME Postgres, then
                # grade what survived. Nothing else changes between the phases, so
                # anything missing afterwards was never durably stored.
                log("restarting app for the durability phase")
                stop_app(proc)
                proc = None
                time.sleep(RESTART_SETTLE_SEC)
                proc = start_app(app_root, start_cmd)
                if not wait_healthy():
                    # The app did not come back. That is itself the durability
                    # failure this phase grades, so score it 0 rather than
                    # calling the whole run ungraded — the journey phases were
                    # graded fine and their scores stand.
                    log("app did not come back after restart — durability scores 0")
                    durability = {
                        "score": 0.0,
                        "exit_code": None,
                        "error": None,
                        "restart_failed": True,
                        "criteria_summary": {
                            "phase": "durability", "score": 0.0, "passed": 0,
                            "failed": 0, "total": 0, "failed_observed": 0,
                            "failed_unreached": 0, "failed_unclassified": 0,
                            "criteria": [],
                        },
                    }
                else:
                    log("app healthy after restart")
                    durability = run_rewardkit_phase(
                        app_root, "durability", TESTS_DIR / "rubric" / "durability"
                    )
        finally:
            stop_app(proc)
            stop_vendors(vendor_proc)

        p_score = max(0.0, min(1.0, float(pricing.get("score", 0.0))))
        b_score = max(0.0, min(1.0, float(browser.get("score", 0.0))))
        d_score = max(0.0, min(1.0, float(durability.get("score", 0.0))))
        final = max(0.0, min(1.0, PRICING_WEIGHT * p_score
                                  + BROWSER_WEIGHT * b_score
                                  + DURABILITY_WEIGHT * d_score))
        # A phase that errored produced no verdict at all. Saying graded=True
        # would present an infrastructure failure as a model score of 0.
        # An app that failed to RESTART is different: that is a real durability
        # failure the phase exists to catch, so it scores 0 and stays graded.
        graded = (not pricing.get("error")
                  and not browser.get("error")
                  and not durability.get("error"))

        def _sum(key: str) -> int:
            return sum(int((ph.get("criteria_summary") or {}).get(key) or 0)
                       for ph in (pricing, browser, durability))

        report = {
            "taskId": "webdev/gearvault-enterprise",
            "reward": round(final, 4),
            "graded": graded,
            "no_op": no_op,
            "start_command": start_cmd,
            "reward_breakdown": {
                "formula": (f"{PRICING_WEIGHT} * pricing + {BROWSER_WEIGHT} * browser"
                            f" + {DURABILITY_WEIGHT} * durability"),
                "pricing": pricing,
                "browser": browser,
                "durability": durability,
            },
            "criteria": ((pricing.get("criteria_summary") or {}).get("criteria", [])
                         + (browser.get("criteria_summary") or {}).get("criteria", [])
                         + (durability.get("criteria_summary") or {}).get("criteria", [])),
            "criteria_passed": _sum("passed"),
            "criteria_failed": _sum("failed"),
            "criteria_total": _sum("total"),
            "criteria_failed_observed": _sum("failed_observed"),
            "criteria_failed_unreached": _sum("failed_unreached"),
            "criteria_failed_unclassified": _sum("failed_unclassified"),
        }
        write_reward(final, report)
        log(f"final reward: {final:.4f}  "
            f"(pricing {pricing.get('passed', 0)}/{pricing.get('total', 0)}"
            f"={p_score:.3f} x{PRICING_WEIGHT}, "
            f"browser {browser.get('passed', 0)}/{browser.get('total', 0)}"
            f"={b_score:.3f} x{BROWSER_WEIGHT}, "
            f"durability {durability.get('passed', 0)}/{durability.get('total', 0)}"
            f"={d_score:.3f} x{DURABILITY_WEIGHT}, graded={graded}, no_op={no_op})")
        log(f"failures: {report['criteria_failed_observed']} observed, "
            f"{report['criteria_failed_unreached']} unreached, "
            f"{report['criteria_failed_unclassified']} unclassified")
        return 0

    except BaseException as exc:
        msg = f"{type(exc).__name__}: {exc}"
        log(f"UNHANDLED EXCEPTION in verifier: {msg}")
        try:
            write_reward(0.0, {
                "taskId": "webdev/gearvault-enterprise",
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
