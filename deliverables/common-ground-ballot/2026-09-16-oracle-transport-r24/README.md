# Common Ground Ballot r24

[Upload common-ground-ballot.zip](common-ground-ballot.zip).

r23 Oracle scored 0.4 because Functional's browser helper crashed before testing
the business rules. Both causes reproduced: helper file outside allowed roots,
then an unhandled `URL is not defined` error terminating Playwright MCP.

r24 gives Functional the correct private working directory and contains matcher
errors so the judge can fix its capture and continue. Golden app, all 71 criteria,
weights, timeouts and reward formula are unchanged.

The exact crash regression, 9 resilience checks, 19 browser recovery checks,
30 runner checks and 294 archive checks passed. Fresh full Oracle/platform QC
is still required; no new autonomous score is claimed.

[Full diagnosis and evidence](../../../reports/common-ground-ballot/2026-09-16-oracle-transport-r24/README.md).

SHA-256: `116e38d85b9a8417e71c71d349887733e94472ae3d50ee03b269658a31a7aaf0`.
