# GridForge and PatchPad v2 review

Date: 2026-09-07. This is local engineering evidence, not a platform QC result,
Oracle score, or model score. Reports and validation helpers are outside both
task upload ZIPs.

Update: GridForge 2.0.3 supersedes the older uploads. See
GRIDFORGE-2.0.3-GOLDEN-FIXES.md for the preview, keyboard and in-flight save
fixes. Local comparisons confirm that the previous rubric and instruction
contracts are unchanged. A new full platform Oracle/QC result is pending.

GridForge 2.0.2 superseded 2.0.1 and 2.0.0. See
GRIDFORGE-2.0.2-FIXES.md for the second platform round: split scoring,
restart/idempotence coverage, manifest documentation and prompt consistency.
GridForge 2.0.1 fixed the platform's
seeded-user entry, required-fill-button, and sequential Undo findings, accepts
equivalent numeric formatting, and removes the duplicated Constraints reload
criterion. See GRIDFORGE-2.0.1-FIXES.md for focused evidence. PatchPad remains
2.0.0. Older archive files are retained as historical versions, not recommended
uploads.

## Delivered format

| Task | Render | Constraints | Functional | Polish | Total scored |
| --- | ---: | ---: | ---: | ---: | ---: |
| gridforge-spreadsheet-v2 | 2 | 2 | 36 | 4 | 44 |
| patchpad-editor-v2 | 2 | 2 | 23 | 4 | 31 |

The current format has four RewardKit dimensions, plus an unscored runner
preflight as the fifth checking layer. There is no invented fifth scoring
dimension. Render checks loading and basic interaction; Constraints checks
local serving and the entry/reload contract. Detailed custom-surface, editing,
formula, concurrency, and persistence requirements remain in Functional.

Both tasks target GPT-5.4-mini (high) and configure the
GPT-5.6-luna Codex judge (high). Final reward is zero unless Render and
Constraints pass, otherwise 60% Functional + 40% Polish. The gate judge
weights are tiny positive schema values, but the runner assigns them no
final reward mass. The visual-hierarchy criterion uses a five-point Likert
scale; concrete behaviors remain binary.

The original non-v2 project folders were not changed. Pellmoor and Coursemark
are outside this change. No commits or pushes were made for this work.

## What changed

- Kept the split brief, moving its five topic files under
  environment/assets/instructions and mounting them at /instructions.
- Added current separate-verifier Dockerfiles, four judge directories,
  external prompt.md templates with the required criteria placeholder, and
  reward.toml. RewardKit 0.1.7 actually discovers these files successfully.
- Replaced the old custom Python/browser-rubric scoring path. There is no
  postprocessor that requires the judge to write an exact phrase such as
  "line 5 column 1"; exact behavioral outcomes are still checked.
- Added URL, untrusted-content defenses, basic server-data browser gates,
  independent-scoring wording, and state-order guidance to judge prompts.
  Polish also requires a visible edit to survive a fresh browser context
  with actual server save/read evidence, preventing a browser-storage-only
  mock from collecting the full 40% appearance allocation.
- Kept runtime dependencies available offline in both images. The runner
  accepts the instructed npm start contract instead of requiring the golden
  implementation's internal source/public filenames.
- Runs submission code with cleared environment and an unprivileged user;
  tests and scoring logs remain private. A fresh database is located from
  the explicitly required absolute manifest path, not an undisclosed path.
- Agent/build/verifier ceilings are 7200/1800/12600 seconds: six hours total.
  Judge ceilings total 10550 seconds, below the 12000-second wrapper and
  12600-second verifier ceiling.
- Clarified existing requirements where their old wording did not support
  exact tests: PatchPad typing/selection undo units and visible Unicode
  characters; GridForge live presence, cell history, formula interactions,
  autosave, and save validation. These are brief clarifications, not hidden
  expectations or new judge-only product features.
- Corrected the GridForge circular-reference test sequence so its unrelated
  cell edit precedes the cycle; one Undo now targets the cycle as intended.
  Removed a duplicated formula mouse-reference sub-check from its precedence
  criterion, leaving the dedicated reference tests intact.
- Removed reference history-list truncation that could make later exact
  revision-count tests fail after a long test journey. Added visible
  GridForge focus styling.
- Normalized task text to UTF-8 without BOM and LF; ZIP shell entries have
  executable mode metadata. Excluded generated dependencies, caches, ZIPs,
  reports, authoring notes, .gitignore, and .gitattributes from task archives.

## Evidence obtained

- Both agent images and both verifier images build successfully.
- Actual RewardKit discovery, both shell scripts' syntax, reference
  JavaScript syntax, and empty-submission no-op checks pass for both tasks.
- Empty /app produces reward 0.0, not a successful task score.
- Both golden solutions launch through the actual runner's app-start path.
- Representative browser smoke tests pass for both, with no page errors
  and no horizontal document overflow at 1280 x 800.
- GridForge smoke covers seed/custom grid, formula precedence and range
  calculation, dependency recalculation, circular-error isolation + Undo,
  UI save/reload, and rejected forged-user writes without state changes.
