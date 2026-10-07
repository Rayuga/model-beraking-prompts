I'd like a small local playground for working on JavaScript and complete HTML files. The editor itself matters: I often paste a long one-line experiment, format it, make changes in several places, and then run it beside the source. I want to keep the versions that work without losing a draft when another tab saves first.

Please read the six notes in /instructions before building. They describe the custom editor, preview, saved snippets and runtime. /assets/seed_data.json describes the starting scope; there is no starter app to finish.

Put the app in /app and serve the workspace at /. I start it with node /app/server.js, and it keeps its data in /app/app.db. I should be able to open it, edit code, run it and inspect the result without signing in. Before you hand it over, please check it yourself the way I'll use it: type into the editor, run the code and save a snippet, and make sure nothing breaks.
