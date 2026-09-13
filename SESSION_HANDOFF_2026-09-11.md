# Codex session handoff — 11 September 2026

This is an operational context export, not a verbatim chat transcript. It records
the user's goals, accepted decisions, actual changes, evidence, unresolved work,
and current repository state. Full current authoring rules, today's lessons,
and the Gridforge handoff are embedded in the appendices below so this file can
be imported by itself. Read this opening state summary before those appendices:
some appendix sections deliberately preserve superseded historical decisions.

## Start here in the next instance

The user is developing browser-judged web-development benchmark tasks. They want
natural product briefs, instruction-backed discriminating verifiers, reliable
golden solutions, compliant configuration, and passing platform QC/Oracle runs.
They want actual implementation and validation, not just suggestions. Do not
make a broken solution pass by dropping legitimate required behavior.

Most recent completed work: three PatchPad rubric findings were fixed, checked,
packaged, and pushed. Brickfall work was interrupted for those fixes and is
unfinished. A separate-instance prompt was written for Gridforge v3. Do not
assume another agent has actually started or completed Gridforge work.

The immediate user request was to export context for another instance. No new
platform result has been supplied after the latest PatchPad fix. If continuing
the primary work, resume Brickfall after checking current Git state and any new
user instructions. Leave PatchPad's validated package intact unless the user
requests another change or supplies new feedback.

## Workspace and Git

- Workspace: `F:\Documents\turing-workspace\model-beraking-prompts`.
- OS/shell: Windows, PowerShell. Python 3.12 and Docker are available.
- Repository: `https://github.com/Rayuga/model-beraking-prompts.git`.
- Branch: `main`; remote: `origin`.
- Last pushed commit at export: `f06bef352562591901cd8ea58f9dc90e81ea3d69`.
  Message: `Save task updates, reference projects and PatchPad rubric fixes`.
- Earlier session commit: `755b25005c6bf847fcbc576babca711f5335bd55`,
  `Align PatchPad with task standards and document September 11 lessons`.
- User explicitly requested **push all**. All 494 pending non-ignored files were
  committed/pushed in f06bef3, including Gridforge, references, reviewed run
  exports, and documented Brickfall work in progress. No deletions were staged.
- Before creating this handoff file, working tree was clean and remote main
  matched HEAD. This export file is newly created and is not part of f06bef3.
- Existing `.gitignore` excludes local credentials, node_modules, databases,
  caches, logs and certain raw agent session/completion exports. They were not
  force-added. A credential-pattern scan of pending files and ZIP members found
  no matches; this is not a claim of exhaustive secret detection.
- Preserve original reference projects, old ZIPs, run evidence and other tasks.
  In shared-instance work, do not reset/stash/overwrite another instance's edits.

## User preferences and scope decisions

- Explain issues simply, with concrete before/after examples. They often ask
  whether a QC complaint is genuine or a platform bug. Inspect actual files;
  a reference passing does not prove contradictory settings are correct.
- They dislike repeated permission questions and unfinished implementation.
  Continue authorized reversible work. Do not send Slack messages yourself;
  earlier requests were to draft short informal messages for the user to send.
- No comments in authored task code/config. Preserve shebangs, real Markdown
  requirements and meaningful headings. **Latest correction:** preserve prompt
  version identifiers as plain text; deleting all identifiers caused QC failure.
- Keep task version literal `1.0.0`; identify new releases with folders/hashes.
- Keep Visual appearance-only and final 60/20/20 weights. PatchPad specifically
  has no responsiveness criterion and is evaluated only at 1280x800. Do not
  silently apply that exception to Brickfall or Gridforge.
- Some speculative verifier changes and the nonfunctional-app score-floor issue
  were explicitly deferred. Do not describe them as fixed or silently redesign
  the scoring policy to eliminate them.
- Local tests are not a full LLM Oracle or platform semantic rubric verdict.
  Do not promise a pass that has not been observed on the exact final package.

## Source projects and references

| Role | Path | Status |
| --- | --- | --- |
| PatchPad current source | `projects/patchpad-editor-v2/` | Latest fixes packaged and pushed |
| Brickfall current source | `projects/brickfall-breaker-arcade/` | Partial standard migration, unfinished |
| Gridforge v3 | `projects/gridforge-spreadsheet-v3/` | Awaiting separate-instance migration/review |
| Gridforge v2 | `projects/gridforge-spreadsheet-v2/` | Preserved separate project; do not substitute it for v3 |
| Lead configuration baseline | `projects/bazaarbridge-marketplace-commerce/` | Exact key/timeout/env baseline |
| Approved weight/procedure reference | `projects/docketlight-claims-insurance/` | Top judge weights and Setup/observation pattern |
| New user-reported passed reference | `projects/torquebay-repair-operations/torquebay-repair-operations/` | Note nested directory |
| New user-reported passed reference | `projects/boardloom-infinite-canvas/` | Useful procedures; obsolete configuration |

The user reports Torquebay and Boardloom passed. We did not independently run
them or verify an attached platform pass artifact. Boardloom has older four-
dimension scoring, version 1.1.0, different timeouts and extra keys. Torquebay
has five dimensions but different judge weights/time allocations. They do not
supersede the lead's explicit current configuration requirements.

## PatchPad: exact latest package and fix

Release directory:
`deliverables/patchpad-editor-v2/1.0.0-rubric-coverage-provenance/`.

Upload: `patchpad-editor-v2.zip` in that directory.
SHA-256: `604d91c7514882c8f3fdb2f6b8a5844eac6ba47904f2b28d41ffc71049f74fc1`.
Version 1.0.0, 32 files, one `patchpad-editor-v2/` wrapper, 39 criteria:
Render 2, Constraints 2, Functional 27, Polish 3, Visual 5.

The latest screenshot reported:

1. `dimensions_cover_every_graded_requirement`: editing.md requires document
   line numbers, but only cursor status was explicitly graded.
2. `verifier_is_deterministic_and_offline_pinned`: all five prompt-version
   identifiers had been removed, preventing identification of prompt changes.
3. `dimension_prompts_are_accurate_and_consistent`: same missing identifiers,
   plus leftover Docketlight, reference-template and marketplace wording.

User asked to apply the fixes. Seven task files changed:

