# Colderwater app network-policy correction — 26 September 2026

Current archive: [colderwater-playground-devtools.zip](colderwater-playground-devtools.zip), 50 files, 839,033 bytes.

SHA-256: `998f0ba6831f801686251412a2a7cffb6e38fd5807dae68e08042a7f78bc8686`.

This replaces `76ab7fb1…`. The newer Ridgeline feedback exposed a restriction also present in Colderwater: our authored notes and first Functional criterion required the app's assets to be offline, although the current staged template explicitly permits external fonts, scripts and CDN assets. Repeating that restriction in our own instructions did not make it a valid exception to the standard.

## Narrow change

Seven files changed: the brief; integration, policy and security notes; descriptive task metadata; app context; and the first Functional criterion's app-asset paragraph. They now permit external browser assets and retain the local-server/database requirement. The other 31 Functional criterion objects, all IDs/weights/order, all five prompts, both gates, Polish, Visual, Dockerfiles, harness and the entire golden solution are unchanged.

**User-authored snippets still cannot fetch external resources.** That is the playground's requested execution boundary, independent of where the app obtains its own editor components or fonts. The separate snippet network check and its positive/negative browser evidence remain intact.

Functional remains **32 criteria / weight 49.5**, with the unchanged canonical 60/20/20 policy and floor. No functional difficulty was removed beyond the invalid app-asset restriction.

## Evidence and limits

Source and extracted archive each pass 82 audit assertions and 22 narrow-delta assertions; 23 contract checks pass. The previous archive fails the new public-network policy guard and the corrected candidate passes. Fresh agent/verifier images at `20260926-followup` match public inputs and all 15 verifier files, with no private solution leaked into the agent image. The archive's CRC, safe root, shell modes and all file hashes match its manifest.

`network_policy_changes.diff` gives the complete before/after text. `network_policy_preflight.json` proves the bounded seven-file change. `QC_FINAL.md` records the rebound review. Prior 65 golden test groups and backend/harness evidence are explicitly reused for unchanged code; this correction does not claim another full browser suite or a paid Oracle run.

The first criterion has weight 0.5. Removing its asset restriction can restore **at most 0.0061 published reward** when both versions already exceed the functional floor and other outcomes are fixed. A floor crossing can have a larger effect; the conservative abstract witness reaches 0.4333 from zero with full presentation. These are policy arithmetic, not predictions. The gates are unchanged, so Ridgeline's CDN gate-zero effect does not apply here.

Paid Oracle/model measurement and official platform acceptance remain outstanding. Old affected network-policy PASS rationales are superseded; original artifacts are retained. No paid calls, upload, submission, commit or push occurred.
