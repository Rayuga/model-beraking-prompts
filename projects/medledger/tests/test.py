#!/usr/bin/env python3
"""Harbor verifier for the MedLedger task.

Runs after the agent phase. Installs the submission's dependencies, starts it on
port 3000, waits for it to answer, then runs RewardKit against
tests/rubric/browser -- a Codex CUA judge that drives the rendered UI
through Playwright MCP and replays the UI's own writes as forgeries. The
verifier never calls the app's API directly, so it never depends on guessing an
endpoint path the submission happened to choose.

SEGMENTED JUDGING. The rubric is not handed to one judge session. Each entry in
tests/rubric/browser/segments.json is an ordered group of criterion ids; this
module materialises a temporary rubric directory per group and invokes RewardKit
once for each, against the SAME live database -- no wipe and no re-seed in
between, so the journey stays ordered and stateful. What resets each time is the
judge's context and its browser. A single session carrying a whole rubric was
observed returning verdicts drawn from recalled context rather than from
evidence it had gathered, which inflates the score for correct and incorrect
submissions alike; and a judge that exhausts its budget mid-session scores every
remaining sibling 0 without ever probing it. Segments bound both blast radii.

OPTIONAL restart. A segment MAY set `restart_app`: the app process is stopped and
started again, with the data directory untouched and no seed re-run, before that
segment is judged — the mechanism that would make "everything is persisted to
disk" gradable rather than a re-read of memory. No segment in the shipped
segments.json enables it (the 24 graded criteria are seeded-invariant forge-reads
that do not test durability); the hook stays available but dormant.

FALLBACK. If segments.json is absent, unreadable, or matches no criterion id,
the rubric is run WHOLE -- one RewardKit invocation against browser.toml,
exactly as this verifier behaved before segmentation. browser.toml remains the
canonical, complete, standalone criterion list; segments.json only changes how
it is invoked, never what it says.

Writes:
  /logs/verifier/reward.json  numeric metrics only (Harbor requirement):
                              `reward`, `browser_passed`/`browser_total`,
                              `graded` (RewardKit returned a real verdict),
                              `no_op` (the submission never reached an operable
                              state at all), `criteria_unprobed`,
                              `criteria_timed_out`, `criteria_cascade_aborted`,
                              `judge_infra_error`, and
                              numeric `judge_policy_match` and `rubric_total`.
  /logs/verifier/reward.txt   the single float reward (Harbor fallback).
  /logs/verifier/run-metadata.json  string judge identity, provider, and
                              pinned RewardKit/Codex runtime versions.
  /logs/verifier/rewardkit/   the MERGED per-criterion verdicts across every
                              segment, in RewardKit's own reward-details.json
                              shape, plus a segments report.
  /logs/verifier/rewardkit-<segment>/  each segment's raw RewardKit output.
  /logs/verifier/app-source/  a copy of what the submission actually shipped,
                              so a failed run can be autopsied afterwards.

A reward floor is written before anything else can fail, and main() is wrapped
so a crash still produces a score rather than an unscored rollout.
"""

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
import urllib.error
import urllib.request

APP_DIR = os.environ.get("MEDLEDGER_APP_DIR", "/app")
LOG_DIR = os.environ.get("MEDLEDGER_LOG_DIR", "/logs/verifier")
RUBRIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rubric", "browser")
BROWSER_RUBRIC = os.path.join(RUBRIC_DIR, "browser.toml")
BROWSER_PROMPT = os.path.join(RUBRIC_DIR, "prompt.md")
BROWSER_SEGMENTS = os.path.join(RUBRIC_DIR, "segments.json")
PORT = 3000
BASE_URL = f"http://localhost:{PORT}"
EXPECTED_CRITERIA = 24
EXPECTED_JUDGE_BACKEND = "codex"
EXPECTED_JUDGE_MODEL = "openai/gpt-5.6-luna"
EXPECTED_JUDGE_REASONING_EFFORT = "max"
DEFAULT_JUDGE_BASE_URL = "https://openrouter.ai/api/v1"
CODEX_HOME_DIR = os.environ.get(
    "MEDLEDGER_CODEX_HOME", "/tmp/medledger-codex"
)

BOOT_TIMEOUT_SEC = 300
INSTALL_TIMEOUT_SEC = 1800
# Whole-rubric fallback cap, and the total wall-clock budget for all segments
# combined. Timeout hierarchy for the segmented run:
#   per-segment backstop (SEGMENT_TIMEOUT_CAP_SEC = 2400)
#     < this total judge budget (JUDGE_TIMEOUT_SEC = 12600)
#     < verifier.timeout_sec (17400 in task.toml)
# browser.toml's own `timeout = 16200` is RewardKit's internal per-invocation
# cap; here the 2400s per-segment subprocess backstop fires first, which is
# ample for the <=6 criteria a segment carries and keeps the four segments
# combined under the 12600s total. Harbor SIGKILLs the verifier at
# verifier.timeout_sec; if that happened mid-segment the only reward on disk
# would be the 0.0 floor, erasing every criterion already earned. Staying under
# it means an overrun still reports what it finished. In the whole-rubric
# fallback (no usable segments.json) JUDGE_TIMEOUT_SEC caps the single run.
JUDGE_TIMEOUT_SEC = int(os.environ.get("MEDLEDGER_JUDGE_TIMEOUT", "12600"))
# Per-segment backstop: a full subprocess kill for one segment's RewardKit run.
# Sized so eight segments fit inside the total judge budget with headroom.
SEGMENT_TIMEOUT_CAP_SEC = float(os.environ.get("MEDLEDGER_SEGMENT_TIMEOUT", "2400"))
# Never hand a segment less than this; below it a judge cannot even sign in.
SEGMENT_TIMEOUT_MIN_SEC = 600.0
# The ruling's ceiling: no judge session carries more than six criteria.
MAX_SEGMENT_CRITERIA = 6
# prompt.md may carry this marker; if it does not, the per-segment note is
# inserted just above the "## Criteria" heading instead. Either way the shipped
# prompt.md is never modified -- the note is applied to a temporary copy.
SEGMENT_NOTE_MARKER = "<!-- SEGMENT_NOTE -->"

