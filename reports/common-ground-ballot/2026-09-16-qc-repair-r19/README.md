# Common Ground Ballot r19 QC repair

The ZIP repairs the seven findings in the latest screenshot. Task version remains
`1.0.0`; all operational template values, judge model/reasoning configuration,
timeouts and final score weights remain unchanged. There are **five serial verifier
dimensions and 69 criteria**: Render 1, Constraints 2, Functional 50, Polish 10,
Visual 6. These are five judge invocations, not 69 separate verifier runs.

| Reported finding | Repair |
| --- | --- |
| Deliverables/runtime contract | Full brief moved to `instruction.md`; explicitly requires shared person/role/group identity in every protected workspace, draft revision 1 and exact +1 accepted transitions. |
| Achievable/unambiguous instructions | Defines ballot and membership revision rules, seed preservation, rejected/replayed revision behavior, and independent session credentials. |
| Timeouts fit the work | Supplies real SQLite schema/transactional seed/authentication and sign-in shell; merges recovery into the Functional prompt; shares staff receipts, refusal fixtures, queue controls, role snapshots and final restart. Original 49 Functional IDs/weights remain. Homogeneous probe tables are bounded and save failures independently. Timeouts are unchanged. |
| Verifier image launch | Removes both Docker-time tracing installations. The runner materializes a private PATH shim outside `/tests`, directly delegates to the untouched installed Codex, and never renames its executable. Exact runner tested twice. |
| Coverage of unpredictable sessions | Adds one independent, publicly specified credential-integrity criterion. Golden rejects eight forged/tampered credential categories; an otherwise working insecure public-ID session mutant is detected. |
| No unrequired grading | Group identity and revision origin/increments are now explicit public requirements matching the verifier and golden app. |
| Task folder only contains allowed files | Removes root test Python/JS helpers, `SCORING.md`, separate recovery prompt and `environment/instructions/`. Runtime helpers are readable heredocs in allowed `test.sh`, generated under `/opt/common-ground-verifier`. Adjacent dimension `prompt.md` files are retained because the detailed `grading_wiring_is_structurally_correct` clause explicitly permits them and pinned RewardKit requires file paths. |

The golden application and seed are byte-for-byte unchanged. The prior reported
failure was in verifier infrastructure/evidence, not a reproduced golden business
defect. The more useful starter still requires all ballot business routes,
eligibility/privacy projections, result math, audit, receipts and browser recovery.
The task remains complex; this package does not predict a new GPT score.

| Local validation | Passed | Failed |
| --- | ---: | ---: |
| Score composition and malformed output | 19 | 0 |
| Exact runner, actual RewardKit discovery, Codex preservation | 26 | 0 |
| Supplied starter authentication, seed and restart | 8 | 0 |
| Golden recovery | 23 | 0 |
| Golden server boundaries | 58 | 0 |
| Trace wrapper | 8 | 0 |
| Session integrity on golden | 3 | 0 |
| Session mutant detection and positive controls | 3 | 0 |
| **Runtime/regression groups total** | **148** | **0** |
| Source contract/layout checks | 259 | 0 |
| Actual ZIP checks | 294 | 0 |

The runtime image was checked to contain the exact final verifier source bytes.
Actual RewardKit discovery found exactly five dimensions and loaded 69 criteria;
no helper module was discovered as a reward. Synthetic scores test runner plumbing,
not application quality. Golden business/browser checks used the unchanged reference
app; session-forgery checks used the pinned Playwright MCP.

**Verification limits:** two builds of the actual shipped Dockerfile reached APT
but failed because the local Docker network routed through an unresolved corporate
proxy. Clearing standard proxy build arguments did not fix that external setting.
Runtime checks therefore used an explicitly labelled cached-dependency validation
image, restoring the genuine npm Codex executable and applying the final `/tests`
files. This does not establish a clean network image build. A fresh platform QC,
Oracle and model run are still required; no new Oracle/GPT score or measured
end-to-end grading speedup is claimed. The workload matrix measures reduced work
and text, not autonomous judge duration.

Historical r18 is superseded: its actual Dockerfile installed the wrapper twice.
Earlier cached-image tests did not exercise that installation sequence.

ZIP: `common-ground-ballot.zip` (29 files under one task wrapper).
SHA-256: `c24cd7e3fc3b430e6fb1ad957dcb5c0ed983ef164980ea3514827a28bf6fb315`.
