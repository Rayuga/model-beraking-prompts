# Gambit platform run analysis — 14 September 2026

Analysis only. No task source, rubric, golden solution, or upload ZIP was changed during this review.

## Recorded results

| Submission | Render | Constraints | Functional | Polish | Visual | Reward |
|---|---:|---:|---:|---:|---:|---:|
| Oracle (`bK4Yev4`) | 1 | 1 | 1 | .8 | .9583 | .9517 |
| NOP (`YAxhbxY`) | 0 | 0 | 0 | 0 | 0 | 0 |
| GPT-5.4-mini (`vhJnZqj`) | 1 | 1 | .875 | .6 | .75 | .795 |
| Gemini 3.7 Flash (`fFrUAxe`) | 1 | 1 | .9062 | .2 | .8333 | .7504 |
| Claude Haiku 4.5 (`GA56s8m`) | 0 | 0 | 0 | 0 | 0 | 0 |

These are platform-exported scores, not local synthetic scores. Oracle, GPT, Gemini, and NOP completed without a trial exception. Haiku had an agent execution exception and must be treated separately. This review does not establish the platform's final acceptance status or rerun source QC.

All five exports have the same prompt provenance. All ten prompt/judge hashes, the runner hash, and the reward configuration hash match current source. Prompt revisions are render r4, constraints r3, functional r5, polish r5, visual r4. Every current golden solution file is byte-identical to its corresponding Oracle app artifact.

## Oracle: scoring correctness passes; pending-action verdict needs reproduction

All 30 functional criteria passed, including all forty scoring fixtures, order invariance, pegging, game completion boundaries, privacy, reload, and process restart. Both render and both constraint criteria passed. Four of five polish criteria passed. Five visual criteria received raw 5; responsive consistency received raw 4 (normalized .75), explaining visual .9583.

The sole binary failure is `pending_action_and_empty_state`. Judge reasoning says rapid delayed activation of **Start selected practice** created two successful game POSTs and two IDs, without busy/suppression state. The empty-state portion passed.

Source inspection shows the named practice button calls the shared `api` function. That function sets a synchronous `saving` guard and `main[aria-busy=true]` before fetching, rejects overlapping game mutations, and clears the guard after the response body finishes. A capturing click listener also suppresses button clicks while saving.

A fresh isolated Docker instance using this same golden source was tested with Playwright. The first real POST `/api/games` was held pending using browser request interception. Repeated pointer activation, Enter, and Space then targeted the same practice button. Observed result:

```json
{"busyBefore":"true","requestsWhilePending":1,"totalAcceptedIds":["G-51D6C7"],"passed":true}
```

This reproduction does **not** confirm the platform verdict. The export contains final criterion reasoning but no detailed judge tool trajectory identifying its delay, click timing, or the two IDs. Possible explanations include sequential clicks after the first request finished, or another timing case not reproduced here. Do not declare either a definite app defect or a definite platform bug yet.

Recommended: make the verifier prove the first POST is still pending before repeating activation and record request/response timing and IDs. Keep duplicate-action protection required. Optionally strengthen the golden UI with explicitly disabled creation controls, visible Saving text, and a creation lock through the UI update. That would make pending state easier to observe; it is not evidence that the existing guard failed.

The remaining visual deduction cites tiny peg-board labels/details on mobile. Improving their legibility is a reasonable golden-only change. If the pending criterion passes and visual remains unchanged, the formula would produce about .9917; this is a projection, not a new run score.

## Verifier issues exposed by model runs

1. **Separate cut request required (`moves_out_of_order_are_refused`, both models).** The criterion insists on replaying a separate cut-before-discard request. Both implementations expose automatic cutting rather than a separate discovered cut action. The task specifies game order but does not mandate a standalone cut button or route. Test the invariant that a cut is not revealed/scored before both valid discards. If a separate cut operation exists, test its premature refusal; for automatic cutting, inspect state before and after the second discard. Retain duplicate-discard and out-of-turn refusal checks.

2. **DB_PATH documentation demanded (`runtime_manifest_routes`, both models).** The club notes require support for `DB_PATH`, but the manifest paragraph only requires the start block, default SQLite path, and actual routes. Both submitted implementations contain `process.env.DB_PATH || '/app/gambit.db'` (Gemini uses double quotes). Both judges deducted the whole criterion because the manifest did not mention relocation. Test relocation behavior through a trusted runtime probe, or explicitly require the documentation in the brief. Prefer the behavior-based check over adding paperwork.

