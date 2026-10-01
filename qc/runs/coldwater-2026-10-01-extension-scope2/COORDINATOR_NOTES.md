# Coordinator record

This is a work-in-progress record, not QC clearance. The frozen candidate is
`ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8`.
Original reviewer reports remain unchanged. Reconciliation must retain credible
failures and measurement gaps regardless of how many other rows pass.

## Repairs prepared during the independent round

No task bytes have changed during this review round. Proposed repairs are outside
the task and snapshot, under `qc/repairs/coldwater-2026-10-01-install-refusal/`.
They will need a new candidate and appropriate revalidation when applied.

1. Row 19 demonstrated that `solve.sh` can unlink the database of an already
   running UID 65534 app. Normal installation, process restart and alternate
   `DB_PATH` passed. The failure concerns the repository's active-install safety
   rule, not a measured Oracle failure. `proposed-solve.sh` uses Node's filesystem
   API to distinguish permission errors from vanished descriptors, refusing a
   reset when closure cannot be established. Its raw control passed active root
   refusal, active unprivileged refusal and unchanged saved data, ordinary and
   alternate-path restarts, and closed reinstallation. No shared harness edit.
2. Row 23 demonstrated that the integration note's description of `HOME` can
   mislead an implementation: canonical launch runs `/app/server.js` while
   `HOME=/tmp/submission`. A controlled conforming alternative returned 200 under
   the documented relationship and 404 under actual launch. The proposed
   integration note explains that `HOME` is a writable staging directory which
   can differ from `server.js`'s location. No feature or score-policy change.
3. Row 26 identified unobserved lifecycle paths already required by the brief:
   replacing pending JS work with HTML/CSS, and message/source-line/last-good
   restoration after an uncaught later interaction on a completed preview.
   The independent review established a source coverage gap, not an executed
   model false-pass. Additional root-owned browser controls against this exact
   frozen golden passed both replacement modes and the later interaction error
   including its actual one-based line and restored most-recent render. Evidence
   lives in the repair directory's `coverage-controls/`; it is not proof that
   the currently shipped rubric exercises those paths. A new candidate must
   add the missing observations while retaining independent error-message,
   source-line and rollback credit. No app defect was reproduced by this probe.
4. Row 32 demonstrated a protocol-level weakness in the five unsupported-code
   probes: executing them and then reporting refusal had the same recorded
   observations as refusing them before execution. Marker-bearing alternatives
   distinguish the two fixture behaviors. The golden also rejected all five
   alternatives without their markers or damage to its last good preview;
   see `unsupported-controls-v2/` in the repair directory. The first local
   attempt incorrectly required the wording "unsupported" or "outside ...
   supported" and is preserved in `unsupported-controls/`. Native CSP refusal
   messages are valid policy explanations; the corrected probe accepts those
   and records the actual message. This was a probe wording correction, not an
   application change. Update the shipped S08 probes to make success visible
   while accepting equivalent clear refusal explanations.

## Evidence corrections and limits

- Read row 18 with `row18-evidence-correction.json`. The reviewer retracted a
  mistaken claim about a full-page screenshot. Actual viewport and frame
  screenshots subsequently showed the preview; the reason some full-page
  captures omit it remains unproven. Both attempts and the original report are
  preserved. The corrected evidence supports plausible reference coverage,
  not an Oracle score.
- `derived-cache-cleanup.json` records removal of generated Python bytecode
  under the frozen skill scripts. All authoritative frozen files still matched
  the manifest. Reconciliation returned INCOMPLETE after this cache removal;
  no source or rubric verdict was altered.
- Failed diagnostic attempts in row 22 and row 23 are retained alongside the
  corrected probes. Those setup errors are not product defects.
- Shared launcher controls demonstrate restart/cleanup/failure-reporting defects
  in unchanged template bytes. The proposal is not applied or approved. A
  separate exact-image socket control shows that `urlopen(timeout=2).read()`
  can successfully take longer than two seconds; it does not run the entire
  launcher or measure configured judge workload.
- No paid provider run, hosted Oracle, target-builder grade or portal acceptance
  has been obtained for this candidate. The separately asked approval for one
  paid configured run remains pending.
