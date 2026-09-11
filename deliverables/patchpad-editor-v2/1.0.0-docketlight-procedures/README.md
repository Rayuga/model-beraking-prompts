# PatchPad: Docketlight procedures and golden presentation

Upload: [patchpad-editor-v2.zip](patchpad-editor-v2.zip), version 1.0.0, 32 files.
Local preview: http://localhost:3035/.

The three previously failed Oracle criteria now follow Docketlight's explicit
Setup / numbered graded observations structure. Setup must be reached through
the real UI but the judge may choose a working navigation route. Tab reversal,
mouse and keyboard offscreen selection, and external clipboard checks still
require their exact behavioral outcomes. Required actions retain their counts.
The prior bounded recovery for a demonstrated judge error remains; actual app
failures cannot be retried into passes.

Reference evidence: `projects/docketlight-claims-insurance/tests/functional/prompt.md`
explains flexible setup and per-criterion evidence; its Functional criteria
use Setup followed by numbered observations. PatchPad keeps real editor input
requirements rather than copying Docketlight's permission to use API writes
for setup. Authentication, financial workflows, timeouts and model overrides
were not imported.

Golden app improvements address the observed Visual deductions: the report
title is a distinct heading; short document section headings receive readable
emphasis without changing text, line height or selection semantics; editor and
history scroll within the desktop viewport; revision previews use 13px monospace
text, increased line spacing and up to 340px height instead of 120px. The page
no longer grows with a long history and leaves blank space under the editor.

Visual criteria remain appearance-only. No scores, thresholds, weights or
required features were reduced. There are still 39 criteria and the same final
gated 60/20/20 reward formula. All other deferred verifier findings remain deferred.

Validation: 29 browser regression groups passed across five suites, including
all three failed Oracle interactions, Unicode, focus, exact mouse selection,
Undo/Redo, clipboard, Find/Replace, saving, history/restore and API rejection
checks. Desktop review confirms a 1280x800 page without overflow, a contained
editor, a 338px inner preview and independently scrolling seven-revision history;
previewing does not mutate saved content. 108 standard checks, exact scope and
TOML preservation checks, syntax and ZIP CRC/content verification passed.

The browser diagnostics run in a fresh offline container using the cached
verifier image. They use golden-specific selectors and are excluded from the
task package. The delivered verifier continues to discover each submission's
UI. Local diagnostic success is not an LLM Oracle score. A fresh full platform
Oracle and semantic QC run remain necessary; the configured OpenAI credential
is unavailable locally, so no new full Oracle pass is claimed.

- [Exact verifier wording changes](VERIFIER_BEFORE_AFTER.md)
- [Previous complete run analysis](../1.0.0-oracle-reliability/RUN_REVIEW.md)
- [New desktop screenshot](golden-desktop-after.png)
- [New history/preview screenshot](golden-history-after.png)
- [Desktop validation](desktop-review.json)
- [Package audit and final SHA-256](package-audit.json)

The preview container is `patchpad-golden-preview-100-docketlight`. It runs a
disposable SQLite copy and leaves earlier preview containers and all historical
upload archives intact.
