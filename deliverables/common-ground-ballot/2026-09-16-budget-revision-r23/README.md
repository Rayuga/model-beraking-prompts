# Common Ground Ballot r23

[Upload common-ground-ballot.zip](common-ground-ballot.zip).

Addresses both latest QC findings:

- Render now allows 30 minutes and Constraints 20 minutes. Functional retains
  two hours; the combined budget and standard outer timeout stay unchanged.
- A separate Functional check verifies that accepted single-choice and approval
  votes leave the ballot revision unchanged, using existing workflow evidence.

The unchanged golden app passed the new browser check. Three deliberately faulty
versions failed it, including one faulty only for approval voting. Runner and
294 archive checks passed. There are still five verifier passes, with 71 criteria.

Fresh platform QC and full Oracle/model runs remain pending. Local checks do not
establish an autonomous Oracle score or measured completion time.

[Full report and evidence](../../../reports/common-ground-ballot/2026-09-16-budget-revision-r23/README.md).

SHA-256: `e0a9d37a0ec9188749abdc46808c19c97a4124e1939b2c96e2c5d8de29145798`.
