# Task: GearVault — a multi-location equipment rental counter

Build a small full-stack web app called **GearVault**. Three shop
locations — Riverside, Downtown, and Harbour Pier — share one catalog of
eighteen serialized units. Customers reserve cameras, lenses, drones,
outdoor canvas, and event kit through Stripe Checkout; the shop checks
the gear out and back in, and writes up damage against the deposit when
something comes home wrong. After pay the till posts matching copies to
the notice desk, the SMS desk, and the email desk; the fleet serial desk
confirms bay codes before serial scans; and only members receive loyalty
punches.

What a booking costs is not simply the wall card times the days. The
shop has its own week rate, the weekend desk and the county tax office
disagree about what counts as part of a hire, and the insurance bureau
bills by the day. This file is the whole brief. It is the shop talking,
not a specification and not a checklist.

`/assets/CREDENTIALS.md` covers Stripe, the shop Postgres, and the
shop-network vendor desks. `/assets/artifacts/` holds the seed JSON, the
riverside river mark, and the hire waiver PDF. Artifact money is whole
dollars; the desks and the ledger work in pennies.

Nothing in the product should need a route or an element id explained
before it can be used.

# GearVault — overview

Build a small full-stack equipment rental counter. Customers find a
serialized unit, pay the rental and deposit through Stripe's hosted
Checkout, and can look back over their own bookings and certifications.
Associates work the counter — kits go out and come back. Assessors write
up what came home damaged. A shop manager decides what of the deposit
that actually costs. A transfer clerk moves kits between the three shops
when the transfer bureau will stamp the van. A bay technician issues
serial scans. A night auditor reads the books without touching them.
An insurance liaison reads hull binds. A lot runner fetches gear but does
not drive the van.

## Shape of the app

It opens already signed in as the seeded customer **Maya Chen** — there is
no registration, login, or password anywhere in the product — and a
visible switcher moves between the seeded customers and staff. Customers
reach a unit through a catalog and a profile, pay through Stripe's hosted
Checkout, and have somewhere to find their own reservations, cards on
file, paper receipts, texts, email copies, diary holds, and the punches
on Maya's member card. Associates have somewhere to send a paid booking
out the door and take it back — the door wants a live serial scan first,
and the fleet serial desk must confirm the bay code before that scan
ticket exists. Assessors have the return in front of them. The manager
has the damage decision and the repair bay. The transfer clerk has the
move between shops, and nothing else.

## Seed accounts (first boot)

Customers:

| Name | Account | Notes |
| --- | --- | --- |
| Maya Chen | Active | Default. Current Drone Operator card through 2031-12-31. Member — the loyalty desk punches her card when a payment clears. |
| Jordan Hale | Active | Drone Operator card expired 2024-03-01. Walk-in, not a member. |
| Priya Nair | On hold | Unresolved damage balance. No drone card. |
| Chris Nguyen | Active | No cards, no rental history, no texts, no email copies, no punches. |
| Tess Okada | Active | Walk-in, not a member. No drone card. |
| Luis Ferreira | Active | Walk-in, not a member. No drone card. |

Staff:

| Name | Role |
| --- | --- |
| Sam Ortiz | Rental Associate |
| Dana Ruiz | Rental Associate |
| Riley Okonkwo | Damage Assessor |
| Jules Adeyemi | Damage Assessor |
| Elena Voss | Shop Manager |
| Noah Kim | Transfer Clerk |
| Omar Haddad | Bay Technician |
| Harper Singh | Night Auditor |
| Wei Tan | Insurance Liaison |
| Casey Bloom | Lot Runner |

Locations:

| Shop | Notes |
| --- | --- |
| Riverside Rental Center | Riverside tax window (not the same as Downtown or Pier). |
| Downtown Studio Annex | Downtown tax window. Cinema drones carry a bureau hull rider. |
| Harbour Pier Desk | Pier tax window — lower rate than the other two shops. |

Units (prefer the JSON under `/assets/artifacts/` when present — it carries
stable ids). Money fields there are whole US dollars, so `400` means
$400.00. All eighteen tags:

