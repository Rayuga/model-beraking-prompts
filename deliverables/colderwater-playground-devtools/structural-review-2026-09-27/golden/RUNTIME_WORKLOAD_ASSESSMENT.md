# Read-only workload assessment

The frozen `5d0f1d74ae48e36183c5110aee5b414fb5912aa30361401950e8a248e1e4e78b` package has 37 Functional rows, weight 49.5, and a Functional judge timeout of 9,000 seconds (150 minutes). Its required timed episodes account for approximately **51.05 seconds**, plus measured debounce/edit spans and ordinary execution/setup latency. Its successful observation path has a conservative floor of **60 manual Run activations, 54 write/delete attempts, nine privacy navigations, and one actual process restart**. Field entry, New/load, reads, dialogs, screenshots, resize, keyboard, and other UI operations are additional. These are application actions, not necessarily individual MCP calls or LLM turns.

This does **not** prove the platform evaluation should finish within 150 minutes. No existing local proof measured the complete LLM judge, and no current full Functional workflow has been timed as one execution. Local browser waits do not explain the reported timeout by themselves; the remaining possibilities include model/tool round trips, repeated setup, observation/context volume, retries, or a stalled step. Distinguishing those requires the failed run's trace. No trace was inspected in this assessment, and no timeout cause is asserted.

The read-only inventory verified all 23 current golden solution files against the frozen source binding. It verified 58 referenced evidence hashes across all 37 baseline Functional rows. This establishes provenance for old observations; it does not transfer their old grouped verdicts to new atomic criteria. New descriptors must be frozen and mapped before a fresh full workflow or partial-feature proof is claimed.

## Measured local evidence

Exact paths, hashes, nested JSON locations, enclosing failures, and timing precision appear in `EXISTING_TIMING_INVENTORY.json`. The following times are representative observations, not an additive whole-suite total.

| Observation | Recorded time | Scope and limit |
|---|---:|---|
| Dispatch JS/HTML/CSS and fresh JS | 1.237 s | Passing individual observation inside a 70 s report that later failed in a stale-draft probe. |
| Completed delayed click/key/input, then Stop and recovery | 13.341 s | Includes 6.102 s and 6.107 s untouched intervals. Individual observation passed; the enclosing revised-branches report contains a separate example-probe failure. |
| Pending interaction: prior successful commit, second input, timeout, no late callback, recovery | 7.274 s | Second input at 2.102 s, timeout at 5.154 s; passing scoped observation. |
| Pending static last-good overlay with blocked second input | 7.331 s | Passing partial visibility/input-policy witness; shipped runtime unchanged. |
| Shared original run deadline with hidden candidate and recovery | 5.492 s | Timeout at 4.981 s from action in the recorded probe; passing scoped observation. |
| Auto-run measured positive and negative windows | 8.662 s | Passing subgroup; includes two measured negative windows. |
| Actual dirty second editor and recovery | 2.741 s subgroup / 6 s enclosing run | Successful rerun after the earlier setup/observation failure. |
| Positive padded unique creation and rename | 0.883 s | Passing scoped observation; only this branch, not a complete title-validation verdict. |
| Edited example copy, original unchanged | 0.903 s subgroup / 2 s enclosing run | Separate successful exact-source rerun. |
| Actual restart with Duplicate/Delete absent before and disabled after | 6 s | Fully passing enclosing run; two phases; no manual Run/Duplicate/Delete actions. |
| Three independent deletion branches | No complete elapsed field | All three passed; record update timestamps are not substituted for a measured full duration. |
| Actual-MCP network/privacy probe plus controls and alternatives | 24.855 s | 15 historic observations, including alternative fixtures. Old privacy semantics are superseded; network control observations remain useful within their source/recipe scope. |
| Opaque frame network-control observation | 4.040 s | Three observations; instrument/control feasibility, not another full product run. |
| Current privacy probe, golden case | 2.557 s | One of eight cases; all eight together took 22 s. The eight-case total is not one candidate's normal grading workload. |
| Earlier broad browser behavior batch | 16.235 s | Historic mixed behavior subset, including import/dirty/native-warning branches. Not every Functional behavior. |
| Earlier supplement batch | 25.363 s | Historic mixed runtime/editor/console observations; includes cancellation windows. See the JSON inventory for its exact observation IDs. |
| Real keyboard route, documented / undocumented variant | 3.701 s / 2.961 s | Separate successful reference keyboard proofs, including preparation. Neither is a complete Functional or Polish judge. |

The 70 s, 36 s, and 9 s reports with an enclosing `passed:false` remain failed reports. Their individually successful phases can inform estimates with their scope stated. Composite summary files are not counted as additional execution or clean whole-suite measurements. The inventory deliberately does not infer missing timings from file modification times or screenshots.

## Budget interpretation

Use disjoint intervals when measuring:

`end-to-end wall = local browser/app execution + tool transport/orchestration not already included + model deliberation/response + other idle/retry time`.

The approximately 51.05 s nominal mandatory observation component is about 0.57% of 9,000 s. The approximately two-second second-click offset is inside the six-second pending observation; the four-second callback delay is inside the shared five-second execution budget. Do not add either twice. The approximately eight-second allowance is an observation cutoff, not an eight-second sleep required after every run. Positive ordinary runs should wait for actual completion; negative absence windows must retain their full stipulated duration.

As a sensitivity calculation only, if the future measured local workflow took 300 s, the remaining 8,700 s would allow average additional overhead of 87 s across 100 round trips, 43.5 s across 200, or 29 s across 300. Neither a 300 s local duration nor those call counts/latencies has been measured. This arithmetic shows why counting app operations alone cannot establish judge affordability.

