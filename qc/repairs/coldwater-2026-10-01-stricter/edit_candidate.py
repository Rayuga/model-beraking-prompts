from pathlib import Path
import re, json, tomllib

root = Path(__file__).resolve().parents[3]
task = root / 'projects/colderwater-playground-devtools'
def read(rel): return (task/rel).read_text(encoding='utf-8')
def write(rel, text): (task/rel).write_text(text.rstrip()+'\n', encoding='utf-8', newline='\n')

write('instruction.md', """I'd like a small playground for trying out browser ideas in JavaScript and complete HTML files. Keep the editor, preview and console together, with a shared library for the snippets worth keeping. No accounts or sign-in; it's a local tool.

The annoying part is losing something that was working. If my next attempt breaks or I stop it, bring back the actual last good preview, including changes I'd made using its controls. Re-running the original source isn't enough if that loses what I typed. I also want to go back through saved versions without losing newer work, especially when I've got two editors open.

Please read the six notes in /instructions before starting. They cover running code, saved history and the limits of the playground. /assets/seed_data.json describes the starting scope; there's no starter app to finish.

I need to start a fresh draft, save it and come back later. Make the interface comfortable with a keyboard and on a narrow screen. A single clear colour scheme is enough.

The finished app goes in /app. Our setup and start command are in /instructions/integration.md. External fonts, scripts and CDN assets are fine for the app itself.
""")
write('environment/instructions/overview.md', """# The playground

The main workspace is an editor, a live preview and a console. Let me start a new draft or load a saved snippet. An empty starting workspace is fine.

The filename tells the app what I'm running: .js for JavaScript and .html for a complete HTML document. I shouldn't have to keep a separate language selector in sync. Styles can go inside my HTML; there's no separate stylesheet mode to build.

The local app has one shared saved library, without accounts or private collections. Each saved snippet keeps its history. I want to inspect an older version before deciding whether to restore it. The details are in /instructions/behaviour.md.
""")
write('environment/instructions/ui.md', """# Working in the playground

I'd like the editor, preview and console visible as three useful panes. On a narrow screen they can rearrange or stack, as long as I can still reach each pane and its controls.

The editor needs a monospaced face, line numbers and syntax colouring for JavaScript and HTML.

Include title and filename fields, Run, Stop, Auto-run, Clear console, New, Save and the saved library. For a saved snippet, let me browse its revisions, read an older one and deliberately restore it. The wording and placement are up to you.

Keep text legible, controls labelled and keyboard focus visible. I should be able to move through the workspace and saved history without a pointer. One colour scheme is enough; an authored preview can keep the colours its own code specifies.
""")
s=read('environment/instructions/behaviour.md')
s=s.replace(' For CSS, apply the stylesheet to a small built-in sample page.', '')
s=s.replace('That restored picture can be static;', 'Keep the actual latest successful picture, including text I typed into its inputs and changes made by its buttons. Do not rebuild an earlier picture by rerunning its original source. That restored picture can be static;')
s=s.replace('The ordinary Run action works whether auto-run is on or off.', "The ordinary Run action works whether auto-run is on or off. If an automatic run is queued, pressing Run consumes that pending attempt: execute the current code once, without a second run when the old wait expires. Opening a saved snippet or starting a new draft cancels queued work too. Merely opening that source must not execute it, even with Auto-run enabled; a later edit or an explicit Run can execute it.")
s=re.sub(r"Titles can't be empty\..*?saved record\.", "Use the .js or .html filename to choose the execution mode without a separate selector. Titles are just display names; records have their own identities.",s,flags=re.S)
s+='''

## Going back to saved work

Every successful Save keeps an immutable snapshot of the title, filename and exact source at that revision. Keep older snapshots when I save again. I should be able to read an older revision without changing either the current saved version or my unsaved draft, and without running that old source.

Restoring an older snapshot makes a new current revision of the same snippet. It copies that snapshot's three fields; it doesn't erase the intervening history or put the revision counter backwards. Saving and restoring from two editors follow the same rule: the operation refers to the current revision the editor last loaded. If somebody has changed it, refuse my stale restore, leave the saved state alone and keep my unsaved fields with a useful explanation.

A restore reply can get lost after the server has already accepted the change. Let me retry that same attempt. It must return the original restore result without creating another revision. That still holds if somebody saves newer work before my retry arrives: acknowledge the earlier result without replacing their newer work. A retry is the same attempt, distinct from deliberately requesting another restore.

When two different changes arrive together for the same loaded revision, exactly one can become current. The loser gets a conflict, and no half-written or extra history entry should appear. This applies to two Saves as well as a Save racing a restore. Saved history and the results needed to recognise a retried restore must survive a reload and a process restart along with the current record.
'''
write('environment/instructions/behaviour.md',s)
s=read('environment/instructions/integration.md').replace('After restarting, I should have the same built-in example choices, without extra copies, and no duplicate saved records.', 'Saved history and recognised restore attempts must survive too, without duplicate records or revisions.')
s=s.replace('Supply your own working examples as part of the playground.', 'Start with an empty saved library; users create their own snippets.')
write('environment/instructions/integration.md',s)
write('environment/assets/seed_data.json',json.dumps({'snippets':[], 'note':'The saved library starts empty. Build a JavaScript and HTML playground with durable revision history.'},indent=2))
s=read('task.toml').replace('A local JavaScript, HTML and CSS playground with a code editor, live preview, console and saved snippet library.', 'A JavaScript and HTML playground with isolated execution, preview recovery and a shared revision-history library.')
write('task.toml',s)

