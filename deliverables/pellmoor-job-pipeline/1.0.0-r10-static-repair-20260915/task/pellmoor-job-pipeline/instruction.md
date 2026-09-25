I want our hiring off paper, and the first thing it has to enforce is that nobody jumps a stage.

Build the Pellmoor hiring workspace from the hosting note and exact seed in
`/recruitment`. The hiring rules are in `/instructions/hiring-rules.md`; they
win if any other note disagrees.

We need vacancy and candidate views, panels, scores, notes, a useful activity
trail, fresh assessments when panels change or interviews reopen, vacancy
capacity that competing offers cannot overbook, atomic batch offers with an
explicit selection and review flow, and a d3 funnel worked out from the real pipeline history. Empty vacancies
should read like an intentional state, not a broken chart.

Keep sign-in and writes safe when people have the app open in more than one
place. The remaining expectations are in `/instructions/security.md`,
`/instructions/reliability.md`, and `/instructions/interface.md`.

Before handing over
-------------------
The environment includes Chromium, its system libraries, and Playwright;
`/instructions/browser-check.md` shows how to use them without downloading or
installing anything. Start the shipped server and check the workspace in that
browser. Confirm that its referenced scripts and styles load with suitable content types and
JavaScript or CSS content, rather than an HTML fallback page. Sign in, open a
vacancy and candidate, and fully reload the page. Confirm that the populated
workspace and its controls remain usable, with no fatal browser errors. Fix
any failures and repeat this check after your final changes. A successful build
and API requests alone do not establish that the browser workspace works.
