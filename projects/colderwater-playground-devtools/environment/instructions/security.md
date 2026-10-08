# Preview boundary

User-entered code runs in an isolated browser preview. It can change that preview and use its console, but it cannot read or change the playground page, its saved library or origin storage. It must not be able to reach my server from the preview: a fetch from the preview to the playground's own address must fail, whether it is called localhost or 127.0.0.1. The app itself may load public dependencies and assets.

Refuse dynamic evaluation through eval, Function, WebAssembly, new workers and dynamic module imports with clear feedback. The same words inside ordinary strings or comments remain harmless text. Save source as text.
