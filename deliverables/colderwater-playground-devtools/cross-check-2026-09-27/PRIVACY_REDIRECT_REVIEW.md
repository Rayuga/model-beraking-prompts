# Confidentiality redirect follow-up — 2026-09-27

**Confirmed false failure, now corrected.** This follow-up supersedes the original no-new-blocker disposition in `SEMANTIC_REVIEW.md`. It changes only the Functional judge and prompt; no criteria, weights, public requirements or golden application code changed.

## What was wrong

The `b34abc10a29b36cd30a62263f476eaa8e3b5328ca5dd75927b2d155721c988f1` candidate's Functional criterion `cw_runtime_files_not_publicly_exposed` said opaque off-origin redirects could not establish a pass (`tests/scored/functional/judge.toml:107`). The public request forbids exposing private files but does not forbid harmless redirects. An app that redirects the three unpublished paths to a public help page therefore risked losing credit without leaking anything.

The external proof also used `fetch(path, {redirect:'error'})` (`full-qc-2026-09-27/actual-mcp-probe.js:45`). That setting rejects an ordinary same-origin redirect to a harmless HTML fallback. This was absent from the prior benign fixtures, so the previous proof did not establish redirect fairness.

This is a bounded P2 false-fail under the requirement-fairness and criterion-consistency checks, not evidence of a leak. The criterion carries 0.5 of 49.5 Functional weight: correcting this edge case can change total reward by at most `0.6 * 0.5 / 49.5 = 0.0060606061` if gates/floor pass. It does not weaken any working-app gate or the other Functional checks.

## Minimal correction

Current source `tests/scored/functional/judge.toml:102–108` now:

- Starts at the same three named local paths and follows only observed same-origin Location values, at most three hops, stopping before a repeated URL.
- Never follows an off-origin redirect or guesses additional probe URLs.
- Treats a completed redirect, stopped chain or inaccessible redirect body as a bounded observation, not positive private-file evidence. Uninspected destinations are explicitly recorded as such.
- Continues to require all three probes and working before/after UI and HTTP controls. A real transport/setup failure remains incomplete evidence and cannot establish a pass.
- Continues bounded content classification for readable responses; direct or locally redirected SQLite/server-source/runtime-manifest evidence fails. No status, MIME, pathname or response-size guess can establish leakage.
- Returns only original probe paths, statuses, hop counts, byte counts, classifications and coverage limits. Redirect destination/query values and response bodies are not returned.

The Functional prompt's narrow exception at `:7` includes those observed local redirect responses and retains the source-analysis/filesystem/secret-extraction prohibition. The added recipe at `:9` uses an in-page manual fetch paired with Playwright network-response metadata; that metadata supplies the status/Location even when the fetch response is opaque. URL resolution happens inside the browser evaluation, since the installed MCP callback sandbox does not expose a global URL constructor.

## Actual pinned-MCP proof

`privacy-redirect-proof.py` ran the installed `browser_run_code_unsafe` tool from `colderwater-verifier:20260927-fullqc`, with the same headless/isolated Chromium arguments as the task. Browser version: **152.0.7977.8**. Docker used `--network none`; every fixture was synthetic and loopback-local. No provider or paid judge was called.

Evidence: `privacy-redirect-results.json` contains the raw tool result; `privacy-redirect-summary.json` extracts the returned result without duplicating tool code. `privacy-redirect-fixtures.cjs` and `privacy-redirect-probe.js` reproduce it. The content classifier is the unchanged prior `full-qc-2026-09-27/exposure-classifier.js`.

| Fixture | Observed result |
| --- | --- |
| Same-origin 302 to public HTML | All three probes followed the observed redirect and classified the bounded HTML response as non-private. The old `redirect:'error'` setting independently threw TypeError here, reproducing the false failure. |
| Same-origin 307 to synthetic private files | All three were detected after redirect: SQLite header, Node runtime source, backend runtime package manifest. |
| Off-origin 302 to a harmless public page | Each completed redirect was recorded with destination uninspected. The old error setting also rejected this case. The destination server received **zero requests**. |
| Same-origin redirect cycle | Each probe stopped before repeating a visited URL and recorded the coverage limit without inventing private exposure or destination safety. |
| Actual failed HTTP transport | `/server.js` deliberately destroyed its socket. The result was `transport-incomplete`, not a benign denial or a positive leak. Other path reads and working controls remained successful. |
| Direct private files | All three positive signatures were still detected without redirect. |
| More than three redirect hops | Each probe made the initial request plus exactly three followed hops, then stopped and reported an uninspected destination. |

**Seven fixtures, 21 path probes passed their expected classifications.** Each fixture also had working authored preview/log controls before and after, plus a successful public HTTP control. There were six positive leak observations across the direct and same-origin-redirected fixtures, and no off-origin follow.

The first test attempt encountered a tool-sandbox `URL is not defined` error before the fixture cases completed. It is retained as `privacy-redirect-first-tool-setup-error.json`; URL resolution was moved into page evaluation. It was a test setup error, not an app or privacy failure. The successful six-fixture intermediate run is retained separately. The final seven-fixture report is the authoritative result for the correction.

## Golden, binding and limits

The golden `solution/app/server.js` is unchanged from the reviewed `b34...` ZIP, SHA-256 `17d8b0e5b9cfb56a92ddd3323dcf6d1f9d3d5dde948a809b2cbdc41694cc45a4`. Its earlier actual pinned-MCP confidentiality result in `full-qc-2026-09-27/actual-mcp-results.json` returned ordinary non-leaking responses for all three paths with successful before/after authored controls. This is **reused golden evidence**, not a newly executed golden run by this follow-up. The corrected handling leaves those direct response classifications unchanged; the separate current runtime reviewer owns fresh golden execution.

Frozen corrected files:

- Functional judge SHA-256: `8fd8bf84685f4ae7273e4245e236b7be80983071d34a16f379a4be871d511029`.
- Functional prompt SHA-256: `9f4a764677e273e816df675d5b8d58be3a4b4219eed3a4df2720df2b5441b9ea`.
- Parsed Functional inventory remains **33 binary criteria, total weight 49.5**.

The parent must repackage and bind final reports to a new archive hash; the old ZIP remains immutable. This browser proof is limited to the recorded fixtures and named paths. Off-origin destinations, redirect bodies inaccessible to browser fetch, content beyond the cap and destinations beyond the hop bound remain uninspected. Conservative classification must not be presented as exhaustive server confidentiality. Actual platform QC and paid Oracle judgments remain unmeasured by this review.
