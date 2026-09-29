# Colderwater second cross-check — 27 September 2026

Two additional defects were reproduced and repaired. No unresolved concrete blocker was found in this local review. This is not platform acceptance or a measured Oracle result.

## Replacement candidate

- [Upload ZIP](colderwater-playground-devtools.zip): `d254c73e6ebe94b2001ed782b136707c9cc3c5391c35c0bcd7fd66705d0c8a25`.
- 50 files, 843918 bytes, one root; CRC, shell modes/LF and extraction hashes verified.
- Supersedes the immutable `b34abc10a29b…` archive in `../full-qc-2026-09-27/`.
- Exactly three changed files: `tests/test.sh`, `tests/scored/functional/judge.toml`, `tests/scored/functional/prompt.md`. All 23 golden/installer files are byte-identical.
- 33 Functional criteria / 49.5 total internal weight, two gates, four Polish and six Visual criteria. The 60/20/20 policy and strict Functional floor remain unchanged.

## Confirmed repairs

1. **False restart success.** The old helper accepted HTTP from a surviving SIGTERM-resistant server while its replacement crashed. The repaired helper proves old-group exit, rejects another listener, checks new-PID liveness and keeps waits inside the MCP deadline. Five lifecycle controls pass. A real golden browser restart proves durable records and a subsequent successful save. [Harness review](HARNESS_REVIEW.md).
2. **Redirect false failure.** The private-file check could reject a harmless redirect. It now follows only observed same-origin redirects within a three-hop bound, reports other destinations uninspected, and fails recognizable private contents. Seven actual-MCP fixtures / 21 probes passed, including six direct/redirected leak detections and zero off-origin requests. Transport failure remains incomplete evidence. [Privacy review](PRIVACY_REDIRECT_REVIEW.md).

## Evidence and review results

| Evidence | Result |
| --- | --- |
| 53 quality judgments | {'Pass': 46, 'Note': 7} |
| 48 deterministic procedures, local/manual equivalents | {'NOTE': 11, 'PASS': 33, 'N-A': 4} |
| Source / extracted source assertions | 90/90 each |
| Restart lifecycle controls | 5/5 |
| Orchestration controls | 4/4; synthetic judging only |
| Full golden browser/process restart | Passed |
| Independent golden browser flow | 6/6 groups; zero page errors |
| Actual-MCP privacy fixtures | 7/7; 21 path observations |
| Canonical scorer fixtures | 20/20; synthetic inputs |
| Rebuilt agent/verifier images | Exact seven public input / fifteen verifier file hashes match |
| Archive and current source | All 50 file hashes match |

The second semantic reviewer read the public requirements before all 45 criteria and five prompts, then both QC workbooks and prior evidence. See [semantic review](SEMANTIC_REVIEW.md), its superseding privacy finding, [golden recheck](GOLDEN_RECHECK.md), [findings](qc_final_findings.json), and [candidate binding](final_candidate_binding.json). The independent golden review checked all 45 prior detailed witnesses and performed a fresh continuous browser flow on the b34 archive. Their reuse here is justified by all 23 solution hashes matching; the changed restart/privacy protocols have fresh separate proofs. Previous report/hash files remain historical and were not relabelled as newly executed tests.

The frozen images are `colderwater-agent:20260927-crosscheck` and `colderwater-verifier:20260927-crosscheck`; [image evidence](final_image_evidence.json) records actual IDs, Chromium version and file hashes. The provided template and canonical `score.py`, `restart_mcp.py` and `scoring.toml` were not changed. The task's generated restart shell deliberately repairs a reproduced template defect while preserving its runtime contract.

## Limits and score implications

The seven quality Notes retain the prior explicit limits: complete paid-judge timing, provider execution, aesthetic judgments, bounded architecture/security coverage, arbitrary mocks, real-product ranking and remote-provider reproducibility. The official private static-checker scripts were unavailable; report coverage does not mean they were executed. Bounded private-file probes do not inspect redirect bodies, off-origin destinations or arbitrary filesystem routes. Diagnostic failed fixture attempts remain in this directory with their own labels.

There is no measured Oracle or target-model result for this ZIP. Local golden behavior supports the Oracle target but does not guarantee judge-assigned 1.0. The redirect fairness repair can restore at most `0.6 × 0.5 / 49.5 = 0.0060606` total reward when gates/floor already pass. Correct restart detection can remove previously unearned persistence credit; no model score is inferred from that bound. The prior provisional functioning-model estimate of 0.55–0.75 remains unmeasured, so a score at or below 0.7 is not guaranteed.

No paid calls, platform upload, commit or push were made in this cross-check. Shared lessons and the current handoff were updated. Use this replacement ZIP, not an older archive.
