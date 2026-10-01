# HireOps fairness preflight

Reviewed 2026-09-30 by the independent `hireops_preflight_fairness` agent. This is a bounded source review and repair check, not the formal 53-quality/48-deterministic review, runtime evidence, or release clearance. No task files were edited and no prior review reports were read. Counterexample apps below were reasoned from the source, not executed.

Task root: `projects/hireops-recruiting-operations/hireops-recruiting-operations/`. Paths below are relative to that root.

The review used the public instructions/rules, all grading criteria/prompts, `WebDev Rubrics QC.xlsx`, the rubric QC skill and its references, and `qc/REVIEW_POLICY.md`. The authoritative workbook inventory was enumerated with the supplied list-checks script; this does not constitute a full row audit.

## Confirmed repairs

- **Same-target self-approval control:** `tests/scored/functional/judge.toml`, `hro_dual`, and prompt P5 now require a distinct authorized approver to approve the very target that refused its creator. A fresh equivalent target is permitted if seeded handling is separately broken. This excludes the original counterexample that rejects all seeded offers while allowing fresh self-approval.
- **Concurrent same-hire settlement:** `hro_stale` and P9 now explicitly exercise concurrent pairs against the same pending approval, committed revision, and current-leaf rescission target on ample budget. One transition must succeed and one be refused. This distinguishes same-hire exclusivity from P6's distinct-offer headroom race and closes the previously unexercised branch.
- **Offer identity versus creator permissions:** `hro_offer_identity` now accepts any successfully authorized creator; `hro_raise_roles` owns the full creator-role matrix. A Comp-only permission defect no longer necessarily erases demonstrated Recruiter identifier/field preservation.
- **Approval grant versus later history:** `hro_grant` now scores the recorded approval-time grant only and explicitly assigns later history to `hro_revision_equity`. Losing a superseded grant cannot independently invalidate an already demonstrated correct approval grant.
- **Monetary history ownership:** commitment, revision-signing, release and clawback rows now own new amounts, movements and resulting totals; old monetary-record preservation is explicitly assigned to `hro_history`. In particular, an old movement-link mutation can fail history without failing an otherwise correct release.
- **Theme switching versus contrast:** `tests/scored/polish/judge.toml`, `hro_pol_theme`, now owns the rendered switch and assigns palette readability to Visual. The original low-contrast-but-working-toggle example no longer fails both rows for that single defect.

## Follow-up repairs independently confirmed

1. **Direct rescission of an unusual offer ID:** The first repair carried unusual original A through revisions but rescinded generated C. That still admitted an app with only its rescission URL incorrectly escaping IDs. The final P1 and `hro_offer_identity` now require directly approving and directly rescinding the original unusual-ID offer through the UI, without revision; P4 separately covers unusual-ID approval/revision routing. Ordinary-ID controls preserve independent economic evidence. This resolves the specific routing counterexample under public rules section 5.

2. **Requisition identity versus Auditor permission:** The first repair left Auditor creation in both identity and role rows. The final `hro_req_identity` now permits any successfully authorized signed-in creator and expressly assigns every-role permission to `hro_raise_roles`. P1 prefers Auditor but explicitly allows another role while retaining the Auditor role failure separately. This resolves the Auditor-only authorization counterexample.

No remaining concrete counterexample was identified within these repaired sections. This confirmation is limited to the source findings above; it is not a claim that every task requirement or rubric row has passed.

## Reviewed source hashes

SHA256 at this repair recheck:

| File | SHA256 |
|---|---|
| `tests/scored/functional/prompt.md` | `A9D92EA28726FCCA22777E9AAF374112925D4F9BC5A4C7B5F4A949E7A17E4F82` |
| `tests/scored/functional/judge.toml` | `B40085CE54F7083AFAB88A9BBDF844C091A92A6FE58EFC6F26EFCE2A4EADFFD3` |
| `tests/scored/polish/judge.toml` | `89976FD8A0AE4E966D7947E4518FCEC57B43956687FEC3A6B44DCF70F9FEE1B2` |
| `tests/scored/visual/judge.toml` | `75405C0D1D2B270A8D08B5A1C65872A5BABBB9CF33ED571715FCC66F4665EC1E` |

Any source change requires rechecking the corresponding confirmation. No workload, Oracle, model-score or hosted-QC conclusion follows from this report.
