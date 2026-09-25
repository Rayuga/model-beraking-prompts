# Pellmoor task outline

Build a local authenticated hiring workspace with the exact four seeded vacancies,
nine candidates and four accounts. Use the provided hiring, security, reliability
and interface instructions. Hiring rules take precedence. The new task remains
version 1.0.0 and retains the existing stack and operational configuration.

## Core workflow

Cal creates applications and arranges eligible panels. Ruth moves applicants
through applied, screening, interview, offer and hired; one-stage backsteps are
allowed and rejected/withdrawn records remain terminal. Assigned panel members
score their current assessments, and everyone can append attributed notes.
Panel changes and interview reentry invalidate old scores without deleting their
history. Capacity is derived from offered and hired applicants. The d3 funnel
is derived from actual stage-visit history, including backsteps and terminal loss.

## Batch offer workflow

Ruth selects applicants from one vacancy and previews eligibility, current
assessment versions and the whole selection's capacity impact. This is read-only.
Confirmation submits the reviewed revision and ordered selection as one operation.
Every applicant must be eligible and the complete selection must fit. One invalid
member rejects the entire batch. One accepted batch advances the vacancy revision
once, with one linked stage event per applicant and no aggregate extra event.

Batch and individual operations share the revision/capacity boundary. Stale
confirmation is refused, selection retained and explicit review required before
a new attempt. A lost response exposes an explicit retry of the exact original
operation. Durable success and business-rejection receipts remain historical
across capacity release, later actions, sessions and restart. Receipt replay
must not replace the UI's current server state with an old snapshot.

## Interface and delivery

Provide usable selection, review, blocked, pending, uncertain and completion
states; readable current/projected reserved, filled and available counts; named
controls; keyboard focus containment and dismissal; and coherent light/dark,
desktop and mobile layouts. Preserve the original candidate drawer, history,
notes, scores, activity and empty states.

The task ZIP contains only the task sources and five verifiers. Authoring
reports, screenshots, coverage maps and local diagnostic scripts stay outside
the ZIP. `solution/APP_MANIFEST.md` documents the golden runtime and routes;
models may implement different routes that satisfy the same visible contract.
