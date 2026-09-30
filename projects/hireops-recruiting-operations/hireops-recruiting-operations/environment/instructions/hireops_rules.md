# HireOps rules

These are the authoritative rules for HireOps, a corporate recruiting-operations and compensation offer
desk. They're relocated, topic by topic, from our own working notes. Follow them exactly. Where a value here
differs from a request body or a UI guess, the value here wins.

---

## 1. How the desk works

HireOps is where a requisition becomes a hire. A recruiter or comp partner drafts a compensation package
against an open requisition; an approver with the right standing signs it; approving mints the budget
commitment, the equity grant, the referral accrual and the signing remittance together; a comp change later
is a revision that supersedes the prior offer; and a hire that falls through is rescinded, which claws back
whatever signing bonus and equity had not yet vested. We need one web application for all of it: a server, a
database that survives a restart, a sign-in, and screens a recruiter, a comp partner, an approver, a finance
controller and an auditor can all work from.

What keeps catching us out isn't any single screen. It's that an equity grant's value, a signing bonus's
amortized weight, a requisition's remaining budget and two separate vesting clocks all have to agree about
the same offer at the same moment. Sections 2 through 7 are where we've written those figures down.

### The people who use it

Every user has exactly one role, and every seeded account uses the password `Hireops!2026`. Identity comes
from the session the server issued, never from anything a request body claims.

| Role | What it's for |
|---|---|
| Recruiter | raises offers, straight to PENDING, for an approver to sign; revises a committed one |
| Comp partner | raises and shapes compensation packages the same way |
| Approver (tier 1 / 2 / 3) | signs a PENDING offer within its own authority; revises a committed one |
| Finance controller | rescinds a committed offer and posts the clawback; revises a committed one |
| Auditor | reviews requisitions, offers, equity, referrals and the audit trail |

Revising a committed offer belongs to the recruiter, any approver, or the finance controller. The comp
partner prices a package when it is raised but doesn't reopen one after it is signed, and the auditor
changes nothing at all. Opening a requisition is different: anyone signed in may open one, auditor
included, because a requisition on its own commits no money.

An approver's tier is fixed at seed (tier 1, 2 or 3). It isn't the same thing as the offer's own band,
though confusingly the two use the same numbering. Section 3 has the bands.

Recruiters, comp partners, approvers and finance controllers may all raise a new offer. The auditor may
not. The separate revision and approval permissions above still apply. Show an approver's specific held
tier beside their signed-in identity so the desk can tell which authority is currently active.

### A note on what's here

Every rate, threshold, cap, rounding mode and boundary convention we run on is written down, either here
or in the seed's `constants` block, which this note puts into plain language. The sections below specify
which figure each decision and screen uses. Keep those meanings consistent through an offer's revisions.

Routes, field names, element ids, button labels, the shape of the pages: all yours, we don't mind. What we
care about is that the system behaves the way this note says and puts the figures on a screen where we can
see them.

### The moment the system stands at

Every timestamp in the seed is an ISO instant in UTC. **The system carries one stored reference moment,
`2026-08-01T00:00:00Z`.** Nothing in this app reads the operating system's clock, and there is no test clock
to wind forward. Two different things are checked against two different anchors:

- A referral's retention cliff is checked against the stored reference moment: the one fixed point the
  whole system stands at.
- A rescission's signing-bonus and equity vesting are checked against the rescission's own stored
  effective date, a date the finance controller supplies when they rescind, not the reference moment and
  not the day the rescission happens to be actioned.

### How the desk writes numbers down

Every stored figure is an integer. There is no floating point in any figure that matters.

| Quantity | Stored as | Shown as |
|---|---|---|
| Money (salary, bonus, equity price, budget) | cents (`8800000` is $88,000.00) | dollars and cents |
| Equity units | whole shares | whole shares |
| Vesting / band rate | basis points (`500` is 5.00%, `4000` is 40.00%) | a percentage |

Round half-up, and round once, at the point the rule names. Never at an intermediate step.
`round_half_up(x) = floor(x + 0.5)`. Every boundary in the system is half-open `[start, end)`: reaching
the edge counts as having crossed it.