- `tests/functional/judge.toml`: append an explicit document-line-number
  observation to `keyboard_navigation_exact_coordinates`, retaining weight 1.0
  and all existing movement requirements. Check first, fifth/sixth and final
  lines against their visible labels after scrolling. Status-only is not enough.
  Accept consistent 0/1-based numbering and virtualized rows; no fixed gutter
  element/placement or offscreen DOM representation is required.
- All five `tests/<dimension>/prompt.md`: start with `Task version: 1.0.0` and
  `Prompt version: patchpad-editor-v2-<dimension>-v1.0.0-r1` as plain text.
  Functional explains Setup directly; Visual drops unrelated product/template
  references. No task code comments were reintroduced.
- `tests/test.sh`: before startup, record prompt versions and SHA-256 hashes
  for all prompts/judge files, runner and reward configuration. Write
  `$LOG_DIR/prompt-provenance.json` and a `Prompt provenance:` stdout record.
  Final scoring block was preserved exactly.

No golden app, seed, Dockerfile, task.toml, weights, criterion IDs/counts, or
other criterion definitions changed in this correction.

Validation completed:

- **118 standard checks** with the updated checker.
- One fresh offline browser test runs the full existing navigation sequence,
  verifies visible line numbers at top and tail, and checks unchanged document
  text. A temporary browser-only negative control hides the gutter and confirms
  the cursor status still exists but line-number evidence does not.
- Real current runner startup, shell syntax, empty submission zero, all logged
  hashes, stdout provenance, and five-dimension CTRF verified in a fresh offline
  container with cached `patchpad-preflight-tests:2.0.9` tools.
- Trusted local judge stub injected Functional .5, Polish .8, Visual .6 with
  both gates 1; runner correctly yielded **.58**. This is not an Oracle score.
- Parsed scope/preservation checks, whitespace, ZIP CRC and exact ZIP/source
  byte equality passed. Exact Dockerfiles were unchanged; no new image build or
  full model run was performed for this correction.

Useful release files: `README.md`, `package-audit.json`, `standard-checks.json`,
`VERIFIER_BEFORE_AFTER.md`, `verifier-changes.json`, `runtime-check.json`,
`line-number-check.json`, `prompt-provenance.json`, `line-numbers-top.png`,
`line-numbers-tail.png`, `check-runtime.py`, `check-line-numbers.cjs`,
`run-local.py`, `package.py`, and `before-rubric-fixes.zip`.

`apply-fixes.py` is a one-time migration and refuses to overwrite its before
snapshot. Do not rerun it on the already-fixed source. `run-local.py` reruns the
focused diagnostic; `package.py` rebuilds only this release and asserts scope.
Preserve run evidence if a new attempt or source revision is made.

## PatchPad: earlier work and evidence still relevant

Earlier QC fairness repairs allow actual API identity locations, legitimate
scroll containers, any consistent indentation width, and normalized 0/1-based
coordinates. Exact behavioral requirements remain.

Three failed Oracle criteria (Tab reversal, offscreen selection, clipboard)
were reproduced successfully against unchanged golden code. Judge reasoning
reported lost transient checkpoints, rejecting a supported gutter anchor, and
cutting the wrong line. Procedures now distinguish Setup from numbered graded
observations, verify focus/targets, and persist plain text immediately. Native
judge tool transcripts were not exported, so complete original actions could
not be independently reconstructed. No recorded scores were rewritten.

Golden presentation was improved in `1.0.0-docketlight-procedures`: distinct
report title, section emphasis, contained desktop editor/history scrolling,
larger readable revision preview. It passed **29 browser regression groups**
and the then-current **108 standard checks**. Those were prior tests on the same
golden app, not new full judge results. The newest release adds the focused
coverage/provenance validation above.

Historical five-trial analysis is under
`deliverables/patchpad-editor-v2/1.0.0-oracle-reliability/RUN_REVIEW.md` and
`run-analysis.json`. All five supplied trials used the same platform checksum:
`e93af31ea3512603b0ed2c1dbcacd669e1165b227de398c8f70f74747f99b63d`.

| Trial | Final | Functional | Polish | Visual |
| --- | ---: | ---: | ---: | ---: |
| Oracle | .8877 | .8795 (24/27) | 1 | .8 |
| Gemini 3.7 Flash | .5678 | .5241 (14/27) | .6667 | .6 |
| Haiku 4.5 | .3033 | 0 (0/27) | .6667 | .85 |
| GPT-5.4 mini | .5291 | .2651 (7/27) | 1 | .85 |
| No-op | 0 | Not graded | Not graded | Not graded |

Raw exported folders now in the pushed repository, subject to ignore rules:

- `run-outputs/patchpad-editor-v2/run-1bea0cf2-9fde-4c58-9302-86f42c979f49`
  (Oracle and no-op).
- `run-outputs/patchpad-editor-v2/run-4c06c380-e252-4a9c-ab96-4c8a1d6584f1`
  (Gemini).
- `run-outputs/patchpad-editor-v2/run-8b405014-ee0d-43bd-99dc-57b2083661ff`
  (Haiku).
- `run-outputs/patchpad-editor-v2/run-a7d98acc-c194-47ce-9e57-0da0b8f5104d`
  (Mini).

These scores predate current fixes/presentation changes. If prior nonfunctional
scores remained unchanged and Functional reached 1, the arithmetic would be .96,
but that was only a conditional calculation, not an observed new score.

## Brickfall: unfinished work to resume

The user explicitly asked this instance to work on Brickfall while another
instance works on Gridforge. Started migration, then paused it at the user's
request to address PatchPad. The partial source is now committed in f06bef3.

Progress directory:
`deliverables/brickfall-breaker-arcade/1.0.0-reference-standard/`.
Read its README. Files include `migrate.py`, `before-reference-standard.zip`
and `verifier-changes.json`. There is **no finished current upload ZIP**.
Do not rerun `migrate.py`; it deliberately refuses to replace the baseline.

Already changed:

- Task configuration to exact Bazaarbridge keys, version 1.0.0 and timeouts.
- Dockerfiles to reference structure with required Brickfall XLSX dependency
  and seed-copy adaptations retained.
- Five verifier folders and final 60/20/20 formula with five-dimension output.
- Top judge weights 1/1/.6/.2/.2 and budgets 600/600/9000/900/900.
- Render 2, Constraints 2 and **all 22 Functional criteria preserved exactly**.
- Polish changed from seven mixed behavior/aesthetic criteria to five binary
  interaction/accessibility checks. Six reference Visual axes added; includes
  responsive presentation because Brickfall's brief requires 375px support.
