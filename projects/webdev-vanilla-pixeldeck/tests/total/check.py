"""Gated composite intended as the primary training signal."""
import json
from pathlib import Path

from rewardkit import criterion
import rewardkit as rk


P = json.loads(Path("/tmp/probe.json").read_text()) if Path("/tmp/probe.json").exists() else {}


FUNCTIONAL = [
    "pencil_draws", "drag_draws_continuously", "eraser_removes",
    "flood_fill_changes_region", "flood_fill_reaches_connected_area",
    "eyedropper_samples", "undo_restores_fill", "pencil_undo",
    "grid_toggle_changes_view", "canvas_size_changes", "clear_resets_canvas",
    "png_download", "touch_draws",
]
POLISH = ["gradient_decls", "keyframes", "hover_rules", "transition_rules", "shadow_decls"]


def gate() -> bool:
    scripts = P.get("scripts") or []
    styles = P.get("stylesheets") or []
    return bool(
        P.get("exists") and P.get("render_ok") and P.get("offline_render_ok")
        and not P.get("page_errors") and not P.get("failed_requests")
        and scripts and all(not s.get("src") and s.get("inline_len", 0) > 100 for s in scripts)
        and styles and all(s.get("tag") == "style" and s.get("inline_len", 0) > 100 for s in styles)
    )


@criterion(description="gated composite: 80% requested behavior and 20% interface craft")
def total(workspace: Path) -> float:
    if not gate():
        return 0.0
    functional = sum(bool(P.get(key)) for key in FUNCTIONAL) / len(FUNCTIONAL)
    polish = sum(P.get(key, 0) > 0 for key in POLISH) / len(POLISH)
    return round(0.8 * functional + 0.2 * polish, 4)


rk.total(weight=1.0)
