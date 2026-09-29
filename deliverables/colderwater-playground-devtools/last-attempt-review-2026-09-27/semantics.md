# Last-attempt semantic review

**Recommendation: Hold the final attempt. QC #26 fails on concrete coverage gaps.** The strongest is C1: CSS can retain an old global and still satisfy every required observation. C2 and C3 provide independent examples. This is a review of the rubric, not a finding that the reference app exhibits these bugs.

Bound archive: `deliverables/colderwater-playground-devtools/positive-controls-fix-2026-09-27/review-candidate/colderwater-playground-devtools.zip`  
SHA-256: `663e4d6df66f951662e13d4a365cd2c72f83fba29c9e42998b58cd2bf023013e`  
Functional inventory: **88 binary rows, aggregate weight 49.50**.

I cold-read the frozen public brief and all six notes, all 88 descriptions, the complete shared Functional protocol, context, and every dimension's prompt/descriptors. I used QC #26–33 and the platform's stricter independent-outcome interpretation. The older local skill's permission to bundle whole flows does not establish compliance with the platform's later feedback. No task/ZIP edits, provider calls, application-source inspection or runtime counterexample executions occurred. The companion JSON binds every reviewed task file and records all 88 row dispositions; none is an inherited runtime Pass.

## Material findings

### C1 — CSS global-state exclusion has no observation during the CSS run (P1, high confidence)

Public requirement: `environment/instructions/behaviour.md:5`. CSS must use a fresh isolated copy and must not carry old globals, timers or event handlers.

Current observations: S02 installs window.oldGlobal, observes old script and click-handler markers, then checks retained CSS DOM/style and absence of those markers. It reads typeof oldGlobal only in the later JavaScript Run. S04 separately proves JavaScript global freshness.

**False-pass witness:** For CSS only, reuse the old Window, replace its document with an inert DOM clone, remove old listeners and apply the new CSS without rerunning scripts, but leave window.oldGlobal intact. Use a fresh Window for each later JavaScript Run. CSS content/style, script and handler checks pass; the later fresh-undefined and S04 checks pass. The CSS run nonetheless carried an old global.

Globals are an explicitly named excluded state category, wholly unobserved in the CSS phase. This is not merely another spelling of a tested input or an exhaustive-security demand.

Valid alternatives: No particular iframe, cloning library or sandbox architecture should be required. Observe only the authored global being present before and absent during the CSS result. A fresh context or another mechanism giving the same observable isolation is valid.

Frozen references: `tests/scored/functional/judge.toml:57`, `tests/scored/functional/judge.toml:71`, `tests/scored/functional/judge.toml:78`, `tests/scored/functional/prompt.md:135`, `tests/scored/functional/prompt.md:140`, `tests/scored/functional/prompt.md:142`, `tests/scored/functional/prompt.md:148`, `tests/scored/functional/prompt.md:179`.

Logical counterexample only; no mutant or provider execution in this review.

### C2 — Stale Rename/Delete do not test retention of the actual dirty editor (P1, high confidence)

Public requirement: `environment/instructions/behaviour.md:31`. Saving, renaming or deleting uses the loaded revision; refuse stale operations and keep unsaved work so the user can compare, reload and deliberately reapply it.

Current observations: S23 uses two real dirty editors for stale Save. S25 permits a captured old request and expressly limits its ownership to the saved-state invariant. S28 replays an old-revision delete. Neither creates and checks a dirty second editor through the Rename/Delete conflict UI.

**False-pass witness:** The server correctly rejects all stale writes and preserves fields/revisions. The Save conflict handler retains the dirty draft. Rename and Delete conflict handlers automatically reload the latest saved record, dropping unsaved title/filename/source. All specified stale-server and Save-draft probes can pass while Rename/Delete discard work.

The public paragraph names three user operations and then promises unsaved-work retention. A server replay has no editor draft and cannot establish that promise for distinct UI handlers. S30 replacement warnings do not exercise conflict handling.

