# PatchPad 2.0.14 — post-run QC and fairness review

The runs are materially improved and their scores are internally consistent,
but the evidence is **not fully clean**. Oracle exceeds 0.95, GPT is in range,
and Gemini completed. Oracle still misses one Functional criterion, Haiku did
not reach browser grading, and several model deductions have demonstrably
unfair or incomplete judge evidence. No source files, model artifacts, recorded
scores, existing ZIPs or historical reports were changed by this review.

## Actual exported results

| Run / model | Reward | Functional | Polish | Functional passes | Interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| 755bbea8 / Oracle | 0.9783 | 0.9759 | 1.0 | 26/27 | Meets aggregate threshold; not 1.0 or all-Functional pass |
| 96ab7f8f / GPT-5.4-mini | 0.4762 | 0.4458 | 0.75 | 15/27 | Valid completed grade, inside 0.1–0.7; fairness caveats below |
| c7886a49 / Gemini-3.7-flash | 0.4879 | 0.4518 | 0.8125 | 12/27 | Valid completed grade; several deductions need review |
| a32b993f / Claude Haiku 4.5 | 0.0 | — | — | Not graded | Manifest preflight failed before app startup |
| 755bbea8 / Nop | 0.0 | — | — | Not graded | Expected empty-submission floor |

All three browser-graded apps passed Render and Constraints. All five trials
declare version 2.0.14 and share:

- Task checksum: `ed56c3b3884fdabda9829dad157fc9feefffd3ed183b7e5b5c335a6e4d4e267f`
- Lock digest: `sha256:c08f67a4a4b2bbdeea23dd11db9675af1adbe46497eb51bb8471db5225d1817c`

The three graded exports have the exact current 35 criterion definitions,
weights and IDs. Every dimension and the `0.9*Functional + 0.1*Polish` reward
recomputed correctly. Reward JSON, reward text and trial results agree.
All exported golden source files match the delivered golden. The 30-file ZIP
matches current source byte-for-byte. Platform task-checksum, lock digest and
ZIP SHA are different formats; no equality between those formats is claimed.
An independent archived copy of the full platform task was not supplied, so
the complete platform prompt/image bytes cannot be compared directly.

## Most important findings

### 1. Oracle's remaining Unicode miss is not a reproduced golden bug

`unicode_grapheme_navigation_selection` lost 0.5 of 20.75 Functional weight.
The reason says Find copied the old `é` selection and the subsequent sequence
copied `B`, rather than establishing the full `A🙂éB` sample first.

I ran the unchanged exported Oracle app in an isolated browser, established a
prior `é` selection, then entered the complete new query and executed the exact
arrow/copy sequence. Clipboard values were exactly `A`, `🙂`, and decomposed
`é`. The source is capable of passing this check. The original judge action
trajectory is absent, so this local pass cannot establish precisely which
platform action went wrong or replace the recorded grade with 1.0.

There is also a small positive-score evidence anomaly: the passed multi-caret
Delete criterion quotes `iline` where the required result is `imeline`. This
may be a transcription error; it needs raw checkpoint evidence, not an assumed
score adjustment.

### 2. A genuine Find convention mismatch penalizes Gemini

The brief requires bidirectional Find navigation, but does not say that typing
a query must leave its first match unselected. Gemini immediately selects the
first match while typing, which is a reasonable editor behavior.

The fresh browser reproduction showed:

| Action | Gemini observation |
| --- | --- |
| Enter `NEXT` into Find | Match 1/3, line 18 |
| Enter | Match 2/3, line 19 |
| Enter | Match 3/3, line 20 |
| Shift+Enter | Match 2/3, line 19 |

The verifier instead assumes the first Enter must establish line 18. This
affects `keyboard_find_focus_and_cycle` and the initial sequence in
`find_replace_exact_counts_and_offsets`. The navigation/wrap/replacement tests
should accommodate either initial-selection convention while retaining their
exact outcomes. This is a demonstrated fairness issue, not a reason to make
the tests easier or remove their coverage. No change was made during review.

### 3. Some model deductions are judge mistakes or insufficient evidence

- Gemini's word-navigation reason explicitly says the second Home key was
  omitted. The complete prescribed sequence passes locally on unchanged Gemini:
  right motion to column 7, Copy `NORTH `, left motion to column 7, Copy `WIND`.
- Gemini's dirty-discard reason explicitly attributes the missing observation
  to a verifier query error. Other criteria lost transient or logical-line
  evidence. These are not demonstrated application failures.
- GPT's EXTERNAL clipboard criterion is justified using the other criterion's
  PASTE payload. That reason does not substantiate the check it scored.
- GPT's word-selection reason names Shift+ArrowRight rather than the required
  word modifier. This may be a missing action or merely abbreviated prose;
  the missing action trace prevents adjudication.
