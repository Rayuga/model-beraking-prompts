# GridForge v3 — 3.0.0

Source: `projects/gridforge-spreadsheet-v3/`.
Upload: `gridforge-spreadsheet-v3.zip` in this folder.

SHA-256: `b51cc01f509000a7cda63b65b17e91710d0f81a2824a06e919d8bb5db4e2c082`

This is a separate task fork of the latest local v2 (2.0.12), not a replacement
or move of v2. The existing `projects/gridforge-spreadsheet-v2/`, its ZIPs and
historical submitted-run evidence were left untouched. The fork does not imply
that local v2 2.0.12 was itself submitted; the older submission evidence remains
in its original release folders.

Updated the task/package names, release markers, Docker labels, prompt markers,
and both references to the verifier-owned temporary runtime home. Otherwise the
32 task files retain the latest v2 behavior: golden fixes, fairness corrections,
44 criteria/weights, public agent and separate public verifier, and native
OpenAI Codex/gpt-5.6-luna/max configuration. Obsolete target-model metadata
remains absent.

Validation:

- 78 local rename/preservation/package checks passed. Every v2 source file was
  compared with its unchanged 2.0.12 ZIP, and every v3 file with the exact allowed
  name/version transformation. One v3 wrapper; all 32 archive files match source.
- Fresh v3 shell/JavaScript syntax and cached-image runtime smoke passed:
  startup under the renamed lifecycle home, seed formula, grid Enter navigation,
  autosave and a real process restart with full persisted-workbook equality in
  a fresh browser context. No page errors were observed in the initial context.
- No paid judge/model run or new exact Docker image build was performed.
  The full 2.0.11 browser suite is prior implementation evidence, not a new v3
  Oracle score. Platform QC and Oracle/model runs are still required for v3.

Remaining risks documented in `../gridforge-v2-2.0.11-validation/README.md`
still apply, particularly exact-build verification, platform public-network
policy, existing reward weighting and untested alternate identity branches.

Repackage with `python deliverables/gridforge/gridforge-v3-3.0.0-validation/check-package.py`.
