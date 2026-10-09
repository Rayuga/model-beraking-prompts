## Application

Name: Kittle & Rowe matter chat
URL: http://localhost:3000

## Accounts

Every password is `password123`.

| Email | Role |
|---|---|
| `harriet@kittle.test` | Harriet Rowe, Partner (timers, holds and walls) |
| `dev@kittle.test` | Dev Anand, Associate (walled from M-12) |
| `sian@kittle.test` | Sian Lloyd, Associate |
| `gwen@kittle.test` | Gwen Pryce, Client (M-11, M-13) |
| `paul@kittle.test` | Paul Marsh, Client (M-12) |

## Key screens

Sign-in; the matter list with unread counts; a matter thread with nested replies, each message's reply and copy-link controls, edit and delete on your own messages, (for partners) hold controls, and timer and wall controls for partners; a message box that suggests people when you type @; a mentions list; search; the transcript page for a matter.

## Notes for checking

- Two people, or one person in two places, need separate browser contexts, because tabs of one context share a sign-in. Open one with the browser_run_code_unsafe tool, whose input is an async (page) => { ... } function: `const ctx = await page.context().browser().newContext(); const p2 = await ctx.newPage();`, sign the second person in on p2 through the sign-in form, keep ctx open while the steps need it, and close only that added context when done. Do not reuse one context's tabs for two people.
- If a copy-link control only writes to the clipboard, read it with navigator.clipboard.readText() from the app page, granting clipboard permission to the context if asked.
- Deleting asks for confirmation. When a step says to delete a message, confirm it, in the page or in a browser dialog.
- A replay means re-sending, from an in-page fetch on the app page, a request you recorded from the app's own network activity, optionally with another session, target id or field. Never guess routes.
- Every address is on http://localhost:3000. No criterion needs any address outside this machine except as plain text typed into a message.
- Times shown may use any clear format; the clock is fixed at 2026-05-12T11:00:00Z, so new messages all carry that time.
- The library of messages grows as criteria run. Do not assume the seed state, and do not delete anything a step does not ask you to.
