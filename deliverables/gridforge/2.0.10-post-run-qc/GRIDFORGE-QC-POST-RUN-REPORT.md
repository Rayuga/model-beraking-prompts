# GridForge 2.0.10 — QC and post-run review

Reviewed 10 September 2026. This is a local evidence-backed review, not platform QC certification.

## Verdict

The final task ZIP, case study, evaluation report and all four named job directories are present. The recorded scores recompute correctly and refer to one task version/checksum. The task ZIP is clean and byte-identical to current source.

This is **not an unconditional QC sign-off**: a golden keyboard defect is reproduced, some model verdicts have instruction/evidence issues, raw database artifacts remain in the separate job handoff, and the frozen setup predates the newest Harbor-managed-tool guidance. Do not present Oracle as 1.0 or every model loss as a verified implementation defect.

No QC skill is available in this session. I used the repository WebDev Rubrics QC workbook, task-implementation/checks guidance, RL scorecard soundness principles and Model-Breaking Playbook as the fallback. Missing referenced review_guidelines.md and actual platform checker implementations prevent claiming execution of the official QC process. The local 53-row review uses PASS/FAIL/REVIEW/POLICY OVERRIDE rather than inventing a numeric RL score.

## Verified delivery

- Task: `turing/gridforge-spreadsheet-v2`, version `2.0.10`.
- Existing final delivery: `deliverables/gridforge/final-deliverables/`.
- ZIP: exactly one `gridforge-spreadsheet-v2/` wrapper, 32 source-matching files, valid CRC, no task databases/reports/dependencies/caches.
- Case study and evaluation report are readable DOCX files; their reported scores/counts match the exports. Their absence of the fairness qualifications below is why this supplemental review matters.
- Source, original run outputs, final delivery, reports and historical ZIPs were not edited. Only this review folder was created.

## Supplied task-QC and upload documents

The full `Task QC - platform.docx` (19 source criteria) and `upload-checks-README.md.docx` (26 upload rules) have now been read and applied separately from the 53-row WebDev review. See [DOCX-QC-UPLOAD-REVIEW.md](DOCX-QC-UPLOAD-REVIEW.md) for every rule, source fingerprints, local status and evidence. The workbook includes both ledgers and the fresh analogous checks.

Important: the upload guide's default allows public networking and requires separate-verifier tooling baked in the image. Older source-QC offline/allowlist wording and the newer lead's Harbor-supplied-tool message therefore cannot all be treated as the same policy. Current project overrides and Harbor's actual tool contract still need confirmation. An optional/off-by-default upload metadata rule also asks for persona, unlike newer WebDev guidance. No policy or task changes were made to conceal these conflicts.

Original real-traffic prompt provenance and tested injection resistance remain unproven. The total timeout equals the documented 21600-second cap, with no cap margin. Optional strict artifact-parent creation and the dynamic manifest/database filename check need the active checker policy to resolve. None of these local document reviews is an official platform pass; the existing golden/fairness findings remain.

ZIP SHA-256: `41bd62a738cfbadd79daedf2b8d9c85335e4c9e48e9304a3591252d7e9a0e8b0`.

## Recorded scores

| Run | Reward | Functional | Polish | Functional full credit | Interpretation |
| --- | --- | --- | --- | --- | --- |
| oracle | 0.9545 | 0.9241 | 1.0000 | 34/36 | Meets recorded >=0.95 aggregate; NOT all-Functional/full 1.0 |
| gpt-5.4-mini | 0.2697 | 0.3661 | 0.1250 | 21/36 | Inside 0.1-0.7; also <=0.5 internal target |
| gemini-3.7-flash | 0.6848 | 0.6830 | 0.6875 | 26/36 | Inside 0.1-0.7; above <=0.5 internal target |
| claude-haiku-4-5 | 0.0268 | 0.0446 | 0.0000 | 4/36 | Below general band; Haiku exception, with judging caveats |
| nop | 0.0000 | 0.0000 | 0.0000 | N/A | Expected negative control |

