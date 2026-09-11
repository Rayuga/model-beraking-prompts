# GridForge 2.0.12 — metadata cleanup

Upload `gridforge-spreadsheet-v2.zip` from this folder.

SHA-256: `bbf5f52469afec0dd64d8b6819801d2755983df1e21f0931031c3564a6ec8d73`

Removed `active_target_model` and `active_target_reasoning_effort` from GridForge
task.toml. PatchPad retains both fields and was not changed. The old shared
packager no longer requires GridForge's target-model metadata; use this folder's
`check-package.py` for the current native-OpenAI release checks and packaging.

All 32 current task files were compared with the preserved 2.0.11 ZIP: the only
changes are those two removed metadata lines and consistent 2.0.12 version
markers. No golden behavior, verifier assertions, weights, Docker dependencies,
network settings, or judge settings changed. Both networks remain public;
the judge remains Codex / gpt-5.6-luna / max, using platform OPENAI_API_KEY.

59 structural/preservation/archive checks passed, including exact archive/source
comparison and a single gridforge-spreadsheet-v2/ wrapper. Git whitespace checks
passed. No paid runs or new browser/Docker runs were performed for this
metadata-only release. The unchanged implementation was locally tested in
2.0.11; its results are historical evidence, not a fresh platform score.

See ../gridforge-v2-2.0.11-validation/README.md for those tests and remaining
risks, including blocked exact Docker builds, public-network policy differences,
unchanged weighting concerns and the need for a fresh platform QC/Oracle run.
Historical ZIPs and reports remain unchanged.
