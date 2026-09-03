# ExpenseFlow rules

These are the authoritative rules for ExpenseFlow, the corporate travel & expense (T&E) reimbursement
back office. They are relocated, topic by topic, from the desk's own working notes. Follow them exactly —
where a value here differs from a request body or a UI guess, the value here wins.

---

## 1. What you are building

ExpenseFlow is the corporate travel & expense (T&E) reimbursement back office of a multinational
employer. Employees travel and incur costs in foreign currency against projects funded from several
cost centers; a back-office proxy files their **expense reports**, and before a cent is reimbursed the
desk **adjudicates** each report — converts every foreign line, disallows what breaches policy, prorates
the meals per-diem, and accrues the reclaimable tax — then an approver signs it at their **amount tier**,
finance **posts** the reimbursement split across cost centers, and a rejected receipt is **clawed back**.
It is one web application: a server, a database that survives a restart, a sign-in, and a set of screens a
submitter-proxy, an approver, a finance officer and an auditor all work from.

The hard part is not any single screen. It is that a foreign transaction date, a stored daily FX rate, a
policy cap, a per-diem window, a reclaimable-tax base, a cost-center allocation and a rejected receipt all
have to agree about the same reimbursable at the same moment — and they collide in ways this desk has
learned about the expensive way. Sections 2 and 3 below are where those lessons are written down.

### The people who use it

Every user has exactly one role. All accounts use the password `ExpenseFlow!2026`, and identity comes
from the session the server issued — never from anything a request body claims.

| User | Sign-in | Role |
|---|---|---|
| `USR-PROXY` Dana Ortiz | `dana.ortiz@expenseflow.example` | Submitter-proxy |
| `USR-APPR-MGR` Ken Iyer | `ken.iyer@expenseflow.example` | Approver (manager tier, limit $800.00) |
| `USR-APPR-DIR` Ravi Anand | `ravi.anand@expenseflow.example` | Approver (director tier, limit $2,500.00) |
| `USR-APPR-CTL` Mona Feldt | `mona.feldt@expenseflow.example` | Approver (controller tier, limit high) |
| `USR-FIN` Lena Poole | `lena.poole@expenseflow.example` | Finance |
| `USR-AUDIT` Sam Ndlovu | `sam.ndlovu@expenseflow.example` | Auditor |

The roles are not decoration, and two of them exist so that **two different people** have to touch the
same reimbursement:

- **Submitter-proxy** files and edits expense reports on employees' behalf; **cannot** approve or post.
- **Approver** approves a report at their **amount tier**, and **may not approve a report they filed**.
- **Finance** adjudicates a filed report, posts the cost-center split, and processes a rejected receipt.
- **Auditor** reads the append-only audit trail; it changes nothing.

There are **three** approvers on purpose, each carrying a different tier limit, so the tier a report needs
depends on the report — not on who happens to sign it. What each role reaches, and what it may never
reach, is in section 3 (Trust and isolation).

### How to read this brief

The brief is the desk talking in its own words. **Every rate, cap, threshold, FX quote, allocation, tier
bound, rounding mode and boundary convention the desk runs on is written down** — here and in the seed
roster. What is **not** written down is **which of those rules collide, on which base each rate sits, and
in what order the reimbursement spine composes them.** That is the part the desk had to learn, and it
learned all of it the hard way. Working out the collisions is the task.

Nothing in the product is graded on the spelling of a route, a field, an element id, a button label or a
status word — those are all yours. What is graded is what the system **does** and what it **shows** on a
screen. Record the choices you made in `APP_MANIFEST.md` at the app root.

### The framing rule

> Every number is stated. Which numbers collide, on which base, and in what order they apply, is not.

A build that reaches for the obvious base, the obvious order, gets a plausible-looking wrong answer at
nearly every step: it pays a single FX rate across the report, caps the foreign figure instead of the
converted one, gives a full per-diem for each calendar day, reclaims tax on the whole report, splits with
three independent percentages that do not tie out, or claws back the claimed amount rather than what was
reimbursed. The screens carry the plausible-wrong figure beside the operative one, plainly marked, so the
desk can see which is which.

