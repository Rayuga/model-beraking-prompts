# MedCare Appointments — overview

Build a small full-stack healthcare appointment portal. Patients find a doctor,
pay for a consultation through Stripe's hosted Checkout, and can look back over
their own appointments and clinical notes. Doctors work through their own day
and write up the visits they have finished.

The brief is split across the files in `/instructions/`; read all of them.
`behaviour.md` is the clinic's own account of how they work. It describes their
business, not your implementation.

## Shape of the app

It opens already signed in as the seeded patient **Alice Johnson** — there is no
registration, login, or password anywhere in the product — and a visible
switcher moves between the seeded patients and doctors. Patients reach a doctor
through a directory and a profile, pay through Stripe's hosted Checkout, and
have somewhere to find their own appointments and records. Doctors have
somewhere to work through their day and write it up.

## Seed accounts (first boot)

Patients: Alice Johnson, Bob Williams, Carol Davis.

Doctors:

| Name | Specialty | Fee | Experience | Works |
| --- | --- | --- | --- | --- |
| Dr. Sarah Chen | Cardiology | $150 | 15 years | Mon-Fri 9AM-5PM |
| Dr. James Mitchell | Dermatology | $120 | 12 years | Mon-Fri 10AM-6PM |
| Dr. Priya Sharma | Pediatrics | $100 | 8 years | Mon-Sat 8AM-4PM |

Prefer the JSON under `/assets/artifacts/` when present — it carries stable ids
and the bios. Fees there use **`consultation_fee_usd`** (whole US dollars, so
`150` means $150.00). If that directory is empty, keep the names, roles,
specialties, fees, and working hours above, and invent stable ids.
