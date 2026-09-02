# Security and access

## Authentication boundary

Nothing from the marketplace may be visible until somebody has signed in. A
wrong password has to leave the browser signed out rather than part of the way
in, and the right one has to land the person on populated screens rather than
empty shells.

## Who may change what

Three people sign in, all with the password `password123`, and they do not have
the same authority:

| Account | Role | May change |
|---|---|---|
| `admin@bazaarbridge.test` | Administrator | orders, inventory, and payouts |
| `operator@bazaarbridge.test` | Operations lead | orders and inventory only |
| `finance@bazaarbridge.test` | Finance manager | payouts only |

Everyone signed in can read every workspace, including the settlement figures.
It is the writes that are restricted. The Operations lead must not be able to
move a payout's status, and the Finance manager must not be able to move an
order's status or change stock. When somebody attempts a change outside their
authority they must be told they are not authorised, and the stored record must
be unchanged afterwards.

## Server-side enforcement

Hiding a control is not enough. Stock validation, terminal Returned status, and
role authority must all be enforced by the server, because a hidden button
still leaves the underlying write reachable. A refused write must leave the
stored value unchanged after reload.

## Sessions

Sign-out must end the session. After sign-out, protected workspaces must not
remain usable without signing in again. Durable changes made while signed in
must still be present after a fresh sign-in.
