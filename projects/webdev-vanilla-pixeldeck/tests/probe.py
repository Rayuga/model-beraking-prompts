#!/usr/bin/env python3
"""Render PixelDeck once per independent feature group and cache observable facts."""
from __future__ import annotations

import base64
import hashlib
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


EMOJI = re.compile("[\U0001F300-\U0001FAFF\U00002600-\U000027BF]")

INVENTORY = r"""
() => {
  const out = {css_rules:0,hover_rules:0,transition_rules:0,keyframes:0,
    gradient_decls:0,shadow_decls:0,text_sample:""};
  for (const sheet of [...document.styleSheets]) {
    let rules; try { rules=sheet.cssRules; } catch (_) { continue; }
    for (const r of [...(rules||[])]) {
      out.css_rules++; const t=r.cssText||"";
      if (r.type===CSSRule.KEYFRAMES_RULE) out.keyframes++;
      if (/:hover/.test(t)) out.hover_rules++;
      if (/transition|animation/.test(t)) out.transition_rules++;
      if (/gradient\(/.test(t)) out.gradient_decls++;
      if (/box-shadow|text-shadow|drop-shadow/.test(t)) out.shadow_decls++;
    }
  }
  out.text_sample=(document.body?.innerText||"").slice(0,5000);
  out.dom_nodes=document.querySelectorAll("*").length;
  out.canvas_count=document.querySelectorAll("canvas").length;
  out.canvas_dims=[...document.querySelectorAll("canvas")].map(c=>[c.width,c.height]);
  out.interactive_els=document.querySelectorAll("button,input,select,[role=button],[tabindex],a[href]").length;
  out.control_text=[...document.querySelectorAll("button,label,select")].map(e=>(e.innerText||e.getAttribute("aria-label")||"").trim()).filter(Boolean);
  out.stylesheets=[...document.querySelectorAll("style,link[rel=stylesheet]")].map(e=>({tag:e.tagName.toLowerCase(),href:e.getAttribute("href")||null,inline_len:(e.textContent||"").length}));
  out.scripts=[...document.querySelectorAll("script")].map(e=>({src:e.getAttribute("src")||null,type:e.getAttribute("type")||null,inline_len:(e.textContent||"").length}));
  return out;
}
"""


def largest_canvas(page: Page):
    canvases = page.locator("canvas")
    if not canvases.count():
        return None
    index = canvases.evaluate_all(
        "els => els.map((e,i)=>[i,e.width*e.height]).sort((a,b)=>b[1]-a[1])[0][0]"
    )
    return canvases.nth(index)


def fingerprint(canvas) -> str | None:
    if canvas is None:
        return None
    try:
        value = canvas.evaluate("c => c.toDataURL('image/png')")
        return hashlib.sha256(value.encode()).hexdigest()
    except Exception:
        return None


def sample(canvas, rx: float, ry: float):
    if canvas is None:
        return None
    try:
        return canvas.evaluate(
            """(c,p) => {
              const x=Math.max(0,Math.min(c.width-1,Math.floor(c.width*p[0])));
              const y=Math.max(0,Math.min(c.height-1,Math.floor(c.height*p[1])));
              return [...c.getContext('2d').getImageData(x,y,1,1).data];
            }""",
            [rx, ry],
        )
    except Exception:
        return None


def near(rgb, target, tolerance=55) -> bool:
    return bool(rgb and all(abs(int(rgb[i]) - target[i]) <= tolerance for i in range(3)))


def click_named(page: Page, pattern: str) -> bool:
    try:
        button = page.get_by_role("button", name=re.compile(pattern, re.I)).first
        if not button.count() or not button.is_visible():
            return False
        button.click()
        return True
    except Exception:
        return False


def set_color(page: Page, value: str) -> bool:
    try:
        picker = page.locator('input[type="color"]').first
        if not picker.count():
            return False
        picker.fill(value)
        return picker.input_value().lower() == value.lower()
    except Exception:
        return False


def point(canvas, rx: float, ry: float):
    box = canvas.bounding_box() if canvas else None
    if not box:
        return None
    return box["x"] + box["width"] * rx, box["y"] + box["height"] * ry


def stroke(page: Page, canvas, start, end=None, steps=8) -> bool:
    a = point(canvas, *start)
    b = point(canvas, *(end or start))
    if not a or not b:
        return False
    try:
        page.mouse.move(*a)
        page.mouse.down()
        page.mouse.move(*b, steps=steps)
        page.mouse.up()
        page.wait_for_timeout(100)
        return True
    except Exception:
        return False


