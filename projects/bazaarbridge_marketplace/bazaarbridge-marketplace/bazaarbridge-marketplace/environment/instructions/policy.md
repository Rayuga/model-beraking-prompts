# Operating policy

These rules are part of the product. They must hold in the browser after a
reload, not only in a toast.

## Dashboard figures

- **Gross sales** is the sum of all order totals in the durable store.
- **Order count** is the number of orders in the durable store.
- **Ready payout** is the sum of payouts whose status is **Approved** only.
  Requested, Review, and Paid amounts are excluded.
- **Owed to merchants** is the total net payable across every merchant
  settlement described below. On the seed data it reads $243.20 today.

Approving a payout that was not Approved must raise the ready-payout figure by
that payout's amount, and moving an Approved payout to Paid must take that
amount back out again.

## Low-stock flagging

A SKU whose stock is at or below its reorder level must be visibly flagged as
low stock. On the seed data AL-THROW-4 (7 of 8) and BR-PACK-2 (4 of 7) start
flagged, while AL-LAMP-1, BR-TENT-1 and CI-STONE-3 start healthy. The flag
follows the stock, so it has to appear and clear as stock is saved.

## Invalid stock

Stock can never go negative. An attempt to save a negative value must be
refused with a visible reason and must leave the stored figure alone, so a
reload still shows what was there before. A sensible value saved afterwards
must go through and stick.

## Terminal order status

An order whose status is **Returned** is terminal — BB-1043 stays Returned and
must not move back to New, Packed, Shipped or On hold. The refusal must be
visible, and BB-1043 must still read Returned after a reload.

Allowed active statuses for other orders are New, Packed, Shipped, and On hold,
plus Returned as a one-way destination.

## Merchant settlements

Every merchant has a settlement statement showing what BazaarBridge currently
owes them. Finance treats these as live figures worked out from the orders every
time the statement is read, never a stored constant and never a number captured
at boot.

Only orders at status **Shipped** are payable. New, Packed and On hold have not
been fulfilled yet, and a **Returned order never pays out**, even if it was
Shipped earlier.

Two deductions come off each payable order. Commission comes off the order total
at a rate that depends on how large the order is:

| Order total | Commission |
|---|---|
| under $150 | 12% |
| $150 up to but not including $300 | 9% |
| $300 and over | 6% |

Our payment processor then charges 2.9% of the order total plus a flat 30c on
every order. Both parts of that fee are worked out on the order total itself
rather than on what is left after commission, and the 30c is per order, not per
merchant. What survives both deductions is that order's net, and what we owe a
merchant is the sum of the nets across their payable orders. Finance works in
whole cents throughout, with half a cent rounding up, so each deduction is
settled to the cent before the next one comes off.

On the seed data the statements read **Alba Home $81.40**, **Brook Outdoor
$161.80** and **Cinder Living $0.00** today. Because the figures are live, an
order moving into or out of Shipped moves that merchant's statement straight
away.

## Activity trail

Every successful order-status, inventory-stock or payout-status change must add
a recent-activity entry naming the action, the affected record, whoever made the
change, and when it happened. The entry must survive reload. Seeded activity
alone is not enough.
