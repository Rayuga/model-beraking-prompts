# DropLine r6: duplicate-check removal and shared browser journeys

Release date: 2026-09-14. Task name `dropline-four-connect`; task version remains
`1.0.0`. This is a new release, not validation of the previous platform run.

Upload `dropline-four-connect.zip` from this directory.

SHA-256: `577451c9d67ef834db1c8366af284b323233ad4f7abc20e396c23c562dd1d63a`

The archive contains 39 files under exactly one `dropline-four-connect/` wrapper.
Every archived file was compared with the current source SHA-256. Shell files
have LF endings, regular Unix file metadata and executable permissions. No
databases, installed modules, credentials, caches or authoring reports are inside.
Both network settings remain public. Task configuration, both Dockerfiles,
runner, lifecycle helper, reward formula, instructions, seed and entire golden
solution are byte-identical to r5. Only Render/Functional judges and prompts changed.

## Removed criteria and surviving coverage

Two duplicate criteria were removed; no product requirement was removed.

| Removed criterion | Previously graded observation | Surviving coverage |
| --- | --- | --- |
| Render `basic_control_and_game_surface` | Valid login; identity, board, status, totals, history and controls render | Every global browser gate requires successful authentication and a substantive working server-backed game. Constraints `required_server_backed_workspace` explicitly requires all these surfaces. |
| Functional `authenticated_account_workflow` | Visible account name/email | `seeded_state_import_and_isolation` now explicitly checks Avery Morgan and the email during its existing initial sign-in. |
| Same Functional criterion | Protected data disappears after logout | `cross_tab_sign_out_revocation` now explicitly checks tab A's board/totals disappear during its existing sign-out, as well as tab B revocation. |
| Same Functional criterion | Wrong password rejected without protected state | The unchanged global browser gate tests signed-out protection and wrong-password rejection before valid login. |
| Same Functional criterion | Server-issued bearer-backed reads and account isolation | The unchanged gate requires server-issued bearer evidence; seed/account switching and cross-tab revocation retain independent state checks. |
| Same Functional criterion | Persisted move/history/turn survive sign-out and later login | Seed test returns to Avery's exact revision-9 post-Undo state; cross-tab logout/re-login compares the captured current board, history, totals, archive and revision. Move/history/gravity checks still verify exact placements separately. |

The deleted one-piece column-3 login scenario is redundant setup, not an explicit
product feature. We did not delete a unique manifest, accessibility, nested-tree,
receipt, ownership, persistence or tactical check to reduce the criterion count.

Current counts: Render 1, Constraints 2, Functional 42, Polish 7, Visual 6 (58 total).
Every surviving criterion keeps its ID, type and weight. The Functional weight
sum changes from 66.5 to 65.5 because the duplicate weight-1 criterion is gone;
normalization therefore changes. No removed weight was assigned to a difficult
criterion to force a lower model score. Final dimension weights and gate formula
remain unchanged. Historical model scores are not scores of this new package.

## Reduced execution work without combined scoring

- One Red-horizontal win now supplies five independent verdicts: archive/replay,
  terminal history, horizontal-win detection, accessible winning cell names and
  post-win reset. Empty-board names are captured before play; winning names before
  Undo; reset revision immediately before New game. Column-7 persistence and both
  vertical wins still execute after the shared journey. This removes three repeated
  seven-move wins (21 moves), not the required observed outcomes.
- One analysis now supplies sibling navigation, nested continuations and comparison.
  Root children A=[4] and B=[5] are retained; C=[5,1] and D=[5,2] are then added.
  All five nodes remain after rename/reload, and A/C comparison uses that same tree.
  This removes two extra study creations and four repeated practice drops.
- Previous shared transplant and tactical journeys remain. The complete 2801-node
  proof traversal, both visible sample paths, two real restarts, replay receipts,
  illegal-input matrices and pending-operation observations remain.
- Each criterion retains its separate evidence and verdict. Shared setup failure
  cannot automatically fail unrelated later behavior; normal UI setup is attempted
  where possible, without synthesizing state or retrying away an observed failure.

## Fresh unpaid validation

- 137 standard checks passed (`standard-check.json`).
- 400 checks against the actual ZIP passed (`upload-check.json`).
- All 49 existing API/real-browser regression groups passed on the current golden
  source, including the existing two process restarts, analysis persistence and
  receipts, server rejections and bounded tactical behavior (`regressions.json`).
- Four real-browser shared journeys passed, including the expanded five-verdict
  competitive journey and the new five-node branch/comparison journey
  (`shared-journeys.json`). These use known golden selectors; their execution time
  is not an estimate of an LLM judge's runtime.
- The prior Oracle-related pointer-down-while-pending/pointer-up-after-response
  regression passed: one request, one new node, one revision (`pointer-boundary.json`).
- Authored JavaScript, embedded browser JavaScript and shell syntax passed through
  `local-setup.sh`. The real `tests/test.sh` startup/lifecycle/postprocessor executed
  with an unpaid local RewardKit stand-in. Its synthetic reward 0.58 and five-dimension
  CTRF assertion passed; 0.58 is not an Oracle or model score.
- Frozen runner provenance matches every final prompt/judge, runner and reward hash
  (`runner-logs/prompt-provenance.json`, checked by `verify-and-package.py`).

Local runtime used cached `dropline-verifier-local:v6.0.3` in a new disposable
container with no network and read-only task-source mount. Initially this cached
image lacked `/usr/local/bin/chromium`; the first local harness run failed before
browser testing (`attempt-1-missing-browser.log`). A local symlink to its installed
Chromium corrected the adapter, followed by the successful runs. No task Dockerfile
was modified. Both exact image builds were NOT repeated for this prompt-only release.
The prior exact-build networking failures are historical evidence, not a current
successful build. No paid Oracle/model or platform QC run was launched.

## Remaining release risks

The platform's `timeouts_fit_the_work` judgment is not proven resolved. Budgets
remain the required template values: agent 7200; Render/Constraints 600 each,
Functional 9000, Polish/Visual 900 each; serial sum 12000 inside wrapper 12600 and
outer verifier 13200. This release reduces actual repeated setup but still has
42 Functional criteria and the same substantial product scope. Do not claim a
guaranteed QC pass or Oracle 1.0. If QC rejects the budget again, obtain a lead
decision on measured timing evidence or a coherent timeout exception; deleting
further unique checks would risk missing requirement coverage.

Prior r5 golden repairs are preserved byte-for-byte and their pointer-boundary
regression passed again. Historical r4 Oracle 0.9819 is not current validation.
Previously incomplete GPT evidence remains a limitation on interpreting that old
score; the retained execution ledger asks judges to identify unverified checks,
but cannot guarantee complete execution. New model scores may move either way.

Historical delivery folders and ZIPs were left unchanged. No commit or push was made.