_CRITERION_MARKER = "[[criterion]]"
_CRITERION_ID_RE = re.compile(r'^id\s*=\s*"(.*?)"\s*$', re.MULTILINE)
_CRITERION_WEIGHT_RE = re.compile(r"^weight\s*=\s*([0-9.]+)\s*$", re.MULTILINE)

METRICS = {
    "reward": 0.0,
    "browser_passed": 0.0,
    "browser_total": float(EXPECTED_CRITERIA),
    "graded": 0.0,
    "no_op": 0.0,
    "criteria_unprobed": 0.0,
    "criteria_timed_out": 0.0,
    "criteria_cascade_aborted": 0.0,
    "judge_infra_error": 0.0,
    "rubric_total": float(EXPECTED_CRITERIA),
    "judge_policy_match": float(
        os.environ.get("REWARDKIT_JUDGE", EXPECTED_JUDGE_BACKEND)
        == EXPECTED_JUDGE_BACKEND
        and os.environ.get("REWARDKIT_MODEL", EXPECTED_JUDGE_MODEL)
        == EXPECTED_JUDGE_MODEL
        and os.environ.get(
            "REWARDKIT_REASONING_EFFORT", EXPECTED_JUDGE_REASONING_EFFORT
        ) == EXPECTED_JUDGE_REASONING_EFFORT
    ),
}

_RUN_METADATA = None


def log(msg):
    print(f"[medledger-verifier] {msg}", flush=True)


def run_metadata():
    """Record judge identity and pinned runtime versions without exposing keys."""
    global _RUN_METADATA
    if _RUN_METADATA is not None:
        return _RUN_METADATA
    backend = os.environ.get("REWARDKIT_JUDGE", EXPECTED_JUDGE_BACKEND)
    model = os.environ.get("REWARDKIT_MODEL", EXPECTED_JUDGE_MODEL)
    reasoning_effort = os.environ.get(
        "REWARDKIT_REASONING_EFFORT", EXPECTED_JUDGE_REASONING_EFFORT
    )
    base_url = os.environ.get("OPENAI_BASE_URL", DEFAULT_JUDGE_BASE_URL)
    try:
        rewardkit_version = importlib.metadata.version("harbor-rewardkit")
    except importlib.metadata.PackageNotFoundError:
        rewardkit_version = "unknown"
    try:
        codex_version = subprocess.run(
            ["codex", "--version"], capture_output=True, text=True,
            check=False, timeout=10,
        ).stdout.strip() or "unknown"
    except (OSError, subprocess.SubprocessError):
        codex_version = "unknown"
    _RUN_METADATA = {
        "task_name": "webdev/medledger",
        "task_version": "1.0.0",
        "rubric_revision": "2026-08-28-medledger-24crit-luna-r1",
        "judge_backend": backend,
        "judge_model": model,
        "judge_reasoning_effort": reasoning_effort,
        "judge_provider": "openrouter" if "openrouter.ai" in base_url else "openai",
        "judge_base_url": base_url,
        "judge_policy_match": (
            backend == EXPECTED_JUDGE_BACKEND
            and model == EXPECTED_JUDGE_MODEL
            and reasoning_effort == EXPECTED_JUDGE_REASONING_EFFORT
        ),
        "rewardkit_version": rewardkit_version,
        "codex_version": codex_version,
    }
    return _RUN_METADATA


def write_reward(**over):
    METRICS.update(over)
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(os.path.join(LOG_DIR, "reward.json"), "w") as fh:
        json.dump(METRICS, fh, indent=2)
    with open(os.path.join(LOG_DIR, "reward.txt"), "w") as fh:   # Harbor fallback
        fh.write(str(METRICS["reward"]))
    with open(os.path.join(LOG_DIR, "run-metadata.json"), "w") as fh:
        json.dump(run_metadata(), fh, indent=2)


def capture_app_source():
    """Keep what the submission shipped. This is what makes a bad run diagnosable."""
    dest = os.path.join(LOG_DIR, "app-source")
    try:
        if os.path.isdir(dest):
            shutil.rmtree(dest)
        shutil.copytree(
            APP_DIR, dest,
            ignore=shutil.ignore_patterns("node_modules", ".git", "data", "*.db",
                                          "*.db-wal", "*.db-shm", "dist", ".next"),
            symlinks=False, ignore_dangling_symlinks=True,
        )
        log(f"captured submission source -> {dest}")
    except Exception as exc:                                    # never fatal
        log(f"could not capture app source: {exc}")


