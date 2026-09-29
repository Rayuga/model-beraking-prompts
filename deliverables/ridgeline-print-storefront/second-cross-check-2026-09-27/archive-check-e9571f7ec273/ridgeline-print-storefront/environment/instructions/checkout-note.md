# From basket to receipt

Each visitor has their own basket in their browser. Reloading should bring back the chosen prints, sizes and quantities, with the amounts worked out from those lines again. We only sell whole sheets. Setting a line to zero removes it, including after another reload. If someone asks for more than we have, show how many are available and leave their last valid basket intact.

We need a recipient name, address line, city and postcode for an order. None can be missing or blank. The server needs to refuse an incomplete address too, without creating an order or taking any stock; a warning on the form alone isn't enough. We don't need postcode-format policing or address verification with an outside service.

Let customers check the address and the full price breakdown before committing. One checkout screen is fine, or you can use a separate review screen. There is no payment step or card form. Give a successful order its own reference and let someone look it up from the shop later, even in a browser that doesn't have their old basket. If a reference doesn't exist, say so rather than showing somebody else's receipt.

## Buying the last copies

A basket doesn't reserve anything. Another visitor may buy a copy before its owner checks out, so the stock that counts is what remains when the order is placed. Either accept the whole order or leave it alone. If one line can't be supplied, none of its lines should take stock and there should be no new order. That includes two people buying at the same time. Buying exactly the copies we have left is fine.

For a placed order, each quantity has to be a positive whole number and each print/size has to exist. One bad line makes the whole order invalid. If the same variant arrives on two lines, combine it before checking stock or the trade offer; splitting a line shouldn't change either answer.

Prices come from our catalogue. An old or altered basket can't set its own unit prices, trade saving, postage or final total. The server can reject such a request or use the correct calculation, but it must never store the customer's invented amount as the charge.

## Retrying checkout

Sometimes the connection drops after we've received an order. Please keep track of which checkout attempt a customer is completing, so sending that same attempt again returns its original reference and receipt. It mustn't create another order or take stock twice, even after the app restarts.

That protection applies to the same variants, quantities and address. An attempt already used for one order can't be reused to change its contents or delivery details; refuse that change and leave the original alone. A customer deliberately starting a new checkout can still buy the same basket again. That gets a different reference.

## Stored orders and cancellations

A receipt is a record of what we agreed at the time. Keep its address, quantities, regular and charged unit prices, trade saving, postage and final total. Don't rebuild an old receipt using today's catalogue prices. The older order in the supplied data is a useful example: those prints sold for a different price, and the order has already been dispatched.

A new order starts as placed. Customers can cancel it from its receipt or confirmation view while it hasn't been dispatched. Put back the exact quantities, mark the order cancelled and keep its original receipt and address visible. A second click on cancel mustn't put the sheets back again.

Once cancelled, it stays that way. Even retrying the original checkout should return the same cancelled receipt, without placing it again or taking more stock. Dispatched orders can't be cancelled or return stock. Please keep all of this when the app restarts: orders, their status, the attempts they belong to and the remaining quantities.
