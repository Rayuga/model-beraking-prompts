#!/usr/bin/env python3
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import time
import tomllib
import uuid


ROOT = Path(__file__).resolve().parent
DIMENSIONS = ("render", "constraints", "functional", "polish", "visual")


def log_root():
    return Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier")).resolve()


def checked_criterion(dimension, criterion):
    if dimension not in DIMENSIONS:
        raise ValueError("Unknown dimension")
    config = tomllib.loads((ROOT / dimension / "judge.toml").read_text(encoding="utf-8"))
    allowed = {item["id"] for item in config["criterion"]} | {"_gate", "_handoff"}
    if criterion not in allowed:
        raise ValueError("Unknown criterion")


def evidence_path():
    folder = log_root() / "evidence"
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    return folder / "checkpoints.jsonl"


def record(dimension, criterion, step, data):
    checked_criterion(dimension, criterion)
    if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,160}", step):
        raise ValueError("Use a nonempty alphanumeric checkpoint label")
    if not isinstance(data, dict) or not data:
        raise ValueError("Checkpoint must be a nonempty JSON object of observed evidence")
    path = evidence_path()
    with path.open("a+", encoding="utf-8", newline="\n") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        handle.seek(0)
        sequence = sum(1 for line in handle if line.strip()) + 1
        entry = {
            "sequence": sequence,
            "recorded_at_ns": time.time_ns(),
            "dimension": dimension,
            "criterion": criterion,
            "step": step,
            "data": data,
        }
        handle.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    return {"recorded": sequence, "path": str(path), "dimension": dimension, "criterion": criterion, "step": step}


def read(dimension, criterion, latest):
    checked_criterion(dimension, criterion)
    path = evidence_path()
    entries = []
    if path.exists():
        with path.open(encoding="utf-8") as handle:
            fcntl.flock(handle, fcntl.LOCK_SH)
            entries = [json.loads(line) for line in handle if line.strip()]
    matches = [entry for entry in entries if entry["dimension"] == dimension and entry["criterion"] == criterion]
    return matches[-1] if latest and matches else None if latest else matches


def export_traces():
    root = log_root()
    marker = root / "judge-traces" / "started.json"
    if not marker.exists():
        return {"exported": 0, "reason": "No trace collection was initialized"}
    start = json.loads(marker.read_text(encoding="utf-8"))["started_at_ns"]
    session_root = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))) / "sessions"
    destination = root / "judge-traces" / "sessions"
    results = []
    for source in sorted(session_root.rglob("rollout-*.jsonl")) if session_root.is_dir() else []:
        if source.is_symlink() or source.stat().st_mtime_ns < start:
            continue
        relative = source.relative_to(session_root)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        shutil.copyfile(source, target)
        target.chmod(0o600)
        results.append({"path": str(target.relative_to(root)), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "bytes": target.stat().st_size})
    result = {"exported": len(results), "sessions": results}
    (root / "judge-traces" / "session-export.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
    return result


def initialize():
    root = log_root() / "judge-traces"
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    marker = root / "started.json"
    with marker.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump({"started_at_ns": time.time_ns()}, handle)
        handle.write("\n")
    return {"trace_directory": str(root)}


def mirror_stream(descriptor, path):
    original = os.dup(descriptor)
    reader, writer = os.pipe()
    pid = os.fork()
    if pid == 0:
        os.close(writer)
        try:
            with path.open("ab", buffering=0) as output:
                while True:
                    data = os.read(reader, 65536)
                    if not data:
                        break
                    output.write(data)
                    os.fsync(output.fileno())
                    remaining = memoryview(data)
                    while remaining:
                        try:
                            written = os.write(original, remaining)
                            remaining = remaining[written:]
                        except BrokenPipeError:
                            break
        finally:
            os.close(reader)
            os.close(original)
        os._exit(0)
    os.close(reader)
    os.close(original)
    os.dup2(writer, descriptor)
    os.close(writer)


def trace_codex(arguments):
    executable = os.environ.get("COURSEMARK_CODEX_BIN")
    if not executable or not Path(executable).is_file():
        raise ValueError("The original Codex executable is unavailable")
    if arguments and arguments[0] == "exec":
        folder = log_root() / "judge-traces"
        folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        dimension = "unknown"
        for argument in arguments:
            match = re.search(r"Prompt version: coursemark-assessment-workspace-(render|constraints|functional|polish|visual)-", argument)
            if match:
                dimension = match.group(1)
                break
        label = f"{time.time_ns()}-{dimension}-{uuid.uuid4().hex[:8]}"
        (folder / f"{label}.json").write_text(json.dumps({"dimension": dimension, "pid": os.getpid(), "started_at_ns": time.time_ns()}) + "\n", encoding="utf-8", newline="\n")
        sys.stdout.flush()
        sys.stderr.flush()
        mirror_stream(1, folder / f"{label}.stdout.log")
        mirror_stream(2, folder / f"{label}.stderr.log")
    os.execv(executable, [executable, *arguments])


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "trace-codex":
        trace_codex(sys.argv[2:])
        return
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("record", "read"):
        command = sub.add_parser(name)
        command.add_argument("dimension", choices=DIMENSIONS)
        command.add_argument("criterion")
        if name == "record":
            command.add_argument("step")
        else:
            command.add_argument("--latest", action="store_true")
    sub.add_parser("initialize")
    sub.add_parser("export-traces")
    args = parser.parse_args()
    if args.command == "record":
        result = record(args.dimension, args.criterion, args.step, json.load(sys.stdin))
    elif args.command == "read":
        result = read(args.dimension, args.criterion, args.latest)
    elif args.command == "initialize":
        result = initialize()
    else:
        result = export_traces()
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
