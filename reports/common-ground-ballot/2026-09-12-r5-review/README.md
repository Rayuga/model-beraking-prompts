# Common Ground Ballot: New Run Review

These are the recorded r5 results, not scores for the revised r6 package.

| Model | Reward | Functional passes | Functional | Polish | Visual |
| --- | ---: | ---: | ---: | ---: | ---: |
| oracle | 0.9595 | 18/19 | 0.9464 | 1.0000 | 0.9583 |
| gpt-5.4-mini | 0.7393 | 12/19 | 0.6071 | 1.0000 | 0.8750 |
| gemini-3.7-flash | 0.6536 | 11/19 | 0.5893 | 0.5000 | 1.0000 |
| claude-haiku-4-5 | 0.0000 | 0/19 | 0.0000 | 0.0000 | 0.0000 |
| nop | 0.0000 | 0/19 | 0.0000 | 0.0000 | 0.0000 |

All jobs finished without trial errors. Scores agree between result.json, reward.json, reward.txt and the gated 60/20/20 formula. All 12 prompt/judge/runner/reward hashes match the evaluated judge-r3 archive. Every graded app returned all 33 criteria. NOP is the expected ungraded zero.

## Findings

### oracle_invalid_draft_not_reproduced

Oracle final 0.9595 clears the numerical 0.95 threshold but only 18/19 functional criteria pass. The claimed malformed Temp invalid request is not present in exported per-action evidence. All exact invalid draft controls reject/prevent without mutation in a browser against byte-identical captured golden source. Do not call this a confirmed app defect or override the platform result.

### gpt_above_target

GPT 0.7393 is above the formal 0.1-0.7 band. Blank/duplicate draft normalization, fractional lifecycle revision acceptance, repeated approval acceptance, and seeded tally multiplication reproduce. Ineligible Owen and cross-ballot Leila are correctly rejected in isolated probes, contrary to broad failed-check wording. Single-choice exchange failure is explicitly missing evidence. Correcting evaluation may raise scores; no range guarantee.

### haiku_refresh_gate

Login succeeds but refresh returns to sign-in. Reproduced in browser; sessionId is only an in-memory global. All 33 zero criteria reflect one failed shared gate, not 33 independent feature defects.

### gemini_mixed_failures

Gemini 0.6536 is in band but lost original vote evidence and an approval tally defect are repeated as reasons for unrelated eligibility/retry/mismatch/duplicate failures. Repeated option input is normalized and accepted (200). Exact replay succeeds while Open (200) but fails after publication (400), independently confirming the receipt-order defect. Published replay was not actually established by the judge.

### gemini_touch_threshold

Polish rationale treats 44px as a hard threshold although the brief and criterion say comfortable touch targets. A 36px control alone does not establish the full usability failure. Keyboard dialog findings are judge-observed and not independently browser-retested here. No score change made.

### no_new_scores

The r6 release contains revised criteria and a CSS fix. Historical r5 scores do not apply to it. Local probes are unpaid regression evidence, not Oracle or platform QC.

## Action Taken

See ../../../deliverables/common-ground-ballot/2026-09-12-judge-r4/ for a separate new upload, exact controls, independent scoring, post-restart result coverage, local golden tests and the mobile wrapping correction. The new package has no platform Oracle or QC result yet. No task weights, model artifacts or historical scores were changed.