# Remove obsolete app controls and retain only the supported execution modes.
s=read('solution/app/src/app.tsx')
for first,last in [('  async function openExample(', '  async function save('),('  async function remove()', '  async function loadLatest()'),('  function exportFile()', '  function resize(')]:
    a=s.index(first);b=s.index(last,a);s=s[:a]+s[b:]
s=s.replace('async function save(duplicate = false, chosenTitle = current.current.title)', 'async function save(chosenTitle = current.current.title)')
s=s.replace('!duplicate && draft.record','draft.record')
s=s.replace('before saving or deleting.', 'before saving or restoring.')
write('solution/app/src/app.tsx',s)
s=read('solution/app/src/runtime.ts').replace("['js', 'html', 'css']", "['js', 'html']").replace('.js, .html or .css', '.js or .html')
s=re.sub(r"  if \(kind === 'css'\) \{ const style =.*?\n",'',s)
write('solution/app/src/runtime.ts',s)
s=read('solution/app/server.js').replace("app.use('/starters', express.static(path.join(root, 'starters'), { fallthrough: false }));\n",'')
write('solution/app/server.js',s)
write('solution/solve.sh',read('solution/solve.sh').replace('test -f "$source_app/starters/hello.js"\n',''))
write('solution/app/src/style.css',read('solution/app/src/style.css')+'''\n.history{border-top:1px solid var(--border);padding:12px 0}.history h3{margin:4px 0 10px}.history-list{display:flex;gap:6px;flex-wrap:wrap;max-height:120px;overflow:auto}.revision-preview{padding:10px 0}.revision-preview pre{max-height:160px;overflow:auto;white-space:pre;line-height:1.5;background:var(--bg);padding:10px}.history button[aria-pressed=true]{outline:2px solid var(--accent)}\n''')

# Keep unchanged judge wiring and the shared scoring policy.
removed={'cw_startup_ready','cw_usable_examples','cw_example_separate','cw_restart_example_inventory','cw_css_builtin_preview','cw_pending_css_supersession','cw_theme_actual_switch','cw_theme_work_preserved','cw_title_trimming','cw_title_collision_refusal','cw_title_empty_rejected','cw_title_case_sensitive','cw_title_refusal_recovery'}
s=read('tests/scored/functional/judge.toml')
parts=s.split('[[criterion]]')
parts=[parts[0]]+[p for p in parts[1:] if tomllib.loads('[[criterion]]'+p)['criterion'][0]['id'] not in removed]
write('tests/scored/functional/judge.toml','[[criterion]]'.join(parts))
s=read('tests/scored/functional/prompt.md')
for sid in ['S01','S24','S34']:
    s=re.sub(r'### '+sid+r'\b.*?(?=### S\d|## Binary outcome)', '', s, flags=re.S)
