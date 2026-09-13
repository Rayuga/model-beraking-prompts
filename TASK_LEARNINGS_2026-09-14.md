# Task Learnings: 14 September 2026

## Successful Sign-in Is Only Half Of An Authentication Gate

Common Ground Ballot passed45/45 static checks but the user reported52/53 rubric
checks. Every shared gate required a good login, populated protected backend
data and refresh. Only a separate Functional criterion tested a wrong password.

That leaves other dimensions able to pay for an app that accepts any password
or serves private data without login. For an authenticated product, every
dimension's explicit shared prerequisite needs both directions: correct access
works, while signed-out and bad-password access are refused without data leaks.

Use the real protected read captured from a successful UI interaction. Probe it
from a fresh anonymous context, then submit the exact documented user's wrong
password and repeat the read. Do not copy a good token into the anonymous probe,
or clear a session after bad login to manufacture rejection. Public demo names
and sign-in hints are not protected application records.

Do not reset domain state, end all sessions, or demand original seed counts in
later dimensions. A separate context can validate the boundary without changing
the work already graded. Keep external fonts/assets outside the global veto.

## Check Inside The Gate, Not Anywhere In The Prompt

Our general checker found a gate and the right configuration; it did not prove
the gate contained negative authentication checks. A wrong-password paragraph
elsewhere in Functional cannot satisfy a shared prerequisite for all dimensions.

The new focused check extracts each shared block, verifies the required
observations there, compares all five blocks and rejects the previous version.
It remains a wording regression, not a claim that the platform's semantic judge
will agree with every detail.

## Test The False-Pass Witnesses

On the unchanged golden solution, the revised gate passes all five dimensions
after the full stateful workflow and two process restarts. Three intentionally
broken variants each fail across all five dimensions: password checks disabled,
anonymous protected reads allowed, and private records returned with401 errors.
Response status alone is not proof that sensitive data stayed private.

Current fix and evidence:
reports/common-ground-ballot/2026-09-14-auth-gate-r10/

No new Oracle, model score or platform53/53 pass was claimed. The earlier scores
and immutable packages remain historical evidence.

