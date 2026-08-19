# How the clinic works

This is the clinic talking about their business. It is not a specification and
it does not describe an implementation. What the software has to guarantee is
for you to work out.

## Demo users

- Seed the three doctors and three patients from `/assets/artifacts/`. Artifact
  doctor fees are given in whole dollars.
- A fresh browser is already Alice Johnson. A switcher changes who is using the
  app. There are no passwords.
- The switcher is there so the clinic can demo the product to people.

## Booking

Patients book their own appointments, in advance.

## Notes from the practice manager

We asked the practice manager what went wrong with the system this replaces.
She talked for about ten minutes and this is roughly what she said. None of it
was written down as a fault report, nobody ever established what was actually
going on underneath, and in most cases the front desk never worked out how to
bring it about a second time. Take it as description rather than diagnosis.

The scheduling was the sore point. Patients turned up on Saturdays for doctors
who don't work weekends, or an hour after their doctor had already gone home,
and reception is adamant that 6pm is the last appointment Dr. Mitchell will
take and 9am the earliest Dr. Chen sees anyone; the old system did not always
agree with her. Twice the same doctor was held by two different patients at
once. Going the other way, a woman was refused a cardiology slot on the grounds
that she already had a dermatology appointment at that hour with an entirely
different doctor, and another patient found that booking a single morning slot
appeared to swallow the rest of that doctor's day; the practice manager was
equally annoyed about both. Bookings also went through for times earlier the
same day that had already been and gone — including at least one the system had
apparently looked at and been perfectly happy with.

Then there was the money. The schedule filled up with visits nobody had paid
for, and those phantom visits kept real patients out of the slots. One woman
paid once and ended up on the books twice. Another was charged for, and booked
with, a doctor she had never chosen. Finance separately turned up a charge that
did not match the fee on the doctor's profile at all. And on more than one
occasion a visit landed on the wrong patient's record entirely.

She was also unhappy that a booking the system had refused still managed to
leave a mess behind — the appointment it had failed to change did not read the
way it had before the attempt.

## Visits and clinical notes

A visit that has been paid for is still ahead of the patient until the doctor
treating them says otherwise. Clinical notes record a chief complaint, a
diagnosis, and treatment notes; they are the write-up of a particular visit by
the doctor who conducted it.

The practice manager's list continued here too: notes were once saved against a
visit that had not happened yet, one visit ended up documented twice over, and
a note was at one point filed against a colleague's patient. Patients read
their own notes; doctors read the notes they wrote.

## Directory

Every doctor profile carries a name, specialty, consultation fee, biography,
years of experience, and the days and hours that doctor works. Patients can
read profiles before they book.

## Data

- SQLite is the record of truth. Starting the app against a fresh database file
  has to leave it usable, and starting it again must be safe.
- Tell patients enough to understand what went wrong. Do not tell them anything
  about the internals.
