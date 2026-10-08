# Preview boundary

I run code I've pasted from all over the place, so it should run in an isolated preview. It can change that preview and use its console, but it shouldn't be able to read or change the playground page, my saved library or the page's storage, and it shouldn't be able to reach my server: a fetch from the preview to the playground's own address should fail, whether it is called localhost or 127.0.0.1. The app itself can load public libraries and assets.

For the same reason, please refuse dynamic code (eval, Function, WebAssembly, new workers and dynamic module imports) and tell me clearly when you do. Those words inside ordinary strings or comments are just text and shouldn't trip anything. Save code as plain text.
