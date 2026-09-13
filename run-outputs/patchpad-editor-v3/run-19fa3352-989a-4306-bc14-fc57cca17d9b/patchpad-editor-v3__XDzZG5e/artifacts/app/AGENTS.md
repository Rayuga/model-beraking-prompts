# Repository Notes

- PatchPad uses `/app/patchpad.sqlite` as the local source of truth.
- The seeded report is `incident-alpha` and starts at revision 1.
- Save requests must include `baseRevision` and text `content`; stale saves return HTTP 409.
- The browser editor is custom DOM-based and does not use textarea/contenteditable for the document surface.
