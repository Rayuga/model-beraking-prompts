# Gambit Hollow supplied run review — September 15, 2026

Oracle and GPT meet the saved overall score requirements. There are remaining
qualifications: GPT Functional is slightly above 0.7, Gemini overall is above
0.7, Haiku did not finish normally, and Oracle Visual is below the preferred 1.0.
No task files or scores were changed and no model was rerun for this review.

| Trial | Overall | Functional | Polish | Visual | Assessment |
| --- | ---: | ---: | ---: | ---: | --- |
| Oracle `TuEG7Z5` | 0.9833 | 1.0000 | 1.0000 | 0.9167 | Meets >0.95 overall; all 40 Functional criteria pass. |
| GPT-5.4-mini `cmZxA5f` | 0.6616 | 0.7083 | 0.6000 | 0.5833 | Overall is within 0.1–0.7. Functional is 34/48 weighted points, with 29/40 criteria passing. |
| Gemini 3.7 Flash `q9jJv28` | 0.8134 | 0.9167 | 0.4000 | 0.9167 | Above 0.7; no separate Gemini acceptance band is recorded in the saved requirements. |
| Haiku 4.5 `WGZSAcM` | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Exported grade on an incomplete artifact; agent execution failed. |
| NOP `RKrf7iu` | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Correct no-op result, graded=0 and no_op=1. |

Render and Constraints are both 1.0 for Oracle, GPT and Gemini. The saved
0.1–0.7 requirement applies to GPT's final reward, not separately to Functional.
The more ambitious GPT target near 0.4 from the earlier Gambit review was not
reached. Gemini also would not satisfy a policy requiring every model below 0.7.

## Findings

- Oracle has no failed binary criterion. Two Visual criteria received 4/5
  (normalized 0.75): spacing/layout and responsive consistency. Reasons cite
  excess blank spacing, compressed mobile controls and a shortened practice
  label. This passes the overall acceptance threshold but misses the preferred
  Visual=1.0 authoring target in TASK_TEMPLATE_STANDARD.md.
- GPT's 11 Functional failures concern pegging/run/last-card scoring,
  repeated discard acceptance, show totals, hand resets, full-match completion
  and lost-response retry after reload. Its nonzero result reflects completion
  of the basic working-browser gate, unlike the two older zero GPT runs.
- Gemini fails three Functional criteria: invalid starting scores accepted,
  a duplicated physical card accepted by the pegging bench, and the retry
  control lost after reload. Its score is high despite these defects.
- Haiku reports UnknownApiError with agent command exit 143. The final agent
  action was `pkill -f "node serve.js"`. The process command line includes the
  instruction mentioning that server command, so self-termination is the likely
  cause; the exit status and action order alone do not prove the process ancestry.
  All five judges found the shared playable-table gate failed: creation/opening
  controls displayed "UI coming soon". The recorded zero is a real grade on this
  partial artifact, but should not be represented as a normally completed model
  attempt. Rerun Haiku for clean evidence.
- No Sonnet export is in this folder. The saved general delivery checklist lists
  Sonnet evidence; if that checklist still applies to this submission, it remains
  outstanding. No separate Sonnet score band was found.

## Cross-checks

All five trials have the same recorded Harbor task digest:
`sha256:ebe8a7bc5b75c6b6a8151c8cb985d85070042698e2888bc48ded8f6a7c230bb8`.
Their prompt provenance is identical. All five prompt/judge hashes, the runner
hash and reward-config hash match the current project source. This establishes
shared exported task identity and matching verifier source; the Harbor task
digest is not the ZIP file's SHA-256.

Every graded trial has all 55 criterion records. Recomputed dimension aggregation
and the final gated 60/20/20 arithmetic match the exported scores. Oracle, GPT,
Gemini and NOP have no recorded trial exception. Haiku is the only errored trial.
This is an audit of exported verdicts and artifacts, not a fresh browser regrade
or proof that every judge observation is correct. No platform QC report was
included in these exports.

Structured verdicts, all less-than-full criterion reasons, trial IDs and target
definitions are in [run-review.json](run-review.json). Input evidence hashes are
in [input-hashes.json](input-hashes.json). Inputs remain unchanged under
`run-outputs/gambit-hollow-cribbage/`.

For the recorded Oracle/GPT thresholds, these results do not call for tightening
or rerunning GPT solely to improve its range placement. The immediate evidence
repair is a clean Haiku run. A stricter all-model or Functional ceiling would be
a separate task-difficulty decision, not a change to these recorded scores.
