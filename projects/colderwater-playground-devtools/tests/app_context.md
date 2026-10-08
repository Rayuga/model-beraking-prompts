## Application

Name: Colderwater playground
URL: http://localhost:3000

Colderwater is a local JavaScript and HTML code playground: a custom code editor, a preview, a console and a shared library of saved snippets with revision history. The filename ending (.js or .html) chooses how Run executes the source.

## Accounts

None. The app has no sign-in; every browser tab or context uses the same shared library.

## Key screens

One workspace at /. It shows title and filename fields, the code editor with its Undo, Redo, Format, Find and Replace controls and a line and column readout, Run, Stop, New and Save controls, the preview, the console, the saved library and the revision history of the open snippet.

## Notes for grading

- The editor is expected to be the app's own surface and not a form field; the constraints dimension checks that. Enter text with real key presses, or by pasting with the usual shortcut. Read the current source from the rendered editor lines and check it equals your fixture before acting on it.
- Typing helpers that only work on form fields do not work on a custom editor; type into it with real key presses, through the press-key tool or page.keyboard in the code runner.
- Real input includes driving the real mouse and keyboard at coordinates you choose, for example a triple click or a modifier-click at a character position, through the browser tool or its Playwright code runner (page.mouse and page.keyboard). That is real input, it is always allowed, and it is not one of the script uses limited below. Dispatching synthetic DOM events or calling the app's own functions is never allowed.
- A modifier-click means the modifier key is held down during the click. With the click tool, pass the modifier in its modifiers option; in the code runner, use page.keyboard.down for the modifier, page.mouse.click at the character position, then page.keyboard.up. Pressing and releasing the modifier before an ordinary click is not a modifier-click. A click on an element without a position lands at its centre, so aim at the character position the criterion names and count the visible carets after each click before typing.
- Characters that cannot be produced by a single key press, such as an emoji or a letter followed by a combining accent, may be typed into an ordinary field such as Find, copied from there with the usual shortcut and pasted into the editor.
- A selection can be confirmed by copying it with the usual shortcut and pasting it into an ordinary field such as Find, or, where a criterion does not ask for the copied text, by reading the highlighted text. A single-line field shows a copied line break as a space or drops it; treat that as the same text, or paste a multi-line copy back into the editor to compare it.
- Before every Run, make sure the filename ending matches the draft you entered: .js for JavaScript, .html for a complete HTML file.
- Use fresh scratch drafts for editor checks. The app may ask for confirmation before discarding an unsaved draft; accepting that dialog is normal. The browser may also ask whether to leave the page when you reload or navigate with an unsaved draft. A reload or navigation that seems to hang or returns a timeout usually means that dialog is open: handle the dialog by accepting it and continue. Accepting these dialogs is ordinary use of the app, not a repair or a workaround, and a reload that waited for one is not a failure.
- Saved records are identified by the server, not by title, and the library may already hold records from earlier checks. Do not assume an empty library and do not delete records that earlier checks created.
- Health address: http://localhost:3000/api/health. The same server also answers at http://127.0.0.1:3000. No criterion needs any address outside this machine.
- Where a criterion needs two tabs, any two pages of the app are acceptable. Tabs share browser storage, so where a criterion says to clear browser storage first, run a script on the app page that clears localStorage, sessionStorage, IndexedDB databases, Cache Storage, the origin private file system, service worker registrations and cookies for this origin, then reload.
- Script that changes anything may be used for exactly three things: that storage clearing; re-sending, with an in-page fetch from the app page, a request you recorded from the app's own network activity, where a criterion asks for a replay; and setting and reading back one localStorage entry on the app page where the preview-isolation criterion asks for it. Reading the rendered DOM, computed styles and browser storage without changing them is always allowed. Every other graded action uses real keys and mouse input. Where a prompt says not to use script, it means apart from these three uses in the criteria that ask for them.
- After the restart tool has been used, open fresh pages instead of reusing pages opened before the restart.
- If the editor draws its text on a canvas, read colours and text from screenshots instead of computed styles.
- Run may be broken in a submitted app. Criteria that do not depend on Run are still scored on their own steps; a criterion whose steps need a working Run fails if Run does not work.
- The preview may be restored as a static picture after a failed run.
- Network access to public assets by the app itself is allowed and is not a failure.
