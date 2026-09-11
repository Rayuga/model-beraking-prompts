# PatchPad: Oracle evidence reliability

Upload: [patchpad-editor-v2.zip](patchpad-editor-v2.zip), version 1.0.0, 32 files.

Reviewed all supplied runs: Oracle 0.8877, Gemini 0.5678, GPT-5.4 mini 0.5291,
Haiku 0.3033, no-op 0. The Oracle app exactly matches the current golden app.
The three failed Oracle Functional checks all pass in fresh local browser
reproductions. Original judge output identifies evidence loss, a gutter-start
restriction and wrong second-line clipboard setup. Full native judge action
transcripts were not included in the export.

Updated three Functional descriptions and shared procedural guidance:
immediate plain-text checkpoints, explicit target/focus checks, supported
gutter selection anchors, dialog handling and a single complete retry of a
demonstrably invalid unsaved-only judge attempt. Correctly observed app failures
remain failures; the retry cannot apply to saved writes, API probes or restarts.

All verdict types, criterion and judge weights, required editing operations,
39 criteria, golden app, brief, Visual scope and final gated 60/20/20 formula
are preserved. Other earlier deferred findings remain deferred. The Visual
score-floor issue is recorded, not silently changed.

- [All runs and complete criterion evidence](RUN_REVIEW.md)
- [Exact verifier wording before and after](VERIFIER_BEFORE_AFTER.md)
- [Local browser reproduction results](oracle-three-results.json)
- [Persisted transient checkpoints](oracle-checkpoints.json)
- [Package audit and final SHA-256](package-audit.json)

Validation: three targeted real-browser checks passed against the unchanged
golden app in a fresh, offline, disposable container using the cached verifier
image; 108 structural checks, TOML parsing, exact scope/preservation checks,
and ZIP CRC/content checks passed. Local diagnostic scripts use golden-specific
selectors and are excluded from the task ZIP. They are not a substitute for
running the natural-language judge on the platform.

No fresh full Oracle pass is claimed. The configured OpenAI credential is not
available locally. If the three Functional checks pass in the next Oracle and
all other dimension scores stay unchanged, the final arithmetic would be
0.96; that is an estimate, not an observed run or acceptance guarantee.