- Global gate made explicit in all dimensions, using seeded Polly login and an
  actual read-only protected request without assuming a particular GET route.
- Functional shared procedure adds stable accounts, focus/target verification,
  immediate checkpoints, recorded requests for replay, and safe setup handling.
- Removed task configuration/runner comments; golden game/server code untouched
  apart from package version. Total current criteria: 37.

Initial migration passed **106 checks in the checker before prompt-version
requirements were added**. It has not had fresh browser/runtime tests, full
rubric review, exact Docker builds, or Oracle. Current checker will require
plain-text prompt identifiers not yet added to Brickfall. Add those and logging,
review the new Polish/Visual split for requirement coverage/fairness, then test
and package. Do not report migration as complete merely because it was pushed.

Existing useful diagnostic material:

- `deliverables/brickfall-breaker-arcade/2.0.5-openai-standard/`: `local.py`,
  `check.py`, `targeted.cjs`, `expected-digests.json`, reports and old build logs.
- `deliverables/brickfall-breaker-arcade/2.2.2-rubric/browser-regression.cjs`.
- `deliverables/brickfall-breaker-arcade/2.0.1-browser-gate/gate-regression.cjs`.
- Cached image `brickfall-preflight-verifier:2.0.4`.

Old diagnostics hardcode four dimensions, seven Polish checks, five Likert
criteria and 60/40 arithmetic. Copy/adapt them into the new release folder;
do not overwrite historical evidence. The gate loop must include Visual.
Test exact new runner/no-op/reward math and the relevant interaction criteria.
Gameplay has seven deterministic non-scoring drills, seeded Mira/Dev saved
checkpoints, account-wide bearer revocation, transactional revisions/receipts,
saved histories and global leaderboards. Preserve these requirements.

Historical 2.0.5 diagnostics passed four gate groups, twelve general browser
groups and eight targeted groups. Exact builds stalled on Debian/PyPI downloads.
Legacy platform results (different package): Oracle 1.0, GPT .2182 with
Functional 0, Haiku 0. These do not validate current migration; Haiku also has a
different platform checksum from that legacy Oracle/GPT pair.

## Gridforge v3 assignment

Full copy-paste instructions are in `GRIDFORGE_V3_CODEX_HANDOFF.md` and embedded
below. Current v3 source is still version 3.0.0/four-dimension configuration at
this export. It needs migration to fixed task version 1.0.0 without renaming
the v3 project directory, complete rubric review, golden validation and a ZIP.

Original timeout screenshot: allowed serial judging total 12550 seconds inside
a 12000-second wrapper, with only a 12600-second outer verifier. That is a real
budget inconsistency, not automatically a platform bug. Standardize the nested
budgets rather than trusting that a similar task passed previously.

`deliverables/gridforge/README.md` points to v3's old 3.0.0 package and preserved
v2 releases. Historical v2 2.0.10 scores were Oracle .9545, GPT .2697, Haiku .0268,
Gemini .6848. They do not validate v3. Do not migrate or overwrite v2 by accident.

## Known unresolved rubric and policy risks

- Nonfunctional apps can still collect Polish/Visual credit; actual Haiku
  Functional 0 / final .3033 is evidence. The user deferred changing this and
  insisted Visual remain appearance-only. No fix was claimed.
- Pinned RewardKit 0.1.7 includes positive gate judge weights in its intermediate
  aggregate; test.sh replaces it with the required final gated formula. Latest
  .6/.2/.2 judge-weight alignment does not eliminate this distinction. Setting
  gate judge weights to zero can collapse their dimension score to zero.
- Individual criterion weights are not averaged to derive the top judge weight.
  A supposed universal .5–2 limit versus reference weights up to 5 was left as a
  lead clarification. Do not invent that policy.
- Deferred PatchPad assumptions include wrapped/logical-line navigation,
  triple-click newline convention, extra no-op Save feedback, specific shortcuts,
  GET-only reads, timestamp parseability, and observing error feedback under a
  Polish procedure that disallows editing. See lessons for detail.
- Latest plain-text prompt identifiers and hashes improve provenance, not
  deterministic model behavior. Platform QC must judge the actual new package.

## Runtime environment and tool cautions

- Current local preview: `http://localhost:3035/`, container
  `patchpad-golden-preview-100-docketlight`. Its app matches the latest golden
  app (latest fix changed verifiers only), but do not treat it as a new Oracle.
- Older previews still running: `patchpad-golden-preview-100-desktop` on 3034,
  `patchpad-golden-preview-2016` on 3033. Leave them unless asked to clean up.
- Unrelated `conkur-postgres` runs on host 5434. Do not stop it.
- Docker cached images include PatchPad 2.0.9 and Brickfall verifier 2.0.4.
  Fresh temporary test containers can mount current source read-only with
  `/app` and `/logs/verifier` as tmpfs and `--network none`.
- A real configured judge credential was unavailable during local work. Do not
  assume it is still unavailable: inspect availability without printing secrets
  if a full judge run is requested. No paid full run happened this session.
- Preserve exact source/ZIP/run checksums. Archive directories and old scores
  are historical, not proof for a changed task. Read current source, not copied
  app artifacts, when implementing a fix.
- No active background test/build processes or delegated agents were left by
  this session; the preview containers above are the intended long-lived work.
- Use UTF-8 explicitly in Python subprocess/text operations. PowerShell's
  default code page produced mojibake in displayed imported reports and caused
  one captured `git diff --check` decode failure; retry with UTF-8 succeeded.
  Do not assume displayed mojibake means file corruption.

## Suggested next-instance opening instruction

Read this handoff, then inspect current Git status and the newest user message.
Treat the live repository and explicit later user instructions as authoritative.
If assigned the primary session, resume unfinished Brickfall work, incorporating
the latest prompt-version/coverage lessons; keep PatchPad's latest package intact.
If assigned Gridforge, follow the embedded Gridforge handoff and avoid Brickfall.
Report actual fixes, test evidence, archive paths and remaining limits plainly.

---

The following appendices are verbatim snapshots of the current supporting
Markdown files at export. Historical passages inside them remain historical;
the current state above and later corrections in each document take precedence.


# Appendix A: Current mandatory task standard

Source: `TASK_TEMPLATE_STANDARD.md`.

# Current task template standard

