# Ridgeline continuation

Superseded: the user clarified the prompt-edit scope and the mobile fix is applied. Use [the current release](../release-2026-09-28/RELEASE.md). The text below records the earlier pending state.

**Review candidate only. Template-scope clarification is pending.**

Applied:

- Restored `task.toml` metadata tags to the exact template list.
- Updated packaging assertions from the stale 40 Functional / five Polish counts to the actual 42 / seven. No criterion or weight changed.
- Re-ran the source audit: 94 assertions passed, zero failed.
- Built `review-only-candidate/ridgeline-print-storefront.zip`; CRC, safe paths, executable shell modes, extracted SHA256s and public hygiene checks passed. This matches current source but is not approved as upload-ready.

Prepared, not applied:

- `mobile-coverage-proposal.patch` changes only the existing responsive-layout description. It explicitly visits all key mobile screens, including usable delivery fields and the order-submission control, without placing or cancelling an order. It retains seven Polish outcomes, the same weights and all judge/scoring settings.
- The proposed browser tour passed against an unchanged golden in a disposable container. Screenshots and results are in `mobile-probe/`. This is scripted browser evidence, not an Oracle run.

The unresolved decision is concrete: the lead forbids changes outside `CHANGE_ME`, while earlier QC fixes changed ten unmarked integration/judge/prompt files. Strict restoration would undo some of those fixes. A question has been sent asking whether task-specific judge prompts/criteria are permitted while preserving the canonical harness, Dockerfiles, budgets and scoring. No exception has been assumed.

The earlier full-QC report remains a snapshot of its recorded source hashes. This continuation fixes its extra-tag finding but does not claim to close the ten-file compliance issue or mobile coverage issue yet. The old top-level `ridgeline-print-storefront-final.zip` remains stale; do not use it.

Golden source, preview, shared template and Colderwater are unchanged. No full hosted QC, provider-based Oracle or target-model run was executed.