def http_ok(url, timeout=3):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return 200 <= r.status < 500
    except urllib.error.HTTPError:
        return True                                             # it answered
    except Exception:
        return False


def npm_install():
    if not os.path.isfile(os.path.join(APP_DIR, "package.json")):
        log("no package.json in the app directory")
        return False
    if os.path.isdir(os.path.join(APP_DIR, "node_modules")):
        log("node_modules already present; skipping install")
        return True
    cmd = ["npm", "ci", "--no-audit", "--no-fund"] if os.path.isfile(
        os.path.join(APP_DIR, "package-lock.json")) else ["npm", "install", "--no-audit", "--no-fund"]
    for attempt in (1, 2, 3):
        log(f"{' '.join(cmd)} (attempt {attempt}/3)")
        try:
            p = subprocess.run(cmd, cwd=APP_DIR, timeout=INSTALL_TIMEOUT_SEC,
                               capture_output=True, text=True)
            if p.returncode == 0:
                return True
            log(f"install failed rc={p.returncode}: {p.stderr[-800:]}")
        except subprocess.TimeoutExpired:
            log("install timed out")
        time.sleep(attempt * 3)
    return False


def start_app(tag=""):
    """Start the submission however it says it should be started.

    `tag` only names the stdout file, so restarting for the durability segment
    does not truncate the first boot's log.
    """
    env = dict(os.environ)
    env.pop("NODE_ENV", None)                                   # keep devDeps usable
    env["PORT"] = str(PORT)
    pkg_path = os.path.join(APP_DIR, "package.json")
    cmd = ["npm", "start"]
    try:
        with open(pkg_path) as fh:
            scripts = (json.load(fh) or {}).get("scripts") or {}
        if "start" not in scripts:
            for entry in ("server.js", "src/index.js", "index.js", "app.js", "src/server.js"):
                if os.path.isfile(os.path.join(APP_DIR, entry)):
                    cmd = ["node", entry]
                    break
    except Exception:
        pass
    log(f"starting the app: {' '.join(cmd)}")
    out = open(os.path.join(LOG_DIR, f"app-stdout{tag}.txt"), "w")
    proc = subprocess.Popen(cmd, cwd=APP_DIR, env=env, stdout=out,
                            stderr=subprocess.STDOUT, start_new_session=True)
    deadline = time.time() + BOOT_TIMEOUT_SEC
    while time.time() < deadline:
        if proc.poll() is not None:
            log(f"the app exited during boot with rc={proc.returncode}")
            return None
        if http_ok(f"{BASE_URL}/health") or http_ok(f"{BASE_URL}/"):
            log("the app is answering")
            return proc
        time.sleep(1.5)
    log("the app never answered within the boot timeout")
    return proc if proc.poll() is None else None


def stop_app(proc):
    """Stop the app process group. The data directory is never touched."""
    if proc is None:
        return
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except Exception:
        pass
    for _ in range(40):
        if proc.poll() is not None:
            break
        time.sleep(0.25)
    if proc.poll() is None:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            pass
    # Let the port come back before the next boot.
    for _ in range(40):
        if not http_ok(f"{BASE_URL}/", timeout=1):
            return
        time.sleep(0.25)


def _rewardkit_command():
    exe = shutil.which("rewardkit")
    return [exe] if exe else [sys.executable, "-m", "rewardkit"]


def _prepare_codex_config():
    """Select OpenRouter as Codex's provider without persisting the API key.

    OPENAI_BASE_URL is not a Codex CLI environment setting. Codex otherwise
    keeps its built-in OpenAI provider and sends an OpenRouter key to
    api.openai.com. A user-level config is required for provider selection;
    RewardKit's child `codex` processes inherit CODEX_HOME and the
    OPENROUTER_API_KEY environment variable.
    """
    os.makedirs(CODEX_HOME_DIR, mode=0o700, exist_ok=True)
    config_path = os.path.join(CODEX_HOME_DIR, "config.toml")
    reasoning_effort = os.environ.get(
        "REWARDKIT_REASONING_EFFORT", EXPECTED_JUDGE_REASONING_EFFORT
    )
    config = f'''model_provider = "openrouter"
model_reasoning_effort = "{reasoning_effort}"
approval_policy = "never"
sandbox_mode = "danger-full-access"

[model_providers.openrouter]
name = "OpenRouter"
base_url = "{DEFAULT_JUDGE_BASE_URL}"
env_key = "OPENROUTER_API_KEY"
wire_api = "responses"
supports_websockets = false

[mcp_servers.playwright]
command = "playwright-mcp"
args = ["--headless", "--isolated", "--executable-path=/usr/local/bin/chromium", "--no-sandbox"]
default_tools_approval_mode = "approve"
'''
    with open(config_path, "w") as fh:
        fh.write(config)
    os.chmod(config_path, 0o600)
    return config_path


