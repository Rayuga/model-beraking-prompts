# Trust

## Who is asking

The switcher in the interface decides which seeded person is using the app. It
is part of the demo.

## What the roles are for

A patient browses doctors, pays for their own consultations, and reads what is
theirs. A doctor has the patients they are treating and the notes they write.

## Isolation

This clinic is subject to a patient-confidentiality audit and cannot rely on
the good behaviour of whoever happens to be holding the browser. No patient may
learn anything about another patient through this app, and no doctor may learn
anything about another doctor's patients, day, or notes.

## Payment

Stripe holds card details; this app never does. Secrets stay on the server and
out of logs and browser code. The clinic reconciles what Stripe captured
against what the doctor's own profile says a consultation costs, and expects
the two to agree every time.

## Validation

Turn away what does not make sense before it reaches the database.
