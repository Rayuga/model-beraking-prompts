# UtiliBill rules

These are the authoritative rules for UtiliBill, an energy retailer's billing and regulatory-settlement
back office. They are relocated, topic by topic, from the desk's own working notes. Follow them exactly —
where a value here differs from a request body or a UI guess, the value here wins.

---

## 1. What you are building

UtiliBill is the **billing + regulatory-settlement back office** an energy retailer's billing desk runs its
book from. The meters are already read; this desk turns those reads into **bills**, applies the regulatory
riders and the net-metering credits, trues up the late and estimated reads, runs the budget/levelized
plans, and settles the regulatory **remittance**. It is **not** a consumer pay-my-bill app. It is one web
application: a server, a database that survives a restart, a sign-in, and a set of screens a meter-data
analyst, a billing operator, a rate administrator and a settlement controller all work from.

It sits on two conceptual offline twins — an AMI/meter-data head-end (the read feed) and a regulatory
settlement authority (the remittance clearing) — and it is graded on **its own persisted rows**, never any
external echo. The hard part is not any single screen: a late read that trues up (possibly more than once),
a time-of-use rate change that lands mid-cycle, a stack of regulatory riders each on a different base, a
levelized plan that accrues a deferred balance, and a net-metering bank that carries credits forward all
have to agree about the same money at the same seeded moment — and they collide in ways this desk learned
the expensive way.

### The people who use it

Every user has exactly one role. All accounts use the password `Utilibill!2026`, and identity comes from
the session the server issued — never from anything a request body claims.

| User | Sign-in | Role |
|---|---|---|
| `USR-ANA` Anaya Rao | `anaya.rao@utilibill.example` | Meter-data analyst |
| `USR-OPR` Owen Price | `owen.price@utilibill.example` | Billing operator |
| `USR-RATE` Rhea Tan | `rhea.tan@utilibill.example` | Rate administrator |
| `USR-CTL` Cira Lund | `cira.lund@utilibill.example` | Settlement controller |
| `USR-CTL2` Cyrus Okafor | `cyrus.okafor@utilibill.example` | Settlement controller |

- **Meter-data analyst** — validates the actual read and **raises** the true-up re-bill (the catch-up on a
  late/estimated read). Cannot bill a cycle, cannot approve, cannot remit.
- **Billing operator** — **bills** a metered cycle (the energy, riders, net-metering, grand total), runs the
  annual budget true-up, and finalizes billed cycles into a settlement period. Cannot approve a re-bill and
  cannot remit.
- **Rate administrator** — owns the tariff (the effective-dated rate change and rider authorizations).
- **Settlement controller** — **approves** a re-bill whose correction exceeds the dual-control threshold,
  and **runs the remittance**. May not bill the money spine itself.

There are **two** settlement controllers on purpose, so an over-threshold re-bill one desk raises can be
approved by a distinct controller. What each role reaches, and what it may never reach, is in section 4
(Trust and isolation).

### How to read this brief

The brief is the desk talking in its own words. **Every tier band and rate, every time-of-use window and
rate, the mid-cycle rate change and its effective instant, every rider rate, the fixed charge, the export
credit rate, the levelized mechanics, the dual-control threshold, the rounding mode and the boundary
convention are all written down** — here, in section 3, or in the seed roster. What is **not** written down
is **which of those rules collide, on which base each rate sits, in what order the bill composes them,
which period a late read's usage belongs to, and which balance a credit touches.** That is the part the desk
had to learn, and it learned all of it the hard way. Working out the collisions is the task.

> **These are this desk's own synthetic contract terms — do NOT assume any utility-textbook or
> market-standard number or convention in their place.** In particular the net-metering treatment, the
> rider bases, the rider order, and the catch-up allocation deliberately differ from the utility defaults
> you may have seen: read them as written. A build that reaches for "net metering at retail", "tax the
> energy", "rider on the total", "bill the read's cycle" or "reset the plan to the average payment" computes
> the **wrong** figure here.

Nothing in the product is graded on the spelling of a route, a field, an element id, a button label or a
status word — those are all yours. What is graded is what the system **does** and what it **shows** on a
screen. Record the choices you made in `APP_MANIFEST.md` at the app root.

### The moment the system stands at

Every timestamp in the seed is an ISO instant in UTC. **The system carries one stored reference moment,
`2026-08-15T09:00:00Z`, and every date rule compares two stored timestamps** — a billing-cycle window, a
rate-change effective instant, a budget-plan enrollment anniversary — against that reference moment.
**Nothing reads the operating system's clock.** Every window is **half-open** `[start, end)`: an interval
stamped at a window's `start` is inside it; at its `end` it is outside.

