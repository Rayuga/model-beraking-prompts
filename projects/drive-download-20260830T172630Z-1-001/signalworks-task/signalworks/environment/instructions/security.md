# Trust and isolation

## Identity

Sign-in is by email and password; every seeded account uses `password123`.
Identity comes from the **session** the server issued. Every protected read and
every write resolves the caller from that session and from nothing else.

## Roles see their own work

Each role reaches its own areas and not other people's:

- **Signaller** — the control-room board, incidents, assets, jobs, and taking
  the handback.
- **Response team lead** — jobs their team can claim or holds, technicians,
  handback stages, callouts against their own people.
- **Maintenance planner** — assets, the inspection and renewal lists, recording
  the result of an inspection, callouts.
- **Signalling engineer** — possession plans and approvals, the **configuration
  and live state of an asset**, and putting an asset back into service. Changing
  what an asset *is* belongs to the engineering office; recording what an
  inspection *found* belongs to the planner. The two offices spent a year each
  assuming the other had done it.
- **Safety officer** — line blockages, possession plans, the audit trail.
- **Administrator** — users, the settlement period, corrections and offsets,
  the audit trail.

The user list, the audit trail and the settlement period controls are **not**
general reading. A team lead has no business in the user list, and a response
that hands it over anyway is a leak whether or not a screen displays it.

## What the client sends is data, never authority

This is the one the route keeps relearning. Anything arriving in a request body
is a **claim**, not a permission. A caller who adds `role: "admin"`, an
`approved: true`, a competence they do not hold, an expiry date of their own
choosing, a blockage of `false`, a penalty total they would prefer, or somebody
else's user id gets exactly the same answer as a caller who did not.

Every figure that matters is recomputed from stored records at the moment of the
decision. A competence check reads the technician's own record and the asset's
own kind. A settlement is worked out from the stored delay minutes, the stored
bands and the stored window — never from a total in the request. A possession
approval reads who the stored planner is, not who the request says it is.

## Signed out means signed out

An unauthenticated caller reads and writes nothing operational. Sending the
browser to a sign-in screen while the request behind it still returns rows is
not isolation — the request itself has to be refused.

## Suspension and self-administration

An administrator can change another user's role and suspend or reinstate them.
An administrator can do **neither to themselves**. A session belonging to a user
who has since been suspended, or whose role has since been changed, is resolved
against what is stored now, not against what was true when they signed in.

## History

The audit trail is append-only: readable, never editable, never deleted.
Corrections and offsets are all **additions** — the original row stays exactly
as it was.
