# Colderwater QC history and last-attempt review

## Latest repair: coverage candidate f8670834

The user authorized fixing the remaining coverage gaps. The new candidate is `deliverables/colderwater-playground-devtools/coverage-fix-2026-09-27/review-candidate/colderwater-playground-devtools.zip`, SHA-256 `f86708344b0861aad8a48049996c7b72266c29d6d68bf377358a0c5810aad6ae`.

The new browser protocols directly observe CSS globals and pending timers, real dirty Rename/Delete conflicts, and JS/HTML/CSS imports. Uppercase import and server-save credit are separate. All 37 feature budgets remain unchanged, with 93 Functional outcomes totaling 49.50. Only the three private judge/protocol/context files changed; all 23 golden files are unchanged.

Focused offline browser runs passed these behaviors on the golden. Deliberately broken versions retained CSS state, discarded conflict drafts, or rejected HTML/CSS imports, and each defect was detected while separately working layers retained evidence. The repair summary, final semantic review, runtime observations and QC inventory live under the new coverage-fix directory.

This resolves the three concrete gaps behind the prior coverage Hold. It does not establish a full Oracle score, provider timing, target-model score or platform acceptance. Full paid Oracle approval remains pending; no provider call or platform attempt was used. A virtual authored execution realm may be inaccessible to allowed browser state observations; the protocol reports that narrowly defined limitation as incomplete rather than failing a legitimate architecture or inventing success.

### Historical decision on the previous ZIP

The prior `663e4d6df66f951662e13d4a365cd2c72f83fba29c9e42998b58cd2bf023013e` ZIP was held because the source-QC coverage Note concealed concrete gaps. The sections below preserve that review and its issue history; their statements about remaining coverage concern those old bytes, not the repaired f867 candidate. Earlier reports remain historical and must not be presented as a complete Oracle run.

## What was matched to the QC sheet

The root `WebDev Rubrics QC.xlsx` and the skill's `assets/WebDev_Rubrics_QC.xlsx` have different file hashes but identical cell contents across all four sheets. They specify the same **53 quality checks and 48 deterministic checks**. The review uses the current staged-task rules, not PatchPad's retired five-folder/reward.toml rules.

All rows have dispositions. That means the review is complete, not that every row passes. The named private platform checker executables are unavailable here; our local assertions, manual checks and explicitly scoped historical evidence are not a claim that those executables ran. The 95 local mechanical assertions and 42 source guards cover a different inventory from the platform's 48 checks.

See the [sheet comparison and evidence verification](deliverables/colderwater-playground-devtools/last-attempt-review-2026-09-27/sheet_match.md) and the updated QC report in that review directory. The workbook intended for sharing excludes the internal annotation sheet.

## Findings on the previous 663e4d6d ZIP

| Concern | Why it is different from an untested exotic variant | Consequence / required follow-up |
| --- | --- | --- |
| CSS globals | The brief expressly requires CSS not to inherit old globals. The existing CSS checks observe script/handler suppression; a later fresh JavaScript Run does not establish a fresh CSS execution context. | Add a browser-observable CSS-state control that distinguishes retaining an old global. Verify the golden and a deliberately leaking variant. |
| Unsaved work after stale Rename/Delete | The brief's stale-operation paragraph covers Save, Rename and Delete, then promises to preserve unsaved work. Only stale Save has the actual dirty-editor flow; Rename/Delete can be graded through request replay. | Observe the two real dirty-editor conflict paths. Server nonmutation alone cannot prove that the browser draft survives. |
| Supported file types | JavaScript, HTML and CSS are a named finite set. The import probes use `.js`/`.JS`, allowing an importer that refuses supported HTML/CSS files to escape detection. | Exercise the remaining supported types with exact import/save/load outcomes while retaining independent credit and existing total weights. |
| Invisible implementation guarantees | A browser-only judge cannot establish every internal fact, including that discarded source is never evaluated on the backend. This is distinct from a concrete missing browser flow. | Clarify the requirement-to-observation contract; do not quietly permit source inspection or claim exhaustive proof. |
| Full judge timing and Oracle result | Correct nested budgets and a fast scripted browser run do not measure the LLM-driven run. RewardKit discards an incomplete batch. | Measure the full local Oracle on the exact repaired candidate when the pending paid-run approval is supplied. Even that does not certify source-QC acceptance. |

The [independent semantic review](deliverables/colderwater-playground-devtools/last-attempt-review-2026-09-27/semantics.md) gives exact locations, false-pass witnesses and the boundary between concrete gaps and finite test coverage. These findings do not mean the golden has failed those features; the current rubric does not yet prove them adequately.

There is also a bounded interpretation risk: uppercase import acceptance and uppercase server-save acceptance still share one binary outcome, although the protocol isolates their evidence. The platform previously demanded separation of independently useful outcomes. This is recorded for review, rather than asserted to be another proven platform failure. It should be considered before spending the last attempt.

## Failure history

The supplied screenshots contain **8 feedback episodes, 30 flagged check occurrences and 19 distinct check IDs**. These are counts of the available feedback, not an assertion that all platform attempts or run exports are present. One flag can describe several defects, and several flags can describe the same underlying defect.