def wire_errors(page: Page, result: dict) -> None:
    page.on("console", lambda m: result["console_errors"].append(m.text[:400]) if m.type == "error" else None)
    page.on("pageerror", lambda e: result["page_errors"].append(str(e)[:400]))
    page.on("requestfailed", lambda q: result["failed_requests"].append(q.url[:300]))
    page.on("request", lambda q: result["external_requests"].append(q.url[:300]) if not q.url.startswith("file:") else None)
    page.on("dialog", lambda dialog: dialog.accept())


def open_page(browser, uri: str, result: dict, *, mobile=False, offline=False):
    context = browser.new_context(
        viewport={"width": 390 if mobile else 1280, "height": 844 if mobile else 800},
        has_touch=mobile,
        is_mobile=mobile,
        accept_downloads=True,
    )
    page = context.new_page()
    wire_errors(page, result)
    if offline:
        page.route("**", lambda route: route.continue_() if route.request.url.startswith("file:") else route.abort())
    page.goto(uri, wait_until="load", timeout=20000)
    page.wait_for_timeout(300)
    return context, page


def drawing_group(browser, uri: str, result: dict):
    context, page = open_page(browser, uri, result)
    canvas = largest_canvas(page)
    before = fingerprint(canvas)
    selected = click_named(page, r"pencil|brush") and set_color(page, "#ef4444")
    stroke(page, canvas, (0.18, 0.18), (0.52, 0.18), 12)
    after = fingerprint(canvas)
    left, right = sample(canvas, 0.18, 0.18), sample(canvas, 0.52, 0.18)
    result["pencil_draws"] = bool(selected and before and after != before and near(left, (239, 68, 68)) and near(right, (239, 68, 68)))
    result["drag_draws_continuously"] = bool(near(sample(canvas, 0.35, 0.18), (239, 68, 68)))

    erased_before = fingerprint(canvas)
    eraser = click_named(page, r"eraser")
    stroke(page, canvas, (0.18, 0.18))
    erased = fingerprint(canvas)
    result["eraser_removes"] = bool(eraser and erased != erased_before and not near(sample(canvas, 0.18, 0.18), (239, 68, 68)))

    click_named(page, r"pencil|brush")
    set_color(page, "#3b6eea")
    key_before = fingerprint(canvas)
    stroke(page, canvas, (0.72, 0.72))
    key_drawn = fingerprint(canvas)
    undone = click_named(page, r"undo")
    page.wait_for_timeout(100)
    result["pencil_undo"] = bool(undone and key_drawn != key_before and fingerprint(canvas) == key_before)
    context.close()


def fill_group(browser, uri: str, result: dict):
    context, page = open_page(browser, uri, result)
    canvas = largest_canvas(page)
    blank = fingerprint(canvas)
    ready = set_color(page, "#22c55e") and click_named(page, r"fill|bucket")
    stroke(page, canvas, (0.78, 0.78))
    filled = fingerprint(canvas)
    result["flood_fill_changes_region"] = bool(ready and filled != blank and near(sample(canvas, 0.78, 0.78), (34, 197, 94)))
    result["flood_fill_reaches_connected_area"] = bool(near(sample(canvas, 0.22, 0.22), (34, 197, 94)))

    set_color(page, "#ef4444")
    picker = click_named(page, r"eyedropper|pick")
    stroke(page, canvas, (0.78, 0.78))
    try:
        picked = page.locator('input[type="color"]').first.input_value().lower()
    except Exception:
        picked = ""
    result["eyedropper_samples"] = bool(picker and picked == "#22c55e")

    undone = click_named(page, r"undo")
    page.wait_for_timeout(100)
    result["undo_restores_fill"] = bool(undone and fingerprint(canvas) == blank)
    context.close()


