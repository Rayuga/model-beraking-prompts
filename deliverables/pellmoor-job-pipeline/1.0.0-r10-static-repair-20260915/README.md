# Pellmoor r10 static schema repair

Upload [pellmoor-job-pipeline.zip](pellmoor-job-pipeline.zip) for the next QC run.

SHA256: `cdda725d1d91722bdf2e96e1eb9c8b6ef88df88ffcfb6eb3a66bcefefb9eb0e6`.

The reported static failure was caused by Render and Constraints having zero
judge weights in r9. The platform requires positive judge weights. Both are
restored to 1.0, and the obsolete zero-weight scoring patch is removed.

RewardKit now emits the five independent dimension scores without an aggregate.
The unchanged final formula in test.sh applies the Render/Constraints gates and
the 60/20/20 point split. No duplicate zero-weight maps remain. All 60 criteria,
all prompts, the golden solution and the earlier r9 rubric repairs are unchanged.

See [repair and validation details](STATIC_REPAIR_REPORT.md) and
[package provenance](package-verification.json). Hosted QC and Oracle results
remain pending; local checks do not establish a new hosted score.
