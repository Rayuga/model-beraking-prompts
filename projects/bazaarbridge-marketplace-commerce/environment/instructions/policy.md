# What we run on

SKUs are unique ignoring letter case. Prices are whole dollars; stock is a whole, non-negative count and never goes below zero; a stock or product change carries a visible reason. Commission is 12% under $150, 9% from $150 up to below $300, and 6% from $300 up. The processor takes 2.9% of the order total plus $0.30, each deduction settles to the cent with half-up rounding, and the remainder is the order's net.

Only Shipped orders generate settlement; Returned orders never do. Gross sales is the total of every order that was not cancelled, and the order count counts those same orders, so a returned order stays counted because it was booked. Owed to merchants is the sum of the statements; ready payout is the sum of only Approved payouts.

Orders move New to Packed to Shipped. An On hold order resumes at Packed or is cancelled; Returned and Cancelled orders are terminal. A shipment comes from the order's own hub and moves picked, in transit, delivered; skipping a step, dispatching from another hub or changing a delivered shipment is refused. Delivering completes the order: it becomes Shipped and reserved stock leaves inventory then, exactly once. Placing an order reserves units without removing stock; cancelling releases exactly what was reserved; two orders never reserve the same unit, including the last one.

A return starts as a request and only becomes a Returned order when the warehouse records the receipt; recording the receipt releases what the order reserved and restores the stock exactly once. Returns are accepted within 30 days of delivery, counting the delivery day, for orders that were delivered. A refund needs that receipt and an amount from the stored order, never the payload.

Return windows resolve against the fixed marketplace clock in the seed data
(top-level "clock": 2026-09-09T12:00:00Z), so a delivered order stays inside
its window until that clock reaches the thirtieth day regardless of when the
process is actually run.

Payout and refund requests are raised by a Finance manager and approved by a different Finance checker; payouts of $10,000 or more follow the same two-person rule. A payout request carries a reference and an amount the server works out from the merchant's current statement, with the working shown; a browser-sent amount is ignored, and the same reference returns the same request. Several payout requests for the same merchant may be open at once and each one appears as its own row.

When a new Shipped order lands for the same merchant, every earlier approved payout for that merchant is voided to Stale immediately, before it can count toward ready payout or be released, and the merchant requests a fresh payout; returns, cancellations and freezes do not void approvals, and a paid payout or refund is terminal. A frozen merchant cannot receive or release money, and freezing or unfreezing needs a stated reason from compliance or the administrator. Bank tokens stay masked everywhere except on the Finance desk where only the Finance checker's control reveals them.

Suspension or demotion bites on the very next write. Every successful change lands in recent activity with the person, the record, what changed and when; refused writes add nothing.
