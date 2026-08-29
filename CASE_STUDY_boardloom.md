# Case Study — Boardloom (Infinite Canvas Workspace)

**Scores:** Gemini 3.7 Flash **93%** · Claude Sonnet 5 **65%** · GPT-5.4-mini **41%** · Claude Haiku 4.5 **0%**

---

## 1. What the task is

Build a full-stack app from an **empty `/app`** folder. No scaffold, no starter code.

- **Boardloom** = a signed-in infinite canvas (think Miro / FigJam).
- Brief is split across 6 files the agent must read: `overview`, `behaviour`, `security`, `integration`, `ui`, `policy`.
- Must ship: Node/SQLite API on port **4000**, web UI on port **5173**, and a working `start.sh`.
- Agent gets 3 hours. Difficulty: **hard**.

**Core features asked for**
- Register / sign-in / logout, users see only their own boards
- Draw rectangles, arrows, lines, pencil, sticky notes — snap to a 10px grid
- Connectors between shapes, groups, lock, components (master → instance)
- Archive / restore boards, undo / redo, style panel, duplicate
- Share by email + guest read-only link, PNG download, light/dark theme

---

## 2. What we actually verify

**19 weighted criteria, 27 total weight.** Reward = earned weight ÷ 27.

| Aspect | How it's graded |
|---|---|
| Not "does it look right" | A browser judge drives the real UI **and** reads server state via `GET /api/__verifier__/snapshot` |
| Exact contracts | Locked object move must return **403 + `OBJECT_LOCKED`**; archived board create must return **403 + `BOARD_ARCHIVED`**; replayed `opId` must return **`DUPLICATE_OPERATION`** |
| Fail-closed guards | Programmatic HTTP probes on auth, lock, archive, connectors, revision, mail — no partial credit for a UI that only *looks* correct |
| Real interaction | Pencil strokes drawn with 41 real mouse-move events; PNG download captured as an actual file and pixel-inspected |
| No app = 0 | If the app never serves, reward is **0** with `no_op=1` — not an error |

Heaviest criteria: `share_email` (3), then `logout`, `pencil_freehand`, `connector_stays_attached`, `group_move_children`, `lock_blocks_edit`, `component_instance`, `download_image` (2 each).

---

## 3. Where each model landed

### 🥇 Gemini 3.7 Flash — 93% (18 / 19)
**Succeeded at:** everything except one criterion. Correct 403 + exact error codes, real grid snapping, working PNG export, master→instance style propagation, guest read-only share links, idempotent `opId` replay.

**Failed:** `connector_stays_attached` (weight 2) — connectors *did* follow shapes when moved, but always rendered as a straight `<line>` instead of the required routed connector. A rendering detail, not a logic gap.

### 🥈 Claude Sonnet 5 — 65% (12 / 19)
**Succeeded at:** the whole UI layer — logout, pencil, undo/redo, style panel, PNG download, share email, grid snapping, group move.

**Failed (9.5 weight lost):**
- **API contract mismatch** — 4 of its 7 failures are the *same* bug: server demanded `opId` / `type` on requests where the spec doesn't, so lock, archive, duplicate and revision-replay all returned `400 INVALID_OP` instead of the required `403` / `DUPLICATE_OPERATION`.
- `connector_stays_attached` — connectors stored static coordinates, never recomputed on move.
- `component_instance` — master fill never propagated to instances.
- `arrow_head_theme_stable` — one shared SVG marker for all arrows, so toggling the theme recoloured old arrowheads.

> Takeaway: Sonnet built a good app and then lost a quarter of the score to one repeated request-validation mistake.

### 🥉 GPT-5.4-mini — 41% (8 / 19)
**Succeeded at:** the backend — register/sign-in, board isolation, group move, grid snapping + geometry rejection, share email, guest read-only link.

**Failed (16 weight lost):** **one fatal frontend bug took out 8 criteria at once.** `app.js` threw `Identifier "color" has already been declared` on every page load, leaving `<div id="app">` empty. No toolbar, no canvas, no buttons — so logout, pencil, undo/redo, style panel, arrow rendering, theme stability and PNG download were all unverifiable.

Plus two genuine gaps: `createConnector` was never implemented server-side (`400 UNKNOWN_OPERATION`), and lock / duplicate ops didn't exist.

> Takeaway: the model never opened its own app in a browser. A single syntax-level bug cost ~30 points.

### Claude Haiku 4.5 — 0% (0 / 19)
**Failed before grading started:** `frontend never served at http://127.0.0.1:5173`. The app never came up, so **zero criteria were probed** — this is a `no_op`, not 19 failed features.

Same pattern across the suite: 3 of Haiku's 5 tasks were no-ops (2 more failed at `npm ci`).

> Takeaway: Haiku's blocker is build-and-serve reliability, not feature reasoning.

---

## 4. The criterion nobody passed

`connector_stays_attached` — **0 / 4 models**.

- Gemini: attaches correctly, wrong shape rendering
- Sonnet: stores static coordinates, never recomputes
- GPT-5.4-mini: feature not implemented at all
- Haiku: never reached

This is the task's hardest signal: it needs geometry that is **derived** from two other objects rather than stored, and every model defaulted to storing coordinates.

---

## 5. What this tells us

1. **The gap is reliability, not capability.** Ranking is driven by "does the app boot and does the frontend parse", not by who understands canvases better.
2. **Failures cluster.** One broken bundle (GPT) or one validation bug (Sonnet) cascades across many criteria — single-criterion scoring would hide this.
3. **Negative paths are where models lose.** Almost every failure is a case the spec says must be *refused* (locked, archived, replayed) or *derived* (connectors, component propagation). The happy path was built by everyone.
4. **The task is not saturated.** Best score is 93%, and nobody scored 100% — there is still headroom for training signal.
5. **n = 1.** One rollout per model. Treat gaps under ~10 points as noise until re-run at k ≥ 5.
