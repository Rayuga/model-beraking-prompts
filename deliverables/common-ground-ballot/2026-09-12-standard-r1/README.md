# Common Ground Ballot: Current Delivery

Upload `common-ground-ballot.zip`. It contains exactly one `common-ground-ballot/`
wrapper and 36 task files. Source: `projects/common-ground-ballot/`. Task version
is `1.0.0`, as required by the current lead template. Agent and verifier networking
are public. Historical releases have not been overwritten.

## Changes

- Matched current reference configuration, central provider settings, pinned judge
  tooling, max reasoning, five dimension budgets and required gated reward formula.
- Added Visual as the fifth dimension. There are 33 criteria: Render 2,
  Constraints 2, Functional 19, Polish 4 and Visual 6. All 19 existing Functional
  criterion weights are preserved; appearance now has its own anchored criteria.
- Added explicit prompt versions, runtime prompt hashes and independent scoring
  in every batch. External asset violations are scored in Constraints, not used
  to zero the whole run. This applies the September 12 platform QC lessons.
- Clarified negative controls, invalid-vote ordering, actual credential revocation
  probes, SQLite evidence and audit timestamps. Tests must use observed request
  shapes, not assume implementation-specific routes or fields.
- Kept seed data byte-identical. Golden server/client behavior is unchanged;
  solution package version and text line endings were normalized. The interface
  brief now explicitly supports the presentation dimensions being graded.
- Kept coverage, reports, scripts and screenshots outside the delivered task.

## Evidence

Both exact Dockerfiles built successfully. `validation.json` records image IDs
and successful runtime, browser and harness exits. Supporting results:

- `standard-checks.json`: 112 local template checks passed.
- `browser-results.json`: 13 golden workflow groups passed, with no page errors.
  Includes roles, malformed/non-authorized writes, eligibility snapshots, private
  votes, retries, stale writes, publication, SQLite, session revocation, actual
  process restarts and responsive/theme/focus behavior.
- `harness-results.json`: 12 synthetic score and startup tests passed. These test
  reward normalization and readiness failures, not the LLM judge's verdicts.
- `agent-preflight.json`: three agent-image checks passed, including dependencies,
  public HTTPS access and separation from verifier/golden files.
- `before-after.json`, `coverage.json`, `source-hashes.json`,
  `prompt-provenance.json`, `package-audit.json` and `SHA256SUMS.txt` record the
  changes, coverage and exact packaged bytes. Screenshots are supplementary.

No fresh full Oracle, model evaluation or platform QC was run. Historical v0
Oracle results do not validate this package. Local tests do not guarantee every
LLM-judged criterion, a Visual score of 5, or a platform QC pass.

## Remaining Evaluation Limits

The required formula can award 0.4 when Functional is zero and Polish/Visual are
perfect, provided both gates are positive. The runner replaces RewardKit's
intermediate aggregate with that required formula. These are intentional template
semantics, not changes made to influence scores. Provider behavior and unpinned
transitive infrastructure can still vary despite recorded versions and hashes.
Shared workflow prerequisites must not cause unrelated criteria to fail together.

## Resume on Another Device

From the repository root, run `python deliverables/common-ground-ballot/2026-09-12-standard-r1/validate.py`
with Docker available. This rebuilds the images and runs local checks without an
API key. Then run `finalize.py` in this folder to regenerate the ZIP after the
evidence passes and matches the source. The agent-image preflight evidence should
also be refreshed if its Dockerfile changes. Migration/edit helper scripts are
one-time authoring tools, not repeatable validation commands.

Keep `common-ground-ballot-v0` and historical deliveries unchanged. Do not copy
these external reports into the task root. Next required external steps are
platform static/rubric QC and a fresh full Oracle run against this exact ZIP.