Decision history and evidence: [11 September lessons](TASK_LEARNINGS_2026-09-11.md).

Effective 2026-09-11, from the user's manual QC instructions. This supersedes
older four-dimension, provider-pinning and version-increment rules in this
repository. Canonical reference: `projects/bazaarbridge-marketplace-commerce/`.
Later user-approved weight reference: `projects/docketlight-claims-insurance/`.
Use its top-level `[judge] weight` values: Functional 0.6, Polish 0.2,
Visual 0.2, Render 1.0 and Constraints 1.0. This supersedes Bazaarbridge's
judge weights only; the other configuration and timeout rules below remain.
Criterion weights are independent and are not changed by this update.

## Configuration

- Copy the reference `task.toml` table/key structure exactly. Do not add keys.
  Change task identity and descriptive metadata for the new product. Preserve
  all operational values, including `schema_version = "1.4"`,
  `artifacts = ["/app"]`, and literal `version = "1.0.0"` (the v1.0.0 release).
- Agent timeout: 7200 seconds. Environment build timeout: 600 seconds. Verifier
  timeout: 13200 seconds. Preserve public agent/verifier networking, separate
  verifier mode, 2 CPUs and 4096 MB memory. Do not add storage or other keys.
- Preserve `[verifier.env]` exactly as the reference: the supplied
  `OPENAI_API_KEY = "${OPENAI_API_KEY}"` placeholder, `REWARDKIT_JUDGE = "codex"`,
  `REWARDKIT_MODEL = "gpt-5.6-luna"`, and `REWARDKIT_REASONING_EFFORT = "max"`.
  Never put an actual credential in the package.
- Follow the reference's `environment/Dockerfile`, `tests/Dockerfile`, and
  `tests/test.sh` structure. Adapt task-specific seed/instruction paths, labels,
  entry points and lifecycle helpers as needed for the documented app contract.
  Keep the reference base-image/tool/dependency versions and judge configuration.
  Do not copy marketplace-specific database, sign-in or clock logic blindly.
- Neither Dockerfile nor `tests/test.sh` may mention OpenAI/OpenRouter API keys,
  even in comments. The reference's provider package names are not key mentions.
  In the verifier Dockerfile set `model_reasoning_effort = "max"` as shown.
- Keep all five verifier directories under **`tests/`** (the reference spelling):
  `render`, `constraints`, `functional`, `polish`, `visual`. Each has `judge.toml`
  and `prompt.md`; retain the `[judge]` table but remove `judge` and `model` keys.
  Do not add a per-judge `reasoning_effort` override or other non-reference keys.
  Provider, model and effort come from the common task environment/configuration.
- Copy each corresponding reference judge's configuration fields. Timeouts are
  Render 600, Constraints 600, Functional 9000, Polish 900, Visual 900 seconds.
  Their sum is 12000. Run serially with `--max-concurrent-agent 1`, inside the
  reference's 12600-second wrapper and 13200-second verifier limit. The extra
  600 seconds at each level covers overhead; budget sufficiency still needs
  actual run evidence. Do not increase timeouts independently for new tasks.
- Keep the task version fixed at `1.0.0` under this standard. Distinguish revisions
  using dated delivery folders, source/ZIP SHA-256 hashes and validation reports,
  outside the task configuration. Do not overwrite historical evidence. Material
  changes still require fresh validation and runs on the exact final checksum.
- Per the user's later instruction, omit comments from authored task code and
  configuration, including copied reference header/feature comments. Remove
  code-comment prompt-version banners as well. Retain prompt identifiers as
  ordinary Markdown text: `Task version: 1.0.0` and a dimension-specific
  `Prompt version: <task>-<dimension>-v1.0.0-rN`. Increment the prompt revision
  when that prompt changes, and log SHA-256 hashes of every prompt and judge
  configuration plus the runner and reward configuration. The latest platform
  QC explicitly requires prompt-version identification; this supersedes the
  earlier blanket removal of these markers. Retain executable shebangs and meaningful Markdown
  headings, product requirements, seed data and judge instructions. Do not
  mistake URLs, CSS colours, regex literals or strings for comments. This rule
  supersedes older instructions to add prompt-version code comments. Historical
  reference packages remain unchanged.

## Scoring and visual verification

Use the reference `reward.toml` and this exact final formula in `tests/test.sh`:

```python
if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]
```

Validate all five dimension scores as finite numbers in `[0, 1]`, excluding
booleans. Include all five dimensions in initial/fallback rewards and CTRF
output. Preserve the reference's post-processing and completion fields. Test
zero gates, partial positive gates, mixed scores and malformed/missing scores.
Where a task needs an all-pass prerequisite, enforce it in that dimension;
do not silently change the final gate to `< 1.0`.

Every dimension's prompt must explicitly state a `Global browser gate:` before
scoring: a substantive working local page without fatal errors, same-origin
runtime requests, and zero for every criterion if the gate fails. For a
server-backed product, observe the populated server response used by the UI;
a rendered static mock is insufficient. Include authentication checks only
when the product requires authentication. Visual also needs this prerequisite,
even though its scored criteria assess appearance. Do not replace it with only
"a reviewable page renders." Local preflight wording checks do not establish
that the platform's full prompt checker will pass.

Functional measures behavior and server correctness. Polish measures concrete
interaction usability, keyboard/focus access, labels and feedback. Visual
measures the rendered appearance: typography, colour/contrast, spacing/layout,
hierarchy/scannability, overall craft and responsive visual consistency. Use
the reference's six independently anchored visual criteria, adapted to the
product's documented surfaces. Do not reward the same aesthetic assertion in
Polish and Visual. State presentation requirements in the product brief too.

Explicit PatchPad exception (2026-09-11): the user removed responsiveness.
PatchPad uses the remaining five equally weighted Visual criteria at 1280x800
only, with no mobile requirement. Visual still contributes 20% of reward.
This exception does not change the Bazaarbridge default for other tasks.

Use browser screenshots and visible surfaces for Visual. Do not inspect source,
infer behavior from appearance, demand the golden solution's pixels, or copy
unrelated marketplace requirements. Require multiple themes only when the task
brief requires them. Preserve the reference's explicit integer 0-through-5
anchors and return a verdict for every criterion. A visual addition changes
the score distribution: previous four-dimension Oracle/model scores are historical.

## Preflight and oracle reliability