- GPT's restart criterion confirms durable exact content/history through both
  restarts and finding/copying the marker, then objects to zero initially
  rendered marker elements. Its editor virtualizes lines. Inspecting the marker
  after navigation is legitimate; not every line must be mounted initially.
- GPT's Polish focus reason invokes Tab being an indentation command even
  though the criterion explicitly permits that and asks for Escape to exit.
  Its actual history traversal still needs replay before overturning the score.

These findings are not permission to count unobserved actions as passes. The
correct next evidence is a controlled replay/regrade with the actual required
gestures and action logs. Exact official scores remain unchanged.

### 4. GPT also has a real implementation defect

Its preferred-column navigation failure is supported by both the observation
and the exported source: Up clamps column 59 to 9 on a short line, then
`movePosition` overwrites the preferred column with that clamp. Down therefore
returns to column 9, not 59. Other reported multi-caret and atomic-edit misses
may be real too. Do not label every model failure a judge error.

### 5. Haiku's zero is a disclosed manifest-format failure

Haiku wrote:

```markdown
## SQLite path: `/app/patchpad.db`
```

The runner's parser expects a bare or bullet-prefixed `SQLite path:` line;
`instruction.md` expressly gives the bare-line format. The heading prefix
therefore violates a disclosed runner contract. The exported stdout reports
the exact manifest assertion failure. This is **not a networking timeout**;
the app was never started and no browser dimensions were evaluated.

Haiku's editor capabilities are unknown from this run. Its missing browser
grade cannot be relabelled as a valid graded-zero result. A separately corrected
diagnostic would be a different artifact, not the original model run.

## QC performed and limits

- **102 automated read-only assertions passed:** ZIP/source integrity, credential
  literal scan, TOML/JSON structure, seed equality, network/timeout configuration,
  five-trial version/checksum/digest consistency, all dimension definitions,
  normalized values and score arithmetic, exported Oracle source equality.
- Fresh unpaid real-browser diagnostics passed for the exported Oracle Unicode
  sequence and Gemini word navigation; the Gemini Find convention mismatch
  was reproduced as described above. App source was not edited.
- Used the supplied 30-row RL scorecard, 19-row source DOCX rubric and 26-rule
  upload DOCX. Per-row results are in the workbook and JSON files. They include
  partial/unverified/policy-exception results, not a blanket pass.
- The WebDev QC workbook's 53 categories were used to identify applicable
  fairness areas. `checks.txt` and `task-implementation.toml` were consulted;
  their referenced `extra_references/review_guidelines.md` was not present.
  This is **not** a fresh official 53/53 platform review, nor execution of the
  platform's unavailable static checker scripts.
- Local browser diagnostics used the existing 2.0.9 tool image with unchanged
  exported application source and task-provided Express modules. Exported
  node_modules were unavailable; no new package installation was performed.
  This is not a reconstruction of every original sandbox detail. GPT's missing
  `sql.js` dependency prevented a complete unchanged-artifact local runtime
  replay without reinstalling dependencies; its additional findings are based
  on source and exported reasons, explicitly labelled accordingly.
- Exact Docker builds, agent bootstrap, official QC and paid Oracle/model
  regrades were not run here. The prior same-source local full-suite report
  remains supporting evidence, not a new paid score.

Missing robustness evidence: three identical-artifact regrades, at least eight
completed sampled rollouts for the spread test, two deliberately adversarial
judge grades, and keyword/injection/refusal-only full judge probes. Sonnet is
absent if the older strict delivery checklist remains applicable. The latest
official static/rubric verdict and complete judge action trajectories are not
in these exports. Old no-network/allowlist wording conflicts with the explicit
current public/public instruction; networking was left unchanged and marked
as a policy exception where appropriate.

## Recommendation

Treat this as **aggregate-threshold success with unresolved fairness/evidence
issues**, not fully complete post-run QC. Do not change the frozen accepted
score evidence or silently fix model artifacts. Resolve the Find convention
mismatch and judge-procedure evidence before claiming the model deductions
are entirely fair; any task/verifier change needs a new version and new matching
run evidence. For the stricter project rule, Oracle still needs all 27 Functional
passes and Haiku needs a completed grade.

No source changes or additional ZIP were made. Existing task ZIP:
`../2.0.14-oracle-repair/patchpad-editor-v2.zip`

SHA-256: `1703dec77e9f275e38664c07a72db54613a7017f65333d35fbb90fbf55ac2570`

Supporting files: `PATCHPAD-POST-RUN-QC.xlsx`, `findings.json`,
`criterion-review.json` (all 105 returned criteria), `post-run-scorecard.json`,
`docx-source-review.json`, `upload-review.json`, `evidence.json`, and the
`patchpad-postrun-*-browser.json` local observations. No screenshots survived
the disposable tmpfs containers; the JSON observations and logs are retained.
