from pathlib import Path
import json,hashlib
root=Path.cwd();base=root/'projects/colderwater-playground-devtools/solution/app/starters'
out=root/'deliverables/colderwater-playground-devtools/full-qc-2026-09-27'
updates={}
p=base/'README.md';text=p.read_text();text=text.replace('A stylesheet, for the three-panel layout.','A stylesheet for the last successful preview document.');text=text.replace('.css is\napplied to it.','.css styles a fresh copy of the last successful document without rerunning its\nscripts or retaining event handlers, timers or globals.');updates[p]=text
p=base/'sheet.css';text=p.read_text().replace('A starter stylesheet. Deliberately small: it is a worked example of the\n   three-file layout, not a design system.','A small starter stylesheet applied to a fresh copy of the last successful\n   preview document.');updates[p]=text
p=base/'running-code.md';text=p.read_text()
text=text.replace('Every run starts from a clean frame with no state left over from the last one. No\nleaked timers, no leaked globals, no half-updated DOM.','JavaScript and HTML runs start with a fresh document. CSS runs use a fresh copy\nof the last successful document and styles without rerunning its scripts. No\nold event handlers, timers or globals carry into the new frame. Authored snippets\ncannot request external resources or network services.')
text=text.replace('.css    is applied to the preview document','.css    styles a fresh copy of the last successful preview document')
text=text.replace('A run gets a time budget of five seconds. Anything still going is terminated, and\nthe app says plainly that it was stopped and why. Never hang the tab and never\nfail silently - slow.js is in this folder precisely so that behaviour can be seen.','Supported JavaScript includes literal loops and functions, ordinary DOM changes,\ntimers and Promise callbacks, plus inline classic scripts in complete HTML.\nDynamic eval/Function execution, WebAssembly, additional workers and dynamic\nimports are outside this playground and must be refused clearly. Those words\nremain valid in ordinary strings, comments and HTML text.\n\nA supported run has one five-second budget, including time spent waiting for its\ntimers and callbacks. Work still running at that limit is stopped with a clear\nreason while the surrounding app stays usable. slow.js demonstrates a supported\nliteral infinite loop. This is not a promise to interrupt arbitrary native\noperations or unsupported generated code.')
text=text.replace('A run that is already going is cancelled by starting another.','Starting another run cancels the previous run and prevents its late output from\nreplacing the new result. Stop cancels the active run, explains why it stopped\nand restores the last completed successful preview.')
updates[p]=text
changes=[]
for p,text in updates.items():
 old=p.read_bytes();p.write_text(text,encoding='utf-8',newline='\n')
 changes.append({'file':str(p.relative_to(root)).replace('\\','/'),'before_sha256':hashlib.sha256(old).hexdigest(),'after_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'scope':'documentation or CSS comment only'})
(out/'golden-starter-doc-delta.json').write_text(json.dumps(changes,indent=2)+'\n')
print(json.dumps(changes,indent=2))
