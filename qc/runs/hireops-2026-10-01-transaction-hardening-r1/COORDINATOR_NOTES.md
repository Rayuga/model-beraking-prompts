# Coordinator notes — completed round, see reconciliation

This file records coordinator notes, not an independent review or clearance. Assigned reviewers did not receive these notes before finishing their reports. The frozen candidate was not edited during the round. All 54 reports are now complete; see `RECONCILIATION.md` for decisions and corrections.

Current input: `6e0b8d2fb655781b3dbd8f4bde8d064dd48f8f7671ecd87f6a2db22b5c0aa8a1`.

## Confirmed repair candidates

- Public rules contain corrupt punctuation and missing spaces (quality row 03). Repair the actual UTF-8 text without changing economic meaning.
- `hro_commitment` still requires the imported `REQ-ENG-2` seed observation even though operational import is now optional (quality row 04, independently observed by the deterministic reviewer). Preserve fresh budget controls; remove the unconditional optional-seed dependency.
- Public rules disclose the verifier's `/tests` directory (quality row 05 and deterministic review). Retain the application requirement to work from a different current directory; remove the internal directory name.
- Golden bootstrap returns at most 5,000 audit lines. An approval log row disappears from that feed after 5,050 successful logins, while its offer remains committed. The offer-specific observation is `local/audit-history-probe-offer/results.json`, driven by `local/audit-history-probe.cjs`. Correction after independent post-round review: uncapped readable receipt cards remain available, so a public-contract violation is not established. Removing the cap is a robustness improvement, not a demonstrated total-history-loss repair. The earlier requisition-only probe is retained as history.
- Completed row 27 identifies mandatory department entry/readback in the storage gate and every scored gate. The public requisition contract does not require that separate field. Remove the hidden field requirement while preserving a fresh identifiable record, exact budget, and independent-context readback.
- Completed row 27 identifies an extra editable-date demand in rescission recovery. The public promise is a retained effective date and unchanged retry, which a read-only confirmation view can satisfy. Accept that conforming alternative without weakening the successful retry observation.
- Completed row 28 identifies bundled partial credit in coordinated preview persistence/neutrality, batch/member history artifacts, and later destination budgets/original-anchor vesting. Split the independently useful observations while retaining shared setup and combined weight.
- Completed row 26 identifies coverage gaps for coordinated final-budget overrun, Recruiter requisition intake, nonblank operation keys, the supplied employee roster, conditional imported DRAFT handling, coordinated numeric input classes, and coordinated relocation exclusion. Its separate G9 architecture concern is shared policy. Review the seven task-specific gaps against the public contract during reconciliation; add explicit owners or deliberately narrow nonessential public scope rather than leave hidden mandatory behavior ungraded. Existing scripted tests are not shipped rubric coverage.

## Separate outstanding concerns

Canonical shared restart and cleanup defects remain unchanged. Full configured grading, its duration, target-builder score, Oracle score, and measured reward discrimination/ranking remain unavailable. Local domain/browser/MCP/parser/archive evidence does not replace those measurements. No provider call or upload is authorized.

Completed row 46 adds a shared boundary concern: with `/assets` supplied as a symlink to `/tests`, canonical `test.sh` follows it during recursive permission broadening and the unprivileged app can read judge files. The ordinary-assets control denies those reads. The probe establishes behavior at verifier input; whether hosted artifact transfer permits that input is unmeasured. No real credential exposure or hosted exploit is claimed, and no shared harness change is authorized.

During the review, an unrelated engine input (`scripts/check_colderwater_current.py`) changed. Exact old/new hashes are recorded in `engine-drift.json`. HireOps task and frozen rules remain unchanged. Preserve this round's findings as historical evidence; refresh engine inputs for the repaired candidate. Do not revert unrelated work or claim clearance using stale bindings.

## Next steps

Finish all 53 independently assigned quality rows plus the separate all-48 deterministic review. Inspect and reconcile their union before changing the task. Add further confirmed findings here only after reading their completed reports. Then repair, validate, and prepare a new immutable single-per-row round. Preserve this candidate ZIP and all original reports as historical evidence.