### Every rate here is SYNTHETIC

Every FX quote, cap, per-diem, mileage rate, tax rate, allocation and tier bound below is **this desk's
own contract constant**, chosen for this business. **Do not substitute a real-world number in its place** —
no market FX quote, no statutory per-diem table, no published mileage rate, no national VAT rate. The
figures deliberately differ from any real-world analogue, and a build that reaches for a "realistic" number
will be wrong. There is no live FX feed and no live bank: the FX table is a seeded, deterministic twin.

### The moment the system stands at

Every timestamp in the seed is an ISO instant in UTC. **The system carries one stored reference moment,
`2026-03-05T09:00:00Z`, and every date rule compares two stored timestamps** — a line's stored transaction
date against the seeded FX daily table, and a report's stored trip window against the six-hour per-diem
grid. **Nothing reads the operating system's clock.** No rule depends on the day the app happens to be
run, and there is no test clock to wind forward.

### How the desk writes numbers down

Every stored figure is an **integer**. There is no floating point in any figure that matters.

| Quantity | Stored as | Shown as |
|---|---|---|
| Money | **cents** (`1200` is $12.00) | dollars and cents, `$12.00` |
| Percentage / allocation | **basis points** (`2500` is 25.00%, `3000` is 30.00%) | a percentage |
| FX rate | **ten-thousandths** (`12500` is 1.2500) | a decimal rate |
| Miles | whole miles | miles |

The **home currency is USD**. Round **half-up**, and round **once**, at the point the rule names — never
at an intermediate step. `round_half_up(x) = floor(x + 0.5)`. Every window in the system is **half-open**
`[start, end)`.

### The seed roster

The starting data loads from `/assets/` exactly as written, with the ids as given — do not invent parallel
ids for anything the roster already names. It carries the six accounts above; three employees; nine cost
centers with their budgets and prior committed rows; a seeded EUR/USD daily FX table; and six expense
reports with their line items, trip windows and allocations. Each report is named for the trap it sets:
**R-1001** (the Berlin summit) exercises the whole FX -> cap -> tax -> split spine and its clawback;
**R-1002** the computed-amount approval tier; **R-1003** the exact-on-cap boundary; **R-1004** (the Zurich
renewal) a **second, independent** receipt rejection on the same report — its cost centers, CC-THETA/
CC-IOTA/CC-KAPPA, exist for no other report, so nothing about this report's numbers depends on what any
other report does; **R-1005** the separation-of-duties rule (it was filed by an approver); **R-1006** (the
logistics review) sits above the controller line and, like R-1004, is never touched by any workflow except
its own — it exists to prove the tier gate refuses an under-tier approver, and a forged approval body, on a
report that has not moved past adjudication.

---

## 2. How the desk actually runs

What follows are field notes and complaints from the finance officer's desk, the approvers' desks and the
submitter-proxy's. Nobody on that side worked out exactly how most of these things happened. The notes are
what people saw, not a specification and not a diagnosis.

Every rate, cap, threshold, rounding mode and boundary convention this desk runs on is written down here,
in section 3 below, or in the seed roster. What is **not** written down is which of them collide, on which
base, and in what order. That is the part the desk had to learn, and it learned all of it the expensive
way.

### 2.0 Every window in this business is half-open

Start with the convention that decides the most arguments, because the controller had to write it on the
wall.

**Every window in ExpenseFlow runs from its start up to but not including its end.** A six-hour per-diem
block covers its start instant up to, but not including, its end instant; a trip that ends at the top of a
block does not earn that block. A daily FX rate applies from its own date up to, but not including, the
next day's rate.

> "A trip came back at noon and someone billed the afternoon per-diem block as well, because the return
> was 'on' it. The block runs from noon up to six — noon itself is the last instant of the morning block,
> not the first of the afternoon one."

### 2.1 Adjudication converts, then caps, then accrues the tax — in that order

