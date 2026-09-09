"""Trusted process control; restarting never deletes or edits application data."""

import argparse
import json
import os
import signal
import subprocess
import time
import urllib.request
from pathlib import Path

STATE = Path("/logs/verifier/app-lifecycle.json")


def stop(config):
    pid = config.get("pid")
    if not pid:
        return
    try:
        os.killpg(pid, signal.SIGTERM)
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            os.killpg(pid, 0)
            time.sleep(0.1)
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    config.pop("pid", None)
    STATE.write_text(json.dumps(config))


def start(config):
    with Path(config["log"]).open("ab") as log:
        child = subprocess.Popen(
            ["setpriv", "--reuid=65534", "--regid=65534", "--clear-groups",
             "node", config["entry"]],
            env={"PATH": "/usr/local/bin:/usr/bin:/bin",
                 "NODE_PATH": "/usr/local/lib/node_modules", "PORT": "3000",
                 "HOME": "/tmp/common-ground-submission",
                 "DB_PATH": config["database"], "SEED_PATH": config["seed"]},
            cwd=str(Path(config["entry"]).parent),
            stdin=subprocess.DEVNULL, stdout=log, stderr=log,
            start_new_session=True,
        )
    config["pid"] = child.pid
    STATE.write_text(json.dumps(config))
    print(f"Application process: {child.pid}", flush=True)


def ready():
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:3000/api/health", timeout=2) as response:
                if 200 <= response.status < 300:
                    return
        except OSError:
            pass
        time.sleep(0.5)
    raise RuntimeError("Application did not become ready within 60 seconds")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["start", "restart", "stop"])
    parser.add_argument("--entry")
    parser.add_argument("--database")
    parser.add_argument("--seed")
    parser.add_argument("--log", default="/logs/verifier/app.log")
    args = parser.parse_args()
    if args.action == "start":
        if not all((args.entry, args.database, args.seed)):
            parser.error("start requires entry, database and seed")
        STATE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        config = {"entry": args.entry, "database": args.database,
                  "seed": args.seed, "log": args.log}
    else:
        if not STATE.exists():
            if args.action == "stop":
                return
            raise RuntimeError("Application has not been started by the verifier")
        config = json.loads(STATE.read_text())
        stop(config)
    if args.action != "stop":
        start(config)
        if args.action == "restart":
            ready()
            print("Restart ready; existing database preserved.")


if __name__ == "__main__":
    os.umask(0o077)
    main()
