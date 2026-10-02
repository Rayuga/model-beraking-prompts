# Running and saving

Run the current .js source in a fresh isolated preview document. A complete .html file replaces that document. The browser may execute supported code in the preview; the editor must continue to hold the exact source used for Run. Show console output and a useful error message with a one-based line number for a thrown error, including an error inside a complete HTML file.

Keep the latest successful preview as a last-good picture. If a later run throws, is stopped or exceeds the five-second run budget, show the reason and restore that picture, including values typed into its controls and ordinary canvas drawing. The budget covers source execution and pending timer or Promise callbacks until that run settles. After it settles, a later user interaction in the preview starts a fresh five-second budget for its own callbacks. An older cancelled run must not later overwrite a newer preview or console output. A restored picture may be static. The workspace must accept a later valid Run.

Save a snippet's exact title, filename and source. A fresh page must read the saved record from the running app, and saved work and history must survive a complete server restart. Two tabs may load the same revision. One tab's later successful Save must make the other's old-revision Save fail without changing the saved record or discarding that tab's dirty draft. Give useful conflict feedback.

History inspection is read-only. Restoring an older snapshot creates a new current revision of the same record while retaining the intervening history. An old-revision restore must not overwrite a newer save. A repeated request for the same already committed restore must not create another revision.
