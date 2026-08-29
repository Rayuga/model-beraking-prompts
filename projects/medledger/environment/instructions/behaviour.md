# How the floor works

## What the floor charges and watches

These are the figures people quote on the floor. What they add up to on any given
record — and which line of the books they land on — is the part that has burned us,
and it is the part you have to get right.

A patient **copay is $40.00**. A scan with dye carries a **$150.00 contrast
add-on**, and every scan also carries a **facility fee of a fifth (20%)**. A lab
draw runs **$50.00**, a transport run **$200.00**, and a contrast CT's base
procedure runs **$400.00**. A patient statement is the sum of the patient's charges,
against which stands the **$40.00 copay** and a standing **$50.00 courtesy
write-off**. A controlled drug costs the shelf **$30.00 a unit**.

A claim whose charge **runs past $500.00 needs prior-auth**. On the bench a **serum
potassium over 6.0 mmol/L is critical**, and so is an **INR over 4.5**. A driver
with **more than 660 on-duty minutes** (eleven hours) is over hours. A **provider
credential is lapsed once its expiry is behind the clock.** A controlled dispense
pulls its drug from the shelf **one-for-one**. The controlled book is append-only.

When the payer sends a claim back **denied**, they keep a standing **eighteen-percent
(18%) contractual allowance**. When a value goes critical on a patient the safety
office opens a **$250.00 patient-safety incident reserve**. A patient whose **past-due
statement balance runs over $600.00** is turned over to collections. A controlled
dispense worth **$150.00 or more** in drug value draws a second look from the DEA
desk. A critical-lab patient who has to be moved rides on a priority, and a priority
ride carries a **$75.00 priority surcharge**. These are the figures. What each one
does to a record — what it touches, which line it lands on, and in what order when
more than one applies — is the part you have to work out.

## The words on the chart

When the floor says why something is stuck, these are the words on the record. A
dispense that won't go reads its hold — **CRITICAL_LAB_HOLD**, **CONTROLLED_STOCK_SHORT**,
**CREDENTIAL_LAPSED**, or **COLLECTIONS_HOLD**; one pulled back after it was already
paid reads **REVERSED_AFTER_SETTLE**. A claim that won't file reads
**PRIOR_AUTH_REQUIRED**, **CONSENT_MISSING**, or **CREDENTIAL_LAPSED**; one the payer
sends back reads **DENIED** and carries the reason it bounced. A claim moves
**DRAFT → SUBMITTED → AUTHORIZED** as it clears, and a denied case that gets reworked
and re-filed comes back around to **AUTHORIZED**. A ride that won't roll
reads **RIG_GROUNDED_DVIR** or **HOS_EXCEEDED**; one called off after it's booked reads
**NO_SHOW**; one frozen by a safety hold reads **CRITICAL_LAB_HOLD**. An order or a
scan the front office freezes over money reads **COLLECTIONS_HOLD**. A panel reads
**ATTESTATION_PENDING** or **CREDENTIAL_LAPSED** while it's stuck, **OPEN** once it's
cleared to sit, and **FROZEN** once the office has locked it down. (Which of two
blockers a record names is for you to work out — the office only knows it should be
the one actually in the way.)

Upstairs the ledger keeps a line per department — **CLINIC, PHARMACY, LAB, IMAGING,
TRANSPORT, SUPPLY, BILLING, COMPLIANCE** — and every line has a kind: the money
earned (**REVENUE**), the cost of what got used up (**COGS**), a courtesy write-down
(**CONTRACTUAL_ADJUSTMENT**), the payer's kept-back allowance undoing revenue
(**CONTRA_REVENUE**), what's still owed to us (**RECEIVABLE**), what we owe back out
(**LIABILITY**), an undo of a line already posted (**REVERSAL**), a compliance memo
the DEA desk writes on a big controlled fill (**DEA_AUDIT**), the extra a priority
ride bills as its own line (**PRIORITY_SURCHARGE**), and the squaring line that ties
the books back to the shelf at a period close (**RECONCILIATION**). Amounts may be
negative. A charge, too, carries the word for where it came from — a **COPAY**, a
**LAB** draw, an **IMAGING** scan, a **DISPENSE**, a **TRANSPORT** run, a **BUNDLE** —
and two more the back office writes: a claim's amount handed back to the person who
owes it reads **PATIENT_BALANCE**, and money we owe a patient back reads **CREDIT**.
When the compliance log catches something it names it too: a hot value pinging the
ordering doctor is a **PROVIDER_ALERT**, a credential going down that locks a panel a
**CREDENTIAL_FREEZE**, and a patient going to collections a **COLLECTIONS_HOLD**. The
formal paperwork the back office mints has its own records too: a controlled fill
draws a **DEA form** with a form number, a pulled-copay refund draws a **refund**
voucher with a refund number, and a paid statement draws a **receipt** with a
receipt number.

## How the floor works

Take the rest as anecdote — war stories, not a rulebook. None of it was written as a
fault report, and none of it spells out the accounting; the accounting is what you
infer from where each one went wrong.

