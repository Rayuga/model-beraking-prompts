# PatchPad delivery

Current prepared package: [1.0.0 line-number coverage and prompt provenance](1.0.0-rubric-coverage-provenance/README.md).
Upload: [patchpad-editor-v2.zip](1.0.0-rubric-coverage-provenance/patchpad-editor-v2.zip).
The new package explicitly grades document line numbers, restores plain-text
prompt version identifiers, logs verifier hashes and removes reference-product
wording. All 32 task files and 39 criteria are retained; weights and golden code
are unchanged. It passes 118 local standard checks and focused browser/runtime
validation. Fresh platform rubric QC and a full Oracle remain necessary.
Today's guidance and decisions: [task lessons](../../TASK_LEARNINGS_2026-09-11.md).
Local golden preview: http://localhost:3035/.

The three failed Oracle criteria now separate flexible setup from numbered
graded observations, following Docketlight. The golden app has clearer report
hierarchy, a larger preview and contained editor/history scrolling. Required
behaviors, all weights and appearance-only Visual criteria are preserved.

All five supplied Oracle/no-op/model trials are reviewed in the release report.
Three Oracle Functional failures pass local browser reproduction; their judge
procedures now capture checkpoints and validate setup more reliably. A fresh
full platform Oracle is required; no new full-run score is claimed.

Top-level judge weights now follow Docketlight: Functional 0.6, Polish 0.2,
Visual 0.2; Render and Constraints remain 1.0. The final gated reward formula
and individual criterion weights are unchanged.

Four Functional verifiers now check the required behavior without assuming a
specific API identity layout, scroll container, indentation width or coordinate
display base. See [the earlier verifier comparison](1.0.0-behavior-verifiers/VERIFIER_BEFORE_AFTER.md).

This follows the September 11 Bazaarbridge commerce standard with five
verifier dimensions and fixed version 1.0.0. Per the user's later instruction,
Visual now has five desktop-only criteria; responsiveness is removed.
Local checks passed; exact image
builds are blocked by the local network configuration, and fresh platform QC
and a full oracle remain pending. See the release README for precise evidence.
Earlier 2.0.x packages and run reviews are historical.
