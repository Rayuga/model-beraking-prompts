# Ridgeline rubric repair: independent final QC

The final review answers all **53 workbook judgment checks: 46 Pass, 7 Note, 0 Fail**. All **48 deterministic inventory entries** have an explicit local/manual-equivalent disposition: 34 PASS, 10 NOTE, 4 N-A. No remaining source mismatch or demonstrated local runtime blocker was identified. These counts are not official platform results.

The seven judgment notes retain the actual limits: paid golden coverage, generated state and reproducibility, unmeasured provider execution, browser-only architecture observability, bounded mock-floor evidence, bounded ranking evidence, and non-identical remote judgments. Private official checker implementations, a paid Oracle run and target-model scores remain unmeasured.

## Frozen candidate

- Archive: [ridgeline-print-storefront.zip](ridgeline-print-storefront.zip)
- SHA-256: `f8a9b605699d7e87dc1a0a08fb2f48e23a16e784588c7380d3a5aa47a77b706d`
- 51 files; 698,609 bytes; one root `ridgeline-print-storefront`.
- Independent ZIP CRC, unique/safe paths, executable shell modes and every source/manifest/archive byte match passed.
- 33 criteria: one Render, one Constraints, 21 Functional, four Polish and six Visual. Functional weight remains 35. Dimension shares remain 60%/20%/20%, with zero-weight gates and the existing 0.05 functional floor.

The comparison against the prior `9a6564cf…` archive finds 14 changed files and 37 unchanged files. The entire golden application, assets, Dockerfiles, verifier launcher, shared scoring/restart tools, scoring policy and presentation criteria are unchanged. Changes are limited to the brief/notes, metadata, app context, gate/functional instructions and the installer. Exact paths and hashes are in [independent_review_evidence.json](independent_review_evidence.json).

## What the repaired gate proves

The Constraints judge now places one ordinary Kiln A3 order with a new recipient, observes the real purchase request/response, and retrieves that newly generated reference from an independent browser context without copied client state. A reload must preserve that independent retrieval. The gate proves a shared server write/read; it does not claim to identify SQLite, Express or hidden infrastructure.

The golden passed this positive control. A deliberately browser-only negative fixture passed the old health/catalogue observations and even returned a no-op HTTP 200 purchase response. Its original browser could reload a localStorage receipt. The clean context could not retrieve the receipt and received a not-found response, so the revised server prerequisite failed. With the unchanged scorer policy, that failed gate gives reward zero. This is an observed failure of one concrete mock pattern, not a paid full-score run or a proof against every deceptive server.

All scored prompts now depend on that shared prerequisite and locally reload populated server content. They do not repeat the purchase, demand another judge's generated reference or invent an order-list API. The gate leaves one order placed, and the functional allocation accounts for that mutation. No same-origin equality, hidden response schema, deep pricing rule or preferred visual style was added to the gate.

## Executed evidence and scope

| Evidence | Result | Scope |
| --- | --- | --- |
| [Source audit](qc_source_evidence.json) and [extracted audit](qc_extracted_source_evidence.json) | 80/80 each | Local executable structural assertions, including public criterion-ID collision scan |
| [Revision preflight](revision_preflight.json) and [extracted preflight](extracted_revision_preflight.json) | 24/24 each | New gate/source-ban/installer wording and bounded scoring comparison |
| [Contract checks](contract-checks.json) | 19/19 | Final21 criteria, weights, trusted13-row table, public anchors and stock allocation |
| [Monetary cases](rubric_math_results.json) | 19/19 | Independently calculated prices, discounts, shipping and totals |
| [Golden gate/address proof](GATE_ADDRESS_BROWSER_VALIDATION.md) | Seven groups passed | Actual Chromium152, independent receipt retrieval, four fresh incomplete-address refusals between separate valid orders |
| [Independent basket proof](basket-context-browser-results.json) | Four groups passed | Two clean browser contexts retain their own lines through reload, with no orders or stock changes |
| [Mock gate proof](MOCK_GATE_VALIDATION.md) | Six assertions passed | Actual Chromium152 rejects static-JSON/localStorage-order witness at the new prerequisite |
| [Installer regression](ORACLE_REINSTALL_VALIDATION.md) | Seven checks passed | Fresh and dirty installs, active-database refusal, exact sidecar reset, ordinary restart and retry persistence |
| [Final image contents](final_image_evidence.json) | Passed | Empty agent app, exact public inputs, correct dependencies, no private-task leakage and15 final verifier files matched |
| [Independent archive/report binding](independent_review_evidence.json) | Passed | Exact51 archived files match source/manifest; exact53/48 workbook inventories |

Earlier evidence is reused only for unchanged applicable source: 203 backend assertions, nine primary plus five resilience browser groups, 49 presentation/navigation assertions, four synthetic harness cases and 13 scorer fixtures. The new browser checks are focused proofs; the entire 21-criterion rubric was not rerun through a paid judge. The focused gate/address run omitted the unrelated mixed-order scenario, so it finished with four Kiln rather than the full suite's three before persistence; its report discloses this difference.

## Coverage, fairness and scoring

[REQUIREMENT_COVERAGE.md](REQUIREMENT_COVERAGE.md) starts from public requirements, including their negative cases. It maps newly explicit server-side address validation, unknown-reference handling and visitor-local baskets to actual shipped criteria. It separately records runtime/library requirements that browser behavior cannot prove. A passing extra local backend helper is not counted as a shipped scoring check.

Four incomplete-address probes each use a fresh identity and the actual observed request shape, altering one stated required component. A new valid order before and after the refusals prevents an always-failing endpoint from receiving credit. Kiln stock normally follows `7 → 6 gate → 5 mixed → 3 address → 2 persistence`; later checks use observed state if an earlier operation failed. All five judge prompts explicitly prohibit submitted-source/comment/script/bundle inspection while permitting DOM, screenshots and live browser requests.

Nine functional adversarial/replay criteria now carry 23/35 weight. Splitting some formerly bundled outcomes and funding the new address criterion changes partial credit even though the total is unchanged. Assuming both versions pass their gates, equal presentation scores and both clear the functional floor, the conservative unrounded increase bound is **0.080571**. Including the existing floor discontinuity yields an abstract **0 → 0.506286** bound (0.5063 after final rounding). These Boolean combinations need not represent a feasible submission and are not predictions of model scores. Stronger server prerequisites can instead reduce a browser-only submission to zero.

## Correction to the earlier review

The earlier report accepted an estimated 0.454 cart-only result as harmless calibration and validated gate wiring without testing whether the gate actually established the requested server behavior. That was insufficient. The old first five functional outcomes carried 7.5/35 and could yield **0.5286** with perfect presentation. A conditional UI-only order witness could reach **0.6143** if its receipt evidence was accepted. Those values are arithmetic witnesses, not observed model rewards; a static inert page did not automatically earn them.

Positive weights also did not prove meaningful product ranking. This report replaces that rationale with the paired golden/mock prerequisite evidence and keeps broader empirical ranking unmeasured. A real server with incomplete business rules may still earn legitimate partial credit. The earlier artifacts remain preserved rather than being silently rewritten.

The reviewed source and local evidence support another platform run. They do not guarantee platform acceptance, Oracle 1.0 or any target-model score. Use [QC_FINAL.xlsx](QC_FINAL.xlsx) and [qc_final_findings.json](qc_final_findings.json) for the complete per-check record bound to this exact archive.
