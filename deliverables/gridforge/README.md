# GridForge Releases

## Final Delivery: 2.0.10

The prepared submission is in [final-deliverables](final-deliverables/):

- `gridforge-spreadsheet-v2.zip`
- `job-directory/gridforge-spreadsheet-v2-oracle-job-directory/`
- `job-directory/gridforge-spreadsheet-v2-gpt-5.4-mini-high-job-directory/`
- `job-directory/gridforge-spreadsheet-v2-claude-haiku-4.5-job-directory/`
- `job-directory/gridforge-spreadsheet-v2-gemini-3.7-flash-job-directory/`
- `CASE-STUDY-gridforge-spreadsheet-v2.docx`
- `EVAL-REPORT-gridforge-spreadsheet-v2.docx`

Recorded rewards are Oracle `0.9545`, GPT `0.2697`, Haiku `0.0268`, and
Gemini `0.6848`. The Oracle archive also retains the original NOP zero-score
trial. All four runs share version 2.0.10 and the same platform task checksum.
The submission owner accepts Oracle at 0.95 or above; its two Functional
failures remain recorded in the report. No scores were changed or rerun.

The delivery task ZIP is byte-identical to the validated release ZIP below.
Packaging checks and copied-file hashes are recorded outside the submission in
`run-analysis/final-delivery-manifest.json`. The final folder is prepared locally;
it has not been uploaded by the assistant.

## Latest Upload: 2.0.10

Upload [gridforge-spreadsheet-v2.zip](gridforge-v2-2.0.10-validation/gridforge-spreadsheet-v2.zip).
This release includes the agent certificate fix for `run-ce624351`.

| Version | Purpose | Status |
| --- | --- | --- |
| [2.0.10](gridforge-v2-2.0.10-validation/) | Fix missing agent TLS certificates | Four platform runs complete; final delivery prepared |
| [2.0.9](gridforge-v2-2.0.9-validation/) | Explicit readiness check and lockfile correction | Historical |
| [2.0.8](gridforge-v2-2.0.8-validation/) | Earlier local golden validation | Historical |

Keep future GridForge release folders here. Reports and local validation scripts
belong beside their release ZIP, not inside the upload task.

## Which File Is Which?

- `gridforge-spreadsheet-v2.zip` is the task upload archive.
- Earlier `gridforge-spreadsheet-v2-<version>-task.zip` files were byte-identical
  aliases, not different tasks or solutions. They were removed after comparing
  SHA-256 hashes. Historical reports retain their original archive names; those
  names now refer to the retained canonical ZIP in the same version folder.
- JSON reports, screenshots and validation scripts are supporting local evidence.
- Editable source remains in `projects/gridforge-spreadsheet-v2/` at the repo root.
  The older `projects/gridforge-spreadsheet/` is a legacy project, not another copy
  of the latest ZIP.

The upload ZIP must unpack like this:

```text
gridforge-spreadsheet-v2/
  task.toml
  instruction.md
  environment/
  solution/
  tests/
```

That single inner task folder is required by the portal. Do not upload this
entire release collection, and do not flatten the task files into the ZIP root.

From the repository root, package the current GridForge source with:

```powershell
python deliverables/editor-v2-validation/check-and-package.py --task gridforge-spreadsheet-v2
```

This defaults to the corresponding version folder here and creates one canonical
ZIP. Do not regenerate an older release using newer source code.
