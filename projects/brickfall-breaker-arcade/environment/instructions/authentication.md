# Authentication and player isolation

Seed `mira@brickfall.test`, `dev@brickfall.test`, and
`polly@brickfall.test`; every demo password is `password123`. Show the signed-in
name, email and three-letter initials. Hash passwords with a per-user salt.

Successful sign-in returns an unpredictable 64-character lowercase hexadecimal
bearer token. Store active tokens
in SQLite, authenticate protected requests from the token, and revoke the
account's active tokens on sign-out. Do not trust an email, user id or initials supplied
by the browser when deciding whose progress, save or score to read or write.
After a protected request returns 401, discard that tab's token and show sign-in.

Each profile owns its highest unlocked level, best score and one
resumable run. These values must never cross accounts. The top-ten leaderboard
is shared and names the owning profile's stored initials. There is no client-
only authentication or registration flow.
