# How I build WebDev tasks that land in the Luna band

This is the flow I follow from picking up a task to getting it accepted, with two of my tasks as examples. `fenwick-laboratory-batches` took eight uploads. `greenroom-show-comms` took five, and it started out scoring too high. Most of what's here I learned from the uploads that failed.

## The bar

A task is accepted when all of these hold on the platform:

- Oracle is at least 0.95.
- Nop is 0.
- GPT-5.6 Luna scores between 0.10 and 0.70.
- The rubric review passes.

The reward is `0.6·functional + 0.2·polish + 0.2·visual`, and it drops to 0 if a gate fails or functional is 0.05 or lower.

Two things to keep in mind. A 0 is out of band too. And the platform only runs its rubric review once Luna is in band, so I do my own review before every upload.

## My flow

**1. Read it myself first.** Unzip the package, read the brief, the notes, the seed files, `task.toml` and every judge file, then run the reference app and click through it. I'm asking simple questions. Is everything that's graded actually asked for? Is anything asked for that's never graded? Would a real person write this brief? Does the reference app really do what the criteria say? On both tasks most of the first-round problems were visible at this stage. Greenroom's reference app was serving its own seed data, which contradicted the assets.

**2. Static checks.** These are the deterministic checks from the WebDev Rubrics QC sheet. They're quick and catch shared-file drift, timeouts that don't add up and missing assets.

**3. Rubric review against the QC sheet.** I run the 53 Quality Checks from the WebDev Rubrics QC sheet in two fresh Claude Code sessions that don't see each other's results. Each marks every check pass or fail with file and line evidence. Then I go through every finding myself and sort it into one of three piles:

- **Real:** I fix it.
- **Reviewer misread:** I leave it, sometimes rewording so nobody trips on it again.
- **Nit:** I note it.

The first round on each task was rough: about 20 distinct fails on fenwick and 23 on greenroom.

In that same first review, straight after I download a task, I also have the blind reviewers judge its difficulty. I want to know whether a strong model would build the whole thing from the brief in a few minutes, which rules it would likely trip on, and roughly where Luna would land. If the honest answer is "it'll score 0.9", I'd rather plan the difficulty work now than burn a platform run to find out. menddesk-support-tickets taught me this the hard way. It went up with a clean rubric, and Luna scored 1.0, then 0.967 after my first round of hardening. For the current version I'm doing the difficulty work first. Two advisors studied it, I picked the band plan myself, and it doesn't go back to the platform until I'm happy with where Luna should land.

**4. Plan the fix, and get it attacked.** I write the fix plan before touching any file. If a round turns up more than about seven issues, I give the plan to another session and ask it to find everything the plan breaks. That habit caught a lot. One fix would have dropped the Oracle below 0.95; another quietly charged the same bug in two criteria.

**5. Fix and verify.** After I edit the task, I check it in four ways:

1. A script walks the reference app through every functional criterion in order, restart included.
2. I click the new screens in a browser, including the 390 px layout and the keyboard paths.
3. I re-run the static checks.
4. I check that the zip matches the reviewed files.

I also back up the folder before every round.

**6. Upload only when I think it's ready.** I only upload once two review rounds in a row come back with zero fails on the same files, and once I'm satisfied the difficulty is where it needs to be. A clean rubric alone isn't enough. If anything changes between them, even one word, I start the count again. I still read the nits in clean rounds. A couple of them were real risks to the Oracle. In one, a fenwick criterion asked for "wells 1, 2 and 3" while the reference labelled them 51, 52 and 53.

**7. Be the judge once myself.** Before the first upload I walk the reference app criterion by criterion, the way the platform judge would. That's how I found greenroom's running order overflowing at 375 px and fenwick's duplicate labels. The platform judge is lenient, so I write criteria that are hard to misread:

- Every pass/fail criterion gets an explicit "Fails if …" line.
- Display checks read the page after a reload, not the backend responses.
- Every refusal check has a positive control.
- No bug is charged in two criteria.

**8. Read the export, not just the score.** For every trial I open `reward-details.json`, which has the judge's reasoning, and for Luna its trajectory and the app it built. Then I decide whose problem it is:

- **The task's:** for example, a gate that needs something the brief never asked for. I fix it.
- **Luna's own bug:** for example, a render function it never called. I don't touch the task over one crash.
- **Luna is simply too good:** I do a difficulty pass, next section.

I log every export and my conclusion in the task's status file.

## Getting a high-scoring task into the band

- **More rules don't help.** Luna reads the brief closely and gets almost every server rule right first time. On fenwick v5 I added six new rules and it passed all six. Greenroom v4 added desk handovers, holds, search and unread counts, and Luna scored 0.77 again, exactly as before.
- **Weight things that only work in the browser.** Luna writes the whole frontend in one go and tests only with curl, never in a browser. What finally worked was weight on behaviour you can only get right in a real browser:
  - **greenroom:** a live console where screens update within 10 seconds without wiping what you're typing, closing a thread or losing your scroll position, plus drafts and focus that are kept;
  - **fenwick:** a multi-row intake sheet with add and remove rows, a preview per row and an all-or-nothing booking.
