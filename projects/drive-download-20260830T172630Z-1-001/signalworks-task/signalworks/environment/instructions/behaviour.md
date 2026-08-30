# How the route actually runs

What follows are complaints and field notes from the control room, the response
teams, the workshop, the signalling engineer's office and the safety office.
Nobody on that side worked out exactly how most of these things happened. The
notes are what people saw, not a specification and not a diagnosis.

Every rate, threshold, band edge, duration and formula input the route uses is
written down here or in the seed roster. What is **not** written down is which
of them collide, and in what order. That is the part the route had to learn,
and it learned all of it the expensive way.

---

## 1. A night on the board

An incident starts on the control-room board. A signaller sees an asset misbehave
and **raises** it against that asset and its section. Somebody **acknowledges**
it, so the board stops shouting. A **job** gets raised against the asset — a
repair if there is an incident behind it, otherwise an inspection or a renewal
off the planned list. A team **claims** the job. Technicians go on it. The work
gets done, the line gets **handed back** stage by stage, and only then does the
incident **clear**. A cleared incident with its delay minutes recorded becomes
**ready to settle**, and at the end of the month it is settled.

Those are separate steps because the route got burned treating them as one.
Clearing an incident is a statement to the train operators that the line is
working. It is not the same statement as "the technician says he has finished",
and the two used to be the same button.

Records the route raises for itself — incidents, jobs, callouts, possession
plans, blockages, corrections — each carry a **reference chosen by the person
raising them**, in the style of the seeded ones. Control quotes those references
down the phone, so they are typed in, not generated.

An asset that has failed stays failed on the board until something puts it back.
Handing back the last stage of a piece of work is what returns an asset to
service; signing off a job does not, and neither does clearing the incident.
Control spent a fortnight believing `SIG-204` was working because the job card
said complete.

---

## 2. What stops a team before it ever gets on the track

Dispatching a team to an asset is where the route checks the condition of the
thing they are being sent to, and it checks it **at the moment of dispatch**,
against what is stored then — not against what was true when the job was raised.

> "One set of points sat on our board with an inspection that was fine on the
> Tuesday and out of date on the Wednesday. The control room only found out when
> dispatch refused."

The complaints, in the order they arrived:

- An asset whose **inspection due date has gone by** does not take work. The
  date is inclusive: due today is still in date, due yesterday is not. Nobody
  ever complained about a job that ran on the due date itself. `PTS-R7-EXP` has
  been sitting on the overdue list since 2020 and there is a repair job open
  against it, `JOB-3005`, which somebody will try to dispatch.
- An asset the maintenance planner has put **under maintenance** takes no
  response job either, and marking the maintenance finished is not on its own
  enough to get it back — the line has to be handed back.
- A **line blockage** placed by the safety office stops **everything** on that
  section: dispatch, work, handback, possession, and any change to the state of
  an asset sitting on it. `BLK-SAF-11` is on the Up Main because protection
  arrangements are in force for `PTS-R7-EXP`. The engineering office argued for
  a year that a blockage was only about the one asset it was placed for. It is
  about the section, and that argument cost us a near-miss report. It is lifted
  by the safety office and by nobody else.
- Only a **team that is on call** takes a response job. `TEAM-D` is not on call
  and the desks keep trying to give it work anyway because it looks free.

There is one thing the workshop had to argue for, and it is the exception that
makes the rest of it workable. A hold stops work on an asset — except the work
that exists to **clear that hold**. An inspection is how an overdue asset stops
being overdue, so an inspection job still goes ahead on one. A repair is how a
failed asset stops being failed, so a repair job still goes ahead on that.
**Renewal** work is held by everything, because a renewal is improvement rather
than remedy, and so is **returning an asset to service** — that waits on every
hold being gone. A **blockage** is the one hold with no exception at all:
nothing moves on that section until the safety office lifts it.

> "We had a set of points out of date and a fitter standing beside them holding
> the inspection sheet, and the board would not let him book the very job that
> would have put it back in date. We were locked out of our own fix."


---

## 3. Competence, and the shift where it lapsed

Every kind of asset demands a competence, and the mapping is in
`competence_requirements`: points work needs the points competence, signals the
signal competence, track circuits the track-circuit competence, level crossings
the level-crossing competence. Possession work on an asset needs **the same
competence as a repair on it** — the office tried arguing that planned work in a
possession was somehow gentler, and the safety officer put a stop to it.

A technician's competence carries an **expiry date**. Here is the one that keeps
biting:

> "We put Bruno on a job three weeks out. Card was fine the day we put him on it.
> By the night of the job it had lapsed, and he was on the track. The system had
> checked the card the day we assigned him and never looked again."

