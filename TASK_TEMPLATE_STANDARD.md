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
