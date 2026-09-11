# GridForge 2.0.11 — OpenAI alignment and golden/fairness repairs

Editable source: `projects/gridforge-spreadsheet-v2/`.
Upload only `gridforge-spreadsheet-v2.zip`, not this evidence folder.

ZIP SHA-256: `c2041896f3545e54c3916c4166840565ff8325a0e78e0013ea1a1e78170ee2ec`

The archive has exactly 32 files beneath one `gridforge-spreadsheet-v2/`
wrapper, with byte-for-byte source comparisons. It excludes validation scripts,
reports, credentials, databases, node_modules and caches. Historical releases,
final deliverables and model exports were not changed.

## Lead settings applied

```toml
[verifier.env]
OPENAI_API_KEY = "${OPENAI_API_KEY}"
REWARDKIT_JUDGE = "codex"
REWARDKIT_MODEL = "gpt-5.6-luna"
REWARDKIT_REASONING_EFFORT = "max"
```

All four judges use the same unprefixed model and max effort. Agent networking
and the separate verifier's networking are public. There is no OpenRouter key,
provider alias, custom base URL, or runner-side login setup. The old
`active_target_model` metadata describes the target agent, not judge routing;
it was intentionally not changed to the judge model.

The shared reference is already kept at
`references/task-templates/patchpad-openai-2026-09-11/` (including the original
paste). It was not rewritten. GridForge follows its Node/Python verifier stages,
pinned Codex/Playwright/RewardKit, minimal noninteractive Codex config and exact
RewardKit launcher patch. The agent gains its git/procps/sqlite3, global Node
dependencies and initialized workspace. Deliberate task-specific differences:

- Preserve `/opt/gridforge-deps` / Express 5.2.1 in both images.
- Preserve certificate/curl/coreutils bootstrap fixes, asset paths and digests.
- Keep browser/tool build assertions and GridForge seed staging.
- Keep the existing task name, artifacts, metadata, all 44 criteria and weights.
- Keep 1,800s build + 7,200s agent + 12,600s verifier = 21,600s total.
  Judge ceilings total 10,550s inside the 12,000s wrapper, leaving 1,450s there
  plus 600s outside for startup/cleanup. No timeout was reduced.

