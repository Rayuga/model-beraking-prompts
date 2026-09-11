# Sharing, and getting work out

Sharing is how a review reaches someone who was not in the room. There is a Share
in the header — it needs to be findable in both themes — and it opens a small
dialog with two ways out: a link you can copy, and sending that link to an email
address.

Anyone with the link can read the board. They cannot change it. Not "the buttons
are hidden" — cannot.

When you send it to an address, keep a record of what happened: which way it went
out, whether it went, the link, and a picture of the board as it looked. If the
address is not a real address, say so rather than recording a send that never
happened. Mail settings may arrive in the environment the app is started with, under
`SMTP_SERVICE`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM`. Do not count on them
being there - when they are missing, fall back and record what actually
happened. Mail often will not get
out of this container at all — record what happened honestly and name the way it
actually went rather than claiming a success that did not happen.

Also: download the board as a picture, export it as a file, and upload images
onto it.

# Retrying without doubling up

Our network is not kind, so the same action sometimes arrives twice. The second
one must not do the work again — no duplicated shape, no second copy of anything,
and the board's revision number stays where it was. Retrying is safe; doubling up
is not.

# Admin endpoints our deployment scripts use

We run these against every environment we deploy to, so they have fixed names.

`GET /api/admin/snapshot`, no sign-in, returning a plain summary of the
current state: the accounts, boards, objects, connectors, groups, components and
sends it is holding, plus counts.

Changes go through `POST /api/ops` as `{boardId, type, payload, opId}`, and the
account routes are `POST /api/auth/register` and `POST /api/auth/signin`, both
returning `access_token`. Registering an address that already has an account is
a conflict. These are the shapes our scripts already speak.