### How the desk writes numbers down

| Quantity | Stored as | Shown as |
|---|---|---|
| Money | **cents** (`1200` is $12.00) | dollars and cents, `$12.00` |
| Percentage rate | **basis points** (`400` is 4.00%) | a percentage |
| Volume | **kWh** (whole) | kWh |
| Sub-cent volumetric rate | **hundredths of a cent per kWh** (`90` is 0.90¢/kWh) | ¢/kWh |

Round **half-up**, and round **once**, at the stated event — `round_half_up(x) = floor(x + 0.5)`.

### The seed roster

The starting data loads from `/assets/` exactly as written, with the ids as given — do not invent parallel
ids for anything the roster already names. It carries the five accounts above; eleven customer accounts and
their tariffs, cycles, meter reads (actual and estimated), net-metering exports, budget-plan histories and
enrollment anniversaries; a rate-change record; and two settlement periods. Each account is named for the
trap it sets: **Alderway Terrace** the catch-up true-up (with a second, later correction on top of the
first); **Kestrel Court** and **Kestrel Court Annex** the dual-control catch-up, independently of one
another; **Braymoor Mill** the TOU rate change and rider stack; **Harnby Row** and **Pelham Gate** the
budget/levelized plan; **Marsh Row Solar** and **Downe Wharf** the net-metering bank; **Ivsholt Depot** the
plain metered cycle; **Fennimore Yard** and **Quietwood Court** are dedicated, single-purpose fixtures used
only for the idempotency/lock and the persistence checks respectively — nothing about their own figures is
special.

---

## 2. How the work runs

What follows are field notes from the meter-data analyst's desk, the billing floor, the rate desk and the
settlement office. Nobody on that side worked out exactly how most of these things happened. The notes are
what people saw, not a specification and not a diagnosis.

### 2.0 Every window in this business is half-open

Start with the convention that decides the most arguments. **Every window in UtiliBill runs from its start
up to but not including its end** — a tier band, a time-of-use window, a billing cycle, the rate-change
effect, an enrollment anniversary.

> "The peak rate changed at six on the tenth. An interval stamped at exactly six o'clock got billed at the
> old rate. Six o'clock is the new rate — the old window ended at six and did not include it."

### 2.1 A metered cycle becomes a bill

The billing operator **bills** a cycle from its actual read. The bill is built from the energy (the tiered
blocks, or the time-of-use buckets for a TOU account), the fixed charge, the regulatory riders, any
net-metering credit, and the gross-receipts assessment. Each of those is stated on its own in section 3.
**Which of them apply, on which base each rate sits, and in what order they compose, is the part the desk
kept getting wrong** — so the notes describe each on its own, never the sequence.

> "A cycle's inclining blocks reset every month — its own fresh first-tier allowance. Someone carried the
> blocks over from last month and the customer hit the top tier on the first kilowatt. Each cycle stands on
> its own blocks."

Billing a cycle mints the bill and its **rider-accrual rows** (one per rider), and — for a net-metering
account — moves the **bank** if there is a surplus (or a drawdown) to carry. A cycle is billed **once**;
replaying the bill mints nothing further and names the bill already on file.

### 2.2 The mid-cycle rate change splits the peak by what the meter saw

The rate administrator activates an **effective-dated** peak rate change (30¢ → 34¢) at a stored instant
inside a cycle. The meter has already split the peak usage into what ran **before** the instant, what ran
**at** it, and what ran **after** it — three pre-stored sub-period figures.

> "We prorated the peak by the number of days on each side of the change. But the meter had the actual
> kilowatts on each side the whole time. You bill what ran before at the old rate and what ran from the
> change onward at the new rate — the metered split, not a day-count. And the interval sitting exactly on
> the change is on the new side."

The split is the **metered sub-period usage**, and the boundary interval is half-open — on the new rate.

### 2.3 A late / estimated read is trued up in the period it accrued — and a correction can itself be corrected

A cycle billed on an **estimated** read is issued as an estimate. When a later **actual** read comes in and
reveals the true usage across the periods since the last real read, the analyst **raises a true-up**.

> "The read came in on month two showing sixteen hundred kilowatt-hours for two months. Someone dumped the
> whole lump on month two. Month two lit up the third tier — usage it never burned. The kilowatts were used
> across both months; the blocks meter a month at a time. The only record of how the usage fell across the
> months is the baseline profile the desk keeps for each cycle."