**Clinic.** We acted on an order written under a credential that had quietly lapsed
the week before — labs drawn, a script filled, a scan read — and none of it should
have moved. A lapse doesn't stop at the one order in front of you, either: the
quarter it bit us, a panel upstairs was still sitting open when it should have been
shut hard, and a half-drafted claim already in the drawer with that doctor's name on
it went out clean because nobody thought to go back and touch the ones already
written. When the credential comes good again the work it was holding has to be able
to move.

**Pharmacy.** A controlled script coming off the shelf has to land in more than one
place the same minute — the book that tracks the drug, the shelf count, the slip the
desk files on every controlled fill, and, past a point, a second look from the
compliance desk that a routine fill never draws. We've handed out a box the count
said we didn't have and filled one the bench should have stopped; both hurt. And a
fill isn't only money coming in — the drug was something the stockroom carried, and
that has to show for what it cost, not only what it earned. The one that stung most
was a copay we took and then had to pull: a quarter later the books still showed us
up on the deal, the patient was never made whole, the drug was never back on the
shelf, and there was no slip to show the money had gone back.

**Lab.** The bench flags the criticals. A hot value on a fill that hasn't gone is
just held — no charge, and the ordering doctor hears about it. The hard case is the
one where the fill had already gone out and billed before the value came back hot:
holding it after the fact isn't enough, and the quarter we only held it, the
department's books never came out flat and the drug we'd handed over was gone from
the count. A hot value also doesn't stay on the one fill — it puts a hold on the
patient, and the scan they were about to get and the ride they were booked on
shouldn't move while it stands. The safety office opens its incident reserve on it.
Clean one for reference: a potassium of 4.0 is normal, the fill goes, the scan goes,
the ride goes. (The hot path we learned the hard way — the quarter a patient got a
contrast scan and an ambulance ride while their potassium was 7.)

**Imaging.** A study with dye burns a bottle of contrast from the stockroom and
bills the dye on top of the scan, and there's the facility fee too — mind what the
fee is a fifth of, because the quarter we got that wrong the claim came out a few
hundred dollars off what the payer expected. A big study over the prior-auth line
waits on the auth, and mind what counts as "big": the number the payer sees on the
claim isn't the bare procedure. The bottle a scan burns is a stockroom cost like any
drug. An add-on read once came in with no base procedure of its own and still burned
its bottle — that one squared oddly until we sorted what was billable on its own and
what the fee even applied to.

**Transport.** A rig with an out-of-service defect on the walk-around doesn't roll,
and neither does a driver over hours; nobody's billed for a truck that never moved,
and anything we'd set aside for that run has to come back. A good rig rolls, burns
its oxygen off the shelf, and bills the run. A patient the bench flagged critical
goes on priority — and priority isn't the flat fare; it carries its surcharge, and
the quarter we folded that into the fare instead of standing it on its own the
transport books read wrong. A run called off after it's booked has to unwind clean —
the fare set aside, the rig, the oxygen reserved for it — the quarter we didn't, the
books carried a run that never happened.

**Central supply.** Every dispense and every scan with dye pulls from the shelf. At
count time the difference books to supply for the exact dollar gap, and a count
that's come due has to be flagged. At the period close the stockroom squares a
controlled SKU: what's on the shelf has to tie back to what it opened with and
everything that came off it, to the penny, and that squared figure books to supply. A
quarter it didn't square, one fill's draw had never been posted and nobody could
close. The shelf isn't the only book that has to tie, either — the controlled book's
running count and the physical shelf are supposed to agree, and the quarter they
didn't, the gap got booked and chased.

**Billing and claims.** A charge lands on the writing department's line. A claim
doesn't file until the paperwork's straight — the auth if it's big, the consent if we
need it — and it names whichever's still missing when both are. When the consent
comes back signed the claim goes and the money lands. A claim the payer sends back
**denied** doesn't just die: the payer keeps their contractual allowance and walks
from the rest, so what lands on the patient isn't the whole charge, the kept-back
part shows on billing's books, and the case drops back to the clinic as a rework. A
reworked case that gets straightened out and re-filed has to leave the books reading
as if the denial had been undone — not as if two separate claims had run and not with
the patient still holding a balance they no longer owe. What a patient still owes,
once the copay and the standing write-off are set against their charges, books as a
receivable. Past the line, that owed balance turns the patient over to collections —
a hold that stops their new work at the desk, the window and the reading room.
An **emergency** ride is the one thing that hold doesn't stop. When a patient finally
pays their statement, the desk cuts them a numbered **receipt**.

**Compliance, credentials and close-of-shift.** A panel opens only after the
attestation's signed and the credential's good, in that order; then the doctor
renders again and the waiting claim goes. The other way, a credential going down
shuts the panel and sweeps the doctor's open claims, as above. Consents and
attestations go out as envelopes and come back executed. When more than one thing is
standing in the way of the same record, the office names the one actually in the way,
never a guess — and a fresh safety flag and an old money hold are not the same kind
of thing. End of shift I hit **close-of-shift** and it sweeps the day's settled money
up to the ledger, ages the criticals that have sat too long, and flags the counts
that have come due; what's still fresh — a recent result, a count not yet due — it
leaves alone.

## The retired run

We used to fax a paper prior-auth packet to the payer overnight, a whole batch
job. That's gone; ignore it, don't rebuild it.
