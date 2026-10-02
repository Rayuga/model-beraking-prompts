# Live-desk round 2 reconciliation

**BLOCKED.** Single-per-row round on input `52feadde…`. All 54 reports valid: 36 Pass, 8 Note, 6 Fail, 3 Not exercised; deterministic 47 Pass, 1 Note, 0 Fail. Round 1's six Fails did not recur except row 44 at lower severity. Original reports unchanged.

## Fails (accepted; fixed in the working tree AFTER this round, not re-reviewed)

- Row 26: no criterion tried a PENDING or RESCINDED source in a coordinated change. Added to `hro_change_shape` and B2.
- Row 27: `hro_pol_session_resume` required Finance's entries to survive another person's sign-in. Reordered: Finance resumes first, the other person is checked afterwards.
- Row 31: `hro_whatif_roles` sampled two of six non-Finance roles. All six are now checked; the full figure comparison stays with Auditor and Recruiter.
- Rows 32 and 34 (same point): the live-update row measured only `window.scrollY`. It now measures whatever scrolls and the field's position, and grades value and focus alone when nothing can scroll.
- Row 44 (P2): retained-input rows outweighed budget and anonymous-write rows. Retention rows lowered to 0.5, remove-member to 1; budget, anonymous-write and restart rows raised; the three 0.01 rows raised to 0.05. Functional total 66.3.

## Notes acted on

Rows 3 and 6 (approval at exact headroom fits; overflow scope says computed figures including intrinsic value; a committed operation keeps a retry control), row 30 (two rows now name a successful control).

## Still open

- Rows 11, 40 and 42 are Not exercised: no configured judge run, judge-duration measurement or reward-discrimination run exists.
- Row 20: the candidate is not committed.
- The post-round fixes above have had no independent review.
