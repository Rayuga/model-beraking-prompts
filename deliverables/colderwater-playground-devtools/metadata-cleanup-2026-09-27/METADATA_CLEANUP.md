# Coldwater metadata cleanup

Current archive: [colderwater-playground-devtools.zip](colderwater-playground-devtools.zip), SHA-256 `09f4f6cb3647f7d8395a4367fa931c1fb2ac56713bc25df431bd10b6a8b88f7e` (50 files, 844239 bytes).

Only `task.toml` changed from the preserved `dc2ed5ac...` candidate in `../interaction-keyboard-fix-2026-09-27/`. Its description now summarizes the product in one sentence. The difficulty explanation describes the implementation challenges briefly. Provenance only identifies the supplied task as its source. Personal attribution, tracker details, QC history, rubric counts/weights and score commentary were removed from these fields, along with grading-related keywords.

Validation parsed both TOML versions and the current template, checked every required key, and confirmed that only description, keywords, difficulty_explanation and provenance changed. All other 49 task files match the previous manifest exactly. The new package passes public-prose guards, CRC, single-root/path checks, shell modes and complete extraction/source hash checks. No browser or image rebuild was necessary for metadata-only changes; previous behavioral evidence is reused for unchanged files and is not a fresh Oracle run.

The builder target remains `gpt-5.6-luna`, selected in platform/model-run configuration. The judge remains `z-ai/glm-5.3-flashx` via `claude-code`, set in `task.toml [verifier.env]`. Timeouts, environment settings, scoring and golden code are unchanged. Required provenance/difficulty fields are retained per the current template and onboarding reference set.

The previously documented unbounded final verifier cleanup is still pending in this candidate. This metadata edit does not repair that harness issue. The local preview at port 3420 runs the same unchanged golden app. No paid evaluation, upload, commit or push was performed.