Amounts and unit counts must be nonnegative integers in their stored units. Reject negative, fractional,
nonfinite or unsafe inputs instead of silently rounding or replacing them with zero. Inputs and computed
money or unit totals must fit the exact integer range 0 through 9,007,199,254,740,991; refuse an operation
whose result cannot be represented exactly. A signed ledger adjustment may be negative. Use exact
arithmetic through multiplication and division, then round only the named final result.

### The seed roster

The starting data loads from `/assets/` exactly as written, with the ids as given. It carries seven
requisitions across four departments, each with its own annualized budget; a roster of offers spanning the
three statuses an offer is seeded in, DRAFT (started, never raised), PENDING (raised, awaiting approval)
and COMMITTED (approved), including offers carried far enough past their start date to make vesting
arithmetic meaningful; three referring employees
distinct from any candidate; and, for the offers already committed, the equity grants, signing remittances
and referral accruals that approving them would itself have minted. Every composed figure (intrinsic equity
value, annualized equity, committed run-rate, band basis, headroom, vested percentages) is derived at read
time from these raw rows. None of it is a stored composite to be trusted on its own.

---

## 2. Compensation composition

An offer carries a base salary, an optional signing bonus, an optional relocation reimbursement, and an
optional equity grant (a unit count, a fair value per unit, and a strike price per unit). From these, the
desk derives several figures. Each one answers a different question, so they are not interchangeable.

### Equity intrinsic value

> We once told a candidate their equity was worth $264,000: that was units times fair value, the gross
> grant. What a grant is actually worth is only what sits above the strike price: the fair value, less the
> strike, times the units. Below the strike it is worth nothing at all, not a negative number.

**Equity intrinsic value = equity units × max(0, fair value per unit − strike price per unit).** This is
not the gross fair value of the grant (units × fair value alone), and not the strike notional (units
× strike alone). Those two answer different questions, and neither belongs on a screen as what the
grant is worth.

**Equity annualized value = intrinsic value ÷ 4 years** (the `equity_annualization_years` constant), rounded
half-up, once. Four years is this grant's full vesting term for the purpose of annualizing its value — a
separate question from how much of it has actually vested at any given moment (section 6). The annualized
figure, not the raw intrinsic value, is what feeds every other composed figure below.

### Committed run-rate

**Committed run-rate = base salary + annualized equity value.** This is what the offer would cost every year
if the year repeated. It leaves out the signing bonus and the relocation reimbursement, because a
run-rate says what a year costs and neither of those comes round again. This is the figure a
requisition's budget is committed against (section 4).

### Approval-band basis

> A signing bonus doesn't repeat the way base salary and vesting equity do, but it isn't relocation either —
> it's real compensation the desk is still on the hook for while it unwinds. The band basis weighs it at
> half: the amount a signing bonus amortizes to over the two years it takes to fully vest.

**Approval-band basis = base salary + (signing bonus ÷ 2, rounded half-up) + annualized equity value.** Half
the signing bonus, because the signing-bonus clawback schedule (section 6) fully vests it over 24 months
(two years), and amortizing it over its own vesting term is how the desk weighs a one-time payment against
an annual approval threshold. The band basis, like the run-rate, excludes relocation entirely.

Relocation is a one-time reimbursement. It appears on the offer and is paid, but it is never part of either
composed figure above.

The committed run-rate and the approval-band basis are two different figures answering two different
questions. They are built from almost the same inputs, which is exactly why one is so easy to show in
place of the other. Show both.

---

## 3. Approval bands and tiered authority

The approval-band basis (section 2) sorts every offer into one of three bands, using the seed's
`band_edges_cents`:

| Band | Basis range | Required approver tier |
|---|---|---|
| I | under $200,000.00 | 1 |
| II | $200,000.00 up to (not including) $350,000.00 | 2 |
| III | $350,000.00 and up | 3 |

The edges are half-open: a basis of exactly $200,000.00 is already Band II, not Band I; a basis of
exactly $350,000.00 is already Band III.

An approver's own seeded tier must be at least the offer's required tier, not an exact match. A tier-3
(Band III) approver may sign an offer of any band; a tier-1 (Band I) approver may sign only a Band I offer.
An approver whose tier falls short is refused, naming both the held tier and the tier the offer requires.

Dual control: the approver must be a person distinct from whoever raised the offer. Nobody signs
their own offer, regardless of tier.