def _rewardkit_env():
    """The Codex judge drives Playwright MCP through the pinned OpenRouter route."""
    _prepare_codex_config()
    env = {
        **os.environ,
        "PORT": str(PORT),
        "BASE_URL": BASE_URL,
        "APP_PUBLIC_URL": BASE_URL,
        "REWARDKIT_JUDGE": os.environ.get("REWARDKIT_JUDGE", EXPECTED_JUDGE_BACKEND),
        "REWARDKIT_MODEL": os.environ.get("REWARDKIT_MODEL", EXPECTED_JUDGE_MODEL),
        "REWARDKIT_REASONING_EFFORT": os.environ.get(
            "REWARDKIT_REASONING_EFFORT", EXPECTED_JUDGE_REASONING_EFFORT
        ),
        "OPENAI_BASE_URL": os.environ.get("OPENAI_BASE_URL", DEFAULT_JUDGE_BASE_URL),
        "CODEX_HOME": CODEX_HOME_DIR,
    }
    if not env.get("OPENAI_API_KEY") and env.get("OPENROUTER_API_KEY"):
        env["OPENAI_API_KEY"] = env["OPENROUTER_API_KEY"]
    return env


def _invoke_rewardkit(tests_dir, out_dir, timeout):
    """One RewardKit invocation. The shape here is load-bearing:
    positional tests_dir, --workspace, --output as a FILE, and one agent /
    one LLM at a time. There is NO --url flag -- passing one exits rc=2 and
    voids the run; the judge navigates to the app itself."""
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "reward.json")
    cmd = [*_rewardkit_command(), tests_dir,
           "--workspace", APP_DIR,
           "--output", out_file,
           "--max-concurrent-agent", "1",
           "--max-concurrent-llm", "1"]
    log(f"running the judge: {' '.join(cmd)} (timeout {timeout:.0f}s)")
    stdout_path = os.path.join(out_dir, "stdout.txt")
    timed_out = False
    rc = None
    with open(stdout_path, "w") as fh:
        proc = subprocess.Popen(cmd, stdout=fh, stderr=subprocess.STDOUT,
                                text=True, env=_rewardkit_env(), start_new_session=True)
        try:
            rc = proc.wait(timeout=timeout)
            log(f"the judge finished rc={rc}")
            if rc != 0:
                log(f"NON-ZERO judge exit ({rc}) - see {stdout_path}")
        except subprocess.TimeoutExpired:
            log("the judge exceeded its budget; SIGKILLing its process GROUP so a hung "
                "Codex judge cannot zombie the browser into the next segment")
            timed_out = True
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except (ProcessLookupError, PermissionError, OSError):
                proc.kill()
            try:
                proc.wait(timeout=30)
            except subprocess.TimeoutExpired:
                pass
    return rc, timed_out


def read_details(out_dir):
    """RewardKit's per-criterion detail file; its reward.json is a bare aggregate."""
    for name in ("reward-details.json", "reward_details.json", "details.json"):
        candidate = os.path.join(out_dir, name)
        if os.path.isfile(candidate):
            try:
                with open(candidate) as fh:
                    return json.load(fh)
            except Exception as exc:
                log(f"{name} unreadable: {exc}")
                return None
    return None


# --------------------------------------------------------------------- #
# Rubric segmentation                                                    #
# --------------------------------------------------------------------- #

def split_rubric(text):
    """(header, {id: block}, ordered_ids, {id: weight}).

    Plain-text slicing, not a TOML round-trip: a criterion's body IS the
    specification handed to the judge, and re-emitting it through a serialiser
    risks changing the wording. Slicing keeps every block byte-identical to
    browser.toml.
    """
    idx = text.find(_CRITERION_MARKER)
    if idx < 0:
        return text, {}, [], {}
    header, body = text[:idx], text[idx:]
    chunks = body.split("\n" + _CRITERION_MARKER)
    chunks = [chunks[0]] + [_CRITERION_MARKER + c for c in chunks[1:]]
    blocks, order, weights = {}, [], {}
    for chunk in chunks:
        m = _CRITERION_ID_RE.search(chunk)
        if not m:
            continue
        cid = m.group(1)
        blocks[cid] = chunk.rstrip() + "\n"
        order.append(cid)
        wm = _CRITERION_WEIGHT_RE.search(chunk)
        weights[cid] = float(wm.group(1)) if wm else 1.0
    return header, blocks, order, weights


