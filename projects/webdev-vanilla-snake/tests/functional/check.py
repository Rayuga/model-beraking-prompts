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

@criterion(description="a canvas element is present and sized")
def has_sized_canvas(workspace: Path) -> bool:
    if not GATED:
        return False
    dims = P.get("canvas_dims") or []
    return any(w > 50 and h > 50 for w, h in dims)

@criterion(description="game loop runs on its own (canvas pixels change over 1.6s)")
def animates(workspace: Path) -> bool:
    return GATED and bool(P.get("canvas_animates"))

@criterion(description="responds to arrow/WASD keyboard input")
def responds_to_keys(workspace: Path) -> bool:
    return GATED and bool(P.get("responds_to_keys"))

@criterion(description="implements a score")
def has_score(workspace: Path) -> bool:
    return GATED and bool(re.search(r"\bscore\b", SRC, re.I))

@criterion(description="implements collision / game-over handling")
def has_game_over(workspace: Path) -> bool:
    return GATED and bool(re.search(r"(game\s*over|gameOver|collision|isDead|\bcrash)", SRC, re.I))

@criterion(description="implements food / apple spawning")
def has_food(workspace: Path) -> bool:
    return GATED and bool(re.search(r"\b(food|apple|fruit|pellet)\b", SRC, re.I))

@criterion(description="ships extra affordances the prompt asked for (pause/restart/speed/high-score)")
def has_affordances(workspace: Path) -> float:
    if not GATED:
        return 0.0
    pats = [r"\bpause\b", r"\brestart\b|\breset\b", r"high.?score|\bbest\b",
            r"\bspeed\b|\bdifficulty\b|\blevel\b", r"\bmute\b|\bsound\b"]
    hit = sum(1 for p in pats if re.search(p, SRC, re.I))
    return min(hit / 3.0, 1.0)

rk.has_sized_canvas(weight=2.0)
rk.animates(weight=3.0)
rk.responds_to_keys(weight=3.0)
rk.has_score(weight=1.0)
rk.has_game_over(weight=1.5)
rk.has_food(weight=1.0)
rk.has_affordances(weight=1.5)