The true-up attributes the revealed usage **back across the periods it accrued in** — using the stored
per-cycle baseline profile as the evidence of how the usage fell — and **re-bills each period on its own
fresh blocks**. Each period's **prior bill** is **superseded** (kept on file, marked superseded, its figure
intact) and a **contra of the difference** is posted; a prior bill is never edited in place. If the
correction on any period exceeds the **$100.00 dual-control threshold**, the re-bill is held until a
**distinct settlement controller** approves it (section 4).

**A period that was already corrected once can be corrected again.** The desk has seen a meter get re-read
a second time, later, revealing that even the first correction undercounted. Nothing about "the prior bill"
means "the original estimate specifically" — it means whatever bill is **currently live** on that period
when a new correction lands. A second (or later) correction on the same period supersedes **that period's
own currently-live bill** — the most recent one still on file and not itself already superseded — and
contras the difference **against that live figure**, never against the original estimate a second time and
never against zero. Every earlier generation stays on file with its own figure intact; only the
**current** generation is superseded by the next one.

> "The second read on that field came in eight weeks after the first correction. Someone re-ran the
> allocation against the original estimate again, as if the first correction had never happened. The books
> were short by exactly what the first correction had already added."

### 2.4 Net metering nets generation, and banks the surplus (or draws it down)

A net-metering account's export earns a bank credit at the export rate. The credit is worked against the
**energy** the customer would owe; anything left over **banks and carries forward**, and it is never paid
out. Because the bank is a **running** balance across every cycle an account has ever billed, a cycle whose
own export credit falls short of its own energy can draw down what an **earlier** cycle in the same session
already banked — the balance that matters is always the **current sum of every movement row on file**, not
the figure that was true before the most recent bill.

> "The exporter's credit wiped out their whole bill one month — no service charge, no surcharges. That is
> wrong. It cancels the energy, the rest of the bill stands, and the leftover goes into the bank."
>
> "Two bills went through back to back on the same account. The second one used the bank balance from
> before either bill ran, not the balance the first bill had just left. The two together banked the wrong
> amount by exactly what the first bill had changed it by."

