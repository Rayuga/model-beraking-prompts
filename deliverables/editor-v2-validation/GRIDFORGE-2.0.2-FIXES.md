# GridForge 2.0.2: second platform QC corrections

Upload gridforge-spreadsheet-v2-2.0.2-task.zip, not either older archive.
This is engineering evidence, not a platform QC verdict or full Oracle score.

## The four findings

1. Missing coverage: Functional now saves a distinctive cell and formula,
   restarts the actual server twice without deleting its database, and checks
   the complete stored workbook, revision history and workbook count from
   fresh browser contexts. Constraints now checks the required manifest start
   block, SQLite path and main workbook/revision API documentation. Manifest
   text is treated as untrusted documentation, never proof of app behavior.
2. Collapsed distinctions: the five named bundles are replaced by separately
   scored behaviors. Individual fixtures are established by each criterion,
   not taken on faith from earlier successes. General error handling no
   longer repeats the dedicated circular-reference tests.
3. Prompt versioning: every judge.toml and prompt.md now starts with the
   matching product/dimension/version marker, including Functional.
4. Prompt accuracy: GridForge gates refer only to a workbook, not a report.
   Render and Constraints are binary-only and no longer mention Likert.

## Score preservation

| Former group | New checks | Combined weight before / after |
| --- | ---: | --- |
| Workbook, custom surface, navigation, editing | 4 | 0.5 / 0.5 |
| Autosave, revisions, attribution, durability | 8 | 1.5 / 1.5 |
| Formula error handling | 2 | 1 / 1 |
| Circular-reference handling | 2 | 1 / 1 |
| TSV, CSV, clipboard, atomic paste undo | 5 | 2 / 2 |

Sub-checks use fractional positive weights to retain the original group mass.
The remaining 15 Functional criteria are retained. There are now 36 Functional
criteria with total weight 28, exactly as before the split. Whole-task scoring
still uses Render/Constraints as zero-mass final gates, then 60% Functional and
40% Polish. Total scored criteria: 44 (2 Render, 2 Constraints, 36 Functional,
4 Polish). No paid target run or score calibration was performed.

The generic Functional browser gate no longer tests custom-grid architecture;
that is its own scored criterion. This prevents an architecture failure from
automatically erasing unrelated working behavior.

## Lifecycle control and safety

tests/app-control.sh launches the same instructed npm start command as an
unprivileged user with a fresh explicit environment, tracks its process group
in private verifier logs, and performs bounded readiness checks.
tests/restart-app.sh invokes that trusted control without touching SQLite.
The initial verifier run alone clears the manifest-selected database; restart
never does. Final cleanup stops the currently tracked process, including one
created by a restart.

The judge is allowed to invoke only this fixed lifecycle command for the
restart criterion. It must use the actual browser/API for stored-state proof
and may not inspect app source, alter data directly, or reset the database.

## Validation performed

- Agent and verifier images build, real RewardKit discovery succeeds, and
  all shell scripts and reference JavaScript pass syntax checks.
- Empty-submission verification produces reward zero.
- All seven golden browser smoke groups pass. New restart regression proves
  full stored workbook, revision history and workbook-list equality across
  two server restarts, including Q70=RESTART-Q70 and raw R70 =7*8 / result 56.
- Earlier D2=390 delete/Undo, formulas, dependency/cycle recovery, UI save,
  forged-user nonmutation and same-origin/no-fatal-error regressions still pass.
- Automated assertions check all eight prompt-version markers, removed text
  residue, criterion count, and equal old/new Functional weight totals.
- The uploaded task contains only task files; lifecycle scripts are referenced
  verifier dependencies, not scratch files. Reports stay outside the ZIP.

The golden app implementation did not require algorithm changes. Its package
version changed; dependency pins and integrity entries remain intact.
Full Luna-driven Oracle and the platform's new 53-check review remain pending.
Other substantial feature criteria still exercise connected scenarios; this
change does not claim mathematical determinism or promise no future QC finding.
