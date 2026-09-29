# Ridgeline and Colderwater handoff — 26 September 2026

**27 September Colderwater metadata cleanup:** Current ZIP SHA 09f4f6cb3647f7d8395a4367fa931c1fb2ac56713bc25df431bd10b6a8b88f7e. Only descriptive task.toml metadata changed; golden/verifier behavior is unchanged. Read [the current Coldwater handoff](COLDERWATER_HANDOFF_2026-09-27.md) before older snapshots. Final verifier cleanup remains a separate pending repair.

**27 September Ridgeline second cross-check:** Current ZIP SHA `e9571f7ec27341ace6c955a81de5cc8fd2199df804ee54b7c90a009b18333f9b` (25 Functional criteria / weight 35). Read [the current Ridgeline handoff](RIDGELINE_HANDOFF_2026-09-27.md) before the historical snapshots below. Five rubric gaps and bounded final cleanup are corrected; the full 53/48 review and final archive/image binding are recorded there. Oracle/model outcomes remain unmeasured. The similar Coldwater cleanup pattern is a recorded separate follow-up, not silently repaired by this review.

**27 September interaction/keyboard correction:** Current Colderwater SHA `dc2ed5acde5addbdea6f7d4f49ad2c94e77a0decfccab54573967cb9a1cb4672` (33 Functional criteria, weight 49.5). Read [the current Colderwater handoff](COLDERWATER_HANDOFF_2026-09-27.md) first. It supersedes all older Colderwater candidate, validation and authorization snapshots below. Older text is historical. Ridgeline retains its separate current handoff and artifact binding.

The current candidates are below. Local validation does not establish paid Oracle/target-model scores or private platform acceptance. The user targets Oracle 1.0 and a functioning builder score between 0.1 and 0.7, with difficulty in requested functional behavior and approachable presentation checks.

Use [PARALLEL_AGENT_HANDOVER.md](PARALLEL_AGENT_HANDOVER.md) for task-owner/reviewer scopes. Later user instructions and authorization override this snapshot.

## Current candidates

| Task | Current archive | SHA-256 | Files | Functional |
| --- | --- | --- | ---: | --- |
| Ridgeline | [ridgeline-print-storefront.zip](deliverables/ridgeline-print-storefront/rubric-followup-2026-09-26/ridgeline-print-storefront.zip) | `7502bd9c36e568b0d50e682e4030d0c6f9079b5467ae19992303b8d04f8dcca6` | 51 | 24 binary criteria / weight 35 |
| Colderwater | [colderwater-playground-devtools.zip](deliverables/colderwater-playground-devtools/network-policy-fix-2026-09-26/colderwater-playground-devtools.zip) | `998f0ba6831f801686251412a2a7cffb6e38fd5807dae68e08042a7f78bc8686` | 50 | 32 binary criteria / weight 49.5 |

Adjacent `candidate_manifest.json` files bind every file hash, one task root, valid CRC, extracted equality and executable LF shell files. No database, node_modules, secret or local report ships inside either task. Working source is under `projects/<task-slug>/`.

**Historical, not current uploads:** Ridgeline `rubric-fix-2026-09-26/` SHA `f8a9b605699d7e87dc1a0a08fb2f48e23a16e784588c7380d3a5aa47a77b706d`; Colderwater `rubric-fix-2026-09-26/` SHA `76ab7fb11195aa564b1ac5647439cc34be4b8c00fd28918f95b06ed286fd6d4d`. Preserve those archives and earlier hardening/ID-only reports. Reuse executed behavior evidence only where unchanged; disputed semantic PASS judgments are superseded.

## Ridgeline follow-up

The latest screenshot reported five failures against `f8a9…`. Its first two concerned the **same hidden postage-display requirement**. The brief requires correct visible subtotal, saving, postage and total, not displayed grams or internal postage-band names. Mixed and successive-order criteria now grade the requested amounts without those extra labels. All exact pricing, inclusive weight boundaries, stock and receipt behavior remains required.

