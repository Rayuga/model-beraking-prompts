# PatchPad — public-runtime gate alignment

Upload: [patchpad-editor-v2.zip](patchpad-editor-v2.zip).

SHA-256: `808c94d11fa6462f3fb424e8ceb26a44353aba9172d0b4958aba80abdc11490c`

Task `patchpad-editor-v2`, version `1.0.0`, 32 files and one task wrapper.
There remain 39 criteria: 2 Render, 2 Constraints, 27 Functional, 3 Polish,
5 Visual. Agent and separate verifier networking both remain public.

## Latest platform finding and correction

The supplied v25 screenshot shows 45/45 static checks passing and one of 53
rubric checks failing: `global_browser_gate_is_present_and_correct_in_every_dimension`.
It rejects the blanket same-origin runtime restriction for this public-network
project. The earlier brief explicitly imposed that restriction; this release
changes the policy consistently in both the brief and verifiers rather than
leaving an instruction/verifier disagreement.

Seven task files changed from the bounded-interactions release:

- `overview.md` now explicitly permits public browser resources and network
  requests at runtime, including CDN scripts, styles, fonts and images. Node
  startup dependencies remain delivered with the app. The report, saves and
  revision history still use the local Node.js application and SQLite. Hosted
  databases/editor services and ready-made document editors remain prohibited.
- All five prompts have the same runtime-network paragraph. A resource's
  off-origin URL alone cannot fail a gate. A request failure matters only for
  its observed effect on required functionality; a working fallback is valid.
  The gates still require real working editor content and actual report delivery
  from the local application, accepting server-rendered HTML or embedded data.
- The first Constraints criterion is renamed from
  `same_origin_application_shell` to `local_application_entry`. It checks the
  local editor entry rather than banning external browser resources. Its weight
  remains 1.0 and the Constraints count remains two.
- Prompt revisions advanced: Render/Constraints/Visual r4;
  Functional/Polish r5. Task version remains 1.0.0 under the current standard.

All 27 Functional criterion definitions are byte-identical, including the
four-line offscreen selection and adjacent two-caret deletion fixes. All five
working-content blocks and the custom-editor prerequisite are byte-identical.
Golden code, seed data, other rubric definitions, criterion weights, judge
configuration, task.toml, Dockerfiles, lifecycle helper, runner and reward
formula are unchanged. An independent Astra/high review found no remaining
blanket origin ban or coherence blocker. Same-origin references that remain
apply specifically to local report-data/save probes, not arbitrary subresources.

## Fresh validation

- **113 unchanged standard checks plus 5 replacement public-runtime policy
  checks passed.** The shared checker still expects a same-origin prerequisite;
  those five obsolete assertions are explicitly superseded for this task by
  the latest user-approved QC policy. `validate-policy.py` replaces only that
  assertion in memory and records the shared checker's SHA-256. The shared
  checker and context/template files were not changed. This is not reported
  as a pass of the old same-origin rule or as platform semantic QC.
- **Cross-origin positive control passed:** real HTTP requests to a second
  loopback origin loaded CSS, JavaScript, a font and an auxiliary JSON response.
  The golden editor opened, supported a non-mutating Find/caret interaction,
  and reloaded with exact report content. The old blanket rule would reject
  this otherwise working fixture. No live public Internet request was needed.
- **Negative controls passed:** a custom-looking static clone failed the
  working-content probe; an interactive textarea failed the custom-surface
  rule. These are diagnostic checks of the intended boundary, not LLM grades.
- **18 preserved browser PASS observations** across the server-delivery,
  restart and previous-failures suites. Covered seed delivery, no-op and
  unsaved state, complete history, preview/restore/Undo, stale/invalid save
  rejection, actual process restarts, Find/Escape/focus, Unicode, redo
  invalidation and exact replacements.
- **13 bounded diagnostic groups passed**, including three repeats of each
  revised interaction, three repeats of each historical larger sample, and
  the intentional misplaced-caret reproduction. Every group confirmed exact
  reload content and independently unchanged stored content/revision/history.
  The misplaced-caret reproduction is not an application-feature pass.
- Real runner readiness, empty-submission zero, shell syntax and current
  prompt/judge/runner/reward hashes passed. Golden JavaScript syntax passed in
  the bounded suite. A trusted local stub verified runner wiring without an
  LLM: its 0.58 reward is synthetic, not an Oracle score.
- **27 synthetic reward combinations passed; 40 invalid/missing score cases
  were rejected.**
- Archive CRC, one wrapper, exact 32-file set and every source hash passed.
  No credentials, databases, node_modules, caches, notes, diagnostics or
  reports are inside the task ZIP. `git diff --check` passed for task source.

## Retained failed diagnostic attempts

The first two cross-origin fixture attempts failed before the asset server
received requests. Attempt 2 recorded Chromium's loopback-address-space
permission denial. The diagnostic then granted `local-network-access` only
to `http://localhost:3000` in its disposable browser context; it did not disable
general browser security or change the task/golden app. Attempt 3 passed all
positive and negative controls. The initial log, both failed records and final
successful evidence are retained. The initial combined regression-results file
therefore intentionally still includes the failed first fixture entry; it is
not represented as an all-pass run.

## Limits

No paid Oracle, model run or fresh platform QC was launched. No fresh exact
Dockerfile build or actual Internet-availability test was run; current source
was tested in disposable offline containers using cached
`patchpad-preflight-tests:2.0.9` tools. Local tests do not guarantee that the
platform judge will follow the revised policy or award Functional/Oracle 1.0.
The screenshot's 45/45 static and 52/53 rubric results describe the previous
uploaded package, not this new checksum. A new platform run is required.

Historical ZIPs/reports, other tasks and existing preview containers were left
untouched. No commit or push was performed.

Evidence:

- [Exact source scope and ZIP hashes](package-audit.json)
- [Seven-file diff](source-changes.diff)
- [Scoped standard checks and exception record](standard-checks.json)
- [Final cross-origin controls](network-attempt-3.json)
- [Original fixture failure](network-policy.cjs.log)
- [Loopback denial diagnosis](network-attempt-2.json)
- [Preserved regression results](regression-results.json)
- [Bounded repeated checks](bounded-results.json)
- [Runtime and synthetic reward checks](runtime-check.json)
- [Current prompt provenance](prompt-provenance.json)