The [official model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
lists `max`. A loopback-only smoke exercised the exact Docker config and
RewardKit patch with pinned cached tools and a synthetic key. It captured
authenticated `/v1/responses` requests for `gpt-5.6-luna` with `max` reasoning.
No real model request, completion, platform credential or score was involved.
This proves local request wiring, not platform account/model access.

## Golden changes

1. `keyboard_edit_delete_undo`: before the fix, grid typing entered the formula
   input and Enter left F3 selected instead of F4; Shift+Tab left G3 instead of
   F3. The fresh baseline reproduction confirms both. Grid-started edits now
   commit and use the existing cell-navigation path. Direct formula-toolbar
   Tab still leaves the control normally.
2. Fresh regression uncovered an asynchronous render race: a completed save
   could replace a focused name-box destination/range or formula-toolbar draft
   before the next key/action. Background rendering now preserves focused text;
   explicit cell selection still updates it. Delayed-response browser tests
   cover both controls. This is an app fix, not a wait added to hide the bug.

The previous Oracle's reverse-drag failure was not reproduced with valid
visible endpoint coordinates. The complete Shift+Click, reverse drag,
nine-cell Delete/Undo and outside-control sequence now passes locally. No
range-selection algorithm was changed. The verifier explains fresh coordinate
hit-testing and clipboard completion; it still requires the exact mouse gesture
and all original outcomes. A genuine wrong selection remains a failure.

## Verifier fairness changes

Only three criterion descriptions changed; their IDs, types and weights did not:

- `find_replace_navigation_and_atomic_replace_all`: accept immediate query
  selection or selection on first Next. Observe the starting match, prove the
  complete ordered three-match cycle, explicitly navigate to J50, then retain
  the same exact Replace Current/All and atomic Undo/Redo assertions.
- `stale_save_and_workbook_identity_rejections`: do not invent a redundant
  top-level body id when the URL identifies the target. If that extra field is
  absent, test missing snapshot identity instead. Complete snapshots must still
  identify their workbook. Stale, unknown and contradictory identities still
  require 4xx and unchanged complete workbook/history, with four evidence rows.
- `api_session_user_mismatch_rejected`: use the actual observed session and
  claim mechanism. When there is a separate claim, retain all four original
  rejection probes. When identity is session-derived, require correct attribution
  for two real user/session saves plus rejection of missing and unknown actual
  session credentials. This branch is not automatic credit or exemption from
  session enforcement.

The instruction notes now explicitly permit those implementation choices and
describe cell-mode Enter/Tab navigation. The functional prompt also requires
the full five-second autosave window, accurate cell targets, completed clipboard
setup, and honest reporting of unexecuted checks. Polish distinguishes legitimate
cell-mode Tab navigation from a real keyboard trap and tests an actual exit.

## Tests actually completed

`local-validation.json`: **passed** on fresh current source, using cached
`gridforge-v2-tests` tooling with Docker networking disabled for the local
test. This does not change the public settings in the upload.

- Shell syntax for all task shell scripts; Node syntax for all golden JS files.
- Real RewardKit discovery: 2 Render, 2 Constraints, 36 Functional, 4 Polish.
- Empty-submission runner: reward 0, graded 0, no_op 1; no judge invocation.
- 30 real-browser regression groups passed (plus one recorded timing row):
  7 general smoke, 4 older Oracle regressions, 10 interaction groups,
  3 collaboration groups, and 6 focused repair groups. Every group is listed
  in the JSON; these are not 44 completed LLM criterion judgments.
- Exact keyboard commits and Delete/Undo controls; formula precedence,
  selected/caret/mouse/range reference insertion and suggestions; five functions;
  scalar/range errors and recovery; numerical and relative-formula fill/Undo.
- Shift-click and reverse drag with all nine values and outside controls.
- Nineteen malformed-save cases, four explicit-claim/session rejection cases,
  stale overlapping save and three workbook identity forgeries, with storage
  and revision readback.
- Live clean update, dirty non-overlap merge, same-cell conflict, three-view
  presence/selection and cleanup.
- Find cycling/Replace Current/All and Undo/Redo; autosave under five seconds;
  unchanged save; complete preview; restore as a draft, a 5.5-second nonmutation
  observation and one Undo; two real restarts preserving complete server-backed
  workbook/history and exactly one seeded workbook in fresh contexts.
- Deterministic delayed-save test preserves name-box and formula-input drafts.
- **58** local structural/preservation/package checks passed; SHA comparison
  covers every archive file. Native OpenAI loopback provider smoke passed.
- `git diff --check` on current GridForge task changes passed.

Earlier local failed attempts are retained separately. They include the golden
render race, a diagnostic drag with an occluded endpoint (corrected test setup),
and a restore assertion made before its async response (corrected observation
wait). The final complete suite passed after those fixes.

## Not tested / remaining risks

- **Exact new Docker builds did not pass locally.** The environment build hit
  the bounded 180-second attempt; the verifier apt step explicitly failed to
  resolve the configured corporate proxy `ioclrndwg1.ds.indianoil.in`. See
  `build-results.json` and both logs. No proxy/TLS/security settings were changed
  and no missing-package failure was silently accepted. Runtime regressions
  used a cached tool image, not these newly built images.
- No paid Oracle/model, platform QC or fresh 53-row rubric score was run.
  Do not report Oracle 1.0 or reuse 2.0.10 scores as current-package validation.
- The allowed immediate-Find and session-derived-identity alternatives were
  reviewed in the rubric, but this golden uses Next-to-select and an explicit
  claim. A live alternative implementation and full judge execution of those
  branches were not tested here.
- Original 60% Functional / 40% Polish weighting and binary bundles are retained.
  The custom-grid rule remains a low-weight Functional check (0.125/28), not
  a hard gate. This could still draw weighting/floor feedback: a wrong-surface
  implementation could earn substantial other credit. No weights or gate policy
  were silently changed as part of provider/bug/fairness repairs.
- The supplied older WebDev/DOCX wording asks for no-network/allowlist. Public
  networking follows the newer explicit lead/user instruction, not that literal
  older rule. Administrative policy alignment still needs the platform.
- Real-traffic provenance, original human voice preservation and empirical judge
  prompt-injection resistance are not established by these local tests. Do not
  fabricate evidence to mark those source-review rows passed.

The old Oracle was 0.9545 overall / 0.9241 Functional, with keyboard and reverse-
drag failures. The older GPT/Gemini/Haiku findings remain in the unchanged
2.0.10 post-run report. Their genuine failed behaviors and evidence limitations
were not relabelled as passes. Any comparison after these judge/provider and
fairness changes requires fresh runs on this exact ZIP.
