# HireOps handoff ? 1 October 2026

**Status: BLOCKED for release.** The final three source reviews found no remaining task-specific defect. Their shared harness/policy findings and missing configured measurements remain open; no platform pass, Oracle score or Luna score is claimed.

## Current candidate

- Branch: `task/hireops-qc-2026-10-01`; latest source commit: `4353b270` (seven local repair commits after pulled base `f18c7432`). No push or upload performed.
- Task: `projects/hireops-recruiting-operations/hireops-recruiting-operations`.
- Frozen input SHA256: `8bfed895ffcd45370c19df262fd6ce836d198b8e6fe9c3d1ee93ae2645829efd`.
- [Review ZIP](review-candidate/hireops-recruiting-operations.zip): 35 files, single task root, 93,710 bytes.
- ZIP SHA256: `4280659f6a3686866492a1e09509f68ca35527d54f4704c689a0837cb33430b6`.
- [QC workbook](QC_REVIEW.xlsx), [reconciled findings](SUMMARY.md), [machine result](summary.json), [artifact manifest](review-candidate/candidate_manifest.json).

The task models recruiting compensation operations: precise intrinsic/annualized equity, approval bands, held authority and dual control, atomic budget commitments, immutable revision chains, signed payment adjustments, separate vesting clocks, referral provenance, concurrent/stale requests and durable audit history. These requirements remain intact. There are now 68 Functional criteria (weight 45), 12 Polish (weight 9), 6 Visual and 2 gates: 88 total. Canonical models, timeouts, resource settings, .6/.2/.2 dimension weights and strict Functional>.05 floor remain unchanged.

## Repairs completed

- Exact-cent UI parsing and revision prefills preserve large safe-integer amounts.
- A same-process worker keeps health responsive during database initialization; install refuses to reset a database held by a running process.
- Criteria use actual RewardKit-compatible identifiers. All 88 load through the installed pinned library.
- Role/authority, stale and concurrent operations, signing/equity caps, future referral vesting and authorization read/write families have independent controls and credit.
- Compensation completeness and refusal feedback are checked separately from financial arithmetic/enforcement.
- All four form families receive independent retention/recovery checks, including single-field rescission recovery through a bounded observed-operation transport interruption.
- Relocation remains an agreed recorded amount handled outside HireOps; approval/revision/rescission have separate checks against incorrect relocation payments or reversals.
- The basic storage gate requires a new offer to become COMMITTED and remain so in a fresh Auditor context, closing the requisition-only escape.
- Seven independent P0 checks compare the complete initial product seed with trusted public facts, separately from restart persistence. Extra judge-created records and valid alternative UI/schema layouts remain allowed.
- The inherited artifact-symlink rule is now disclosed in public integration instructions.

## Review coverage

The user-requested 53 one-row reviews were completed in separate agent contexts on the earlier round3 snapshot: [collection](../hireops-2026-10-01-round3/per-row-review/collection.json). Their 42 Pass/5 Fail/6 Not exercised verdicts remain historical, not clearance for current bytes. Confirmed task-local failures prompted later repairs.

Three parallel independent complete reviews were then repeated on repaired candidates. Each final reviewer assessed all 53 quality and 48 deterministic rows using the actual workbook and QC skill/references. The pipeline validates all three current reports. Private deterministic checker executables were unavailable: the48 rows are manual/source applications, not a hosted checker pass.

| Final reviewer | Quality Pass | Quality Fail | Not exercised | Deterministic review |
|---|---:|---:|---:|---|
| 1 | 47 | 2 | 4 | 36 Pass / 9 Note / 3 N-A |
| 2 | 46 | 3 | 4 | 36 Pass / 9 Note / 3 N-A |
| 3 | 46 | 3 | 4 | 36 Pass / 9 Note / 3 N-A |

The union of credible findings is retained. In particular, reviewer 1's coverage Pass does not dismiss reviewers 2/3's engine/health verifiability counterexample. The restart defect is classified under different rows by different reviewers; both remain open. No failure was outvoted or waived.

## Executed local evidence

- **77 domain checks pass**, including the full 9-cell authority matrix, all initial seed families, relocation exclusions, exact arithmetic, atomic operations and actual local process replacement: [results](../hireops-2026-10-01-repairs/domain-seed/results.json).
- **16 browser checks pass**, including exact large-money round trips, complete compensation display, all form recoveries, mobile navigation and no JavaScript errors: [results](../hireops-2026-10-01-repairs/ui-recovery/results.json).
- **Two Linux MCP runs, 7 observations each**, cover real pinned tools, separate browser storage, ordinary golden restart/readback, approved-offer readback and safe interruption/retry: [restart/tool results](../hireops-2026-10-01-repairs/runtime/coverage/mcp/results.json), [recovery results](../hireops-2026-10-01-repairs/runtime/recovery-mcp/mcp/results.json).
- **55 local structural checks pass**: [preflight](preflight.json). Independent reviewers also checked syntax and canonical equality. These do not substitute for the private portal checker.
- **All 88 criteria load** in actual installed RewardKit 0.1.7; current baked verifier bytes match the candidate: [schema discovery](../hireops-2026-10-01-repairs/runtime/schema-round7/discovery/results.json), [image hashes](../hireops-2026-10-01-repairs/runtime/round7-images.json).
- Archive CRC, single-root layout, extraction/source hashes, public hygiene and shell permissions pass.

The [raw evidence index](raw-evidence-index.json) binds reusable evidence to its actual source scope. Earlier scripted runtime runs use synthetic external reward transport only to hold the real harness open; their dummy reward values are not app grades. No runtime-evidence.json was fabricated. Original logs, database artifacts, prior reports and superseded candidates remain preserved locally.

## Remaining blockers and next steps

1. **Canonical lifecycle and scoring metadata defects.** Raw fixtures demonstrate a surviving SIGTERM-resistant original process falsely satisfying restart readiness, unbounded cleanup, and scored evaluator failure leaving graded=1/no_op=0. Tested fixes are prepared in [combined.patch](../hireops-2026-10-01-repairs/canonical-proposal/combined.patch); [proposal manifest](../hireops-2026-10-01-repairs/canonical-proposal/proposal-manifest.json) links normal/resistant/failure controls. The combined proposal also allows safe artifact-internal symlinks. All proposed controls pass, but the patch is **unapplied** and cannot be credited as shipped.
2. **Shared requirement/observation conflict.** Public integration mandates Express/SQLite and database-independent health while browser-only judges cannot establish those implementation properties. Resolve this at the shared template/policy level; do not silently remove requirements, add prohibited source inspection or call browser equivalence proof of an engine.
3. **Required configured measurements.** Full current judge/Oracle execution, LLM workload duration, partial-app reward discrimination and ranking, and target Luna difficulty are unmeasured. Provider access/authorization is unavailable in this session. Scripted elapsed times and source mutation vectors do not resolve these gaps.

The combined shared-patch approval request remains pending; no answer has been inferred. AGENTS.md says ?Preserve template-controlled files and settings.? Apply an authorized shared repair to the canonical template and this task together, update public symlink wording to the adopted rule, rebuild affected evidence and freeze/review a new candidate. The current snapshot remains canonical and blocked. Do not upload the review ZIP as a cleared release.

## Evidence portability

The complete local review history, raw evidence and frozen snapshots are preserved in [the evidence archive](../../archives/hireops-2026-10-01-evidence.zip). Its internal `_EVIDENCE_MANIFEST.json` records relative paths and SHA256 hashes. Extract into a separate workspace to inspect historical evidence; it is not the uploadable task ZIP. The original working files are retained.