- PatchPad smoke covers seed/custom editor, typed selection replacement +
  Undo/Redo, emoji deletion + Undo, UI save/reload, and stale-save 409
  rejection without changing protected state.
- 33 local structural/packaging checks pass per task. See
  structural-checks.json and image-validation.json for exact checks and
  hashes; browser-smoke.cjs and validate-images.py reproduce local tests.

No full paid Oracle, GPT-5.4-mini, or Haiku run was performed in this change.
There are therefore no new official scores and no evidence yet that every
Functional criterion passes in a complete Luna-driven journey.

## Attached WebDev Rubrics review map

This maps the workbook's 53 quality checks to the work, rather than claiming
a fabricated 53/53 platform pass. The deterministic-check sheet provides
descriptions, not runnable implementations; our 33 checks are local checks.

| Workbook checks | Evidence or qualification |
| --- | --- |
| 1-7: natural request, coverage, no leakage, achievable product | Concise root briefs and split product requirements; targeted ambiguity fixes. Exhaustive instruction-to-criterion fairness remains subject to the risk below. |
| 8-12: identity, network, credentials, timeout, Docker wiring | Canonical v2 slugs, no-network agent, separate pinned verifier, provider allowlist, nested budgets, no prebuilt agent override. Live credentials were not tested. |
| 13-16: assets, seed, dependencies, answer separation | Identical agent/verifier seed copies; successful offline golden starts; no solution or tests copied into the agent image. |
| 17-20: reference coverage and runtime | Static reference supplied; builds and representative browser regressions pass. Full Oracle coverage is pending; changes are not yet committed. |
| 21-25: safe runner, image, launch contract, schema, browser prompts | Unprivileged launch, no-op zero, syntax and real RewardKit discovery pass; live browser instructions included. |
| 26-28: coverage, no unrequired checks, independence | Original Functional checks retained with ambiguity/order/duplication repairs. Compound criteria remain a genuine review risk, not a confirmed pass. |
| 29-36: browser gates, controls, collections, observable/durable behavior | Basic real server-data gates, real UI probes, success-before-rejection guidance, exact mutations and readback. Sample behaviors exercised; every plural/negative sub-check not rerun. |
| 37-38: shared state and independent scoring | Ordered Functional journey; later dimensions avoid pristine revision assumptions; independent scoring and continuation required. Full-journey state interference still needs Oracle. |
| 39-44: mock floor, graded reward, Likert, gates, weights | No-op zero; persistence prerequisite for Polish; simple zero-mass hard gates; 60/40 shaping and visual Likert anchors. No adversarial fake-app benchmark was executed. |
| 45-48: injection, isolation, pinning, prompt consistency | Untrusted-evidence wording, cleared submission environment, separate protected tests, pinned tools, product-specific prompts. Model judges are not mathematically deterministic despite temperature zero. |
| 49-53: cross-file agreement, clean layout, parsing, secrets, authorship | Matching runtime/dependency paths, task-only ZIPs, LF/syntax/TOML/JSON checks, secret scan, original product-specific tasks. |

## Remaining risks and possible false positives

1. **Compound Functional criteria:** GridForge 2.0.2 splits the five groups
   identified in the new platform review while preserving total feature
   weights. Other connected scenarios and PatchPad's inherited criteria
   still need platform review; do not interpret the local fixes as a blanket
   independence certification.
2. **Genuine validation gap: full Oracle and target run.** The many-view,
   long-document, clipboard, and complete mutation sequences need the real
   judge run. Timing windows are now instructed, but remain runtime tests.
   Do not label these ZIPs Oracle-approved or claim target-score calibration.
3. **Resolved platform placeholder finding.** The platform flagged PatchPad's
   incident-report action label as unfinished implementation. Replaced that
   label with NEXT in both seed copies and the three affected Functional
   criteria and prompt. Its four-character length and three occurrences are
   unchanged. A new golden browser regression verifies keyboard Find,
   forward/backward navigation, wraparound, clipboard selection and replacing
   only the first match. All six PatchPad smoke groups pass. No scoring
   criteria, weights, or product requirements were removed for this fix.
4. **Possible false positive: assets/instructions or prompt.md.** These are
   referenced runtime brief files and required external RewardKit templates,
   not stray authoring documents. The upload contains no review documents.
5. **Possible checker mismatch: provider and weights.** The Codex API is routed
   to OpenRouter; both named hosts are allowed to avoid the earlier key-name
   heuristic problem. Positive gate judge weights satisfy schema while the
   explicit runner and reward configuration give gates no quality weight.
6. Canary/suffix checks are listed in the attached catalog; repository context
   says they are disabled by default. No unsupported canary or suffix was
   invented. Recheck if the destination platform enables a specific contract.

No new platform findings have been observed, so the possible false positives
above are warnings to investigate, not dismissed failures.

## Next validation order

Run full Oracle on these archives first. Resolve any reference/verifier defect
and freeze that version, then run untouched GPT-5.4-mini. Revalidate Oracle if
the task changes. Run Haiku only after the final task and evidence are stable.
Retain old run folders and keep all reports outside platform task ZIPs.
