#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HELPER = sys.argv[1] if len(sys.argv) > 1 else ""
SAFE_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
HELPER_TIMEOUT_SEC = 55

TOOL = {
    "name": "restart_app",
    "description": (
        "Stop the running application server process and relaunch the same "
        "application on the same database, then wait until it answers HTTP. "
        "Single use per verification run: call it only for the persistence "
        "criterion."
    ),
    "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
}


def restart() -> tuple[bool, str]:
    helper = Path(HELPER)
    if not HELPER or not helper.is_file():
        return False, f"restart helper not found: {HELPER!r}"
    marker = helper.with_name(helper.name + ".used")
    if marker.exists():
        return False, "restart_app was already used in this verification run; it is single use"
    marker.touch()
    try:
        proc = subprocess.run(
            ["/bin/bash", str(helper)],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=HELPER_TIMEOUT_SEC,
            env={"PATH": SAFE_PATH},
        )
    except subprocess.TimeoutExpired:
        return False, f"restart helper timed out after {HELPER_TIMEOUT_SEC}s"
    output = (proc.stdout + proc.stderr).strip()
    if proc.returncode != 0:
        return False, f"restart failed (exit {proc.returncode}): {output}"
    return True, "restart complete: the server was relaunched on the same database and answers HTTP"


def reply(msg_id, result=None, error=None) -> None:
    msg = {"jsonrpc": "2.0", "id": msg_id}
    if error is not None:
        msg["error"] = error
    else:
        msg["result"] = result
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def handle(req: dict) -> None:
    method, msg_id = req.get("method"), req.get("id")
    params = req.get("params") or {}
    if msg_id is None:
        return
    if method == "initialize":
        reply(msg_id, {
            "protocolVersion": params.get("protocolVersion") or "2025-06-18",
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": "task-verifier", "version": "1.0.0"},
        })
    elif method == "ping":
        reply(msg_id, {})
    elif method == "tools/list":
        reply(msg_id, {"tools": [TOOL]})
    elif method == "tools/call":
        if params.get("name") != TOOL["name"]:
            reply(msg_id, error={"code": -32602, "message": f"unknown tool: {params.get('name')}"})
            return
        ok, text = restart()
        reply(msg_id, {"content": [{"type": "text", "text": text}], "isError": not ok})
    else:
        reply(msg_id, error={"code": -32601, "message": f"method not found: {method}"})


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            reply(None, error={"code": -32700, "message": "parse error"})
            continue
        if isinstance(req, dict):
            handle(req)


if __name__ == "__main__":
    main()
