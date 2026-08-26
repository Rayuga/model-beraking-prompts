# Interface

Routes, labels, and element ids are yours to choose. Everything has to be
findable by intent — assume nobody tells the person using it where to click.

## What the clinic expects to be able to reach

A patient home that opens as Alice Johnson, and a directory saying who the
doctors are, what they treat, and what they cost. Each doctor's own profile,
with enough detail to choose them and whatever a patient needs in order to
settle on a day and a time and pay for it. A patient's own appointments and
their own clinical notes. A doctor's own day, and the form a finished visit
gets written up in — chief complaint, diagnosis, treatment notes. A visible
control that changes which seeded user is active, with no login.

When the app turns a booking down, the patient has to be able to see that it
was turned down, and get some idea why, without leaving the booking screen.

## Checkout

Booking sends the browser to Stripe-hosted Checkout at `checkout.stripe.com`.
After a successful test payment it comes back to the app, and the patient can
tell that it worked.
