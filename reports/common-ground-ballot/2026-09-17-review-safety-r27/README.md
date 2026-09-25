# Common Ground Ballot r27 recheck

[Download the replacement ZIP](../../../deliverables/common-ground-ballot/2026-09-17-review-safety-r27/common-ground-ballot.zip).

The recheck found a real golden-client race and two gaps in round evidence.
They are fixed. **101 golden browser checks, eight deliberate round defects,
30 runner checks and 294 ZIP checks pass.** This is local validation;
no fresh autonomous Oracle, target-model or platform rubric score is available.

## Findings and repairs

The exact previously delivered r26 ZIP was extracted and its SHA-256 and every
file checked against its manifest. All 96 existing browser checks passed again,
including the core workflow followed by rounds on the same mutated database.
An additional held-response test then found three failures: changing a conflict
choice could re-enable Save during a reviewed save, Discard remained available
after that action had been sent, and a late accepted reply closed a newer form.

The golden now guards the whole in-flight review and disables its choice, Save
and Discard controls. A response only resets or closes the review that sent it;
it leaves newer work intact. The four-check race regression now passes, together
with the existing seven draft-review checks. The frozen failing r26 evidence is
preserved in [the independent recheck](../2026-09-17-r26-independent-recheck/review-race/review-race-results.json).

The public brief already requires checking every reviewed Member revision,
including paused Members. The old rubric checked an active-set change and an
active Member's change-and-return, leaving a loophole for validating only active
Members. It now also exercises paused -> active -> paused before confirming the
old review. The second gap was receipt identity: changed target and ballot
revision were tested, but a changed roster revision was not. It is now probed
separately under the original operation ID. Deliberately skipping inactive
revisions or excluding the roster from the receipt fingerprint fails the new
checks. The existing golden server passes both without changes.

Round persistence now replays four original refusals: one draft conflict and
three roster conflicts, before and after restart. These remain distinct from
the three ordinary domain refusals in the existing execution plan.

## Validation evidence

| Local check | Result |
| --- | --- |
| Core browser workflows, then rounds on the same database | 45 + 19 pass |
| Draft review | 7 pass |
| Held reviewed-save response and newer form | 4 pass |
| Vote revision evidence, expired session, late account replies, closed Retry owner | 7 pass |
| Actual pinned MCP helper and six action-family recovery | 19 pass |
| Deliberately broken round implementations | 8 of 8 detected |
| Runner, discovery, helper/provenance and score composition | 30 pass |
| Final ZIP paths, contracts, encodings, permissions and byte equality | 294 pass |

The integrated workflow took 144 seconds, helper suite 117 seconds and identity
suite 42 seconds. These are scripted regression durations, not predictions of
autonomous LLM judging time. A browser check can contain multiple assertions;
101 checks does not mean 101 scoring criteria.

All eight round mutations fail on a concrete outcome: partial commit, ignored
change-and-return, order-sensitive receipts, recomputed refusals, role bypass,
Retry using newer revisions, active-only Member revisions, and omitted roster
receipt identity. The reference completes the same sequences. Mutations run in
disposable copies; the source and final archive contain none of them.

The [53-point local rubric review](rubric-review.md) and
[66-row public requirement map](coverage-matrix.md) reconcile the current
criteria with the brief. They are author reviews, not a platform 53/53 result.
[Mutation observations](round-mutation-results.json),
[golden round checks](integrated/rounds-results.json),
[review race checks](review-race/review-race-results.json), and
[ZIP validation](zip-validation.json) retain the concrete evidence.

## Scope and limits

Only four of 29 task files differ from r26: the golden browser client,
Functional judge/prompt, and human README. No new public requirement, criterion
or weight was added. The instruction, server, starter, seed, installer, both
Dockerfiles, runner/private helpers, standard task settings, version, timeouts
and all four other verifiers are byte-identical. There remain **five verifier
dimensions, 86 criteria and 66 Functional criteria**, total Functional weight
103.5. The mandated gated 0.6/0.2/0.2 formula is unchanged.

No provider credential was available locally. Runner score tests use explicit
offline verdict doubles; browser tests use real Node, SQLite and the pinned
Playwright MCP. The final verifier source was built over cached dependency
layers, not downloaded in a fresh clean build. Oracle 1, platform rubric
acceptance and GPT <=0.6 still need measurements from this exact uploaded ZIP.

The latest supplied measured scores remain r24: Oracle 0.9521 and GPT-5.4-mini
0.7885. The unchanged previous GPT app's conditional projection remains 0.5849,
assuming all old verdicts repeat and it fails the added review/round work. It is
not a fresh model score. This recheck does not lower scores by changing weights.

The main remaining execution risk is evidence collection by the autonomous
Functional judge across 66 criteria. Its 7200-second budget and the 20-minute
persistence reserve are unchanged; the latest older Functional run took 1929
seconds. Local passing tests cannot guarantee that the autonomous judge gathers
every required observation or assigns full subjective visual marks.

ZIP SHA-256: `76b8cceb5eb22b2a48df6d53d58f647814516722b4beed6e8f7d7fef625cc578`.
29 files; 118938 bytes; one common-ground-ballot wrapper; UTF-8/LF;
executable shell modes. The r26 archive is unchanged.