Grade behavior required by the supplied product brief. When the brief leaves
an implementation choice open, discover and test the submitted app's actual
contract instead of requiring the golden solution's API route shape, scroll
container, indentation width or coordinate display base. Preserve exact
behavioral outcomes, real interactions and data-integrity checks. Make a probe
conditional only when its premise does not exist in the observed contract,
and require evidence for that non-applicability; other checks remain mandatory.

Map each explicit product requirement to a graded observation. A cursor-position
check does not establish that document line numbers are displayed. Check required
line numbers against the visible logical lines, accepting consistent zero- or
one-based labels and virtualized rendering. Keep delivered prompts self-contained:
describe setup and observations directly without naming another reference task
or leaving unrelated product surfaces in the instructions.

For long interaction criteria, follow Docketlight's explicit Setup line and
numbered graded observations. Reach the setup through the app's supported UI
without treating incidental navigation choices as separately graded behavior.
Keep each required interaction and exact outcome in the numbered observations.
Do not copy API-based setup into a criterion that must establish real editor
input, selection or clipboard behavior.

Before packaging, compare parsed task key paths and operational values with the
reference, verify exact verifier.env equality, verify every judge config key
set, scan the Dockerfiles/runner for prohibited key mentions, and calculate
timeout nesting and reward outputs mechanically. Build both exact images and
run startup, lifecycle and relevant behavior checks. A cached older image is
useful diagnostic evidence but does not validate the new image.

For surprising oracle failures, inspect action evidence before changing the app
or rubric. Improve measurement and instructions without reducing requirements:
verify focus/click targets, measure glyph bounds, await responses and visible
alerts, and record compact exact evidence before leaving transient states.
Preserve each checkpoint before another mutation. Do not infer a failure from
an action that never ran or award a pass from missing evidence. For an
unsaved-only criterion invalidated by a demonstrated judge setup/serialization
error, permit at most one complete fresh attempt after ordinary reload/discard
and verification that server content, revision and history are unchanged.
Record the invalid attempt. Never retry an observed app failure into a pass,
combine partial attempts, or use this recovery for saved/API/restart checks.
Fresh local tests
do not replace a complete oracle run; rerun the final frozen package and record
every attempt rather than selecting a favorable result.


# Appendix B: All recorded lessons from this session

Source: `TASK_LEARNINGS_2026-09-11.md`.

# Task authoring lessons — 11 September 2026

This records today's lead messages relayed by the user, reference comparisons,
PatchPad QC failures, Oracle/model analysis, fixes, and decisions left open.
Use [TASK_TEMPLATE_STANDARD.md](TASK_TEMPLATE_STANDARD.md) for the current
authoring contract. Earlier examples in this repository can be obsolete.

## Later PatchPad QC correction: coverage and prompt provenance

The subsequent platform run raised three findings: ungraded document line
numbers, absent prompt-version markers, and prompt consistency/residue. Two
findings shared the missing-marker cause. The removal of every prompt banner
had gone too far: keep version identification as ordinary prompt text while
removing code comments. Every prompt now identifies task version 1.0.0 and its
own revision; the runner records prompt/judge, runner and reward hashes in
`prompt-provenance.json` and its stdout. Hashes establish traceability, not a
claim of deterministic LLM verdicts.

The existing Functional navigation criterion now explicitly checks document
line numbers at the top and after scrolling, alongside their corresponding
logical lines. Cursor status alone is insufficient. Both consistent numbering
bases and virtualized line rendering remain valid. No criterion or weight was
added. Reference-product names and template explanations were removed from the
delivered prompts. Historical statements below about removing prompt-version
banners describe the earlier decision and are superseded by this correction.

Current corrective release: `deliverables/patchpad-editor-v2/1.0.0-rubric-coverage-provenance/`.
Its changes still require a fresh platform semantic QC and Oracle run.

## Reference authority and lead requirements

The lead's manual checklist names
[Bazaarbridge commerce](projects/bazaarbridge-marketplace-commerce/) as the
configuration reference. The user later approved
[Docketlight claims](projects/docketlight-claims-insurance/) for top-level judge
weights and the structure of difficult Functional procedures. This does not
authorize copying every Docketlight configuration difference.

| Area | Current rule |
| --- | --- |
| `task.toml` | Exact Bazaarbridge table/key structure, including nested metadata. No extra `metadata.subcategory`, `metadata.solution_explanation`, or other keys. Adapt identity and descriptive content only. |
| Version | Literal `1.0.0`, as in the reference; the lead called this release `v1.0.0`. Keep it fixed and distinguish packages by folder and checksum. |
| Timeouts | Agent 7200 seconds, environment build 600, verifier 13200. |
| Runtime configuration | Preserve reference operational values: schema 1.4, artifacts `/app`, public networking, separate verifier, 2 CPUs, 4096 MB. |
| `verifier.env` | Exact reference keys and values, shown below. |
| Dockerfiles and `tests/test.sh` | No OpenAI/OpenRouter API-key mentions, including comments. Provider dependency names are not API-key mentions. |
| Reasoning | `max`, configured centrally through the environment and verifier Dockerfile. |
| Verifier folders | Exactly `render`, `constraints`, `functional`, `polish`, `visual`, each with `judge.toml` and `prompt.md`. The actual reference uses plural `tests/`. |
| Judge configuration | Keep the `[judge]` table. Remove the inner `judge` and `model` keys; do not add per-judge reasoning overrides or non-reference keys. |
| Comments | The user additionally requested no comments in task code/configuration, including copied headers and prompt-version banners. Preserve executable shebangs, meaningful Markdown headings, requirements, and seed content. |

Required environment values:

```toml
[verifier.env]
OPENAI_API_KEY = "${OPENAI_API_KEY}"
REWARDKIT_JUDGE = "codex"
REWARDKIT_MODEL = "gpt-5.6-luna"
REWARDKIT_REASONING_EFFORT = "max"
```

The placeholder in `task.toml` is required by the reference. The prohibition
on API-key mentions applies to the two Dockerfiles and runner. Never include
an actual credential in a task or committed evidence.

The lead requires this exact final form in `tests/test.sh`, even if a different
arrangement would be mathematically equivalent:

```python
if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]
```

Validate finite dimension scores in `[0, 1]`, reject malformed/missing values,
and retain all five fields in fallback and reporting output. Do not silently
change the prerequisite from `<= 0.0` to `< 1.0`.

## What the timeout error meant

