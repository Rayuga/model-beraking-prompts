# Colderwater: positive controls and consistent privacy verdicts

This repair addresses the two platform findings against the `7d693e9c` release. They were real rubric defects. Separating independent credit had detached some meaningful positive controls from their short outcome descriptions. The privacy protocol also allowed overlapping exposure and incomplete-evidence verdicts.

Current [review ZIP](review-candidate/colderwater-playground-devtools.zip): SHA256 `663e4d6df66f951662e13d4a365cd2c72f83fba29c9e42998b58cd2bf023013e`, 50 files. Earlier intermediate extractions in this directory are not the final candidate. This ZIP is a local review artifact, not a claim of platform acceptance.

## What changed

- OFF-state Auto-run checks require an actual successful automatic execution, followed by the negative observation and successful deliberate execution of the pending source. A separate debounce-reset defect cannot erase a valid control fact.
- CSS handler removal requires the original script and handler to have worked, the copied document/button to remain available, and an actual ordinary click that produces no old handler output. A wiped preview cannot pass. Styling correctness keeps its separate score.
- The same control audit covered all 88 outcomes. Sixteen descriptions now explicitly retain their meaningful controls, including import/refusal, saved edits, theme changes, console history, callbacks and fresh JS state. The protocol contract requires controls without importing a sibling's complete verdict.
- S06 uses ordered, exclusive decisions. Accepted denial/no-content/fallback/public-role outcomes, demonstrated exposure, and a narrowly defined unresolved permitted observation cannot receive competing classifications. Plain HTTP 200 or an app claim alone cannot invoke ambiguity. The shared context states the same rule.
- Conditional control fallbacks keep CSS independent of HTML dispatch and unsupported-execution refusal independent of harmless-word handling. They add work only if the original control fails.

Only the Functional judge, its prompt and shared app context changed inside the task. All 23 golden files, public instructions, harness, budgets and provider settings are unchanged. The 88 outcomes still total 49.5 Functional weight; the 60/20/20 formula is unchanged. See [exact change inventory](change_summary.json).

## Evidence and limits

The current 42 source guards pass. Those guards reject the previous 88-row release. They are regression protections, not semantic certification. Both source and extracted archive pass 95/95 local mechanical checks. The archive has passed CRC, extraction-hash, shell-mode and public-instruction hygiene checks. The installed RewardKit resolves the final prompt to 108,911 bytes and successfully launches it; its response schema and scoring contract are unchanged.

The [all-88 control audit](semantics/POSITIVE_CONTROL_AUDIT.md) records each outcome's required successful observations and independent score boundary. The [focused browser proof](golden/FOCUSED_PROOF_SUMMARY.md) supports five current outcomes, rejects both deliberately broken source variants, and directly exercises the JS-authored CSS control. It is not a fresh 88-outcome run. The legitimate public `/server.js` alternative has actual normal-use request/UI evidence and healthy DOM/log observations; its result is an explicitly documented composite because the proof's status locator matched two elements. Raw incomplete reports remain intact. The ambiguity matrix is a semantic decision exercise, not an actual ambiguous-app or LLM run.

Focused browser evidence is collected under `golden`; the full outcome/control audit is under `semantics`. Preserve original failed driver attempts and distinguish expected mutant failures from golden behavior. Previous full-workflow evidence remains historical and can be reused only with explicit unchanged source/protocol scope. No paid LLM judge or platform run was performed in this repair. Oracle score, target-model score and full LLM judge timing remain unmeasured.
