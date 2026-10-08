## Application

Name: Kittle & Rowe matter chat
URL: http://localhost:3000

## Accounts

Every password is `password123`.

| Email | Role |
|---|---|
| `harriet@kittle.test` | Harriet Rowe, Partner (timers and holds) |
| `dev@kittle.test` | Dev Anand, Associate (walled from M-12) |
| `sian@kittle.test` | Sian Lloyd, Associate |
| `gwen@kittle.test` | Gwen Pryce, Client (M-11, M-13) |
| `paul@kittle.test` | Paul Marsh, Client (M-12) |

## Key screens

Sign-in; the matter list with unread counts; a matter thread with nested replies, each message's reply, edit, delete, copy-link and (for partners) hold controls, and timer and wall controls for partners; a mentions list; search; the transcript page for a matter.

## Notes for checking

- Two people, or one person in two tabs, are separate browser contexts; sign each in through the sign-in form.
- A replay means re-sending, from an in-page fetch on the app page, a request you recorded from the app's own network activity, optionally with another session, target id or field. Never guess routes.
- Every address is on http://localhost:3000. No criterion needs any address outside this machine except as plain text typed into a message.
- Times shown may use any clear format; the clock is fixed at 2026-05-12T11:00:00Z, so new messages all carry that time.
- The library of messages grows as criteria run. Do not assume the seed state, and do not delete anything a step does not ask you to.
