"""Independent browser interactions for every requested painting feature."""
import json
from pathlib import Path

from rewardkit import criterion
import rewardkit as rk


P = json.loads(Path("/tmp/probe.json").read_text()) if Path("/tmp/probe.json").exists() else {}


def observed(key: str) -> bool:
    return bool(P.get("render_ok") and not P.get("page_errors") and P.get(key))


@criterion(description="Pencil paints the chosen red color at both ends of a mouse stroke")
def pencil_draws_selected_color(workspace: Path) -> bool:
    return observed("pencil_draws")


@criterion(description="dragging Pencil paints the midpoint as well as the stroke endpoints")
def pencil_drag_is_continuous(workspace: Path) -> bool:
    return observed("drag_draws_continuously")


@criterion(description="Eraser removes a previously painted pixel")
def eraser_removes_paint(workspace: Path) -> bool:
    return observed("eraser_removes")


@criterion(description="Flood Fill changes the clicked blank region to the selected green")
def flood_fill_changes_region(workspace: Path) -> bool:
    return observed("flood_fill_changes_region")


@criterion(description="Flood Fill reaches a distant point in the same connected region")
def flood_fill_reaches_connected_area(workspace: Path) -> bool:
    return observed("flood_fill_reaches_connected_area")


@criterion(description="Eyedropper samples green from a painted canvas into the color control")
def eyedropper_samples_canvas(workspace: Path) -> bool:
    return observed("eyedropper_samples")


@criterion(description="one Undo restores the exact canvas state from before Flood Fill")
def undo_restores_fill(workspace: Path) -> bool:
    return observed("undo_restores_fill")


@criterion(description="Undo restores the exact canvas state from before a pencil action")
def pencil_undo_restores_action(workspace: Path) -> bool:
    return observed("pencil_undo")


@criterion(description="Grid toggle visibly changes the canvas rendering")
def grid_toggle_changes_view(workspace: Path) -> bool:
    return observed("grid_toggle_changes_view")


@criterion(description="choosing a different canvas size changes its internal dimensions")
def canvas_size_control_works(workspace: Path) -> bool:
    return observed("canvas_size_changes")


@criterion(description="Clear returns a marked canvas to its exact blank state")
def clear_resets_canvas(workspace: Path) -> bool:
    return observed("clear_resets_canvas")


@criterion(description="Download produces a non-empty file whose name ends in .png")
def downloads_png(workspace: Path) -> bool:
    return observed("png_download")


@criterion(description="a real touchscreen tap paints the canvas in a mobile browser context")
def touch_input_draws(workspace: Path) -> bool:
    return observed("touch_draws")


rk.pencil_draws_selected_color(weight=1.5)
rk.pencil_drag_is_continuous(weight=1.0)
rk.eraser_removes_paint(weight=1.0)
rk.flood_fill_changes_region(weight=1.5)
rk.flood_fill_reaches_connected_area(weight=1.0)
rk.eyedropper_samples_canvas(weight=1.0)
rk.undo_restores_fill(weight=1.5)
rk.pencil_undo_restores_action(weight=1.0)
rk.grid_toggle_changes_view(weight=0.5)
rk.canvas_size_control_works(weight=1.0)
rk.clear_resets_canvas(weight=0.5)
rk.downloads_png(weight=1.0)
rk.touch_input_draws(weight=1.0)