| Tag | Category | Shop | Rate / day | Deposit | Replacement | Works | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| K-055 | Camera Body | Riverside | $85 | $200 | $1800 | — | Available |
| L-118 | Lens | Riverside | $45 | $400 | $600 | — | Available |
| W-044 | Wireless Kit | Riverside | $65 | $180 | $950 | — | In repair |
| B-216 | Boom Pole | Riverside | $18 | $40 | $220 | — | Available |
| T-012 | Tent | Riverside | $25 | $80 | $220 | — | Available |
| D-004 | Drone | Downtown | $120 | $500 | $2500 | Drone Operator | Available |
| S-301 | PA Speaker | Downtown | $60 | $150 | $900 | — | In repair |
| X-410 | Lighting Rig | Downtown | $90 | $300 | $2200 | — | Retired |
| M-088 | Microphone | Downtown | $35 | $90 | $450 | — | Available |
| Y-300 | Lighting Rig | Downtown | $55 | $120 | $700 | — | Available |
| F-612 | Fog Machine | Downtown | $22 | $50 | $180 | — | Retired |
| G-220 | Generator | Pier | $40 | $120 | $800 | — | Available |
| R-090 | Rain Fly | Pier | $12 | $30 | $90 | — | Available |
| P-330 | Projector | Pier | $70 | $200 | $1100 | — | Available |
| C-077 | Camera Body | Pier | $50 | $150 | $900 | — | Available |
| E-015 | PA Speaker | Pier | $48 | $110 | $640 | — | Available |
| N-201 | Drone | Pier | $95 | $400 | $1800 | Drone Operator | Available |
| H-019 | Hydrophone | Pier | $28 | $70 | $320 | — | Available |

The shops do not invent tax, hull cover, weekend surcharges, weather
holds, holiday closures, paid-ticket copies, texts, email copies, diary
holds, serial scans, loyalty punches, fleet bay codes, or van moves
themselves. Those live on vendor desks on the shop network (see `/assets/CREDENTIALS.md`). Riverside, Downtown, and Pier are not the same tax office, and
that office knows the shops by the short names on the network, not the
painted signs. The Pier window charges a lower percentage than Riverside
or Downtown — a camera body quoted at the Pier with Downtown tax on the
invoice was one of the fights last fall.

What the county actually taxes is the kit line as the customer is
invoiced for it — after the week rate, with the weekend line added in —
and never the deposit or the bureau's hull rider. The week rate itself is
the shop's own: from the seventh day on one paper a tenth comes off the
kit line, six days is still full price, and the tenth never touches a
deposit or the cover. Nothing goes on one paper for more than a
fortnight. The Downtown drone carries a bureau hull rider and the Pier
one does too; a tent does not — and the bureau bills that rider by the
day, so it needs to be told how many days are on the paper. A Saturday or
a Sunday on the paper picks up the weekend desk's line, once for each
weekend day on it, so a Saturday-Sunday pair is twice a lone Saturday; a
midweek span picks up nothing.

Outdoor canvas — tent, generator, rain fly — stays in when the weather
desk already called those days unsafe; the till has to listen to that
call, not invent its own wording and send the kit anyway. The holiday
desk already knows the week the shops go dark, and when the van is idle
on those days the transfer bureau will not stamp a move; a quote that
walked past that desk still printed a Checkout URL last Christmas. The
weather desk looks at every day on the paper, not only the first. A kit
out and back the same afternoon is still a day on the invoice. Booking
dates are the calendar day on the paper, not a timestamp from whoever's
laptop.

After the card clears, the notice desk, the SMS desk, and the email desk
are all supposed to hold the same ticket, the shop diary is supposed to
show the hold, and Maya's member card is supposed to take a punch — a
paper copy without the text, a text without the email, or an email
without the punch is how last year's till got yelled at. Only members
get loyalty punches; walk-ins do not, and Chris must not show punches
when Maya paid. A Checkout nobody paid for leaves none of those behind.
Nothing leaves the bay without a live serial scan, and the fleet serial
desk must confirm the bay code before that scan ticket exists. A kit
that has come home and not yet been inspected is not on the floor:
nobody can book it and the van cannot take it. Noah is the only one the
transfer bureau will talk to, and he only moves kit that is genuinely
idle — not something already spoken for on a paid paper. Sam driving the
van on a typed stamp is how a body ended up at the wrong shop. When
Elena signs off a write-up Riley recorded as major, the kit goes to the
repair bay rather than back onto the shelf. The books themselves live on
the shop Postgres, not a local file, and they keep pennies even though
the seed cards are whole dollars.

If that directory is empty, keep the names, roles, tags, shops, rates,
deposits, replacement values, certification flags, and statuses above, and
invent stable ids.


# How the shop works

This is the shop talking about their business. It is not a specification and
it does not describe an implementation. What the software has to guarantee is
for you to work out.

## Demo users

- Seed the customers, staff, locations, units, and certifications from
  `/assets/artifacts/`. Artifact money is given in whole dollars.
- A fresh browser is already Maya Chen. A switcher changes who is using the
  app. There are no passwords.
