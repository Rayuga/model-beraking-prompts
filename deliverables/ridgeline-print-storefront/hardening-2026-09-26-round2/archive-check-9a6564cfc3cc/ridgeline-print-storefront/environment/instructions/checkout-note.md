# From basket to receipt

The basket belongs to this browser and survives a full reload. Its lines carry the chosen variants and quantities; prices and the summary are recalculated from those lines. Quantities count whole sheets. Setting a basket line to zero removes it. A quantity above the available stock is refused with the actual available quantity visible, and the last valid basket remains usable.

An address needs a recipient name, address line, city and postcode. Show the address and complete price breakdown before placing an order; a single checkout screen or several screens are both fine. There is no payment step. A successful checkout has a unique reference that can be looked up from the shop without relying on browser memory.

## Buying the last copies

A basket does not reserve stock. Another visitor may buy a copy while it is sitting in someone's basket, so an order uses the stock available when it is placed. Commit all its lines together or none of them: if one line cannot be supplied, leave every variant's stock unchanged and create no order. Two simultaneous buyers cannot both receive the same last copy. Exact remaining quantities are valid purchases.

Checkout quantities must be positive whole numbers and every variant must exist. Invalid quantities or unknown variants make the entire order invalid. Repeated entries for the same variant, if the submitted line representation permits them, represent a single combined quantity for both stock and trade pricing. They cannot bypass a stock limit or split a trade break. No request may invent a price, trade saving, shipping charge or final total: an inconsistent monetary claim can be rejected or ignored in favour of the real catalogue calculation.

## Retrying checkout

Keep an identity for a checkout attempt so a lost response or repeated click can be retried safely. Sending the same attempt again with the same variants, quantities and address returns its original reference and receipt, without another order or stock deduction. This remains true after restarting the app. Reusing that attempt for different lines, quantities or address is refused and leaves the original order alone. A customer starting a new checkout can buy the same basket again; that is a separate order with its own reference.

## Stored orders and cancellations

Store each order's address, quantities, regular and charged unit prices, trade saving, postage and final total as they stood when it was placed. Looking it up later must not recalculate its receipt from today's catalogue. The historical order in the seed was sold at a different price; preserve its original figures and dispatched status.

New orders are placed and can be cancelled from their lookup or confirmation view. Cancelling restores each ordered variant's exact quantity once, marks the order cancelled and keeps the original receipt and address visible. Repeating a cancellation does not restore anything again. Cancelled orders stay cancelled: retrying their original checkout returns that same cancelled order, and never creates it again or deducts stock again. Dispatched orders cannot be cancelled and cannot return stock. All these records and stock changes survive an application restart.