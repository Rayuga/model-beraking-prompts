# Ground-station console rules — authorization and scope

## Authorization

A burn above the high-energy line sits pending until a flight director
authorizes it; an operator cannot. At or below the line, the submitter's own
signature is enough and nothing further is needed.

Whoever authorizes a burn must be a different person from whoever submitted
it — even someone who holds the flight director role themselves is refused
if they try to authorize their own submission.

Someone who comes off flight-director duty keeps nothing: a control may still
show on their screen, but the account is what decides, checked again at the
moment they act, not at whatever it said when they last signed in.

## Scope and authority

An analyst sees telemetry and command history only for the spacecraft they
are assigned to, and no others — the list and the search box both, not just
the list. Everyone else sees the whole constellation.

A caller who has not signed in reaches none of it, whatever a page still
shows before a request comes back. Withholding a control in the interface is
not by itself proof of the underlying rule — the same request, sent again by
hand instead of through the button, is expected to be refused exactly the
same way.

What an account may do, and which spacecraft it may see, comes from the
stored account, re-read at the moment it acts, and never from anything the
request claims about itself.
