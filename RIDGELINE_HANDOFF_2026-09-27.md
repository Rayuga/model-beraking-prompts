# Current Ridgeline handoff — 28 September 2026

Current source is `projects/ridgeline-print-storefront/`. The new candidate is [final ZIP](deliverables/ridgeline-print-storefront/ridgeline-print-storefront-final.zip), SHA-256 `44fe09457efb5ba3976ffa352cd59681fa52fa235f9f881e02af9a850a186a22`. Read [current QC report](deliverables/ridgeline-print-storefront/final-audit-2026-09-28/QC_FINAL.md), [workbook](deliverables/ridgeline-print-storefront/final-audit-2026-09-28/QC_FINAL.xlsx) and [hash binding](deliverables/ridgeline-print-storefront/final-audit-2026-09-28/final_binding.json).

The current rubric has 40 Functional outcomes / weight 35, five Polish / weight 4, six Visual and two gates. Original Functional feature budgets are unchanged; shared procedures run once. Metadata is simplified. Keyboard coverage extends to checkout/lookup and actual cancellation. The shell validates full RewardKit reports and distinguishes evaluator-incomplete results from product failures.

Fresh checks: 93/93 source and extracted assertions; nine installed-MCP browser groups; 43 guard cases; four orchestration cases including real restart; three real RewardKit offline serialization cases; and golden/duplicate-rejection-mutant independence proofs. All 19 solution/installer files are unchanged. The client-safe workbook answers all 53 quality and 48 deterministic rows. Full provider timing, hosted QC, Oracle 1.0 and target model scores remain unmeasured. No upload, provider call, commit or push occurred.

The Colderwater candidate already given to the user is separate and was not edited during this Ridgeline work. Historical references below to its unbounded cleanup are stale and must not be applied to its later final archive.

## Historical handoff — superseded 27 September candidate

This is the current Ridgeline candidate after the user's request for another complete cross-check. Read later user instructions before acting. Colderwater retains its separate [handoff](COLDERWATER_HANDOFF_2026-09-27.md) and archive; this review does not establish its results.

## Current candidate

- Source: `projects/ridgeline-print-storefront/`.
- [Replacement ZIP](deliverables/ridgeline-print-storefront/second-cross-check-2026-09-27/ridgeline-print-storefront.zip).
- SHA-256: `e9571f7ec27341ace6c955a81de5cc8fd2199df804ee54b7c90a009b18333f9b`.
- 51 files, 702091 bytes; verified CRC, safe single root, executable LF shell files and all source/extracted hashes.
- 25 Functional binary criteria / total weight 35; two gate, four Polish and six Visual criteria give 37 overall.
- Supersedes immutable `9944734b...` in `cross-check-2026-09-27/`. Earlier artifacts remain historical.

## Corrections

The fresh requirements-first review found five rubric gaps. The existing Polish label/focus criterion now reaches every named enabled control, and navigation follows an actual keyboard-only detail → catalogue → basket → catalogue route. Pointer setup/cleanup of an unplaced basket is allowed; no purchase or repeated Functional grading is added. The existing paper-filter criterion now includes completely sold-out Allotment in Colorplan Pristine White membership. Unsupported equal-price tie stability and forced same-origin API targets are removed. Replay uses the actual observed local server URL/credential policy, without inventing routes or allowing external backends. Restart setup explicitly records all 13 current variant stocks before the existing full comparison.

The harness reviewer reproduced an unbounded final EXIT wait on a SIGTERM-resistant app. Bounded TERM/KILL cleanup now preserves valid reward and original exit status and handles resistant children/already-exited apps. Final `tests/test.sh` SHA is `7644e994deefad7ce60ca93d20e4c7c5313df31ef70238689a044ef893c4ebbb`. The generated restart helper remains byte-identical to the prior actual-restart repair; canonical Python tools/scoring are untouched.

Only five task files changed: Functional judge/prompt, Polish judge/prompt and tests/test.sh. All 19 golden/installer files, public requirements/assets, config, Dockerfiles, gates and Visual rubric are unchanged. All criterion IDs, types, order and weights are preserved. Final Functional judge SHA is `35f8c85ee48078d35ed3b0769eb6a56954457232709a017dee5fe0abc215421f`.

## Evidence

Read [QC_FINAL.md](deliverables/ridgeline-print-storefront/second-cross-check-2026-09-27/QC_FINAL.md), [client-safe workbook](deliverables/ridgeline-print-storefront/second-cross-check-2026-09-27/QC_FINAL.xlsx), [full findings](deliverables/ridgeline-print-storefront/second-cross-check-2026-09-27/qc_final_findings.json), and [final binding](deliverables/ridgeline-print-storefront/second-cross-check-2026-09-27/final_candidate_binding.json).

- Fresh full quality review: 45 Pass, 8 Note, 0 Fail across 53 checks.
- All 48 documented mechanical procedures: 34 PASS, 10 NOTE, 4 N-A as local/manual equivalents; private platform implementations were unavailable.
- Final source and extracted source: 89/89 assertions each.
- Golden: eight fresh installed-MCP browser groups, 76 real keys, 21 screenshots and no page errors. Exact strengthened paper and keyboard flows pass.
- Harness: seven cleanup/exit cases and four fresh orchestration cases pass, including real restart. Independent review has 39 binding assertions.
- Semantic review: 45 requirement groups map bidirectionally to all 37 criteria; 20 monetary cases and 16 stock transitions pass.
- Final `20260927-second-crosscheck` images contain exact 12 public inputs and 15 verifier files; Chromium 152.0.7977.8. Independent release validation reopened the archive and actual images.

The golden map distinguishes fresh supplements from hash-reused unchanged observations. Existing actual restart proof includes all 13 stock quantities, exact placed/cancelled receipts and observed PID replacement. Prior five restart lifecycle controls and twenty synthetic scorer cases remain valid only for their unchanged helper/scorer scope. Current orchestration verifies their interaction with the repaired outer cleanup. Synthetic scores are never Oracle/model measurements.

## Remaining limits and next work

No concrete unresolved Ridgeline defect was found in this local review. Hosted rubric acceptance, full paid judge timing, aesthetic assignment, Oracle 1.0 and target model 0.1–0.7 remain unmeasured. Do not guarantee them. The scorer is still 60/20/20 with strict Functional > 0.05, and all semantic fixes retain weights. A conditional example where the nine high-weight transactional/adversarial checks fail but everything else passes yields about 0.606; this is arithmetic, not a forecast.

Judge route remains `claude-code` / `z-ai/glm-5.3-flashx`; supplied target builder is `gpt-5.6-luna`. No paid call, upload, commit or push occurred. A prior paid-run permission question remains unanswered; use any later explicit authorization without asking again, otherwise do not spend.

**Cross-task follow-up:** Colderwater's current `dc2ed5ac...` artifact contains the same original unbounded outer-cleanup pattern. It was not changed during this Ridgeline review. Its existing semantic/browser fixes remain separately documented, but do not claim its cleanup was repaired. Any follow-up must get its own affected harness tests, package/hash and handoff binding rather than silently swapping the ZIP.

Preserve unrelated work, previous artifacts and containers. Any later source edit requires affected tests, a replacement archive and updated evidence. The generic old helper's demand for database deletion conflicts with required durable restart; preserve its prior adjudication rather than adding a deletion.
