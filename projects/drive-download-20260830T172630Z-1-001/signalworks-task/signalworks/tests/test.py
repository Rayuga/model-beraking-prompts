#!/usr/bin/env python3
"""Harbor verifier for the Signalworks task.

Runs after the agent phase. Installs the submission's dependencies, starts it on
port 3000, waits for it to answer, then runs RewardKit against
tests/rubric/browser -- a codex CUA judge (openai/gpt-5.6-luna @ max, via OpenRouter) that drives the rendered UI
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

A segment may be marked `restart_app`: the app process is stopped and started
again, with the data directory untouched and no seed re-run, before that segment
is judged -- what makes "everything is persisted to disk" (the brief's own rule)
gradable rather than a re-read of memory. The 20-criterion suite shipped
here grades authorization, dual-control and precision behaviours and sets the
flag on no segment, so no restart is performed; the machinery remains for a
restart-durability segment when one is graded.

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
                              `criteria_timed_out`, `judge_infra_error`.
  /logs/verifier/reward.txt   the single float reward (Harbor fallback).
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

APP_DIR = os.environ.get("SIGNALWORKS_APP_DIR", "/app")
LOG_DIR = os.environ.get("SIGNALWORKS_LOG_DIR", "/logs/verifier")
RUBRIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rubric", "browser")
BROWSER_RUBRIC = os.path.join(RUBRIC_DIR, "browser.toml")
BROWSER_PROMPT = os.path.join(RUBRIC_DIR, "prompt.md")
BROWSER_SEGMENTS = os.path.join(RUBRIC_DIR, "segments.json")
PORT = 3000
BASE_URL = f"http://localhost:{PORT}"
EXPECTED_CRITERIA = 20
# Isolated codex config/auth dir; _write_codex_config() writes the luna@max +
# OpenRouter provider here. Under the log dir so it is captured, never shipped.
CODEX_HOME = os.environ.get("CODEX_HOME") or os.path.join(LOG_DIR, "codex-home")

BOOT_TIMEOUT_SEC = 300
INSTALL_TIMEOUT_SEC = 1800
# Whole-rubric fallback cap, and the total wall-clock budget for all segments
# combined. The segmentation budget MUST be sized so no segment can be starved:
#
#   n_segments x SEGMENT_TIMEOUT_MIN_SEC  <  JUDGE_TIMEOUT_SEC  <  verifier.timeout_sec
#     10        x 1500                    =  15000   <  24000    <  28000 (task.toml)
#
# Guaranteeing every one of the 10 segments at least its MIN before the
# `left <= MIN` skip gate can fire. JUDGE (24000) covers 10 segments at their
# 1500 MIN (15000) with headroom; the 2400 per-segment cap is a rarely-approached
# backstop (this run's segments each ran well under 300s), so no segment is
# skipped even if every judge burns its full per-segment budget. Per-segment
# budget stays in [MIN, CAP] = [1500, 2400]. In practice the paired segments
# finish in ~5-8 min and the isolated single-criterion ones in ~2-3 min, so the
# whole reduced run lands well under the backstops.
#
# Harbor SIGKILLs the verifier at verifier.timeout_sec; if that happened
# mid-segment the only reward on disk would be the 0.0 floor, erasing every
# criterion already earned. JUDGE < verifier means an overrun still reports
# what it finished.
JUDGE_TIMEOUT_SEC = int(os.environ.get("SIGNALWORKS_JUDGE_TIMEOUT", "24000"))
# Per-segment backstop: a stuck judge session is SIGKILLed at this cap rather
# than running to the whole-run budget. Kept at 2400 (40 min): a single hung
# segment must not be able to eat the entire wall-clock budget.
SEGMENT_TIMEOUT_CAP_SEC = float(os.environ.get("SIGNALWORKS_SEGMENT_TIMEOUT", "2400"))
# Never hand a segment less than this. Raised 600 -> 1500 so even a one-criterion
# heavy segment (a settlement money computation, a long driven handback) gets a
# full 25 minutes to sign in, drive the flow and read back the persisted record.
SEGMENT_TIMEOUT_MIN_SEC = 1500.0
# The ruling's ceiling: no judge session carries more than two criteria, and the
# heavy/long-driven ones are isolated one per segment in segments.json. This cap
# is the belt-and-suspenders backstop if segments.json ever asks for more.
MAX_SEGMENT_CRITERIA = 2
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
    "judge_infra_error": 0.0,
    "judge_policy_match": 0.0,
}


def log(msg):
    print(f"[signalworks-verifier] {msg}", flush=True)


def write_reward(**over):
    METRICS.update(over)
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(os.path.join(LOG_DIR, "reward.json"), "w") as fh:
        json.dump(METRICS, fh, indent=2)
    with open(os.path.join(LOG_DIR, "reward.txt"), "w") as fh:   # Harbor fallback
        fh.write(str(METRICS["reward"]))


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


def _write_codex_config():
    """Pin the codex judge to openai/gpt-5.6-luna @ max on OpenRouter, non-interactive.
    PROVEN recipe (parks&rec / windmanage). wire_api MUST be "responses" (codex 0.150.1
    dropped "chat"); env_key is OPENROUTER_API_KEY; supports_websockets=false avoids the
    wss:// storm; a custom provider is mandatory (codex ignores OPENAI_BASE_URL for its
    built-in openai provider). rewardkit 0.1.7 never passes effort to an agent judge, so
    max lives ONLY here. Idempotent."""
    os.makedirs(CODEX_HOME, exist_ok=True)
    reasoning_effort = os.environ.get("REWARDKIT_REASONING_EFFORT", "max")
    with open(os.path.join(CODEX_HOME, "config.toml"), "w") as fh:
        fh.write(
            f'model_provider = "openrouter"\n'
            f'model_reasoning_effort = "{reasoning_effort}"\n'
            f'approval_policy = "never"\n'
            f'sandbox_mode = "danger-full-access"\n'
            f'\n'
            f'[model_providers.openrouter]\n'
            f'name = "OpenRouter"\n'
            f'base_url = "https://openrouter.ai/api/v1"\n'
            f'env_key = "OPENROUTER_API_KEY"\n'
            f'wire_api = "responses"\n'
            f'supports_websockets = false\n'
            f'\n'
            f'[mcp_servers.playwright]\n'
            f'command = "playwright-mcp"\n'
            f'args = ["--headless", "--isolated", "--executable-path=/usr/local/bin/chromium", "--no-sandbox"]\n'
            f'default_tools_approval_mode = "approve"\n'
        )
    log(f"wrote codex judge config -> {CODEX_HOME}/config.toml (gpt-5.6-luna @ max, OpenRouter)")


def _judge_policy_match():
    """1.0 iff the judge about to run is codex + gpt-5.6-luna + max."""
    judge = os.environ.get("REWARDKIT_JUDGE", "codex")
    model = os.environ.get("REWARDKIT_MODEL", "openai/gpt-5.6-luna")
    effort = os.environ.get("REWARDKIT_REASONING_EFFORT", "max")
    return 1.0 if (judge == "codex" and model.split("/")[-1].startswith("gpt-5.6-luna")
                   and effort == "max") else 0.0


def _rewardkit_env():
    """The judge is a codex agent (openai/gpt-5.6-luna @ max) driving Playwright MCP,
    routed through OpenRouter. codex does not read OPENAI_API_KEY on its own — RewardKit
    runs `codex login --with-api-key` from it — and the OpenRouter route + reasoning
    effort live in CODEX_HOME/config.toml (see _write_codex_config)."""
    router = os.environ.get("OPENROUTER_API_KEY", "")
    env = {
        **os.environ,
        "PORT": str(PORT),
        "BASE_URL": BASE_URL,
        "APP_PUBLIC_URL": BASE_URL,
        "REWARDKIT_JUDGE": os.environ.get("REWARDKIT_JUDGE", "codex"),
        "REWARDKIT_MODEL": os.environ.get("REWARDKIT_MODEL", "openai/gpt-5.6-luna"),
        "CODEX_HOME": CODEX_HOME,
    }
    if not env.get("OPENAI_API_KEY") and router:
        env["OPENAI_API_KEY"] = router
    if router:
        env.setdefault("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
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
                "codex judge cannot zombie the browser into the next segment")
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


def _segment_note(seg, position, total):
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


def write_segment_rubric(dest, header, blocks, seg, position, total, prompt_text):
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
        fh.write(_inject_note(prompt_text, _segment_note(seg, position, total)))


def _criterion_summary(block, limit=400):
    _, _, rest = block.partition('description = """')
    text, _, _ = rest.partition('"""')
    flat = " ".join(text.split())
    return flat[:limit - 3] + "..." if len(flat) > limit else flat


