# The execution boundary

Run snippets in an isolated browser context that cannot read or change the playground's own document or origin storage. Access to the preview's own DOM and ordinary console methods is legitimate. A forbidden parent-document or parent-storage access fails inside the snippet, without damaging the surrounding application or the saved library. Accept only messages belonging to the active run when presenting its console and status.

Support ordinary source-authored JavaScript, including literal loops, functions, DOM updates, timers and Promise callbacks; complete HTML with inline classic scripts; and CSS applied to a rendered document. The five-second budget covers this supported source and its callbacks. It is not a promise to interrupt an arbitrary blocking browser-native operation or unrestricted generated machine code.

Dynamic code generation with eval or Function, WebAssembly, additional workers and dynamic module imports are outside this playground's supported execution scope. Refuse unsupported execution with a clear message and preserve the last successful preview, rather than silently claiming it ran. Ordinary string values, comments or HTML text merely containing those words are not themselves execution.

Keep application assets, editor components and examples local. Snippets cannot use external resources or network services. Serve only the intended application assets and APIs, never arbitrary host files, verifier files or secrets. No source entered into the editor is evaluated by the server.