# Pellmoor hardened delivery

Upload the `pellmoor-job-pipeline.zip` in this directory as a new platform task
version. The task.toml version remains 1.0.0 under the shared authoring standard.
SHA-256: `78e09b260ff8162f3d29ffd504a3524a9ecbe229ab6e3e9e74ad99b74dc22033`.

## What changed

- Assessment versions advance on panel additions, removals and entry into
  interview. Previous scores remain visible as history; retained or re-added
  panel members must score again. Offer, hired and terminal stages freeze
  assessment edits. Every requirement is explicit in the supplied instructions.
- Offers reserve openings; hires fill them. A race for the last opening permits
  one winner, then rejects a refreshed fully assessed loser for full capacity.
  Withdrawal releases capacity. Old receipts cannot reacquire it or undo a hire.
- Retry identity belongs to the authenticated person across sessions and
  restarts. Revoked tokens cannot replay receipts; another actor can reuse the
  same operation id independently. JSON object key order does not change identity.
- Updated the reference server and UI with historical scores, removal controls,
  readiness explanations, capacity counts, canonical request fingerprints and
  authoritative refresh after mutations. SQLite savepoints roll back rejected
  product actions while retaining business-rejection receipts.

The ZIP has 32 files. All original seed bytes and 44 original criterion IDs
remain. Eight Functional criteria were added, giving 52 criteria overall:
Render 2, Constraints 2, Functional 32, Polish 10, Visual 6. The existing static
asset-reference repair is retained. No tests, reports or runtime databases from
local diagnostics are added to the task ZIP.

## Scoring

The required 60% Functional / 20% Polish / 20% Visual formula is unchanged.
Five core integrity criteria now each weigh 8 within Functional: stale writes,
simultaneous writes, successful retry replay, rejected replay/mismatch, and
malformed or forged writes. Together they account for 40 of 78.5 Functional
weight. New workflows account for 17; remaining original criteria account for
21.5. This prioritizes the explicitly required integrity behavior over basic
workflow coverage while preserving every original criterion.

An illustrative implementation failing those five integrity criteria but passing
everything else scores at most **0.6943**, even with perfect Polish and Visual.
At 0.9 Polish and Visual it scores **0.6543**. Failing those five and all eight
additions caps the score at **0.5643** with perfect presentation. These are score
calculations, not measured target-model results or guaranteed score ceilings
for other implementations. `hardening-report.json` records the exact changes.

## Validation

- 131 shared template/configuration checks passed.
- 19 existing regression groups and 9 new workflow groups passed using real
  browser actions plus controlled HTTP probes in the cached verifier environment.
  Both local attempts are retained; attempt 2 added mobile removal-control and
  withdrawn-assessment checks. Neither attempt produced a behavioral failure.
- Six deliberately broken implementations were detected by local HTTP probes;
  the unchanged reference passed each corresponding probe. They cover retained
  scores, reopened scores, overbooking, JSON key ordering, actor identity and
  lost receipts on restart. This is evidence for the local probes, not a claim
  that the platform LLM judge has detected those implementations.
- Browser TypeScript bundled successfully. Server/rules JavaScript, shell
  entrypoints, all TOML and embedded runner Python parsed. Desktop/mobile and
  both-theme screenshots were inspected, including panel removal on a phone.
- Ten reward postprocessor cases passed. The real startup/lifecycle runner used
  synthetic dimension scores to check aggregation; its 0.58 is not an Oracle
  or target-model score.
- ZIP CRC, source-byte equality, Linux line endings, seed preservation and all
  four instruction-reference/COPY mappings passed.

The final edit after the browser runs changed only the five criterion weights;
the final template and reward checks cover that configuration. Browser-run
provenance records the earlier weight-3 configuration; package-verification.json
and hardening-report.json record final source hashes with weight 8. Reference
app code and behavioral criterion descriptions are identical to attempt 2.

## Remaining validation

Both exact Docker builds were attempted. The environment build stalled at apt
repository access and was stopped after about 381 seconds. The verifier build
failed after repeated HTTPS timeouts contacting PyPI. Runtime checks therefore
used cached `pellmoor-tests:2.0.3` with the current source and verifier scripts,
not either exact new image. Their successful full builds remain unverified.

No platform static/rubric QC, full paid Oracle run or target-model run has been
performed for this checksum. The longer browser journey and larger integrity
weights require calibration: verify the reference receives full credit and
test the intended model/settings on this exact ZIP before claiming it meets
the less-than-0.7 target. All source changes are in the active project; the
pre-hardening source and older deliveries remain available.
