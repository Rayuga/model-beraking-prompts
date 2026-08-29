import json, re
from pathlib import Path
from rewardkit import criterion
import rewardkit as rk

P = json.loads(Path("/tmp/probe.json").read_text()) if Path("/tmp/probe.json").exists() else {}
SRC = P.get("source", "")

def render_gate() -> bool:
    if not P.get("exists") or not P.get("render_ok"): return False
    if P.get("page_errors") or P.get("failed_requests"): return False
    b0, b1 = P.get("blankness_t0"), P.get("blankness_after_input")
    if b0 is not None and b1 is not None and b0 > 0.999 and b1 > 0.999: return False
    return True

def constraint_gate() -> bool:
    """Positive form: every script and stylesheet is inline, and the artifact
    behaves IDENTICALLY with the network denied. No absence-of-pattern matching
    on the source text, so it cannot be defeated by an unanticipated spelling."""
    scripts = P.get("scripts") or []
    sheets = P.get("stylesheets")
    if not scripts:
        return False
    if not all((s.get("src") in (None, "")) and s.get("inline_len", 0) > 0 for s in scripts):
        return False
    if sheets is None or not all(s.get("tag") == "style" for s in sheets):
        return False
    if bool(P.get("offline_render_ok")) != bool(P.get("render_ok")):
        return False
    if bool(P.get("offline_animates")) != bool(P.get("canvas_animates")):
        return False
    if len(P.get("offline_page_errors") or []) > len(P.get("page_errors") or []):
        return False
    return True

GATED = render_gate() and constraint_gate()

# Weights below are the LENGTH-CONTROLLED win-rate lifts measured across 1,945
# same-length arena battles. They are not taste — they are the observed slope of
# the human vote. Raw (uncontrolled) lift is noted for reference.
#   gradient  +19.9 | keyframes/anim +14.8 | emoji +14.1
#   hover     +10.8 | transition      +9.7 | shadow  +6.5

@criterion(description="uses a CSS gradient (measured +19.9 lift)")
def has_gradient(workspace: Path) -> bool:
    return GATED and (P.get("gradient_decls", 0) > 0 or "gradient(" in SRC)

@criterion(description="declares @keyframes or a JS-driven animation (measured +14.8)")
def has_animation(workspace: Path) -> bool:
    return GATED and (P.get("keyframes", 0) > 0 or "requestAnimationFrame" in SRC)

@criterion(description="emoji present in the rendered UI (measured +14.1)")
def has_emoji(workspace: Path) -> bool:
    return GATED and P.get("emoji_in_text", 0) > 0

@criterion(description="defines :hover states (measured +10.8)")
def has_hover(workspace: Path) -> bool:
    return GATED and P.get("hover_rules", 0) > 0

@criterion(description="uses CSS transitions (measured +9.7)")
def has_transition(workspace: Path) -> bool:
    return GATED and P.get("transition_rules", 0) > 0

@criterion(description="uses box/text shadow for depth (measured +6.5)")
def has_shadow(workspace: Path) -> bool:
    return GATED and P.get("shadow_decls", 0) > 0

@criterion(description="offers interactive controls beyond the bare canvas")
def has_controls(workspace: Path) -> bool:
    return GATED and P.get("interactive_els", 0) >= 2

@criterion(description="output size sits in the measured 5k-8k winning band")
def length_band(workspace: Path) -> float:
    """Win rate by generated size, measured over 7,949 decisive battles:
       <2k 33% | 2-3k 43% | 3-4k 54% | 4-5k 67% | 5-8k ~74% | 9k+ 57%.
       Trapezoid reproducing that curve, normalised to [0,1]."""
    if not GATED:
        return 0.0
    b = P.get("bytes", 0)
    if b < 1000:   return 0.0
    if b < 5000:   return round((b - 1000) / 4000 * 0.85, 4)
    if b <= 8000:  return 1.0
    if b <= 12000: return round(1.0 - (b - 8000) / 4000 * 0.45, 4)
    return 0.5

rk.has_gradient(weight=2.0)
rk.has_animation(weight=1.5)
rk.has_emoji(weight=1.4)
rk.has_hover(weight=1.1)
rk.has_transition(weight=1.0)
rk.has_shadow(weight=0.7)
rk.has_controls(weight=1.0)
rk.length_band(weight=2.5)
