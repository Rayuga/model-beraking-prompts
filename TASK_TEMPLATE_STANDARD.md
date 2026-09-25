# Current task template standard

## September 15: Common Ground r17 recovery hardening

The old GPT export scored 0.897 overall and 0.9236 Functional. r17 adds a
substantive staff recovery workflow and missing boundary probes, with matching
public instructions, golden UI and independent positive-weight criteria. It
does not cap model scores or change the final dimension formula. There are now
68 criteria (1/2/49/10/6), Functional weight58 and Polish weight14.

Retain browser attempts before sending; interrupted responses must be tested
after capturing the actual upstream outcome. Reload during a held response
distinguishes before-send durability from storage only inside an error handler.
Grade browser request identity separately from backend receipt calculation.
Use dedicated recovery profiles so account/restart tests do not invalidate the
main journey's persistence sessions. Narrow transport faults must have bounded
release and cleanup, preserved noncredential exchanges, and positive controls.
Do not manufacture browser state or infer app defects from missing evidence.

The scoped r17 checkers require both recovery documents and six positive binary
criteria while preserving historical r15/r16 compatibility. Hash the referenced
recovery addendum as well as the main prompts. Fresh platform scores remain
required; local browser, mutant and scoring fixtures are not scored Oracle runs.

## September 15: Common Ground r16 coverage correction

Platform v9 passed 52/53 Rubric Source checks but found three ungraded product
requirements: non-color status text, Observer Members/Audit access, and
disabled or explained unavailable actions. r16 adds independent positive-weight
checks for status text and action guidance in Polish, and Observer ballot setup,
published results, Members and Audit reads in Functional. Existing Observer
turnout and write-refusal criteria retain their ownership. Require actual
populated UI/protected reads and positive staff comparisons; a sign-in or denied
write is not evidence that an Observer can read an authorized workspace.

This is added coverage of existing requirements, not a split of already-scored
criteria: old criterion weights remain unchanged. Functional now totals 36 and
Polish 14; the dimension allocation remains 60/20/20 after mandatory gates.
There are 62 criteria (1/2/43/10/6). Historical r15 files remain immutable and
checkable. The r16 golden adds lifecycle explanations without changing server
semantics. Validate each new requirement with an independently defective app
variant and verify that losing it affects final reward. See the dated r16 report
for local evidence and pending platform validation.

## September 15: Common Ground r15 and the new TXT rubric

For Common Ground, the newly supplied task-implementation.txt supersedes the
earlier r14 empty-aggregate interpretation below. reward.toml must contain a
named [[reward]] with aggregation="weighted_mean" as well as composition roles.
The sole numeric dimension weights remain in judge.toml. RewardKit writes an
intermediate aggregate; score.py replaces it with the gated final composition.
tests/SCORING.md documents these separate roles. Do not reintroduce ignored
numeric maps or duplicate coefficients. Exercise the actual pinned RewardKit
writer and the final scorer, not just a hand-written formula.

The same TXT rubric permits external resources. Remove Common Ground's obsolete
local-resource constraint and keep the global authentication/backend gate free
of origin restrictions. Runtime assets needed from /assets must be baked into
/app during implementation; the verifier must not restore a missing embedded
seed. Split independently requested behaviors into separate verdicts while
preserving the prior total criterion weight and 60/20/20 dimension composition.
Render grades requested workspace navigation; Constraints grades health and
SQLite separately. Historical r14 packages remain immutable.

## September 15: Common Ground platform QC correction

The user's new Common Ground QC findings supersede the old literal reward-file
and formula-copy requirements below for `projects/common-ground-ballot`.
Render and Constraints use `all_pass` over independently reported criteria;
failure of any mandatory runtime requirement must reach the final zero gate.
Do not combine unrelated health and SQLite requirements, combine theme/touch/
motion requirements into one verdict, or score a duplicate root-load criterion
already covered by the shared browser prerequisite.

For this task, `tests/reward.toml` declares `reward = []` plus composition roles:
Render/Constraints are gates and Functional/Polish/Visual are weighted dimensions.
The pinned RewardKit emits dimension scores without another aggregate.
`tests/score.py`, invoked once by `tests/test.sh`, reads the sole numeric dimension
weights from each `[judge] weight`, checks the mandatory gates, and normalizes
the three weighted dimensions. Keep those weights at 0.6/0.2/0.2 and the gate
judge weights at 1.0. Remove redundant zero-weight maps and hardcoded copies
of the point coefficients. This preserves the intended 60/20/20 composition
when mandatory gates pass. Verify each individual constraint failure with the
actual RewardKit aggregator and final scorer, and test weight-source changes.

The remaining task schema, runtime versions, networking, timeouts, shared
authentication prerequisites, prompt versions, archive rules and golden targets
below still apply. Other tasks are not migrated by this task-specific correction.

Decision history and evidence: [11 September lessons](TASK_LEARNINGS_2026-09-11.md).

Later corrections: [12 September platform QC lessons](TASK_LEARNINGS_2026-09-12.md).
The asset-gate, independent-scoring and package-layout rules below incorporate
that later feedback and supersede the earlier September 11 formulations.

