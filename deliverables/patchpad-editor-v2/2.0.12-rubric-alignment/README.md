# PatchPad 2.0.12 — rubric instruction alignment

Upload `patchpad-editor-v2.zip` from this folder. It contains 30 source-matching
task files under exactly one `patchpad-editor-v2/` wrapper. No reports, local
tests, credentials, databases, node_modules or authoring notes are packaged.

SHA-256: `ad5a4efa073dfa8b7fe5f031bee88567ac4049d78e6bd1ee0fd986c900debe08`.

## Supplied platform findings

The screenshot for the previous upload shows Static 45/45 and Rubric 51/53.
The two rubric categories were instruction/runtime-contract completeness and
grading unstated requirements. They identify three underlying brief gaps:

1. `editing.md` documented Escape from the editor into Find, but not Escape
   from Find back into the editor while preserving the selected match.
2. `overview.md` required idempotent seeding but did not request the
   server-backed document collection that the restart check reads.
3. `interface.md` requested the report but did not explicitly request its
   title on-screen, although all browser gates check that visible title.

## Changes

Only the three agent-facing notes above received substantive additions:

- Escape's two focus-dependent directions are now explicit. Returning from
  Find preserves the document selection for keyboard Copy or continued editing.
- A server-backed list of reports with their id/title/author is now explicit.
  It may be in the initial page-data response or a same-origin API. No exact
  endpoint name, JSON key convention or document-list sidebar is introduced.
  The existing no-duplicate seed and saved-history requirements remain.
- The supplied title, "Northwind API Incident Report", must remain visible
  while the report is open. No pixel position, style or new gate is added.

The golden implementation already supplies these behaviors, so its code is
unchanged. All 35 criteria, weights, verifier prompt bodies, test.sh, lifecycle
helper, seeds, runtime dependencies, timeout budgets, public/public networking
and OpenRouter-only wiring remain unchanged. The 2.0.11 missing-tool repair is
preserved. Source/package/prompt release markers are bumped to 2.0.12.

The Escape finding is a missing reverse action, not an inherent contradiction:
the documented editor-to-Find action remains intact. No requirement or check
was removed to make the rubric pass. Drawbill, Brickfall, GridForge, shared
context files and historical deliverables were not edited.

## Local validation and limits

`package-audit.json` contains 154 passing local assertions: all prior source
files present, instruction additions only, unchanged golden/verifier behavior,
35-criterion split (2/2/27/4), preserved tooling, LF/UTF-8, archive CRC and exact
source-to-ZIP hashes. These are not the platform's 45 static scripts.

Fresh runtime results are in `regression-result.json`, `local-validation.json`,
the browser/harness JSON files and `alignment.json`. The focused alignment
probe checks the live bootstrap's seed metadata, visibly rendered title and
both Escape directions with real keyboard Copy and unchanged server content.
The broader existing suite covers real persistence restarts and full saved
history, earlier Oracle failures, Unicode/clipboard, revision restore/Undo,
server rejections, manifest validity and negative controls. Harness stub
rewards are not Oracle/model scores.

The local container completed with exit 0. All four focused alignment checks
passed, as did syntax, 35-criterion discovery, empty-submission zero, five
valid/six invalid manifest cases, six QC and six baseline browser groups,
two real restarts, eight prior-Oracle-failure groups, six Unicode/clipboard
variants, fourteen additional groups, harness aggregation, two negative
controls and three document-end/preview/cut-Find targeted checks. These are
overlapping local regression groups, not a fresh 35/35 Oracle verdict.

Both exact new image builds were attempted and failed during package download
because the local configured proxy hostname could not resolve. See
`agent-build.log`, `verifier-build.log` and `build-results.json`. No host network
settings were changed. Runtime regressions use the existing
`patchpad-preflight-tests:2.0.9` tool image with current source mounted read-only
and isolated temporary app state; they are not a successful new-image build.

No paid Oracle/model, official static scripts or platform rubric was run here.
Previous 45/45 static and 51/53 rubric are for the prior upload, not this ZIP.
Fresh platform QC and Oracle are required; no 53/53 or Oracle 1.0 guarantee is
made. Historical model results must not be relabeled as this clarified brief.
