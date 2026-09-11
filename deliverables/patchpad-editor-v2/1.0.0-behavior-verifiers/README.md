# PatchPad: behavior verifier corrections

Upload: [patchpad-editor-v2.zip](patchpad-editor-v2.zip), version 1.0.0, 32 files.

Four Functional criterion descriptions now permit choices left open by the
brief: API document-identity locations, the selection-driven scroll container,
indentation width, and consistent zero-based or one-based cursor labels.
The shared Functional prompt explains coordinate normalization for all relevant
criteria and the evidence required for an inapplicable identity probe.

Read [the complete earlier and current descriptions](VERIFIER_BEFORE_AFTER.md).
`verifier-changes.json` contains the same exact descriptions in structured form.
`before-behavior-verifiers.zip` preserves the prior comment-removal upload.

Validation: 108 local standard checks passed. The packager checks that exactly
two task files changed, exactly four criterion descriptions changed, and every
other parsed judge value (including IDs, counts, types and weights) is preserved.
It verifies that all other task files are byte-identical to the prior package,
the comparison matches both packages, TOML parses without comment lines, and
the ZIP passes CRC and byte-for-byte content checks. See `package-audit.json`
for the final ZIP hash and detailed scope.

The golden app and task instructions are unchanged. No new browser run or full
Oracle run is claimed. Fresh platform QC is pending; these local checks do not
run the platform's semantic rubric review. The dimension-weight disagreement,
credit for nonfunctional shells and prior Polish feedback ambiguity remain
outside this correction.
