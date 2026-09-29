# Ridgeline final local QC

The frozen candidate has no unresolved source or local-runtime blocker identified by this review. All 53 judgment checks are answered: **48 Pass, 5 Note, 0 Fail**. All 48 deterministic checker names have explicit manual-equivalent results; the official platform checker executables are not available locally.

This is local authoring QC, not a platform verdict. No paid Oracle or target-model run was performed. In particular, the `1.0` records produced by the deliberately substituted local RewardKit harness are synthetic plumbing evidence, not Oracle scores.

## Frozen candidate

- Archive: `ridgeline-print-storefront.zip`
- Files: 51; size: 694,989 bytes; one root folder `ridgeline-print-storefront`.
- SHA-256: `d39e1668a4233689bd51e99d1d043f6c9b191ab854edfc730cacbdcabe343860`
- ZIP CRC, every entry hash against current source, extraction hashes and executable shell modes were independently checked.
- The task contains 28 criteria: render 1, constraints 1, functional 16, polish 4 and visual 6. Functional internal weight is 35. Eight adversarial/replay criteria carry weight 21 (60%); dimension shares remain 60/20/20.

## Executed evidence

| Layer | Observed result | Evidence |
| --- | --- | --- |
| Source contract | 51 assertions passed; final TOML/JSON, shell and JS refresh passed; shared tools byte-equal to template | `qc_final_source_evidence.json` |
| Fixture arithmetic | 19 scenarios passed | `rubric_math_results.json` |
| Golden commercial behavior | 203/203 API/SQLite assertions passed, including real concurrent attempts and actual process/container restart | `backend_smoke_results.json`, `TEST_COVERAGE.md` |
| Browser workflows | 9 primary + 5 resilience groups passed, including keyboard-only checkout, mobile, themes, cancellation, and retry after the last unit was committed but its response was lost | `ui-evidence/browser-results.json`, `ui-evidence/browser-resilience-results.json`, `FRONTEND_VALIDATION.md` |
| Actual pinned browser MCP | Chromium 152 loads eight cards, fits mobile, performs in-page requests and request interception | `browser_mcp_runtime.log` |
| Actual verifier/restart wiring | 4 cases passed: relative working directory, golden persistence/retry, gate failure, missing app | `harness_results.json`, `harness_*.log` |
| Scorer boundaries | 13 fixtures passed: exact floor, just above floor, gate failures, partial shaping, invalid values and missing dimensions | `scorer_results.json` |
| Images | Agent and verifier builds succeeded; agent contains only .git/.gitkeep in /app, all fixtures and correct dependencies, no golden/tests | `agent-image-build.log`, `verifier-image-build.log`, `agent_image_evidence.json` |
| Package | CRC, source/entry hashes and shell executable modes pass | `candidate_manifest.json` |

Source tests and API tests are not interchangeable with browser-judge verdicts. `TEST_COVERAGE.md` distinguishes what each evidence source proves. Desktop/mobile/light/dark and receipt screenshots were reviewed for visible layout and readability; those observations do not predict an exact paid visual score.

## Runtime corrections verified locally

Both initial app launch and restart now change to the application directory. The actual witness reports `/app`, UID 65534 and no injected secret before and after restart. This fixes the old hidden `/tests` working-directory assumption while preserving the outer verifier reward trap. The shared scorer and restart MCP implementation remain unchanged.

The installed RewardKit 0.1.7 advertises integer **1-5** for `Likert(points=5)` and normalizes `(raw - 1) / 4`. Its source is preserved in `rewardkit_runtime_source.json`. All six visual criteria now use those five anchors; raw 1 is the missing/unusable fallback and contributes zero, raw 5 contributes full credit. This is a justified correction to the stale template's contradictory 0-5 wording, not a change to dimension weights.

The pinned Playwright MCP exposes `browser_evaluate`, network-request tools and `browser_run_code_unsafe`. The actual shipped tool inventory and interception were exercised. Task prompts describe the required operation without prescribing a missing historical tool name.

The visual review can use known historical receipt RP-100001 and basket/checkout previews. It does not demand an order-list screen or references from another isolated browser session, and does not place/cancel orders to obtain visual credit.

## Notes and remaining measurement

- The paid `claude-code` / `z-ai/glm-5.3-flashx` judge integration, actual Oracle score and target `gpt-5.6-luna` score are unmeasured. An Oracle 1.0 or desired model score cannot be guaranteed from these local checks.
- Fresh order references and ungraded timestamps vary normally; the commercial seed and all graded price/stock rules are fixed.
- A dead/static seed page cannot clear the functional floor through discovery alone (1/35 = 0.02857). A genuinely working cart/preview implementation without order writes could reach about 0.454 with strong presentation; this is a partial-product calibration witness, not a static-shell exemption.
- The optional breaker audit was rerun on the frozen candidate. Its only remaining reported issue is a confirmed heuristic false positive: it demands `rm -f "$APP_DB"`, which would erase the durable database and contradict the canonical staged contract. No such reset was added. Its keyword-based enforcement estimate of 64.3% differs from the explicitly enumerated eight-criterion share of 60%; the ledger supplies the actual calculation.
- `QC_BASELINE.*` describes the downloaded, superseded version and its earlier problems. Use `QC_FINAL.xlsx` and `qc_final_findings.json` for this candidate.