All four evaluated submissions have Render=1, Constraints=1, graded=1, no_op=0 and no reported trial exception. NOP has reward=0, graded=0, no_op=1 as expected. Each graded run has all 44 criterion result rows, but a row saying “not completed” is not proof the behavior was actually exercised.

The submitted reward is gated `0.6 * Functional + 0.4 * Polish`. All dimension weights/criterion descriptions agree with current source, and weighted totals reproduce the recorded rounded values. Likert visual values are normalized, not counted as full passes. One rollout per model does not establish reliability or confidence intervals.

The delivery README records an owner acceptance threshold of >=0.95. Oracle meets that aggregate threshold; the playbook's stronger all-required-Functional standard is not met (34/36). These are different claims, not a perfect Oracle pass.

Shared platform task checksum: `91fd9a4bc8ca3a006e435ada697e34677482632edac007302573fa3287d931c8`.

Shared lock digest: `sha256:aea31db8d8c32c0ad69b7ed952743d30e1977e645b3bc77648c25065d43ee864`.

These platform digests are not ZIP hashes. The audit separately verifies current source against the ZIP and exported criterion definitions; Oracle app source matches after LF normalization. It does not independently reconstruct the platform task digest from an exported full task snapshot.

## Findings

### F01 — Grid-started commit navigation fails

P1 | Confirmed golden defect

Oracle keyboard_edit_delete_undo failed. Fresh real-browser typing in F3 moved focus to formula-bar; Enter kept F3 rather than F4. Typing in G3 then Shift+Tab kept G3 rather than selecting F3. Source formula-bar keydown commits Enter without advancing the selected cell and has no corresponding Shift+Tab commit navigation.

Impact: Reference cannot satisfy every Functional criterion. Aggregate 0.9545 meets the recorded owner's >=0.95 threshold but is not Oracle 1.0 or the playbook's all-Functional standard.

Evidence: `projects/gridforge-spreadsheet-v2/solution/app/public/js/app.js:110; oracle-reproduction.json; Oracle verifier/reward-details.json`.

Next step: Repair golden commit navigation in a separately authorized version and validate it without weakening the criterion.

### F02 — Oracle reverse-drag failure not reproduced with visible endpoints

P2 | Unresolved platform discrepancy; local gesture passed

Oracle reports K36:L37 rather than J35:L37. Fresh center-to-center real mouse drags with 1, 12 and 40 steps selected all nine expected cells after read-only hit tests confirmed L37/J35 were visible. Early diagnostic attempts encountered detached nodes or clipped endpoints; those are invalid diagnostic setups, not app failures. Full platform mouse/key traces are unavailable.

Impact: Cannot attribute the historical loss solely to the app or overturn its official score. A passing selection probe is not a completed replay of the full paste/Shift-click/delete/undo criterion.

Evidence: `oracle-reproduction.cjs; oracle-reproduction.json; Oracle shift_click_and_reverse_drag_range_selection reasoning`.

Next step: Inspect a fresh judge action trace or reproduce the full criterion with visible, hit-testable endpoints before changing golden drag code.

### F03 — Mandatory redundant identity fields penalize legitimate payloads

P1 | Demonstrable instruction/verifier mismatch

api_session_user_mismatch_rejected requires a separately changeable claimed-user value. The brief requires session-bound attribution, not duplicate identity in a save. GPT's successful save carried sessionId/baseRevisionId/snapshot/kind; its session criterion failed solely because a claimed-user field was absent. stale_save_and_workbook_identity_rejections also requires a duplicate top-level workbookId when URL plus snapshot identity can satisfy the brief. The prompt permits equivalent field names but does not handle intentionally absent redundant fields. GPT also returned a genuine 500 for the nested identity probe, so that criterion cannot simply be relabelled pass. Gemini's reported session probes change/remove userId rather than clearly demonstrating removal of the actual session credential.

Impact: A correct session-derived identity design can lose credit without an impersonation defect. Do not count missing duplicate fields as proven model defects or recalculate official scores speculatively.

Evidence: `environment/assets/instructions/collaboration.md; storage.md; tests/functional/judge.toml; GPT/Gemini functional reward-details.json`.

Next step: Make identity probes apply to the observed real credential/identity contract while retaining wrong-session, contradictory-identity and no-mutation requirements.

