# Task: Threadline Team Chat

Build **Threadline**, a browser-based team messaging workspace. It should feel
like a focused workplace chat application rather than a CRUD dashboard. Users
communicate in channels, reply in threads, track unread conversations, mention
teammates, react to messages, and see activity from other open browser sessions.

## Data

Seed the application from the files provided under `/assets`. The seed data
contains users with different roles, a workspace, public and private channels,
memberships, messages, threaded replies, reactions, pins, and read positions.

Starting with an empty SQLite database must create the seeded workspace exactly
once. Restarting the application must preserve stored changes and must not
duplicate seeded records.

## Required stack

- One Node.js web application listening on `0.0.0.0:${PORT:-3000}`.
- SQLite as the system of record.
- No external database, hosted authentication provider, or hosted chat service.
- `package.json` must expose a working `npm start` command.
- Put `APP_MANIFEST.md` beside `package.json` with a fenced `bash start` block,
  the SQLite database path, and the main API routes.

## Users and sessions

Provide a normal sign-in flow for the seeded users. Each browser session must
belong to one signed-in user, and different browser windows must be able to use
different accounts at the same time.

The server must determine the acting user from the authenticated session.
Client-supplied user names, user ids, roles, membership claims, or ownership
fields must not override the signed-in identity.

Users may only open channels they are permitted to access. Private channels
must be visible only to their members. Moderator and administrator permissions
must be enforced by the server.

## Channels and messages

Show the workspace, available channels, unread indicators, channel members, and
the selected channel's message timeline.

Users must be able to:

- Move between channels.
- Send multi-line messages.
- See sending, delivered, and failed states.
- Retry a failed message without creating duplicates.
- Edit their own messages.
- Delete their own messages.
- Copy links to messages.
- Search messages and threaded replies.
- Load older messages without disturbing the current timeline position.

Messages must use server-assigned ids and timestamps. Their ordering must remain
stable when multiple users send messages close together or when a pending
message is replaced by its saved version.

Moderators may remove inappropriate messages. Ordinary members must not be able
to edit or delete another person's messages by changing a request or replaying
another user's action.

## Threads

Any message may start a thread. Users can open the thread, add replies, edit or
delete their own replies, and return to the channel without losing their place.

A parent message should show its current reply count, participating users, and
latest reply information. These details must stay accurate when replies are
added, edited, deleted, or received from another open browser.

Thread replies must belong to the correct parent and channel. Requests that
attempt to attach a reply to an unrelated or inaccessible message must be
rejected.

## Unread messages and mentions

Track read position separately for every user and channel. Opening one channel
must not mark unrelated channels as read. A user's own messages must not create
unread counts for that user.

Support `@mentions` for workspace members. Mentioned users should receive a
visible notification that links to the correct message or threaded reply.
Editing or deleting a message must update any mention state produced by that
message.

Read positions, unread counts, and mention notifications must remain correct
after reload and across multiple browser sessions.

## Reactions and pins

Users can add or remove emoji reactions on messages and replies. Each user may
contribute at most one count to a particular reaction. Repeating or retrying the
same request must not inflate the count.

Authorized users can pin and unpin messages in a channel. The pinned-message
view must stay synchronized with the underlying message. Editing, deleting, or
losing access to a pinned message must not leave misleading or inaccessible
content behind.

## Live collaboration

Changes should appear in other open browser sessions without requiring a page
reload. This includes new messages, edits, deletions, replies, reactions, pins,
unread state, and mention notifications.

Show who is currently viewing a channel and when another user is typing.
Presence must represent individual open sessions accurately. Closing a view,
switching users, changing channels, or losing a connection must eventually
remove stale presence and typing indicators.

Reconnects and repeated delivery must not duplicate messages, reactions,
notifications, or other stored effects.

## Message history and moderation

Keep an append-only history for message creation, edits, and deletions. The
history should record the message, action, acting user, previous content where
applicable, and server timestamp.

Users should be able to inspect the edit history of messages they are permitted
to see. Deleting a message should not erase its moderation history.

Permission changes and moderation actions must take effect immediately.
Previously captured requests must not allow a user to continue performing an
action after access has been removed.

## Incoming webhooks

Provide incoming webhooks that allow an authorized integration to post into a
specific channel.

Webhook credentials must be treated as secrets and verified by the server.
Unknown, disabled, malformed, or channel-mismatched webhook requests must be
rejected. A webhook request may include a retry or idempotency key; delivering
the same event more than once must create only one message.

Webhook messages should be visibly identified as integration messages and must
remain subject to channel access, history, and persistence rules.

## Conflict and request safety

The server is the authority for identity, channel membership, roles, message
ownership, timestamps, and stored state.

Reject requests that contain missing, malformed, stale, or inconsistent data
without partially changing the workspace. Rejected and replayed requests must
not create messages, replies, reactions, pins, notifications, audit entries, or
other duplicate effects.

Concurrent actions should produce a consistent result. When two valid actions
cannot both be applied, reject the losing action clearly instead of silently
overwriting newer state.

## Persistence

Store users, sessions, channels, memberships, messages, replies, reactions,
pins, read positions, notifications, webhook deliveries, and audit history in
SQLite.

Reloading the page or restarting the server must preserve committed state.
Browser storage may be used for temporary interface preferences, but it must not
be the system of record.

## Interface expectations

The first screen should be the usable application. Include:

- A sign-in view for seeded users.
- Workspace and channel navigation.
- A channel message timeline and composer.
- A thread panel.
- Unread and mention indicators.
- Reaction, edit, delete, pin, and message-history controls.
- Presence and typing feedback.
- Search and pinned-message views.
- Visible feedback for pending, failed, rejected, and conflicting actions.

Use discoverable labels and familiar chat interactions. Nothing should require
a hidden route, magic element id, or external instructions to operate. The
product is judged primarily by behavior, but it should remain usable on normal
desktop and mobile browser sizes.