- The switcher is there so the shop can demo the product to people.

## Booking

Customers book their own kits, in advance, and pay through Stripe before
any date is actually held.

## Notes from the shop manager

We asked the shop manager what went wrong with the binder this replaces.
She talked for the better part of an hour, poured more coffee, and this
is roughly what she said. None of it was written down as a fault report,
nobody ever established what was actually going on underneath, and in
most cases the counter never worked out how to bring it about a second
time. Take it as description rather than diagnosis. She jumped around.

The calendar was the sore point. Two people showed up for the same 70-200
on overlapping weekends — one had it through the 14th and the other was
told they could have it from the 14th — and both pieces of paper were in
the binder. Going the other way, a woman was refused a tent because she
already had a camera body that same week, as if the tent and the body
were the same physical thing, and another customer found that quoting a
single weekend on the last lens appeared to swallow every other date on
that lens; the shop manager was equally annoyed about both. Quotes also
sat in the pile and blocked real walk-ins who were ready to pay, including
at least one Checkout the customer opened and then abandoned on the train.
Bookings went through for weekends that had already started — including at
least one the system had apparently looked at and been perfectly happy
with. A Friday-to-Sunday kit went on the invoice as two days, and the
desk swears that camera is off the shelf all three.

She is strict about how long one slip can run. Nothing goes out on a
single paper for longer than a fortnight — fourteen days is the most the
binder ever allowed and she wants that line held. The lens that sat in
somebody's boot for six weeks started life as one open-ended slip that
nobody had put an end to, and she is still angry about it. Fifteen days
is not a booking; it is two bookings, and the customer can come back to
the counter for the second one.

Then she went off about Christmas. The shops were dark from the day
before Christmas through Boxing Day, and again on New Year's Eve — the
holiday desk on the shop network already had those days blocked, the
same way the weather desk already knew about the November gales — and
someone still printed a Checkout URL for a tent over Christmas week
because the till never asked. A lens on those same dark days went out
too. She said the holiday desk looks at every day on the paper, not
only Christmas Day itself; a quote that started on a clear December
afternoon and ran into the closed days was the one that made her
shout. Midweek dates in September were fine. She did not write down
the desk's address. She just kept saying "it already knew."

## What the customer actually pays

Finance stopped treating the wall-card sum as the whole Stripe total,
and they do not treat a file on the tablet as the books — they read
the shop Postgres IT already runs. The wall cards are still written in
whole dollars; the books themselves keep the pennies, and more than one
four-hundred-dollar lens deposit landed in the ledger as four dollars
because someone copied the card number across as-is.

The week rate is the part that took the longest to explain. A fortnight
on the lens came out cheaper per day than the same lens for five days,
and that is deliberate: the seventh day is where the week rate starts,
and from there a tenth comes off the kit line. Six days is still every
day at full price — she was very clear that the sixth day is not a
week — and the seventh day takes the tenth off the whole slip, not
just off the days past the sixth. The tenth comes off the kit line
only. It has never come off a deposit, and the bureau does not discount
cover because somebody hired for longer.

That matters for the county, because the county taxes what the customer
is actually being charged for the kit — the kit line the way it goes on
the invoice, after the week rate has already come off it, with the
weekend line added in, because as far as the county is concerned the
weekend money is part of the hire. Finance had a long argument with
them about that and lost. What the county does not touch is the
deposit, which is the customer's own money coming back, and it does not
touch the bureau's hull line either, which is insurance and taxed
somewhere else entirely. A drone invoice that had been taxed on the
whole bottom line, hull and deposit and all, was the one that started
the argument.

Riverside and Downtown send that line to different tax desks. Those
desks only answer to the short names on the shop network, not the
painted signs on the door, and the number that comes back is what has
to sit on the invoice — not a percentage someone typed into the
booking, and not last year's rate remembered from the other shop. A
Downtown drone invoice that looked like a Riverside weekend was one of
the fights; so was a Riverside lens quote where someone had typed the
other city into the request and Downtown tax showed up.

The insurance bureau charges a hull rider on cinema drones only, and
they bill it by the day now — a working week on the Pier drone costs
more cover than three days on the Downtown one, and the till has to
tell the bureau how many days are on the paper or the bureau will not
quote at all. Someone still managed to put a hull line on a tent, and
someone else paid the drone without the bureau ever binding the policy
because the signature on the bind did not match what the bureau had
issued.

