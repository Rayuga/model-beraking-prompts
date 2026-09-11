# PatchPad: explicit Visual browser prerequisite

Prepared 2026-09-11 after the uploaded task failed `check-rubric-prompt.py`
with "prompt.md: no global browser gate" (44 of 45 static checks passed).
Upload: `patchpad-editor-v2.zip`, version 1.0.0, 32 files.
SHA-256: `a21a709beee38a9dbcad78dbc5c53d7468a54f1367a0f9dc1b57f81f46a4ef13`.

The previous Visual prompt had a page-render/zero fallback but omitted the
explicit `Global browser gate:` heading and the same-origin, server-backed
loading prerequisite present in the other four dimensions. This is a concrete
gap and the likely source of the static finding. The screenshot did not name
the dimension, and the platform checker source is unavailable locally, so its
exact matching logic has not been reproduced.

Visual now requires a substantive editor, no fatal browser error, same-origin
runtime assets/requests and an observed server response supplying the report
shown by the UI. Any gate failure zeros every Visual criterion. This is a
browser prerequisite, not a new scored criterion or detailed persistence test.
Sign-in/password checks are explicitly inapplicable because PatchPad has no
authentication requirement; the screenshot's generic auth examples are not
a reason to add login. Root `task-implementation.toml` also states that auth
checks are conditional on the product requiring authentication.

Render and Constraints now say zero explicitly on a failed gate, removing stale
Likert-one boilerplate from their binary prompts. All criterion definitions,
weights, app files, seeds, runtime configuration and user-facing brief remain
unchanged. The unresolved Polish feedback clarification is not part of this fix.

Local preflight now checks all five prompts for an explicit browser-gate label,
fatal-error prerequisite, same-origin requirement and failed-gate zero wording.
108 structural checks, package CRC/content/hash verification and whitespace
checks passed. These are local checks, not the official 45-check platform result.
Upload this ZIP and rerun platform QC to confirm the static finding is resolved.
No new oracle or image build was run for this prompt change.

The preceding ZIP is preserved as `before-browser-gate.zip`. Use `package.py`
to rebuild this release. Previous release evidence and localhost preview remain.