Valid alternatives: Both an actual rejected UI request and proactive stale-conflict prevention remain valid if they explain the conflict and preserve the draft. Do not force disabled controls or require a particular conflict dialog.

Frozen references: `tests/scored/functional/judge.toml:407`, `tests/scored/functional/judge.toml:449`, `tests/scored/functional/judge.toml:491`, `tests/scored/functional/prompt.md:397`, `tests/scored/functional/prompt.md:399`, `tests/scored/functional/prompt.md:419`, `tests/scored/functional/prompt.md:422`, `tests/scored/functional/prompt.md:446`, `tests/scored/functional/prompt.md:448`, `tests/scored/functional/prompt.md:449`, `tests/app_context.md:12`.

Logical counterexample only; no mutant or provider execution in this review.

### C3 — HTML and CSS supported-file import are never exercised (P1, high confidence)

Public requirement: `instruction.md:1`, `environment/instructions/behaviour.md:27`, `environment/instructions/behaviour.md:37`. Supported source filenames are .js, .html and .css, case-insensitively; import brings a supported file filename and exact text into an editable draft that can be saved.

Current observations: The dirty-import probe uses cw-dirty-import.js. S33 imports import-me.js and import-me.JS, then refuses notes.txt. No HTML or CSS file is imported. Language execution and editor highlighting are separate paths.

**False-pass witness:** An otherwise correct importer accepts only .js (case-insensitively) and refuses .html/.css. Manual HTML/CSS editor execution and all other product features work. Every guaranteed import fixture succeeds or refuses as expected.

Two members of the brief's explicit three-language supported-file set are entirely absent from import observations. Executing HTML/CSS entered manually does not prove importing them.

Valid alternatives: Any normal browser-file UI and exact-text representation are valid. Test support, not a prescribed input accept attribute, route or editor package.

Frozen references: `tests/scored/functional/judge.toml:540`, `tests/scored/functional/judge.toml:575`, `tests/scored/functional/prompt.md:467`, `tests/scored/functional/prompt.md:493`, `tests/scored/functional/prompt.md:497`, `tests/scored/functional/prompt.md:501`.

Logical counterexample only; no mutant or provider execution in this review.

## QC disposition

These are static task-design results, not provider-run passes.

| QC | Result | Reason |
|---|---|---|
| 26 | Fail | Asked observable behaviours can be wrong while all current guaranteed observations pass. Prior caveat-only treatment did not satisfy this coverage check. |
| 27 | Pass | No new concrete unrequired-obligation counterexample found. Current wording allows provisional-preview hiding, blocked pending input, static rollback, proactive conflict prevention, arbitrary labels/layout and genuine public-asset filename overlap. |
| 28 | Note | The 88-outcome decomposition and fact-sharing contract materially reduce the earlier bundles. One remaining cross-layer case-acceptance row warrants scrutiny under the platform interpretation; no additional incompatible-product bar found. |
| 29 | Pass | Render requires authored DOM/log output; Constraints requires new server write and independent clean-context retrieval. All three scored prompts restate usable/server-backed gate and zero their dimension after observed product-gate failure, while preserving external assets and no-auth contract. |
| 30 | Pass | Read all 88 descriptions against the actual shared mandatory-control contract and protocols. Enabled Auto-run and retained clickable CSS control are explicit; the final HTML-to-JS CSS fallback matches the descriptor. No additional concrete vacuous-pass control omission found. This does not cure unprobed required behaviours in #26. |
| 31 | Pass | Specified multi-operation collections are enumerated: nine privacy candidates, four parent accesses, five unsupported families, four dirty transitions and complete relevant library lists. No additional concrete within-probe collection omission found. The omitted supported import categories are reported under #26, not concealed by this scoped result. |
| 32 | Note | The scored protocols ask for browser-visible facts and product-data evidence, not implementation reads. S06 explicitly represents its narrow unresolved-public-role observation as incomplete. That bounded design cannot establish every private file or invisible backend/internal-stack requirement. |
| 33 | Pass | Current S06 terminal ordering no longer calls the same response both exposure and incomplete. Accepted denial/public role, narrowly unresolved affirmative role evidence, and ordinary no-role exposure are mutually exclusive in the text. No other concrete conflicting full-credit bar found. |