So: the competence has to be valid **when the work is executed**, not when the
technician was put on the job. Putting somebody on a future job with a card that
is in date today is allowed and always has been — that is how planning works.
Executing the work is the moment that reads the card again. `TEC-03`'s
competence runs out on 2026-11-20 and `TEC-06`'s ran out in 2020, and both are
on the roster where a team lead can pick them.

Holding the wrong competence and holding a lapsed one are two different refusals
arriving at two different moments. Both have to name the technician, the
competence the asset wanted, and the date.

---

## 4. Two desks, one job

Response work is scarce and the desks race for it.

Once a team is on a job, that job is theirs — a second team asking for it is
refused, and the first team's name stays on it.

What the desks kept running together is something narrower. A job can be
**planned onto a team**, and it can be **claimed off the board**. Either way the
job itself is spoken for. The difference is what it shuts out **elsewhere**: a
planned job does not yet tie up the asset or the technician written against it,
so another team may still claim a different job on the same set of points, and
that technician may still be put on other work. Once the job is claimed off the
board — or once the work on it is actually under way — the asset and the
technician are held too, and everybody else is shut out.

> "We had a job pencilled to us for a fortnight, and the roster office told us
> our fitter was unavailable the whole time because of it. He had not turned a
> spanner."

A job is claimed by **one** team. When two team leads claim the same job, one
gets it and the other is told, in words, who has it. `JOB-RACE-3301` sits open
on `PTS-102` precisely because both Ashfield desks watch that asset and both
will go for it. Claiming a job that is already claimed does not quietly
re-claim it, does not swap the team over and does not raise a second job — it is
refused, and the job stays exactly as the first claim left it.

An asset takes **one team at a time**. Jobs can sit open against the same asset
— `PTS-102` has an inspection and a repair waiting on it right now — but once
one of them is claimed, the others cannot be. The inspection list and the repair
list are two lists but they are the same set of points, and the workshop has
twice sent two teams to it on the same night.

A technician is on **one claimed job at a time** as well — which is not the
callout merge in §8. Two callouts running back to back are one callout on the
wage bill; a technician still cannot be put on two claimed jobs at once. The
finance office and the roster office have had that argument twice and it is one
word meaning two different things.

---

## 5. Possessions, and the man who approved his own plan

A possession is a planned occupation of a section: the line is taken out of
normal working between two stored times so that work can be done on it.

A plan is written by a **planner** and has to be approved by **somebody else**.
Not somebody senior — somebody **different**. The safety office does not care
about rank, it cares that two people looked. `POS-5001` is sitting in draft
with `USR-07` down as planner and nobody as approver, and the temptation is to
let `USR-07` sign it off and move on.

Two possessions cannot **overlap** on the same section. Touching is fine: one
ending exactly as the next begins is two possessions back to back, which is how
a Saturday night gets planned, and nobody has ever complained about that.
`POS-5002` runs 02:00 to 06:00 on the Down Main and the already-approved
`POS-5003` runs 05:00 to 09:00 on the same section. Those two cannot both stand.

The one that caused the incident report:

> "A plan was approved on the Thursday. On the Friday somebody moved the start
> back two hours and changed the section, and it went out to the crews still
> showing as approved with the Thursday signature on it."

A **material edit after approval invalidates the approval**. The times, the
section, the work covered — change any of them and the plan needs a signature
again, and it has to be one given after the edit. Fixing a typo in the note is
not a material edit and the office does not want a re-approval cycle for one.
The plan keeps its own reference either way; it does not become a new plan.

Work inside a possession still obeys everything else. A blockage on the section
stops it, and a technician without the competence for the asset does not do it
just because it is planned rather than reactive.

---

## 6. Handback: six stages and the photograph nobody took

Giving the line back is the six stages in `handback_stages`, and they go **in
sequence**: work complete and tools clear, asset function tested, protection
removed, site photographed clear, signaller informed, line returned to normal
working. Stage four does not get signed before stage three. The route tried
letting the team sign whatever they had done and reconcile afterwards, and got
a set of points returned to service with a jack still under it.

Two stages demand **evidence** before they can be signed: the function test
wants a **test log** on file and the site-clear wants a **photograph**. Evidence
is attached to that stage before it is signed, not after and not against a
different stage. A stage that demands evidence and has none cannot be signed,
and the refusal says which evidence is missing.

> "The crew signed all six in ninety seconds at the end of a shift. There was no
> photograph. There has never been a photograph. The audit found it two months
> later and we could not tell them when the site was actually clear."

Only when the **last** stage is signed does the asset go back into service and
the incident behind it become clearable. Signing five of six leaves the asset
where it was. A handback on a section under a blockage does not proceed at all —
the case the crews complain about most, and still the rule.

---

## 7. The settlement round: what the operators are owed

