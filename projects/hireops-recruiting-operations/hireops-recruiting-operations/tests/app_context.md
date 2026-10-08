## Application

Name: HireOps
URL: http://localhost:3000

## Accounts

All accounts use password `Hireops!2026`.

- Rafael Costa — `rafael.costa@hireops.example` — Recruiter.
- Mei Lin — `mei.lin@hireops.example` — Recruiter.
- Farah Nasser — `farah.nasser@hireops.example` — Recruiter.
- Ingrid Sorensen — `ingrid.sorensen@hireops.example` — Hiring manager.
- Bill Okafor — `bill.okafor@hireops.example` — Hiring manager.
- Yuki Tanaka — `yuki.tanaka@hireops.example` — Hiring manager.
- Aud Halvorsen — `aud.halvorsen@hireops.example` — Observer (reads everything, changes nothing).
- Noor Haddad — `noor.haddad@candidates.example` — Candidate.
- Tomas Varga — `tomas.varga@candidates.example` — Candidate.
- Lena Fischer — `lena.fischer@candidates.example` — Candidate.

## Key screens

Staff: a pipeline Board per job (stages Applied, Screen, Interview, Offer, Hired, Rejected),
Conversations (one per application, between staff and the candidate) and Activity.
Candidates: their own applications and conversations only.

Recruiters open jobs and add candidates, so every review can create its own job and cards.
Adding a candidate with one of the candidate account emails gives that account the application
and its conversation. The starting data has three jobs; Noor Haddad's Platform Engineer
conversation is long (120 messages at the start). Other reviews may have added jobs, cards and
messages; never rely on a starting count.

If selecting several cards or any other control needs a modifier key, hold the key down during the
click (the click tool's modifiers, or keyboard.down, then mouse.click, then keyboard.up); pressing and
releasing it before the click does not count as holding it.

The app may use any route layout and labels. Discover navigation and requests through the
visible UI; never assume the reference implementation's routes, selectors or field names.
