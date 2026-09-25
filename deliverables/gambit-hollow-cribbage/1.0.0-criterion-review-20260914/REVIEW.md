# Gambit Hollow review — 14 September 2026

The candidate has 45 criteria: Render 2, Constraints 2, Functional 30, Polish 5 and Visual 6. The task version remains 1.0.0. All 124 standard checks, 22 local browser scenario groups, 11 unit groups and seven runner failure/weighting cases passed. No platform rubric or LLM Oracle result is claimed.

Upload packaging correction: use `gambit-hollow-cribbage.zip`. The first archive was incorrectly unwrapped and used Windows file attributes without executable shell-script permissions. The corrected archive follows the accepted Brickfall layout and the repository's task-named-wrapper rule, with regular files 0644 and shell scripts 0755. All 37 payload files are byte-identical; only archive paths and metadata changed. Upload acceptance still requires a platform attempt.

## What changed

- Kept Bazaarbridge's configuration shape and operational values, with the approved Docketlight dimension weights. The final reward is gate-first 60% Functional, 20% Polish and 20% Visual. Judge budgets total 12,000 seconds inside a 12,600-second serial wrapper and the 13,200-second verifier budget. The verifier uses the standard maximum reasoning setting and no per-judge model/provider override.
- Followed Brickfall's deterministic practice approach. The supplied four fixed deals expose every critical scoring transition through real controls. The rubric now names exact sequences and expected checkpoints for fifteen, thirty-one, unsorted runs, pairs, go, ordered show, alternating dealers and wins at each boundary. Starting scores make terminal cases reproducible. No fixture injection or golden-only route schema is required.
- The scoring fixture check now covers all forty examples, with representative UI submissions. Input-order invariance is explicit. Added direct coverage for the pegging bench, seed import, invalid scoring, practice nonmutation, runtime documentation and twice-restarted SQLite persistence. Clarified which requests may be replayed and how to observe unchanged state after refusal.
- Removed stale coverage metadata that referred to nonexistent criteria. Reviewer coverage now lives outside the submitted task. All five prompts have consistent task/prompt markers, a shared browser prerequisite, independent verdict instructions and logged content hashes. The prerequisite requires a real accepted discard to survive a fresh read, so a decorative game shell cannot pass on appearance alone. Public assets are allowed, matching the current networking rules; game/scoring data remains local.
- Kept Visual about appearance, with all six anchored axes. Polish checks interaction, feedback, focus, reachability and reduced motion. Following Gridforge's secondary-screen lessons, inspected the actual counting bench, show and ladder at both desktop and mobile sizes.
- Fixed null-card validation in the golden scorer. Added named player data and correct remaining-opponent-card counts to the seat-filtered response. The SVG board now represents the full 121-point tracks. Improved labels, score layout, show/bench grouping and post-action focus. Seat switching is temporarily disabled during a pending save. Fixed the background turning white below the initial viewport in full-page screenshots; moved practice/resume controls into a separate section so the playing area is easier to scan.

The earlier partial conversion already supplied the scoring bench, fixed practice records, restart helper and corrected fixture totals. Those changes are included and tested; they were not all created during this continuation.

## Evidence

- `standard-checks.json`: exact reference configuration, schema, five dimensions, prompt identifiers, timeout headroom, reward formula, key restrictions and maximum reasoning setting.
- `browser-results.json` and `browser.cjs`: 22 browser/API scenario groups against the golden app. All forty fixture totals and all 24 permutations of each were checked through the observed scorer, alongside visible representative breakdowns. Real UI journeys exercised go, pairs, capped wins during pegging/cut/each show boundary, alternating hands, request refusals, a held pending request, reload, a fresh browser's saved-game chooser and two process restarts.
- `unit-results.json` and `unit.cjs`: 11 direct scoring/state-machine groups. These complement the browser checks; they are not judge evidence substituted for real UI actions.
- `negative-runner-results.json`: the actual runner produces zero for a failed judge command, missing dimensions, NaN, booleans and either failed gate. A valid fractional example produces 0.52 from 0.5 Functional, 0.8 Polish and 0.3 Visual.
- Desktop/mobile PNGs show the live table, show, bench and ladder. Reviewed for contrast, grouping and overflow. No numerical LLM Visual score has been assigned.
- `coverage.md` maps every criterion to available local evidence. Some criteria have representative automated coverage supplemented by source inspection; the report does not claim that a local harness reproduces every possible judge action.
- `source-sha256.json` and `package-audit.json` identify the exact candidate files and ZIP. The archive contains task files only, without screenshots, diagnostic scripts, databases, dependency folders or reviewer coverage. Environment and verifier club assets are byte-identical.

## Limits and next run

Fresh verifier image construction failed while downloading PyPI packages; the environment build stalled on Debian repository connections and was stopped. Build logs are retained. Local functional checks used the cached `brickfall-preflight-verifier:2.0.4` image, mounting the current Gambit tests, solution and assets. This validates the app and runner on that runtime, not a successful fresh build of the exact submitted Dockerfiles.

No judge credential was available to this local session. The runner's `LOCAL_STUB_ONLY` dimension values test the plumbing and must never be reported as an Oracle pass. Platform rubric consistency, paid judge behavior and numerical Visual scores remain unverified. Upload the new ZIP for those checks; use actual per-criterion evidence to distinguish a real implementation defect from a setup/tool failure if the judge returns a failure.

No unrelated project changes were included, committed or pushed by this continuation.
