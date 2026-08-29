"""Self-containedness, asserted POSITIVELY.

Earlier revision checked this with negative assertions on the source text
("no <script src=", "no cdn.", "no import ... from"). Per QC criterion B2 being
dropped in favour of positive checks, every criterion here now asserts a
property the running artifact HAS, not a pattern we hope is absent:

  negative (removed)                  positive (here)
  ---------------------------------   --------------------------------------
  no <script src=>                    every <script> carries inline code
  no <link rel=stylesheet>            every stylesheet is an inline <style>
  no cdn./unpkg/jsdelivr in source    behaviour is IDENTICAL with network denied
  no external requests at runtime     offline parity on render/animate/input/paint

The offline pass is the load-bearing one. Absence-of-pattern checks are
defeated by any spelling the regex did not anticipate (protocol-relative URLs,
string-concatenated hosts, dynamic import(), a service worker). Executing the
artifact with the network hard-blocked tests the actual property, and a
CDN-dependent app fails it by visibly breaking.
"""
import json
from pathlib import Path

from rewardkit import criterion
import rewardkit as rk

P = json.loads(Path("/tmp/probe.json").read_text()) if Path("/tmp/probe.json").exists() else {}


@criterion(description="every <script> in the document carries inline code")
def scripts_are_inline(workspace: Path) -> bool:
    scripts = P.get("scripts")
    if not scripts:
        return False
    return all((s.get("src") in (None, "")) and s.get("inline_len", 0) > 0
               for s in scripts)


@criterion(description="every stylesheet is an inline <style> element")
def styles_are_inline(workspace: Path) -> bool:
    sheets = P.get("stylesheets")
    if sheets is None:
        return False
    return all(s.get("tag") == "style" and s.get("inline_len", 0) > 0
               for s in sheets)


@criterion(description="the whole app is one self-contained file")
def single_file(workspace: Path) -> bool:
    if not P.get("exists") or P.get("bytes", 0) < 500:
        return False
    return any(s.get("inline_len", 0) > 200 for s in P.get("scripts") or [])


# --- Offline PARITY. Deliberately compares offline behaviour to ONLINE
# behaviour rather than to an absolute bar. "Self-contained" means "behaves the
# same with no network", which is independent of whether the app works at all —
# a non-functional but dependency-free artifact should score full marks here and
# lose its points in render/ and functional/ instead. Mixing the two would make
# this dimension unreadable as a diagnostic.

@criterion(description="loads with network denied exactly as it does online")
def parity_render(workspace: Path) -> bool:
    return bool(P.get("offline_render_ok")) == bool(P.get("render_ok"))


@criterion(description="animates with network denied exactly as it does online")
def parity_animation(workspace: Path) -> bool:
    return bool(P.get("offline_animates")) == bool(P.get("canvas_animates"))


@criterion(description="handles input with network denied exactly as it does online")
def parity_input(workspace: Path) -> bool:
    return (P.get("offline_key_events", 0) > 0) == (P.get("key_events_fired", 0) > 0)


@criterion(description="draws the same amount with network denied")
def parity_paint(workspace: Path) -> bool:
    on, off = P.get("blankness_t1"), P.get("offline_blankness")
    if on is None and off is None:
        return True
    if on is None or off is None:
        return False
    return abs(on - off) < 0.02


@criterion(description="throws no errors that only appear when network is denied")
def no_offline_only_errors(workspace: Path) -> bool:
    return len(P.get("offline_page_errors") or []) <= len(P.get("page_errors") or [])


rk.scripts_are_inline(weight=1.0)
rk.styles_are_inline(weight=1.0)
rk.single_file(weight=0.33)
rk.parity_render(weight=0.67)
rk.parity_animation(weight=0.67)
rk.parity_input(weight=0.67)
rk.parity_paint(weight=0.5)
rk.no_offline_only_errors(weight=0.5)