def load_segments(order):
    """Ordered segment definitions, or None to run the rubric whole.

    Returning None is the documented fallback: a missing, unreadable or
    unusable segments.json must never turn into a zero, so the verifier
    reverts to exactly its pre-segmentation behaviour. Any criterion the file
    forgets is appended to the last segment rather than silently dropped, so
    adding a criterion to browser.toml can never quietly remove it from
    grading.
    """
    if not os.path.isfile(BROWSER_SEGMENTS):
        log("no segments.json - running browser.toml whole, as one session")
        return None
    try:
        with open(BROWSER_SEGMENTS) as fh:
            data = json.load(fh)
    except Exception as exc:
        log(f"segments.json unusable ({exc}) - running the rubric as one session")
        return None
    segments = data.get("segments") if isinstance(data, dict) else None
    if not isinstance(segments, list) or not segments:
        log("segments.json declares no segments - running the rubric as one session")
        return None

    known, seen, cleaned = set(order), set(), []
    for i, seg in enumerate(segments):
        if not isinstance(seg, dict):
            continue
        ids = [c for c in (seg.get("criteria") or []) if c in known and c not in seen]
        seen.update(ids)
        if not ids:
            continue
        cleaned.append({"id": str(seg.get("id") or f"segment{i + 1}"),
                        "criteria": ids,
                        "restart_app": bool(seg.get("restart_app"))})
    if not cleaned:
        log("segments.json matched no known criterion ids - running as one session")
        return None

    missing = [c for c in order if c not in seen]
    if missing:
        log(f"criteria absent from segments.json, appended to the last segment: {missing}")
        cleaned[-1]["criteria"].extend(missing)

    # Enforce the ruling's ceiling even if the file asks for more.
    capped = []
    for seg in cleaned:
        ids = seg["criteria"]
        if len(ids) <= MAX_SEGMENT_CRITERIA:
            capped.append(seg)
            continue
        for part, start in enumerate(range(0, len(ids), MAX_SEGMENT_CRITERIA), start=1):
            chunk = ids[start:start + MAX_SEGMENT_CRITERIA]
            capped.append({"id": f"{seg['id']}_{part}", "criteria": chunk,
                           # a restart belongs to the first chunk only
                           "restart_app": seg["restart_app"] and part == 1})
        log(f"segment {seg['id']} carried {len(ids)} criteria; split at {MAX_SEGMENT_CRITERIA}")
    return capped


def _segment_note(seg, position, total, restart_baseline=None):
    n = len(seg["criteria"])
    if n == 1:
        scope = ("Only the single criterion listed below is yours to grade - do not "
                 "attempt criteria from other parts, and do not undo or clean up "
                 "state, because the next part depends on it.")
    else:
        scope = (f"Only the {n} criteria listed below are yours to grade - do not "
                 "attempt criteria from other parts, and do not undo or clean up "
                 "state, because the next part depends on it.")
    lines = [
        f"**You are judging part {position} of {total} of one continuous evaluation.**",
        "",
        "Earlier parts have already run against this same database and their state",
        "changes are already in place; later parts will continue from wherever you",
        f"leave it. {scope}",
        "",
        "The database was not wiped or re-seeded between parts, and must not be wiped",
        "now.",
        "",
        "If a criterion tells you to replay a request that was *recorded earlier* and",
        "the recording was made in an earlier part, you do not have it in this session.",
        "Obtain the shape yourself: perform the equivalent legitimate action as a role",
        "that is allowed to, record the request the app issues, and replay that. Never",
        "pass a replay leg you could not actually execute.",
    ]
    if seg.get("restart_app"):
        lines += [
            "",
            "**The app process was stopped and started again immediately before this",
            "part.** Nothing else was touched: the data directory was left exactly as",
            "the previous part left it, and no seed was re-run by the verifier. Do not",
            "restart it again yourself.",
        ]
        if restart_baseline:
            lines += [
                "",
                "**Authoritative pre-restart observation from the immediately preceding",
                "criterion:**",
                "",
                restart_baseline,
                "",
                "Use that observation only as the comparison baseline. Do not count a",
                "business-rule defect from the preceding criterion a second time merely",
                "because the same incorrect value survived the restart.",
            ]
        else:
            lines += [
                "",
                "**No concrete pre-restart baseline was returned by the preceding judge.**",
                "Durability cannot be proven by an unpaired post-restart re-read; fail the",
                "comparison criterion rather than reconstructing or assuming a baseline.",
            ]
    return "\n".join(lines)


def _inject_note(prompt_text, note):
    """Put the per-segment note into a COPY of prompt.md. The shipped file is
    never modified: the marker is optional, and without it the note goes just
    above the criteria list."""
    if SEGMENT_NOTE_MARKER in prompt_text:
        return prompt_text.replace(SEGMENT_NOTE_MARKER, note)
    idx = prompt_text.find("\n## Criteria")
    if idx >= 0:
        return prompt_text[:idx] + "\n\n" + note + "\n" + prompt_text[idx:]
    return prompt_text.rstrip() + "\n\n" + note + "\n"


def write_segment_rubric(dest, header, blocks, seg, position, total, prompt_text,
                         restart_baseline=None):
    """Materialise a one-segment rubric directory RewardKit can be pointed at.

    The criterion blocks are copied verbatim out of browser.toml and the
    [judge] header is the same header, so the judge, the model and the MCP
    browser are identical to the whole-rubric run.
    """
    os.makedirs(dest, exist_ok=True)
    body = "\n".join(blocks[c] for c in seg["criteria"])
    with open(os.path.join(dest, "browser.toml"), "w") as fh:
        fh.write(header + body)
    with open(os.path.join(dest, "prompt.md"), "w") as fh:
        fh.write(_inject_note(
            prompt_text,
            _segment_note(seg, position, total, restart_baseline=restart_baseline),
        ))


def _criterion_summary(block, limit=400):
    _, _, rest = block.partition('description = """')
    text, _, _ = rest.partition('"""')
    flat = " ".join(text.split())
    return flat[:limit - 3] + "..." if len(flat) > limit else flat


