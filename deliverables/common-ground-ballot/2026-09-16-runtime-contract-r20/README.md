# Common Ground Ballot r20

[Upload common-ground-ballot.zip](common-ground-ballot.zip).

Repairs the static runtime-contract mismatch: private evaluator utilities are
standalone executable commands, while the application entry remains server.js.
Golden app, task requirements, rubric, weights and timeouts are unchanged.

31 focused checks, 30 exact-runner checks and
294 ZIP checks passed. Real golden startup/restart and session/data
survival passed through two runner invocations. Fresh platform QC/Oracle remains
unverified; runtime testing uses cached dependencies.

[Full report](../../../reports/common-ground-ballot/2026-09-16-runtime-contract-r20/README.md).

SHA-256: `04d5cbc8cab8c7e71494cdf4b4f4c1acc68a928428d8b65556a759101b028b45`.