Effective 2026-09-11, from the user's manual QC instructions. This supersedes
older four-dimension, provider-pinning and version-increment rules in this
repository. Canonical reference: `projects/bazaarbridge-marketplace-commerce/`.
Later user-approved weight reference: `projects/docketlight-claims-insurance/`.
Use its top-level `[judge] weight` values: Functional 0.6, Polish 0.2,
Visual 0.2, Render 1.0 and Constraints 1.0. This supersedes Bazaarbridge's
judge weights only; the other configuration and timeout rules below remain.
Criterion weights are independent and are not changed by this update.

Pellmoor corrections, 2026-09-15: the user's static-QC results require both
strictly positive judge weights and a nonempty named [[reward]] entry. The
earlier zero-judge-weight and empty-reward-list interpretations were incorrect.
Use Render/Constraints judge weights of 1.0 and the complete canonical
reward.toml, without a scoring compatibility patch. Keep the exact final
formula below in tests/test.sh; it replaces RewardKit's intermediate aggregate
in the delivered reward files. tests/SCORING.md explains those separate roles.
All criterion weights, scoring aggregations and timeouts otherwise follow the
current task. The Common Ground exception above is not a Pellmoor exception.

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

Launch the app process from the app entry file's directory on initial startup
and every managed restart, including a relocated runtime. Keep the verifier's
own working directory separate. A documented `node serve.js` launch from `/app`
must support ordinary relative paths such as `express.static('www')`. Include a
relative-path regression fixture: an absolute-path golden implementation can
hide a broken grading working directory.
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
scoring: a substantive working local page without fatal errors and zero for
every criterion if that shared prerequisite fails. Do not make external fonts,
scripts, styles or other assets a universal gate failure under public networking.
Keep locally served resources required by the brief graded only in their dedicated
Constraints criterion. For a
server-backed product, observe the populated server response used by the UI;
a rendered static mock is insufficient. Include authentication checks only
when the product requires authentication. Visual also needs this prerequisite,
even though its scored criteria assess appearance. Do not replace it with only
"a reviewable page renders." Local preflight wording checks do not establish
that the platform's full prompt checker will pass.

For a product with real sign-in, successful authentication alone is not the
shared gate. Every dimension must also prove that protected records are hidden
while signed out and an exact incorrect password is visibly refused without
granting a session. Capture a real protected read through a successful UI login,
then test it from a fresh anonymous context before and after that context's own
wrong-password attempt. Require a refusal with no protected record content in
the response, not merely an error toast or a401 alongside leaked data. Never
copy good credentials into the anonymous probe or clear bad-login credentials
afterward to manufacture rejection. Retain the correct-login and refresh
positive controls. Keep domain data and other sessions unchanged; later
dimensions must use current persisted records rather than reseeding.
These observations belong inside every explicit shared gate, not only inside
a small Functional criterion. Public demo sign-in hints remain allowed.
See TASK_LEARNINGS_2026-09-14.md and the Ballot r10 gate regression evidence.

Every batched prompt must explicitly require independent per-criterion evidence,
continuation after individual failures and a verdict for every criterion. Only
explicit shared prerequisites may invalidate the whole batch. Preserve conjunctive
subchecks within each criterion; never infer cross-criterion all-pass semantics
from a global gate or ignore the configured weighted aggregation.

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

### Future Golden Visual Target (2026-09-12)

For subsequent tasks, the user wants the golden solution to earn Visual = 1.0,
as well as passing every Functional criterion and meeting the overall Oracle
threshold. Treat this as an authoring and validation target: inspect all graded
surfaces, previews, dialogs and required viewport sizes, fix actual presentation
defects, and confirm with a full Oracle run on the frozen package. Do not weaken
visual anchors, alter weights or rewrite recorded scores to reach it.

This is not a new scoring gate and is not retroactive to the current GridForge
v3 delivery. Its recorded Oracle is 0.9833 with Visual 0.9167 and Functional 1.0.
The saved execution checklist requires overall Oracle above 0.95 and every
Functional criterion passing; the supplied scorecard's C1 threshold is >=0.95.
Neither specifies a separate Visual = 1.0 prerequisite for this existing run.

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

Keep coverage maps, QC reports, screenshots and authoring scripts outside the task
ZIP. Permit only `README.md`, `environment/`, `instruction.md`, `rubrics/`,
`solution/`, `task.toml` and `tests/` at the task root. Exclude repository-only
metadata and use one task-named archive wrapper. Check archive entries explicitly;
passing the local configuration checker alone is not platform static/QC approval.

Run `python references/task-templates/check-upload.py <final-task.zip>` against
the actual upload archive, in addition to `check-standard.py` against its extracted
task directory. Every provided `/assets/...` reference must exist under
`environment/assets/...` in that archive; follow the reference's
`COPY assets/ /assets/`. An alternative Docker mapping that works at runtime
does not satisfy the platform's static asset resolver. Require asset directories
to exist before enumerating them, and check shell executable permissions in ZIP
metadata. Keep the exact tested archive checksum with the report. The Gambit
full-preflight regression cases reproduce the rejected unwrapped/misplaced-asset
archives so these packaging failures cannot silently pass the local audit again.

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