The weekend desk counts every Saturday and every Sunday on the paper,
each one, so a Saturday-and-Sunday pair costs exactly twice what a lone
Saturday does; the old till charged one flat weekend line however many
weekend days were on the slip, and on a long hire that was money we
never billed. A paper that was only Saturday still owes that line —
the old till treated a lone Saturday like a weekday. An adjacent
Saturday-Sunday on the lens once looked like two weekday days plus tax
and deposit, and finance caught it. Midweek spans do not pick it up at
all.

## Copies, punches and the diary

The notice desk is supposed to hold a copy of every paid ticket the
moment Stripe clears, with the same kit line, tax, hull, and weekend
figures that went to Stripe — the kit line as invoiced, week rate and
all, not the wall-card sum. Chris must not be able to read Maya's
copies. The SMS desk is supposed to hold the same ticket the same
moment — same totals, same kit — and last year the till posted the
paper copy and forgot the text, or sent the text and forgot the paper,
and Maya called twice asking where her message was. Chris must not be
able to read those texts either. The email desk is the third copy
channel after pay — paper, text, and email are supposed to land
together with the same totals, and last spring the till posted the
paper and the text but forgot the email, or sent the email with the
wrong tax line from the wrong shop window. Maya had three
confirmations in her inbox from one payment and none of them matched
the Stripe receipt. Chris must not be able to read Maya's email copies
either. The shop diary is supposed to show a hold for those dates the
same moment. Maya is on the member card; when her payment clears the
loyalty desk is supposed to punch that card once for that ticket and
only for members. Jordan is a walk-in and does not get a punch. Tess
and Luis are walk-ins too. Someone once typed a punch onto Chris's
file after Maya paid, which was a whole other meeting — Chris is not a
member and must never show loyalty punches when Maya's payment cleared.

A quote nobody paid for leaves none of that behind. No paper, no text,
no email, no punch, no diary hold. The till used to post the copies the
moment somebody reached Stripe and finance spent a morning unpicking
tickets for cards that were never typed.

## Weather, the third shop, and days on the paper

November gales last year we still sent a tent to the river; the weather
desk had already called those early-November days severe, and the lens
on the same dates was fine, which made the argument worse. The till
that still printed a Checkout URL for the tent had asked the weather
desk and then ignored what the desk actually said. A tent booked from
late October into the first of those gale days still went out because
the start day looked clear. The weather desk puts a canvas hold on
outdoor canvas — tent, generator, rain fly — when those days are
severe; a Pier generator and a Pier rain fly on the same November span
were still quoted because someone treated them like indoor kit.

Riverside tax, Downtown tax, and Pier tax are three different windows
on the shop network, and the Pier window is lower than the other two. A
Pier camera body that showed up on the invoice with Downtown's
nine-and-a-half percent was the fight that made them add the third shop
to the wall cards in the first place. A kit that left and came back the
same afternoon still sat on the invoice as a day, and the old till had
treated that as free. A booking that arrived with a time and a timezone
stuck to the date landed on the wrong calendar day when someone opened
the till in another country; the same thing happened when someone wrote
the date with slashes, or left the zeros off the month.

## The money

Kits went out with no payment behind them, and those phantom holds kept
real customers off the same serial — including the unpaid draft slips the
till opened the moment someone reached Stripe, before any card was typed.
The demo chrome and the "are we up" surface are supposed to say the books
are the shop Postgres; remembering the last click is not the same thing.
One man paid once and ended up on the books twice after he refreshed the
page Stripe sent him back to. Another was charged for, and booked with, a
lens he had never chosen — he had started filling dates on the 70-200,
wandered off without paying, opened a tent instead, and the till still
billed the lens. There was also the afternoon someone half-filled a lens
bill, wandered to the tent card without submitting, and the tent Checkout
still came out as the lens. Finance separately turned up a deposit that
did not match the figure on the unit card at all — someone had somehow
paid a dollar against a four-hundred-dollar lens — and a damage bill
larger than the lens was worth, which is not how replacement works in
this shop. On more than one occasion a booking landed on the wrong
customer's record entirely — someone had typed another customer's name
into the request and the charge, and the paper, followed that name
instead of whoever was actually standing at the switcher.

She was also unhappy that a booking the system had refused still managed
to leave a mess behind — the reservation it had failed to change did not
read the way it had before the attempt.

## The counter and the bay

A paid booking is still on the shelf until an associate actually hands
the kit over, and only from the shop the booking named. Customers do
not run the check-out step — that is counter work. Someone once typed
"shop manager" onto an associate's request and the old till treated
that as a promotion. June paper that was already paid still had to go
out when Sam was at the counter — the old till had decided those dates
were "not today" and would not print a check-out. After the card
clears, the wall card is not supposed to still read as a free walk-up
— it is spoken for — but it is not out the door yet. Downtown cannot
give out a body that is sitting at Riverside. The repair bay is not a
display label: a speaker that is in pieces has gone out the door, and a
retired lighting rig has reappeared on a weekend quote more than once.
A drone that was already paid for still walked out after Elena had hung
the "in repair" tag on it that morning.