### F04 — Haiku low reward is graded, but not all losses are independently supported

P1 | Recorded judge-evidence defects

Haiku has graded=1/no_op=0, both gates=1 and no trial exception. autosave_completed_edit allows five seconds, but failure reasoning cites only 2.5 seconds. keyboard_edit_delete_undo cites restoring G3 although the criterion restores F3. Fifteen Functional explanations contain 'not completed', including eight bare 'Not completed.' outcomes; the session check additionally says no matrix was completed. Some incomplete chains also report real preceding failures (restart load error or wrong fill), so incompleteness is not automatically a false failure.

Impact: 0.0268 is the official completed grading result, not an infrastructure zero; however, it is not evidence that all 32 failed Functional behaviors were independently tested and genuinely broken.

Evidence: `Haiku verifier/reward-details.json; tests/functional/judge.toml`.

Next step: For future evidence, observe the full allowed timing window, the correct target cell and independently executable criteria; preserve the recorded score.

### F05 — Find Next assumes one initial-search convention

P2 | Fairness/interpretation concern

The brief asks for familiar find/replace. The verifier enters FIND-QC then requires Next to visit J50,J51,J52,J50. A legitimate live-search UI that already selects J50 during query entry will next visit J51. Both GPT and Gemini report J51 first. GPT separately lacked Replace Current, and Gemini also had an Undo checkpoint failure; those are not excused by the initial-match ambiguity.

Impact: An incidental initial selection convention can cause a false fail; it is not sufficient evidence to overturn either complete bundled verdict.

Evidence: `tests/functional/judge.toml:find_replace_navigation_and_atomic_replace_all; spreadsheet.md; GPT/Gemini reward-details.json`.

Next step: Observe selection after query entry and accept either conventional initial state while still proving all matches, wraparound, replacement and atomic Undo/Redo.

### F06 — Conjunctive bundles and keyboard focus need careful interpretation

P2 | Needs review, not a confirmed contradiction

The current split checks fix earlier seed/persistence coupling, but edit/delete/undo, Shift-click/reverse-drag and number/formula fill remain conjunctive. Oracle and Gemini passed some of those sub-behaviors and lost the entire criterion for another. Functional requires Tab navigation inside the grid while Polish requires keyboard reachability/no trap; these can coexist with an explicit exit mode. GridForge golden provides Escape exit, so Tab remaining in active-cell mode alone does not prove a trap.

Impact: The current workbook may flag collapsed distinctions, but strictness alone is not unfairness. No weights or criteria were changed in this review.

Evidence: `tests/functional/judge.toml; tests/polish/judge.toml; solution/app/public/js/app.js:onGridKeyDown`.

Next step: Review the named bundles and actual keyboard exit evidence against the current rubric before altering scoring.

### F07 — Raw job databases remain outside the clean task ZIP

P2 | Delivery hygiene/provenance qualification

The final task ZIP is clean, source-identical and has 32 files. The separate job directories contain 10 database/WAL/SHM files. Of 136 delivered job files, 1 exactly matches the current raw run copy, 108 match after LF normalization and 27 have no counterpart in run-outputs (including ignored databases and logs). All delivered hashes still match the saved final-delivery manifest; no substantive difference was found among available raw counterparts.

Impact: The playbook requires sanitized delivery exports without databases. This does not invalidate the task upload ZIP or prove tampering, but raw run-outputs alone is not the complete preserved evidence set.

Evidence: `final-deliverables/job-directory; run-analysis/final-delivery-manifest.json; evidence.json:forbidden_delivery_files/delivered_job_files`.

Next step: Keep original forensic evidence intact; prepare a separate sanitized handoff only if required by the current delivery contract.

### F08 — GridForge is still on the older self-provisioned judge setup

P2 | New lead-template alignment pending

Frozen 2.0.10 uses public agent/separate public verifier, Codex and openai/gpt-5.6-luna, and no key setup in test.sh. task.toml still aliases OPENAI_API_KEY and sets OPENAI_BASE_URL; tests/Dockerfile installs Codex, Playwright/Chromium and RewardKit and writes local provider/MCP configuration. The latest lead instruction calls for platform OpenRouter key handling and Harbor-provided judge tools.

