import argparse
import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TESTS = ROOT / "projects/common-ground-ballot/tests"
IMAGE = "ballot-verifier:20260916-r19-shipped"


def snapshot():
    return {
        str(path.relative_to(TESTS)).replace("\\", "/"): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(TESTS.rglob("*"))
        if path.is_file()
    }


def run_logged(command, name, timeout):
    started = time.monotonic()
    record = {
        "command": command,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "timeout_sec": timeout,
        "log": name + ".log",
    }
    print("Starting " + name, flush=True)
    with (HERE / record["log"]).open("w", encoding="utf-8", newline="\n") as log:
        try:
            result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=timeout)
            record["returncode"] = result.returncode
            record["passed"] = result.returncode == 0
        except subprocess.TimeoutExpired:
            record.update(returncode=None, passed=False, timed_out=True)
        except OSError as error:
            log.write(str(error) + "\n")
            record.update(returncode=None, passed=False, error=str(error))
    record["elapsed_sec"] = round(time.monotonic() - started, 3)
    print(json.dumps(record), flush=True)
    return record


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["build", "cli", "all"], nargs="?", default="all")
    args = parser.parse_args()
    checks = []
    report = {"image": IMAGE, "dockerfile": str(TESTS / "Dockerfile"), "phase": args.phase}
    report["context_before"] = snapshot()
    if args.phase in ("build", "all"):
        checks.append(run_logged([
            "docker", "build", "--progress", "plain", "--tag", IMAGE,
            "--file", str(TESTS / "Dockerfile"), str(TESTS),
        ], "shipped-dockerfile-build", 1800))
    if args.phase in ("cli", "all") and all(check["passed"] for check in checks):
        shell = "set -eu; test ! -e /usr/local/bin/codex-original; test -L /usr/local/bin/codex; readlink -f /usr/local/bin/codex; timeout 20 codex --version; timeout 20 codex login --help; test ! -e /root/.codex/auth.json"
        checks.append(run_logged([
            "docker", "run", "--rm", "--network", "none", "--entrypoint", "sh",
            IMAGE, "-c", shell,
        ], "genuine-codex-cli", 60))
    report["context_after"] = snapshot()
    report["context_changed_during_check"] = report["context_before"] != report["context_after"]
    report["checks"] = checks
    report["passed"] = sum(check["passed"] for check in checks)
    report["failed"] = sum(not check["passed"] for check in checks)
    output = HERE / ("docker-" + args.phase + "-results.json")
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("Report: " + str(output), flush=True)
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
