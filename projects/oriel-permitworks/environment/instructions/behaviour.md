# Parcels, fees, and plans review

The public seed asset lists the initial parcels and permits. Parcels are
immutable municipal facts with a district, zoning class, address, and allowed
permit type. NORTH contains `PAR-N-100` (R2, Residential Addition) and
`PAR-N-200` (C1, Commercial Sign); SOUTH contains equivalent `PAR-S-100` and
`PAR-S-200` records.

Money is stored as integer cents and shown clearly in dollars. The server owns
the fee schedule:

- Residential Addition: $250 base plus $40 for every started $1,000 of valuation; $50 statutory levy.
- Commercial Sign: $500 base plus $60 for every started $1,000 of valuation; $100 statutory levy.

A clerk creates a unique-reference draft only on an eligible parcel in the
clerk's district. The server derives district, eligibility, permit type, fee,
and levy from trusted records. The creating clerk submits or corrects it. A
district supervisor assigns an in-district reviewer; only that assigned
reviewer may approve plans or require corrections and save a review note.

Every permit write is revision-aware. Filing a correction increments revision,
recomputes the fee, returns the permit to plans review, and clears stale zoning
approval, assessment, waiver, receipt, inspections, and certificate work.
