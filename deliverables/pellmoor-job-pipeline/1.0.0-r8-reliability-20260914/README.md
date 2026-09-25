# Pellmoor r8 repair candidate

Use [pellmoor-job-pipeline.zip](pellmoor-job-pipeline.zip) for the next evaluations. The exact SHA256 and full source hashes are in [package-verification.json](package-verification.json).

ZIP SHA256: `e2cb22b029d958b29bc817003149236a0b0baa51803982fbee1d69ee171c81af`

The newly uploaded r7 runs scored Oracle **0.8386** and GPT **0**. Oracle lost interaction evidence and had a clipped batch footer. GPT shipped an undefined UI function after its development browser failed to launch because a Linux library was missing.

r8 adds a complete agent-browser runtime, preserves primary-session and receipt checkpoints, clarifies existing setup/metadata probes, and fixes the golden dialog layout. Criteria, weights, reward formula, timeouts and golden backend remain unchanged. Render/Constraints aggregation is aligned to the canonical `weighted_mean` setting; the strict shared browser gate remains in place.

[Read the diagnosis, changes and validation limits](RUN_REVIEW.md).

Local checks passed: 13 golden workflow groups, six actual MCP helper cases, 12 support checks, 18 layout views, 139 standard checks and the archive QC checker. These are not hosted Oracle scores. Exact image builds remain unverified; Harbor is not authenticated in this session.

Run Oracle first on this ZIP. Confirm Functional provenance is **r8**, inspect every criterion and retain the verifier's evidence files. Then run GPT-5.4-mini with solver effort **high** on the same ZIP. A future in-range GPT result and Oracle 1.0 are not guaranteed by the local checks.
