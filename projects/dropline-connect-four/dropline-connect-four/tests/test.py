#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import signal
import subprocess
import time
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from playwright.sync_api import Browser, Page, sync_playwright


APP_DIR = Path(os.environ.get("APP_DIR", "/app"))
PORT = int(os.environ.get("PORT", "3000"))
BASE_URL = os.environ.get("BASE_URL") or f"http://localhost:{PORT}"
LOG_DIR = Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier"))
START_BLOCK_RE = re.compile(r"```bash start\s*\n(.*?)```", re.DOTALL)
CHROMIUM = os.environ.get("CHROMIUM_BIN") or shutil.which("chromium")
APP_UID = int(os.environ.get("APP_RUNNER_UID", "10001"))
APP_GID = int(os.environ.get("APP_RUNNER_GID", "10001"))

SEQUENCES = {
    "horizontal": [1, 7, 2, 7, 3, 6, 4],
    "vertical": [1, 2, 1, 2, 1, 2, 1],
    "rising diagonal": [1, 2, 2, 3, 4, 3, 3, 4, 5, 4, 4],
    "falling diagonal": [7, 6, 6, 5, 4, 5, 5, 4, 3, 4, 4],
    "draw": [
        4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 5, 2, 5, 6, 5, 5,
        5, 5, 2, 2, 2, 2, 2, 6, 1, 6, 6, 6, 6, 1, 1, 1, 1, 1,
        7, 7, 7, 7, 7, 7,
    ],
}


@dataclass
class CheckResult:
    name: str
    status: str
    duration: int
    message: str = ""


def log(message: str) -> None:
    print(f"[verifier] {message}", flush=True)


def app_root() -> Path:
    candidates = [APP_DIR]
    if APP_DIR.is_dir():
        candidates.extend(path for path in APP_DIR.iterdir() if path.is_dir())
    return next((path for path in candidates if (path / "package.json").is_file()), APP_DIR)


