# Colderwater verifier fairness repairs

**The targeted repairs are verified. Release remains uncleared.** Frozen input: `4bc53a3f24e6fa46739f9f07d31b7fb8d8c763e796effa0a5200bbdf430b5867`.

Only the Functional prompt and four criterion descriptions changed. All 64 Functional criteria, total weight 32.70, 23 protocols, public requirements, golden application bytes, other dimensions, shared harness and budgets are unchanged. This repairs false deductions on partial apps without removing requested features or altering reward policy.

## Before and after

| Check | Earlier | Now |
|---|---|---|
| Successful Run duration | A later preview click started the comparison timer, so preserving the original completed Run duration could fail. | The explicit Run schedules its own four-second timer. A completed Run need not update its duration after a later click. |
| Collision and empty-title refusal | Both depended on padded creation/update succeeding first. | Ordinary unpadded successful writes can establish their own controls. Trimming still fails independently. |
| Completed Stop | Its only positive handler observations came after long waits. | A currently working handler or one bounded fresh immediate-handler fallback establishes Stop's own control; delayed interaction can still fail. |
| S03 language setup | All completed-interaction evidence required HTML dispatch. | If HTML cannot establish a completed preview, an equivalent direct-JavaScript fixture is tried once. Real completion, live handlers and the same idle waits remain required; S02 keeps the HTML-dispatch failure. |

The fourth refinement was caught by targeted independent review of the first repair candidate. That original failure and both frozen candidates are preserved. The title fallback estimate was also corrected from a hard six-action allowance to roughly eight additional actions plus ordinary app dialogs. Planning estimates now total 454 ordinary UI actions, with bounded optional setups and one extra four-second Run. These estimates do not establish LLM-judge completion time.

## Fresh measured evidence

- Scripted golden: **64/64 Functional facts**, **2/2 gates**, **7/7 Polish facts**, **11/11 additional runtime regressions**; no missing required facts.
- One actual process restart: PID 16 to 345.
- Ten focused browser cases matched their expected fact vectors, including deliberately failing outcomes. A `passed` focused case means the expected distinction was observed, not that the partial app received a perfect grade.
- Golden script wall time: 126.54s. Focused matrix: 123.01s. Neither is configured judge timing.
- Three independent targeted reviews cover duration fairness, independence/controls, and raw evidence/driver binding. They are not a new 53-row audit.
- All 50 structural assertions and 53 existing source-regression guards pass. Both shell scripts and the server entry parse; these local checks are not the private portal checker suite.

| Focused case | Observed results |
|---|---|
| golden | console_duration: pass; title_trimming: pass; title_collision_refusal: pass; title_empty_rejected: pass; title_case_sensitive: pass; later_interactions: pass; completed_stop: pass |
| run-duration-only | console_duration: pass |
| padded-create-refused | title_trimming: fail; title_collision_refusal: pass; title_empty_rejected: pass; title_case_sensitive: pass |
| padded-update-refused | title_trimming: fail; title_collision_refusal: pass; title_empty_rejected: pass; title_case_sensitive: pass |
| padded-both-refused | title_trimming: fail; title_collision_refusal: pass; title_empty_rejected: pass; title_case_sensitive: pass |
| long-idle-handlers | later_interactions: fail; completed_stop: pass |
| broken-html-dispatch | later_interactions: pass; completed_stop: pass |
| never-working-handlers | later_interactions: fail; completed_stop: fail |
| dead-writer | title_trimming: fail; title_collision_refusal: fail; title_empty_rejected: fail; title_case_sensitive: fail |
| constant-zero-duration | console_duration: fail |

The Run-duration-only case actually preserves the short original duration after a working four-second click timer, then passes the repaired Run-duration probe. Padded create-only, update-only and both-failed cases retain collision/empty-title credit while trimming fails. Expired handlers retain Stop credit only after the fresh live control. Broken HTML dispatch recovers S03 through an actually working JS fixture. A dead writer, never-working handlers and constant zero duration receive no corresponding credit.

Raw evidence: [full golden](golden/run-golden-20260930-113007/RESULTS.json), [focused cases](golden/focused-20260930-113157/RESULTS.json), [machine-readable summary](REPAIR_RESULTS.json). Executed driver copies and variant source/bundle hashes accompany those results. Both runtime launches used the cached verifier image `sha256:46fefc505dbcabf0d6cb4e54fea8f0880acde2f7896587750af967427598977d`, offline networking, disposable databases and UID/GID 65534; no provider calls or published ports. Variant builds used the existing pinned local Vite toolchain, with no package install.

Accepted-but-untrimmed titles are handled by actual identity/revision in the protocol and driver and received source review, but no dedicated runtime variant for that branch was executed. This finite matrix is not exhaustive proof over every implementation.

## Remaining boundaries

The inherited restart-helper counterexample, shared backend/artifact coverage-policy conflict, uncommitted golden baseline and missing full configured judge/workload/reward measurements remain unresolved. Shared files were preserved as required by workspace policy. The successful golden restart does not refute the different inherited counterexample. No Oracle 1, target-model score, visual judge grade or portal pass is claimed. No task upload, paid judge, ZIP, commit or push was performed.

Prior [53-point reconciliation](../coldwater-2026-09-30-postrepair-audit/per-row-review/RECONCILIATION.md) is historical evidence for different bytes; its verdict counts must not be relabeled as a complete current-candidate review.
