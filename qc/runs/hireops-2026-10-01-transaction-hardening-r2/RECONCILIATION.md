# Hardening round 2 reconciliation

All 53 quality rows have separate fresh reviewer contexts, plus one separate all-48 deterministic review. The pipeline accepted all 54 reports, none missing, and structural preflight passed. Source, frozen rules and engine hashes match. The result is **BLOCKED**. Original reports remain immutable; no failure is outvoted or waived.

## Confirmed task-specific findings

| Row | Finding | Decision for the next candidate |
| --- | --- | --- |
| 19 | A fresh installer with no database fails on an unrelated unprivileged sleeper while scanning every process descriptor. Paired Docker fixture confirms it. | Skip the inactivity scan only when the exact database/WAL/SHM targets are all absent; retain protection for an existing database. Re-run the failing fixture and lifecycle. |
| 20 | Exact golden reference bytes are static and archived but not committed. | After repairs and local validation, commit only the HireOps task and verify the Git tree against current file hashes before the next freeze. |
| 26 G1 | Ordinary computed request claims have no explicit hostile-claim observation. | Add a bounded protocol using only actual observed claims, legitimate controls and fresh readback. Give each existing financial/authority owner its own evidence. Accept absent claims and safe rejection of unsupported claims; clarify the public wording accordingly. |
| 26 G2 | Normal response payloads can substitute for required on-screen financial details. | Require rendered grant schedule/start, signing remittance, referral halves/cliff and defined financial figures; allow ordinary expandable details and equivalent formatting. |
| 26 G3 | Revision and stale-commit recovery can pass with silent refusal. | Include understandable failure feedback in those recovery observations, without exact copy or amount wording. |
| 26 G4 | Rejected preparation can erase the coordinated editor without losing recovery credit. | Add separate preparation recovery using 0.5 points transferred from existing coordinated commit recovery. Budget refusal may occur at preview or commit; use actual malformed-input refusal when needed. |
| 28 | Commit recovery requires the touched-requisition freshness refusal, duplicating its Functional failure. | Preserve that preferred scenario but permit independent genuine source-stale/budget refusal and corrected success. The isolated partial-recovery mutant confirms retained recovery despite deliberately broken economic-version invalidation. |
| 30 | Ordinary relocation exclusions can credit a no-op payment writer. | Require matching actual nonzero signing payment, adjustment or contra-payment as the control. Payment existence is distinct from amount correctness; preserve independent arithmetic credit. |

Root's targeted golden browser observations already demonstrate the currently required rendered financial details and rejected-prepare retention/correction. These finite observations support the repair design; they are not configured judgments. No new product scope or easy-point mass is added. Functional stays 45 points (28 coordinated), Polish 9 (6 coordinated), Visual 6; shared dimension weights, model settings and timeouts stay unchanged.

## Shared concerns retained

- Rows 21 and 35: canonical restart can report success while the old SIGTERM-resistant process remains and replacement fails with EADDRINUSE. Normal process replacement also works in its positive control. Final cleanup has an unbounded wait; the fixture exceeded its eight-second observation window. Reward artifacts remained present in the reproduced cases; no missing-reward claim is made.
- Row 46: canonical permission broadening follows `/assets -> /tests` and locally exposes private criteria to the submission UID. Ordinary assets isolation passes. Preservation/reachability of that symlink through hosted artifact transfer remains unmeasured; no hosted exploitation or forged reward is claimed.
- Browser-only grading cannot prove all shared architecture/delivery mandates. Generic baked-pytest applicability to the canonical RewardKit template remains a shared deterministic Note.

The user accepts continued work with common blockers outstanding. This is not authorization to edit the shared harness, rewrite reward policy or mark them passed.

## Missing measurements

Rows 11, 18, 22, 40 and 42 retain their evidence limits. Required full configured workload, verifier launch/grading, empirical app reward discrimination and ranking records remain absent. No configured GLM grade, Oracle grade, Luna score or hosted QC result has been measured. Provider spending and uploads remain unauthorized.

Uncached task-layer builds took 35.672 seconds for the agent and 214.25 seconds for the verifier, using existing base images. This later evidence addresses the local build component of row 11, not full workload or registry cold-download time. Installed RewardKit parsing/schema and OS argument launch pass; `/usr/bin/true` is explicitly a transport-size probe, not a judge invocation. Synthetic reward fixtures demonstrate arithmetic/orchestration only, never app ranking.

## Artifact and integrity status

R2 contains 145 Functional, 4 Polish, 5 Visual and 2 gate criteria in 37 files. Its ZIP SHA256 is `8bf362f1f18defa08c1ce60f6ba1e79cb8423993134eb17186b7f20aea34f440` (104691 bytes), under `deliverables/hireops-recruiting-operations/2026-10-01-hardening-r2/`. CRC, shell modes, extracted member hashes, extracted execution and container source bindings passed. It matches the frozen tested R2 source and becomes historical after repairs.

Finite positive evidence includes 77 legacy domain assertions, 14 legacy UI groups, 15 coordinated domain groups, 5 coordinated UI groups, 7 actual MCP feasibility groups, normal real restart, installer lifecycle, boundary/mutant controls and archive execution. Each retains its raw logs and source binding; none establishes a complete configured grade.

An unmanifested generated Python bytecode file in the snapshot was preserved as evidence and removed by an exact-path restoration after previewing the bounded cleanup tool. No declared input bytes changed. Whole snapshot inventories and final reconciliation match. See COORDINATOR_NOTES.md and local/snapshot-contamination/restoration.json.

Next: apply the accepted task-only repairs, validate and commit them, then freeze a new `single-per-row` round. Preserve this round and its ZIP as evidence. No clearance or score promise is made.
