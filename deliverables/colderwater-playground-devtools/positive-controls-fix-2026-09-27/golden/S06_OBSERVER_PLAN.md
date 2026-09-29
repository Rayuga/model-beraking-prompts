# S06 focused browser evidence

Status: prepared; not executed by this module's author. Final prompt/judge hashes must be supplied after freeze. No application, task, existing driver, or prior run artifact is changed.

`drivers/s06_privacy_observer.cjs` exports:

```js
await runS06Observer({
  page, GoldenBrowser, ledger, url,
  variant: 'golden', // also public-server-script
  freezeBinding: {confirmed: true, prompt_sha256: '...', judge_sha256: '...'}
});
```

The caller supplies a fresh `about:blank` page in a dedicated disposable context, the existing `GoldenBrowser` class and observation ledger, and the local disposable app URL. The observer closes only its own probe pages and removes its routes. The caller owns and then disposes the main page/context (including its installed initialization script) and artifact persistence. Returned evidence contains one classification per candidate and one overall outcome; it does not assign rubric scores.

Both variants load the actual golden workspace, execute a healthy authored DOM/log control, attempt all nine S06 candidate navigations, and execute a fresh recovery control on the original page. Probe observations use navigation response metadata, download events and rendered workspace controls only. A possible SPA fallback must execute a real DOM/log control. A recognized closed/refused navigation is retried once and needs a healthy control. A denial takes precedence over a download. Private-candidate bodies and downloaded contents are never read.

| Variant | Disposable browser overlay | Expected evidence |
| --- | --- | --- |
| `golden` | None | Actual healthy controls and the application's actual candidate denials/fallbacks. |
| `public-server-script` | A main-page initialization script appends `<script src="/server.js">` on `DOMContentLoaded`; serve a harmless script at that URL. The script adds a visible public-resource marker. The original workspace document response and headers are unchanged. | The normal workspace navigation requests `/server.js` as a script and the visible marker appears **before** candidate probes. Direct navigation then returns that intentionally public script. Its filename does not establish privacy failure. |

The overlay is a controlled public-role alternative, not a claim about how the unchanged golden app serves `/server.js`. No HTTP response body is read to install it or classify privacy candidates. Supplied overlay text is generated fixture content rather than copied server source. Provenance records distinguish normal-use requests from later direct probes. The protocol remains a bounded sample, not proof that every possible private route is protected.

The retained first run's earlier HTML-response rewrite established the public script role but its two healthy-control completion waits failed. It did not establish a privacy defect. The current proof-only retry preserves the original response and adds bounded working-UI status/log/preview diagnostics plus browser-console events when a control fails. The main-page initialization script is guarded to the normal top-level workspace URL and does not modify preview frames or probe pages.

The exported `CLASSIFIER_CASES` matrix contains **hypothetical classification inputs, not runtime evidence**. It checks ordered denial/download precedence, working fallback, established public role, ordinary standalone exposure, request-only exposure, narrow unresolved ambiguity and actual tool unavailability. A generic normal-use fetch alone does not qualify for ambiguity. The narrow ambiguity example requires concrete affirmative legitimate-purpose evidence plus exactly one unresolved bounded clarification through that ordinary feature, with its missing observation recorded. It returns only `incomplete`, `product_pass: null`, and `observed_product_defect: false`; it is never also called an exposure. No runtime ambiguity witness is claimed or fabricated.

Syntax checking is permitted before freeze. Browser execution and final outcome binding belong to the parent runner after freeze. The final S06 ambiguity wording should be checked against `classifyCandidate` before that execution.