- **Exact-maths edges, stated but without the giveaway example.** Take a mean of exactly 40 from 39.90, 40.05 and 40.05, or an error of exactly ±1.00% at 4, 8 and 16 kN. Floating point gets both wrong. Luna fixes the examples the brief gives and misses the ones it doesn't.
- **Role screens Luna never looks at.** For example, a read-only user who can still preview. It usually locks the whole role out.
- **Don't let the gate zero a real app.** Two of fenwick's zeros came from a gate that needed one preview widget to work. Now the gate checks four things:
  1. sign-in reaches the server;
  2. the home screen matches a backend read;
  3. a reload brings the same data back;
  4. two detail pages open through the app's own links.

  Everything else goes in the criteria.
- **Watch the judge's time budgets.** Greenroom v4's Oracle scored 0.80 only because the polish judge ran out of time and zeroed the dimension. I rebalanced the timeouts and it went to 1.0.
- **Expect two outcomes, not one.** Luna either ships a bug somewhere and lands at 0 to 0.7, or nails it at 0.85 or more. One run proves little, so I read the trajectory before changing anything.
- **Talk to advisors before changing difficulty.** I get two separate sessions to study the Luna run and propose changes, pick the plan myself, and have it red-teamed before editing.

What I never do:

- hide asks or grade anything the brief doesn't ask for;
- change the judge model or the 0.6/0.2/0.2 weights;
- cut the weight of criteria just because Luna passes them.

## Example 1: greenroom-show-comms (five uploads)

| Ver | What I changed | Oracle | Luna | Takeaway |
|---|---|---|---|---|
| v1 | As received | – | – | Never ran. My first review found 23 fails: undefined rules, a reference app serving the wrong seed data, and generator residue in the files. |
| v2 | Rebuilt the brief in a stage manager's voice with every rule defined, expanded the assets, wrote a new reference app, and rewrote the tests | 1.0 | 0.00 | Luna couldn't find the asset files, so it built a static mock. I spelled out the full asset paths in the brief. |
| v3 | Full asset paths | 1.0 | 0.77 | Just over the band. It missed read receipts, the status toggle and pinning from a thread. |
| v4 | More features: desk handover by acceptance, cue hold and release, scoped search, unread counts per channel | 0.80 | 0.77 | Luna aced every new feature, so the score didn't move. The Oracle dropped because the polish judge timed out. |
| v5 | A live console: screens update within 10 s without wiping typing, threads or scroll; drafts kept; focus kept after keyboard actions; a stricter phone layout; rebalanced timeouts | 1.0 | **0.51** | Accepted. Luna's 1-second poll re-rendered its whole page and wiped drafts and focus. Its acknowledge and edit routes were also broken. |

## Example 2: fenwick-laboratory-batches (eight uploads)

| Ver | What I changed | Oracle | Luna | Takeaway |
|---|---|---|---|---|
| v1 | As received | – | – | Never ran. My first review found about 20 fails. |
| v2 | Full rewrite: a natural brief with four notes, a second workflow (a calibration log per machine), an exact-maths reference app, and the floor back to 0.05 | 1.0 | 0.00 | The gate needed preview figures the brief never asked for. That was my mistake. |
| v3 | Brief now says what a preview shows | – | 0.00 | Luna never called its own `shell()`, so nothing rendered after sign-in. |
| v4 | Proving forces changed to 4/8/16 kN for the ±1% float edge, plus an exact-40 mean and a back-dated recalibration | 0.99 | 0.90 | Luna built it all in six minutes. The judge also passed a case its own reasoning said had failed, which is why I added "Fails if" clauses. |
| v5 | Six more stated rules (month-end dates, rounding, history details and more) | 0.99 | 0.86 | Luna passed all six. Adding rules doesn't work. |
| v6 | A multi-row batch-intake sheet, an unsorted register file, open previews, and a stricter phone layout | – | 0.00 | One broken preview widget in Luna's page failed the gate. |
| v7 | Widened the gate to sign-in plus pages showing backend data | – | 0.00 | Luna never defined its `fixed()` helper, so the home page crashed. |
| v8 | Same files, run again | 0.99 | **0.51** | Accepted. Luna lost the float edges, the register order and the auditor preview, and its own `history()` function broke every link. |

If I started fenwick again, I'd fix the gate first and put weight on a page-only workflow early, instead of spending two rounds adding rules.

## Prompts I use

- **Review:** "Act as a strict QC reviewer. Assess the whole task folder against each of the 53 Quality Checks in the WebDev Rubrics QC sheet. Give pass or fail per check with file:line evidence, keep nits separate, and don't edit anything."
- **Red-team:** "Here's my fix plan. Find every way it fails a strict reviewer, drops the Oracle below 0.95, or charges one bug in two criteria."
- **Difficulty:** "Read this Luna run's reward-details and trajectory. Separate its systematic failures from one-off slips. Propose honest changes that move weight onto behaviour Luna can only get right in a real browser, and project the score per criterion."

## Before every upload

- I've read every finding from the last two rounds, and I'm fine with the open nits.
- The reference app passes every criterion through the API, and I've clicked the new screens myself.
- Static checks pass, and the zip matches the reviewed files.
- `task.toml` has no `version` field, and its provenance is plain, with no dates or review history.
- The task notes are identical in all three scored prompts.
- There are no keys or tokens anywhere in the folder.