A filed report is not reimbursed on the employee's say-so. Finance **adjudicates** it first: every line is
converted to the home currency, checked against a policy cap, and the reclaimable tax is accrued. The
order these compose in is the whole game, and it is not written down — only the individual rules are.

**The FX conversion reads the line's own transaction date.** Each line carries a **claimed amount in its
currency** and a **transaction date**. A foreign line converts at the **stored daily FX rate for that
line's own transaction date** — read from the seeded FX table, which carries a different rate on each
date. It is never one rate for the whole report and never the report's submission-date rate.

> "One report had three lines on three different days, and someone converted all three at the day the
> report was keyed. Every foreign line was off. The rate you convert a line at is the rate on the day the
> money was spent, not the day the paperwork landed."

`home_cents = round_half_up(foreign_cents x rate / 10000)`, rounded once at the conversion. A home-currency
line does not convert. **If a line's transaction date is absent from the table, use the most-recent prior
stored rate** (all seeded lines fall on rate-present days, but state the rule so no line is ungradeable).

**The policy caps bite the CONVERTED base.** Once a line is in the home currency, a **policy cap** may bite
it. Section 3 states each cap. A cap is stated in the **home currency** and bites the **converted** amount
— never the foreign figure. Where a line is over its cap, the excess is **disallowed** and the line
reimburses the cap; where it is at or under its cap, it reimburses in full.

> "A foreign hotel line was capped against the foreign figure, so a cap stated in dollars was compared to a
> number of euros. It bound on the wrong line and freed the wrong one. Convert first; the cap is a dollar
> cap on the dollar amount."

**A disallowed-excess record is minted only where the excess is positive.** Each binding cap mints a
**disallowed-excess record** for the amount over the cap. A line that lands **exactly** on its cap
reimburses the cap and mints **no** disallowance record — not even a $0.00 one. A line under its cap mints
nothing either.

> "A line came in exactly on the nightly cap and the system wrote a zero-dollar disallowance anyway. The
> auditors kept asking what had been disallowed, and the answer was nothing. Don't mint a record for an
> excess that isn't there."

**The reimbursable is summed from the line records.** A report's **reimbursable** is the **sum of its
lines' post-conversion, post-cap reimbursable amounts**, and its **disallowed total** is the **sum of the
line disallowance records**. Neither is a stored scalar, and neither is the claimed total. The two together
reconcile to the claimed-converted total.

### 2.2 The reclaimable tax is a separate accrual on the eligible, post-cap base

Adjudicating a report also accrues **reclaimable VAT** — a receivable from the tax authority, distinct from
what the employee is paid. It sits on the **eligible-category, post-cap base only** (section 3 names the
eligible categories and the rate). It does **not** reduce the employee reimbursement.

> "Someone reclaimed tax on the whole report, including the airfare and the car and the disallowed hotel
> nights. We were claiming back tax on money we never spent and on categories that carry none. The reclaim
> sits on the eligible categories, on what we actually reimbursed, not on what was claimed."

The accrual is minted **together** with the line records at adjudication. A build that adjudicates a report
but mints no tax accrual has left the record set incomplete. The accrual is a **line-level** contribution
before it is a report-level total: a screen that shows only the aggregate accrual, with no per-line
contribution, has not actually shown where the number came from.

### 2.3 An approver signs at their amount tier — on the computed reimbursable

Once adjudicated, a report is **approved** by an approver whose **amount tier** covers it (section 3). The
tier is decided by the **server-computed reimbursable**, not the claimed total.

> "A report claimed three thousand and change, so it went to a controller — but the caps had brought it
> under the director ceiling and a director could have signed it. And the reverse: a small-looking claim
> that a rebate had actually pushed up. The tier follows the number we will reimburse, which is the number
> the desk computes, not the number on the receipts."

An approver below the required tier is **refused**, and the refusal **names the tier and the figure**. An
approver may **not** approve a report **they filed** (section 3).

### 2.4 Finance posts the cost-center split, and the plug absorbs the residual

An approved report is **posted** by finance, which splits the reimbursable across the report's **cost
centers** by a stated allocation and mints a **commitment** on each. Section 3 states the allocation and
which center is the **residual plug**.

