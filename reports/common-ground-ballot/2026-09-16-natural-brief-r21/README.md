# Common Ground Ballot r21: natural product brief

The latest screenshot reports **45/45 static checks passed** and **51/53
rubric checks passed**. The two remaining findings are
`instruction_is_a_natural_product_request` and
`instruction_preserves_natural_human_voice`. Model and Oracle stages were skipped.

This repair changes only `instruction.md`. It now reads as an association member's
request: the people and practical needs come first, with open tabs, privacy and
lost responses explaining the detailed behavior. The formal specification
headings, demo-account table, opening build recipe and runtime checklist are gone.
Hosting details remain near the end as setup context. Technical requirements
remain explicit where ambiguity previously caused QC failures.

The coverage review checks the original product requirements, including revision
1/+1 rules, all roles/workspaces, snapshots, both ballot methods and result math,
typed input boundaries, anonymous selections, session integrity/revocation,
operation receipt status/body and namespaces, rejected-operation persistence,
pending actions before send, account/tab isolation, retry/dismissal behavior,
accessibility and the complete runtime contract. The wording clarifies the
Approval selection limit, associated labels and required stack. SEED_PATH is
explicitly a startup override; the delivered app still includes its seed.
Post-submit confirmation privacy does not prohibit pre-submit selection review.

The independent editorial reviews are recorded in `coverage-review.md` and
`voice-review.md`. These are local reviews, not platform QC verdicts.

| Validation | Result |
| --- | --- |
| Exact comparison with delivered r20 ZIP | Only instruction.md changed; all other 28 files byte-identical |
| Source contract/layout checks | 259 passed |
| Actual ZIP contract/layout checks | 294 passed |
| Runtime/Oracle/model rerun | Not run for this prose-only change |

The golden solution, all five verifiers and their 69 criteria, score weights,
timeouts, model configuration, task version1.0.0, starter, seed and Dockerfiles
are unchanged. Verifier prompt versions remain r20 because those files have not
changed. The prior r20 local tests exercised the real golden app and exact runner
twice; they are historical evidence, not newly executed r21 tests.

A fresh platform QC run is needed to confirm that both voice findings clear.
No new Oracle/model score or guaranteed 53/53 result is claimed. The earlier
clean Docker build limitation remains: local testing used cached dependencies
after the corporate proxy prevented package downloads.

ZIP: `deliverables/common-ground-ballot/2026-09-16-natural-brief-r21/common-ground-ballot.zip`.
Files: 29. SHA-256: `ade223827808dd8f1f31d395377df52616e1eadd1ed3f8cd1b5c145fa5009308`.
Instruction SHA-256: `c48fc3206f078a395ee728e2bdceda6711fff01f1115e8da4ab68b3820f4b04d`.
All historical ZIP bytes are preserved.