The door tablet is the part she came back to twice. Nothing is
supposed to leave the bay until the serial-scan desk on the shop
network has issued a live scan for that booking and that serial — not
a number Sam typed, not last week's ticket, not a photo-desk code
Riley uses for scratches. The fleet serial desk has to confirm the bay
code for that kit before the scan desk will issue a ticket — Sam once
typed a guess that looked like a scan code and the old till accepted
it, and Omar had to walk the floor matching stickers because the wrong
bay code had been paired with the 70-200. Omar is the bay technician;
he issues the scans and knows which bay code belongs to which tag.
The old till let Sam tick "scanned" on the tablet and walk the 70-200
out with no ticket behind it. When the wifi hiccuped the tablet
double-fired, and more than one kit has two check-out times, and more
than one return has released the same deposit twice. A scan that
already went out the door is spent; using it again on the next kit
was how the Downtown drone left on a Riverside lens ticket.

A kit that has come home but that nobody has looked at yet is not on
the floor. It is standing in the inspection corner. Twice now the
catalog has offered a body back to a customer while it was still
sitting there waiting for Riley, and once the van took one away before
anyone had opened the case. Neither of those is a thing the shop does.

Priya is not allowed to take anything new until her damage balance is
sorted; the last system still let her pay for a Saturday body. She did,
however, need to bring back the kit she already had out, and even that
turned into an argument.

Noah Kim is the transfer clerk. He is the only person the transfer
bureau on the shop network will stamp a van move for. Elena does not
drive the van. Sam does not drive the van. Riley does not drive the
van. Casey Bloom runs the lot but Casey cannot drive the van — Casey
fetches bodies to the curb; the transfer bureau will not stamp Casey.
A body that sat at Riverside showed up Downtown because Sam typed a
stamp onto the request, and Downtown then handed out a kit that the
paper said was still at Riverside. A move without a live bureau stamp
is just a story. Noah also cannot move a kit that is already spoken
for on somebody's paper — the customer is coming to the shop their
slip names, and the tent that went across town while a paid slip still
said Riverside was a morning of phone calls. He moves what is
genuinely idle on the floor and nothing else. When the shops go dark
for Christmas week the van sits idle and the bureau will not stamp a
move on those days even if Noah asks nicely — someone tried to shift a
camera on Christmas Eve and the stamp came back refused. Noah also
cannot take a customer's card, cannot hand a kit over, cannot write up
a ding, and cannot decide a deposit — someone once left him on the
associate screen and he checked a tent out by accident. Customers do
not run the transfer step either.

Harper Singh is the night auditor. Harper reads the ledger and the
vendor copies after close — reservations, receipts, texts, emails,
diary holds — and must not mutate anything. Someone left Harper on
the associate screen once and a booking went through at two in the
morning that should not have existed. Dana Ruiz is the second counter
associate; Dana works the front the same as Sam and must not book
rentals for herself any more than Sam does. Jules Adeyemi is the
second damage assessor alongside Riley. Wei Tan reads hull binds for
the insurance liaison desk and must not approve damage or check kit
out — Wei once pulled a bind that belonged to another customer's
drone and finance had to unwind it.

## Cards on file

Drones do not leave without a current Drone Operator card for the person
on the booking — not last year's card, not someone else's card, and not
a number typed into the request. Jordan's card ran out in 2024 and he
has still been offered the Downtown drone. Maya's was fine when she paid
and expired before pickup; the counter handed it over anyway. The front
desk has tried to tick an "override" box. That is not a thing this shop
does.

## Damage and the deposit

When a kit comes home it sits for inspection. Riley writes up what she
finds and proposes what to take from the deposit; Elena decides. A
write-up without a ticket the photo desk issued for that return is
just a story — a number someone typed is not a ticket, and the
old system let that through. The old system let Riley approve her own
write-up, and once two write-ups on the same return both took money. A
hundred and fifty from a four-hundred deposit should leave two-fifty
going back — not a second capture later, and not the whole four-hundred
released as well.

Riley records how bad it is as well as what it costs, and that decides
where the kit ends up. When Elena signs off something Riley has written
up as major, the kit goes into the repair bay, not back onto the shelf
— the shop is not renting out a lens a customer has just paid two-fifty
of their deposit for breaking. It is not rentable while the write-up is
still sitting there unsigned either.

