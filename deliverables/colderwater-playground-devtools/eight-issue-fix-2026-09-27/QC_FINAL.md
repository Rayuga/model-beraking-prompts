# Colderwater: eight-issue repair

The reported source defects have been corrected and affected local checks pass. Full hosted judge timing, platform QC acceptance and Oracle/model scores remain unmeasured. The earlier review relied too heavily on golden success; several failures concerned fair treatment of other valid implementations. This pass includes those alternatives and evaluator-failure controls.

## Candidate

- [Replacement ZIP](colderwater-playground-devtools.zip): **a017932304e19209de817cdd13070c4e0ff5f8e5b8e2af72eac1078cf53357b1**.
- 50 files, 848,280 bytes; one root; CRC, extracted hashes, shell modes and LF endings verified.
- Supersedes the metadata-only `09f4f6cb3647...` archive. Old ZIPs/reports remain history.
- [Exact file changes](change_scope.json): 11 existing files changed and one built JavaScript asset replaced; 38 paths are byte-identical.
- 35 Functional checks, total weight49.5; two gates, four Polish checks and six Visual scales:47 task criteria. The QC workbook separately has53 judgments.

## Reported failures and repairs

| Reported QC issue | Change and evidence |
| --- | --- |
| Deliverables/runtime contract | Removed the requirement for host controls to respond while a loop runs. Timely termination, rollback and subsequent use remain required. Removed the unrequested requirement to document editor escape. |
| Achievability/ambiguity | Standard/native Escape then Tab is accepted without a help label. Both the shipped UI and a help-removed alternative pass the real keyboard route. |
| Timeouts fit the work | Removed custom source classification and redundant recovery saves/reloads, supplied tested network setup, bounded retries, and moved restart after basic save/load. Original budgets remain canonical. The action ledger explains the work; paid full-suite completion time is still a Note, not certified. |
| Unrequired grading | Both hidden requirements above are removed from criteria and prompts. The three reserved private-file addresses are now explicitly public, with denial or working-workspace fallback accepted. |
| Independent criteria | Language dispatch and delayed interaction each earn their own credit; original-run and pending-interaction budgets likewise. Each old2.5 weight becomes1.5+1.0. |
| Browser-decidable outcomes | Private-file checks observe HTTP denial, downloads and rendered fallback without reading source or database bytes. Network setup/count/cleanup recipes execute through actual MCP, with working and unrestricted controls. Failed evaluator setup becomes an ungraded diagnostic. |
| Self-consistent descriptions | Auto-run OFF/cancel observations last beyond the app's measured delay plus margin. Stale-save draft retention uses a real second dirty editor and actual Save; request replay alone cannot establish it. |
| Distinct/authored task | Difficulty now says hard. Metadata stays short and product-focused; category matches the staged profile. Golden badge now says Local library. |

The separate pending final-shutdown defect is also fixed: the harness escalates TERM to KILL within bounded waits while preserving the reward and exit status. It validates structured RewardKit reports, accepts legitimate alternate raw-score representations, and writes `evaluation-incomplete.json` for evaluator errors instead of accepting a partial app grade. The hosted UI may still display the fallback zero; this diagnostic does not promise automatic retry or an app pass.

## Verification

| Evidence | Result and scope |
| --- | --- |
| Source and extracted task |90/90 local assertions each |
| Known regression guard |21 invariants;15 mutation cases, including13 deliberately bad contracts rejected |
| Golden keyboard/UI |5/5 groups on the shipped bundle and5/5 with escape help removed |
| Changed Functional scenarios |6/6 through actual MCP: dispatch, delayed interactions, shared Run deadline, pending interaction deadline, measured auto-run windows, actual dirty-editor conflict/recovery |
| Privacy/network browser proof |15/15 groups; exact supplied recipes, live golden and permissive/denying/download fixtures |
| Additional network counterexample |3/3 groups with unrestricted source inside a mounted opaque-origin sandbox frame |
| Evaluator-report guard |40/40 cases, including valid RewardKit formats, malformed reports, real errors, quoted markers and ordinary app failures |
| Harness orchestration |4/4 final-shell cases, including a real process restart and durable snippet |
| Final cleanup |7/7 controls; after the raw-score-only follow-up, retained by exact unchanged cleanup/control-flow binding |
| Actual images |7 public files and15 verifier files match current source; Chromium152 |
| Full review inventory |53 quality dispositions:45 Pass,8 Note.48 documented deterministic dispositions:34 Pass,10 Note,4 N-A |

The private platform checker programs were unavailable. Local/manual equivalents were applied; these counts are not a claim that the platform's checkers ran. The [client-safe workbook](QC_FINAL.xlsx) omits internal annotations.

Read the [Functional before/after report](functional/FUNCTIONAL_REPAIRS.md), [timing ledger](functional/TIMING_AND_COVERAGE_LEDGER.md), [golden report](golden/GOLDEN_REPAIR_REVIEW.md), [all47 criterion evidence map](golden/GOLDEN_CRITERION_EVIDENCE.json), [harness report](harness/HARNESS_REVIEW.md) and [release validation](release_validation.json). Nine criterion witnesses are fresh; unchanged witnesses are explicitly reused. Test-driver selector/timing/fixture mistakes remain preserved as diagnostics and are not called golden defects.

## Preventing recurrence and score implications

[QC_REGRESSION_PREVENTION.md](../../../QC_REGRESSION_PREVENTION.md) is now part of the authoring context and workflow. Packaging checks known regressions on both source and extraction. Reviews must map requirements in both directions, test a valid alternative, read injected context, measure negative waits, and distinguish app failure from unavailable tools. Fresh proof and archive/image hashes must agree before delivery.

The canonical gates, Functional floor and60/20/20 formula are unchanged. Splitting the two old conjunctions can add up to0.03636 final reward through justified partial credit, assuming the same gates/floor outcome. Other fairness corrections can change outcomes too; that is not a forecast for Luna. With full Polish and Visual, reward is0.4+0.6×Functional after prerequisites pass, so a score at most0.7 requires Functional at most0.5.

Local evidence supports the golden's required behavior; it cannot establish Oracle1.0 or guarantee no future rubric feedback. Full hosted judging is still needed to measure duration, subjective ratings and the model's actual score. No paid call, platform upload, commit or push was made. The existing localhost:3420 user preview and its database were preserved; it is the prior preview bundle, not a fresh deployment of this badge-only golden rebuild.
