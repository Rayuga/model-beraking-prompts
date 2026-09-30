# First independent review round: disposition

This round reviewed input `932213a98ddd51f254e6ea45b1624933b4817721900d8f162d8694e75293b6f2`. Three complete reports remain intact. It is now historical: source changes were frozen in round2. Do not reuse its workbook as current clearance.

| Finding | Disposition |
|---|---|
| Console history promised retention until Clear, but golden caps oldest entries | Confirmed wording mismatch. Public request now explicitly permits a sensible old-entry cap while retaining recent entries across runs. |
| Pending-timer cancellation lacked an explicit matching successful control | Confirmed. S04 now observes the uncancelled four-second A callback, records its count, and compares against that baseline in the cancellation trial. Both cancellation descriptors require the observed control. |
| Unsupported filename Save refusal ungraded | Reviewer2 retracted the confirmed-failure interpretation after checking the public request: supporting extensions did not explicitly require refusal of all other extensions. Clarified filename-driven dispatch; did not add an unrequested refusal criterion. |
| Required technologies/source/lockfile are not proved by browser grading | Removed unnecessary task-added frontend mandates and source/lockfile obligations. Shared Node/Express/SQLite policy remains template-mandated; browser behavior alone cannot prove exact implementation technology. Round2 must retain that distinction. |
| Full judge timing, verifier invocation and empirical score behavior absent | Unresolved evidence gaps. Local golden behavior does not establish full configured judge timing or Oracle/model scores. |
| Full sibling corpus unavailable | Review known local references and record the unavailable global comparison; do not claim universal originality. |

The first-round pipeline was also reviewed adversarially. It now prevents issue-key overwrite, rejects weak/self-confirmed waivers, requires separate runtime evidence, invalidates a previous green summary after an exception, and binds future runs to checker/policy hashes. This bootstrap round did not bind those implementation hashes, so it cannot clear release under the completed mechanism.