def run(command: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(
        command, capture_output=True, text=True, encoding="utf-8", errors="replace", **kwargs
    )


def ensure_dependencies(root: Path) -> None:
    if (root / "node_modules").is_dir():
        return
    baked = Path("/opt/dropline-deps/node_modules")
    if baked.is_dir():
        shutil.copytree(baked, root / "node_modules")
        return
    command = [
        "npm.cmd" if os.name == "nt" else "npm",
        "ci" if (root / "package-lock.json").is_file() else "install",
        "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund",
    ]
    result = run(command, cwd=root, timeout=600)
    (LOG_DIR / "npm-install.log").write_text(
        (result.stdout or "") + (result.stderr or ""), encoding="utf-8"
    )
    if result.returncode != 0:
        raise AssertionError("dependency installation failed")


def static_preflight(root: Path) -> None:
    manifest = root / "APP_MANIFEST.md"
    assert manifest.is_file(), "APP_MANIFEST.md is missing"
    match = START_BLOCK_RE.search(manifest.read_text(encoding="utf-8", errors="replace"))
    assert match and match.group(1).strip(), "APP_MANIFEST.md has no fenced bash start block"
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    dependencies = {
        str(name).lower()
        for section in ("dependencies", "devDependencies")
        for name in (package.get(section) or {})
    }
    assert "express" in dependencies, "Express is not declared"
    forbidden = dependencies & {
        "react", "react-dom", "vue", "@angular/core", "svelte",
        "phaser", "pixi.js", "kaboom", "melonjs",
    }
    assert not forbidden, f"disallowed framework dependencies: {sorted(forbidden)}"
    source_files = [
        path for path in root.rglob("*")
        if path.is_file() and "node_modules" not in path.parts
        and path.suffix.lower() in {".html", ".js", ".css"}
    ]
    source = "\n".join(path.read_text(encoding="utf-8", errors="replace") for path in source_files)
    assert not re.search(
        r"(?:src|href)\s*=\s*[\"'](?:https?:)?//|(?:unpkg|jsdelivr|cdnjs|esm\.sh)",
        source,
        re.IGNORECASE,
    ), "runtime CDN or external asset reference found"


def start_command(root: Path) -> str:
    text = (root / "APP_MANIFEST.md").read_text(encoding="utf-8", errors="replace")
    match = START_BLOCK_RE.search(text)
    return " && ".join(line.strip() for line in match.group(1).splitlines() if line.strip())


def demote_app() -> None:
    os.setsid()
    if os.geteuid() == 0:
        os.setgroups([])
        os.setgid(APP_GID)
        os.setuid(APP_UID)


def start_app(root: Path, command: str) -> subprocess.Popen:
    app_home = Path("/tmp/dropline-app")
    app_home.mkdir(parents=True, exist_ok=True)
    if os.name != "nt" and os.geteuid() == 0:
        os.chown(app_home, APP_UID, APP_GID)
    stdout = open(LOG_DIR / "app.stdout.log", "a", encoding="utf-8", buffering=1)
    stderr = open(LOG_DIR / "app.stderr.log", "a", encoding="utf-8", buffering=1)
    environment = {**os.environ, "PORT": str(PORT), "HOST": "0.0.0.0", "HOME": str(app_home)}
    return subprocess.Popen(
        ["bash", "-lc", command] if os.name != "nt" else ["cmd", "/c", command],
        cwd=root,
        stdout=stdout,
        stderr=stderr,
        env=environment,
        preexec_fn=demote_app if os.name != "nt" else None,
    )


def stop_app(process: subprocess.Popen | None) -> None:
    if process is None:
        return
    try:
        if os.name != "nt":
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        else:
            process.terminate()
        process.wait(timeout=5)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass


def request_json(path: str, timeout: float = 3.0) -> tuple[int, dict]:
    with urllib.request.urlopen(f"{BASE_URL}{path}", timeout=timeout) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def wait_for_health() -> None:
    deadline = time.time() + 60
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            status, _ = request_json("/health")
            if status == 200:
                return
        except Exception as exc:
            last_error = exc
        time.sleep(0.25)
    raise AssertionError(f"GET /health did not become ready: {last_error}")


def body_text(page: Page) -> str:
    return page.locator("body").inner_text()


def cell(page: Page, row: int, column: int):
    cells = page.get_by_role("gridcell")
    assert cells.count() == 42, f"expected 42 grid cells, saw {cells.count()}"
    return cells.nth((row - 1) * 7 + column - 1)


def cell_state(page: Page, row: int, column: int) -> str:
    name = cell(page, row, column).get_attribute("aria-label") or ""
    assert re.search(rf"row\s*{row}\D+column\s*{column}", name, re.I), (
        f"cell {row},{column} does not identify its coordinates: {name!r}"
    )
    for state in ("red", "yellow", "empty"):
        if re.search(rf"\b{state}\b", name, re.I):
            return state
    raise AssertionError(f"cell {row},{column} does not identify its state: {name!r}")


def column_button(page: Page, column: int):
    buttons = page.get_by_role("button")
    pattern = re.compile(rf"(?:\bcolumn\s*{column}\b|^\s*{column}\s*$)", re.I)
    for index in range(buttons.count()):
        candidate = buttons.nth(index)
        name = candidate.get_attribute("aria-label") or candidate.inner_text()
        if pattern.search(name or ""):
            return candidate
    raise AssertionError(f"no visible column {column} control")


def action_button(page: Page, label: str):
    locator = page.get_by_role("button", name=re.compile(rf"\b{re.escape(label)}\b", re.I))
    assert locator.count() >= 1, f"missing {label} control"
    return locator.first


def click_moves(page: Page, sequence: list[int]) -> None:
    for move in sequence:
        column_button(page, move).click()


def score(page: Page, label: str) -> int:
    match = re.search(rf"{re.escape(label)}\s*(\d+)", body_text(page), re.I)
    assert match, f"could not read {label} score"
    return int(match.group(1))


def history_entries(page: Page) -> list[tuple[str, int]]:
    return [
        (match.group(1).lower(), int(match.group(2)))
        for match in re.finditer(
            r"\b(Red|Yellow)\b\s*(?:-|:)?\s*column\s*(\d+)\b",
            body_text(page),
            re.I,
        )
    ]


def assert_turn(page: Page, player: str) -> None:
    assert re.search(rf"\b{player}(?:'s)?\s+turn\b", body_text(page), re.I), f"expected {player}'s turn"


def fresh_page(browser: Browser, width: int = 1100, reduced_motion: str = "no-preference"):
    context = browser.new_context(viewport={"width": width, "height": 850}, reduced_motion=reduced_motion)
    page = context.new_page()
    page.goto(BASE_URL, wait_until="networkidle")
    page.get_by_role("grid").wait_for(state="visible")
    return context, page


def check_bootstrap(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        assert "DropLine" in page.title()
        assert page.get_by_role("heading", name="DropLine").count() == 1
        assert page.get_by_role("grid").count() == 1
        assert page.get_by_role("gridcell").count() == 42
        assert all(cell_state(page, row, col) == "empty" for row in range(1, 7) for col in range(1, 8))
        assert all(column_button(page, col).is_visible() for col in range(1, 8))
        assert_turn(page, "Red")
        assert score(page, "Red wins") == score(page, "Yellow wins") == score(page, "Draws") == 0
        assert history_entries(page) == []
        assert action_button(page, "Undo").is_disabled()
        assert action_button(page, "Redo").is_disabled()
        assert action_button(page, "Next Round").is_disabled()
        assert action_button(page, "Reset Match").is_enabled()
    finally:
        context.close()


def check_gravity_turns_and_full_column(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        click_moves(page, [4, 4, 4])
        assert [cell_state(page, row, 4) for row in (6, 5, 4, 3)] == ["red", "yellow", "red", "empty"]
        assert_turn(page, "Yellow")
        assert history_entries(page) == [("red", 4), ("yellow", 4), ("red", 4)]
        action_button(page, "Reset Match").click()
        click_moves(page, [1, 1, 1, 1, 1, 1])
        before = [cell_state(page, row, 1) for row in range(1, 7)]
        column_button(page, 1).click()
        assert [cell_state(page, row, 1) for row in range(1, 7)] == before
        assert len(history_entries(page)) == 6
        assert_turn(page, "Red")
        assert score(page, "Red wins") == score(page, "Yellow wins") == score(page, "Draws") == 0
        assert re.search(r"column\s*1\s+is\s+full|full\s+column", body_text(page), re.I)
    finally:
        context.close()


def winning_markers(page: Page) -> int:
    return page.get_by_role("gridcell").evaluate_all(
        "cells => cells.filter(cell => /winning/i.test(cell.getAttribute('aria-label') || '')).length"
    )


def check_all_win_directions(browser: Browser) -> None:
    for direction in ("horizontal", "vertical", "rising diagonal", "falling diagonal"):
        context, page = fresh_page(browser)
        try:
            click_moves(page, SEQUENCES[direction])
            assert re.search(r"\bRed wins\b", body_text(page), re.I), f"{direction} win not reported"
            assert score(page, "Red wins") == 1, f"{direction} score was not exactly one"
            assert winning_markers(page) == 4, f"{direction} did not identify exactly four winning cells"
        finally:
            context.close()


def check_terminal_lock(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        click_moves(page, SEQUENCES["horizontal"])
        before = [cell_state(page, row, col) for row in range(1, 7) for col in range(1, 8)]
        before_history = history_entries(page)
        target = column_button(page, 5)
        if target.is_enabled():
            target.click()
        else:
            assert all(column_button(page, col).is_disabled() for col in range(1, 8))
        assert [cell_state(page, row, col) for row in range(1, 7) for col in range(1, 8)] == before
        assert history_entries(page) == before_history
        assert score(page, "Red wins") == 1
        assert action_button(page, "Next Round").is_enabled()
    finally:
        context.close()


def check_exact_draw(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        click_moves(page, SEQUENCES["draw"])
        states = [cell_state(page, row, col) for row in range(1, 7) for col in range(1, 8)]
        assert "empty" not in states
        assert len(history_entries(page)) == 42
        assert re.search(r"round\s+drawn|round\s+is\s+a\s+draw|\bdraw\b", body_text(page), re.I)
        assert score(page, "Draws") == 1
        assert score(page, "Red wins") == score(page, "Yellow wins") == 0
        assert winning_markers(page) == 0
    finally:
        context.close()


def check_history_undo_redo_and_branch(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        click_moves(page, [4, 5, 4])
        assert history_entries(page) == [("red", 4), ("yellow", 5), ("red", 4)]
        action_button(page, "Undo").click()
        assert cell_state(page, 5, 4) == "empty" and len(history_entries(page)) == 2
        assert_turn(page, "Red")
        assert action_button(page, "Redo").is_enabled()
        action_button(page, "Redo").click()
        assert cell_state(page, 5, 4) == "red" and len(history_entries(page)) == 3
        assert_turn(page, "Yellow")
        action_button(page, "Undo").click()
        column_button(page, 6).click()
        assert cell_state(page, 6, 6) == "red" and len(history_entries(page)) == 3
        assert action_button(page, "Redo").is_disabled()
    finally:
        context.close()


def check_terminal_undo_redo_scoring(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        click_moves(page, SEQUENCES["horizontal"])
        action_button(page, "Undo").click()
        assert_turn(page, "Red")
        assert score(page, "Red wins") == 0 and len(history_entries(page)) == 6
        assert cell_state(page, 6, 4) == "empty" and winning_markers(page) == 0
        assert action_button(page, "Next Round").is_disabled()
        action_button(page, "Redo").click()
        assert re.search(r"\bRed wins\b", body_text(page), re.I)
        assert score(page, "Red wins") == 1 and len(history_entries(page)) == 7
        assert cell_state(page, 6, 4) == "red" and winning_markers(page) == 4
        assert action_button(page, "Redo").is_disabled()
    finally:
        context.close()


def check_next_round_and_reset(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        click_moves(page, SEQUENCES["horizontal"])
        action_button(page, "Next Round").click()
        assert all(cell_state(page, row, col) == "empty" for row in range(1, 7) for col in range(1, 8))
        assert history_entries(page) == [] and score(page, "Red wins") == 1
        assert_turn(page, "Yellow")
        column_button(page, 2).click()
        assert cell_state(page, 6, 2) == "yellow"
        action_button(page, "Reset Match").click()
        assert all(cell_state(page, row, col) == "empty" for row in range(1, 7) for col in range(1, 8))
        assert history_entries(page) == []
        assert score(page, "Red wins") == score(page, "Yellow wins") == score(page, "Draws") == 0
        assert_turn(page, "Red")
        assert action_button(page, "Undo").is_disabled() and action_button(page, "Redo").is_disabled()
    finally:
        context.close()


def check_in_progress_persistence(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        click_moves(page, [4, 5, 4])
        action_button(page, "Undo").click()
        page.reload(wait_until="networkidle")
        assert cell_state(page, 6, 4) == "red" and cell_state(page, 6, 5) == "yellow"
        assert cell_state(page, 5, 4) == "empty" and len(history_entries(page)) == 2
        assert_turn(page, "Red")
        assert action_button(page, "Undo").is_enabled() and action_button(page, "Redo").is_enabled()
        assert score(page, "Red wins") == score(page, "Yellow wins") == score(page, "Draws") == 0
    finally:
        context.close()


def check_completed_persistence_and_recovery(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        click_moves(page, SEQUENCES["vertical"])
        page.reload(wait_until="networkidle")
        assert re.search(r"\bRed wins\b", body_text(page), re.I)
        assert score(page, "Red wins") == 1 and len(history_entries(page)) == 7 and winning_markers(page) == 4
        action_button(page, "Undo").click()
        assert score(page, "Red wins") == 0
        assert_turn(page, "Red")
        page.reload(wait_until="networkidle")
        assert action_button(page, "Redo").is_enabled()
        action_button(page, "Redo").click()
        assert score(page, "Red wins") == 1 and re.search(r"\bRed wins\b", body_text(page), re.I)
        page.reload(wait_until="networkidle")
        assert score(page, "Red wins") == 1
    finally:
        context.close()


def active_column(page: Page) -> int:
    name = page.evaluate("""() => {
      const el = document.activeElement;
      return el ? (el.getAttribute('aria-label') || el.textContent || '') : '';
    }""")
    match = re.search(r"column\s*(\d+)|^\s*(\d+)\s*$", name, re.I)
    assert match, f"focused control does not identify a column: {name!r}"
    return int(match.group(1) or match.group(2))


def check_keyboard_controls(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        column_button(page, 4).focus()
        assert active_column(page) == 4
        page.keyboard.press("ArrowLeft")
        assert active_column(page) == 3
        page.keyboard.press("ArrowRight")
        assert active_column(page) == 4
        page.keyboard.press("Home")
        assert active_column(page) == 1
        page.keyboard.press("ArrowLeft")
        assert active_column(page) == 1
        page.keyboard.press("End")
        assert active_column(page) == 7
        page.keyboard.press("ArrowRight")
        assert active_column(page) == 7
        page.keyboard.press("Enter")
        assert cell_state(page, 6, 7) == "red" and active_column(page) == 7
        page.keyboard.press("Space")
        assert cell_state(page, 5, 7) == "yellow" and active_column(page) == 7
        assert len(history_entries(page)) == 2
    finally:
        context.close()


def duration_seconds(value: str) -> float:
    first = value.split(",")[0].strip()
    return float(first[:-2]) / 1000 if first.endswith("ms") else float(first[:-1])


def check_preview_motion_and_reduced_motion(browser: Browser) -> None:
    context, page = fresh_page(browser)
    try:
        control = column_button(page, 2)
        control.hover()
        visible_preview = control.locator("*").evaluate_all(
            """nodes => nodes.some(node => {
              const style = getComputedStyle(node);
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && Number(style.opacity) > 0.2
                && /R|Red/i.test(node.textContent || node.getAttribute('aria-label') || '');
            })"""
        )
        assert visible_preview, "hovering column 2 showed no Red preview"
        control.click()
        duration = duration_seconds(cell(page, 6, 2).evaluate("el => getComputedStyle(el).animationDuration"))
        assert 0 < duration <= 1.0, f"drop animation duration was {duration}s"
    finally:
        context.close()
    context, page = fresh_page(browser, reduced_motion="reduce")
    try:
        column_button(page, 2).click()
        duration = duration_seconds(cell(page, 6, 2).evaluate("el => getComputedStyle(el).animationDuration"))
        assert duration <= 0.05, f"reduced-motion animation remained {duration}s"
        assert cell_state(page, 6, 2) == "red"
    finally:
        context.close()


def check_responsive_layout(browser: Browser) -> None:
    context, page = fresh_page(browser, width=375)
    try:
        geometry = page.evaluate(r"""() => {
          const board = document.querySelector('[role="grid"]');
          const controls = [...document.querySelectorAll('button')].filter(button =>
            /column\s*[1-7]|^[1-7]$/i.test(button.getAttribute('aria-label') || button.textContent.trim())
          );
          const rect = board.getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            boardLeft: rect.left,
            boardRight: rect.right,
            boardVisible: rect.width > 200 && rect.height > 150,
            visibleControls: controls.filter(button => {
              const r = button.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth;
            }).length,
          };
        }""")
        assert geometry["overflow"] <= 1, f"page overflows horizontally by {geometry['overflow']}px"
        assert geometry["boardVisible"]
        assert geometry["boardLeft"] >= -1 and geometry["boardRight"] <= 376
        assert geometry["visibleControls"] >= 7
        assert action_button(page, "Undo").is_visible() and action_button(page, "Reset Match").is_visible()
    finally:
        context.close()


CHECKS: list[tuple[str, Callable[[Browser], None]]] = [
    ("bootstrap_accessibility_and_controls", check_bootstrap),
    ("gravity_turns_and_full_column_invariant", check_gravity_turns_and_full_column),
    ("horizontal_vertical_and_diagonal_wins", check_all_win_directions),
    ("terminal_move_lock", check_terminal_lock),
    ("exact_full_board_draw", check_exact_draw),
    ("history_undo_redo_and_branch_invalidation", check_history_undo_redo_and_branch),
    ("terminal_undo_redo_score_atomicity", check_terminal_undo_redo_scoring),
    ("next_round_and_full_match_reset", check_next_round_and_reset),
    ("in_progress_reload_with_redo", check_in_progress_persistence),
    ("completed_reload_undo_redo_idempotence", check_completed_persistence_and_recovery),
    ("keyboard_navigation_drop_and_focus", check_keyboard_controls),
    ("preview_drop_motion_and_reduced_motion", check_preview_motion_and_reduced_motion),
    ("responsive_375px_layout", check_responsive_layout),
]


def execute_check(name: str, check: Callable[[Browser], None], browser: Browser) -> CheckResult:
    started = time.monotonic()
    try:
        check(browser)
        result = CheckResult(name, "passed", int((time.monotonic() - started) * 1000))
    except Exception as exc:
        result = CheckResult(name, "failed", int((time.monotonic() - started) * 1000), f"{type(exc).__name__}: {exc}")
    log(f"{result.status.upper():6} {name}: {result.message or 'ok'}")
    return result


def write_outputs(results: list[CheckResult], preflight_error: str = "") -> None:
    passed = sum(result.status == "passed" for result in results)
    failed = sum(result.status == "failed" for result in results)
    all_passed = not preflight_error and failed == 0 and len(results) == len(CHECKS)
    final = 1.0 if all_passed else 0.0
    diagnostic = passed / len(CHECKS) if CHECKS else 0.0
    now = datetime.now(timezone.utc).isoformat()
    report = {
        "taskId": "turing/dropline-connect-four",
        "reward": final,
        "diagnostic_score": round(diagnostic, 4),
        "preflight_error": preflight_error or None,
        "passed": passed,
        "failed": failed,
        "total": len(CHECKS),
        "checks": [asdict(result) for result in results],
    }
    rewards = {
        "reward": final,
        "diagnostic_score": round(diagnostic, 4),
        "preflight_passed": int(not preflight_error),
        "checks_passed": passed,
        "checks_failed": failed,
    }
    ctrf = {
        "results": {
            "tool": {"name": "dropline-deterministic-playwright", "version": "2.0.0"},
            "summary": {
                "tests": len(CHECKS), "passed": passed, "failed": failed,
                "pending": 0, "skipped": len(CHECKS) - len(results), "other": 0,
                "start": now, "stop": now,
            },
            "tests": [
                {
                    "name": result.name, "status": result.status, "duration": result.duration,
                    **({"message": result.message} if result.message else {}),
                }
                for result in results
            ],
        }
    }
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    (LOG_DIR / "reward.txt").write_text(f"{final:.1f}\n", encoding="utf-8")
    (LOG_DIR / "reward.json").write_text(json.dumps(rewards, indent=2), encoding="utf-8")
    (LOG_DIR / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (LOG_DIR / "ctrf.json").write_text(json.dumps(ctrf, indent=2), encoding="utf-8")


def main() -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    results: list[CheckResult] = []
    process: subprocess.Popen | None = None
    preflight_error = ""
    try:
        root = app_root()
        assert (root / "package.json").is_file(), "no package.json in /app"
        static_preflight(root)
        ensure_dependencies(root)
        command = start_command(root)
        process = start_app(root, command)
        wait_for_health()
        status, config = request_json("/api/config")
        assert status == 200 and config.get("title") == "DropLine", "GET /api/config is invalid"
        stop_app(process)
        process = start_app(root, command)
        wait_for_health()
        with sync_playwright() as playwright:
            launch_options = {"headless": True}
            if CHROMIUM:
                launch_options["executable_path"] = CHROMIUM
            browser = playwright.chromium.launch(**launch_options)
            try:
                for name, check in CHECKS:
                    results.append(execute_check(name, check, browser))
            finally:
                browser.close()
    except Exception as exc:
        preflight_error = f"{type(exc).__name__}: {exc}"
        log(f"PREFLIGHT FAILED: {preflight_error}")
    finally:
        stop_app(process)
        write_outputs(results, preflight_error)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
