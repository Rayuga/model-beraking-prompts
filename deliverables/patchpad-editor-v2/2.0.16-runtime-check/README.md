# PatchPad 2.0.16 local Oracle preflight

Fresh exact-image build attempts are recorded in the two build logs and
`build-results.json` when the build driver finishes. The local attempt limit is
180 seconds per image; this does not change any shipped timeout.

Observed blockers before a paid local Oracle:

- Agent apt cannot resolve the configured corporate proxy
  `ioclrndwg1.ds.indianoil.in` and exits 100.
- Verifier pip requests to PyPI repeatedly time out. This is a local dependency
  download problem, not an observed editor/verifier assertion failure.
- OPENAI_API_KEY is not available in the current shell. Only its presence was
  checked; no secret values were read or printed. Configure it locally, not in
  chat or tracked task files, if a billable local run is approved.

Harbor CLI and Docker are available locally. No paid judge/API/model was invoked.
The user was asked to confirm one billable local Oracle before proceeding.
That run also requires resolving the environment prerequisites above.

The completed current-source deterministic/browser regressions remain in
`../2.0.16-verifier-fairness/`. They cover the previously observed golden failure
paths, revised fair Find checks, negative controls and restart persistence, but
are not an LLM Oracle grade. Remaining unmeasured risks include a real judge
mis-executing an ordered 27-criterion journey, account/model access and runtime
under max reasoning. No specific additional golden defect was found in this
preflight; this is not a claim that none can exist.

No task source or ZIP was changed. The upload SHA-256 remains
`89783ebf40b4167223d6b5c7de75ffb08d866a3a190d0e12917568e6fb357399`.
