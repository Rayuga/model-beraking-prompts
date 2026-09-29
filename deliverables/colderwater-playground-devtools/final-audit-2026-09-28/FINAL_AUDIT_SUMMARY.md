# Colderwater final audit

Frozen archive: `review-candidate/colderwater-playground-devtools.zip`

SHA-256: `4fdee18db02cbbbd0551558f99163f1d553e318f2abbe4ae88e979bd45ef20c1`

## Final results

- Package: 50 files, one root directory, valid CRC, executable shell modes, and exact extraction hashes.
- Mechanical source audit: 95/95.
- Mechanical extracted-archive audit: 95/95.
- Colderwater regression guards: 49/49 on source and 49/49 on the extracted archive.
- Workbook coverage: all 53 quality checks and all 48 deterministic checker names have dispositions.
- RewardKit: installed `harbor-rewardkit==0.1.7` parsed and launched the final 93-row prompt/schema offline.
- RewardKit serialization: all-yes, highest-weight-no, and smallest-weight-no cases passed with the expected row counts and weighted means.
- Functional rubric: 93 binary outcomes, exact total weight 49.5, and all 37 original scenario budgets conserved.
- Public hygiene: no criterion-ID leaks, internal grading terms, or network-policy contradictions.
- Golden solution: unchanged from the prior candidate.

## Final two coverage repairs

The stale-Save protocol now dirties and verifies title, filename, and source. The unchanged golden retains all three fields and recovers successfully. A mutant that loses title and filename fails the intended observation.

The Polish keyboard criterion now covers every requested workspace, library, and file control while allowing native/composite controls and avoiding destructive activation. The unchanged golden passes. A mouse-only Export mutant fails the intended observation.

## Change boundary

Relative to archive `f86708344b0861aad8a48049996c7b72266c29d6d68bf377358a0c5810aad6ae`, only these task files changed:

- `tests/scored/functional/prompt.md`
- `tests/scored/polish/judge.toml`

No solution file changed.

## Evidence boundary

The complete Functional judge still has no measured hosted LLM/browser wall time, Oracle result, or target-model result for this exact archive. Timeout nesting is valid, but the 9000-second Functional judge fit remains `Not exercised / P1` until a complete hosted run finishes. Focused browser tests and local RewardKit fixtures do not replace that measurement.

See `QC_FINAL.xlsx`, `qc_final_findings.json`, `history.md`, `history.json`, `focused_proof_index.json`, and `evidence_index.json` for the complete evidence.
