#!/usr/bin/env python3
from __future__ import annotations

import json
import hashlib
import os
import re
import shutil
import signal
import sqlite3
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
BROWSER_WEIGHT_TOTAL = 18.5
PREFLIGHT_WEIGHT = 0.5
EVIDENCE_TOKENS = {
    "custom_editor_no_native_editing_surface": ["Northwind API Incident Report", "line 1226", "ALPHA-0600", "OMEGA-END-ANCHOR", "CUSTOM-SURFACE-PROOF"],
    "noop_save_revision_invariant": [],
    "edit_save_reload_and_dirty_discard": ["BASIC-SAVE-CHECK", "UNSAVED-SHOULD-DISAPPEAR"],
    "keyboard_navigation_exact_coordinates": ["line 5 column 1", "line 5 column 9", "line 6 column 59", "line 1226 column 63"],
    "word_navigation_and_selection_shortcuts": ["line 1 column 1", "line 1 column 11", "line 1 column 21", "Northwind"],
    "backspace_delete_exact_line_join": ["JOIN-LEFTJOIN-RIGHT", "JOIN-TAIL", "Backspace", "Delete"],
    "tab_indentation_and_reversal": ["Timeline", "Tab", "Shift Tab", "Undo", "Redo"],
    "selection_real_mouse_word_line_range_keyboard": ["Timeline", "Customer impact", "Checkout requests", "DONE"],
    "selection_autoscroll_exact_offscreen_range": ["ALPHA-0010", "ALPHA-0060", "mouse", "keyboard"],
    "clipboard_external_multiline_internal_exact": ["EXTERNAL-A", "EXTERNAL-B", "EXTERNAL-C"],
    "undo_separate_locations_and_redo_invalidation": ["LOCATION-ONE", "LOCATION-TWO", "LOCATION-THREE", "REDO-CLEAR-ORIGINAL", "REDO-CLEAR-NEW"],
    "undo_paste_cut_atomic": ["PASTE-A", "PASTE-B", "PASTE-C", "Undo", "Redo"],
    "undo_typed_selection_replacement_atomic": ["Timeline", "REPLACE-ATOMIC", "Undo", "Redo"],
    "find_replace_exact_counts_and_offsets": ["TODO", "3", "FOLLOWUP", "ALPHA-00", "99", "INCIDENT-MARKER-00"],
    "keyboard_find_focus_and_cycle": ["TODO", "line 18", "line 19", "Escape"],
    "long_document_three_region_round_trip": ["TOP-ROUNDTRIP", "MID-ROUNDTRIP", "TAIL-ROUNDTRIP"],
    "revision_history_preview_restore_undo_exact": ["REVISION-HISTORY-A", "REVISION-HISTORY-B"],
    "two_tab_chained_stale_save_conflicts": ["TAB-A-WINS", "TAB-B-STALE", "TAB-B-REBASSED", "TAB-A-STALE-SECOND", "conflict"],
    "multi_caret_full_typing_single_undo": ["TimelineMULTI", "Customer impactMULTI", "Action itemsMULTI", "Undo", "Redo"],
    "multi_caret_backspace_delete_sibling": ["Timelin", "Customer impac", "Action item", "imeline", "ustomer impact", "ction items"],
    "direct_api_save_rejection_nonmutation_matrix": ["API-CURRENT-WINS", "FORGED-STALE-OVERWRITE", "409"],
}
DISALLOWED_PASS_PHRASES = ("verified previously", "per prior session", "summarized context")


def log(msg: str) -> None:
    print(f"[verifier] {msg}", flush=True)


def run(cmd, **kwargs) -> subprocess.CompletedProcess:
    kwargs.setdefault("timeout", 600)
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kwargs)


