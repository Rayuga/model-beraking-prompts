from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
TASK = ROOT / ".qc-cache/coldwater-2026-10-01-history-hardening-r2/task"
OUTPUT = Path(__file__).with_name("security_scan.json")

PATTERNS = {
    "credential_shape": re.compile(r"\b(?:AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)"),
    "host_path": re.compile(r"(?:[A-Za-z]:[\\/](?:Users|Documents|Workspaces|Projects)[\\/]|/(?:Users|home)/[A-Za-z0-9._-]+/)"),
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "injection_phrase": re.compile(r"(?:ignore (?:all )?(?:previous|prior|above) instructions|reveal (?:the )?(?:system|developer) prompt|you are now (?:the|a) (?:system|developer)|override (?:your|the) instructions)", re.I),
    "remote_url": re.compile(r"https?://[^\s\"'<>`\\)]+", re.I),
    "remote_fetch": re.compile(r"\b(?:curl|wget|git clone|npm install|pip3? install|npx|uvx)\b", re.I),
}

files = []
hits = []
for path in sorted(TASK.rglob("*")):
    if not path.is_file():
        continue
    raw = path.read_bytes()
    relative = path.relative_to(TASK).as_posix()
    files.append({"path": relative, "size": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
    text = raw.decode("utf-8", errors="replace")
    for line_number, line in enumerate(text.splitlines(), 1):
        for kind, pattern in PATTERNS.items():
            for match in pattern.finditer(line):
                hits.append({"path": relative, "line": line_number, "kind": kind, "value": match.group(0)[:160]})

report = {
    "task_root": str(TASK.relative_to(ROOT)).replace("\\", "/"),
    "file_count": len(files),
    "files": files,
    "hit_counts": dict(Counter(hit["kind"] for hit in hits)),
    "hits": hits,
}
OUTPUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"file_count": len(files), "hit_counts": report["hit_counts"], "output": str(OUTPUT)}, indent=2))
