# Current Colderwater repair and QC round

Candidate `ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8`.
Task: `projects/colderwater-playground-devtools`.

## Applied repair

The independent row-28 review of the preceding candidate found that S02 could
score a broken language renderer against both its language outcome and the
separate uppercase-extension outcome. Removed the low-value mandatory extension
capitalization behavior and `cw_extension_case`; JS, complete HTML and CSS still
run through filename dispatch using lowercase fixtures. Updated both public
notes, injected context, the criterion descriptions and the scenario together.
Case-sensitive saved titles remain required and tested.

The first intermediate repair retained an overview sentence promising uppercase
support. Both targeted reviewers caught it; that sentence is removed in this
candidate. Their earlier failures are preserved, followed by independent passing
targeted confirmations in `qc/repairs/coldwater-2026-10-01-extension-scope/`.
These confirmations are not the new full QC round.

There are 74 Functional outcomes across 23 shared protocols, total Functional
weight 32.25. Render and Constraints have one outcome each; Polish and Visual
have six each. The app source and build are unchanged and match committed
reference `6b1e1f1bb778543b2bd241cddb465fa3678dadf7`. Execution deadlines,
cancellation, rollback, error reporting, stale-save conflicts and persistence
retain their requirements and checks. Protected template files, budgets, model
settings and the shared 0.6/0.2/0.2 scoring policy are unchanged.

## Measured on these bytes

- Structural preflight: 50/50 pass.
- Source regression guards: 59/59 pass; both shell files parse.
- Scripted golden: 74/74 Functional observations, both gates, six Polish
  observations and 11 runtime regressions pass; one actual process restart.
- Scripted golden duration: 116.596 seconds. This is not judge completion time.
- Installed CLI argument admission passes all five dimensions. No provider or
  judge is launched by that check.
- Visual screenshots exist; no configured Visual grade is claimed.

See `LOCAL_PROOF_SUMMARY.json`, `COMMITTED_REFERENCE.json` and
`raw-evidence-index.json` for exact files, commands and hashes.

## Full QC remains in progress

The pipeline prepared ONE fresh round, with separate reviewer contexts for each
of the 53 quality rows and a separate 48-check deterministic review, using both
the frozen workbook and Harbor skill. Reviewers run in small concurrent groups.
Do not copy older verdicts into this round or interpret blank templates as work
completed. `summary.json`, when reconciled, records the actual completed reports.

The previous partial round and intermediate repair are superseded. Their reports
remain evidence of their own bytes. No full configured judge, hosted Oracle or
Luna score exists for this candidate. The current configured-run helper is
prepared under `qc/repairs/coldwater-2026-10-01-extension-scope/configured-run/`;
default invocation prints a plan and does not spend. The previously asked paid
run approval has not been recorded as received.

Existing local shared findings remain separate: restart/cleanup behavior in the
canonical launcher, potential process-argument exposure in the local verifier
environment, and the intended verification scope for inherited backend/DB_PATH
requirements. No protected-file change or upstream fix is assumed. Hosted
isolation has not been inspected. A fresh review must assess the evidence and
its limits; template compliance alone does not refute a demonstrated behavior.

**Not QC-cleared or upload-ready.** Final reconciliation must include all review
reports, outstanding shared findings and required measurement gaps.
