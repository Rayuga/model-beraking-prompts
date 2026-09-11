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