Search, size filtering and paper filtering now score independently at 0.1 each; price ordering and title ordering at 0.15 each. These replace two bundled checks while preserving total Functional weight 35. Their clearing/reverse actions still establish the same respective behavior.

The independent-visitor basket test is possible with the installed tool. Actual JSON-RPC proof using `browser_run_code_unsafe` and the configured `--isolated` flags called `page.context().browser().newContext()`. A and B remained simultaneously open: A retained two Night Ferry A2 at GBP 132.20; B started empty and retained one Long Field A3 at GBP 39.70. Both survived returning/reloading, neither inherited the other's storage, and cleanup closed only B. An ordinary MCP snapshot still worked on A. The criterion/prompt now provide this recipe; a second tab sharing storage is not sufficient.

Mobile presentation formerly repeated the same clipping/overflow defect in Polish and Visual. Polish retains basic mobile access. Visual responsive consistency now grades proportions, density and composition across widths and excludes those same usability deductions; its other five criteria use desktop views.

A further standards audit found the old app-wide offline/CDN rule contradicted the staged template. The current public-network profile permits external browser fonts/scripts/CDN assets, while the local backend/data-service requirement remains. The erroneous asset-based gate was removed. The golden can continue using local assets; CDN permission does not require CDN use.

Read the current [functional review](deliverables/ridgeline-print-storefront/rubric-followup-2026-09-26/FUNCTIONAL_FIX_REVIEW.md), [network standards review](deliverables/ridgeline-print-storefront/rubric-followup-2026-09-26/NETWORK_STANDARD_REVIEW.md), [actual MCP proof](deliverables/ridgeline-print-storefront/rubric-followup-2026-09-26/MCP_CONTEXT_AND_PRESENTATION_REVIEW.md), crosswalk and score-bound evidence.

## Colderwater policy correction

Exactly seven files changed from `76ab…`: root instruction; integration/policy/security notes; task description/provenance; app context; F01 description. The host app may now use external browser assets, and F01 no longer fails it for those permitted requests. Both network modes remain `public`; the backend and saved library remain local.

The **authored-snippet network ban is unchanged**. Untrusted preview snippets still cannot fetch external resources or use network services. Host-app CDN assets and user-code requests are different contexts; correcting the former must not weaken the latter.

All criterion IDs, weights and order; other 31 Functional descriptions; both gates; prompts; presentation checks; scoring/helpers; seed; Dockerfiles; and the full golden/installer are byte-identical to `76ab…`. The earlier 65 local groups are reused, not newly rerun. See [QC_NETWORK_POLICY.md](deliverables/colderwater-playground-devtools/network-policy-fix-2026-09-26/QC_NETWORK_POLICY.md), its exact diff and 22-assertion delta audit.

The earlier rubric repair remains useful history: real authored Run and shared Save gates, independent error outcomes, all five unsupported execution families, origin read/write isolation, dirty destinations/native warnings, import/export validation, a four-second-delayed shared-budget witness, deterministic network controls and installer-only reset. The current policy delta changes none of those behaviors.

## Standards and score limits

Both tasks use staged `tests/gates/{render,constraints}` and `tests/scored/{functional,polish,visual}`, canonical score/restart helpers, 7200-second agent and 13200-second verifier budgets. Judge runner/model remain `claude-code` / `z-ai/glm-5.3-flashx`; supplied builder is `gpt-5.6-luna`. Verify routing before an authorized run; never silently substitute.

Shares remain 0.6 Functional, 0.2 Polish and 0.2 Visual; Functional must be strictly greater than 0.05. Four binary Polish and six raw 1–5 Visual criteria remain. RewardKit 0.1.7 normalizes the visual anchors. Browser evidence can establish working shared behavior, not an invisible framework/database engine. All prompts prohibit judging submitted implementation code.

Current-delta arithmetic is conditional, not a model forecast:

