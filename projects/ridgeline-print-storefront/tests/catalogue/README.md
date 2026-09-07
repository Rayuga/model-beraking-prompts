What is in this folder
======================

  prints/            One photograph of each print, named by its SKU. These are
                     the shop images — use them, do not substitute anything.
  variants.csv       Every buyable line: SKU, title, paper size, stock sheet,
                     unit price, how many are in stock, and the trade break.
  postage.csv        Postage bands by basket weight.

Prices and the trade break
--------------------------

Prices are in pence, exclusive of postage. Each line has a trade break: order at
least `tier_qty` of that exact line and every unit on that line drops to
`tier_price_pence`. The break applies per line, not across the basket, and it is
not a discount code, redeemed or entered separately — it is a standing rule
about what that line is CHARGED at that quantity. What the checkout summary
LABELS "subtotal" is a different question, answered in checkout-note.md: the
break still shows there as its own separate line, not folded silently into
the subtotal figure.

Stock is per line, so A3 selling out does not stop A2 selling. A line at zero is
still worth showing with its price; it just cannot be added.

Postage is worked out from the basket, not per item: total the sheet weights, then
take the first band whose upper bound the total does not exceed. A basket over the
last band is collection only.

Once someone starts buying
--------------------------

The basket, the stock refusals and what an order stores are in checkout-note.md,
in this folder. Prices and postage are above and the two have to agree.
