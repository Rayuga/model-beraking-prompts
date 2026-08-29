"""THE TRAINING SIGNAL.

`reward` (from reward.toml) is a plain unweighted mean of the four dimensions —
verified empirically, not assumed: baseline scored (1.0+1.0+0.9167+0.0614)/4 =
0.7445 exactly. That means the two cheap gate dimensions carry half the mass, so
a rollout that emits an empty-but-legal file collects ~0.41 for doing nothing.
That is a reward-hacking attractor, so it is not what we train on.

This dimension recomputes the score with explicit gating and explicit weights.
Use the `total` key as the RL reward; keep the others for diagnostics.

    total = 0                                    if render or constraint gate fails
          = 0.60*functional + 0.40*polish        otherwise

Rationale for the ordering this produces:
  - A constraint-violating rollout scores 0 even when it is the prettiest one in
    the batch. This slice fails in the arena 34.5% of the time precisely because
    models substitute their default polished stack for what was asked.
  - The constraint gate is POSITIVE: it requires the app to run with the network
    denied and to be built only from inline script/style. It never pattern-matches
    for the absence of a CDN string, so it cannot be defeated by an unanticipated
    spelling (protocol-relative URL, dynamic import(), string-built host).
  - Polish cannot be farmed without a working app, because it sits behind the
    same gate. That is the resolution to the conflict between the measured
    +10..+20 polish lift and the constraint-adherence headroom.
"""
import json
import re
from pathlib import Path

from rewardkit import criterion
import rewardkit as rk

P = json.loads(Path("/tmp/probe.json").read_text()) if Path("/tmp/probe.json").exists() else {}
SRC = P.get("source", "")


def render_gate() -> bool:
    if not P.get("exists") or not P.get("render_ok"):
        return False
    if P.get("page_errors") or P.get("failed_requests"):
        return False
    b0, b1 = P.get("blankness_t0"), P.get("blankness_after_input")
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


def functional_score() -> float:
    dims = P.get("canvas_dims") or []
    parts = [
        (2.0, any(w > 50 and h > 50 for w, h in dims)),
        (3.0, bool(P.get("canvas_animates"))),
        (3.0, bool(P.get("responds_to_keys")) and P.get("key_prevent_default", 0) > 0),
        (1.0, bool(re.search(r"\bscore\b", SRC, re.I))),
        (1.5, bool(re.search(r"(game\s*over|gameOver|collision|isDead|\bcrash)", SRC, re.I))),
        (1.0, bool(re.search(r"\b(food|apple|fruit|pellet)\b", SRC, re.I))),
    ]
    aff = [r"\bpause\b", r"\brestart\b|\breset\b", r"high.?score|\bbest\b",
           r"\bspeed\b|\bdifficulty\b|\blevel\b", r"\bmute\b|\bsound\b"]
    aff_score = min(sum(1 for p in aff if re.search(p, SRC, re.I)) / 3.0, 1.0)
    total_w = sum(w for w, _ in parts) + 1.5
    got = sum(w for w, ok in parts if ok) + 1.5 * aff_score
    return round(got / total_w, 4)


def length_band() -> float:
    b = P.get("bytes", 0)
    if b < 1000:
        return 0.0
    if b < 5000:
        return round((b - 1000) / 4000 * 0.85, 4)
    if b <= 8000:
        return 1.0
    if b <= 12000:
        return round(1.0 - (b - 8000) / 4000 * 0.45, 4)
    return 0.5


def polish_score() -> float:
    # Weights are the LENGTH-CONTROLLED win-rate lifts measured over 1,945
    # same-length arena battles — the observed slope of the human vote.
    parts = [
        (2.0, P.get("gradient_decls", 0) > 0),
        (1.5, P.get("keyframes", 0) > 0 or "requestAnimationFrame" in SRC),
        (1.4, P.get("emoji_in_text", 0) > 0),
        (1.1, P.get("hover_rules", 0) > 0),
        (1.0, P.get("transition_rules", 0) > 0),
        (0.7, P.get("shadow_decls", 0) > 0),
        (1.0, P.get("interactive_els", 0) >= 2),
    ]
    total_w = sum(w for w, _ in parts) + 2.5
    got = sum(w for w, ok in parts if ok) + 2.5 * length_band()
    return round(got / total_w, 4)


@criterion(description="gated composite: 0 if render/constraints fail, else 0.6*functional + 0.4*polish")
def total(workspace: Path) -> float:
    if not (render_gate() and constraint_gate()):
        return 0.0
    return round(0.60 * functional_score() + 0.40 * polish_score(), 4)


rk.total(weight=1.0)
