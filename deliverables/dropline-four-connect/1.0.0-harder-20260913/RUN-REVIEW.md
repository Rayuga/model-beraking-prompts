# Dropline run review — 13 September 2026

Status update: this document records the INITIAL, pre-hardening run review.
The user subsequently approved branching-analysis features; they are now
implemented and locally tested. See HANDOVER.md for the new package, exact
checksum and limitations. References below to "current" criteria mean the
32-file baseline captured before that implementation, not the new 36-file ZIP.

The five trial exports are under
`run-outputs/dropline-four-lite/credit-fail-b3c04d9b/`, but their actual task
identity is `dropline-four-connect`. The folder's `credit-fail` name alone is
not evidence that these completed scores were caused by a credit failure.

| Trial | Model | Overall | Functional | Polish | Visual |
| --- | --- | ---: | ---: | ---: | ---: |
| RUDVtsQ | Oracle | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| B5fRmsz | GPT-5.4-mini | 0.7721 | 0.9535 | 1.0000 | 0.0000 |
| p5qDnbt | Gemini-3.7-flash | 0.9442 | 0.9070 | 1.0000 | 1.0000 |
| 7gL2yVq | Claude Haiku 4.5 | 0.2839 | 0.2093 | 0.1667 | 0.6250 |
| EiiRGyW | NOP | 0.0000 | 0.0000 | 0.0000 | 0.0000 |

Render and Constraints were 1 for the four non-NOP trials. Their 16 Functional
criterion descriptions and weights match the current source. See
`run-review.json` for exact run paths, failed verdicts and source baseline hashes.

## What the scores mean

GPT passed 15 of 16 Functional criteria. `authenticated_account_workflow` failed
because signing out left protected board/totals visible. The Visual judge
independently found the same protected-content exposure and zeroed that
dimension's gate. Its Visual zero is not an assessment that its styling was
poor, and it is not a missing-credit or unavailable-judge result.

Gemini passed 15 of 16 Functional criteria. The reported failure was loss of
focus after keyboard Redo, in `keyboard_focus_and_activation` (weight 2).

Haiku failed 12 of 16 Functional criteria. Reported failures cluster around
missing immediate move-history updates/Undo availability, an empty replay
surface, and multi-tab authentication handling. Several verdicts depend on the
same missing visible-history behavior; they should not be described as twelve
independent implementation defects. Its multi-tab failure also involved
session setup/revocation, so detailed action reproduction is needed before
assigning that particular failure solely to server concurrency logic.

Oracle passed every current criterion. This validates the uploaded baseline,
not any future harder revision. NOP remained at zero.

## Hardening decision

Basic gameplay, persistence, archive and ordinary undo/redo are largely solved
by GPT and Gemini. Adjusting only cosmetic scoring or relying on GPT's current
sign-out bug would not establish a stronger gameplay task.

A proposed product extension is a saved analysis-variation workspace: fork a
played position into independent continuations, retain branching histories,
keep analysis separate from match totals, and preserve branches across reload,
restart and concurrent edits. This needs explicit requirements, matching
verifiers and a tested golden implementation; it cannot be imposed only in
hidden grading. The user was asked to choose between that extension and deeper
checks of existing requirements. No task source has been changed at the time
of this initial review.

Keep task identity, schema, version marker 1.0.0, public networking, judge
configuration, timeouts and 60/20/20 formula unchanged. Preserve the uploaded
ZIP and source baseline. A new package requires fresh platform QC/Oracle/model
runs; no local test can guarantee a future GPT score below 0.7 or Oracle 1.0.
