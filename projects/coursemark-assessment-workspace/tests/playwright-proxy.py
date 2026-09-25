#!/usr/bin/env python3
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time


def main():
    executable = os.environ["COURSEMARK_PLAYWRIGHT_BIN"]
    arguments = sys.argv[1:]
    if any(value in arguments for value in ("--help", "-h", "--version", "-V")):
        os.execv(executable, [executable, *arguments])
    folder = Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier")) / "browser-runtime"
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    events = folder / f"{os.getpid()}.jsonl"
    incoming = queue.Queue()
    pending = {}
    waiting = []
    initialization = None
    worker = None
    generation = 0
    recovering = False
    reset_notice = False
    stderr_file = None

    def log(event, **values):
        with events.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"event": event, "time_ns": time.time_ns(), **values}) + "\n")

    def read_lines(stream, kind, number):
        try:
            for line in iter(stream.readline, b""):
                incoming.put((kind, number, line))
        finally:
            incoming.put((kind + "_closed", number, None))

    def emit(message):
        sys.stdout.buffer.write(json.dumps(message, separators=(",", ":")).encode() + b"\n")
        sys.stdout.buffer.flush()

    def refuse(message, reason):
        if "id" not in message:
            return
        if message.get("method") == "tools/call":
            emit({"jsonrpc": "2.0", "id": message["id"], "result": {
                "content": [{"type": "text", "text": reason}], "isError": True}})
        else:
            emit({"jsonrpc": "2.0", "id": message["id"], "error": {
                "code": -32001, "message": reason}})

    def send(message):
        try:
            worker.stdin.write(json.dumps(message, separators=(",", ":")).encode() + b"\n")
            worker.stdin.flush()
        except (BrokenPipeError, OSError):
            incoming.put(("worker_closed", generation, None))

    def forward(message):
        if "method" in message and "id" in message:
            pending[message["id"]] = message
        send(message)

    def start():
        nonlocal worker, stderr_file
        stderr_file = (folder / f"{os.getpid()}-{generation}.stderr.log").open("ab", buffering=0)
        worker = subprocess.Popen([executable, *arguments], stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, stderr=stderr_file)
        log("worker_started", generation=generation, worker_pid=worker.pid)
        threading.Thread(target=read_lines, args=(worker.stdout, "worker", generation), daemon=True).start()

    threading.Thread(target=read_lines, args=(sys.stdin.buffer, "client", 0), daemon=True).start()
    start()
    try:
        while True:
            kind, number, line = incoming.get()
            if kind == "client_closed":
                return
            if kind.startswith("worker") and number != generation:
                continue
            if kind == "worker_closed":
                if worker is None:
                    continue
                code = worker.poll()
                if code is None:
                    worker.kill()
                worker.wait()
                stderr_file.close()
                log("transport_lost", generation=generation, exit_code=code,
                    pending_methods=[value.get("method") for value in pending.values()])
                reason = ("Playwright worker transport was lost. This tool's result is unverified; "
                          "the request was NOT replayed. Preserve prior evidence and inspect current "
                          "server state before any further write. ")
                can_recover = generation == 0 and initialization is not None
                reason += ("A fresh browser worker is being initialized. Navigate to the local app "
                           "and authenticate through its UI; old browser contexts no longer exist."
                           if can_recover else "The single transport recovery is exhausted. Record "
                           "remaining observations as evaluation_incomplete and return verdicts.")
                reset_notice = not any(value.get("method") == "tools/call" for value in pending.values())
                for message in list(pending.values()) + waiting:
                    refuse(message, reason)
                pending.clear()
                waiting.clear()
                worker = None
                if can_recover:
                    generation += 1
                    recovering = True
                    start()
                    send({**initialization, "id": "coursemark-recovery-initialize"})
                continue
            if kind == "worker":
                try:
                    message = json.loads(line)
                except (ValueError, UnicodeError):
                    log("invalid_worker_line", bytes=len(line))
                    continue
                if recovering and message.get("id") == "coursemark-recovery-initialize":
                    if "error" in message:
                        worker.kill()
                        continue
                    send({"jsonrpc": "2.0", "method": "notifications/initialized"})
                    recovering = False
                    log("worker_reinitialized", generation=generation)
                    for queued in waiting:
                        forward(queued)
                    waiting.clear()
                    continue
                if "method" not in message:
                    pending.pop(message.get("id"), None)
                sys.stdout.buffer.write(line)
                sys.stdout.buffer.flush()
                continue
            if kind == "client":
                message = json.loads(line)
                if message.get("method") == "initialize":
                    initialization = message
                if worker is None:
                    refuse(message, "Playwright transport recovery is exhausted; record unperformed "
                           "observations as evaluation_incomplete. No app failure is inferred.")
                elif reset_notice and message.get("method") == "tools/call":
                    reset_notice = False
                    refuse(message, "Playwright was restarted after a transport loss. Old browser "
                           "contexts are unavailable. This request was not executed. Navigate and "
                           "reauthenticate; verify server state before any write. Preserve prior evidence.")
                elif recovering:
                    waiting.append(message)
                else:
                    forward(message)
    finally:
        if worker is not None:
            worker.terminate()
            try:
                worker.wait(timeout=3)
            except subprocess.TimeoutExpired:
                worker.kill()
                worker.wait()
        if stderr_file is not None:
            stderr_file.close()


if __name__ == "__main__":
    main()
