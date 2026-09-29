# Ridgeline review in progress

The user supplied a lead review on 28 September requiring template files to remain unchanged outside CHANGE_ME placeholders. This supersedes the earlier assumption that task-local launch, cleanup and restart fixes were allowed.

Ridgeline tests/test.sh now matches the local webdev-task-template byte for byte. Its SHA-256 is bd68259276ca4b034654efc8a1723a4e702ed62dbe590af6201565f43eabe5aa. Suite budgets are 1500/11100, Functional timeout 9000, functional floor 0.05. Both Dockerfiles and both shared Python tools also match. integration.md no longer promises /app as the launch working directory and explicitly requires file access to work independently of it.

The actual golden app was launched through this restored shell, exercised through the existing offline orchestration fixture, and restarted with the single-use MCP tool. The saved receipt, all thirteen stock quantities, historical receipt and retry identity survived. The fixture uses synthetic judge scores: this is not Oracle 1.0 or a provider run.

Remaining review: custom gate/scored prompts and gate/polish/visual criteria differ from the local template and lack corresponding CHANGE_ME sections there. Strict compliance needs to reconcile these with the earlier requested rubric repairs. In particular the local Visual template instructs raw 0–5 despite its own stated RewardKit 1–5 schema, and its generic constraints gate disclaims persistence. Do not silently claim all template files match or all QC issues are resolved.

This directory's 94-assertion source report and four-case orchestration report PRECEDE the full test.sh restoration. They are historical evidence for the intermediate candidate, not validation of the current shell. The source-audit script still expects the now-removed CWD launch customization and must be updated before reuse. The read-only golden browser flow still covers the unchanged app.

The offline schema probe is unfinished: all_yes, one_no and one_small_no behaved as expected; an unrecognized binary value normalized to zero without an error flag, and omitting a criterion caused RewardKit to abort without a summary. The fixture's error-flag assertion was wrong. Preserve this evidence; do not call all five cases passed. The canonical template still has a whole-process-error fallback to zero, which is a shared template limitation and must not be patched locally under the new rule.

No new ZIP, upload, provider run or push was made. The existing final ZIP predates this review and does not contain the restored template shell. Colderwater is unchanged.
