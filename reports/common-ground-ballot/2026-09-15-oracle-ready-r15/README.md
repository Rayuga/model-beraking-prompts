# Common Ground Ballot r15 — Oracle and model run candidate

Upload `common-ground-ballot.zip` from this release. It contains one
`common-ground-ballot/` folder, 37 files and task version `1.0.0`.

SHA256: `1cfa7ce8f032883e18a54ae2975c0a05cf5cdf18c0381c466372e7f5d4ab99b2`

This candidate supersedes r14 and follows the current root
`task-implementation.txt`. The adjacent reports are authoring evidence and
should not be added to the task ZIP. Historical run scores do not establish
Oracle success or a model score band for this checksum.

## Repairs

- Restored the required named RewardKit `weighted_mean` aggregate. The final
  scorer applies mandatory Render/Constraints gates, then Functional/Polish/Visual
  at 60/20/20. Numeric dimension weights exist only in their judge TOMLs.
- Separated combined observations into 56 criteria: Render 1, Constraints 2,
  Functional 39, Polish 8, Visual 6. Functional criterion weight remains 34 and
  Polish remains 12. Lifecycle transitions, write locks, sessions, identity,
  privacy, audit and keyboard behavior now have explicit independent owners.
- Made authorization checks cover every privileged action as Observer and both
  Members, with valid current targets and legitimate staff controls. Published
  immutability checks cover edits and each progression action.
- Aligned runtime instructions with public networking. Removed the external-asset
  prohibition and unrequested demo-button and touch-size requirements.
- Required the application to carry its seed in `/app`; the verifier no longer
  repairs a missing seed. Startup working directory, `DB_PATH`, `SEED_PATH` and
  relocation are documented and checked.
- Hardened cleanup so a judge crash or interrupted run cannot retain a positive
  intermediate reward. Preserved the MCP dialog protocol, independent browser
  contexts, immediate evidence capture and both post-mutation restarts.

The golden solution is byte-identical to r14. The current failures concerned
rubric, runtime and scoring behavior; no additional golden change was needed to
pass the expanded local checks.

## Validation of the frozen ZIP

Both shared checkers ran against the extracted upload bytes: **147 standard
checks and 400 archive checks passed**. CRC, wrapper, file count, source equality
and prompt/judge/runner/scorer provenance match the checksum above.

| Local suite | Passed groups |
| --- | ---: |
| Browser workflow, exact results, privacy and two process restarts | 45 |
| Verifier runtime, parsing, dependencies and isolation | 5 |
| Runner composition and failure handling | 19 |
| Session revocation and UI recovery | 7 |
| Actual pinned Playwright MCP workflow | 13 |
| RewardKit/scorer regressions | 103 |
| Observer/Member roles, identity forgery and Published locks | 40 |
| Theme, touch and reduced motion | 3 |
| Relative-path startup, relocation and durable restarts | 2 |

All **237 local groups passed**. These are engineering checks, not 237 scored
task criteria. All 56 task criteria are discovered by RewardKit. Its scoring
checks include every single-criterion failure, gate failures, malformed outputs,
weight-source changes and monotonicity. Ten malformed package variants were
rejected; a reduced-motion mutant failed only its own check. Agent-image smoke
checks confirm the current seed/instructions, native dependencies and absence of
the golden solution or verifier tests. Desktop/mobile screenshots were inspected.

`coverage.json` maps all 56 criteria to the product brief.
`local-source-review.json` records all 53 current authoring-review topics with
remaining external validation identified. It is not a platform QC report.
Drivers, raw logs and screenshots remain in
`reports/common-ground-ballot/2026-09-15-oracle-ready-r15/`.

## Required run order

1. Upload this exact ZIP and run platform QC. Resolve any new QC failure before
   spending a model run; retain the complete report.
2. Run Oracle and NOP. Accept Oracle only above 0.95 overall with **all 39
   Functional criteria passing**; inspect Render, Constraints, Polish and Visual
   verdicts too. NOP should score zero. An infrastructure error is not evidence
   that the product or model failed.
3. Run GPT on the same checksum. The saved overall acceptance band is 0.1–0.7,
   with an internal target at or below 0.5. Inspect the Functional score and
   individual failures separately; Functional above 0.7 should trigger another
   difficulty review even if the overall score is in band. Do not lower Oracle
   requirements or alter weights just to obtain a desired model score.
4. If model evidence supports acceptance, keep the package unchanged and run the
   final Oracle confirmation. Collect any additional model runs required by the
   submission tracker. Preserve full trajectories, individual verdicts, reward
   files, failures and task provenance with every export.

Any task, golden, prompt, rubric or runner change creates a new candidate and
requires fresh validation. Do not mix older scores with this package.

## Validation limits

No fresh scored Oracle, GPT or platform QC run has completed for r15. Local
runtime checks used current frozen files with already available pinned
dependencies: Express 5.1.0, better-sqlite3 12.4.1, Codex 0.151.0,
Playwright MCP 0.0.79 and RewardKit 0.1.7. Cached image assembly succeeded;
it does not prove that the shipped Dockerfiles build cleanly.

Both exact Docker builds were attempted but the configured package proxy
`ioclrndwg2.ds.indianoil.in` could not resolve. A direct npm-registry probe also
encountered the local certificate-chain problem. The task Dockerfiles were not
changed to work around this machine's network configuration. Clean builds must
be confirmed in the platform environment.

Harbor is installed but unauthenticated here, and the configured direct
`OPENAI_API_KEY` judge credential is absent. An OpenRouter credential is not a
substitute for that configured contract. Fresh judge completion, timeout
adequacy, visual grading and model discrimination remain external checks.