These are the complaints from the last settlement round. They are symptoms;
work out the rules yourself.

An incident that has cleared, with delay minutes recorded against it for one or
more operators, gets settled. The four `INC-SETL-*` incidents in the roster are
the ones waiting. Each carries a raised time and a cleared time, and each has
delay minutes recorded against exactly one operator:

| Delay record | Incident | Operator | Delay minutes |
|---|---|---|---|
| `DLY-A1-1` | `INC-SETL-A1` | `TOC-NORTHERN` | 150 |
| `DLY-A2-1` | `INC-SETL-A2` | `TOC-CROSSCTY` | 150 |
| `DLY-A3-1` | `INC-SETL-A3` | `TOC-FREIGHT` | 100 |
| `DLY-A4-1` | `INC-SETL-A4` | `TOC-NORTHERN` | 25 |

Each delay record is priced **on its own minutes**. Minutes are not pooled
across operators before pricing — every operator's loss is their own, and the
office will not accept two operators' minutes added together and banded as one
number.

### The bands

| Band | Applies to | Rate |
|---|---|---|
| `BAND-1` | the first **30** minutes | **0 pence per minute** |
| `BAND-2` | the next **90** minutes, up to **120** | **250 pence per minute** |
| `BAND-3` | everything **above 120** minutes | **600 pence per minute** |

The bands are **marginal**, the way income tax is marginal. Each band's rate
applies only to the minutes that fall inside that band, and never to the whole
total. This is the single most expensive mistake the office has made:

> "We looked up which band the delay landed in, multiplied the lot by that
> band's rate, and sent the invoice. Three operators queried it in the same week
> and every one of them was right."

Finding the band a delay lands in and repricing all of its minutes at that rate
is wrong, and so is charging anything for the first thirty minutes. A delay that
never gets past thirty minutes costs nothing at all, and `INC-SETL-A4` at
twenty-five minutes is exactly that case.

### Major disruption

The route declares a **major-disruption window** when something is going on that
is nobody's fault. There is one on file:

| Window | From | To | Reason |
|---|---|---|---|
| `MDW-2026-11` | 2026-11-14T00:00:00Z | 2026-11-15T00:00:00Z | named storm |

An incident whose **whole span** — raised time to cleared time — falls inside a
declared window is charged **flat at the middle band's rate for every one of its
delay minutes**, with no banding at all: no free minutes at the bottom, no
higher rate at the top, the middle band's rate on the lot.

Whole span means whole span. An incident that starts before the window opens, or
is still running when it closes, gets no relief and is banded normally.
Straddling the edge is not partial relief and it is not full relief; it is
nothing, and the storm week is when the office discovered that. `INC-SETL-A2`
ran 04:00 to 09:00 on the fourteenth and sits wholly inside.

### Mutual aid

A **mutual-aid credit** is money another route owes us for helping them out, and
it comes off a particular incident's bill.

| Credit | Attached to | Amount |
|---|---|---|
| `MAC-01` | `INC-SETL-A3` | £120.00 |
| `MAC-02` | `INC-SETL-A4` | £90.00 |
| `MAC-03` | nothing | £150.00 |

A credit offsets the **penalty**, never the **delay minutes**. Somebody once
converted a credit into minutes at the band rate, took those minutes off the
delay and re-banded the remainder, and the answer was wrong in three directions
at once. The minutes are what the operator lost; they do not move.

A credit can never take a settlement **below zero**. Where the credit is larger
than the penalty it offsets, what comes off is the penalty and no more, and the
settlement lands on zero — no carry-over, no negative settlement, no refund.

And the one that got missed: a credit sitting against an incident whose penalty
comes to **nothing** has nothing to offset, so it is **not spent**, and it is
still available afterwards. `MAC-02` is attached to `INC-SETL-A4`, which is
inside the free band; marking that credit consumed and showing ninety pounds of
relief against a bill of nothing is how the November reconciliation went out
wrong. `MAC-03` is attached to no incident at all and simply sits there.

A settled incident shows its delay minutes, its **gross** penalty before any
credit, the **credit applied**, and the **net**. Showing only the net is what
started the queries.

---

## 8. The wage bill, closing the round, and the trail nobody rewrites

### What a callout pays

Technicians get called out at night and the wage bill runs on five rules, all of
them in `payroll_rules`:

| Rule | What it says |
|---|---|
| Base | each technician's **own base rate per hour**, from their record |
| Overtime | everything beyond **8 hours** on one callout, at **1.5×** the base rate |
| Night premium | **180 pence per hour** for time worked between **22:00 and 06:00** |
| Callout minimum | a callout pays a minimum of **4 hours** |
| Merge | callouts by one technician that **overlap, or merely touch**, are **one** callout |

The base rates, since the office keeps asking for them on one page:

| Technician | Base rate per hour | | Technician | Base rate per hour |
|---|---|---|---|---|
| `TEC-01` Callum Reid | £24.00 | | `TEC-06` Ayesha Malik | £24.00 |
| `TEC-02` Marta Kovac | £26.00 | | `TEC-07` Dawid Lis | £27.00 |
| `TEC-03` Bruno Estevez | £28.00 | | `TEC-08` Rosa Iglesias | £29.00 |
| `TEC-04` Sinead Byrne | £25.00 | | `TEC-09` Osei Mensah | £31.00 |
| `TEC-05` Nikhil Verma | £30.00 | | | |

And the callouts already on file:

| Callout | Technician | Job | From | To |
|---|---|---|---|---|
| `CAL-01` | `TEC-01` | `JOB-3001` | 2026-11-08T20:00:00Z | 2026-11-08T21:00:00Z |
| `CAL-02` | `TEC-01` | `JOB-3007` | 2026-11-08T21:00:00Z | 2026-11-08T23:00:00Z |
| `CAL-03` | `TEC-05` | `JOB-3003` | 2026-11-09T18:00:00Z | 2026-11-10T04:00:00Z |
| `CAL-04` | `TEC-09` | `JOB-3010` | 2026-11-09T09:00:00Z | 2026-11-09T10:30:00Z |

The merge is where the wage bill has gone wrong every single month:

> "Callum did an hour on one job and then two hours on another, and the second
> one started the minute the first one ended. He never left the site. Payroll
> paid him two four-hour minimums for a three-hour night."

Callouts that **touch** — one ending exactly as the next begins — are one
callout, the same as callouts that overlap. It does not matter that they were
booked against two different jobs; it was one person, one stretch of night, one
callout. The four-hour minimum applies **once** to the merged span, not once to
each of the pieces.

The office had to write down which minutes are which, because the three elements
do not measure the same thing:

- **Worked minutes** are what the merged span actually covers, from its start
  to its end.
- **Billed minutes** are the worked minutes, floored at the four-hour minimum.
  A short callout is paid up to four hours; a long one is paid what it was.
- **Overtime** is the billed minutes beyond eight hours, paid at one and a half
  times that technician's own base rate. The minutes below eight hours are paid
  at the plain base rate.
- The **night premium** is paid on the **worked** night minutes only — the
  minutes actually on site that fall between 22:00 and 06:00. It is never paid
  on the padding a short callout gets from the four-hour minimum. Padding is a
  floor on the money, not extra time spent on the track.
- The night premium is a **flat** 180 pence for each night hour. It is not
  multiplied by anything. When a night hour is also an overtime hour it is paid
  at one and a half times base **plus** a flat 180 pence, not at one and a half
  times the 180.

A callout running across midnight is counted properly across the boundary: a
span from the evening into the small hours has night minutes on both sides of
the midnight line.

Each of the three elements — base, overtime, night — comes from minutes and an
hourly rate, so each is **rounded half-up to the penny in its own right** and
the rounded figures are then added. Rounding once at the bottom of the column
gives a different answer, and payroll found the difference before we did.

A settled callout shows the callouts merged into it, its worked minutes, its
billed minutes, the split into normal and overtime minutes, its night minutes,
and the money against each of base, overtime and night alongside the total.

### Closing the round

The administrator **closes** the settlement period. `SET-2026-11` is open now.

Once a period is closed, everything settled in it is **immutable**: no edit, no
re-run, no recalculation — not to fix a figure, not to apply a credit somebody
forgot, not for any reason.

Corrections after the close are **appended as offsets** — a separate record
carrying the difference, referencing the settlement it corrects, leaving the
original exactly as it was. Before the close a correction simply moves the
settlement; after it, the original stands, the offset sits beside it, and the
current position is the original plus its offsets. The route has been asked for
"the figure as it was reported" often enough to have learned why.

### The trail

Everything of consequence — an incident raised or cleared, a job claimed, a
technician assigned, a dispatch refused, a blockage placed or lifted, a plan
approved or invalidated, a handback stage signed, a settlement run, a period
closed, an offset posted, a role changed — goes to an audit trail, and that
trail is **append-only**. It can be read; attempts to edit or delete an entry
are refused. Corrections and offsets are **additions**, and the original row
stays exactly as it was written.


### What finance sees afterwards

Every settlement writes itself into the ledger, and that ledger is **double
entry**: each posting has a matching counter-posting, so the accounts balance
after every settlement, every credit and every offset. Finance found a month
where the penalty on each incident was right and the ledger was still out,
because a mutual-aid credit had been booked on one side only. A settlement that
leaves the ledger unbalanced is what the auditors pulled the route up on. A
credit is a **posting in its own right**, not an edit to the penalty that came
before it.
