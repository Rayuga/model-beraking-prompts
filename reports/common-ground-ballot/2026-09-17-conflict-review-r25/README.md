# Common Ground Ballot r25

[Upload common-ground-ballot.zip](../../../deliverables/common-ground-ballot/2026-09-17-conflict-review-r25/common-ground-ballot.zip).

The package strengthens actual product behavior and repairs the two demonstrated
Oracle evidence gaps. It contains **five verifiers, 77 criteria, including 57
Functional criteria**. It does not add six separate judge processes.

## What the new outputs established

The r24 Oracle eSkNnNN scored 0.9521 overall, Functional 0.9202 and every other
dimension 1. Functional completed in 1929 seconds. Its two missing observations
were Owen's immediate pre-vote revision and the expired-session Retry response.
The trace confirms the latter capture only matched PATCH, while the golden
preflight uses GET /api/me and may return an explicit signed-out body with 200.
The UI correctly hid protected work and restored the reminder on real sign-in;
the judge had not captured the relevant authentication response.

The same version's GPT-5.4-mini pArUoq4 scored 0.7885. Gemini scored 0.7777,
Haiku 0.5542 and NOP 0. These are historical platform results, not r25 scores.
See [the audited results](latest-run-audit.json).

## Changes

- The Functional plan saves before/vote/after packets for each accepted-vote
  revision comparison. An accidentally missed pre-read may be replaced only by
  a fresh equivalent actor/method control, never by rerunning a demonstrated
  failure into a pass.
- Session-expiry recovery observes the whole actual Retry chain. A real identity
  preflight may stop the write. Signed-out identity bodies need an unchanged-
  credential denial of the observed protected read as corroborating evidence;
  no reference-specific endpoint or HTTP status is required of submissions.
- The brief and golden app now provide draft conflict review. The opened copy,
  attempted edit and latest record are compared. Disjoint/matching changes
  combine; conflicting title/context/voting-definition fields require explicit
  choices. Review does not write until confirmed. A concurrent later edit causes
  another refusal and re-review; discarding sends no write, and an opened ballot
  stops editing. Reviewed saves use fresh IDs/current viewed revisions; old
  refusal receipts remain intact after later changes and restart.
- Six added Functional outcomes have weights 3, 3, 3, 1.5, 1.5 and 2. Existing
  weights are unchanged. Functional total is 73.5; new outcomes contribute 14.
- Late successful or signed-out Retry replies must not contaminate another
  account's workspace. A new explicit abandoned-tab case closes the Retry owner
  while its response is held, then requires explicit recovery in the surviving
  tab without an automatic resend or permanent busy flag. This strengthens the
  existing cross-tab criterion without duplicating initial-submit persistence.

Eight task files changed. All other 21 files match r24, including the server,
starter, seed, Dockerfiles, runner and score policy. Render, Constraints, Polish
and Visual judge/prompt files are byte-identical. Standard task version, keys,
verifier.env, timeouts and 0.6 Functional + 0.2 Polish + 0.2 Visual formula remain.
Mandatory Render/Constraints gates still reject empty, read-only or fake apps.

## Validation and iterations

- **78 golden browser checks pass:** 7 review, 7 identity/revision/abandoned-tab,
  19 recovery-helper and 45 broad product regressions. These include real Node/
  SQLite restarts, role/privacy matrices, receipts, result math, mobile layout,
  both themes and shared authentication gates. Review and recovery tests use the
  actual pinned Playwright MCP and private helper.
- **Six deliberate defects detected:** losing the remote field, preselecting
  conflicts, saving against an unseen revision, nonfunctional discard, an enabled
  save after opening, and late old-account feedback. The unseen-revision mutant
  has a concrete erroneous HTTP 200 witness, not just a browser timeout.
- **Six previous-GPT replay checks completed.** The unchanged app loses its
  refused edit and has no review path, leaks a late “Draft created” message into
  Leila's session, loses unreadable/expired-session reminders, and strands a
  reminder as in flight after its Retry tab closes. Initial same-profile sharing
  actually works; the revised test relies on the real abandoned-owner defect.
  Only disposable copies were used; original run artifacts remain untouched.
- **30 final runner checks and 294 ZIP checks pass.** Actual RewardKit discovers
  five dimensions/77 criteria, real golden startup is unprivileged, restart keeps
  session/data, the genuine Codex binary is preserved, and composition works.
  Model verdicts in runner checks are explicitly offline doubles.
- The first new harness run needed its automation reference initialized before
  use. Browser iteration then exposed CSS overriding the locked save button's
  hidden attribute; the golden now uses its existing hidden class too. All later
  review runs pass, including narrow-screen overflow and a real restart. Failed
  diagnostic iterations are not counted as passes.

[53-point local rubric review](rubric-review.md),
[57-row public requirement coverage](coverage-matrix.md),
[mutation evidence](mutation-results.json),
[golden checks](browser-check-summary.json),
[previous GPT replay](gpt-replay/gpt-replay-results.json),
[archive validation](zip-validation.json).

## Score limits

There is **no new autonomous Oracle, platform QC verdict or newly built GPT run**
for r25. No local provider credential was available. The validated image reused
pinned cached dependencies; this was not a clean network dependency-download
build. Local scripted passes cannot guarantee that the autonomous judge will
complete every observation or that a model will fail the new requirements.

For the unchanged previous GPT app, retaining its other old verdicts and applying
the observed missing new outcomes gives approximately **0.6973**. This is
a [conditional projection](previous-gpt-projection.json), not a measured r25
score. Its margin below 0.7 is only 0.0027; a fresh implementation or
different presentation verdict can exceed 0.7. Do not claim the score target is
verified until the exact final ZIP completes a new platform run.

ZIP SHA-256: `ce08f8acb5d2bf7f26474675fb738155079a67ec5cb0fe7b425f0ae044b7f6b3`.
29 files, one common-ground-ballot wrapper, UTF-8/LF and executable shell modes.
