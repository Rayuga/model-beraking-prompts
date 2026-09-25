# Accounts and authentication

The seed workbook contains the two demo accounts. Show only the sign-in
experience before authentication; do not expose the board, totals, or account
state. Reject an incorrect password with understandable visible feedback.

After valid sign-in, visibly identify the account by name and email. The server
must issue an unpredictable bearer token, persist the active token in SQLite,
and require it for game reads and writes. Signing out revokes that token and
every other active token for the same account, then returns the browser to
sign-in. On its next protected request, any other signed-in tab must also return
to sign-in without changing game state.

Account identity comes from the authenticated server session, never from a
user ID supplied by the browser. Each account has its own current board and
match totals and must never receive the other account's state.
