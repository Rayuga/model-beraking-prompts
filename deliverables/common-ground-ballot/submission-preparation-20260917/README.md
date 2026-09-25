# Common Ground Ballot final delivery

Download: [common-ground-ballot-final-deliverables.zip](../common-ground-ballot-final-deliverables.zip).
The seven individual submission files are in [final-submission-20260917](../final-submission-20260917/).

This follows the naming, archive wrappers, and seven-file organization used by
Gambit Hollow, Dropline Four Connect, and Patchpad Editor v3:

1. `common-ground-ballot.zip`
2. `common-ground-ballot-oracle-job-directory.zip` (includes the original NOP trial)
3. `common-ground-ballot-gpt-5.4-mini-high-job-directory.zip`
4. `common-ground-ballot-gemini-3.7-flash-job-directory.zip`
5. `common-ground-ballot-claude-haiku-4.5-job-directory.zip`
6. `EVAL-REPORT-common-ground-ballot.docx`
7. `CASE-STUDY-common-ground-ballot.docx`

The download ZIP has one `common-ground-ballot-final-deliverables/` wrapper
containing exactly those seven files. Each nested ZIP has its own matching
wrapper. Reports, raw run exports, and packaging scripts are outside the task ZIP.

| Recorded run | Overall | Functional | Render | Constraints |
| --- | ---: | ---: | ---: | ---: |
| Oracle iBeMVH2 (same previously supplied trial) | 1.0000 | 1.0000 | 1 | 1 |
| GPT-5.4-mini 3pecCc8 (fresh) | 0.5788 | 0.3357 | 1 | 1 |
| Gemini 3.7 Flash 97FPuUp (fresh) | 0.0000 | 0.0000 | 0 | 0 |
| Claude Haiku 4.5 pWxzQKF (fresh) | 0.0000 | 0.1111 | 0 | 1 |
| NOP cQy8rSn (same previously supplied trial) | 0.0000 | 0.0000 | 0 | 0 |

The evaluation report contains the score ledger, all 86 criterion outcomes,
model findings and non-full-credit explanations, runtime budgets, durations,
provenance and limitations. The case study explains the product, difficulty,
reference development and what the model comparison supports.

Both DOCX files opened and rendered in Microsoft Word: evaluation 11 pages,
case study 3 pages. All rendered pages contain content and no text blocks extend
outside the page. First pages, the criterion-table continuation, and the case
study's final page were visually inspected. PDF/PNG previews remain in this
preparation folder and are not added to the seven-file submission.

The final task ZIP passed 294 local archive/contract checks. All 29 task file
hashes match frozen r27 and current source. All 12 verifier hashes match each
export; all five exported Oracle app files match the golden solution. Every
graded trial contains all 86 verdicts and each judge completed within budget.
All 237 exported run files are preserved byte-for-byte across the four job
archives. No files were excluded and no provider credentials required redaction.
The source task, golden solution and original run outputs remain unchanged.

These packages preserve measured results; no new paid evaluation, browser
regrade, Docker build, platform upload, or platform QC was performed here.
Some Functional deductions cite blocked or incomplete evidence. One fresh GPT
sample at 0.5788 is not a repeated-run guarantee. Separate platform Static/QC
reports and a Sonnet export were not supplied; the reports explicitly retain
those limits rather than substituting Gemini for Sonnet.

Task ZIP SHA256:
`76b8cceb5eb22b2a48df6d53d58f647814516722b4beed6e8f7d7fef625cc578`.

Download bundle SHA256:
`e77e9d400bb041d60e618a026ffe12df3ef1a9b7634873639175de567863174e`.

Audit files: `package-audit.json`, `final-task-checks.json`,
`document-render-check.json`, and `bundle-audit.json`. Build scripts are kept
here for reproducibility. The successful Word export uses `render_reports.py`;
the earlier PowerShell Repaginate attempt was interrupted without saving changes.
