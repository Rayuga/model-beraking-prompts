# Ballots and decisions

A draft has a title, optional context, a voting method, and at least two
different non-empty choices. Ruth can edit a draft. Once it opens, its wording,
method, and choices are fixed.

Support two voting methods:

- Single choice accepts exactly one choice.
- Approval accepts one or more different choices, up to the ballot's stated
  limit. The limit must be between one and the number of choices.

Opening a ballot captures the active Members at that moment. Later roster
changes affect future ballots, not that snapshot. This is why Owen remains
eligible for the seeded open ballot even though he is currently inactive.

Each eligible Member has one final submission per ballot. Retries of the same
operation must return the original outcome without recording another ballot;
reusing that operation for different input must be refused. A choice from a
different ballot is never valid.

The order is Draft, Open, Closed, Published. Voting happens only while Open;
results stay hidden through Closed and appear only at Published. Published is
terminal. Actions should be based on the revision the person is viewing so an
out-of-date write is refused without changing anything.

Published single-choice results show each choice count and total ballots. If
top choices are level, call it a tie and name all leaders. Approval results
show approvals per choice and participating ballots; percentages use the
number of participating Members, so they may add up to more than 100%.
