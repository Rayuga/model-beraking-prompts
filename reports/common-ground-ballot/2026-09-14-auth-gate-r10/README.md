# Common Ground Ballot: Shared Authentication Gate Fix

## Why The Platform Rejected The Previous Upload

The screenshot reports 45/45 static checks and 52/53 rubric checks.
The failing point is global_browser_gate_is_present_and_correct_in_every_dimension.

The old shared gate proved that a documented person could sign in, read backend
data and refresh. It did not require a signed-out protected-read denial or an
incorrect-password rejection. A separate Functional criterion had a wrong-password
test, but that did not protect Render, Constraints, Polish and Visual from giving
credit to an app with a broken authentication boundary.

Our earlier local reference checker tested configuration and gate presence, not
these missing gate semantics. Its 115-check pass did not establish platform
rubric acceptance. This was a real verifier omission, not an app startup failure.

## Fix

All five shared gate blocks are identical and now require:

1. A usable public sign-in surface with no private ballot records.
2. Ruth's exact CommonGround!wrong password to be visibly refused.
3. Correct sign-in as Ruth with CommonGround!2026, on-screen identity/role,
   a populated protected backend response, and successful refresh.
4. The actual protected read to be denied from a separate fresh signed-out
   browser context, both before and after its own wrong-password attempt.
5. No private records in a denial response, no credential clearing to fake
   rejection, and no changes to domain records or other sessions.

A failure of this shared prerequisite zeros every criterion in that dimension.
It adds no reward weight. External runtime assets still are not a universal veto.
Public demo sign-in hints remain allowed.

Only the five prompt.md files changed from r9. Criteria, weights, product brief,
golden source, seed, runtime configuration and both Dockerfiles are unchanged.
Prompt revisions are Render r3, Constraints r3, Functional r10, Polish r5,
Visual r3. Task version stays1.0.0; agent and verifier networking stay public.

## Validation

- 115 canonical configuration checks passed.
- 55 focused gate-wording checks passed; all five previous gate blocks fail
  the targeted negative regression.
- 32 golden browser groups passed, including two actual process restarts and
  all five corrected gates after the earlier workflows left 11 current ballots.
- 15 runner unit cases and five runtime groups passed.
- Six original deliberately broken behavior variants were detected again.
- Three new authentication variants failed the intended check in every dimension:
  accepting any password, publicly exposing protected records, and returning
  private records inside a401 denial response.
- Exact updated verifier image built; unchanged agent image instructions, seed
  and dependencies verified. Final prompt hashes match the tested verifier image.

The local browser scripts use golden-specific selectors, outside the uploaded
task. Delivered judges still discover each submission's actual controls and
request/authentication transport. These local tests are not LLM verdicts.

## Upload And Limits

Upload the common-ground-ballot.zip beside this file. It contains one
common-ground-ballot/ wrapper and36 task files. All reports, maps and local
diagnostics remain outside that wrapper. The previous r9 archive is preserved.

This package addresses the reported omission. A new platform rubric pass and
a new Oracle score have not been run or claimed. No provider calls or paid model
builds were started, and historical scores were not changed.
