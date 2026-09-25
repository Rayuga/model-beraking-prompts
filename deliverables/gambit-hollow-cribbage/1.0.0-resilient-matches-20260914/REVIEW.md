# Gambit: complete matches and reliable recovery

Candidate ZIP: [gambit-hollow-cribbage.zip](gambit-hollow-cribbage.zip).

SHA-256: `986a5cced0e5efd9dc90ef58400692eb8a9e6481f69614944fa7a8af8c594ae2`.

## What changed

The task now explicitly requires complete multi-hand practice matches, multiple independent saved games, restoration at different game phases, per-game revisions, durable action identities, and recovery after a saved response is lost. Requirements are in the supplied `club/recovery.md`, linked directly by instruction.md and the club README. The environment and verifier both receive identical copies of every asset.

The golden server commits game state, ladder updates and accepted-request receipts in one SQLite transaction. New actions require the revision the client saw; missing/invalid/stale revisions refuse unchanged. Exact accepted retries return their original acceptance before checking the current game revision or terminal phase. Reusing an accepted identity with different input/target/action refuses. Independently created games with identical settings remain distinct.

The golden browser retains unconfirmed requests across reload, offers Retry save, and resends their original identity, input and revision. It reads current game state after confirmation so an old acceptance does not roll the display back over a newer move. Creation controls visibly disable during saving. Stale actions explain the conflict and refresh the table without silently applying the old move.

The complete-match practice cycles five fixed rounds, alternating dealer while preserving member/seat identities. With the documented moves it completes seven hands from 0/0, ending 121/95 at the final crib. Additional single-hand practices cover an exhausted opponent, consecutive plays by the remaining player, and 31 on the final card. Expected totals/checkpoints were calculated independently using Python combinations and a separate pegging simulation, then compared against actual browser play.

Mobile peg tracks use a compact four-row layout per seat with larger labels and more legible holes. Visual anchors remain unchanged. The pending-save judge must establish that the first request is actually pending before treating repeated activation as a duplicate-save test.

## Fairness corrections retained

- Cutting/showing can be automatic or use a supplied control; ordering and outcomes are graded.
- A final pegging count may remain visible during the show. Actual resets when play continues remain required.
- Seed history may be exposed on its documented history route instead of the playable-game chooser.
- The runtime check no longer demands incidental DB_PATH wording in the manifest. The newly required revision/identity/history documentation is explicitly in the brief.
- Exact accepted retries and genuinely new invalid actions have separate expected outcomes. New invalid probes carry fresh identities/current revisions unless their criterion deliberately tests stale/missing metadata.
- All dimensions retain the same minimal browser gate and independent per-criterion grading. New recovery failures do not automatically zero unrelated functional criteria.

## Rubric changes

The package contains 55 product criteria: Render 2, Constraints 2, Functional 40, Polish 5, Visual 6. Functional has 48 total criterion-weight units. All existing criterion IDs/types/weights remain; ten new functional criteria have weights 1 or 2:

| New criterion | Weight | Requirement tested |
|---|---:|---|
| complete_club_match | 2 | Full seven-hand match, carried scores and terminal ladder update |
| one_player_exhausted_pegging | 1 | Remaining-player turns, go and last-card handling |
| last_card_thirty_one | 1 | Pair plus 31 on the final card, with no extra go bonus |
| independent_saved_games | 1 | Interleaved games involving the same members |
| stale_tabs_and_revisions | 2 | Stale-page rejection, refreshed UI and revision rules |
| durable_creation_identity | 2 | Retried creation versus independently created games |
| accepted_action_replay | 2 | Exact retries after newer moves and after a win |
| accepted_identifier_binding | 1 | Different input/target/action cannot reuse an accepted identity |
| lost_response_retry_ui | 2 | Real server commit, dropped response, reload and safe retry |
| recovery_phase_matrix | 2 | Six saved game states, process restart and durable receipts |

Prompt revisions: Render r5, Constraints r4, Functional r6, Polish r6, Visual r5. Their hashes are recorded in source-sha256.json and the final runner provenance. Functional has the unchanged 9000-second timeout and an explicit workload plan totaling 9000 seconds. Actual paid-judge duration on the expanded rubric is not yet measured.

## Validation on the frozen candidate

The final container used files extracted from the exact ZIP above. The test script verified the solution and verifier file hashes against the package manifest after running.

| Check | Result |
|---|---|
| Actual ZIP structure/assets/paths/permissions/markers | 401 local checks passed |
| Reference config/key/env/weights/timeouts | 134 local checks passed |
| Unit groups | 11 passed, including all 40 hand fixtures in all 24 input orders |
| Existing browser groups | 22 passed |
| Added browser/recovery groups | 9 passed |
| Runner failures, malformed scores, gates and weighted formula | 7 passed |
| Full club match | All move/show checkpoints passed; final 121/95 |
| Lost committed responses | Discard and creation recovered after reload without duplicates |
| Stale second page | Legal-but-stale action refused; refreshed resubmission succeeded |
| Process restart | Both seat views at six game states restored; original create/win receipts replayed safely |
| Mobile rendering | Inspected; compact board labels and controls fit 375px width |

Files: [unit-results.json](unit-results.json), [browser-results.json](browser-results.json), [resilience-results.json](resilience-results.json), [negative-runner-results.json](negative-runner-results.json), [archive-checks.json](archive-checks.json), [standard-checks.json](standard-checks.json), [source-sha256.json](source-sha256.json), [reference-checkpoints.json](reference-checkpoints.json), [coverage.md](coverage.md).

The supplied cached image `brickfall-preflight-verifier:2.0.4` ran the deterministic checks. A fresh build of tests/Dockerfile failed while reaching PyPI: repeated read timeouts preceded pip's inability to resolve the pinned package. The environment build stalled reaching Debian mirrors and was cancelled. Both Dockerfiles are byte-identical to the preceding candidate. These failed network builds are recorded in environment-build.log and verifier-build.log; successful fresh image builds are **not** claimed.

Development attempts are retained separately. The first restart-matrix harness attempt clicked before state load; the second used same-document hash navigation as though it were a fresh document. The harness now explicitly loads a fresh document and waits for the intended game before acting. Both failures are recorded in resilience-attempt-1.json and resilience-attempt-2.json. The final run passed on the frozen candidate.

## Manual lead checklist

Task key paths, operational values, timeout values, version 1.0.0 and verifier.env match the canonical standard. Dockerfiles/test.sh contain no API-key mentions. Reasoning effort remains max. All five verifier folders and judge.toml files exist. There are no judge/model override keys and no authored code/config comments. Shebangs, Markdown headings, CSS selectors and colour literals remain. Both dimension weights and the final gate-first 60/20/20 formula remain unchanged. The ZIP has one task-named wrapper, 39 files, canonical environment/assets paths, and executable shell metadata. Reports and test harnesses are outside the upload package.

## Outstanding external verification

No new platform rubric, Oracle or model score is available for this candidate. There is no configured judge API key in this authoring environment. Local outputs marked `LOCAL_STUB_ONLY` contain injected dimensions solely to exercise the runner; they are not judge scores or platform approval.

The previous candidate's Oracle .9517 / GPT .795 / Gemini .7504 remain historical. The expanded task is designed to test more substantive behavior, but Oracle = 1 and GPT approximately .4 are unverified targets. Do not present a projected score or the deterministic test results as an actual regrade. Run platform QC, Oracle/NOP and new model trials against this exact ZIP.
