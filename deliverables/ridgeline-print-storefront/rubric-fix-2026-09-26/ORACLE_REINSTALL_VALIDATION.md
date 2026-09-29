# Ridgeline Oracle reinstall correction

The Oracle installer previously overlaid application files without removing `/app/app.db`. Because runtime seeding correctly skips an already-seeded database, installing the golden over an exercised workspace retained previous orders and depleted stock. A fresh workspace did not have this problem.

Only `projects/ridgeline-print-storefront/solution/solve.sh` changed for this correction. It now:

1. Resolves and validates the golden source directory before resetting state.
2. Checks process file descriptors for open handles to the canonical database or its SQLite sidecars. If any is open, installation fails with an instruction to stop the running application. It kills no processes.
3. Removes exactly `/app/app.db`, `/app/app.db-wal` and `/app/app.db-shm`, then installs the golden files.

The active-handle check uses file identity, so it is not limited to matching the spelling of an open path. It operates inside the installation container's Linux PID namespace and requires `/proc`. Installation is a stopped-app setup operation; normal application startup and the verifier's restart helper remain unchanged.

## Isolated regression evidence

`oracle-reinstall-check.cjs` ran in a new disposable `ridgeline-agent:20260926-hardening` container with networking disabled, no host port published, the solution mounted read-only and a separate evidence directory. Existing containers and run outputs were not modified. The container was removed automatically after completion.

All seven checks passed:

1. Fresh installation produced exactly eight prints, thirteen variants and the single historical `RP-100001` receipt, with its original dispatched status and £73.20 total.
2. Real checkout requests sold the last Slack Water A2 unit and two Long Field A3 units, producing two new orders and the expected stock deductions.
3. Reinstalling while the app was active exited with status 1, reporting that `/app/app.db` was open. The app stayed alive and its complete order/stock snapshot was unchanged.
4. A normal process stop/start preserved both purchases, depleted stock and original checkout retry identity. Retrying returned the original receipt without a second deduction.
5. After stopping the app, reinstallation removed the database and both existing WAL/SHM files. An unrelated file and an unrelated `.db` file remained unchanged.
6. Starting the newly installed golden restored every seed stock value and the exact original historical receipt. Both earlier purchase references returned 404; only the historical order remained.
7. A new post-reinstall purchase survived another normal process restart, and its checkout retry still returned its original receipt without another stock deduction.

Machine-readable results are in `oracle-reinstall-results.json`; app output is in `reinstall-app.log`. Bash syntax validation and LF/no-BOM checks passed. This was a local installer/runtime regression test, not a paid Oracle/model evaluation.

Final `solution/solve.sh` SHA-256: `926a0dd3d71d4c47e4f1c7e251fab8b6ac405800c8d32d26904cc1afd26f40ed`.