The full offline proof should target at most 600 s on the pinned local image as an engineering check, report its actual time, and treat that target as unproven until execution. A passing offline target still cannot establish the LLM judge's wall time. The offline scripts are implementation-specific reference proofs; the judge must discover valid controls through ordinary browser evidence.

## Proposed full offline workflow after freeze

`WAIT_AND_SCENARIO_INVENTORY.md` supplies the per-row count and scenario coverage. Execute one fresh golden instance/database in a disposable network-disabled container, with browser and app colocated. Keep the user preview database and other containers untouched. Bind the archive, all golden files, fixtures, probe scripts, Chromium/MCP versions, and current restart helper before starting. Establish one harmless background record to detect incidental mutation.

Follow the frozen shared scenario order, retaining one app/browser session and its saved records. Immediately follow basic save/load with the one real canonical MCP restart, then reopen a fresh browser context and continue. Avoid clearing or reseeding the database between scenarios. Use unique observed identities and current revisions rather than hard-coded routes or identifiers. A second real editor remains open across the stale-save workflow; a request-only replay is insufficient to prove retained dirty fields.

Reuse **observations and setup** where the rewritten scenario explicitly permits them: one JS/HTML/CSS control can yield separate dispatch, copied-DOM/style, no-script-reexecution, no-handler-inheritance, and fresh-context observations; one successful save/request capture can supply the actual format for later independent current/stale requests; one exact imported-file observation can support import without making it contingent on backend validation. Preserve separate branches and results. A failed branch must not skip later independent branches or zero an entire scenario automatically. If failed state prevents further observations, restore ordinary valid state through supported UI and record that recovery.

Batch the time-sensitive editor replacement/Run, queued Auto-run cancellation, and pending second-input episodes into one browser automation call each. Keep the actual action timestamps and pending-state observations. Group static exact-read checks and independent request probes into bounded calls that return compact observations. Avoid full-page screenshots or large repeated source/console dumps after every action; capture exact fixture fields, marker counts, status, error lines, request shape, revision, and relevant screenshot only where necessary.

Instrument both levels: each browser action/phase records monotonic start/end, explicit wait intervals, UI action count, request count, and failures; each MCP request records invocation/return time. Also record container/server start, restart invocation/completion, and total run end. Nested action durations are not summed with enclosing phase durations. The final report must account for every new Functional criterion with the exact observation branch and status (`observed pass`, `observed defect`, or `tool observation unavailable`), distinguish expected-mutant defects, and state that no provider/Oracle verdict was produced.

## Partial-feature witnesses after freeze

These three new witnesses are **planned, not executed**. Each uses a separately identified disposable reference variant; no shipped task/runtime files are edited. Record the exact local mutation, bind both base and mutated source, demonstrate the intended broken branch, and continue all unaffected branches through the same shared observer. A variant is useful only if the targeted defect is actually observed and the expected unaffected behavior still works.

| Partial implementation | Minimal isolated local fault | Required independent observations |
|---|---|---|
| Supported-file import works; backend filename validation is wrong | Bypass only the server's supported-extension refusal for otherwise-valid writes. Keep real file input parsing, source text, filename display, manual execution, and UI import refusal behavior unchanged. | Real supported import yields exact filename/source and runs correctly. Separately replay an otherwise-valid write with an unsupported filename using an observed request and current revision; acceptance/mutation is the expected server-validation defect. Import credit must survive it. If import persistence is separately retained, observe it separately. |
| Title trimming works; case-sensitive identity policy is wrong | Make duplicate detection compare titles without case while retaining existing trim/storage and ordinary rename semantics. Do not lowercase displayed/stored titles. | Padded unique create and rename store exact trimmed titles; exact and padded collisions/blank refusals remain independently observable. A distinct title differing only in case is wrongly refused: only the case-sensitive coexistence branch loses its credit. Continue unused-title recovery. |
| Extension dispatch works; CSS carries old handlers | In the disposable runtime only, introduce handler inheritance in the CSS path while keeping extension selection, CSS style application, and fresh JS/HTML behavior intact. The precise mutation should be selected after the frozen fixture is known and verified by behavior. | Uppercase/lowercase extension-driven JS/HTML/CSS selection and expected output/style pass. A real pre-CSS handler is proven installed; an ordinary post-CSS click wrongly produces a new old-handler marker. Dispatch and style credit survive the handler-isolation failure. Separately observe script reexecution and fresh globals; do not assume the mutation leaves them correct. |

Previously observed partial witnesses—missing/disabled Duplicate/Delete during restart and a static last-good pending overlay—are source-bound in `READ_ONLY_REUSE_LEDGER.json`. They support the specific independence questions they exercised, not the three new variants or the complete rewritten rubric.

## Deliverables and remaining work

This assessment ran only local reads, hashing, ZIP decoding, and JSON inventory generation. It did not launch any app/container, alter task files, invoke a provider/platform, or rerun browser tests. `BASELINE_FUNCTIONAL_READONLY.json` preserves the 37 frozen descriptions; `EXISTING_TIMING_INVENTORY.json` preserves measured timing provenance; `READ_ONLY_REUSE_LEDGER.json` binds all 37 old rows to verified historical evidence. The inventory generator can be rerun locally with Node.

Remaining after the parent's structural freeze: map every new atomic row to the shared scenario branches, execute and time one complete golden workflow, then execute the three isolated partial-feature witnesses and confirm expected localized losses. Only that execution can produce a fresh full local runtime claim. A full LLM/platform timing claim remains unavailable without a recorded judge run or its existing trace.
