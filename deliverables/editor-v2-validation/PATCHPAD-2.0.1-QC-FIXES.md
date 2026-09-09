# PatchPad 2.0.1: rubric independence and network fixes

Upload `patchpad-editor-v2-2.0.1-task.zip`. This is local engineering
validation, not a new platform QC, Oracle, or model score.

The platform rubric review passed 52 of 53 checks. Its only rejected check
identified one Functional criterion that combined seed assertions, control
discovery, custom-surface input, and unsaved reload behavior. It also noted
that control discovery was already graded in Polish and unsaved discard was
repeated by the following persistence criterion.

Version 2.0.1 makes these corrections:

- `seed_document_integrity` checks only the coherent seeded-document invariant.
- `custom_editor_surface_real_input` checks the forbidden native surfaces and
  real typing path as one custom-editor behavior.
- `unsaved_edit_discard_on_reload` establishes and checks its own unchanged
  server baseline.
- `edit_save_reload_and_fresh_client` now checks only a saved edit and its
  server-backed appearance in a fresh client.
- Control discoverability is graded only by the existing Polish criterion.

The former combined criterion's 0.5 weight is divided as 0.25, 0.125, and
0.125. The saved/fresh-client criterion retains weight 0.5. Functional total
weight therefore remains 19.5; only the criterion count changes from 23 to 25.
No golden behavior changed.

The agent network mode is now public so Harbor can bootstrap OpenHands. The
verifier remains separate and allowlisted. Prompt and image release markers
are consistently updated to 2.0.1. The former statement that the build
workspace itself was offline is replaced with the accurate requirement that
the delivered app remain self-contained and use no runtime network assets.