The budget gate: an offer's committed run-rate, not its band basis, must fit inside the
requisition's remaining headroom (section 4) for the approval to go through. An offer that clears the
authority and dual-control checks but would overrun the requisition's headroom is still refused, naming the
shortfall.

---

## 4. Budget headroom

A requisition carries an annualized comp budget. **Its headroom is not a number stored on the requisition.
It is the budget netted against every commitment movement ever posted against it:**

- Approving an offer posts a commitment for the negative of that offer's committed run-rate (it consumes
  headroom).
- Superseding an offer via a revision posts a reversal for the positive of the prior committed run-rate,
  and a fresh commitment for the negative of the revised one.
- Rescinding a committed offer posts a release for the positive of the run-rate it had committed.

> A requisition's planning sheet still shows the number budgeted the day it was opened. Every commitment
> since (every approval, every reversal, every release) has moved the real headroom without that first
> figure ever being touched. Trust the rows, not the sheet.

Some requisitions carry an additional stored headroom figure left over from an earlier planning pass. It is
not kept in sync with commitment activity and is not the authority; the headroom a screen shows must
be the one netted live from the movement rows, every time.

---

## 5. What approval, revision and rescission each do

Raising an offer creates it in one step, straight at status PENDING, ready for an approver. There's no
save-a-draft-then-raise-it dance to build: whoever raises it fills the form in and the offer exists as
PENDING. The same goes for opening a requisition, which any signed-in role may do (section 1).

Whoever raises an offer gives it an id, and so does whoever opens a requisition. We type these in
ourselves and we are not tidy about it — the export's `OFF-…` and `REQ-…` are just what the last system
happened to use. Take whatever id you are given and store it as given. Don't require a prefix, a
pattern, a length or a numbering scheme; the only thing that matters is that an id isn't blank and isn't
already taken by another record of the same kind. Whitespace-only ids are blank; otherwise preserve every
character, including surrounding spaces and punctuation. A duplicate is refused without replacing the
existing record. These ids must work through the ordinary screens for the entire offer lifecycle.

Raising an offer also names a requisition, a candidate, a compensation package, and the offer's own start
date — the day the hire is due to begin. Both vesting clocks in section 6 are measured from that date, so
whoever raises the offer has to be able to set it, and it won't always be today. Where the hire came through
an employee referral the offer also names the referring employee and the referred hire's own start date,
which is its own separate field: it drives the retention cliff in section 7, and it is not the same thing as
the offer's start date even when the two happen to fall on the same day. From PENDING it is either approved
into COMMITTED, or, once committed, it may later be superseded by a revision or rescinded. The original row
is never edited in place by either.

One row in the export sits at DRAFT: someone started it in the old system and never raised it. Nothing
here needs to create a new one. Just don't let it count: a DRAFT isn't PENDING, nothing can be approved from
it, and it commits nothing against a requisition's headroom.

### Approval mints, together

- The budget commitment described in section 4.
- An equity grant, when the offer carries equity units, whose vesting clock (section 6) starts on the
  offer's own start date.
- A referral accrual, when the offer names a referring employee. It is credited to that employee,
  never to the candidate who was hired (section 7).
- A signing-bonus remittance, when the offer carries a signing bonus, for the full amount paid up front.
  What the company may later reclaim of it is a separate question, answered only if the offer is rescinded.

### Revision supersedes

A committed offer may be revised. Revision never edits the original: the original row is retained exactly
as approved, marked superseded, pointing at the revision. A fresh row is minted carrying the revised
figures, already committed. Superseding reverses the original's budget commitment in full and posts a fresh
commitment for the revised offer's own committed run-rate, so headroom re-nets to the revised figure.

A revision can change base salary, signing bonus, relocation, equity units, equity fair value and equity
strike price. Candidate, requisition, offer start date, referring employee and referred hire start date
remain those of the original hire. Each revision receives a fresh unique id; the app may choose it.
The new run-rate must fit the current headroom **plus the immediate predecessor's run-rate**. Equality
fits. Refuse an overrun with the available amount and shortfall, leaving the entire prior state intact.
Revision uses the roles listed in section 1; it does not require another approval or a new tier check.

