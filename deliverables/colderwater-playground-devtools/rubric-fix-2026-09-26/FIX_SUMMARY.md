# Colderwater rubric correction — 26 September 2026

Current candidate: `colderwater-playground-devtools.zip`, 50 files, 838,700 bytes.

SHA-256: `76ab7fb11195aa564b1ac5647439cc34be4b8c00fd28918f95b06ed286fd6d4d`.

This revision addresses the ten platform findings listed in `PLATFORM_FAILURES.md`. Our earlier local review missed substantive gate and coverage gaps; the prior ID-only repair did not solve them. The old affected PASS verdicts are superseded, not evidence that the platform was wrong.

## Changes

- Rewrote the brief and six notes in an owner's voice, retaining the runtime and business requirements. Removed the leaked reference to "verifier files". The shared packager now blocks internal grading terms as well as public criterion-ID collisions.
- Render now requires a newly authored JavaScript marker to appear in preview and console after Run. Constraints requires a new UI save to be retrieved from the server in a clean independent browser context and again after reload. All scored prompts inherit those prerequisites without repeating the probes.
- Added missing observations for every named unsupported execution family, stale rename, all four dirty-work transitions, title-only/filename-only/source-only dirty changes, import with auto-run off, case-sensitive title pairs, blank titles and single-file naming.
- Split independent origin isolation/network restriction/unsupported execution, four error paths, normal/stale rename, in-app/native leave warnings, and export/import. Linked positive-control, refusal, state-readback and recovery legs remain together.
- The network check uses locally fulfilled reserved-domain browser routes, an unprotected control page and separate preview fetch/image attempts. It tests actual delivered requests, not an accidental DNS or CORS failure. The delayed callback now starts four seconds after Run, so a newly reset five-second callback budget cannot pass the original eight-second allowance.
- Clarified startup consistently: opening offers useful code with automatically produced preview/console, whether an example or a loaded snippet, even with a gate-created saved record. No blank-library assumption or destructive reset was added to the rubric.
- All five prompts explicitly prohibit application implementation inspection while allowing user-authored snippet/file text as product data.
- Fixed golden reinstall to clear only the closed canonical SQLite database and its sidecars. Ordinary startup/restart still preserves records. The golden app source, compiled bundle and lockfile did not need changes.

There are now **32 functional criteria, total weight 49.5**, versus 24 previously. The canonical 60/20/20 policy, strict Functional > 0.05 floor, timeout hierarchy, shared scorer/restart helper and four Polish/six Visual criteria are unchanged.

## Evidence

| Check | Result |
| --- | --- |
| Golden executable regression groups | 65 passed: 59 real Chromium 152 browser groups and 6 installer lifecycle groups |
| Source assertions | 81 passed on source and extracted ZIP |
| Revision/redistribution assertions | 37 passed on source and extracted ZIP |
| Contract and coverage checks | 23 passed; every public requirement mapped to an observation or explicit observability boundary |
| Old grading-word leak | Reproduced on the previous uploaded archive; packager rejects it before creating an output folder |
| Negative gate fixtures | Inert Run fails the authored-output gate; localStorage-only library fails independent saved-record retrieval |
| Browser-tool feasibility | Actual installed MCP detects externally delivered resources in a permissive mock; golden blocks both while the unprotected control succeeds |
| TypeScript and Vite | Passed; rebuilding reproduced all solution bytes, including `index-DlddEka4.js` |
| Final images | Empty agent app and exact public inputs verified; all 15 verifier files match source |
| Archive | CRC, one root, executable LF shells, extracted hashes and both instruction-hygiene guards passed |

Read `GOLDEN_FIX_AND_BROWSER_PROOF.md`, `MOCK_GATE_VALIDATION.md`, `REQUIREMENT_COVERAGE.md` and `QC_FINAL.md` for scope and evidence. Paid Oracle/model evaluation and private platform acceptance have not been established. A focused local browser check is not a paid judge verdict, and a complete 53/48 review is not proof against every possible bad app.

## Score consequences

The screenshot's dead-editor witness could earn 3/49.5 Functional and 0.75 in each presentation dimension: **0.3364** under the old gate. The executed inert-runner and browser-only-library fixtures now fail a prerequisite, which forces reward 0 under the unchanged scorer. This is specific negative evidence, not a measured full model run or proof of universal ranking.

Separate checks provide fair partial credit, so some model scores can rise. Holding gates and presentation fixed, the conservative redistribution bound when both versions already clear the floor is **+0.121212 before rounding, at most +0.1213 in published scores**. Newly covered refusals and stricter probes can lower credit instead. This is an abstract bound, not a prediction.

Crossing the existing functional floor can unlock presentation and cause a larger jump; the abstract Boolean analysis finds an old 0 → new 0.5455 witness. Such combinations need not describe a realizable app. Do not quote the twelve-point bound as unconditional. Conversely, a model with a dead runner or no shared saved library can now score zero, so the requested 0.1 lower target cannot be guaranteed while applying valid gates.

Natural voice and grouping retain reviewer judgment. Browser behavior cannot prove the internal SQLite engine, exact libraries or every possible network mechanism. More independent checks also create more judge actions within the unchanged budget; the actual Oracle run is still needed to measure execution reliability and calibration. No reported issue was left as an unimplemented known source defect.

Shared context, workflow and handoffs now include the new regression requirements. No paid calls, upload, submission, commit or push occurred in this fix pass.
