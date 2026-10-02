# Colderwater r9: stand-in visual judge (quick)

Evidence: `golden-1440.png`, `golden-390.png` (context only), `style.css`, `custom-editor.js` lines 1-30, `app.tsx` render (lines 145-173). Screenshots only; no live browser, so caret blink, hover states and scrollbars were not observed. States marked "anticipated" are inferred from CSS and markup, not seen.

## Scores (anchors applied literally)

| Criterion | Score | Risk |
|---|---|---|
| cw_visual_editor_readability | 5 | a strict judge could give 4 |
| cw_visual_workspace_layout | 4 | 3 if the judge opens a saved snippet (history state) |
| cw_visual_component_finish | 4 | 3 if the judge opens revision history |

## cw_visual_editor_readability: 5

Seen: 13px/22px monospace, numbers right-aligned and on the same row as their lines, selection on line 5 clearly visible (#47658b, white text), caret visible at the end of the selection, token colours all readable on #0f1925.

Blemishes a strict judge could cite:

1. Gutter stripe stops after line 10. Below the last line the gutter background and its right border end, leaving a blank area with no gutter column. `.custom-code-editor .gutter`. Fix: paint the gutter on the container, e.g. `.custom-code-editor{background:linear-gradient(90deg,#172637 46px,#34455a 46px,#34455a 47px,#0f1925 47px)}`.
2. Line numbers are dim: #71839a on #172637 is about 4:1. Fix: `color:#8fa3ba`.
3. Code text is small at 13px on a 1440 screen. Fix: `font:14px/22px`.
4. Selection flattens token colours to white (`.selection{color:#fff}`); harmless but removable. Fix: drop `color:#fff`.

## cw_visual_workspace_layout: 4

Seen: three panes clearly grouped, numbered headings, panes end on the same bottom edge, nothing overlapping.

Blemishes:

1. Library hides cards with no cue. Heading says "Saved snippets 12", nine cards are visible; the third row is hidden by `.snippetlist{max-height:120px}` and no scrollbar shows. Bottom gap under row two is about 4px against 10px on top, so the list reads as cut at the panel edge. Fix: `max-height:132px;padding-bottom:10px;scrollbar-gutter:stable` plus a thin styled scrollbar, or show a single horizontally scrolling row.
2. Editor toolbar inset differs from the rows above. `.custom-tools{padding:7px}` against `.filebar{padding:10px 12px}` and `.paneheading{padding:10px 13px}`: Undo starts at x=30, the Title field at x=35; "No active search" ends at x=730, the Save button at x=725. Fix: `.custom-tools{padding:8px 12px}`.
3. Find/Replace row is crowded on the left and empty on the right: two 105px inputs, then about 190px unused. `.custom-tools input{width:105px}`. Fix: `.custom-tools label{flex:1 1 140px}` and `input{flex:1;width:auto}`.
4. Editor footer inset 9px (`.editor-footer{padding:5px 9px}`) against 12-13px elsewhere. Fix: `padding:5px 12px`.
5. Anticipated, long library plus history: `.library{max-height:45%;overflow:auto}` wraps `.snippetlist` (own scroll) and `.history-list` (own scroll), giving nested scroll areas and squeezing the code area toward its 160px minimum. Fix: remove the overflow on `.library` or on the inner lists, not both.
6. Anticipated, conflict notice: `.conflict-notice button{margin:6px}` indents the button 6px from the text's left edge. Fix: `margin:6px 6px 0 0`.
7. Anticipated, draft notice: text and button sit inline and the button can wrap alone onto a second line. Fix: `.draft-notice{display:flex;align-items:center;gap:10px;flex-wrap:nowrap}`.

## cw_visual_component_finish: 4

Seen: one dark palette, one accent, consistent borders and radii, matching fields.

Blemishes:

1. Three button sizes on one screen: Run/Stop inherit 16px, Save is 12px, toolbar and heading buttons are 11px. Fix: set `button{font-size:12px}` globally and keep only Run larger.
2. Anticipated, revision history is partly unstyled: `.history h3` has no font-size (browser default, about 19px, against 12px for "Saved snippets"); `.history-list button`, "Restore selected revision" and "Retry same restore" inherit 16px; `.revision-preview pre` has no border, radius or font. Fix: `.history h3{font-size:12px}`, `.history button{font-size:11px;padding:4px 8px}`, `.revision-preview pre{border:1px solid var(--border);border-radius:6px;font:12px/1.5 ui-monospace,Consolas,monospace}`.
3. Label styles differ: Title/Filename labels are 10px stacked above the field, Find/Replace are 11px inline. Fix: one label size (11px, `color:var(--subtle)`).
4. Very small text: 9px "LOG" at 65% opacity, 10px editor footer, 10px page footer, 9px badge. Fix: raise to 11px and drop the opacity on `.level`.
5. Snippet cards have ragged widths and the open one is marked only by an accent border. Fix: `min-width:150px`, and a tinted background for `[aria-pressed=true]`.
6. Console error rows (anticipated) change only text colour. Fix: add `border-left:3px solid` in the level colour.