> "Three cost centers, three percentages, three independent roundings — and the three commitments came to a
> cent more than the reimbursable. The statement never tied out. One center is the plug: it takes whatever
> is left after the others, so the three always sum to the reimbursable exactly."

Posting also moves each center's **headroom**. Posting an already-posted report a second time commits
nothing further — the desk has exactly one payout per report, and a duplicate post (or a forged replay of
one) changes nothing about what is already on file.

**The headroom is summed from the rows.**

> "Every cost center carries a running headroom figure. Nobody updated it after a posting, and the budget
> report went out with the old number."

**A cost center's headroom is its budget minus the SUM of its LIVE commitment rows** — the prior committed
rows plus anything just posted. There is a stored running headroom on the cost-center record, but it is
**not** the authority; it is a convenience that goes stale, and the headroom the screen shows must be the
one summed from the rows.

### 2.5 A rejected receipt is clawed back by addition, never edit

When a receipt is later found invalid, finance **rejects** it, and the desk unwinds the money by
**addition, never edit**.

> "We found a hotel receipt was forged after we'd already reimbursed it. Someone opened the commitment
> rows and typed the new numbers in. The auditors asked what the commitments had originally said and there
> was no record they had ever said anything else."

Rejecting a receipt on a **reimbursed** line:

- **Supersedes** the report's **currently live** commitments — the ones on file *right now*, whatever
  generation they are — the originals stay on file, marked superseded, with their figures intact;
- **Re-derives** the split on the **reduced** reimbursable (the report's *current* live total less the
  rejected line's reimbursed amount) and mints fresh netted commitments;
- Posts a **contra** that **restores** each center's headroom to the re-derived figure;
- **Reverses** that receipt's VAT reclaim (a negative accrual — you cannot reclaim tax on an invalid
  receipt);
- Raises an **employee recovery** for the **post-cap reimbursed** figure the desk actually paid — not the
  claim, and not the disallowed slice.

Rejecting a receipt on a line that was **fully disallowed** (reimbursed nothing) claws back **nothing** —
no contra, no recovery, no headroom movement. There is nothing to recover.

> "Someone rejected an entertainment receipt we had never reimbursed and the system raised a recovery
> against the employee for money we had kept. You cannot claw back what you never paid."

**A report can have more than one receipt rejected, one after another.** Nothing about the rule above is a
one-time affair: it names "the report's currently live commitments" and "the current live total," not "the
original commitments" or "the report's original total," precisely so that a second rejection — on a
*different* line, after the first rejection has already been posted — reads the state the first rejection
actually left behind and nets against *that*, not against where the report started. The second contra, the
second VAT reversal and the second recovery all compound on top of the first; they do not each compute
against the untouched original as if the other had never happened. The superseded commitments pile up
generation over generation — an original superseded by a once-rejected figure, itself later superseded by a
twice-rejected figure — and every generation stays on file with its own figure intact.

> "The second rejection on that report used the number from before the first one, because that was the
> number someone remembered. The books were short by exactly what the first rejection had already freed."

### 2.6 The audit trail is append-only

Every adjudication, approval, posting and rejection goes to an **audit trail**, and that trail is
**append-only.** Each entry carries the **computed** figure it recorded — the reimbursable, the disallowed
total, the tier, the recovery. The trail can be read; an attempt to edit or delete an entry is refused.
Corrections in this system are always additions, never edits (the clawback supersede in section 2.5 is the
model).

---

## 3. The reimbursement policy

This is the money spine, and it is where the arguments cost the most. Every rate below is stated; **which
base each sits on, and in what order adjudication composes them, is not** — that is the part the desk
learned the hard way. **All rates here are this desk's own SYNTHETIC contract constants and deliberately
differ from any real-world FX quote, per-diem table, mileage rate or statutory tax rate; do not assume a
market-standard number in their place.**

### The FX daily table (a seeded, deterministic twin)