3. **Historical records sought in the wrong list (`seed_ladder_import`, Gemini).** The judge said the original summaries were missing from the chooser/API list. The brief explicitly says the unfinished historical summary should not be offered for resumption. Read-only inspection of Gemini's exported SQLite file found all three exact historical rows, including G-1183 at 76–61. Its manifest documents `GET /api/games/history`; server source returns all historical/saved games there, separately from the playable-game list. The provided UI does not appear to fetch that history route. Allow a documented read route to establish preserved summaries and independently check their exclusion from the playable chooser. Missing from a resume list is not evidence of missing seed storage.

4. **Final count presentation (`pairs_and_last_card_in_real_play`, GPT).** Judge confirmed every scoring checkpoint and exactly one last-card point, but failed the criterion solely because the show retained a count of 30 rather than displaying 0. The brief requires correct reset/lead behavior when a count ends; it does not clearly dictate the retained display after pegging is completely over. Grade the correct final score, single last-card award, and transition to show. Keep actual reset correctness when another pegging segment follows. Do not remove the required go/reset mechanic.

5. **Manual show-control wording (`keyboard_controls_and_focus`, Gemini).** Its feedback includes absence of an explicit Count-the-show control. Counting is required to be automatic, but a manual trigger is not expressly required. Grade keyboard access to the actions the app actually offers, while still requiring useful focus. The reported focus-to-body defect remains independently relevant.

Fixing these would remove unsupported deductions and may increase model scores. Do not retain them just to lower scores or make the task appear harder. No corrected scores are claimed without another evaluation.

## Other model findings

GPT's duplicate-card pegging bench case accepted `[5C]` followed by `5C` and scored a pair. That contradicts the explicit invalid/duplicate-card requirement. The judge also reported non-focusable card controls, focus loss after actions, and mobile width 456px in a 375px viewport with clipping. These are appropriate behaviors to keep testing. Visual comments include suit contrast and clipped mobile panels; final reasoning alone is insufficient to independently verify aesthetic judgments.

Gemini's remaining polish failures concern focus loss, clipped mobile scoring inputs/ladder, no textual reason for a disabled over-31 move, and duplicate game creation. The first three align with explicit club-note requirements. The pending-action finding should be rerun with the same improved timing protocol, especially given the Oracle discrepancy. These are model defects as reported by the judge, not all independently browser-reproduced here.

Haiku's agent terminated with exit 143 immediately after issuing `pkill -f "node serve.js"`. The parent agent command line itself contains the task instruction mentioning `node serve.js`, so broad pattern matching likely terminated the agent process as well. This is an inference from the exception and command. The grader subsequently inspected the partial app and consistently found no usable two-card discard flow; it also found HTML cards instead of the required SVG cards. Its zero is therefore real as an exported grade on that partial artifact, but is not a clean completed-model difficulty result. Rerun it before using it as evidence that the task reliably defeats that model.

## Recommended order

1. Correct the implementation-specific verification issues above while preserving game requirements and 60/20/20 weights.
2. Make pending-action evidence reproducible; optionally make the golden busy state more explicit. Improve mobile peg-board legibility if seeking full visual marks.
3. Recheck task format, assets, instruction/criterion coverage, prompt revisions, and ZIP contents after any edits.
4. Rerun Oracle and the pending-action evaluation; rerun Haiku as a clean trial. Regrade models under the corrected criteria if comparing scores.

The current runs show that Oracle's game mechanics pass and that the two completed models implement most mechanics. Making valid verifiers easier is not needed to repair Oracle's scoring logic. If the task needs more difficulty, any additions should be useful, explicitly requested behavior with a working golden implementation, rather than extra implementation restrictions.

Evidence source: `run-outputs/gambit-hollow-cribbage/`, run IDs `36763d32-b658-4804-b316-b717264dff0f` (Oracle/NOP), `521ba1d0-0b31-4b5a-be28-a891daa4fec5` (GPT), `3978dd99-1b7a-4366-9bf2-f3cdb1063168` (Gemini), `2f1cf135-48a8-472e-a53f-866f12a83440` (Haiku). See each trial's `result.json`, `verifier/reward-details.json`, `verifier/prompt-provenance.json`, and submitted app artifacts.