- Ridgeline splits alone can add at most 0.006 reward when gates/floor already pass. Including credit restored solely from the two hidden-display failures gives at most 0.0918 published gain with other outcomes fixed and both versions above the floor. A separate abstract floor witness is 0 → 0.5217. Removing the false CDN gate can independently restore a fully working permitted app from 0 → 1; the conditional 0.0918 bound is not universal.
- Colderwater changes only F01's existing 0.5 weight: at most 0.0061 published gain with other outcomes fixed and both versions above the floor. A separate abstract floor crossing can restore 0.4333 with full presentation.
- With full presentation and passed gates/floor, reward is `0.4 + 0.6 * functional`; staying at or below 0.7 requires Functional at most 0.5. This does not identify any model's actual behavior.

## Current and reused evidence

Ridgeline source/extraction reports show **83 source assertions** and **22 contract checks**, with no recorded failures. New actual-MCP proof covers both contexts, all five catalogue controls and a locally routed optional CDN-style script. The same script loads on an unprotected control and the golden while a real shop action continues working. That deliberately offline fixture does not claim real internet connectivity.

Colderwater source/extraction reports show **82 source assertions**, **22 policy-delta assertions** and **23 contract checks**, all passing. The new guard rejects the preserved old offline wording and accepts the corrected source/extraction while retaining snippet isolation.

Four final images use `20260926-followup` tags: `ridgeline-agent`, `ridgeline-verifier`, `colderwater-agent`, `colderwater-verifier`. Evidence sits beside current ZIPs. All 12 Ridgeline and 7 Colderwater public files match source. Agent `/app` contains only `.git`/`.gitkeep`, with no private solution/verifier. All **15 verifier files per task** match frozen source; both ship Chromium **152.0.7977.8**. Source stayed unchanged during builds.

Reused unchanged-behavior evidence:

- Ridgeline prior correction: 7 installer groups, 11 gate/address/basket groups and negative mock witnesses. Earlier hardening: 203 backend assertions, 19 arithmetic cases, 9 main browser groups, 5 resilience groups, 4 harness cases and 13 scorer fixtures. The 49-assertion/21-screenshot presentation run remains rendered evidence; its old overlapping rubric interpretation is superseded.
- Colderwater [golden report](deliverables/colderwater-playground-devtools/rubric-fix-2026-09-26/GOLDEN_FIX_AND_BROWSER_PROOF.md): 65 groups (59 Chromium 152 browser groups and 6 installer groups), TypeScript/Vite byte-identical reproduction, observed 5436 ms termination of the 4000 ms delayed runaway, and native/network controls. Earlier backend proof has 127 assertions. The real restart MCP was exercised between browser-created records and fresh-browser verification/continued saving. Synthetic harness scores test plumbing only.

The complete QC inventory consists of 53 workbook judgments and 48 documented deterministic procedures. Both current-hash workbook reviews completed with 46 PASS, 7 NOTE and 0 FAIL. Ridgeline's procedure review completed with 34 PASS, 10 NOTE and 4 N/A; Colderwater's with 33 PASS, 11 NOTE and 4 N/A. The coordinator verified these inventories against both findings files. Narrow source assertion counts are not full-review totals. Private checker implementations are unavailable, so local equivalents, inventory coverage and XLSX generation do not establish platform acceptance.

## Next measurement and safe continuation

Paid provider preflight, Oracle and target-model calls remain pending/unapproved in this snapshot; the earlier request for one Oracle and one model run per task was unanswered. Consult later authorization and use it without asking again if already granted. This document grants no spending, upload, commit or push authority.

Harbor 0.22.0 is installed at `%USERPROFILE%/.local/bin/harbor.exe`; its launcher needs execution outside the restricted sandbox here. `harbor run --print-config` worked. `harbor check` itself invokes an LLM; it is not the unavailable deterministic checker bundle. Never print or persist credential values.

After authorization, preflight the declared judge route, run Oracle first, then the target builder within scope. Preserve run IDs, hashes and every criterion result. Distinguish infrastructure failures, unfair verifier assumptions, genuine golden defects and model failures. Source changes require affected tests and a new freeze/manifest/archive/current-hash review. Normal runtime restart must preserve state; installer-only reset is separate. Current uncommitted/untracked work is not all in `HEAD`; do not reset/clean/stash it or mutate another owner's container. Follow-up disposable containers were removed; unrelated preserved environments remain untouched.
