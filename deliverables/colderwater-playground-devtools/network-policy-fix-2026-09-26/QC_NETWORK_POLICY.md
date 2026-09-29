# Colderwater browser-asset policy correction

The replacement archive is [colderwater-playground-devtools.zip](colderwater-playground-devtools.zip), **50 files, 839,033 bytes**, SHA-256:

`998f0ba6831f801686251412a2a7cffb6e38fd5807dae68e08042a7f78bc8686`

This is a focused authoring and regression report. The prior 53/48 report remains a record of its reviewed candidate, but its acceptance of the app-wide offline restriction is superseded. This report does not claim a new platform pass or paid Oracle/model run.

The current staged template permits external browser fonts, scripts and CDN assets. The earlier `76ab7fb1…` candidate wrongly prohibited those assets in its public notes and first Functional criterion. Our earlier reasoning treated our own task wording as permission to depart from the template; no user-authorized exception for these tasks was identified. [The standards review](../../ridgeline-print-storefront/rubric-followup-2026-09-26/NETWORK_STANDARD_REVIEW.md) gives the authority and preserved line quotations.

Exactly seven files changed: the brief, integration/policy/security notes, task description/provenance, app context and F01 description. The app may now use external browser assets while its backend and saved library remain in the supplied local server. F01 still requires working examples, useful automatic startup and actual newly authored execution; it no longer deducts for permitted app asset requests. All criterion IDs, weights, ordering, gate behavior and the other 31 Functional criteria are unchanged. The existing authored-snippet network restriction is unchanged: untrusted preview code still cannot fetch external resources or use services. That is a separate requested sandbox behavior.

The [exact diff](network_policy_changes.diff) and [delta audit](network_policy_preflight.json) prove the scope. The full golden app and installer, Dockerfiles, seed, judge prompts, four Polish and six Visual criteria, scoring policy and shared tools are byte-identical to `76ab7fb1…`.

| Executed check | Result |
| --- | --- |
| [Source audit](qc_source_evidence.json) | 82 assertions pass. |
| [Extracted archive audit](qc_extracted_source_evidence.json) | Same 82 assertions pass; file hashes equal the final manifest. |
| [Narrow source delta](network_policy_preflight.json) / [extracted delta](network_policy_extracted_preflight.json) | 22 assertions pass on each; exactly seven authorized files changed. |
| [Contract regression](contract-checks.json) | 23 checks pass; 32 Functional criteria still total 49.5, 44 criteria overall. |
| [Old network-policy failure](old_network_policy_failure.json) | Preserved `76ab7fb1…` extraction is rejected by the new guard. |
| [Corrected source](network_policy_source.json) / [extraction](network_policy_extracted.json) | Public network and explicit CDN allowance pass; the snippet boundary is retained. |
| [Archive manifest](candidate_manifest.json) | CRC, one root, safe entries, executable shell modes and all source/extracted hashes match. Three packaging guards pass. |

Only F01's existing 0.5 weight can gain credit solely from this correction. With all other outcomes, passed gates and presentation held fixed, the maximum additional published reward is **0.0061** if both versions clear the Functional floor. The unchanged floor is discontinuous: an abstract raw-weight change from 2.25 to 2.75 can instead restore a reward of **0.4333**, assuming full presentation credit. These are arithmetic bounds, not measured or predicted model behavior.

The prior 65 local golden groups, negative fixtures, backend and restart evidence remain applicable to unchanged application behavior, but were not newly rerun. Both final images were rebuilt and checked: [final_image_evidence.json](final_image_evidence.json) confirms all seven public input files and all 15 verifier files match frozen source, the agent app is empty apart from Git scaffolding, and no private solution is embedded. The prior archive and reports are preserved. Use this replacement archive for subsequent measurement.