The original Gridforge screenshot described serial judge allowances totalling
12550 seconds inside a 12000-second wrapper. The outer verifier allowance of
12600 then left almost no room for setup and teardown. A fully used judge
budget could be killed, triggering a zero reward even for a correct app.
It also questioned whether time was allocated in proportion to the work.

This is a real configuration concern on the numbers shown, not proof of a
platform bug. PatchPad or a reference passing a prior QC run does not prove
that an equivalent configuration is consistent. Semantic QC can flag different
issues on separate runs; rerunning without changes is not a repair.

Current standard nesting is:

```text
Render 600 + Constraints 600 + Functional 9000 + Polish 900 + Visual 900
= 12000 seconds, serial execution
< 12600-second rewardkit wrapper
< 13200-second verifier timeout
```

The two 600-second margins cover overhead. Valid arithmetic alone does not
prove a complex rubric will finish; actual execution evidence still matters.

## The three kinds of weight are different

1. Individual `[[criterion]]` weights combine observations within a judge.
2. Top-level `[judge].weight` controls that judge's contribution to aggregation.
3. The final reward formula applies the hard gates and the dimension shares.

The top-level weight is **not the average of individual criterion weights**.
For example, the Functional dimension can contribute 60% regardless of whether
its internal weights total 20.75 or another number. Relative internal weights
control how that 60% is earned.

Bazaarbridge's scored judge weights were Functional 4, Polish 3, Visual 2,
equivalent to about 44.4% / 33.3% / 22.2% when normalized across those three.
Its final runner and `reward.toml` used 60% / 20% / 20%. The QC error attributed
the 4/3/2 values to **judge.toml**, not a comment in `reward.toml`. Removing
comments does not reconcile different live configuration values.

Current PatchPad follows the later Docketlight decision:

| Dimension | `[judge].weight` | Final scoring role |
| --- | ---: | --- |
| Render | 1.0 | Gate; no additive share |
| Constraints | 1.0 | Gate; no additive share |
| Functional | 0.6 | 60% |
| Polish | 0.2 | 20% |
| Visual | 0.2 | 20% |

The scored weights have ratio 6:2:2; their actual TOML values are 0.6/0.2/0.2.
Individual criterion weights were preserved. The question about a universal
0.5–2 individual-weight limit versus reference values up to 5 remains a lead
clarification, not a new agreed rule. Do not infer a limit from one example.