_UNPROBED_MARKERS = (
    "criterion was never judged", "not tested", "never tested", "never observed",
    "not exercised", "token budget exhausted", "context budget exhausted",
    "judge budget exhausted", "exhausted before", "judge timed out",
    "timed out after", "did not come back up", "browser was unavailable",
    "browser is unavailable", "browser tool was unavailable", "no browser evidence",
    "browser evidence could not", "mcp tool call requires approval",
    "chrome-for-testing is not installed", "chrome binary is missing",
)

_CASCADE_ABORTED_MARKERS = (
    "cascade_aborted:", "cascade aborted:",
)


def _reasoning_is_unprobed(reasoning):
    why = (reasoning or "").lower()
    return any(m in why for m in _UNPROBED_MARKERS)


def _reasoning_is_cascade_aborted(reasoning):
    why = (reasoning or "").strip().lower()
    return any(why.startswith(m) for m in _CASCADE_ABORTED_MARKERS)


def _normalise_criterion_result(criterion, inherited_timeout=False):
    """Return one score-safe criterion verdict.

    A declared PASS is never credit by itself. It earns credit only when the
    judge also returned concrete, non-infrastructure reasoning and did not mark
    the criterion unprobed. A downstream leg that could not reach its disclosed
    starting state is recorded as cascade-aborted and therefore unprobed; it
    invalidates the run instead of masquerading as an independent capability
    failure.
    """
    c = criterion or {}
    reasoning = str(c.get("reasoning") or "").strip()
    crit_timeout = bool(
        inherited_timeout
        or c.get("timed_out")
        or "timed out" in str(c.get("error") or "").lower()
    )
    if "value" in c and c.get("value") is not None:
        declared_pass = float(c.get("value") or 0) >= 0.5
    else:
        verdict = c.get("passed", c.get("pass", c.get("result")))
        declared_pass = verdict is True or verdict == "PASS" or verdict == 1

    cascade_aborted = _reasoning_is_cascade_aborted(reasoning)
    explicit_probed = bool(c.get("probed", True))
    probed = bool(
        not crit_timeout
        and not cascade_aborted
        and explicit_probed
        and reasoning
        and not _reasoning_is_unprobed(reasoning)
    )
    value = 1.0 if declared_pass and probed else 0.0
    if not reasoning:
        reasoning = (
            "judge timed out; criterion scored 0.0"
            if crit_timeout
            else "criterion returned no concrete browser evidence"
        )
    return {
        "value": value,
        "reasoning": reasoning,
        "timed_out": crit_timeout,
        "probed": probed,
        "cascade_aborted": cascade_aborted,
    }


def _aggregate_criterion_results(criteria, expected_total=EXPECTED_CRITERIA):
    """Aggregate without allowing missing or unprobed PASS rows to earn credit."""
    normalised = [_normalise_criterion_result(c) for c in criteria]
    total = max(len(normalised), expected_total)
    missing = max(expected_total - len(normalised), 0)
    return {
        "criteria": normalised,
        "passed": sum(1 for c in normalised if c["value"] > 0),
        "total": total,
        "unprobed": missing + sum(1 for c in normalised if not c["probed"]),
        "timed_out": sum(1 for c in normalised if c["timed_out"]),
        "cascade_aborted": sum(1 for c in normalised if c["cascade_aborted"]),
    }


