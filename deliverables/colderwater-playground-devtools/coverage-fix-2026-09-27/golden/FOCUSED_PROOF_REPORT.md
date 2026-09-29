# Focused coverage proof

Candidate ZIP: `f86708344b0861aad8a48049996c7b72266c29d6d68bf377358a0c5810aad6ae`. All50task files in the execution snapshot match the final archive; all23golden files match the prior663e release. No golden code repair was needed.

The fresh golden run passed all requested C1/C2/C3 observations in21.91seconds. The CSS global was directly observed before CSS and absent in its matched fresh current frame. A4-second timer actually fired once; the next pending timer was replaced by CSS after50.2ms and remained absent for5.23seconds. Both real two-editor stale operations retained exact dirty fields and recovered. All lowercase/uppercase JS,HTML,CSS files passed actual import/edit/Save/reload.

The3controlled mutants were detected: CSS live-context leakage; dirty-field loss despite correct server refusal; and JS-only importing despite working uppercase Save. This demonstrates separate observed facts rather than inherited verdicts.

Nine current outcome mappings are in[FOCUSED_CRITERION_MAP.json](FOCUSED_CRITERION_MAP.json); raw facts and timing are in[FOCUSED_PROOF_SUMMARY.json](FOCUSED_PROOF_SUMMARY.json). File hashes and source binding are in[golden_evidence_binding.json](golden_evidence_binding.json).

This was direct pinned Playwright with network disabled, not an actualMCP tool-dispatch run, provider call, full93-row judge or Oracle score. Native-frame inspection was exercised; virtual-realm tooling and proactive dirty-action prevention remain unexercised alternatives. Automation timing does not measure fullLLM judge overhead. All4owned disposable containers exited; preview3420 remains running.