[RewardKit's weight documentation](https://www.harborframework.com/docs/rewardkit#weights-and-scoring)
and [criterion documentation](https://www.harborframework.com/docs/rewardkit/judge-criteria)
describe these separate roles. The installed version also matters: inspection
of pinned RewardKit 0.1.7 showed its intermediate aggregate includes positive
Render/Constraints judge weights. The runner then overwrites the total with
the required gated formula. The supplied Oracle log had intermediate 0.9626
versus final 0.8877, supporting this distinction.

Do not set gate judge weights to zero casually: in this version that can make
the single-judge dimension score zero. Aligning the three scored dimensions
does not remove the intermediate-versus-final gate distinction. It remains a
possible cross-file QC concern. Reference acceptance is useful evidence for a
clarification message, not proof that QC must accept our package.

## Global browser gate and visual verification

A global browser gate is an explicit prerequisite before scoring any criterion:
a substantive local page loads without fatal errors; observed runtime requests
are same-origin; for this server-backed task, a successful response supplies
the populated document shown by the UI. Failure zeros every criterion in that
dimension. Put it in **every** dimension prompt, including Visual.

The original missing-gate static finding was valid: without that prerequisite,
a blank or broken page could merely lose individual checks instead of being
zeroed consistently. Marketplace authentication checks only belong in products
that require authentication; PatchPad does not gain a sign-in requirement.

Functional grades behavior and data correctness. Polish grades concrete
usability, focus, labels, and feedback. Visual grades visible presentation.
Use shared visual dimensions and anchors from the reference, adapting the
surfaces to the task; do not require the golden solution's pixels or unrelated
marketplace features.

PatchPad's five equally weighted Visual criteria are:

- Typography.
- Colour and contrast.
- Spacing and layout.
- Hierarchy and scannability.
- Overall craft.

The user removed the reference's sixth responsiveness criterion for PatchPad.
Assess desktop at 1280x800 only; Visual still contributes 20%. This is a
PatchPad exception, not a removal of responsiveness from all future tasks.
Visual remains appearance-only; do not introduce an editing requirement to
make it harder. Its global browser prerequisite still applies.

Remove stale five-point-rating instructions from binary judge prompts. Visual
does use rating anchors. In the observed pinned runner, a raw Visual rating of
4 became 0.75, not 0.8; raw 5 became 1.0. Use actual normalized reward outputs
when explaining results, and review anchor/normalization compatibility before
changing scoring conventions.

## Fairness: test the requirement, not an incidental implementation choice

When a verifier demands something absent from the brief, prefer adapting the
verifier to valid implementations. Add a product requirement only if the user
actually wants that constraint. Do not add artificial wording merely to justify
a brittle existing check.

Four concrete `no_criterion_grades_the_unrequired` findings were fixed:

| Earlier assumption | Current verifier behavior |
| --- | --- |
| Document ID must be in the save URL; URL/body mismatch always probed | Discover actual identity locations. Probe mismatches only when redundant copies exist; retain invalid-ID and nonmutation checks. |
| Selection must scroll the editor's own box, never the page | Accept editor, ancestor, or page scrolling driven by a real held selection while retaining the required offscreen range. |
| Tab adds only 1–4 whitespace characters | Accept the app's consistent spaces/tabs width; still verify indentation, reversal, Undo/Redo, and unchanged neighboring text. |
| Coordinates must use one-based columns | Normalize a consistent zero- or one-based display and still verify exact logical positions. |

These remove false failures without removing the behavior being tested.
Legitimate valid implementations should become easier to pass; broken behavior
must not. Keep exact text, saved-state invariants, real interactions, and
independent evidence wherever they are required.

Keep the main instruction natural and concise, pointing to the supplied seed
and specification. Runtime requirements still need a clear home: PatchPad's
`overview.md` defines `/app`, `npm start`, port 3000, root `/`, self-contained
runtime assets/dependencies, and the manifest contract. The one-line database
declaration is `SQLite path: /app/your-file.db`, with the app's actual absolute
path. Moving these details out of the opening brief does not delete them.

## Oracle and model evidence

Five supplied trials across four run folders were analyzed. They shared the
same uploaded task checksum and 39 criteria. These are historical scores from
before the latest procedure and presentation changes:

| Trial | Final reward | Functional | Polish | Visual |
| --- | ---: | ---: | ---: | ---: |
| Oracle | 0.8877 | 0.8795, 24/27 passing | 1.0000 | 0.8000 |
| Gemini 3.7 Flash | 0.5678 | 0.5241, 14/27 passing | 0.6667 | 0.6000 |
| Claude Haiku 4.5 | 0.3033 | 0.0000, 0/27 passing | 0.6667 | 0.8500 |
| GPT-5.4 mini | 0.5291 | 0.2651, 7/27 passing | 1.0000 | 0.8500 |
| No-op | 0 | Not graded | Not graded | Not graded |

Three Oracle Functional failures had judge-procedure/evidence problems:

- **Tab/Shift+Tab/Undo/Redo:** a result-assembly exception lost transient text
  checkpoints. Capture plain text immediately after each action.
- **Offscreen selection:** the judge observed scrolling and the requested
  range but rejected its own gutter start. A supported gutter anchor is valid;
  measure real targets and retain the actual drag/range requirement.
- **Clipboard:** the judge cut `EXTERNAL-C` instead of the required second
  line `EXTERNAL-B` plus tab plus `CELL`. Establish and verify the target first.

All three passed fresh local browser reproductions before golden presentation
changes, and passed again afterward. Exported reasoning supported this diagnosis,
but native judge tool-call transcripts were absent. Do not pretend every
original action was independently reconstructed or replace the recorded scores.

Docketlight's useful pattern is **Setup**, followed by numbered **Graded
observations**. Setup navigation may adapt through the app's supported UI;
required real actions, counts, exact outputs, and invariants remain mandatory.
PatchPad did not import permission to bypass editor interactions with API writes.
Verify focus, clipboard targets, dialogs, and readiness; persist compact evidence
before another mutation. Stop repeated failed setup rather than guessing.

One fresh complete attempt is allowed only for a demonstrated judge setup or
serialization error in an unsaved-only criterion. First reload/discard normally
and verify saved content, revision, and history are unchanged. Record the invalid
attempt. Never retry an actual app failure into a pass, combine partial attempts,
or apply this recovery to saved-state, direct-API, or restart checks.

Some model failures were genuine. Haiku had unpadded seed markers, duplicated
keyboard handling, and a preview method shadowed by an instance field. Mini had
unpadded seed markers and accepted string `baseRevision` values that should be
rejected. Gemini had independently observed history overflow. Other verdicts
involved missing checkpoints, incorrect focus/targets, or transport errors and
remain uncertain. Do not relax valid requirements to forgive genuine defects.

The Oracle's Visual deductions were not all judge errors. The golden app now
has a distinct report heading, readable section emphasis, contained editor and
history scrolling, and a larger readable revision preview. These improve the
visible app without reducing criteria, weights, or required behaviors.

## Unresolved issues and explicit deferrals

- **Credit for nonfunctional shells:** a weak app can earn around 30% from
  Polish/Visual. Haiku's Functional 0 and final 0.3033 demonstrate the concern.
  This is the `floor_is_low_for_shells_mocks_and_stuffing` finding. The user
  deferred a fix and kept Visual appearance-only. Do not report it as resolved.
- **Intermediate gate weighting:** positive Render/Constraints weights in the
  pinned runner differ from their role in the final formula, as explained above.
- **Other potential extra requirements:** wrapped versus logical-line movement,
  exact triple-click/newline behavior, extra no-op Save messaging/disabled state,
  specific Find/Save/Redo shortcuts, GET-only reads, timestamp parseability,
  and observing error feedback under a Polish procedure that disallows edits.
  These were discussed but left unchanged until further QC feedback.
- **Lead clarification:** whether individual-weight bounds are mandatory across
  tasks remains unresolved. A reference's values alone do not settle policy.

Do not confuse passing the manual checklist with clearing these semantic risks.
The lead's attribution of 4/3/2 to `reward.toml` could be corrected using the
specific QC file paths; the broader consistency concern still deserved fixing.
Removing comments or repeatedly rerunning QC is not evidence that a live
configuration or scoring issue disappeared.

## Current release, checks, and next run

Current source: [projects/patchpad-editor-v2](projects/patchpad-editor-v2/).
There are 32 task files and 39 criteria: Render 2, Constraints 2, Functional 27,
Polish 3, Visual 5. Diagnostics and release reports stay outside the task ZIP.

Latest upload archive:
[patchpad-editor-v2.zip](deliverables/patchpad-editor-v2/1.0.0-qc-checked-20260911-224216/patchpad-editor-v2.zip).
Its SHA-256 is
`10392d94700e6b4ccc8b2c4bbe3eae6c17a9aa41f1a6d437649f25efd8f71867`.
Its files exactly match the audited Docketlight-procedures release. Repackaging
changed ZIP metadata/checksum, not task source.

Completed checks: 108 standard checks, 27 archive/manual checks, and 29 browser
regression groups across five suites. The browser work used fresh offline
containers with a cached verifier image. ZIP CRC and exact source comparison
passed. Golden preview was served on `http://localhost:3035/`; it is a disposable
local instance, not a persistent deployment guarantee.

No new full LLM Oracle or platform semantic QC pass is claimed. A configured
judge credential was unavailable locally; exact new image builds were not
validated by cached-image diagnostics. The platform must rerun the final package.
If any criterion fails, classify the cause from evidence before changing the
golden app, verifier, brief, or infrastructure. Preserve every attempt.

Useful evidence and tools:

- [Manual QC report](deliverables/patchpad-editor-v2/1.0.0-docketlight-procedures/MANUAL_QC_REPORT.md).
- [Current release and browser validation](deliverables/patchpad-editor-v2/1.0.0-docketlight-procedures/README.md).
- [Exact latest verifier before/after](deliverables/patchpad-editor-v2/1.0.0-docketlight-procedures/VERIFIER_BEFORE_AFTER.md).
- [All supplied run analysis](deliverables/patchpad-editor-v2/1.0.0-oracle-reliability/RUN_REVIEW.md).
- [Pinned RewardKit source inspected](deliverables/patchpad-editor-v2/1.0.0-reference-standard/rewardkit-runner-reference.py).
- [Standard checker](references/task-templates/check-standard.py): run
  `python references/task-templates/check-standard.py projects/patchpad-editor-v2`.

For future tasks: read the current standard first, trace each criterion to a
requirement, separate setup from graded actions, calculate serial timeout
budgets, check every scoring layer, and test the exact frozen package. Preserve
version 1.0.0 and old evidence; use new hashes and delivery folders for revisions.


# Appendix C: Gridforge v3 instance prompt

Source: `GRIDFORGE_V3_CODEX_HANDOFF.md`.

# Gridforge v3 — Codex handoff

Work on `projects/gridforge-spreadsheet-v3` in
`F:\Documents\turing-workspace\model-beraking-prompts`. Bring it into the current
task standard, review rubric fairness and runtime reliability, validate the
golden solution, and produce a new upload ZIP with honest validation evidence.
Do the work, not just an audit or plan. The other Codex instance is working on
Brickfall; leave Brickfall and PatchPad source, releases, previews, and unrelated
working-tree changes alone. Do not stage or commit another instance's files.

Read these before changing anything:

1. `TASK_TEMPLATE_STANDARD.md` — current mandatory configuration.
2. `TASK_LEARNINGS_2026-09-11.md` — lead messages, findings, fixes and deferrals.
3. `TASK_AUTHORING_CONTEXT.md` and `MODEL_BREAKING_PLAYBOOK.md`.
4. Gridforge v3's entire brief, mounted specifications, seeds, solution,
   `task.toml`, Dockerfiles, runner, and all judge criteria/prompts.
5. `deliverables/gridforge/gridforge-v3-3.0.0-validation/` and other relevant
   Gridforge QC/run evidence. Do not assume v2 run results validate v3.

References available locally:

- `projects/bazaarbridge-marketplace-commerce/`: lead's configuration baseline.
- `projects/docketlight-claims-insurance/`: approved top-level judge weights
  and clear Setup / numbered graded-observation procedures.
- `projects/patchpad-editor-v2/`: current implementation of today's standard.
- `projects/torquebay-repair-operations/torquebay-repair-operations/`: newly
  supplied task that the user reports passed. Note the nested directory.
- `projects/boardloom-infinite-canvas/`: another user-reported passed task,
  useful for browser setup, accounts, fresh evidence and server-authority checks.

Inspect the new references before borrowing patterns. Their passed status does
not override the lead's current checklist. Boardloom currently has an older
four-dimension configuration, version and timeouts: do not copy those into
Gridforge. Preserve all supplied reference files.

Mandatory configuration:

- Exact Bazaarbridge `task.toml` keys; no extra metadata/configuration keys.
  Version stays literal `1.0.0`; do not rename the v3 project directory.
- Agent 7200 seconds, build 600, verifier 13200. Exact reference `verifier.env`.
- Follow reference Dockerfile/runner formats, adapting only actual task needs.
  No OpenAI/OpenRouter API-key mentions in either Dockerfile or `tests/test.sh`.
  Reasoning effort `max`; no inner `judge`, `model`, or reasoning override keys
  in `judge.toml`. Keep its required `[judge]` table.
- Five folders under `tests/`: render, constraints, functional, polish, visual.
  Judge budgets 600/600/9000/900/900, serial total 12000, wrapper 12600.
- Top judge weights: Render 1, Constraints 1, Functional 0.6, Polish 0.2,
  Visual 0.2. Preserve fair individual criterion weights; they are independent
  of top-level weights, not averaged to determine them.
- Exact final reward formula, with the gate first:

```python
if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]
```

- Remove authored task code/config comments; retain shebangs, meaningful
  Markdown requirements and original seed data. A new PatchPad QC result
  explicitly requires prompt-version identification. Preserve it as ordinary
  prompt text, not a code comment: record task version `1.0.0`, the dimension
  and an independently incremented prompt revision. Record and log exact prompt
  hashes so edits are traceable while task version remains fixed. This latest
  finding supersedes the earlier blanket removal of prompt-version banners.
- Explicit global browser prerequisite in every prompt. Include authentication
  only if Gridforge's brief requires it. Keep Visual appearance-only. Adapt
  reference visual dimensions to the spreadsheet; PatchPad's removal of
  responsiveness was a PatchPad-only decision, not permission to remove it here.

Review every criterion against the actual brief. Correct extra assumptions about
API shape, coordinate bases, scroll containers or input setup without reducing
required behavior. Separate flexible UI setup from exact graded actions. Keep
real keyboard/mouse/clipboard interactions, formulas, collaboration, persistence
and conflict safety. Preserve transient checkpoints and verify focus/targets.
Do not erase valid failures or add arbitrary retries to force Oracle success.
Use the new references where their procedures solve a concrete problem.

Latest PatchPad rubric lessons: build a requirement-to-criterion coverage map;
checking the cursor-position readout does not also check document line numbers.
Give every required behavior an explicit graded observation. Keep prompts
self-contained: say what Setup and graded observations mean directly, without
references to Docketlight, marketplace screens or another task's template.
Two recent PatchPad QC failures both cited absent prompt-version identifiers;
do not repeat that omission. Provenance metadata is not itself proof of full
determinism or offline operation.

Investigate the earlier serial-timeout failure: allowed judge time exceeded the
wrapper and left inadequate outer overhead. An earlier pass on another task is
not proof that the configuration is correct. Check weights across judge files,
reward.toml and final runner. Document the pinned RewardKit intermediate gate
weighting issue and potential credit for nonfunctional shells; do not silently
declare those resolved or change the required formula.

Preserve a before snapshot and historical run evidence. Make scoped fixes,
run the local standard checker, build exact images if available, exercise the
golden app in fresh isolated state, and reproduce important rubric paths.
Analyze existing Oracle/model failures against their exact source versions.
Run a fresh full Oracle if the environment is configured; otherwise state the
specific limitation and distinguish local tests from a full judge result.
Do not claim semantic QC or Oracle approval without the corresponding run.

Create a new dated Gridforge-only delivery folder, task ZIP, source/ZIP hashes,
check report and verifier before/after summary. Update Gridforge's delivery
pointer. Keep diagnostics outside the task ZIP. Do not overwrite old packages,
run exports or other tasks, and do not push or stage shared work indiscriminately.
Finish with the ZIP link, concrete changes, test results, and unresolved risks.