def run_segments(segments, proc_holder):
    """Run the rubric one segment at a time against one continuous database,
    then merge the verdicts into a single RewardKit-shaped details file."""
    with open(BROWSER_RUBRIC) as fh:
        rubric_text = fh.read()
    with open(BROWSER_PROMPT) as fh:
        prompt_text = fh.read()
    header, blocks, order, weights = split_rubric(rubric_text)

    log(f"browser rubric: {len(order)} criteria across {len(segments)} segment(s): "
        f"{', '.join(s['id'] for s in segments)}")

    # Every criterion starts as a fail carrying its declared weight. A segment
    # that never runs therefore costs exactly what it was carrying instead of
    # vanishing from the denominator and flattering the score.
    verdicts = {cid: {"id": cid, "name": cid, "value": 0.0,
                      "weight": weights.get(cid, 1.0), "segment": None,
                      "reasoning": "criterion was never judged",
                      "timed_out": False, "probed": False,
                      "cascade_aborted": False}
                for cid in order}
    seg_reports = []
    workdir = tempfile.mkdtemp(prefix="medledger-rubric-")
    deadline = time.time() + JUDGE_TIMEOUT_SEC
    remaining_criteria = sum(len(s["criteria"]) for s in segments)

    try:
        for i, seg in enumerate(segments, start=1):
            for cid in seg["criteria"]:
                verdicts[cid]["segment"] = seg["id"]
            n = len(seg["criteria"])
            left = deadline - time.time()

            if left <= SEGMENT_TIMEOUT_MIN_SEC:
                msg = f"judge budget exhausted before segment {seg['id']}"
                log(f"SKIP: {msg}")
                for cid in seg["criteria"]:
                    verdicts[cid]["reasoning"] = msg
                seg_reports.append({"id": seg["id"], "criteria": seg["criteria"],
                                    "error": msg, "timed_out": False})
                remaining_criteria -= n
                continue

            restart_baseline = None
            if seg.get("restart_app"):
                prior = verdicts.get("x_transport_cancel_reversal_nets_gl") or {}
                if prior.get("probed") and prior.get("reasoning"):
                    restart_baseline = prior["reasoning"]
                log(f"segment {seg['id']}: restarting the app "
                    f"(the data directory is left untouched)")
                stop_app(proc_holder.get("proc"))
                proc_holder["proc"] = start_app(tag=f"-{seg['id']}")
                if proc_holder["proc"] is None:
                    msg = f"the app did not come back up after the restart before segment {seg['id']}"
                    log(f"FAIL: {msg}")
                    for cid in seg["criteria"]:
                        verdicts[cid]["reasoning"] = msg
                    seg_reports.append({"id": seg["id"], "criteria": seg["criteria"],
                                        "error": msg, "timed_out": False,
                                        "restart_app": True})
                    remaining_criteria -= n
                    continue
                log(f"segment {seg['id']}: the app is answering again after the restart")

            # Fair share of what is left, so an early segment cannot starve a
            # later one and unused time rolls forward.
            share = (deadline - time.time()) * (n / max(remaining_criteria, 1))
            budget = max(SEGMENT_TIMEOUT_MIN_SEC,
                         min(SEGMENT_TIMEOUT_CAP_SEC, share, deadline - time.time()))

            seg_dir = os.path.join(workdir, seg["id"])
            write_segment_rubric(
                seg_dir, header, blocks, seg, i, len(segments), prompt_text,
                restart_baseline=restart_baseline,
            )
            out_dir = os.path.join(LOG_DIR, f"rewardkit-{seg['id']}")
            rc, timed_out = _invoke_rewardkit(seg_dir, out_dir, budget)
            details = read_details(out_dir)
            root = (details or {}).get("reward") if isinstance((details or {}).get("reward"), dict) else (details or {})
            judged = root.get("criteria") or root.get("results") or []
            if isinstance(judged, dict):
                judged = list(judged.values())

            graded_ids = set()
            for c in judged:
                cid = (c.get("id") or c.get("name") or "").strip()
                if cid not in verdicts:
                    continue
                graded_ids.add(cid)
                normalised = _normalise_criterion_result(c, inherited_timeout=timed_out)
                verdicts[cid].update(normalised)

            ungraded = [c for c in seg["criteria"] if c not in graded_ids]
            if ungraded:
                log(f"segment {seg['id']}: no verdict returned for {ungraded} - scored 0")
                for cid in ungraded:
                    verdicts[cid]["reasoning"] = (
                        f"segment {seg['id']} returned no verdict for this criterion"
                        + ("; the judge timed out" if timed_out else ""))
                    verdicts[cid]["timed_out"] = verdicts[cid]["timed_out"] or timed_out
            seg_reports.append({"id": seg["id"], "criteria": seg["criteria"],
                                "restart_app": bool(seg.get("restart_app")),
                                "ungraded": ungraded, "exit_code": rc,
                                "timed_out": timed_out,
                                "cascade_aborted": [cid for cid in seg["criteria"]
                                                    if verdicts[cid]["cascade_aborted"]],
                                "passed": sum(1 for cid in seg["criteria"]
                                              if verdicts[cid]["value"] > 0)})
            log(f"segment {seg['id']}: "
                f"{seg_reports[-1]['passed']}/{n} criteria passed")
            remaining_criteria -= n
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    criteria = [{"id": cid, "name": cid, "value": verdicts[cid]["value"],
                 "weight": verdicts[cid]["weight"], "segment": verdicts[cid]["segment"],
                 "description": _criterion_summary(blocks.get(cid, "")),
                 "reasoning": verdicts[cid]["reasoning"],
                 "timed_out": bool(verdicts[cid]["timed_out"]),
                 "probed": bool(verdicts[cid]["probed"]),
                 "cascade_aborted": bool(verdicts[cid]["cascade_aborted"])}
                for cid in order]
    passed = sum(1 for c in criteria if c["value"] > 0)
    timed_out_n = sum(1 for cid in order if verdicts[cid]["timed_out"])
    # A criterion is unprobed if no real judge verdict came back for it — full
    # stop. `probed` is already False for every timed-out, empty-reasoning, or
    # marker-reasoning criterion, so keying on it alone catches BOTH a timeout
    # crash and an instant-death (e.g. low-balance) crash. The old extra
    # `_reasoning_is_unprobed(reasoning)` AND-clause silently undercounted the
    # instant-death case, whose reasoning ("returned no verdict") matches no
    # marker — that is how a balance-death deflation could read as clean.
    unprobed_n = sum(1 for cid in order if not verdicts[cid]["probed"])
    cascade_aborted_n = sum(1 for cid in order if verdicts[cid]["cascade_aborted"])
    any_probed = any(verdicts[cid]["probed"] for cid in order)

    for i, c in enumerate(criteria, start=1):
        log(f"  {i:2d}. {'pass' if c['value'] > 0 else 'fail'}  [{c['id']}] ({c['segment']})")

    # Merged, in RewardKit's own shape, so score() parses it exactly as it
    # parses a single-session run: criteria nested at reward.criteria, each
    # verdict a float `value`.
    merged_dir = os.path.join(LOG_DIR, "rewardkit")
    os.makedirs(merged_dir, exist_ok=True)
    denominator = max(len(criteria), EXPECTED_CRITERIA)
    with open(os.path.join(merged_dir, "reward-details.json"), "w") as fh:
        json.dump({"reward": {"score": round(passed / denominator, 6) if denominator else 0.0,
                              "kind": "segmented", "criteria": criteria,
                              "segments": seg_reports}}, fh, indent=2)
    with open(os.path.join(merged_dir, "reward.json"), "w") as fh:
        json.dump({"reward": round(passed / denominator, 6) if denominator else 0.0}, fh, indent=2)

    METRICS["criteria_timed_out"] = float(timed_out_n)
    METRICS["judge_infra_error"] = 0.0 if any_probed else 1.0
    METRICS["criteria_unprobed"] = float(unprobed_n)
    METRICS["criteria_cascade_aborted"] = float(cascade_aborted_n)
    log(f"segments finished: {passed}/{len(criteria)} criteria "
        f"(timed_out={timed_out_n}, unprobed={unprobed_n}, "
        f"cascade_aborted={cascade_aborted_n}, "
        f"judge_infra_error={METRICS['judge_infra_error']:.0f})")
    return merged_dir