def controls_group(browser, uri: str, result: dict):
    context, page = open_page(browser, uri, result)
    canvas = largest_canvas(page)
    grid_before = fingerprint(canvas)
    grid = click_named(page, r"grid")
    grid_after = fingerprint(canvas)
    result["grid_toggle_changes_view"] = bool(grid and grid_before != grid_after)

    dims_before = canvas.evaluate("c => [c.width,c.height]") if canvas else None
    resized = False
    try:
        selects = page.locator("select")
        for i in range(selects.count()):
            options = selects.nth(i).locator("option")
            values = [options.nth(j).get_attribute("value") or options.nth(j).inner_text() for j in range(options.count())]
            numeric = [v for v in values if re.search(r"\d+", v or "")]
            if len(numeric) >= 2:
                current = selects.nth(i).input_value()
                target = next(v for v in numeric if v != current)
                selects.nth(i).select_option(value=target)
                resized = True
                break
    except Exception:
        resized = False
    page.wait_for_timeout(100)
    canvas = largest_canvas(page)
    dims_after = canvas.evaluate("c => [c.width,c.height]") if canvas else None
    result["canvas_size_changes"] = bool(resized and dims_before and dims_after and dims_before != dims_after)

    blank = fingerprint(canvas)
    click_named(page, r"pencil|brush")
    set_color(page, "#3b6eea")
    stroke(page, canvas, (0.42, 0.42))
    marked = fingerprint(canvas)
    cleared = click_named(page, r"clear|new")
    page.wait_for_timeout(100)
    result["clear_resets_canvas"] = bool(cleared and marked != blank and fingerprint(canvas) == blank)

    click_named(page, r"pencil|brush")
    stroke(page, canvas, (0.42, 0.42))
    try:
        with page.expect_download(timeout=3000) as event:
            clicked = click_named(page, r"download|export|save.*png")
        download = event.value
        path = download.path()
        result["png_download"] = bool(clicked and download.suggested_filename.lower().endswith(".png") and path and Path(path).stat().st_size > 20)
    except Exception:
        result["png_download"] = False
    context.close()


def mobile_group(browser, uri: str, result: dict):
    context, page = open_page(browser, uri, result, mobile=True)
    canvas = largest_canvas(page)
    metrics = page.evaluate("() => ({sw:document.documentElement.scrollWidth,iw:innerWidth})")
    box = canvas.bounding_box() if canvas else None
    result["mobile_no_horizontal_overflow"] = bool(metrics["sw"] <= metrics["iw"] + 2)
    result["mobile_canvas_fits"] = bool(box and box["x"] >= -1 and box["x"] + box["width"] <= metrics["iw"] + 1)
    result["mobile_screenshot_b64"] = base64.b64encode(page.screenshot(full_page=True)).decode()
    before = fingerprint(canvas)
    click_named(page, r"pencil|brush")
    set_color(page, "#ef4444")
    p = point(canvas, 0.5, 0.5)
    if p:
        page.touchscreen.tap(*p)
        page.wait_for_timeout(100)
    result["touch_draws"] = bool(before and fingerprint(canvas) != before)
    context.close()


def offline_group(browser, uri: str, result: dict):
    try:
        context, page = open_page(browser, uri, result, offline=True)
        canvas = largest_canvas(page)
        before = fingerprint(canvas)
        click_named(page, r"pencil|brush")
        set_color(page, "#ef4444")
        stroke(page, canvas, (0.5, 0.5))
        result["offline_render_ok"] = True
        result["offline_draws"] = bool(before and fingerprint(canvas) != before)
        context.close()
    except Exception as exc:
        result["offline_render_ok"] = False
        result["offline_draws"] = False
        result["offline_error"] = str(exc)[:300]


def main(target: str, output: str):
    src = Path(target).expanduser().resolve()
    result = {
        "deliverable": str(src), "exists": src.exists(),
        "bytes": src.stat().st_size if src.exists() else 0,
        "console_errors": [], "page_errors": [], "failed_requests": [],
        "external_requests": [], "render_ok": False,
    }
    if not src.exists():
        result["fatal"] = "deliverable missing"
        Path(output).write_text(json.dumps(result, indent=2))
        return
    result["source"] = src.read_text(errors="replace")
    uri = src.as_uri()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=["--allow-file-access-from-files"])
        try:
            context, page = open_page(browser, uri, result)
            result["render_ok"] = True
            result.update(page.evaluate(INVENTORY))
            result["initial_canvas_fingerprint"] = fingerprint(largest_canvas(page))
            result["screenshot_b64"] = base64.b64encode(page.screenshot()).decode()
            context.close()
            drawing_group(browser, uri, result)
            fill_group(browser, uri, result)
            controls_group(browser, uri, result)
            mobile_group(browser, uri, result)
            offline_group(browser, uri, result)
        except Exception as exc:
            result["fatal"] = str(exc)[:500]
        finally:
            browser.close()
    result["emoji_in_text"] = len(EMOJI.findall(result.get("text_sample", "")))
    result["sha"] = hashlib.sha256(result["source"].encode()).hexdigest()[:16]
    Path(output).write_text(json.dumps(result, indent=2))
    hidden = {"source", "screenshot_b64", "mobile_screenshot_b64", "text_sample"}
    print(json.dumps({k: v for k, v in result.items() if k not in hidden}, indent=2))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
