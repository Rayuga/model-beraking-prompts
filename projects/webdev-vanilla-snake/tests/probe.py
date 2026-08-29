#!/usr/bin/env python3
"""Render the agent's deliverable once in headless Chromium and dump every
measurable fact to JSON. Every reward dimension reads this file, so the browser
is launched exactly once per verification.

This is the piece that replaces the human voter: instead of asking "which of
these two apps looks better", it asks "does this app actually run, obey what was
asked, respond to input, and carry the visual properties that measurably win
arena votes".
"""
import base64
import hashlib
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]"
)

# Feature probes run inside the page. Keys mirror the measured win-rate lifts.
# Injected BEFORE any page script runs. Wraps addEventListener so we can tell
# "the app wired up keyboard input and its handler actually ran" apart from
# "the canvas happens to be animating anyway". Pixel-diffing conflates the two:
# an idle attract-loop looks identical to a responsive game.
INIT_SCRIPT = r"""
window.__probe = {registered: [], fired: 0, prevented: 0};
(function () {
  const KEYS = new Set(['keydown', 'keyup', 'keypress']);
  for (const tgt of [Window.prototype, Document.prototype, Element.prototype]) {
    const orig = tgt.addEventListener;
    tgt.addEventListener = function (type, fn, opts) {
      if (KEYS.has(type) && typeof fn === 'function') {
        window.__probe.registered.push(type);
        const wrapped = function (ev) {
          window.__probe.fired++;
          const pd = ev.preventDefault.bind(ev);
          ev.preventDefault = function () { window.__probe.prevented++; return pd(); };
          return fn.apply(this, arguments);
        };
        return orig.call(this, type, wrapped, opts);
      }
      return orig.call(this, type, fn, opts);
    };
  }
  // inline handlers (onkeydown = ...) bypass addEventListener entirely
  for (const tgt of [window, document]) {
    for (const prop of ['onkeydown', 'onkeyup']) {
      let v = null;
      Object.defineProperty(tgt, prop, {
        configurable: true,
        get() { return v; },
        set(fn) {
          v = fn;
          if (typeof fn === 'function') window.__probe.registered.push(prop);
        }
      });
    }
  }
})();
"""

PAGE_SCRIPT = r"""
() => {
  const out = {css_rules: 0, hover_rules: 0, transition_rules: 0,
               keyframes: 0, gradient_decls: 0, shadow_decls: 0,
               inline_style_len: 0, text_sample: ""};
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const r of Array.from(rules || [])) {
      out.css_rules++;
      const t = r.cssText || "";
      if (r.type === CSSRule.KEYFRAMES_RULE) { out.keyframes++; continue; }
      if (/:hover/.test(t)) out.hover_rules++;
      if (/transition|animation/.test(t)) out.transition_rules++;
      if (/gradient\(/.test(t)) out.gradient_decls++;
      if (/box-shadow|text-shadow|filter:\s*drop-shadow/.test(t)) out.shadow_decls++;
    }
  }
  for (const el of Array.from(document.querySelectorAll("[style]"))) {
    out.inline_style_len += (el.getAttribute("style") || "").length;
  }
  out.text_sample = (document.body ? document.body.innerText : "").slice(0, 4000);
  out.dom_nodes = document.querySelectorAll("*").length;
  const cs = document.querySelectorAll("canvas");
  out.canvas_count = cs.length;
  out.canvas_dims = Array.from(cs).map(c => [c.width, c.height]);
  out.interactive_els = document.querySelectorAll(
      "button,[role=button],input,select,a[href],[tabindex]").length;

  // Positive inventory of what the document IS built from. Downstream criteria
  // assert over these lists directly ("every stylesheet is inline") rather than
  // asserting the absence of a pattern in the source text.
  out.stylesheets = Array.from(document.querySelectorAll("style,link[rel=stylesheet]"))
      .map(el => ({tag: el.tagName.toLowerCase(),
                   href: el.getAttribute("href") || null,
                   inline_len: (el.textContent || "").length}));
  out.scripts = Array.from(document.querySelectorAll("script"))
      .map(el => ({src: el.getAttribute("src") || null,
                   type: el.getAttribute("type") || null,
                   inline_len: (el.textContent || "").length}));
  return out;
}
"""


def canvas_fingerprint(page):
    """Hash of the largest canvas' pixels; None when there is no canvas."""
    return page.evaluate(
        r"""() => {
        const cs = Array.from(document.querySelectorAll('canvas'));
        if (!cs.length) return null;
        const c = cs.sort((a,b) => b.width*b.height - a.width*a.height)[0];
        try { return c.toDataURL().slice(0, 80000); } catch (e) { return 'TAINTED'; }
        }"""
    )


def blankness(page):
    """Fraction of sampled canvas pixels that share the single most common colour.
    1.0 means a completely uniform (blank) canvas."""
    return page.evaluate(
        r"""() => {
        const cs = Array.from(document.querySelectorAll('canvas'));
        if (!cs.length) return null;
        const c = cs.sort((a,b) => b.width*b.height - a.width*a.height)[0];
        const ctx = c.getContext('2d');
        if (!ctx || !c.width || !c.height) return null;
        let d;
        try { d = ctx.getImageData(0, 0, c.width, c.height).data; }
        catch (e) { return null; }
        const counts = new Map(); let n = 0;
        for (let i = 0; i < d.length; i += 4 * 37) {
          const k = (d[i]<<16) | (d[i+1]<<8) | d[i+2];
          counts.set(k, (counts.get(k) || 0) + 1); n++;
        }
        let max = 0;
        for (const v of counts.values()) if (v > max) max = v;
        return n ? max / n : null;
        }"""
    )


