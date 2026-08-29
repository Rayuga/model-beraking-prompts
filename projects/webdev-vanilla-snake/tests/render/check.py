import json, re
from pathlib import Path
from rewardkit import criterion
import rewardkit as rk

P = json.loads(Path("/tmp/probe.json").read_text()) if Path("/tmp/probe.json").exists() else {}
SRC = P.get("source", "")

def render_gate() -> bool:
    """Did it actually paint something? This is the single biggest measured loss cause."""
    if not P.get("exists") or not P.get("render_ok"):
        return False
    if P.get("page_errors"):
        return False
    if P.get("failed_requests"):
        return False
    b0, b1 = P.get("blankness_t0"), P.get("blankness_after_input")
    # a canvas that is 100% one colour at every sample point never drew anything
    if b0 is not None and b1 is not None and b0 > 0.999 and b1 > 0.999:
        return False
    return True

def constraint_gate() -> bool:
    """Did it obey \"no js libraries, raw html/css/js\"?"""
    if re.search(r"<script[^>]+src=", SRC, re.I):
        return False
    if re.search(r"\b(import\s+.*\bfrom\b|require\()", SRC):
        return False
    if re.search(r"(cdn\.|unpkg\.com|jsdelivr|cdnjs|googleapis\.com/ajax)", SRC, re.I):
        return False
    if P.get("external_requests"):
        return False
    return True


@criterion(description="deliverable exists at /app/index.html")
def deliverable_exists(workspace: Path) -> bool:
    return bool(P.get("exists"))

@criterion(description="page loads in headless Chromium without navigation failure")
def page_loads(workspace: Path) -> bool:
    return bool(P.get("render_ok"))

@criterion(description="no uncaught JS exceptions on load")
def no_page_errors(workspace: Path) -> bool:
    return not P.get("page_errors")

@criterion(description="no failed network requests (unresolvable import -> blank frame)")
def no_failed_requests(workspace: Path) -> bool:
    return not P.get("failed_requests")

@criterion(description="no console errors")
def no_console_errors(workspace: Path) -> bool:
    return not P.get("console_errors")

@criterion(description="canvas is not a uniform blank rectangle")
def canvas_not_blank(workspace: Path) -> bool:
    b = P.get("blankness_after_input")
    # >=0.1% of sampled pixels must differ from the dominant colour.
    # A sparse-but-correct game board sits near 0.996; a canvas that was
    # never drawn to sits at exactly 1.0.
    return b is not None and b < 0.999

rk.deliverable_exists(weight=1.0)
rk.page_loads(weight=1.0)
rk.no_page_errors(weight=0.67)
rk.no_failed_requests(weight=0.67)
rk.no_console_errors(weight=0.33)
rk.canvas_not_blank(weight=4.0)