A booking that is already finished keeps the rate that was paid. Changing
the card on the wall does not rewrite last month's paperwork.


## The wall and the pocket

Elena taped the little river badge from the artifacts bundle onto the
till so a customer walking in knows they are in the Riverside shop —
the same riverside river mark that sits with the seed JSON. It has to
actually show on the page, not only live in a folder. After Stripe
clears, the till is supposed to hand the customer the hire waiver that
already lives with those seed files. They download that PDF; they do
not retype it. A paragraph on the receipts page is not the waiver. The
shop diary also puts a calendar file on the phone for the paid paper,
so Maya can drop the lens dates onto her own calendar without copying
them by hand. It has to be a file the phone's own calendar app will
open — the ordinary `.ics` calendar format, downloaded, not a link and
not a block of text on the page.

## Catalog

Every unit card carries a tag, category, shop, daily rate, deposit,
replacement value, whether a certification is required, and whether the
thing is actually on the floor. Customers can read a card before they
pay.

## Data

- The shop Postgres is the record of truth. Starting the app against an
  empty ledger has to leave it usable, and starting it again must be safe.
- The shop survives being switched off. The tablet gets rebooted, the box
  loses power, the app gets restarted for an update — and when it comes
  back, every paper, every deposit figure, every unit's resting place,
  every damage decision and every line of the log is exactly as it was.
  Nothing lives only in the tablet's own memory, and nothing lives only in
  the browser. If switching it off and on again loses a paid hire or resets
  a card to its seed value, the shop has no books.
- Two taps are one act. If the same request arrives twice at the same
  moment — the counter double-clicking, two staff working the same paper
  from two tablets — the shop does the thing once. Two people cannot both
  be sold the same kit for the same days; one of them is turned away, and
  the shop does not end up holding two papers on one unit.
- The three books agree. What Stripe charged, what the shop's own ledger
  says, and what the copy desks told the customer are the same figures to
  the penny. A paper that reads one total on the receipt, another in the
  ledger and a third on the notice is a paper nobody can trust.
- Tell people enough to understand what went wrong. Do not tell them
  anything about the internals.


# Trust

## Who is asking

The switcher in the interface decides which seeded person is using the app. It
is part of the demo. A name typed into a booking request is not a
second switcher — the person on the switcher is the one on the paper.
A value that matches nobody in the shop is turned away; it does not
become Maya or anyone else. A role name typed onto the request — in
the header, the body, or the query — is not a promotion.

## What the roles are for

A customer browses units, pays for their own rentals, and reads what is
theirs. An associate hands paid kits over and takes them back. An
assessor writes up a return. A shop manager decides the deposit and the
repair bay. A transfer clerk moves a kit between shops when the
transfer bureau will stamp it, and does not do the other jobs.

## Isolation

This shop is subject to a customer-confidentiality review and cannot rely
on the good behaviour of whoever happens to be holding the browser. No
customer may learn anything about another customer's reservations,
certifications, charges, notice-desk copies, texts, or loyalty punches
through this app.

A rental associate is not a damage assessor and not a shop manager. The
person who wrote up the ding is not the person who decides what to take
from the deposit. The transfer clerk is not an associate and not a
manager — a role name typed onto the request is still not a promotion.

## Payment

Stripe holds card details; this app never does. Secrets stay on the
server and out of logs and browser code. The shop reconciles what Stripe
captured against what the unit cards say the days and the deposit cost,
and expects those figures to agree every time.

## Validation

Turn away what does not make sense before it reaches the database. A
date with a time or a timezone stuck to it, or written with slashes or
the zeros left off, is not a booking day. A span longer than the shop
allows on one paper is not a booking either. A city typed onto a
Riverside quote does not get to pick Downtown's tax office, and a
percentage, a hull figure, a week-rate discount, or a deposit typed onto
a request does not get to replace what the shop's own records and the
live desks say.


# Integration Policy

## Doing a thing once, even when the tablet asks twice

The counter's tablet drops its connection. Sam taps Confirm, the screen hangs, and
he taps it again. The customer must be charged once.

So every request that changes anything carries a ticket number the tablet made up
for that one act, and the shop keeps a book of the ticket numbers it has already
honoured. Ask again with the same ticket number and the shop hands back the very
same answer it gave the first time, word for word, without doing the thing again.
The money moves once, the paper is written once, the log gets one line.

Rules the till has learned the hard way:

- A request that changes something and carries no ticket number is refused. There
  is no "just this once" — Sam's double-charge in March is exactly what happens
  when the shop lets one through.
