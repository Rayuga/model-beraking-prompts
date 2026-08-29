"""Positive checks for the requested single-file, no-library implementation."""
import json
from pathlib import Path

from rewardkit import criterion
import rewardkit as rk


P = json.loads(Path("/tmp/probe.json").read_text()) if Path("/tmp/probe.json").exists() else {}


@criterion(description="every script is inline and contains executable code")
def scripts_are_inline(workspace: Path) -> bool:
    scripts = P.get("scripts") or []
    return bool(scripts) and all(not s.get("src") and s.get("inline_len", 0) > 100 for s in scripts)


@criterion(description="all document styles are provided by inline style elements")
def styles_are_inline(workspace: Path) -> bool:
    sheets = P.get("stylesheets") or []
    return bool(sheets) and all(s.get("tag") == "style" and s.get("inline_len", 0) > 100 for s in sheets)


@criterion(description="the complete app is delivered as one substantial index.html file")
def single_file_app(workspace: Path) -> bool:
    return bool(P.get("exists") and P.get("bytes", 0) >= 2500)


@criterion(description="the app still renders when every non-file network request is blocked")
def renders_offline(workspace: Path) -> bool:
    return bool(P.get("render_ok") and P.get("offline_render_ok"))


@criterion(description="the drawing surface remains interactive with the network blocked")
def draws_offline(workspace: Path) -> bool:
    return bool(P.get("offline_draws"))


@criterion(description="the running app makes no external network requests")
def no_external_requests(workspace: Path) -> bool:
    return bool(P.get("render_ok") and not P.get("external_requests"))


rk.scripts_are_inline(weight=1.0)
rk.styles_are_inline(weight=1.0)
rk.single_file_app(weight=1.0)
rk.renders_offline(weight=1.0)
rk.draws_offline(weight=1.0)
rk.no_external_requests(weight=1.0)
