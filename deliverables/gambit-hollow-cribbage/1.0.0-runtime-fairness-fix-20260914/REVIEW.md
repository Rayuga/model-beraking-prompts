# Gambit: runtime and rubric fairness repair

The supplied platform screenshot records 45/45 static checks passed and 51/53 rubric checks passed. The two rubric failures identify real defects in the prior verifier. This package fixes their cited instances; a new platform verdict is still required.

## Runtime contract

Previously `tests/test.sh` launched `node /app/serve.js` while inheriting the verifier's `/tests` working directory. `tests/app-lifecycle.sh` repeated the problem on restart. This contradicts the ordinary documented start from the app folder. The golden app's absolute paths hid the defect in earlier golden-only tests.

Both launch sites now change directory inside the unprivileged child before `exec node`, preserving the managed PID/process group and leaving the judge in its own directory. The child's directory is `/app` for the normal runtime and `/tmp/gambit-submission` for the read-only fallback.

A separate diagnostic variant uses `express.static('www')` and `process.cwd()`; it is not included in the task ZIP. Against the old runner it reproduces the failure from `/tests`. Against the corrected runner it serves the page and script with HTTP 200 on initial launch and after two managed restarts, for both normal and read-only mounts. See `cwd-legacy-results.json`, `cwd-normal-results.json` and `cwd-readonly-results.json`.

## Criteria that exceeded the brief

| Check | Earlier requirement | Corrected requirement |
|---|---|---|
| Render: cards | Hearts and diamonds must be red; spades and clubs must not. | Recognisable cards with legible, distinguishable ranks and suit symbols. Monochrome and four-colour decks are explicitly allowed. |
| Visual: colour/contrast | Full-credit anchor referred to red/black suits. | Judge contrast and identifiable suit symbols with no prescribed suit palette. All original 0–5 anchors and weights remain. |
| Polish: no-game view | Explanatory text saying how to begin. | A usable, labelled New game control is enough. Explanatory prose is optional. The pending-save and repeated-action checks remain. |
| Functional: hidden cards | The response must also omit undealt stock. | Protect the opponent's unplayed hand and unrevealed crib contributions in every field. Undealt stock alone is not a failure. |

No new product requirements were added to justify the old checks. The golden app, supplied assets, task config, dimensions, criterion IDs/counts, criterion weights, dimension weights, timeouts and reward formula are unchanged. Four affected prompt revisions were incremented. Ten verifier files changed in total, including both process-launch sites.

## Validation and limits

- 361 archive checks and 124 reference-format checks pass for the new ZIP.
- The old runtime failure is reproduced, and the fixed normal/read-only cases pass with two restarts each.
- The final golden solution passes the 22 browser scenario groups, 11 unit groups and seven full-runner failure/weighting cases.
- Final prompt, judge and runner hashes match the tested archive. Archive contents match current task files; the wrapper, canonical asset layout and executable script permissions remain intact.
- The first diagnostic attempt could not read another UID's `/proc/<pid>/cwd`. The diagnostic now reads it as the app UID; the application and assertions were not weakened. Initial orchestration results are retained separately from the successful rerun evidence.
- Tests use the cached verifier runtime. There is no new paid Oracle result, complete fresh-image build, or claimed platform 53/53 verdict. Injected `LOCAL_STUB_ONLY` outputs test orchestration and are not judge scores.

Upload `gambit-hollow-cribbage.zip` from this directory. `final-summary.json` records its SHA-256.
