# Where snippets run

Snippets need an isolated browser context. They can change their own preview document and use the console, but they can't read or change the playground's document or origin storage. Trying to reach the parent document or its storage should fail inside the snippet and leave the app and saved library alone. Only the active run should be allowed to send current console or status updates.

Please support ordinary source-written JavaScript: literal loops, functions, DOM changes, timers and Promise callbacks. HTML can be a complete document with inline classic scripts. CSS applies to a rendered document. The five-second budget covers that source and its callbacks; it doesn't promise to interrupt arbitrary blocking browser-native operations or generated machine code.

Dynamic execution through eval or Function, WebAssembly, additional workers and dynamic module imports are outside this tool's scope. Refuse those attempts clearly and keep the last good preview, rather than claiming the code ran successfully. Those same words in ordinary strings, comments or HTML text are harmless and should still work.

The app itself may load external fonts, scripts and CDN assets. Code entered into the editor has a separate boundary: snippets can't fetch external resources or use network services. Serve the intended app assets and APIs only, without exposing arbitrary host files, internal files or secrets. Source entered into the editor is never evaluated on the server.
