# Common Ground Ballot: Judge Checkpoint Correction

Upload [common-ground-ballot.zip](common-ground-ballot.zip). It contains one
`common-ground-ballot/` wrapper and 36 task files. Task version remains `1.0.0`.

## Changes

Only `tests/functional/prompt.md` changes from the rubric-r2 archive. Its prompt
version is now `common-ground-ballot-functional-v1.0.0-r5`. All 33 criterion
definitions, weights, product instructions, seed data, golden source, runtime,
networking and reward settings remain byte-identical. The coverage map and all
reports remain outside the task ZIP.

The judge now captures genuine action requests and responses before navigation,
keeps private evidence across tool calls/restarts, and records outcomes before
leaving Draft, Open or Closed. A stale edit is tested while editing is otherwise
valid. Eligibility, invalid choices and duplicate participation use current
revisions; exact retries retain the original payload. Each failure remains local
to its criterion, with missing evidence distinguished from a demonstrated defect.

## Validation

- Exact environment and verifier images built successfully under new tags.
- Runtime discovery finds all 33 criteria; shipped syntax, SQLite and isolation checks pass.
- The golden browser regression passes 13 groups, including two real app restarts,
  persistent request/receipt capture, all-role Closed checks, and desktop/mobile UI.
- Four disposable negative controls are detected: accepting stale edits, allowing
  Open edits, rejecting exact vote replay, and accepting Closed votes.
- Synthetic local harness tests pass. They test startup, readiness and reward
  composition, not LLM judgment.
- Local packaging checks verify the reference operational settings, five
  dimensions, weights, public networking, provider-key placement, prompt versions,
  root allowlist, external coverage, provenance and one-file release scope.

The earlier intermittent mobile measurement was addressed only in the external
regression: move the pointer away, await CSS animations, then measure stable layout
dimensions. No app styling or graded target was changed.

## Remaining Platform Work

No new paid model run, full Oracle or platform QC was executed. The previous
Oracle remains **0.8928**; its three missing-evidence failures motivated this
procedure correction. The new prompt still requires actual platform validation.
Local tests cannot guarantee that an LLM judge follows every step or scores 1.
The historical model exports and scores have not been altered.

Evidence: [before/after](before-after.json), [prompt diff](prompt-changes.diff),
[builds and local runs](validation.json), [golden](browser-results.json),
[negative controls](negative-control-results.json), [package audit](package-audit.json),
and [checksums](SHA256SUMS.txt).
