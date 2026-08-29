"""Basic rendering and responsive-layout checks."""
import json
import re
from pathlib import Path

from rewardkit import criterion
import rewardkit as rk


P = json.loads(Path("/tmp/probe.json").read_text()) if Path("/tmp/probe.json").exists() else {}


@criterion(description="the requested /app/index.html deliverable exists")
def deliverable_exists(workspace: Path) -> bool:
    return bool(P.get("exists"))


@criterion(description="the page loads successfully in Chromium")
def page_loads(workspace: Path) -> bool:
    return bool(P.get("render_ok"))


@criterion(description="loading and exercising the app produces no uncaught page errors")
def no_page_errors(workspace: Path) -> bool:
    return bool(P.get("render_ok") and not P.get("page_errors"))


@criterion(description="the app has a visible, internally sized canvas")
def sized_canvas(workspace: Path) -> bool:
    return any(w >= 128 and h >= 128 for w, h in (P.get("canvas_dims") or []))


@criterion(description="all requested tools and actions are exposed by named controls")
def requested_controls_visible(workspace: Path) -> bool:
    text = " ".join(P.get("control_text") or [])
    groups = [
        r"pencil|brush", r"eraser", r"fill|bucket", r"eyedropper|pick",
        r"undo", r"clear", r"grid", r"download|export", r"canvas size|8 x 8|16 x 16",
    ]
    return all(re.search(pattern, text, re.I) for pattern in groups)


@criterion(description="at 390px wide the page has no horizontal document overflow")
def mobile_no_overflow(workspace: Path) -> bool:
    return bool(P.get("mobile_no_horizontal_overflow"))


@criterion(description="at 390px wide the complete canvas stays inside the viewport")
def mobile_canvas_fits(workspace: Path) -> bool:
    return bool(P.get("mobile_canvas_fits"))


rk.deliverable_exists(weight=1.0)
rk.page_loads(weight=1.0)
rk.no_page_errors(weight=1.0)
rk.sized_canvas(weight=1.0)
rk.requested_controls_visible(weight=1.0)
rk.mobile_no_overflow(weight=1.0)
rk.mobile_canvas_fits(weight=1.0)
