# PatchPad: desktop visual review

Updated 2026-09-11 at the user's request to remove responsiveness.
Upload: **patchpad-editor-v2.zip**, version **1.0.0**, 32 files.
SHA-256: `e254cc0ec781eb59aa2d722c8296b0ba9440ea507823ec9444d55607a491686d`.

Removed `visual_responsive_consistency`, mobile screenshot instructions and
the mobile requirement from the product brief. Visual now reviews only
1280x800 desktop presentation through five equally weighted criteria:
typography, colour/contrast, spacing/layout, hierarchy/scannability and craft.
The remaining criterion descriptions and weights are unchanged.

There are now 39 criteria: 2 Render, 2 Constraints, 27 Functional, 3 Polish,
5 Visual. All five verifier folders remain. Visual still contributes 20% of
the final reward; each remaining visual criterion therefore contributes up to
4 percentage points. The formula, configuration, timeouts and app are unchanged.

88 reference-standard checks, parsed criterion-preservation checks, ZIP
content/hash/CRC verification and whitespace checks passed. Exactly three task
files changed: the visual rubric, visual prompt and interface brief.
No new browser, image build or oracle run was performed for this rubric-only
change. Prior local evidence and image-build limitations are documented in
`../1.0.0-reference-standard/README.md`; they are not a fresh oracle result.

The previous ZIP is preserved as `before-desktop-visual.zip`; previous release
files remain intact. `package.py` rebuilds this release. Root authoring rules
record this as an explicit PatchPad exception, leaving other tasks' defaults
unchanged. Fresh platform QC and a full oracle remain pending.