_UNPROBED_MARKERS = (
    "criterion was never judged", "not tested", "never tested", "never observed",
    "not exercised", "budget", "exhausted before", "judge timed out",
    "timed out after", "did not come back up",
)


def _reasoning_is_unprobed(reasoning):
    why = (reasoning or "").lower()
    return any(m in why for m in _UNPROBED_MARKERS)


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
                      "timed_out": False, "probed": False}
                for cid in order}
    seg_reports = []
    workdir = tempfile.mkdtemp(prefix="signalworks-rubric-")
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

            if seg.get("restart_app"):
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
            write_segment_rubric(seg_dir, header, blocks, seg, i, len(segments), prompt_text)
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
                crit_timeout = timed_out or ("timed out" in str(c.get("error") or "").lower())
                reasoning = (c.get("reasoning") or "").strip()
                if "value" in c and c.get("value") is not None:
                    value = 1.0 if float(c.get("value") or 0) >= 0.5 else 0.0
                else:
                    verdict = c.get("passed", c.get("pass", c.get("result")))
                    value = 1.0 if verdict is True or verdict == "PASS" or verdict == 1 else 0.0
                    if verdict is None:
                        crit_timeout = crit_timeout or not reasoning
                verdicts[cid]["value"] = 0.0 if crit_timeout else value
                verdicts[cid]["reasoning"] = reasoning or (
                    "judge timed out; criterion scored 0.0" if crit_timeout else "")
                verdicts[cid]["timed_out"] = crit_timeout
                verdicts[cid]["probed"] = (not crit_timeout and bool(reasoning)
                                           and not _reasoning_is_unprobed(reasoning))

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
                 "timed_out": bool(verdicts[cid]["timed_out"])}
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
    unprobed_n = sum(1 for cid in order
                     if not verdicts[cid]["probed"] and verdicts[cid]["value"] <= 0)
    any_probed = any(verdicts[cid]["probed"] or verdicts[cid]["value"] > 0 for cid in order)

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
    log(f"segments finished: {passed}/{len(criteria)} criteria "
        f"(timed_out={timed_out_n}, unprobed={unprobed_n}, "
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
    total = max(len(criteria), EXPECTED_CRITERIA)
    passed = 0
    unprobed = 0
    for c in criteria:
        if "value" in c:                                   # RewardKit's own shape
            v = c.get("value")
            if v is None:
                unprobed += 1
            elif float(v) >= 0.5:
                passed += 1
            continue
        verdict = c.get("passed", c.get("pass", c.get("result")))
        if verdict is True or verdict == "PASS" or verdict == 1:
            passed += 1
        elif verdict is None:
            unprobed += 1
    if len(criteria) != EXPECTED_CRITERIA:
        log(f"WARNING: judged {len(criteria)} criteria, expected {EXPECTED_CRITERIA}")
    write_reward(
        reward=round(passed / total, 6) if total else 0.0,
        browser_passed=float(passed),
        browser_total=float(total),
        graded=1.0,
        criteria_unprobed=float(max(unprobed, METRICS["criteria_unprobed"])),
    )
    log(f"scored {passed}/{total}")


def main():
    os.makedirs(LOG_DIR, exist_ok=True)
    write_reward()                                              # floor, before anything can fail
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
    # Pin the codex judge to gpt-5.6-luna @ max on OpenRouter and record policy match
    # before a single criterion is graded.
    _write_codex_config()
    METRICS["judge_policy_match"] = _judge_policy_match()
    write_reward()
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
