#!/usr/bin/env python3
import hashlib
import http.cookiejar
import urllib.request
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import tomllib


DIMS = {"render", "constraints", "functional", "polish", "visual"}
OUT = Path(os.environ.get("SMOKE_RESULTS_DIR", "/results"))
CHECKS = []


def identity():
    path = Path("/usr/local/bin/codex")
    return {"target": str(path.resolve()), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def command(args, timeout=20, env=None):
    result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", timeout=timeout, env=env)
    if result.returncode:
        raise RuntimeError(f"Command returned {result.returncode}: {args}; {result.stderr[:2000]}")
    return result.stdout


def check(name, condition, details=None):
    CHECKS.append({"name": name, "passed": bool(condition), "details": details})
    print(("PASS " if condition else "FAIL ") + name, flush=True)


def fake_rewardkit():
    from rewardkit.runner import discover

    root = Path(sys.argv[-1])
    log = Path(os.environ["VERIFIER_LOG_DIR"])
    judges = {p.parent.name: tomllib.loads(p.read_text(encoding="utf-8")) for p in root.glob("*/judge.toml")}
    if set(judges) != DIMS or list(root.glob("*.py")):
        raise RuntimeError("Unexpected reward discovery candidates")
    # Exercise the exact generated lifecycle command on the real golden server,
    # retaining a real session across restart; no credentials enter artifacts.
    private = Path('/opt/common-ground-verifier')
    for name in ('app-lifecycle', 'prompt-provenance', 'score'):
        path = private / name
        assert path.read_text().startswith('#!/usr/local/bin/python3\n')
        assert path.stat().st_mode & 0o777 == 0o700
    jar = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(jar))
    payload = json.dumps({'email':'ruth.adebayo@commonground.example','password':'CommonGround!2026'}).encode()
    with client.open(urllib.request.Request('http://127.0.0.1:3000/api/auth/login',data=payload,headers={'Content-Type':'application/json'}),timeout=5) as response:
        assert response.status == 200
    def ballots():
        with client.open('http://127.0.0.1:3000/api/ballots',timeout=5) as response:
            return json.load(response)
    before = ballots()
    assert len(before['ballots']) == 4
    state = json.loads(Path('/logs/verifier/app-lifecycle.json').read_text())
    assert state['entry'] == '/app/server.js'
    uid = next(line for line in Path('/proc',str(state['pid']),'status').read_text().splitlines() if line.startswith('Uid:'))
    assert set(uid.split()[1:]) == {'65534'}
    command([str(private/'app-lifecycle'),'restart'],timeout=75)
    assert ballots() == before
    discovered = discover(root)
    discovered_names = [item.name for item in discovered]
    if set(discovered_names) - (DIMS | {"reward"}) or any(discovered_names.count(name) != 1 for name in DIMS):
        raise RuntimeError("Unexpected actual RewardKit discovery: " + repr(discovered_names))
    result = {
        "rewardkit_discovered_names": discovered_names,
        "judges": sorted(judges), "criteria_count": sum(len(j.get("criterion", [])) for j in judges.values()),
        "root_python_candidates": [], "argv": sys.argv[2:],
        "golden_start_and_restart": True, "private_executable_modes": True, "unprivileged_node_entry": state["entry"],
        "codex_path": shutil.which("codex"), "genuine_codex": identity(),
        "version": command(["codex", "--version"]),
        "login_help": command(["codex", "login", "--help"]),
    }
    (log / "fake-rewardkit-discovery.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    values = {"reward": 0.9876, "render": 1, "constraints": int(os.environ["SMOKE_RUN"] == "1"),
              "functional": 0.5, "polish": 0.25, "visual": 0.75}
    (log / "reward.json").write_text(json.dumps(values), encoding="utf-8")
    print("Offline synthetic dimension scores written; no model invoked.")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    Path("/logs/verifier").mkdir(parents=True, exist_ok=True)
    os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"
    started = time.monotonic()
    if Path('/task/tests').is_dir():
        hashes = lambda root: {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}
        check('image contains exact final verifier source bytes', hashes(Path('/tests')) == hashes(Path('/task/tests')))
    baseline = identity()
    check("genuine npm Codex target before bootstrap", "/@openai/codex/" in baseline["target"], baseline)
    initial = {"version": command(["/usr/local/bin/codex", "--version"]),
               "login_help": command(["/usr/local/bin/codex", "login", "--help"])}
    check("genuine Codex version and login help terminate", "0.151.0" in initial["version"] and "login" in initial["login_help"].lower(), initial)
    app = Path("/app")
    app.mkdir(parents=True, exist_ok=True)
    fixture_created = False
    seed = Path('/assets/artifacts')
    seed.mkdir(parents=True,exist_ok=True)
    shutil.copyfile('/task/environment/assets/artifacts/common_ground_seed.json',seed/'common_ground_seed.json')
    subprocess.run(['bash','/task/solution/solve.sh'],check=True)
    fakebin = Path("/tmp/common-ground-r20-smoke-bin")
    fakebin.mkdir(mode=0o700, exist_ok=True)
    fake = fakebin / "rewardkit"
    fake.write_text("#!/bin/sh\nexec python3 " + str(Path(__file__).resolve()) + ' --fake-rewardkit "$@"\n', encoding="utf-8")
    fake.chmod(0o700)
    for attempt, expected in ((1, 0.5), (2, 0.0)):
        logdir = OUT / f"runner-{attempt}"
        logdir.mkdir(mode=0o700, exist_ok=True)
        environment = os.environ.copy()
        environment.update(PATH=str(fakebin) + ":" + environment["PATH"], VERIFIER_LOG_DIR=str(logdir), SMOKE_RUN=str(attempt))
        with (logdir / "runner.log").open("w", encoding="utf-8") as log:
            process = subprocess.run(["bash", "/tests/test.sh"], env=environment, stdout=log, stderr=subprocess.STDOUT, timeout=100)
        check(f"runner {attempt} exits successfully", process.returncode == 0)
        check(f"runner {attempt} preserves genuine Codex", identity() == baseline, identity())
        discovery_path = logdir / "fake-rewardkit-discovery.json"
        check(f"runner {attempt} reaches fake RewardKit", discovery_path.is_file())
        if not discovery_path.is_file():
            continue
        discovery = json.loads(discovery_path.read_text(encoding="utf-8"))
        check(f"runner {attempt} launches real golden Node app unprivileged and restarts with session/data retained", discovery['golden_start_and_restart'] and discovery['unprivileged_node_entry'] == '/app/server.js')
        check(f"runner {attempt} invokes private executable helpers with mode 700", discovery['private_executable_modes'])
        check(f"runner {attempt} has five judge candidates and no root Python imports", set(discovery["judges"]) == DIMS and discovery["root_python_candidates"] == [], discovery["judges"])
        check(f"runner {attempt} actual RewardKit discovers all five dimensions", DIMS <= set(discovery["rewardkit_discovered_names"]) <= (DIMS | {"reward"}), discovery["rewardkit_discovered_names"])
        check(f"runner {attempt} loads all 86 criteria", discovery['criteria_count'] == 86, discovery['criteria_count'])
        check(f"runner {attempt} uses private Codex shim", discovery["codex_path"] == "/opt/common-ground-verifier/bin/codex", discovery["codex_path"])
        check(f"runner {attempt} shim version/login terminate and delegate", discovery["version"] == initial["version"] and "login" in discovery["login_help"].lower())
        reward = json.loads((logdir / "reward.json").read_text(encoding="utf-8"))
        text = float((logdir / "reward.txt").read_text(encoding="utf-8"))
        check(f"runner {attempt} final score follows composition", reward["reward"] == expected and text == expected and reward["graded"] == 1 and reward["no_op"] == 0, reward)
        ctrf = json.loads((logdir / "ctrf.json").read_text(encoding="utf-8"))
        check(f"runner {attempt} exports five CTRF dimensions", ctrf["summary"]["total"] == 5 and {case["name"] for case in ctrf["tests"]} == DIMS)
        provenance = json.loads((logdir / "prompt-provenance.json").read_text(encoding="utf-8"))
        check(f"runner {attempt} hashes all five prompts and private helpers", set(provenance["judges"]) == DIMS and len(provenance["resource_sha256"]) == 5)
    check("genuine Codex still terminates after second bootstrap", command(["/usr/local/bin/codex", "--version"]) == initial["version"] and "login" in command(["/usr/local/bin/codex", "login", "--help"]).lower())
    report = {"passed": sum(c["passed"] for c in CHECKS), "failed": sum(not c["passed"] for c in CHECKS),
              "checks": CHECKS, "elapsed_sec": round(time.monotonic() - started, 3), "health_fixture_created": fixture_created, "real_golden_app_installed": True,
              "scope": "Exact shipped test.sh, offline fake RewardKit dimension scores, genuine Codex non-model commands; no paid model or rubric verdict validation."}
    (OUT / "runtime-smoke-results.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return int(report["failed"] > 0)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--fake-rewardkit":
        fake_rewardkit()
    else:
        try:
            sys.exit(main())
        except Exception as error:
            OUT.mkdir(parents=True, exist_ok=True)
            (OUT / "runtime-smoke-results.json").write_text(json.dumps({"passed": sum(c["passed"] for c in CHECKS), "failed": 1 + sum(not c["passed"] for c in CHECKS), "checks": CHECKS, "error": f"{type(error).__name__}: {error}"}, indent=2) + "\n", encoding="utf-8")
            raise
