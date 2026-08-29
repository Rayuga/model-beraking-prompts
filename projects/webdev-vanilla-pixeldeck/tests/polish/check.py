"""Observable interface craft checks used as a smaller diagnostic dimension."""
import json
from pathlib import Path

from rewardkit import criterion
import rewardkit as rk


P = json.loads(Path("/tmp/probe.json").read_text()) if Path("/tmp/probe.json").exists() else {}


def rendered() -> bool:
    return bool(P.get("render_ok") and not P.get("page_errors"))


@criterion(description="uses at least one CSS gradient")
def has_gradient(workspace: Path) -> bool:
    return rendered() and P.get("gradient_decls", 0) > 0


@criterion(description="declares a CSS keyframe animation")
def has_animation(workspace: Path) -> bool:
    return rendered() and P.get("keyframes", 0) > 0


@criterion(description="defines hover feedback for controls")
def has_hover_states(workspace: Path) -> bool:
    return rendered() and P.get("hover_rules", 0) > 0


@criterion(description="uses transitions for interaction feedback")
def has_transitions(workspace: Path) -> bool:
    return rendered() and P.get("transition_rules", 0) > 0


@criterion(description="uses shadows or drop shadows to establish visual depth")
def has_visual_depth(workspace: Path) -> bool:
    return rendered() and P.get("shadow_decls", 0) > 0


@criterion(description="provides a substantial control surface rather than only a bare canvas")
def substantial_controls(workspace: Path) -> bool:
    return rendered() and P.get("interactive_els", 0) >= 12


@criterion(description="the self-contained implementation is substantial but remains compact")
def compact_substantial_output(workspace: Path) -> bool:
    return rendered() and 5000 <= P.get("bytes", 0) <= 12000


rk.has_gradient(weight=1.0)
rk.has_animation(weight=0.5)
rk.has_hover_states(weight=1.0)
rk.has_transitions(weight=1.0)
rk.has_visual_depth(weight=1.0)
rk.substantial_controls(weight=1.0)
rk.compact_substantial_output(weight=1.0)
