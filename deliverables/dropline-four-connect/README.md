# DropLine Four Connect

## Final submission - 14 September 2026

[Final submission folder](final-submission-20260914/)

[Scored task ZIP](final-submission-20260914/dropline-four-connect.zip)

Seven files: task ZIP, Oracle/no-op, GPT-mini, Gemini and Haiku job-directory
ZIPs, plus CASE-STUDY and EVAL-REPORT Word documents. Preparation evidence and
scripts are separate in [submission-preparation-20260914](submission-preparation-20260914/).

Task ZIP SHA-256:
`577451c9d67ef834db1c8366af284b323233ad4f7abc20e396c23c562dd1d63a`.

Recorded overall scores: Oracle **0.9917**, GPT-mini **0.1766**, Gemini **0.7804**,
Haiku **0.0000** (reload/Constraints gate), no-op **0.0000**.
Oracle Functional: **1.0000, 42/42**. All current verifier hashes match the run
exports; golden source matches the Oracle app. No task changes during packaging.

Fresh packaging checks: 137 standard and 400 actual-archive checks passed.
Both Word reports opened read-only and exported to PDF successfully (3 and
14 pages); PDFs remain with preparation evidence, outside the seven-file folder.
The reports distinguish blocked or incomplete judge observations from proven
defects, including GPT's native naming prompt and unfinished re-login check.
Oracle is not overall 1.0; no blanket fairness or platform QC guarantee is made.

## Historical rename delivery - 13 September 2026

Current three-word task name: `dropline-four-connect`.

Source: `projects/dropline-four-connect`.

[Historical rename ZIP](1.0.0-name-20260913/dropline-four-connect.zip)

SHA-256: `58fe8a9b7c4537352cec6eec00c4ce01de68fa5ba927231f8cf1660c4ee2dd7a`.

The task folder, task.toml identity, package name, Docker labels, runner
provenance, prompt markers, installer message and ZIP wrapper now agree.
All 32 files were checked against the previous ZIP: the only differences are
replacement of the previous task slug with the new slug. Behavior, criteria,
weights, configuration values and golden application logic are unchanged.
Version remains `1.0.0`; both network settings remain public.

109 local standard checks passed again. The ZIP has exactly one matching
wrapper and all entries match source hashes. Previous ZIPs/reports are intact.
Earlier local behavioral evidence is linked from the
[previous handover](../dropline-four-lite-v2/1.0.0-standard-20260912/HANDOVER.md);
it ran under the previous name and is not a new platform run.

Fresh platform QC/Oracle/model runs remain pending. Exact image builds were
previously blocked by local dependency-download failures. This rename does
not establish an Oracle score or platform rubric pass.
