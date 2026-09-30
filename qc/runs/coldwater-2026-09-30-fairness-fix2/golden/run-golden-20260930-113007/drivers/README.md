# Shared proof driver preparation

Prepared before the rewritten prompt freeze. No browser execution has occurred with these new modules. They produce no current criterion verdicts and contain no historical all-pass assumptions.

`workflow_core.cjs` provides a monotonic action/observation ledger, bounded explicit waits, actual request capture, exact rendered source and saved-field reads, independent observation failure recording, Run/Save/New/load helpers, and replay through an observed same-origin operation. It refuses the user-preview port 3420. A launcher must still supply a new disposable app/database and bind the actual fixtures/source/image before use. Importing the module opens no browser and makes no network request.

`baseline_flow.cjs` is a parameterized manual-Run/two-Save/reload plumbing sequence. Its observation rows have empty criterion IDs and `provisional:true`; they cannot be presented as the rewritten Functional coverage. The parent will provide frozen scenario fixtures and mapping before execution. The shared full workflow will call the canonical MCP restart only once, immediately after basic Save/load, through the external launcher; no restart is faked here.

Each new observation records its own result. A failed observation does not throw across later branches. A subsequent observation whose valid setup is unavailable must report that fact, not claim a pass or automatically classify it as a product defect. `all_observations_passed` is only a local probe summary; it is not an Oracle score.

Timing is nested: observation durations include actions and explicit waits. Request timing captures browser request-to-response, while the future outer launcher will capture MCP call and total process wall time. Do not add nested intervals or label this machine duration as LLM judge latency. List-response discovery is limited to normal JSON reads and must be stopped before privacy/boundary probes; probe response bodies are not inspected.

Only syntax/import smoke checks are appropriate before fixture freeze. The offline reference launcher uses the pinned local Playwright installation, never a provider or platform run.
