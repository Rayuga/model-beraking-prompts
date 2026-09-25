# Common Ground Ballot r16 — coverage QC repair

Upload this release's `common-ground-ballot.zip` as a new platform version.
The task version inside the ZIP remains `1.0.0`. It contains 37 files under one
`common-ground-ballot/` wrapper. Reports beside the ZIP are not upload contents.

SHA256: `d198f48916835f68953ad26ea253482f12a0a8587bd2e00b395dce9d473bef1e`

The user's latest screenshot is platform v9: Static 45/45 and Rubric Source
52/53, failing `dimensions_cover_every_graded_requirement`. It identifies
three real omissions in the preceding rubric. This release addresses those
omissions; it is a new candidate, not another copy of r15.

| QC finding | Repair |
| --- | --- |
| Status could be conveyed by color alone without losing points | New `status_text_without_color` binary Polish criterion checks visible per-record lifecycle, membership and participation text across themes and viewport sizes. Contrast remains a separate Visual concern. |
| Arun could be denied Members and Audit while earning full marks | Independent Functional criteria for Observer Members and Audit access, with actual visible records, protected reads, Ruth's positive reference and reload. A full role-coverage review also added separate Observer ballot-setup and published-result access checks. Existing Observer turnout and write-refusal checks remain. |
| Invalid lifecycle actions could look available with no explanation | New `unavailable_action_guidance` Polish criterion checks every lifecycle state before invalid actions, plus read-only and completed-submission guidance. A backend refusal or unrelated feedback message cannot satisfy it. |

The golden UI now explains why closing/publishing are unavailable on Draft,
why definitions are locked on Open, why Closed cannot reopen, and why Published
permits no further edits or transitions. Guidance wraps at mobile width. Its
existing text statuses and Observer read permissions already pass. The golden
server, product brief, seed, runner, reward policy and dimension weights were
not changed for this repair.

There are **62 criteria**: Render 1, Constraints 2, Functional 43, Polish 10,
Visual 6. Each new Observer read criterion has weight 0.5; each new Polish
criterion has weight 1. Existing criterion weights are unchanged. Functional
criterion weight now totals 36 and Polish totals 14; the dimension allocation
remains **60% Functional, 20% Polish, 20% Visual**, after mandatory gates. New
checks therefore have a measurable effect on the result.

## Validation

The frozen ZIP passes **154 standard checks and 419 archive checks**.
`package-audit.json` records the completed runtime groups and their counts.
The checks include the full golden browser workflow with two real process
restarts, current prompt/scorer provenance, all-criterion score effects and
the six new browser checks. An actual pinned Playwright MCP cross-check includes
all six added checks as well as the existing session/privacy/receipt journey.

Six deliberately defective application variants exercise the added criteria:
hidden Observer ballot setup, hidden Observer results, denied Observer Members,
denied Observer Audit, color-only status and an unexplained Publish-on-Draft
control. Each variant must fail only its corresponding criterion among the six
new browser checks. These are local behavioral tests, not paid judge verdicts.
Six malformed ZIP variants that remove the new coverage are rejected by the
updated archive checker. Both older release profiles remain checkable.

`coverage.json` maps all 62 criteria to the brief. `qc-repair.json` links the
three screenshot findings to their specific changes and validation evidence.
`changes.diff` contains exactly six changed task files compared with r15.
Full scripts, logs, mutation results and screenshots are in the matching
`reports/common-ground-ballot/2026-09-15-coverage-r16/` directory.

## Next platform run

1. Create a new version using this exact ZIP and run QC. Preserve the report.
2. Once QC passes, run Oracle/NOP. Require Oracle above 0.95 overall with all
   **43 Functional criteria passing**; inspect the ten Polish verdicts too.
   NOP should be zero. Investigate infrastructure errors separately.
3. Run GPT on the same checksum. Review the overall saved 0.1–0.7 acceptance
   band and the Functional score independently; a Functional score above 0.7
   still warrants a difficulty review. The internal overall target remains
   at or below 0.5. No r15 or earlier score proves this candidate's range.
4. Preserve the same files for final Oracle confirmation and any other model
   runs required by the submission tracker. Any further task change needs a
   new archive and fresh runs; retain full exports and matching provenance.

No fresh platform QC, scored Oracle or GPT run has been completed for r16.
Local tests use current frozen files with the available pinned dependencies
and a rebuilt local verifier overlay. Clean Docker builds remain unverified
because this machine's proxy/certificate configuration blocked the prior exact
build attempts. Harbor remains unauthenticated and the configured direct judge
credential is unavailable here. Local success is not a platform pass guarantee.
