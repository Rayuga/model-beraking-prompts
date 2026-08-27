# DropLine follow-up context

This file is not part of the current task instructions or scoring contract. It
records possible follow-up work and project-design context. A future feature
must not become graded until it is added to the human-facing instructions, the
golden solution, and a deterministic verifier together.

## Possible future work

- Add a computer opponent with deterministic difficulty levels.
- Add online multiplayer, live presence, and reconnect behavior.
- Let players choose names while retaining clear token identities.
- Add best-of-three matches and tournament formats.
- Add optional themes, sound, and additional animations.
- Add match replay and shareable results.
- Add a game archive and longer-term statistics.
- Add touch and mobile gesture controls.

## Task-design context

- DropLine is intentionally easier than GridForge and PatchPad and is initially
  intended for GPT-5.4-mini.
- Requirements should be concise, natural, and human-written rather than an
  exposed test script.
- Every verifier must still have defensible coverage in the task instructions.
- Verifiers must use real visible interactions and deterministic state. Avoid
  hidden routes, synthetic events, DOM mutation, and timing-sensitive checks.
- The golden solution must pass the full rubric deterministically before a
  target-model run.
- GPT-5.6-luna is the planned browser judge; Sonnet should not be used as a
  silent fallback.
- Planning documents and this context file remain outside the Harbor upload ZIP.

The later Docketlight-style feature and verifier specification will be created
on another development PC as `DropLine_Feature_Verifier_Spec.md` and
`DropLine_Feature_Verifier_Spec.docx` beside this file.
