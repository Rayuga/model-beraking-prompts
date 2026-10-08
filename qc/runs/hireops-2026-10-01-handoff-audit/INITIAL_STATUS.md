# HireOps handoff intake — 1 October 2026

This is the status before repairs, not release clearance.

The repository began clean on `main` at `2d6071cf19b215791a3416d679638d3b0367e3e1`.
The live task is `projects/hireops-recruiting-operations/hireops-recruiting-operations`.
All 35 task files match `deliverables/hireops-recruiting-operations/2026-10-01-current/candidate_manifest.json`
and its ZIP. The archive is 94,867 bytes, has one matching root, passes CRC, and preserves
0755 modes for both shell files. SHA-256:
`1ce5e2af6a125d259f73a4c5171dfde0285832f91bdf09704b8f02ac7a070b51`.
Actual counts are 86 Functional (weight 45), 14 Polish (weight 9), 6 Visual (weight 6),
and two one-criterion gates. See `local/input-binding.json` for exact file and image hashes.

The newer candidate is not the round7 candidate. Six task files differ from round7's
manifest. Six also differ from `hireops-2026-10-01-current-after-repairs`, and five from
`hireops-2026-10-01-independent-credit-review`. Their BLOCKED reports remain history;
old counts, branch names, archives and verdicts cannot establish current clearance.

Confirmed current task defects include stale gate-state wording, duplicate ownership
of `claimedTier` acceptance, misattributed unusual-ID lifecycle failures, missing explicit
replacement-grant price comparisons, and incomplete optional-claim coverage outside
approval. The deterministic reviewer also identifies missing honest-failure guidance in
Render and Visual prompts. The complete round and reconciliation may add findings.
Earlier role/identity bundling findings also need substantive reconciliation, not a vote.

Shared-template concerns are separate: the unchanged restart helper can report success
while a SIGTERM-resistant old process continues serving; final cleanup can wait indefinitely
for that process. Both were reproduced in a network-disabled container using the actual
shared scripts, with no provider execution. Browser-only evidence also cannot establish
mandated backend technology or the absence of an external backend. The shared harness,
scorer, restart MCP, Dockerfiles and scoring policy remain unchanged.

Missing measurements remain blockers: no current full configured GLM judge duration or
grade, no Oracle grade, no Luna builder/grade, and no configured-judge reward distribution
or ordering across weak/partial/strong apps. Local golden, mutation, parser, browser,
MCP and image tests do not supply those measurements. No provider spend or upload is
authorized or performed.

This audit uses `scripts/qc_pipeline.py prepare --mode single-per-row`, with frozen input
hash `adb13696bfe3e6c71690adc5c6af2002d5f107a10751c348ba8bc0f5401600b1`.
Each quality row is assigned to its own fresh context; the 48 deterministic checks use
one separate context. The task stays frozen until the entire round is reconciled.