## Remaining interpretation and observability limits

**N1 — Uppercase import acceptance and uppercase server-save acceptance still share one binary row (P2; medium confidence).** cw_source_file_extension_case awards one 0.20 result for uppercase .JS import AND save. The protocol itself separately isolates those layers and explicitly recovers if either fails. An importer-only uppercase bug and a server-only uppercase bug lose the same entire row despite the other layer working. This resembles the earlier platform demand for separate useful outcomes, but the exact granularity for one cross-layer case-insensitivity rule is interpretive. It is a risk, not an additional demonstrated platform rejection or the reason Hold is already necessary. References: `tests/scored/functional/judge.toml:575`, `tests/scored/functional/prompt.md:501`.

**N2 — Invisible backend evaluation and named internal technologies are not established by browser evidence (P2; high confidence).** The constraint gate expressly proves basic shared server read/write, not SQLite or Express. A backend that evaluates source and discards every effect can be browser-indistinguishable from one that never evaluates it. Source/database inspection is prohibited. This is a contract-versus-observability design limit, not a demand to enumerate all attacks and not an observed backend execution. It must not be represented as fully proved. C1-C3 are observable coverage defects and independently justify Hold. References: `tests/gates/constraints/judge.toml:29`, `tests/gates/constraints/prompt.md:6`, `tests/scored/functional/prompt.md:7`.

The final S06 privacy tree is materially clearer than the rejected version. An established denial takes precedence over an attachment event; real ordinary-use public assets/data may be accepted despite a candidate name; concrete but unresolved affirmative public-role evidence uses the narrow incomplete branch; ordinary successful standalone delivery without such evidence is a product failure. Those are terminal alternatives. A filename, status or app assertion alone cannot manufacture the exception. I found no new concrete contradiction in that ordering. Because response bodies are prohibited and only nine paths are sampled, this is still bounded browser evidence, not a proof of all private-file safety.

Do not confuse C1–C3 with every conceivable variant. The fixtures sample literal loops, timer deadlines, Promise rejection, fetch/Image and native navigation. They do not establish every recursion/Promise/HTML-async cross-product. CSS timers are not seeded through a CSS switch either; the exact pending/completed setup deserves care, so C1 relies on the simpler decisive global witness. The import finding concerns whole missing members of an explicit three-language set. A guaranteed CSS server-save probe is also absent when the chosen example is JS/HTML; this remains a related finite-category concern rather than a separately inflated blocker.

## Prior failures and certainty

The current descriptions/protocols contain the targeted fixes for the former four large bundles, dead-Auto-run silence, missing live CSS button controls, hidden candidate previews, blocked pending input, latest-successful-interaction rollback, title trimming, completed-preview Stop, example separation, and the contradictory privacy classification. Those repairs are real source changes. The all-88 control review found no new concrete vacuous-pass omission after them. Positive controls, however, cannot prove a public behaviour that a scenario never observes.

Earlier structural notes already acknowledged missing CSS-state and dirty Rename/Delete observations. Treating asked-but-ungraded behaviour as a coverage caveat instead of failing QC #26 was a review error. The previous generous whole-flow independence interpretation was also too broad for the platform's reported policy. Repeated rejections of changed candidates and discovery of missed defects do not, by themselves, show nondeterministic QC on identical input.

Pinned dependencies, exact byte hashes and mechanical checks can be reproduced. LLM semantic judgment and browser timing can still vary; no identical-input repeat experiment or rejection probability was measured here. Full provider execution, complete-runtime fit and these counterexample implementations remain unexercised by this review. There is no sound last-try guarantee. The known observable coverage defects justify Hold without relying on speculative nondeterminism.
