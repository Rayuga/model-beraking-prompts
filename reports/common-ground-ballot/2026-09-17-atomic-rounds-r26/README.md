# Common Ground Ballot r26

[Download the upload ZIP](../../../deliverables/common-ground-ballot/2026-09-17-atomic-rounds-r26/common-ground-ballot.zip).

The target is now **GPT 0.6 or below**. Against the unchanged previously supplied
GPT-5.4-mini app, retaining its other historical verdicts, the conditional
projection is **0.5849**. This is not a new scored model run.
Oracle 1 and platform rubric acceptance still require fresh runs of this ZIP.

## What changed

Ruth can select two or more drafts, review their definitions and eligible Members,
and confirm one round. One SQLite transaction either opens every selected draft
against the reviewed draft/roster revisions or refuses the whole action. Each
opened ballot gets one revision advance, the same eligibility snapshot and its
ordinary Open audit event. Unselected drafts remain unchanged.

Draft edits/openings and roster changes invalidate a preview, including pausing
and reactivating someone. The UI requires another explicit review and fresh
confirmation. Input validation and all non-Coordinator role checks run on the
server. Exact receipts use canonical target/roster sets and the existing user-wide
operation namespace; original refusals remain after later successful rounds.
One pending entry retains the entire round before sending. Explicit Retry
survives reload/sign-in/restart and displays current Closed/Open records rather
than applying an old Open receipt over newer state.
The association name also remains visible in the mobile signed-in header; an
older CSS rule had hidden it at narrow widths.

Nine new Functional owners add weight 30: review/cancel3; atomic opening4;
draft conflict4; roster conflict4; input validation2; permission1; success receipt4;
refusal receipts4; browser recovery4. Existing weights are unchanged. The new
workflows account for 30/103.5 of Functional, or 17.39% of total possible reward.
Their complexity follows the existing weight4 recovery precedent. The minimum
working-product gates and mandated 0.6 Functional + 0.2 Polish + 0.2 Visual
formula remain unchanged.

There are **five verifier processes, 86 criteria, 66 Functional criteria**.
Render, Constraints, Polish and Visual definitions/prompts are byte-identical to
r25/r24. Both Dockerfiles, runner, helpers, seed, starter, installer, operational
task keys, verifier.env, version1.0.0 and timeouts are unchanged. Only nine of the
29 task files changed. See [the exact change review](change-review.json).

## Validation

- **96 golden browser checks pass:** 18 round checks, 7 draft review, 7 identity,
  19 recovery-helper and 45 broader product checks. Round coverage includes 16
  malformed packets, three non-Coordinator probes, mixed voting methods, whole
  roster change-and-return, no active Members, later-target atomicity, canonical
  receipts, Create-to-round namespace collisions and real process restart.
- The round recovery test reloads while the initial accepted reply is still
  held: the reminder already exists, confirmation is disabled and no automatic
  resend occurs. After later close/membership changes and restart, visible Retry
  sends the unchanged original packet and refreshes current records.
- **Six deliberate round defects detected:** partial commit before a later
  refusal; roster checks that ignore change-and-return; order-sensitive receipt
  fingerprints; recomputed refusals; bypassed round permissions; and Retry
  replacing viewed revisions with newer ones. Each has a concrete captured
  status/state/body mismatch, not a missing-evidence pass.
- **Seven replay checks** on a disposable fresh-state copy of the previous GPT
  app confirm its missing draft review/round workflow and the earlier recovery
  defects. Its original submitted artifacts were never edited. Initial shared
  pending visibility actually works; the genuine defect is abandoned Retry
  ownership remaining permanently busy.
- **30 runner checks and 294 ZIP checks pass.** Real RewardKit discovers five
  dimensions/86 criteria, genuine Codex remains intact, golden startup/restart
  runs unprivileged, private helpers stay outside the app, and scoring/provenance
  contracts hold. Runner model verdicts are explicitly offline test doubles.

[Round checks](rounds/rounds-results.json), [mutation witnesses](round-mutation-results.json),
[previous GPT replay](gpt-replay/gpt-replay-results.json),
[66-row requirement coverage](coverage-matrix.md),
[53-point local author review](rubric-review.md),
[archive validation](zip-validation.json).

The first browser iteration found a real missing round route in the client's
pending-request allowlist; it was fixed before the final passing runs. Later
diagnostic iterations fixed harness timing around preview refresh and a helper
variable-name collision. Failed iterations are preserved separately and are not
counted as passes. The final local test also expands both revision-type locations
and the round namespace collision. Mobile screenshots are captured only after
the asynchronously loaded round dialog becomes visibly open; this also corrected
an earlier geometry check that could have measured a closed dialog.

## Score and runtime limits

The latest supplied platform results still belong to **r24**: Oracle0.9521,
GPT-5.4-mini0.7885, Gemini0.7777, Haiku0.5542 and NOP0. r25 repaired the two Oracle
evidence gaps and added draft review; r26 retains those repairs and adds rounds.
No fresh scored Oracle, newly built GPT submission or platform QC result exists
for r26. No provider credential was available locally. Cached pinned Docker
dependencies were reused, rather than a clean external download build.

The 0.5849 projection assumes the old GPT keeps 47.5 Functional
points out of the new 103.5, Polish10/14 and Visual5/6. A fresh implementation can
implement the new work, and presentation/judge variation can move the score.
Do not report the target or Oracle1 as verified until the final uploaded version
is measured. The old Functional run took 1929s; its unchanged budget is7200s.
The new plan reuses four pairs and one outsider, bounded request tables and the
same single final restart, reserving20minutes for persistence/verdicts. Full
autonomous r26 duration and the agent's two-hour build budget remain unmeasured.

ZIP SHA-256: `232fe14216cfad2b1f5168866573654b2707992ae44aefb7581b684bdf7a299a`.
29 files; 118354 bytes; one common-ground-ballot wrapper; UTF-8/LF;
executable shell modes. Historical release ZIPs remain unchanged.