Impact: Historical runs remain evidence for their frozen setup. They do not validate a future Harbor-managed-tools release, nor does this task fully match the latest requested template.

Evidence: `task.toml:39; tests/Dockerfile:19; tests/test.sh; latest lead message in conversation`.

Next step: If adopting the new template, version that change separately and verify separate-verifier tool/provider provisioning before calling it platform-compatible.

### F09 — No executable QC skill/platform checker bundle available

Info | Scope limitation

No QC skill is in the available skill catalog or callable tools. The repository supplies a 53-row WebDev workbook, 58 named deterministic checks, task-implementation.toml, checks.txt, the RL scorecard and playbook. The referenced extra_references/review_guidelines.md and the actual named platform-checker scripts are absent. Existing DOCX reports preserve scores but do not include the full fairness qualifications above.

Impact: This report is an independent local desk/post-run review, not a claim of QC-skill execution, 53/53 platform approval or a new RL scorecard grade.

Evidence: `WebDev Rubrics QC.xlsx; task-implementation.toml; checks.txt; MODEL_BREAKING_PLAYBOOK.md`.

Next step: Use the current platform QC bundle for certification; attach this review as a supplement to the historical delivery reports.

## Fresh local diagnostic and audit scope

- Parsed all task TOML/JSON, checked shell LF/shebangs, ZIP inventory/CRC and source hashes, task/model/network wiring, criterion schema, seed consistency, timeout hierarchy and delivered report/job hashes.
- Recomputed every recorded dimension and final score; compared all exported criterion IDs, descriptions and weights to source. No scores were changed.
- Ran `bash -n` on all four shell scripts and `node --check` on golden JavaScript, staged the current golden via solve.sh, and started it using the trusted lifecycle helper in an offline disposable container.
- Reproduced two commit-navigation failures. Three reverse-drag variants passed after visible endpoint hit tests. This does NOT replay the entire 44-criterion Oracle or the full reverse-drag criterion.
- The diagnostic image was the existing `gridforge-v2-tests` image with current task code mounted read-only; this is not a freshly rebuilt 2.0.10 image. The app/database existed only inside a disposable container. Earlier diagnostic attempts with clipping/detached nodes are not app verdicts; the final diagnostic completed with exit 0.
- Secret-pattern scan found no provider keys, private keys, bearer literals or Windows user paths in the final-delivery scan, including ZIP/DOCX members. This is a scoped pattern scan, not a proof against every possible secret encoding.

Not performed: paid Oracle/model runs; a new platform QC run; execution of the 58 named platform checker scripts; a full live replay of every model failure; full judge mouse/key trace reconstruction; a complete adversarial shell/mock battery; a new numeric RL scorecard rating.

Local scripted assertions: 278 total; 277 passed. The remaining failure is the playbook delivery-sanitization check (10 database/sidecar files outside the task ZIP). This assertion count is NOT the platform 53-check score.

Local 53-row desk-review counts: FAIL=3, PASS=38, POLICY OVERRIDE=2, REVIEW=10. REVIEW and POLICY OVERRIDE are not literal platform passes.

## Handoff

Use this report alongside the existing case study/evaluation report. Preserve the frozen package and original rewards. If changes are authorized, address F01 and the demonstrated fairness issues without dropping requirements or weights; separately decide whether the new Harbor-managed-tool template and sanitized handoff are required. Any revised source/verifier package needs versioned, appropriate fresh evidence; do not relabel these historical scores as results for a changed task.

Files in this folder:

- `GRIDFORGE-QC-POST-RUN-REPORT.md`: this report.
- `GRIDFORGE-QC-POST-RUN-REPORT.xlsx`: run summary, 53 local QC reviews, 58-check inventory, full 44-criterion matrix, every below-full-credit explanation, findings and scripted checks.
- `QC-REVIEW.md`: individual guideline review ledger.
- `evidence.json`: hashes, score calculations, export comparisons and source evidence.
- `oracle-reproduction.json` / `.png` / `local-reproduction.log`: fresh diagnostic evidence; no official scores.

