# Accounts and authentication

Import all four seed users on first database creation. Every account uses the
password `Coursemark!2026`. Before sign-in, show no course, assessment, attempt,
grade, answer, or audit record. Reject an incorrect password visibly.

After sign-in, show the user's name, email, and role. The server issues an
unpredictable bearer token, stores each active token in SQLite, and requires it
for every protected read and write. Identity and authority come only from that
token, never from a browser-supplied user or role.

Signing out revokes every active token for the account. Another tab with an old
token must return to sign-in on its next protected action without changing any
record. Instructor, teaching-assistant, and student data must remain isolated
according to their role and enrollment.
