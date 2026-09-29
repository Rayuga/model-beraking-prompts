# Golden independence repair proof

The revised restart criterion and all three independent deletion criteria pass locally. The proof comprises seven browser groups: ordinary restart preparation/verification, the same two phases with Duplicate/Delete unavailable, and three separate deletion flows. It is a composite proof, not one uninterrupted passing run or a paid Oracle evaluation.

The exact fixtures come from the frozen 37-row Functional file, SHA-256 `6b58c55bd8be65fcf6a127c2cac31056e54929a0d696308f8d5120e0d3f0284c`. Functional weight remains 49.5. The new package contains 49 total criteria. Its golden's 23 files match the tested prior `63a05a5e...` golden exactly; the binding checks the replacement archive `5d0f1d74ae48e36183c5110aee5b414fb5912aa30361401950e8a248e1e4e78b`.

## Restart independence

Two records were created through New/Save. Primary advanced to revision 2 before restart with `restart-before-restart`; Second and an independently created background record remained unchanged. The actual current verifier MCP `restart_app` relaunched the server once. A fresh browser read the complete library and exact fields/revisions, then ordinary Save advanced Primary to revision 3 with `restart-after-save`. Second and the background entry stayed exact.

The same sequence passed in a separate disposable database with Duplicate and Delete removed from the browser DOM before restart and disabled afterward. A MutationObserver maintained the temporary capability overlay across renders. Actual captured click events showed zero Run, Duplicate or Delete actions in either restart phase; HTTP observations contained no DELETE. Automatic opening behavior was not a pass condition. This is a bounded witness that those capabilities are not incidental restart prerequisites, not a replacement application implementation.

## Independent deletion flows

- `delete_confirm`: cancelling generated no write and left the full list unchanged after reload. Confirming removed only its own Target; its Sibling and all other records stayed exact. No stale-delete or removed-identity condition affected this verdict.
- `cw_stale_delete_preserves_newer_record`: a successful current-revision Control deletion established the observed request format. A stale Target deletion returned 409, with the newer Target and every other saved record unchanged. Loading the current Target and replaying the valid current operation succeeded; reload preserved the exact remaining list.
- `cw_deleted_identity_rejects_update`: a successful update established the operation before deletion. Replaying it against the removed identity with its last valid revision, unused attempted title and valid fields returned 404. Neither identity nor attempted record reappeared. Its Sibling then saved and reloaded with an advanced revision, proving valid updates still worked.

Each deletion flow created its own named records and controls. Server-only rows accepted any confirmation offered during setup without asserting its presence. Their verdicts did not depend on the normal-confirmation row's result.

## Evidence discipline

The first ordinary run passed both restart phases, then a later deletion probe used Playwright's `response.status()` syntax on a browser fetch `Response`, whose status is a property. That failed report remains unchanged with `passed: false`. The accessor was corrected to `.status`, and only the three deletion groups were rerun. All passed; application files were untouched. `GOLDEN_PROOF_SUMMARY.json` checks the exact successful phases and records the composite explicitly.

Browser actions used direct Playwright from the installed MCP dependency, Chromium 152.0.7977.8, in pinned image `sha256:43757904510bf933d70d209e77077ad0173deb345f61a1477eb106f4e2380f6f`. Process restart used the actual canonical verifier MCP source/helper, bound to current task hashes. All containers had network disabled and disposable databases. The user preview and other containers were not modified.

`DEPENDENCY_REVIEW.md` documents all 35 original rows, the accepted repair and Auto-run clarification, and optional granularity ideas explicitly left out of scope. `SCOPED_CRITERION_EVIDENCE.json` covers these four changed criteria; the parent review owns the complete 49-row map and the separate privacy proof.