- The same ticket number used for a DIFFERENT act is refused too. A ticket number
  names one specific act. If it comes back attached to a different unit, different
  dates, or a different kind of request, somebody's tablet is confused and the
  shop says so rather than guessing which one was meant.
- The ticket book is per person. Two customers may happen to write down the same
  number, and neither ever sees the other's answer.
- Only completed acts go in the book. If the shop refused the request, the ticket
  number was never spent, and the tablet may fix the request and try that number
  again.
- Reading things needs no ticket number. Only acts that change something do.

The same answer means the same answer: same result, same figures, same
identifiers. Not a fresh one that happens to look similar.

## Saying who is at the counter

The tablet says who is standing at it on every single request it makes. That is
how the shop knows whose paper it is looking at, and it is not optional.

A request that does not say who is asking is not served at all. Not served as the
last person who used the tablet, not served as whoever the shop considers its
usual customer, not served as a guest — refused. The shop opening on Maya's
screen is a thing the TABLET does, by putting her on every request it sends; it
is not the counter guessing. A request naming somebody the shop has never heard
of is refused the same way.

Sam left the tablet unlocked on the counter one night and the till was read by
somebody who never said who they were. That is the hole this closes.

## Calling off a paper before it goes out

Plans change and people ring up. A customer may call off their own paid paper
themselves, but only while the kit is still on the shelf. Once the counter has
handed it over there is nothing to call off — that is a return, not a
cancellation, and the two are not the same conversation.

Calling one off puts the kit straight back on the floor for anyone else to take,
and the whole held deposit goes back — the shop never kept a penny for a hire
that never happened. Nothing is captured. Ringing twice does not release the
money twice.

It is the customer's own paper and nobody else's. Another customer must not be
able to reach it, and the counter does not call off a hire on a customer's behalf
— Sam has done it once from the wrong screen and the till took a week to explain.

## Bringing kit back from the repair bay

A unit in the repair bay does not walk back onto the floor on its own. The shop
manager puts it back, and only the shop manager. Once it is back it is ordinary
floor stock again and books like anything else.

The manager cannot pull a unit back while it is spoken for. If it is out on a
live paper or already promised to one, the answer is no until that paper is
finished.

## The book of who did what

Every decision that moves kit, money, or a customer's standing writes a line in
the shop's own log: who did it, what they did, which record it touched, and what
the record looked like before and after. Confirming a paper, calling one off,
handing kit over, taking it back, clearing an inspection, filing damage, putting
a unit into the bay or back out of it, retiring one, changing a wall card, and
putting a customer on hold all leave a line.

The log is read by the shop manager and by the night auditor, and by nobody else
— not the counter, not the assessors, and certainly not customers. It is a
record, not a workspace: reading it never changes it.

## Shop Postgres

Finance reads the shop Postgres — not a file the tablet happened to write,
and not anything sitting in the browser. How to reach it is in
`/assets/CREDENTIALS.md`.

- Create the schema and seed rows at startup, and make starting up safe to
  repeat.
- Artifact money is whole dollars. The ledger stores the pennies.
- Browser storage may remember which demo user is selected, and nothing else.

## Stripe Checkout

Stripe is the card rail.

- Use the official Stripe server SDK, and create hosted Checkout Sessions on
  the server.
- The browser has to end up on Stripe's own Checkout page
  (`checkout.stripe.com`) and return to the app afterwards.
- Stripe is the authority on whether the customer paid. What appears on that
  session has to be the shop's own kit line and deposit **plus** whatever the
  live vendor desks returned for tax, the hull rider when it applies, and
  any weekend surcharge the weekend desk already knows about. The kit line
  that reaches Stripe is the line the customer is invoiced — the shop's week
  rate has already come off it — and the figure the tax desk is asked about
  is that same line with the weekend money added, never the deposit and
  never the hull.
- Use test credentials only, with the Stripe test card `4242 4242 4242 4242`.

## Shop-network vendor desks

The counter is not allowed to invent county tax, hull cover, weekend
surcharges, severe-weather calls, holiday closures, paid-ticket copies,
texts, photo tickets, diary holds, serial scans, loyalty punches, or
van-move stamps. Those desks already run on the shop network. How to
reach them is in `/assets/CREDENTIALS.md`.

