# Hardening round 1 reconciliation

All 53 quality rows were reviewed in separate fresh contexts, plus one separate all-48 deterministic review. `review-contexts.json` records the actual assignments. The pipeline accepted all 54 reports with none missing. Original reports remain unchanged.

Pipeline result: **STALE_OR_INVALID**. The HireOps source and frozen rules still match, but the unrelated `scripts/check_colderwater_current.py` engine input changed during the round. `engine-drift.json` records the exact hashes. Even without that drift, task defects, shared concerns and missing measured runtime evidence prevent clearance. No favorable row overrides a credible counterexample from another row. No same-hash waivers are being applied.

## Task-specific findings accepted for repair

| Finding | Independent evidence | Repair decision |
| --- | --- | --- |
| Corrupt public punctuation and missing spaces | Quality 03 | Repair actual UTF-8 text and spacing without changing formulas. |
| Optional operational history is required by `hro_commitment` | Quality 04, 27, 40, 48, 49; deterministic reviewer lead | Replace the named seed witness with fresh ledger/headroom evidence. |
| Public note reveals the verifier working directory | Quality 05; deterministic hygiene | Remove `/tests`; preserve the explicit different-working-directory runtime requirement. |
| Shared-storage gates require an unasked department field | Quality 27 | Use actual record identity, budget and descriptive fields supported by the UI. Preserve independent-context retrieval. |
| Rescission recovery demands editable date controls | Quality 27 | Accept retained-date retry through either controls or a read-only confirmation. |
| Three coordinated criteria bundle independent promises | Quality 28 | Split preview persistence/neutrality, batch/member history artifacts, and subsequent budget/vesting observations. Preserve combined weight and shared scenarios. |
| Coordinated final-budget overrun lacks a rubric owner | Quality 26 G1 | Add a controlled one-cent-overrun refusal observation, allowing refusal at prepare or commit as the public contract permits. |
| Recruiter requisition intake lacks scored ownership | Quality 26 G2 | Add a small independent permission observation; keep the storage gate inclusive. |
| Blank/missing operation keys lack coverage | Quality 26 G3 | Extend the coordinated malformed-intent observation using a nonblank successful control. |
| Supplied referrer roster is only exercised for Dara | Quality 26 G4 | Observe availability of all supplied referrers separately from accrual arithmetic. |
| Optional imported DRAFT eligibility lacks coverage | Quality 26 G5 | Add a conditional refusal/headroom observation without requiring import; allow only the bounded intended-refusal probe on a DRAFT row. |
| Coordinated numeric validation omits declared classes | Quality 26 G7 | Extend its existing owner to nonnumeric/sub-cent/unsafe values using actual request representations and valid controls. |
| Coordinated relocation exclusion lacks ownership | Quality 26 G8 | Add its own observation around a successful nonzero-relocation change. |

Small coverage additions will receive weight taken from related existing outcomes. Functional remains 45 points, with 28 on coordinated changes and 17 on retained core behavior. Polish remains 9 and Visual 6; canonical dimension weights, models and timeouts remain unchanged. Count reduction is not achieved by merging independently useful outcomes or concealing required behavior.

The coordinator also observed that more than 5,000 later audit events hide an earlier approval log row from the normal audit feed. The separate `post-round/audit-history-confirmation.json` confirms the cap but does **not** establish a public-contract failure: uncapped readable receipt cards retain the action, actor, date and before/after history in the normal Audit Trail. This corrects the coordinator's earlier stronger claim. Removing the cap is an authorized small robustness improvement, not repair of demonstrated total history loss. The raw offer-specific probe and original review reports remain preserved.

## Shared-template and policy concerns retained

- Unbounded final cleanup and false-success process restart: quality 11, 21 and 32 plus deterministic contract review. Matching raw fixtures exercise unchanged canonical bytes.
- Browser-only grading cannot establish all shared architecture/delivery mandates: quality 26 G9. Do not infer SQLite from HTTP or add forbidden source inspection.
- A symlinked `/assets` verifier input can cause canonical permission broadening to expose tests to the unprivileged app: quality 46. Ordinary-assets isolation passes. Hosted artifact-transfer reachability remains unmeasured; no hosted exploit or real-key exposure is claimed.
- The deterministic generic baked-pytest requirement has unresolved applicability to the canonical RewardKit image. Preserve the Note/risk instead of adding packages to silence it.

These concerns are outside the task-specific repair authority. The user's acceptance of common blockers permits continued candidate work; it does not turn their reports into passes.

## Measurements still absent

No full configured GLM grade or duration, target Luna score, Oracle score, measured weak-app reward discrimination/ranking, or hosted checker result exists for this candidate. Quality 22, 30, 39, 40 and 42 retain their stated evidence limits; pipeline runtime records for workload, launch/grading, discrimination and ordering remain missing. No synthetic run is being relabeled as one of those measurements. Provider spending and uploads remain unauthorized.

Local positive evidence includes scripted golden/domain/browser tests, actual MCP feasibility, normal process replacement, installed configuration/schema parsing, exact archive execution, and nine synthetic orchestration cases with 45 assertions. These observations retain their individual source bindings and limits. The provisional 37-file ZIP still matches this frozen task exactly, but it is historical and is not a cleared deliverable.

Next: apply the accepted task repairs, run appropriate local validation, freeze a new candidate using `prepare --mode single-per-row`, and complete a new independent row round. Preserve this round and ZIP as history. No portal pass or model score is promised.