def run_rewardkit():
    """The whole-rubric fallback: browser.toml run in one session, exactly as
    this verifier behaved before segmentation."""
    out_dir = os.path.join(LOG_DIR, "rewardkit")
    _, timed_out = _invoke_rewardkit(RUBRIC_DIR, out_dir, JUDGE_TIMEOUT_SEC)
    if timed_out:
        METRICS["criteria_timed_out"] = 1.0
    return out_dir


def score(out_dir):
    """Read the per-criterion detail; RewardKit's own reward.json is a bare aggregate."""
    details = read_details(out_dir)
    if details is None:
        log("no reward-details.json from the judge")
        METRICS["judge_infra_error"] = 1.0
        write_reward()
        return

    # RewardKit nests the list under "reward" and reports each verdict as a
    # float `value` (1.0 = pass), NOT a boolean `passed`. Reading the root, or
    # looking for `passed`, silently scores a perfect run 0.0 with graded=1.0.
    root = details.get("reward") if isinstance(details.get("reward"), dict) else details
    criteria = root.get("criteria") or root.get("results") or []
    if isinstance(criteria, dict):
        criteria = list(criteria.values())
    # Pin the denominator: a partial detail file (judge died after 20 of 40)
    # must not let 20/20 score 1.0.
    aggregate = _aggregate_criterion_results(criteria)
    total = aggregate["total"]
    passed = aggregate["passed"]
    unprobed = aggregate["unprobed"]
    if len(criteria) != EXPECTED_CRITERIA:
        log(f"WARNING: judged {len(criteria)} criteria, expected {EXPECTED_CRITERIA}")
    write_reward(
        reward=round(passed / total, 6) if total else 0.0,
        browser_passed=float(passed),
        browser_total=float(total),
        rubric_total=float(EXPECTED_CRITERIA),
        graded=1.0,
        criteria_unprobed=float(max(unprobed, METRICS["criteria_unprobed"])),
        criteria_timed_out=float(max(aggregate["timed_out"], METRICS["criteria_timed_out"])),
        criteria_cascade_aborted=float(max(
            aggregate["cascade_aborted"], METRICS["criteria_cascade_aborted"]
        )),
    )
    log(f"scored {passed}/{total}")


def main():
    os.makedirs(LOG_DIR, exist_ok=True)
    write_reward()                                              # floor, before anything can fail
    if METRICS["judge_policy_match"] != 1.0:
        meta = run_metadata()
        log(
            "judge policy mismatch: "
            f"got {meta['judge_backend']} + {meta['judge_model']} "
            f"at {meta['judge_reasoning_effort']}; expected "
            f"{EXPECTED_JUDGE_BACKEND} + {EXPECTED_JUDGE_MODEL} "
            f"at {EXPECTED_JUDGE_REASONING_EFFORT}"
        )
        write_reward(judge_infra_error=1.0)
        return
    capture_app_source()

    if not npm_install():
        log("dependencies could not be installed; the submission is not operable")
        write_reward(no_op=1.0)
        return
    proc = start_app()
    if proc is None:
        log("the submission never reached an operable state")
        write_reward(no_op=1.0)
        return
    proc_holder = {"proc": proc}
    try:
        with open(BROWSER_RUBRIC) as fh:
            _, _, order, _ = split_rubric(fh.read())
        segments = load_segments(order) if order else None
        if segments:
            score(run_segments(segments, proc_holder))
        else:
            score(run_rewardkit())
    finally:
        stop_app(proc_holder.get("proc"))


if __name__ == "__main__":
    try:
        main()
    except BaseException as exc:                                # a crash still scores
        log(f"verifier crashed: {exc!r}")
        try:
            write_reward(judge_infra_error=1.0)
        except Exception:
            pass
        sys.exit(0)
