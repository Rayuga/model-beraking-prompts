# MedLedger — overview

Build the health system's back-office platform. This is the floor talking about
how work actually goes — the clinic and the pharmacy, the lab bench and the
reading room, the ambulance bay, the stockroom, and the billing and compliance
offices upstairs — not a specification and not an API guide. What the software
must guarantee is for you to work out from what people say went wrong.

## The floor

Front desk registers patients and the clinicians write the orders — a lab draw, a
script, a scan, a ride. Pharmacy fills them, the lab runs the bloods, radiology
reads the studies, transport moves the patients, central supply keeps the shelves
stocked, billing files the claims, and compliance keeps the credentials current
and the ledger straight. The same person is a patient at the front desk, a payer
in billing, and a signer on a consent — a different word on each screen, the same
id underneath. And one doctor orders the labs, renders the charges on them, and
holds the panel in compliance — again, one id, three words.

It opens already signed in as the seeded administrator **Ada Admin** — no login,
registration, or password. A visible switcher moves between seeded identities.
SQLite is the source of truth. Starting against a fresh database must leave the
app usable; restarting must be safe.

## Starting data

The health system's records and staff sign-ins are in `/assets/artifacts/roster_seed_data.json` —
every patient, provider, dispense, lab, study, rig, dispatch, SKU, cycle count,
charge, claim, envelope and panel, each with its stable id, and the ten staff
logins with their ids. **Seed your database from it exactly on boot; do not invent
parallel ids or identities.** It is data, not a spec: the amounts a rule produces,
how the domains feed each other, which record blocks which, which of two blockers
a record names first, and what a mutation leaves behind in another department are
*not* in the roster — work those out from the stories in behaviour.md.

Money is in cents and every amount **rounds half-up to the cent**. The clinical
clock is fixed at **2026-08-17T10:00:00.000Z**; aging, expiry, credential lapse
and hours-of-service are all measured from it.