def main(target: str, out_path: str):
    src = Path(target).expanduser().resolve()
    r = {
        "deliverable": str(src),
        "exists": src.exists(),
        "bytes": src.stat().st_size if src.exists() else 0,
        "console_errors": [],
        "page_errors": [],
        "failed_requests": [],
        "external_requests": [],
        "render_ok": False,
        "canvas_animates": False,
        "responds_to_keys": False,
        "screenshot_b64": None,
    }
    if not src.exists():
        r["fatal"] = "deliverable missing"
        Path(out_path).write_text(json.dumps(r, indent=1))
        return

    r["source"] = src.read_text(errors="replace")

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--allow-file-access-from-files"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.add_init_script(INIT_SCRIPT)

        page.on("console", lambda m: r["console_errors"].append(m.text[:400])
                if m.type == "error" else None)
        page.on("pageerror", lambda e: r["page_errors"].append(str(e)[:400]))
        page.on("requestfailed", lambda q: r["failed_requests"].append(q.url[:300]))
        page.on("request", lambda q: r["external_requests"].append(q.url[:300])
                if not q.url.startswith("file:") else None)

        try:
            page.goto(src.as_uri(), wait_until="load", timeout=20000)
            page.wait_for_timeout(700)
            r["render_ok"] = True
        except Exception as e:  # noqa: BLE001
            r["fatal"] = f"navigation failed: {e}"[:400]
            browser.close()
            Path(out_path).write_text(json.dumps(r, indent=1))
            return

        try:
            r.update(page.evaluate(PAGE_SCRIPT))
        except Exception as e:  # noqa: BLE001
            r["eval_error"] = str(e)[:300]

        r["blankness_t0"] = blankness(page)

        # --- does it animate on its own? (rAF game loop running)
        f0 = canvas_fingerprint(page)
        page.wait_for_timeout(1600)
        f1 = canvas_fingerprint(page)
        r["canvas_animates"] = bool(f0 and f1 and f0 != f1)
        r["blankness_t1"] = blankness(page)

        # --- does it respond to the keyboard?
        # Measured at the listener, not at the pixels: an app whose canvas is
        # already animating would otherwise score as "responsive" for free.
        before = canvas_fingerprint(page)
        for key in ["Space", "Enter"]:
            page.keyboard.press(key)
            page.wait_for_timeout(120)
        for key in ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft",
                    "w", "d", "s", "a"]:
            page.keyboard.press(key)
            page.wait_for_timeout(110)

        probe = page.evaluate("() => window.__probe || null") or {}
        r["key_listeners"] = sorted(set(probe.get("registered", [])))
        r["key_events_fired"] = probe.get("fired", 0)
        r["key_prevent_default"] = probe.get("prevented", 0)
        # Requires BOTH a registered key listener AND that it actually ran.
        r["responds_to_keys"] = bool(r["key_listeners"]) and r["key_events_fired"] > 0
        r["canvas_changed_after_input"] = bool(
            before and canvas_fingerprint(page) and before != canvas_fingerprint(page))
        r["blankness_after_input"] = blankness(page)

        try:
            r["screenshot_b64"] = base64.b64encode(
                page.screenshot(full_page=False)).decode()
        except Exception:  # noqa: BLE001
            pass

        # ---- SECOND PASS: hard network block.
        # This is the positive form of "it has no external dependencies": load
        # the artifact with every non-file request denied and assert it STILL
        # renders, animates and accepts input. An app that needs a CDN fails
        # this by breaking, which is an observable fact about the running app
        # rather than a pattern we hope is absent from the source.
        try:
            off = browser.new_page(viewport={"width": 1280, "height": 800})
            off.add_init_script(INIT_SCRIPT)
            off.route("**", lambda route: route.continue_()
                      if route.request.url.startswith("file:") else route.abort())
            off_errors = []
            off.on("pageerror", lambda e: off_errors.append(str(e)[:300]))
            off.goto(src.as_uri(), wait_until="load", timeout=20000)
            off.wait_for_timeout(700)
            g0 = canvas_fingerprint(off)
            off.wait_for_timeout(1500)
            g1 = canvas_fingerprint(off)
            for key in ["Space", "ArrowUp", "ArrowRight", "w", "d"]:
                off.keyboard.press(key)
                off.wait_for_timeout(110)
            oprobe = off.evaluate("() => window.__probe || null") or {}
            r["offline_render_ok"] = True
            r["offline_page_errors"] = off_errors
            r["offline_animates"] = bool(g0 and g1 and g0 != g1)
            r["offline_blankness"] = blankness(off)
            r["offline_key_events"] = oprobe.get("fired", 0)
            off.close()
        except Exception as e:  # noqa: BLE001
            r["offline_render_ok"] = False
            r["offline_error"] = str(e)[:300]

        browser.close()

    src_text = r["source"]
    r["emoji_in_source"] = len(EMOJI.findall(src_text))
    r["emoji_in_text"] = len(EMOJI.findall(r.get("text_sample", "")))
    r["sha"] = hashlib.sha256(src_text.encode()).hexdigest()[:16]

    Path(out_path).write_text(json.dumps(r, indent=1))
    print(json.dumps({k: v for k, v in r.items()
                      if k not in ("source", "screenshot_b64", "text_sample")},
                     indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
