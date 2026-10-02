from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'projects/colderwater-playground-devtools'

files = {
    'instruction.md': '''I'd like a small local playground for working on JavaScript and complete HTML files. The editor itself matters: I often paste a long one-line experiment, format it, make changes in several places, and then run it beside the source. I want to keep the versions that work without losing a draft when another tab saves first.

Please read the six notes in /instructions before building. They describe the custom editor, preview, saved snippets and runtime. /assets/seed_data.json describes the starting scope; there is no starter app to finish.

Put the app in /app and serve the workspace at /. I should be able to open it, edit code, run it and inspect the result without signing in.
''',
    'environment/instructions/overview.md': '''# The playground

Show the code editor, preview and console together. New drafts start empty or with a small example. The saved library is shared by open tabs, without accounts. A snippet has a title, a .js or .html filename, exact source and a revision history. The filename chooses the execution mode.

The editor should be a useful tool in its own right. A long source line must remain editable, and formatting, selection, multiple carets and undo should work on the source that will actually run. Keep the preview separate from the editing surface.
''',
    'environment/instructions/ui.md': '''# Editing code

Build the code editing surface with your own DOM, canvas or SVG text model. Do not use a textarea, input or contenteditable element as the document surface, and do not use CodeMirror, Monaco, Ace, ProseMirror, TipTap, Quill, Slate, Draft.js or another ready-made editor. A small input solely for keyboard or clipboard plumbing is fine. Parsing, highlighting and formatting libraries are allowed; the editing surface and its caret, selection, changes and undo behavior are yours to implement.

Show numbered logical lines and the current line and column. Support normal typing, paste, new lines, Backspace, Delete, arrows, Home and End. Moving vertically should remember the intended column when a shorter line temporarily clamps it. Word movement and selection through the platform modifier should behave consistently. Emoji and decomposed accented letters should move and delete as complete visible characters.

Use ordinary mouse actions to put the caret in text, select a word with a double click, select a logical line with a triple click, and drag a range. The editor must keep a long unwrapped line horizontally reachable so text near its end can be selected and edited. Tab and Shift+Tab should indent and outdent selected lines as one undoable action.

Allow Alt+Click or Ctrl/Cmd+Click to add carets on different lines. Typing, Backspace and Delete affect all of them. A continuous multi-caret typing burst is one Undo action; Redo restores it. Undo and Redo also work from visible controls and normal keyboard shortcuts.

Offer Find, next and previous matches, Replace current and Replace all for literal case-sensitive text. Navigation wraps at the ends. Replace all is one Undo action, and a new edit after Undo clears Redo.

Colour code according to what the tokens are, using visibly distinct treatments: JavaScript keywords, declared function names, strings, numbers and comments; HTML tag names, attribute names, quoted values and comments. Function names should not be coloured as keywords or strings. Choose your own palette; no exact RGB value is required. Colouring is for the editor only and must not change the saved source or preview result.

Provide Format document for valid JavaScript and complete HTML. It should break a compact one-line program into readable lines, use consistent two-space nesting and preserve strings, comments and runtime meaning. Formatting twice should not change the result again. One Undo restores the whole pre-format source; Redo reapplies it. An invalid draft may show a useful formatting error without losing the draft. A standalone formatter is allowed.

Include title and filename fields, Run, Stop, Clear console, New, Save, a saved library and history inspection. Label controls clearly and show keyboard focus. An authored preview keeps its own chosen colours.
''',
    'environment/instructions/behaviour.md': '''# Running and saving

Run the current .js source in a fresh isolated preview document. A complete .html file replaces that document. The browser may execute supported code in the preview; the editor must continue to hold the exact source used for Run. Console log, warn, info and error output should be visible in order. Show a useful error message and a one-based line number for a thrown error, including an error inside a complete HTML file.

Keep the latest successful preview as a last-good picture. If a later run throws, is stopped or exceeds the five-second run budget, show the reason and restore that picture, including values typed into its controls and ordinary canvas drawing. An older cancelled run must not later overwrite a newer preview or console output. A restored picture may be static. The workspace must accept a later valid Run.

Auto-run is optional; if offered, it must not cause a second delayed run after a manual Run. It is not part of the essential editor workflow.

Save a snippet's exact title, filename and source. A fresh page must read the saved record from the running app, and saved work and history must survive a complete server restart. Two tabs may load the same revision. One tab's later successful Save must make the other's old-revision Save fail without changing the saved record or discarding that tab's dirty draft. Give useful conflict feedback.

History inspection is read-only. Restoring an older snapshot creates a new current revision of the same record while retaining the intervening history. An old-revision restore must not overwrite a newer save. A repeated request for the same already committed restore must not create another revision.
''',
    'environment/instructions/security.md': '''# Preview boundary

User-entered code runs in an isolated browser preview. It can change that preview and use its console, but it cannot read or change the playground page, its saved library or origin storage. It must not fetch remote content from the preview. The app itself may load public dependencies and assets.

Refuse dynamic evaluation through eval or Function, WebAssembly, new workers and dynamic module imports with clear feedback. The same words inside ordinary strings or comments remain harmless text. Store saved source as text; never evaluate it on the server.
''',
    'environment/instructions/integration.md': '''# How we start the app

Put the finished app in /app. We start it with node /app/server.js from a working directory that may be outside /app. Resolve files from their actual location. Listen on 0.0.0.0:3000, serve the workspace at / and answer GET /api/health promptly.

The launch image supplies Node 22, Express and better-sqlite3 through NODE_PATH. You may choose your routes and frontend tools. Include everything needed at runtime; opening the finished app must not require an install or build step. Network is public for the app, but user-entered preview code has the boundary in security.md.

Saved snippets, identities and revisions must survive page reloads and complete process restarts. The library must be shared between independent browser contexts. /assets/seed_data.json describes the starting scope and contains no user snippets or starter implementation.

Deliver ordinary files under /app. Symbolic links are unsupported except links under /app/node_modules whose resolved targets also stay under /app/node_modules.
''',
    'environment/instructions/policy.md': '''# Choices left to you

This is one local shared workspace, without sign-in or private accounts. You may choose the layout, labels, routes, database schema and error wording. A parser or formatter library is fine; the document editing surface itself must be your own implementation as described in ui.md.

Use the public behavior in these notes as the contract. The examples are ways to explain it, not exact selectors, CSS classes or implementation requirements. Keep the finished app usable when a draft contains invalid source or a save is refused.
''',
}

for relative, value in files.items():
    path = root / relative
    with path.open('w', encoding='utf-8', newline='\n') as stream:
        stream.write(value)
    print(path)

task = (root / 'task.toml').read_text(encoding='utf-8')
task = task.replace('A JavaScript and HTML playground with isolated execution, preview recovery and a shared revision-history library.', 'A browser code playground with a custom editor, formatting, multiple carets, isolated preview and saved revisions.')
task = task.replace('"typescript", "react", "vite", "express", "sqlite", "code-playground", "devtools"', '"custom-editor", "javascript", "html", "formatting", "code-playground", "devtools"')
task = task.replace('The main challenges are isolating code execution, stopping unfinished runs, restoring previews after errors, and keeping saved snippets consistent when multiple editors change them.', 'The main challenges are implementing a custom code editor with selection, multi-caret undo and formatting, then integrating its exact source with isolated execution and revision-safe saving.')
task = task.replace('full-stack-typescript-vite-react-codemirror-express-sqlite-code-playground', 'custom-code-editor-formatting-preview-history')
with (root / 'task.toml').open('w', encoding='utf-8', newline='\n') as stream:
    stream.write(task)