def write_reward(final: float, report: dict) -> None:
    browser = report.get("reward_breakdown", {}).get("browser", {}) or {}
    preflight = report.get("reward_breakdown", {}).get("preflight", {}) or {}
    reward_json = {
        "reward": float(final),
        "browser_score": float(browser.get("score", 0.0)),
        "browser_criteria_passed": int(browser.get("passed", 0)),
        "browser_criteria_total": int(browser.get("total", 0)),
        "browser_passed_weight": float(browser.get("passed_weight", 0.0)),
        "browser_total_weight": float(browser.get("total_weight", 0.0)),
        "preflight_passed": int(bool(preflight.get("passed", False))),
        "preflight_weight": float(PREFLIGHT_WEIGHT),
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


def manifest_contract(app_root: Path) -> dict:
    manifest = app_root / "APP_MANIFEST.md"
    result = {"passed": False, "manifest": str(manifest), "start_command": None, "database_path": None, "routes": []}
    if not manifest.is_file():
        result["error"] = "APP_MANIFEST.md is missing beside package.json"
        return result
    text = manifest.read_text(encoding="utf-8", errors="replace")
    start_match = START_BLOCK_RE.search(text)
    db_matches = re.findall(r"`([^`\r\n]+\.(?:db|sqlite|sqlite3))`", text, flags=re.IGNORECASE)
    routes = re.findall(r"\b(?:GET|POST|PUT|PATCH|DELETE)\b[\s|]*`?(/[^\s`|]+)", text, flags=re.IGNORECASE)
    if not start_match or not start_match.group(1).strip():
        result["error"] = "APP_MANIFEST.md has no non-empty fenced bash start block"
        return result
    if not db_matches:
        result["error"] = "APP_MANIFEST.md does not declare a SQLite database path"
        return result
    if len(set(routes)) < 3:
        result["error"] = "APP_MANIFEST.md does not list the main API routes"
        return result
    declared_text = db_matches[0]
    declared = Path(declared_text)
    if declared_text.startswith("/app/"):
        database_path = app_root.joinpath(*declared_text.removeprefix("/app/").split("/"))
    elif declared.is_absolute():
        database_path = declared
    else:
        database_path = app_root / declared
    result.update({
        "passed": True,
        "start_command": " ".join(line.strip() for line in start_match.group(1).splitlines() if line.strip()),
        "database_path": str(database_path),
        "routes": sorted(set(routes)),
    })
    return result


def inspect_sqlite(database_path: Path) -> dict:
    if not database_path.is_file():
        raise FileNotFoundError(f"declared database does not exist: {database_path}")
    connection = sqlite3.connect(f"file:{database_path}?mode=ro", uri=True)
    try:
        tables = [row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )]
        logical = {}
        text_values = []
        for table in tables:
            quoted = '"' + table.replace('"', '""') + '"'
            columns = [row[1] for row in connection.execute(f"PRAGMA table_info({quoted})")]
            rows = []
            for raw_row in connection.execute(f"SELECT * FROM {quoted}"):
                row = []
                for value in raw_row:
                    if isinstance(value, bytes):
                        value = {"bytes": value.hex()}
                    elif isinstance(value, str):
                        text_values.append(value)
                    row.append(value)
                rows.append(row)
            logical[table] = {"columns": columns, "rows": rows}
        encoded = json.dumps(logical, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        return {
            "digest": hashlib.sha256(encoded).hexdigest(),
            "tables": {name: len(value["rows"]) for name, value in logical.items()},
            "logical": logical,
            "text_values": text_values,
        }
    finally:
        connection.close()


def finish_preflight(manifest: dict, before: dict, after: dict) -> dict:
    restart_unchanged = before["digest"] == after["digest"] and before["tables"] == after["tables"]
    database_nonempty = bool(before["tables"]) and sum(before["tables"].values()) > 0
    return {
        "passed": bool(manifest.get("passed") and database_nonempty and restart_unchanged),
        "weight": PREFLIGHT_WEIGHT,
        "manifest": manifest,
        "database_nonempty": database_nonempty,
        "restart_unchanged": restart_unchanged,
        "database_digest_before": before["digest"],
        "database_digest_after": after["digest"],
        "table_rows_before": before["tables"],
        "table_rows_after": after["tables"],
    }


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


def clear_app_port() -> None:
    fuser = shutil.which("fuser")
    if not fuser:
        return
    subprocess.run(
        [fuser, "-k", f"{PORT}/tcp"],
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )
    time.sleep(0.3)


def start_app(app_root: Path, command: str) -> subprocess.Popen:
    clear_app_port()
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


def wait_healthy(proc: subprocess.Popen | None = None) -> bool:
    deadline = time.time() + HEALTH_TIMEOUT_SEC
    while time.time() < deadline:
        if proc is not None and proc.poll() is not None:
            return False
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


def criterion_weights() -> dict[str, float]:
    try:
        import tomllib
        rubric = tomllib.loads((TESTS_DIR / "rubric" / "browser" / "browser.toml").read_text(encoding="utf-8"))
        return {str(item.get("id")): float(item.get("weight", 1.0)) for item in rubric.get("criterion", [])}
    except Exception:
        return {}


def criteria_rows(details):
    rows = []
    weights = criterion_weights()
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
            criterion_id = c.get("id") or c.get("name")
            reasoning = str(c.get("reasoning") or "")
            passed = value > 0 and not c.get("error")
            normalized = " " + re.sub(r"[^a-z0-9]+", " ", reasoning.lower()).strip() + " "
            normalized = re.sub(r"\bln\b", "line", normalized)
            normalized = re.sub(r"\bcol\b", "column", normalized)
            missing_evidence = []
            if passed:
                for token in EVIDENCE_TOKENS.get(str(criterion_id), []):
                    normalized_token = re.sub(r"[^a-z0-9]+", " ", token.lower()).strip()
                    if f" {normalized_token} " not in normalized:
                        missing_evidence.append(token)
                if any(phrase in reasoning.lower() for phrase in DISALLOWED_PASS_PHRASES):
                    missing_evidence.append("fresh in-criterion evidence")
                if criterion_id == "direct_api_save_rejection_nonmutation_matrix" and any(
                    phrase in reasoning.lower() for phrase in ("inadvertently", "repaired", "restored the original")
                ):
                    missing_evidence.append("no post-probe repair")
            passed = passed and not missing_evidence
            rows.append({
                "id": criterion_id,
                "value": value,
                "weight": weights.get(str(criterion_id), float(c.get("weight", 1.0))),
                "passed": passed,
                "error": c.get("error"),
                "reasoning": reasoning,
                "missing_evidence": missing_evidence,
            })
    return rows


def preserve_judge_transcripts(phase_dir: Path, started_at: float) -> dict:
    destination = phase_dir / "judge-transcripts"
    copied = []
    roots = {Path.home() / ".claude" / "projects", Path("/root/.claude/projects")}
    for root in roots:
        if not root.is_dir():
            continue
        for source in root.rglob("*.jsonl"):
            try:
                if source.stat().st_mtime < started_at - 5:
                    continue
                relative = source.relative_to(root)
                target = destination / root.name / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
                copied.append(str(target.relative_to(phase_dir)))
            except Exception as exc:
                log(f"could not preserve judge transcript {source}: {exc}")
    index = {"started_at_epoch": started_at, "files": sorted(copied)}
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    return index


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
    started_at = time.time()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", env=rewardkit_env(), timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        (phase_dir / "stdout.log").write_text(exc.stdout or "", encoding="utf-8")
        (phase_dir / "stderr.log").write_text((exc.stderr or "") + f"\nRewardKit timed out after {timeout}s\n", encoding="utf-8")
        transcripts = preserve_judge_transcripts(phase_dir, started_at)
        return {"score": 0.0, "error": "RewardKit timed out", "passed": 0, "total": 0, "passed_weight": 0.0, "total_weight": BROWSER_WEIGHT_TOTAL, "transcripts": transcripts}
    transcripts = preserve_judge_transcripts(phase_dir, started_at)
    (phase_dir / "stdout.log").write_text(result.stdout or "", encoding="utf-8")
    (phase_dir / "stderr.log").write_text(result.stderr or "", encoding="utf-8")
    if result.stdout:
        print(result.stdout, end="", flush=True)
    if result.stderr:
        print(result.stderr, end="", flush=True)
    if not out.exists():
        return {"score": 0.0, "error": (result.stderr or result.stdout or "RewardKit produced no reward")[-1000:], "passed": 0, "total": 0, "passed_weight": 0.0, "total_weight": BROWSER_WEIGHT_TOTAL, "transcripts": transcripts}
    data = json.loads(out.read_text(encoding="utf-8"))
    details = json.loads(details_path.read_text(encoding="utf-8")) if details_path.exists() else None
    rows = criteria_rows(details)
    passed = sum(1 for row in rows if row["passed"])
    passed_weight = sum(row["weight"] for row in rows if row["passed"])
    total_weight = sum(row["weight"] for row in rows) or BROWSER_WEIGHT_TOTAL
    for i, row in enumerate(rows):
        verdict = "pass" if row["passed"] else "fail"
        evidence_note = f" missing_evidence={row['missing_evidence']}" if row["missing_evidence"] else ""
        print(f"[rubric] {i:02d}. {verdict} {row['id']} value={row['value']}{evidence_note}", flush=True)
    judge_score = max(0.0, min(1.0, numeric_score(data)))
    score = passed_weight / total_weight if total_weight else 0.0
    return {
        "score": score,
        "passed": passed,
        "total": len(rows),
        "passed_weight": passed_weight,
        "total_weight": total_weight,
        "reward_json": data,
        "judge_score_before_evidence_gate": judge_score,
        "evidence_gate_failures": [
            {"id": row["id"], "missing": row["missing_evidence"]}
            for row in rows if row["missing_evidence"]
        ],
        "details": details,
        "transcripts": transcripts,
        "error": None if result.returncode == 0 else (result.stderr or "")[-1000:],
    }


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
        manifest = manifest_contract(app_root)
        proc = start_app(app_root, command)
        browser = {"score": 0.0, "error": "not run", "passed": 0, "total": 0, "passed_weight": 0.0, "total_weight": BROWSER_WEIGHT_TOTAL}
        preflight = {"passed": False, "weight": PREFLIGHT_WEIGHT, "error": "not run"}
        no_op = False
        try:
            if not wait_healthy(proc):
                no_op = True
                browser = {"score": 0.0, "error": "app unhealthy", "passed": 0, "total": 0, "passed_weight": 0.0, "total_weight": BROWSER_WEIGHT_TOTAL}
            else:
                if not manifest.get("passed"):
                    raise RuntimeError(manifest.get("error") or "APP_MANIFEST.md contract failed")
                database_path = Path(manifest["database_path"])
                before_restart = inspect_sqlite(database_path)
                stop_app(proc)
                proc = start_app(app_root, command)
                if not wait_healthy(proc):
                    raise RuntimeError("app was unhealthy after the idempotency restart")
                after_restart = inspect_sqlite(database_path)
                preflight = finish_preflight(manifest, before_restart, after_restart)
                browser = run_rewardkit(app_root)
        finally:
            stop_app(proc)
        browser_weight = float(browser.get("score", 0.0)) * BROWSER_WEIGHT_TOTAL
        preflight_weight = PREFLIGHT_WEIGHT if preflight.get("passed") else 0.0
        final = (browser_weight + preflight_weight) / (BROWSER_WEIGHT_TOTAL + PREFLIGHT_WEIGHT)
        report = {
            "taskId": "webdev/patchpad-editor",
            "reward": round(final, 4),
            "graded": not browser.get("error"),
            "no_op": no_op,
            "start_command": command,
            "reward_breakdown": {
            "formula": "(browser_score * 18.5 + preflight_passed * 0.5) / 19.0",
                "preflight": preflight,
                "browser": browser,
            },
        }
        write_reward(final, report)
        log(f"final reward: {final:.4f} ({browser.get('passed', 0)}/{browser.get('total', 0)} browser criteria; preflight={preflight.get('passed', False)})")
        return 0
    except BaseException as exc:
        write_reward(0.0, {"taskId": "webdev/patchpad-editor", "reward": 0.0, "graded": False, "no_op": True, "error": f"{type(exc).__name__}: {exc}", "reward_breakdown": {}})
        if isinstance(exc, (SystemExit, KeyboardInterrupt)):
            raise
        raise


if __name__ == "__main__":
    raise SystemExit(main())
