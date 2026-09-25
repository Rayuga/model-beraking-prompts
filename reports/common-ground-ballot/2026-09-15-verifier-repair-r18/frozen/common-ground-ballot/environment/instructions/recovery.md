# Picking up interrupted staff work

Our coordinators sometimes lose the connection just after pressing Save. They
cannot tell whether the server accepted the change, and they often reload or
sign out before coming back. Give them a Pending actions area inside the
workspace so they can resolve that uncertainty without repeating the change.

Keep each staff attempt before sending it: creating and editing a draft,
opening, closing, publishing, and changing membership all need this support.
If no usable confirmation arrives, say that the outcome is unknown and retain
the attempt through page reload and a later sign-in in the same browser profile.
Identify its action and affected record clearly. Do not automatically resend it
on startup, refresh or sign-in. An unreadable response or server failure does not
prove the write was refused. A confirmed write followed by a failed refresh is
still a confirmed write; explain the refresh problem separately.

Provide an explicit Retry for each pending attempt. Retry must use that exact
attempt's original target, action, inputs, operation identifier and viewed
revision. Even if another tab has edited the record or advanced the ballot,
Retry is asking what happened to the original attempt, not requesting a new
change. Resolve the pending entry when a usable success or definite business
refusal arrives, show the outcome, and refresh the current records. Do not copy
an old receipt's state over newer data. After a refusal, trying a changed action
is a separate user decision using current information and a new identifier.

Several actions can be uncertain at once. Keep them separately recognizable and
let people continue independent work. Retrying or dismissing one must leave the
others intact; it must not send the entire queue. Dismiss removes the reminder,
not a change that may already have happened, and the UI should explain that.

Pending work belongs to the person who initiated it. Signing out hides its
details. Another account on the same browser must neither see those details nor
send the original person's requests. Returning as the original person restores
their unresolved work. If a session expires or is revoked, keep the uncertainty
for that person to resolve after signing in again; do not silently replay it as
whoever signs in next. This recovery area is for staff writes, not Members'
private selections.

We also keep two tabs open for the same account in the same browser profile.
They share the pending work. Once one tab resolves or dismisses an entry, the
other must reflect that on its next interaction or reload. A stale tab or late
response must not bring a removed entry back or overwrite another pending
attempt. Disable an action while its request is in flight so a double click
does not create two new attempts. No particular storage library or layout is
required; accepted business records and receipts still belong in SQLite.