The shop expects the live desk to be asked at quote time, not a remembered
percentage or a number the browser sent. The tax desk wants the shop's
short network name, not the painted sign, and it wants the amount to be
taxed in pennies. The bureau wants to know how many days are on the paper
before it will quote hull cover, and the weekend desk wants the whole
range so it can count each weekend day on it. Booking dates on those desks are calendar days — a time or
a timezone stuck to the date is not a day on the paper. If a desk turns
the request down — weather, a dark holiday week, a missing token — the
booking does not go to Stripe. Nothing at all is posted to the copy
desks, the diary, or the loyalty desk until Stripe says paid. After
Stripe says paid, the notice desk and the SMS desk and the email desk
and the shop diary are supposed to have matching copies, including the
weekend line when there is one,
Maya's member card is supposed to take a punch, and a drone hull
bind is supposed to carry the bureau's signature. A kit does not leave
the bay without a live serial scan. A kit does not change shops
without a live transfer-bureau stamp.

## Scope

One application container, the shop Postgres, Stripe's public API, and the
shop-network vendor desks. Do not use Supabase or other hosted databases.

## Environment

Required variables are `STRIPE_SECRET_KEY`, `PORT`, `BASE_URL`,
`DATABASE_URL`, and the vendor desk settings in `/assets/CREDENTIALS.md`.
`STRIPE_PUBLISHABLE_KEY` may be present but is not required for redirecting to
server-created hosted Checkout. Secret values must never reach browser code or
logs.


# Interface

Routes, labels, and element ids are yours to choose. Everything has to be
findable by intent — assume nobody tells the person using it where to click.

## What the shop expects to be able to reach

A customer home that opens as Maya Chen, and a catalog saying which units
exist, what they are, which shop they sit at, what they cost per day, and
what the deposit is. After a card has been charged, that unit's card
should no longer read like a free walk-up. Each unit's own card, with enough detail to choose
it and whatever a customer needs in order to settle on a start day and an
end day and pay — including a live look, before they go to Stripe, at the
kit line they will actually be charged, the week rate when it has come
off, tax, hull, and the weekend line. A customer's own reservations, their own
certifications, the paid-ticket copies the notice desk kept for them,
the texts the SMS desk kept, the punches on a member card, the
shop-diary holds, and any hull-bind copies the insurance bureau kept.
An associate's counter: paid bookings, a live serial scan, then
check-out, then return.
An assessor's inspection of a returned unit — clear it, or write up
damage with a proposed deduction. A manager's decisions on those
write-ups, on putting a customer on hold or taking them off, and on
sending a unit to repair or retiring it. The manager can also change
the figure shown on a unit's card. A transfer clerk's move between
the two shops, only after the transfer bureau stamps it. A visible
control that changes which seeded user is active, with no login.
The riverside river mark from the artifacts bundle has to be visible
on the live page — an image a customer can see, not a file sitting in
a folder. After a card has been charged, the customer's own reservations
surface has to let them download the hire waiver PDF that already lives
with the seed files, and put a calendar file on the phone for those dates —
an `.ics` the phone's calendar app opens, covering the hire dates.

When the app turns a payment or a check-out or an approval down, the
person in front of it has to be able to see that it was turned down, and
get some idea why, without leaving the screen they were on.

## Checkout

Booking sends the browser to Stripe-hosted Checkout at `checkout.stripe.com`.
After a successful test payment it comes back to the app, and the customer
can tell that the dates are actually held.


# Coding policy

## Tech stack

- One Node.js process serving the web UI and API on port **3000**, listening
  on `0.0.0.0`.
- The shop Postgres in `/assets/CREDENTIALS.md` as the system of record
  (no Supabase, no local file ledger, no browser storage as the books).
- Official Stripe server SDK and Stripe-hosted Checkout.
- The shop-network vendor desks in `/assets/CREDENTIALS.md` for tax, hull
  insurance, weekend surcharge, weather, holiday closures, notices, texts,
  photo tickets, the diary, serial scans, loyalty punches, and van moves.

## Dependencies

`express` and `stripe` are available under `/opt/gearvault-deps/node_modules`,
along with whatever else the image preinstalled for talking to Postgres and
doing calendar-day / cent math. Reuse those if you want; otherwise install
what you need into `/app`. The container has outbound network access.
`package.json` must expose a working `"start"` script.

## Demo identity

- A fresh browser defaults to Maya Chen.
- A clearly labeled user switcher changes the active seeded identity.
- Document how identity works in `APP_MANIFEST.md`.

## Deliverables

### `APP_MANIFEST.md`

Place this at the project root next to `package.json`. Include:

1. A fenced start command tagged `bash start`.
2. How demo identity works.
3. The main HTTP endpoints you chose.
4. How the shop Postgres is reached.

Example:

```bash start
npm start
```

## Environment safety

- Never run `pkill -f node` or `killall node` — they can kill the agent
  session. Stop only the server PID you started.
- Read Stripe credentials from the environment. Never expose secret keys to
  the browser.
