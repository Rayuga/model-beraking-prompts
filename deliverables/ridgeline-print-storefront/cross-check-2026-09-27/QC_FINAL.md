# Ridgeline complete cross-check - 27 September 2026

The separate Ridgeline review is complete. Three issues were corrected: false restart success, duplicated theme-readability deductions, and a missing sold-out-cheapest grid-price case. No unresolved concrete local blocker was found. Private platform acceptance and paid Oracle/model scores remain unmeasured.

## Current artifact

[Replacement ZIP](ridgeline-print-storefront.zip), SHA-256 `9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c`. It contains 51 files / 701173 bytes with verified CRC, safe single root, shell modes/LF and matching source/extracted hashes. It supersedes the unchanged historical 7502bd9c archive.

Exactly six task files changed: task.toml, tests/test.sh, Functional judge/prompt and Polish judge/prompt. All 19 golden/installer files and all public inputs are unchanged. Functional is now 25 criteria / weight 35, with 37 criteria overall. Canonical 60/20/20 shares, floor, runtime contract, shared Python and Dockerfiles remain unchanged.

## Findings and repairs

- **Restart:** the old process ignored shutdown and kept answering while the replacement crashed. The task helper now establishes old-group termination and replacement liveness; five real MCP controls and a fresh storefront process restart pass. [Harness review](HARNESS_REVIEW.md).
- **Presentation ownership:** Polish tests working theme changes and navigation. Visual owns contrast/readability. This removes a duplicate deduction without changing checkout or stock rules.
- **Price coverage:** the initial seed could not expose a grid that priced only available editions. A separate 0.1-weight criterion now checks Slack Water at A3=0/A2>0 and requires the requested GBP 37.95 grid price. It has an independent setup if concurrency did not exhaust A3, leaves A2 for its own checkout, and is funded by reducing catalogue details from 0.4 to 0.3. Both setup paths passed on the unchanged golden. [Semantic review](SEMANTIC_REVIEW.md).

## Validation

| Check | Result |
| --- | --- |
| Full 53-quality review | {'Pass': 44, 'Note': 9} |
| All 48 mechanical procedures, local/manual equivalents | {'NOTE': 10, 'PASS': 34, 'N-A': 4} |
| Final source / extracted source | 89/89 each |
| Restart lifecycle / orchestration | 5/5 and 4/4 |
| Actual storefront browser process restart | Passed: observed replacement, receipts, retries, cancellations and all 13 stock quantities |
| Fresh commerce / remaining UI legs | 13/13 and 4/4 |
| Shared-order gate and incomplete addresses | 7/7 |
| New independent price setup | Passed; normal branch also passes in commerce flow |
| Presentation browser assertions | 45/45; desktop/mobile, both themes; no page errors |
| Independent monetary derivations | 18/18 plus stock-allocation ledger |
| Canonical scorer | 20/20 synthetic inputs, not paid judging |
| Final images | Exact 12 public / 15 verifier file hashes match |

The semantic reviewer read public requirements before the rubric and both QC-workbook layers. Root and harness reviewers supplied the executable evidence that semantic-only dispositions left unexercised. [Findings JSON](qc_final_findings.json) answers every check; [candidate binding](final_candidate_binding.json) identifies the final source and reused scopes. [Golden recheck](GOLDEN_RECHECK.md) maps all 37 criterion observations. The separate [independent harness binding](independent_harness_binding.json) reopens the ZIP and verifies actual final image contents. The complete [client-safe workbook](QC_FINAL.xlsx) contains every disposition.

Earlier detailed backend, installer and catalogue evidence is reused only for unchanged app/criterion scope. The golden is byte-identical; prior rubric hashes are historical. New restart, presentation-ownership and conditional price observations have fresh proofs. A failed diagnostic fixture attempt or historical report is not current acceptance evidence.

## Remaining limits and score impact

The quality Notes preserve full paid-judge timing, Oracle/aesthetic assignment, legitimate generated identity/time variation, provider execution, browser-only architecture/exact-photo matching, bounded mock coverage, empirical ranking and remote reproducibility. Source verifies supplied/golden photograph bytes, while a browser judge's exact photo identity judgment lacks embedded trusted thumbnails. No broad security/architecture claim is inferred from normal browser behavior. The private platform checker executables were unavailable, so their documented procedures were applied with local checks/manual review instead.

The generic source helper emits an obsolete required-database-deletion failure; the raw output and [adjudication](GENERIC_AUDIT_INTERPRETATION.md) are preserved. Do not erase persistent state to satisfy that regex.

With fixed passing gates and both versions above the floor, the 0.1 grid-weight split changes reward by at most 0.0017143. Removing the unfair Polish deduction can separately restore up to 0.05. Floor crossings are a separate discontinuity; neither figure predicts target-model reward. Correct process replacement can remove previously unearned persistence credit. Actual Oracle 1.0 and target 0.1-0.7 remain measurement targets, not results.

No paid call, upload, commit or push was made. The current Ridgeline handoff and shared authoring lessons now distinguish this review from Colderwater's separate candidate.