s=s.replace('23 named protocols','22 named protocols')
s=s.replace(' CSS applies to a built-in sample page.','')
s=s.replace('Title collision probes instead use its CURRENT revision and otherwise-valid fields. ', '')
s=s.replace('step 1\'s', 'step 1\'s')
s=re.sub(r'1\. Workspace:.*?6\. Boundaries:.*?(?=\n\n)', '''1. Workspace: S14, S15, S16, then S19.
2. Persistence: S21, S23, then S37 and S38. Immediately S22 performs the single process restart and history readback. Keep protocol records distinct.
3. Execution: S02, S03, S04, S08, S09, S10, S11, S12, S13 and S36. Reuse actually completed controls when the fixture permits.
4. Auto-run: S17.
5. Boundaries: S05 and S07. Close only probe contexts and remove only the routing handlers installed by S07.''',s,flags=re.S)
s=s.replace('six-phase','five-phase').replace('Six-phase','Five-phase')
s=s.replace('exactly once immediately after S21 in phase 2', 'exactly once at the end of phase 2')
s=re.sub(r'3\. Change to dispatch\.css.*?4\. Change to dispatch\.js', '3. Change to dispatch.js',s,flags=re.S)
s=s.replace('do not repeat a CSS-specific timer workflow here.', 'do not repeat pending-timer workflows here.')
s=re.sub(r'3b\. Start the same pending A.*?(?=4\. Independently)', '',s,flags=re.S)
s=s.replace('both JS and CSS', 'JS').replace('JS and CSS replacement trials', 'JS replacement trial')
s=s.replace('3. Execute S34 using this actual completed state and nonempty console; do not repeat its setup Run. Then use Clear console:', '3. Use Clear console on this actual nonempty console:')
s=s.replace('theme-shared-preview','console-history-preview')
s=s.replace('JavaScript, complete HTML and CSS source','JavaScript and complete HTML source')
# Restart is one shared observation, with separate current-record and history credit.
a=s.index('### S22 ');b=s.index('### S23 ',a)
s=s[:a]+'''### S22 — cw_process_restart_durability

About 15 actions plus the single restart and readbacks. Run after S37 and S38.

1. Using only New and Save, create QC Restart Primary (restart.js, console.log('restart-original');). Save an update console.log('restart-before-restart');. Record the whole current library's actual identities, title, filename, exact source and revision from normal UI or observed product-data responses. Include S21 and the gate's records without modifying them. For the Primary and S37/S38 history fixtures, record the actual available revision snapshots. Capture S37's successful restore request and original result for its post-restart retry. If history or restore is missing, retain those product failures and still collect ordinary record evidence and perform the one restart.
2. Call the verifier MCP tool restart_app exactly once, wait for its completed restart, and open a fresh page at http://localhost:3000. Reload alone is not restart. Compare every recorded current record and its exact fields/revision, each present once. Ignore order and display-only metadata. This observation owns process_restart_durability, independently of history or later writing.
3. Compare all recorded history snapshots and revision identities for the controlled fixtures. No prior snapshot may disappear, change or duplicate. If no history exists, this outcome has no successful control and fails; do not convert missing product history into a tooling error. This owns history_restart.
4. Replay S37's exact successful restore request once with the same attempt identity after restart. The response identifies its original committed result; a fresh read of the current record and history is unchanged. This owns restore_retry_restart, independently of ordinary history survival. If no restore could succeed beforehand, this product feature lacks its required control.
5. Update Primary with its actual current revision to console.log('restart-after-save'); and confirm fresh readback and an advanced revision with unrelated records unchanged. If Primary was lost, create a fresh New/Save control and update it instead. This independently owns process_restart_write; do not inherit the durability verdict.

''' +s[b:]
write('tests/scored/functional/prompt.md',s)
s=read('tests/scored/functional/judge.toml').replace('JS, complete HTML and CSS','JS and complete HTML').replace('JavaScript/CSS restart fixtures','JavaScript restart fixture').replace('JS and CSS replacement trials','JS replacement trial')
write('tests/scored/functional/judge.toml',s)
s=read('tests/app_context.md').replace("The app's own examples provide an immediately working starting state.", 'An initially empty editor and library are valid.')
s=s.replace('examples, a saved-snippet library, New and Save; and a theme toggle.', 'a saved-snippet library, New, Save, revision history, inspection and restore/retry actions.')
s=s.replace('A .js or .html run starts isolated; CSS applies to a built-in sample page.', 'A .js or .html run starts isolated.')
s=s.replace('Titles are unique after trimming, case-sensitive; the required source extensions are .js/.html/.css. Rejected stale saves and invalid titles leave all saved records unchanged.', 'Required source extensions are .js/.html. Titles are display names, not unique record keys. Stale saves and restores leave saved state unchanged. History snapshots are immutable; restoring appends a new revision. A retry acknowledges the original restore without another mutation, including after a later Save or a process restart.')
s=s.replace('The early process-restart scenario follows basic save/load,', 'The process-restart scenario follows save/load and history protocols,')
write('tests/app_context.md',s)
s=read('tests/scored/polish/prompt.md').replace('theme, examples, saved-snippet loading, New and Save', 'saved-snippet loading, New, Save, history inspection and restore/retry')
s=s.replace('reach and operate the example picker, choose a different runnable example and observe its source in the workspace, then reach the saved library and open your own snippet.', 'reach the saved library and open your own snippet, then reach its history and inspect a saved revision without activating Restore.')
write('tests/scored/polish/prompt.md',s)
s=read('tests/scored/polish/judge.toml').replace('choose an example, load the recognisable saved control and return to the editor. Observe the correct example and saved source.', 'load the recognisable saved control, inspect its history and return to the editor. Observe the correct saved and historical source.').replace('theme switching, persistence','persistence')
write('tests/scored/polish/judge.toml',s)
s=read('tests/scored/visual/prompt.md').replace('Functional\nchecks whether the theme control changes the workspace; Visual assesses\nthe resulting colours, contrast and typography.', 'Visual assesses the offered colours, contrast and typography.')
s=s.replace('Review both offered themes for colour and\ncontrast.', 'Review the offered appearance for colour and contrast; one theme is enough.')
write('tests/scored/visual/prompt.md',s)
