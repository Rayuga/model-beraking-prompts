# The Ridgeline catalogue

The catalogue is /assets/seed_data.json. It contains thirteen variants across eight prints, the postage bands, the sheet weights and one historical order. Photographs are under /assets/prints; use the image associated with each print. Prices are integer pence.

A variant is one exact combination of print SKU and paper size. Keep its title, paper, price, stock and trade-break figures exactly as supplied. A print can offer several sizes, and selling out of one size does not sell out the others. A sold-out variant still shows its price and available quantity, but cannot be bought. A print is sold out on the grid only when all its variants are sold out. Its grid price is the lowest regular price among its offered variants, including sold-out ones.

Size and stock-sheet filters match offered variants, including sold-out variants. Title search ignores case. Price sorting uses the grid price; title sorting is alphabetical. Detail views show the actual photograph larger than the grid image and show the offered variants without inventing additional sizes.

## Trade prices

Each variant has a regular price, a trade quantity and a trade price. Reaching its trade quantity changes the price of every unit on that variant to the trade price. A basket of five units spread across different prints or sizes does not qualify a variant that needs five of its own. Adding the same variant again increases that variant's existing quantity; it does not create a separate price tier. Reducing the quantity below the threshold removes its trade price again.

Show the trade offer before it applies and make the applied saving clear afterward. The subtotal is the sum of quantities times regular prices. Show the trade saving separately, then postage, then the amount payable. Recalculate from the current lines whenever anything changes; stored or customer-supplied totals are not prices.

## Postage

Add the weights of every sheet, then use the first postage band whose upper weight includes that total. A3 is 90 g and A2 is 160 g. The Letter band covers up to 100 g for 175 pence, Large letter up to 500 g for 320 pence, and Small parcel up to 2,000 g for 495 pence. A heavier basket is collection from the studio only, with no postage charge. A trade discount changes money, never weight.

The basket, order and cancellation rules are in checkout-note.md.