Billing a net-metering cycle draws the bank down as it offsets the energy and carries any surplus (or
drawdown) forward as a **bank movement**; the bank balance is the **sum of those movement rows**. A cycle
whose available credit (bank plus this cycle's own) exactly equals its energy moves the bank by nothing.

### 2.5 The budget/levelized plan trues up at the anniversary

A budget account pays a flat levelized amount; the gap to the actual bill is a **deferred-balance movement**
each cycle, and the balance is the **sum of those movements**. At the enrollment anniversary the operator
runs the **annual true-up** — it **settles the balance** and **re-levels** the plan (section 3). Before the
anniversary, the true-up does nothing: no settlement, no re-level.

> "We ran everyone's annual true-up at the calendar year-end. Half the accounts were not at their enrollment
> anniversary yet. The true-up is keyed to the account's own anniversary against the reference moment, not a
> date on the wall."

### 2.6 Cycles finalize into a period, and the period is remitted

Billed cycles are **finalized** into a **settlement period** by the operator; the settlement controller then
**runs the remittance** to the authority. The remittance is the **sum of the app's own rider-accrual rows**
(RPS + SBC + GRT) across the cycles finalized **into that period** — a period's figure is scoped to its own
finalized cycles and does not pick up rows from any other period.

> "The authority sent back a settled figure and someone filed that. It is only ever right if we fed it the
> right sum. The remittance is our own accrual rows added up, not a number that came back from anywhere
> else."

Once a cycle is finalized or remitted it is **locked** — a re-bill or true-up against it is refused, naming
the cycle's status.

### 2.7 The audit trail is append-only

Every bill, true-up, approval, budget true-up and remittance goes to an **append-only** audit trail. Each
entry carries the **computed** figure it recorded. The trail can be read; an attempt to edit or delete an
entry is refused. Corrections in this system are always additions (the true-up supersede in section 2.3 is
the model), never edits.

---

## 3. The billing & settlement policy

This is the money spine, and it is where the arguments cost the most. Every rate, band, window, threshold
and boundary convention below is stated. **Which of these rules bind for a given cycle, on which base each
rate sits, in what order the bill composes them, which period a late read's usage belongs to, and which
balance a credit touches, is not** — that is the part the desk learned the hard way. All the figures here
are this desk's own synthetic contract terms; **do not assume a utility-textbook or market-standard value or
convention in their place.**

### The vocabulary (so the bases can be told apart)

- **Delivered kWh** — the kWh the customer **drew from the grid** this cycle (the import register). For a
  net-metering customer this is the **gross** draw, a separate quantity from any kWh **exported**.
- **Energy charge** — the charge for the delivered kWh, run through the tiered blocks or the time-of-use
  buckets below (fixed charge, riders and tax are **not** part of the energy charge).
- **Net-of-credit energy** — the energy charge after any net-metering credit has been applied to it.
- **Gross receipts / net receipts** — *gross* is what would be billed before a net-metering credit; *net* is
  what is finally billed after it.

### Rule — Inclining-block (tiered) energy

Delivered kWh are billed through **inclining blocks**. The bands are **half-open `[lo, hi)` kWh** and they
**reset fresh every billing cycle** — each cycle gets its own Tier-1 allowance; blocks never accumulate
across cycles.

| Tier | kWh band (per cycle) | rate |
|---|---|--:|
| 1 | `[0, 400)` | 8¢/kWh |
| 2 | `[400, 900)` | 13¢/kWh |
| 3 | `[900, ∞)` | 20¢/kWh |

### Rule — Time-of-use (TOU) energy

Where an account is on a time-of-use tariff, the interval usage per bucket is **metered and pre-stored**
(delivered by the AMI head-end per sub-period), and each bucket is billed at its own rate. The windows are
**half-open**; a reading stamped at a window's `start` is inside it, at its `end` outside.

| TOU bucket | window (local) | rate |
|---|---|--:|
| Peak | `[16:00, 21:00)` weekdays | **30¢**, revised to **34¢** (see the rate change) |
| Shoulder | `[07:00, 16:00)` + `[21:00, 23:00)` | 16¢ |
| Off-peak | `[23:00, 07:00)` + all weekend | 9¢ |

**The mid-cycle rate change.** The peak rate is revised from **30¢ to 34¢** effective at a **stored
instant** inside the cycle (in the roster's rate-change record). The meter stores the peak interval usage in
three pre-stored sub-periods: the usage **before** the effective instant, the usage stamped **exactly at**
the effective instant, and the usage **after** it. The windows are half-open `[start, end)`.

### Rule — Regulatory riders and the fixed charge

Each rider has a stated rate and a stated purpose. **What each one funds is the thing it stands on — and
they do not all stand on the same base.** The rates below are synthetic and deviate from any real published
figure.

- **Fixed customer charge = $12.00 per cycle.** A flat service charge for being connected — independent of
  how much power flowed. It is part of what the retailer bills, not a rider.
- **RPS (Renewable Portfolio Surcharge) = 4.00%.** A percentage surcharge that funds **generation** — the
  renewable-portfolio obligation the retailer carries for the power it **generated and delivered**.
- **SBC (System Benefit Charge) = 0.90¢/kWh.** A per-unit charge that funds efficiency and low-income
  **programs sized to consumption** — so many cents for every unit consumed, whatever it cost.
- **GRT (Gross-Receipts Assessment) = 2.50%.** A percentage assessment on the retailer's **gross receipts**
  — what the retailer actually **takes in** on the account this cycle.

> "The renewable surcharge kept landing on the wrong pile — someone ran it on the whole bill, taxes and all.
> It funds generation; it stands on what we generated and delivered, not on the service charge and not on
> the other surcharges. And the receipts assessment is the last word — it is a slice of what we finally
> billed, so everything else has to already be on the bill before it is struck."

The desk never wrote down a single ordered formula; each surcharge stands on what it funds, and the reader
has to work out which base that is and what has to be computed before each one.

### Rule — Net metering

A net-metering account **exports** kWh to the grid. Exported kWh earn a **bank credit at the export rate =
6.50¢/kWh** — an **avoided-cost** rate the retailer pays for exported generation, deliberately **not** the
retail tier rate the customer pays for consumption. Net metering **nets the customer's generation against
the grid's generation**: the credit works against the **energy** the customer would otherwise owe. Any
credit **beyond that** is **banked and carried forward** — the bank is the **sum of the account's
bank-movement rows** — and it is **never cashed out** for money.

> "Solar customer exported more than they used. Someone ran the credit against the whole bill and the
> account came out owing nothing — no service charge, no surcharges, no assessment, zero. That is not how it
> works. The credit is generation against generation; it cancels the energy and the surplus goes into the
> bank for next time. The rest of the bill still stands, and we never write the customer a cheque for the
> bank."

A cycle whose export (plus any prior bank) does not exceed its energy carries **no** surplus into the bank.
Where an account bills more than one cycle in the same session, the **later** cycle's available credit is
the export-rate credit for **that** cycle **plus whatever the bank currently sums to** — including any
movement a still-more-recent bill in the same session just posted — never the balance from before that
prior bill ran.

### Rule — Budget / levelized billing

A budget/levelized account pays a **fixed levelized amount** each cycle. The gap between the cycle's
**actual** bill and the levelized amount is recorded as a **deferred-balance movement** each cycle; the
deferred balance is the **sum of those movement rows** (never a stored scalar). At the customer's
**enrollment anniversary** (a stored instant, compared to the reference moment, half-open — before the
anniversary nothing is settled) the desk does the **annual true-up**: it **settles the deferred balance in
full** and **re-levels** the plan for the year ahead.

> "The annual review squares the account and re-levels it. Someone left the levelized figure where it was
> and the account drifted for another year. Someone else set it to the last cycle times twelve — one cold
> month and the whole next year was priced off it. Re-levelling means the plan reflects the **actual** cost
> of the twelve cycles we just saw, spread over the year — not what the customer happened to pay, and not
> any single cycle."

The twelve stored **actual** bills for the account are the year it just saw; the re-levelled amount is what
spreads that year across the twelve cycles. Round half-up.

### Rule — The catch-up on a late / estimated read

A cycle may be billed on an **estimated** read and issued. When a later **actual** read reveals the true
usage across the periods since the last actual read, the revealed usage has to be attributed back to the
periods it was **actually consumed in** — a two-month lump does not all belong to the month the meter was
finally read. **The only stored evidence of when the unmetered energy was used is the per-cycle baseline
accrual profile** — each cycle carries a stored **baseline weight**, the desk's record of how much of the
consumption accrued in that cycle. Each period is then re-billed **on its own fresh inclining blocks**.

> "We read the meter in month two and it showed two months of power. Someone put the whole lump on month
> two's bill. Month two suddenly showed third-tier usage it never burned — the meter had been reading a
> month's worth at a time all along. The baseline profile is the only thing that says how much was actually
> used each month."

When a period is re-billed, that period's **prior bill** — its original estimate, or, if this is not the
first correction, whichever bill from an earlier correction is still currently live on that period — is
**superseded** (kept on file, marked superseded, its figure intact) and a **contra of the difference between
the new re-bill and that prior bill** is posted; a prior bill is never edited in place. If the correction
(the contra) on any period exceeds the **dual-control threshold of $100.00**, the re-bill is held until a
**distinct settlement controller** approves it. A period with no prior bill at all (never estimated, never
previously corrected) has nothing to contra — its re-bill simply posts as a first-time bill for that period.

### Rounding and units

Money is **integer cents**; percentage rates are **integer basis points** (`400` is 4.00%); volumetric
sub-cent rates are **hundredths of a cent per kWh** (`90` is 0.90¢/kWh). Round **half-up**, and round
**once**, at the stated event — `round_half_up(x) = floor(x + 0.5)`. Every window is **half-open**
`[start, end)`.

---

## 4. Trust and isolation

### Identity

Sign-in is by email and password; every seeded account uses the password `Utilibill!2026`. **Identity comes
from the session the server issued and from nothing else.** Every protected read and every write resolves
the caller from that session cookie, and every decision is recomputed from stored records at the moment it
is made.

### Roles reach their own areas

Every user has exactly one role, and each role's navigation opens onto its own areas.

| Role | What it does |
|---|---|
| **Meter-data analyst** | validates the actual read and **raises** the true-up re-bill |
| **Billing operator** | **bills** a metered cycle, runs the budget true-up, finalizes cycles |
| **Rate administrator** | owns the tariff (the effective-dated rate change) |
| **Settlement controller** | **approves** an over-threshold re-bill and **runs the remittance** |

Two rules sit **on top of** the areas, and neither is a matter of seniority:

- **Only a billing operator bills a cycle and runs a budget true-up; only a meter-data analyst raises a
  true-up; only a settlement controller approves an over-threshold re-bill or runs a remittance.** An
  analyst may not bill or approve; an operator may not approve a re-bill or remit; a rate administrator bills
  nothing.
- **A settlement controller's approval is a role gate, not a matter of which controller.** Either
  settlement controller may approve a re-bill that a meter-data analyst raised — the roles that raise and
  the role that approves never overlap in this desk's roster.

### What the client sends is data, never authority

This is the one the desk keeps relearning. **Anything arriving in a request body is a claim, not a
permission.** A caller who puts a `role`, somebody else's user id as the `actor`, an `approver` of their
choosing, an `approved: true`, or a chosen `amount` into the body gets **exactly the same answer** as a
caller who sent none of it.

**Every figure that matters is recomputed from stored records at the moment of the decision.** A bill is
worked out from the stored read, the stored tariff and the stored rider rates — never from a number in the
request. A re-bill's contra is the server's own arithmetic over the stored prior bill and the re-billed
energy. An approval reads the caller's stored role from the session, not who the request says they are. A
remittance is the app's own sum of its accrual rows, not a number in the body.

### Signed out means signed out

An unauthenticated caller reads and writes nothing operational. Returning `401` for a caller with no valid
session, and `403` for a caller whose role does not reach the action, is the discipline; sending the browser
to a sign-in screen while the request behind it still returns rows is not isolation — the request itself has
to be refused.

### Forged writes are refused at the server

A hidden or missing button is a courtesy, not enforcement. Where the interface does not offer an action, the
**server** must still refuse the matching request when it is replayed directly — a re-bill approved by a
body-claimed approver, a second bill of an already-billed cycle, a re-bill against a finalized or remitted
cycle, a budget true-up before the anniversary, a bill run by a non-operator, an amount chosen in the body.
A forged write returns a `4xx` and, when the record is re-read, it is unchanged. That, not the absence of a
button, is enforcement.

### The audit trail is append-only

Everything of consequence — a bill, a true-up, an approval, a budget true-up, a remittance — is written to an
**append-only** audit trail, and each entry carries the **computed** figure it recorded. The trail can be
read; an attempt to **edit or delete** an entry is refused. Corrections in this system are additions (the
true-up supersede), never edits.

---

## 5. What the screens have to show

A person finds their way around UtiliBill by reading it. Nobody types a URL and nobody is told an element
id. Every area a role can reach is reachable from the navigation that role sees, and every action they are
allowed to take is a control on a screen — a button, a form, a menu item. **Wording, routes and ids are
yours; being able to work out what a control does from the screen is not.**

### Figures have to be on the screen

The desk argues about numbers, so **the numbers have to be visible** — not held in the database and
summarised as "calculated", and not rounded into a range. Show money as dollars and cents and rates as
percentages. Where the brief names a figure, that computed figure is what the screen must show; where it
names a plausible-wrong decoy beside it, the screen may show the decoy **only** if it is plainly marked as
not the operative figure.

**An account** must show its tariff; for a net-metering account its **bank balance** (summed from its
movement rows); for a budget account its **current levelized amount**, its **deferred balance** (summed from
the per-cycle movements), and — at the anniversary — the **settlement** and the **re-levelled amount**.

**A cycle and its bill** must show, per cycle: the read (actual or estimated) and the metered usage; the
**energy charge** (the tier split, or the TOU buckets with the peak split at the rate change); for a
net-metering cycle the **export credit**, the **energy after the credit**, and the **bank movement**; the
**fixed charge**; each **rider** (RPS, SBC, GRT) as its own line with the base it stands on; and the **grand
total** — each beside the plausible-wrong figure it is **not** (the whole-cycle-at-one-rate peak, the
rider-on-the-total reading, the credit-against-the-whole-bill reading, and so on).

**A true-up** must show, per accrual period: the **allocated usage** and the **re-billed energy** on that
period's own fresh blocks, the **superseded prior bill** (retained, its figure intact — and every earlier
generation, if this is not the period's first correction) and the **contra of the difference against the
prior bill**, and — for an over-threshold correction — that it is **held for a distinct settlement
controller's approval** and, once approved, who approved it.

**A remittance** must show the **sum of the app's own rider-accrual rows** across that period's own
finalized cycles and, once run, the persisted **remittance figure** and its acknowledgement.

**The half-open boundaries** must be visible: an interval at the rate-change instant on the new rate; a
budget account at its anniversary trues up while one before its anniversary does not.

### The screen must not offer what the rules forbid, and refusals name the figure

If a record's state means an action is not allowed, the screen should not be offering that action — and if it
is offered anyway, the **server still refuses it.** When the server refuses something, the person who tried
it sees why, on the screen, in words, and **a refusal that turns on a figure shows that figure**: a re-bill
refused on a locked cycle names the **cycle status**; a budget true-up refused before the anniversary names
the **anniversary** and the reference moment; a bill run by the wrong role names **the role**. A refusal that
only appears in a network response is one the desk will not learn from.