The linked original and its revisions form one hire history, with only one current committed offer.
For signing payments, keep the original paid remittance. Each revision posts a signed adjustment equal
to the new signing bonus minus the immediate predecessor's bonus (a reduction is a repayment).
Zero needs no payment row. Summing the original payment and every adjustment gives the current bonus
paid for this hire. Show the individual payments, adjustments and resulting total across the history.

For equity, retain prior grants as superseded history and replace the active grant with the revised
unit count, fair value and strike price. Its vesting start is still the original offer start, never
the revision date. A zero-unit revision leaves no active grant. Show historical grants separately;
do not count them as additional live units. A revision does not create another referral accrual.

Only the current COMMITTED offer can be revised or rescinded. An attempt on a superseded ancestor,
or another attempt after the current offer has already been rescinded, is refused without adding
another offer, payment, grant, movement or action receipt. This also applies to stale browser tabs
and overlapping requests. Two affordable offers competing for insufficient combined headroom cannot
both commit: decisions use current stored movements within the same atomic operation.

### Rescission releases and claws back

Only the finance controller may rescind a committed offer, and only as of a stored effective date —
never the day the rescission happens to be actioned. Rescinding:

- Releases the offer's committed run-rate back to the requisition's headroom, in full.
- Works out how much of the signing bonus had vested by the effective date, under the signing-bonus
  clawback schedule (section 6). The vested amount is the hire's to keep. Only the unvested remainder is
  clawed back, posted as a contra against the signing remittance. A signing bonus already fully vested by the
  effective date claws back nothing at all.
- Works out, the same way but under the equity vesting schedule (section 6, a different schedule from
  the signing bonus's own), how many equity units had vested by the effective date. The vested units remain
  on the grant. Only the unvested units are cancelled. A grant already fully vested by the effective date
  has nothing left to cancel.

When the offer was revised, release only the latest run-rate, calculate signing vesting from the latest
bonus total and the original start date, and cancel only the current replacement grant's unvested units.
Post the signing contra against the hire's payment history; its final net is the vested amount retained,
not a negative balance caused by ignoring the original payment. Superseded grants remain historical.
The original referral accrual remains unchanged through every revision and rescission.

> A signing bonus 40% vested at the cliff, further along a year later. The company only ever reaches for
> what hasn't vested yet. What already vested is the hire's, whatever else happens to the offer afterward.

---

## 6. Vesting schedules

Signing-bonus clawback and equity cancellation are governed by two separate schedules, both read from
the seed's `constants` block, both measured in completed whole months from a start point to the
rescission's own effective date. A month only counts once it has fully elapsed.

Use UTC calendar anniversaries measured from the original start. For the N-month anniversary, add N
calendar months to that original date and clamp its day to the last day of the destination month,
preserving the time of day and milliseconds. Never calculate later anniversaries by repeatedly adding
one month to an already clamped date. Completed months is the largest N whose anniversary has been
reached; before the start it is zero. February 29 to the following February 28 at the same time is
therefore twelve completed months. Referral cliff dates use the same calendar addition convention.

Date inputs accept real `YYYY-MM-DD` dates (UTC midnight) or UTC instants written as
`YYYY-MM-DDTHH:mm:ssZ`, optionally with one to three fractional-second digits before `Z`.
Preserve that millisecond precision. Impossible calendar dates and missing required dates are refused. The offer start date
is required when raising an offer; referring an employee also requires that hire's separate start date.
Rescission always requires the finance controller's effective date; do not substitute a default.
After calculating a vesting rate, round retained signing cents and retained equity units half-up once.
Subtract that retained amount from the full bonus or grant to obtain clawback or cancelled units.

### Signing-bonus clawback vesting

Measured from the offer's own start date:

| Elapsed | Vested |
|---|---|
| Fewer than 12 completed months | 0.00% |
| At the 12-month cliff | 40.00% |
| Each further completed month | +5.00% |
| At 24 completed months, and beyond | 100.00% (capped) |

### Equity vesting (grant cancellation)

Measured from the equity grant's own date (set, at approval, to the offer's start date):

| Elapsed | Vested |
|---|---|
| Fewer than 12 completed months | 0.00% |
| At the 12-month cliff | 20.00% |
| Each further completed month | +4.00% |
| At 32 completed months, and beyond | 100.00% (capped) |

Both schedules share a 12-month cliff and the same completed-months arithmetic. Everything else about them
differs: a different cliff percentage, a different monthly accrual, and a different month at which each
reaches fully vested. Read each schedule against its own constants.

