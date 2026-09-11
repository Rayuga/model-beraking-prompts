# PatchPad: Docketlight judge weights

Upload: [patchpad-editor-v2.zip](patchpad-editor-v2.zip), version 1.0.0, 32 files.

The user supplied `projects/docketlight-claims-insurance` as the new weight
reference. Its top-level judge weights are copied exactly:

| Dimension | Earlier | Now |
| --- | ---: | ---: |
| Functional | 4.0 | 0.6 |
| Polish | 3.0 | 0.2 |
| Visual | 2.0 | 0.2 |
| Render | 1.0 | 1.0 |
| Constraints | 1.0 | 1.0 |

Only three task files changed, each at the top-level judge weight. Every other
parsed value is preserved, including all criterion descriptions and individual
weights. Task instructions, timeouts, runtime code, reward.toml and the final
test.sh gated 60/20/20 formula remain byte-identical to the prior package.
Additional verifier findings remain deferred as requested.

Validation: 108 local standard checks, exact comparison with Docketlight judge
weights, preservation checks for all other task content, TOML parsing and ZIP
CRC/content verification passed. `package-audit.json` records the ZIP SHA-256
and detailed changes. `before-docketlight-weights.zip` preserves the earlier
behavior-verifier package.

No fresh Oracle or platform QC run is claimed. RewardKit 0.1.7's built-in
aggregate still includes the positive Render/Constraints judge weights;
test.sh overwrites that intermediate total with the gated final formula.
This release matches the supplied reference without claiming that every
cross-file QC concern is resolved. The reference's other configuration,
timeouts and comments were not copied.
