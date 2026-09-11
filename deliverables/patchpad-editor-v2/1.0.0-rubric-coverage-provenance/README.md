# PatchPad: line-number coverage and prompt provenance

Upload [patchpad-editor-v2.zip](patchpad-editor-v2.zip). Version remains 1.0.0,
with 32 files and 39 criteria. This release addresses the three new rubric
findings in the supplied screenshot; two of them cite the same missing prompt
version identifiers. It is not a new platform QC or Oracle result.

| Reported issue | Change |
| --- | --- |
| Required document line numbers were not graded | Existing Functional navigation criterion now observes the first, fifth/sixth and final line numbers with their corresponding text, including after scrolling. Cursor status alone is insufficient. No new criterion or weight. |
| No prompt-version marker in any dimension | Every prompt contains plain-text task version 1.0.0 and a unique dimension-specific prompt version ending in v1.0.0-r1. These are metadata sentences, not code comments. |
| Inconsistent prompt provenance and reference-product residue | Removed Docketlight, marketplace and reference-template wording. The runner logs every prompt/judge file hash plus runner/reward hashes to prompt-provenance.json and stdout. |

Numbering may be consistently zero- or one-based. Virtualized line rendering
is accepted; no particular gutter element or placement is prescribed. All prior
navigation interactions and exact outcomes remain. Visual stays appearance-only.
Golden app, task configuration, Dockerfiles, seeds, all weights, criterion count
and final gated 60/20/20 reward processing are unchanged.

Validation passed:

- 118 standard checks, including the new per-prompt version checks.
- Fresh offline browser observation of visible line numbers, the full existing
  navigation sequence, final-line scrolling and unchanged document text.
- Negative control: hiding document line numbers leaves cursor status visible
  but removes the required line-number evidence. This is a local diagnostic,
  not an executed LLM verdict.
- Exact runner startup and empty-submission zero handling; all provenance file
  hashes match their actual bytes, and provenance is present in stdout.
- A trusted local judge stub produced dimension inputs for a 0.58 final reward
  and five-dimension CTRF. That injected reward is not an Oracle score.
- Parsed criterion/configuration preservation, shell syntax, whitespace, ZIP
  CRC and byte-for-byte ZIP/source equality.

Browser/runtime tests used a fresh disposable container with networking disabled
and cached `patchpad-preflight-tests:2.0.9` tools. No new Docker build was needed
for this unchanged Docker configuration, and no exact-image or full LLM run is
claimed. Subjective semantic QC must be rerun on the platform. Previously
deferred score-floor and intermediate gate-weighting concerns remain unchanged.

- [Exact verifier before/after](VERIFIER_BEFORE_AFTER.md)
- [Package audit and SHA-256](package-audit.json)
- [Line-number observations](line-number-check.json)
- [Runtime checks](runtime-check.json)
- [Logged prompt provenance](prompt-provenance.json)
- [Top-of-document screenshot](line-numbers-top.png)
- [Final-line screenshot](line-numbers-tail.png)

For subsequent prompt edits, increment the affected prompt's rN identifier while
keeping the task-version field fixed at 1.0.0, regenerate the ZIP, and preserve
the new logged hashes. Hashes identify verifier inputs; they do not guarantee
deterministic model judgments.