| Episode | Flags | What was reported | What changed / present status |
| --- | ---: | --- | --- |
| E1: static instruction hygiene | 1 | Ordinary brief words matched short criterion IDs such as keyboard, timeout and duplicate. | Private IDs were made distinctive; public product wording did not need to become a grader checklist. |
| E2: broad source review | 10 | Unnatural brief/voice; grader vocabulary; missing coverage; bundled criteria; weak gates; shell credit; ineffective floor; misleading weight meaning; inconsistent prompts. | Public notes were rewritten, real execution and durable retrieval were added to gates, independent outcomes and missing probes were added, and prompts were aligned. Coverage later proved incomplete in further places. |
| E3: superseding runs and private files | 3 | Cancellation explanation was required more broadly than the brief; private working-file protection was requested but not graded. | Superseding a Run no longer required an extra notice; working-file checks were added. The later privacy implementation went through further repairs. |
| E4: completed interaction and keyboard coverage | 2 | Five-second budgeting did not clearly cover later interactions; a broad keyboard promise had only a small reachability test. | Public interaction semantics were clarified; a real keyboard route through examples and saved snippets was added. |
| E5: eight-source-finding round | 8 | Unrequested responsiveness during loops and documented escape keys; workload risk; bundled outcomes; body-reading/network-tool probes; inconsistent wait windows and stale-request versus dirty-editor proof; stale metadata/badge. | Unsupported presentation demands were removed, browser workflows and controls clarified, local tool recipes tested, timing windows measured, real dirty Save exercised, and metadata/badge corrected. Full LLM timing remains unmeasured. |
| E6: private probe leakage and delete/restart coupling | 2 | Public notes disclosed exact privacy probe filenames; restart relied on Duplicate/Delete, and Delete bundled independent protections. | Public requirements became category-based; private probes were expanded; restart used ordinary saves; deletion outcomes were separated. |
| E7: timeout and remaining bundles | 2 | 37 long bundled checks still risked timeout; import/title/startup/language outcomes still shared all-or-nothing credit. | 37 protocols now supply 88 independently scored outcomes with shared observed setup and unchanged total weight. The full judge's timing was not measured. |
| E8: positive controls and privacy contradiction | 2 | Dead Auto-run and a wiped CSS preview could earn negative credit; the same privacy response could fail locally or invalidate the entire evaluation. | Matching positive controls became mandatory; 16 descriptions clarified existing controls; privacy now has ordered exclusive decisions. Targeted golden observations and two broken variants support these repairs. |

The [complete issue and archive ledger](deliverables/colderwater-playground-devtools/last-attempt-review-2026-09-27/history_evidence.md) distinguishes each witness, fix, recurrence and evidence strength. It does not invent task-version/hash associations where no platform export records them. Ridgeline-only findings and local-only repair iterations are not counted as Colderwater platform rounds.

## Were issues repeating?

There are three distinct patterns:

1. **A check category recurred with a different witness.** Independence was raised against several different groups: import/title/startup, restart setup, deletion protections and language/lifecycle bundles. Fixing one group did not fix the rest. Ambiguity also concerned different wording on different rounds.
2. **An unresolved concern recurred.** Timeout fit was raised again while the allowance remained 9,000 seconds and the long browser workload was not measured through the actual judge. Reorganizing actions is risk reduction, not timing evidence.
3. **A repair exposed or introduced another defect.** Separating scores while saying only the short rows defined success disconnected positive controls from some negative checks. Privacy revisions also left overlapping classification clauses. The latest feedback was not simply the reviewer rediscovering the same wording unchanged.

The local reviews also contributed: broad source guards checked structure, not every semantic consequence; some concrete coverage limitations were classified as Notes; and guidance permitting whole workflows was applied too broadly to independently useful features. A complete list of checked rows and a passing golden script did not justify the earlier confidence.

## Is QC nondeterministic?

**These records do not establish a platform nondeterminism bug.** The tasks changed between reviews. The evidence inventory does not contain a controlled pair with the same ZIP hash, QC checker/reviewer version, reviewer configuration and different resulting findings. The source-QC reviewer's model, prompt and sampling settings are also not established by this task's verifier configuration; the application judge is a separate stage.

Review variability remains possible, particularly for human voice, independence and ambiguity. A previously unreported defect appearing later is compatible with incomplete detection, a changed task, a changed reviewer, or variability. It is not by itself proof that the newer finding is false. Several reported counterexamples are concrete and can be reproduced locally.

To investigate reproducibility, obtain the platform's existing run IDs, exact submitted archive hashes, QC/reviewer versions and complete findings. Compare unchanged inputs and distinguish a new detection from opposite verdicts on the same precise observation. Do not spend the last task attempt just to demonstrate variability. Raising the whole-flow interpretation discrepancy with the team is reasonable, but it does not excuse the missing controls or uncovered requirements.

## Before another upload

Resolve the concrete coverage gaps against the public requirement, preserve independent scores and meaningful controls, then validate the exact golden and false-pass counterexamples. Review the full resolved prompt and shared context before freezing the next archive; avoid changing it during evidence collection. Keep the overall weights and staged harness contract intact. Measure the full Oracle when authorized and retain source-QC uncertainty separately. Only a complete platform review can establish platform acceptance.
