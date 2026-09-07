the basket and the order
========================

Pricing, the trade break and the postage bands are in the README next to this
file. This is what happens once someone starts buying.

The basket
----------

The basket recalculates from its lines every time. It never stores a total,
because a stored total is a total that can disagree with the lines.

Adding more than the stock on that line is refused, and the refusal says what is
actually available rather than just saying no.

Reducing a line to zero removes it.

Show the subtotal, the trade break saving, postage, and the total, separately, so
somebody can see where the number came from. The subtotal shown is the GROSS
figure — each line at its full, undiscounted price_pence, summed — with the
trade break's own saving then shown as its own separate deduction; the trade
break is a pricing rule that decides what a line is charged, not a rewrite of
what "subtotal" itself means.

The basket survives a reload.

Postage
-------

Worked out from the basket's total weight using the sheet weights, taking the
first band the total fits. A basket over the last band is collection only and says
so rather than falling back to the last band.

Placing an order
----------------

The order and its lines store the prices as charged. A later price change must not
rewrite a placed order - the confirmation and the record have to agree a year
later.

Placing an order reduces stock. An order that would take a line below zero is
refused at that point rather than accepted and reconciled later.

An order reference is generated and shown on the confirmation.

A shop that only shows an order once, at the moment it's placed, hasn't
actually stored it — a real customer looks an old order back up later. Give
the shop a way to look up any order by its reference (a "track an order"
control, or the same confirmation URL shape works for any past reference) and
seed it with the order in orders.csv, next to this file, so there is
something genuine to look up on first boot, not only orders placed during the
session.