---

## 7. Referral bonuses

A referral bonus is a flat $10,000.00 (`referral_bonus_cents`), credited to the referring employee on
record, never to the candidate who was hired, and split by `referral_at_hire_bp`:

- 50.00% ($5,000.00) vests immediately, at hire.
- 50.00% ($5,000.00) is contingent, vesting only once the hire clears a 6-month retention cliff
  (`referral_retention_cliff_months`), measured from the referred hire's own start date.

The retention cliff is checked against the system's one stored reference moment (section 1), never a real
clock. The cliff is half-open: once the reference moment reaches the cliff or passes it, the contingent
half is vested; strictly before the cliff, only the at-hire half is.

Approval is the hire event for the immediate half, including a hire with a future scheduled start.
The separately supplied referred-hire start controls only the six-month contingent half.

A referral accrual is minted once, when the offer naming the referrer is approved (section 5). Nothing in
this desk revises or rescinds a referral accrual afterward — it is tracked through to vesting, not reversed
by anything that later happens to the offer.

---

## 8. Identity, roles and the record

Sign-in is by email and password; every seeded account uses `Hireops!2026`. Identity comes from the
session the server issued and from nothing else. Every decision is recomputed from stored records at the
moment it is made.

Anything arriving in a request body is a claim, not a permission. A caller who puts a chosen band, a
chosen approver, a chosen committed amount, or a chosen clawback figure into the body gets exactly the same
answer as a caller who sent none of it: the band and required tier come from the offer's own stored
composition, the approver from the signed-in session, the clawback from the rescission's own stored
effective date — never from the body.

An unauthenticated caller reads and writes nothing operational. The discipline is `401` for a caller with no
valid session, and `403` for a caller whose role doesn't reach the action, or whose authority tier doesn't
reach it in the case of an approval.

Every approve, revise and rescind writes an append-only record: a human-readable line to the audit log,
and a structured after-image of the computed figures the action produced. Neither can be edited or deleted
once written. Corrections in this system are always additions. The supersede-on-revise and the
release-and-clawback-on-rescind are themselves the model for how a correction is made, never an in-place
edit.

Each approval, revision and rescission is one atomic operation: status changes, financial movements,
grants, payments, referral creation where applicable, the readable audit line and its structured receipt
either all persist or none do. A refusal must not leave any of those effects behind. Receipts preserve
the acting person's identity and the action's before-and-after figures, including headroom and the
relevant compensation and settlement amounts. Later actions must not rewrite an earlier receipt.
Make those receipts readable in the Audit Trail, including after a process restart and a fresh sign-in.
All operational reads and writes require a valid server session; client-supplied identity, role,
authority, totals or computed settlement values cannot override stored facts.

---

## 9. What the screens have to show

We argue about numbers all day, so the numbers have to be visible, not held in the database and summarized
as "calculated." Show money as dollars and cents, equity as whole units, and rates as percentages. A
compensation breakdown should carry the base salary, signing bonus, relocation and equity together with the
equity's intrinsic and annualized value, the committed run-rate, and the approval band basis and tier side by
side — they are different figures, and a screen that shows only one of run-rate or band basis is not showing
the other.

A requisition should show its headroom netted live from commitment activity, not a static budget figure that
does not move when an offer is approved, revised or rescinded, and we want to see the movements behind it,
the commitments, reversals and releases themselves, so we can argue about where the number came from.

Approving mints three things and we need to see all of them: the equity grant, with its unit count and
the vesting schedule it runs on, so an approver can tell when it starts and how it accrues; the signing
remittance, for the amount actually paid out; and the referral accrual, with its at-hire and contingent
halves and its retention cliff date, read against the reference moment.

A rescinded offer should show what vested, what was clawed back or cancelled, and what the effective date
was. The audit trail is its own screen: every approve, revise and rescind lands there as a readable line
with a before → after summary, and it has to still be there after a reload or a fresh sign-in. And the
landing screen should carry the headline figures we open the app for: how many requisitions are open, what
headroom is left across them, how many offers are committed and how many approvals are waiting.

Where a rule above defines a figure, that defined figure is the one the screen has to show. The readings
these rules reject are named so you can avoid them, not so you can display them.