There is no live FX feed. Foreign lines convert against a **seeded EUR/USD daily table**, keyed by date,
with **half-open day windows**:

| Date | EUR/USD rate |
|---|---|
| 2026-03-02 | **1.2000** |
| 2026-03-03 | **1.2500** |
| 2026-03-04 | **1.1500** |

- A foreign line converts at the rate for its **own transaction date**: `home_cents =
  round_half_up(foreign_cents x rate / 10000)`, rounded **once**.
- A transaction date **absent** from the table uses the **most-recent prior stored rate**.
- A home-currency (USD) line does not convert.

### The policy caps (stated in the home currency, on the converted base)

| Cap | Value | Applies to |
|---|---|---|
| **Lodging nightly cap** | **$650.00 per night** | lodging (× the line's number of nights) |
| **Airfare economy cap** | **$620.00** | airfare |
| **Meals per-diem** | **$84.00 per full day = $21.00 per half-open six-hour block** | meals |
| **Mileage rate** | **$0.57 per mile** | mileage (reimbursable = miles × rate; no cap) |
| **Non-reimbursable categories** | **entertainment** | disallowed **in full** |

Each cap is a **home-currency** figure and bites the **converted** amount. Where a line is over its cap,
the excess is **disallowed** and the line reimburses the cap; at or under the cap, it reimburses in full;
**exactly on** the cap, it reimburses the cap and mints **no** disallowance record.

**The meals per-diem prorates over half-open six-hour blocks.** The entitlement is `$21.00 ×` the count of
half-open blocks `[00,06)/[06,12)/[12,18)/[18,24)` that the stored trip window `[depart, return)`
overlaps. The blocks are counted **inside the stored trip interval only** — no "now", no wall clock. A
full-day reading, or one that counts the return-edge block inclusively, over-entitles.

### The reclaimable tax

| Rule | Value |
|---|---|
| **VAT reclaim rate** | **25.00% inclusive** — the reclaimable tax is the *included* tax = base × **1/5** |
| **Eligible categories** | **lodging** and **meals** only |

The reclaim is a **receivable** accrued alongside the reimbursement; it **does not reduce** what the
employee is paid. **What is left open — and is the crux — is the base it sits on.** The candidates are:

- the **eligible-category, post-cap** reimbursable (lodging + meals, after the caps); or
- the whole report; or the **pre-cap** eligible converted amount; or the rate applied **exclusively**
  (25.00% of the base) rather than as the **1/5 inclusive** reclaim.

State your reading on the screen — the plausible-wrong figure belongs there too, plainly marked as not
operative, because someone will ask why they differ. Show it **per line**, not only as a report-level
total, because the line is where the base actually sits.

### The approval tiers (on the computed reimbursable)

| Tier | Covers a computed reimbursable of |
|---|---|
| **Manager** | up to **$800.00** |
| **Director** | up to **$2,500.00** |
| **Controller** | **above $2,500.00** |

The tier a report needs is decided by the **server-computed reimbursable**, not the claim. An approver
carries an **approval limit**; they may approve a report only if their limit covers the computed
reimbursable, and the refusal of an under-tier approver **names the required tier and the figure**.

### The cost-center split

The reimbursable splits across the report's cost centers by a stated allocation, and **one center is the
residual PLUG**:

| Cost center | Share | Role |
|---|---|---|
| **CC-ALPHA** | **50%** | **residual plug** |
| **CC-BETA** | **30%** | allocated |
| **CC-GAMMA** | **20%** | allocated |

(The other reports split across other cost-center groups on the same 50/30/20 shape, always with one
center named the plug — the roster states each report's own group and which of its centers plugs.)

- The **non-plug** shares round **half-up**: `round_half_up(total × share_bp / 10000)`.
- The **plug** center absorbs the **residual**: `plug = total − Σ(non-plug shares)`, so the commitments
  sum to the reimbursable **exactly**. Rounding the plug independently conjures a phantom cent.

Each center's **headroom** is `budget − Σ(its LIVE commitment rows)` — the prior committed rows plus
anything posted — never the stored scalar.

### The clawback recompute (the canonical path)

Rejecting a receipt on a **reimbursed** line follows one deterministic path: **re-derive the full split on
the reduced reimbursable** (the report's *current live* total − the rejected line's reimbursed amount) →
**supersede** the report's *currently live* commitments and mint the fresh netted ones → post a **contra**
that restores each center's headroom → **reverse** that receipt's VAT reclaim → raise an **employee
recovery** for the **post-cap reimbursed** figure. Rejecting a **fully-disallowed** line (reimbursed $0.00)
claws back **nothing**. Where a report has **more than one** rejection over its life, each one repeats this
same path against whatever the **previous** rejection actually left live — the second nets against the
first's result, not against the report's original total, and both generations of superseded commitments
stay on file with their own original figures.

### Rounding and units

Money is **integer cents**; percentages and allocations are **integer basis points** (`2500` is 25.00%);
FX rates are **integer ten-thousandths** (`12500` is 1.2500). Round **half-up**, and round **once**, at
the point each rule names — `round_half_up(x) = floor(x + 0.5)`. Every window is **half-open** `[start,
end)`.

---

## 4. Trust and isolation

### Identity

Sign-in is by email and password; every seeded account uses the password `ExpenseFlow!2026`. **Identity
comes from the session the server issued and from nothing else.** Every protected read and every write
resolves the caller from that session cookie, and every decision is recomputed from stored records at the
moment it is made.

### Roles reach their own areas

Every user has exactly one role, and each role's navigation opens onto its own areas.

| Role | What it does |
|---|---|
| **Submitter-proxy** | files and edits expense reports on employees' behalf |
| **Approver** | **approves** a report at their **amount tier** |
| **Finance** | **adjudicates** a filed report, **posts** the cost-center split, **rejects** a receipt |
| **Auditor** | reads the append-only audit trail — and changes nothing |

Two rules sit **on top of** the areas, and neither is a matter of seniority:

- **Only finance may adjudicate, post, or reject a receipt.** Only an approver may approve. A proxy files
  and edits reports and may do none of the above.
- **Nobody approves their own work.** The approver who signs a report must be a **different person** from
  the proxy (or approver) who **filed** it. The refusal names both people. (One of the reports was filed
  by an approver precisely so this rule can be exercised.)

### The amount tier is the server's, not the body's

An approver may approve a report only if their **approval limit** covers the **server-computed
reimbursable**. The tier a report needs is the server's own arithmetic over the stored line postings — not
a tier, an amount or an approver named in the request. A body that claims a lower amount to slip under a
tier gets **exactly the same answer** as one that claims nothing: the server uses its own computed figure,
and an under-tier approver is refused with the required tier and the figure named.

### What the client sends is data, never authority

This is the one the desk keeps relearning. **Anything arriving in a request body is a claim, not a
permission.** A caller who puts a `role`, somebody else's user id as the `actor`, an `approver` of their
choosing, a `tier`, or a chosen reimbursable `amount` into the body gets **exactly the same answer** as a
caller who sent none of it.

**Every figure that matters is recomputed from stored records at the moment of the decision.** A report's
reimbursable is worked out from the stored line postings, the stored FX table, the stored caps and the
stored allocation — never from a total in the request. An approval reads who the stored filer is and what
the caller's stored role and limit are, not who the request says they are. A clawback's netted figures are
the server's own arithmetic over the stored commitments, not numbers in the body.

### Signed out means signed out

An unauthenticated caller reads and writes nothing operational. Returning `401` for a caller with no valid
session, and `403` for a caller whose role does not reach the action, is the discipline; sending the
browser to a sign-in screen while the request behind it still returns rows is not isolation — the request
itself has to be refused.

### Forged writes are refused at the server

A hidden or missing button is a courtesy, not enforcement. Where the interface does not offer an action,
the **server** must still refuse the matching request when it is replayed directly — a report approved by
an under-tier or body-claimed approver, an approver approving a report they filed, a second post of an
already-posted report, an adjudication or posting by a non-finance caller, a receipt rejected on a
never-reimbursed line, a reimbursable `amount` chosen in the body. A forged write returns a `4xx` and, when
the record is re-read, it is unchanged. That, not the absence of a button, is enforcement.

### The audit trail is append-only

Everything of consequence — an adjudication, an approval, a posting, a receipt rejection — is written to an
**append-only** audit trail, and each entry carries the **computed** figure it recorded. The trail can be
read; an attempt to **edit or delete** an entry is refused. Corrections in this system are additions (the
clawback supersede in section 2.5), never edits.

---

## 5. What the screens have to show

A person finds their way around ExpenseFlow by reading it. Nobody types a URL and nobody is told an element
id. Every area a role can reach is reachable from the navigation that role sees, and every action they are
allowed to take is a control on a screen — a button, a form, a menu item. **Wording, routes and ids are
yours; being able to work out what a control does from the screen is not.**

### Figures have to be on the screen

The desk argues about numbers, so **the numbers have to be visible** — not held in the database and
summarised as "calculated", and not rounded into a range. Show money as dollars and cents, FX rates as
decimals, and percentages as percentages. Where the brief names a figure, that computed figure is what the
screen must show; where it names a plausible-wrong decoy beside it, the screen may show the decoy **only**
if it is plainly marked as not the operative figure.

**An adjudicated report** must show, per line: the category, the currency and claimed amount, the
**transaction date and the FX rate used** with the **converted** home-currency amount, the **binding cap**,
the resulting **reimbursable** and **disallowed excess** for the line, and that line's own **VAT-reclaim
contribution** where its category is eligible — with a line landing exactly on its cap showing its
reimbursable and **no disallowance**. The **report reimbursable total** and the **disallowed total** must
both be shown, each visibly the **sum of the line records**.

**The meals per-diem** must show the **entitlement** it computed (the block count × the block rate) beside
the plausible-wrong full-day figures it is not.

**The reclaimable tax** must show, per eligible line, the **VAT-reclaim contribution** on that line's
**post-cap** reimbursable, and the report-level **VAT-reclaim accrual** they sum to, beside the
plausible-wrong bases (the whole report, the pre-cap eligible, the exclusive rate), marked as not operative
— and it must be clear the reclaim is a **receivable**, not a deduction from the employee reimbursement.

**An approval** must show the **tier the report needs** (on the computed reimbursable) and who approved it,
and a refusal of an under-tier approver must name the **required tier and the figure**.

**A posting** must show the **cost-center split** — each center's commitment, with the **residual plug**
absorbing the residual so the three sum to the reimbursable exactly (the phantom-cent figure shown beside
it, marked as not operative) — and each center's **headroom summed from its live commitment rows**, with
the stored scalar beside it, marked as not the operative headroom.

**A rejected receipt** must show **both** commitment states — the **original, marked superseded, with its
figure**, and the **fresh netted commitment** — the **contra** that restored the headroom, the **VAT
reversal** and the **net** reclaim after it, the **employee recovery** at the reimbursed figure, and the
report's **net reimbursable** after the clawback. Rejecting a fully-disallowed line must show that
**nothing** was clawed back. **Where a report has had more than one receipt rejected**, every superseded
generation must still be shown — not only the most recent original — each with its own figure, and the
current live commitment must be the one the screen treats as operative.

**A cost center** must show its **budget**, its **headroom** (summed from live rows), and its **commitment
rows** (prior, live and superseded, across every report that has ever posted to it).

### The screen must not offer what the rules forbid, and refusals name the figure

If a record's state means an action is not allowed, the screen should not be offering that action — and if
it is offered anyway, the **server still refuses it.** When the server refuses something, the person who
tried it sees why, on the screen, in words, and **a refusal that turns on a figure shows that figure**: an
approval refused for tier names the **required tier and the computed reimbursable**; an approval refused for
separation of duties names **both people**; a duplicate post names the **report already posted**; a
receipt rejected on a never-reimbursed line names the **line and its $0.00 reimbursed**. A refusal that
only appears in a network response is one the desk will not learn from.
