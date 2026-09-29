# Ridgeline rubric correction — 26 September 2026

Candidate: `ridgeline-print-storefront.zip`, 51 files, 698,609 bytes.

SHA-256: `f8a9b605699d7e87dc1a0a08fb2f48e23a16e784588c7380d3a5aa47a77b706d`.

This revision addresses the ten platform rubric failures. The earlier round-two local review was too confident and is superseded. Private platform acceptance and paid Oracle/model scores remain unmeasured.

| Reported issue | Repair |
| --- | --- |
| Natural product request and human voice | Rewrote the brief and notes as owner explanations; technical setup stays in integration notes. All requirements remain mapped in `REQUIREMENT_COVERAGE.md`. Voice remains a judgment call; contractions alone do not guarantee QC. |
| Golden runtime/install contract | Installer resets only the three canonical SQLite files after confirming they are closed. Seven regressions prove used-workspace reinstall, active-use refusal and durable normal restarts. |
| Browser-driven judging | All five prompts explicitly prohibit submitted source/implementation/comment inspection as scoring evidence. Rendered DOM, browser actions and relevant observed data exchanges remain allowed. |
| Missing requirement coverage | Added four server-side missing-address probes with independent valid controls; the requirement-first map also covers visitor basket isolation and unknown references. |
| Independent criteria | Split catalogue display/filtering/sorting, basket persistence/removal and historical receipt/unknown reference. Linked valid/invalid/recovery legs stay together. Functional now has 21 criteria, still weight 35. |
| Global browser prerequisite | Constraints places one ordinary order and retrieves it through normal UI in a clean independent browser context, then reloads. Scored prompts inherit that prerequisite and check live populated content without repeating purchases. |
| Floor for mocks; reward ranking; gates before scoring | An executed static-JSON/localStorage fixture with a no-op HTTP200 write passes the old observations but fails new independent retrieval. The unchanged gate policy then prevents scored reward. This repairs the demonstrated counterexample, not every imaginable ranking. |

Fairness review also removed an accidental exact-origin restriction: embedded/data/blob assets and local loopback aliases remain valid. The requirement is self-contained operation, not identical URL origins.

## Evidence

- Source and extracted ZIP: 80 source assertions and 24 correction assertions passed each.
- Contract: 19 checks passed, including weights, seed table, metadata and stock allocation.
- Golden: 7 installer/restart groups and 11 Chromium 152 browser groups passed.
- Negative fixture: 6 browser checks demonstrate rejection of fake shared order storage.
- Images rebuilt: all 15 verifier files match; agent contains exact notes/assets and an empty app workspace.
- ZIP CRC, single root, executable LF shells, extracted hashes and criterion-ID scans passed.

See `QC_FINAL.md` for independent 53/48 review; `GATE_ADDRESS_BROWSER_VALIDATION.md`, `ORACLE_REINSTALL_VALIDATION.md`, `mock_gate_evidence.json` and `REQUIREMENT_COVERAGE.md` for evidence. Earlier unchanged backend/presentation/harness results are explicitly reused, not claimed as newly rerun. New browser tests used the unchanged pinned runtime from older images; final rebuilt images were independently hash-checked.

## Score effects and remaining limits

No reported issue is inherently unfixable. Naturalness and criterion grouping remain reviewer judgments. Browser observations cannot prove an internal database engine/framework; the gate proves a shared write/read, while process-restart durability remains a functional check. A stronger basic backend gate can give a backendless model **zero**, so a 0.1 minimum cannot be guaranteed honestly.

The canonical 60/20/20 policy, functional floor 0.05, four Polish checks and six Visual criteria are unchanged. Address validation gets 2/35 Functional weight, funded by trade-preview and postage-preview weights changing 2→1 each. Deep stock, retry, cancellation and concurrency weights stay unchanged.

Splitting criteria can raise scores for partial implementations. Holding gates/presentation equal, the conservative redistribution bound is **+0.080571 reward when both versions already clear the functional floor**. This is not a prediction. Floor crossings can cause a larger jump: abstract binary allocation analysis finds an old 0 → new 0.506286 witness with full presentation and both gates passed. Such combinations need not represent a realizable model app. See `revision_preflight.json`; do not describe the eight-point bound as unconditional.

With full presentation and a passed floor, reward remains `0.4 + 0.6 * functional`; reaching at most 0.7 needs Functional at most 0.5. Oracle 1.0 and actual target-model calibration still require measured judge runs on this exact candidate.

The shared context and workflow now require bidirectional coverage, explicit source bans, executed negative gate fixtures, installer-versus-restart testing, floor-aware score analysis and final hash-bound evidence. No paid calls, commit, push, upload or submission occurred in this fix pass.
