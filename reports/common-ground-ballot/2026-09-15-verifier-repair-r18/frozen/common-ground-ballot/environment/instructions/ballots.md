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

Each eligible Member has one final submission per ballot. A choice from a
different ballot is never valid.

People sometimes retry an action after losing its response. Give each create,
edit, membership change, lifecycle action and vote an operation identifier tied
to the signed-in person. Retrying the same operation should return its original
response status and body, without repeating the change or its audit
event. Reusing that identifier for different input must be refused. Keep these
outcomes through restart, even if the ballot or roster has changed since then;
replaying an old Open must not reopen a closed ballot or recapture its members.

Approval choices form an unordered set. Retrying the same operation with the
same distinct choices in another order is the same submission and must return
the original receipt, including after publication and restart. Changing a
choice is different input and must be refused. Repeated copies of a choice
are invalid input, not another spelling of the set.

Each person's operation identifiers share one namespace across all actions.
An identifier used to create a ballot cannot later edit a ballot or change
membership for that same person. Refuse that collision without changing either
record or replacing the original receipt. Different people have independent
namespaces; an identifier used by one person does not reserve it for everyone.

A viewed revision or approval maximum represents a single positive whole
number. Lists, objects, booleans, null and omitted required values are not
versions or limits; do not coerce them into valid numbers. Text encoding in an
ordinary HTML form is fine, but structured or boolean values in a request must
not become a version or limit just because a numeric conversion accepts them.

For a well-formed operation from someone allowed to perform it, remember a
refusal caused by a stale revision or the wrong ballot state too. A premature
Publish must still return its original refusal when retried after Close. To
try again with current information, the person submits a new operation. This
does not require keeping malformed requests, bad sign-ins or unauthorized
requests as receipts. Refusals and retries never add audit events.

The order is Draft, Open, Closed, Published. Voting happens only while Open;
results stay hidden through Closed and appear only at Published. Published is
terminal. Actions should be based on the revision the person is viewing so an
out-of-date write is refused without changing anything.

Published single-choice results show each choice count and total ballots. If
top choices are level, call it a tie and name all leaders. Approval results
show approvals per choice and participating ballots; percentages use the
number of participating Members, so they may add up to more than 100%.
