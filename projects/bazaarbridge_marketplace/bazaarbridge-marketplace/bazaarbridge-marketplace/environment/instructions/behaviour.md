# Field notes from marketplace operations

These are complaints and observations from people who use the desk. They
describe what people saw, not a specification or diagnosis.

Someone signed in as the Administrator and still could not tell whether they
were looking at Administrator work or a public page. The four desks —
Dashboard, Orders, Inventory, and Payouts — sometimes all showed the same
unchanged screen with different labels.

Gross sales on the Dashboard did not match the sum of the order totals people
could see. The order count drifted when rows were filtered. The ready-payout
amount included Requested and Review payouts, and it did not move when a payout
was Approved or Paid.

Recent activity was either missing or only showed what was seeded at boot.
After someone packed an order or saved stock, nothing new appeared naming the
action, the record, who did it, or when.

On Orders, a customer search left unrelated rows visible. A status filter left
other statuses mixed in. Changing one order's status quietly changed a
neighbour too, or the change vanished after refresh.

On Inventory, saving one SKU's stock also moved another SKU. Stock below the
reorder level looked the same as healthy stock, so people missed AL-THROW-4 and
BR-PACK-2. Raising a low SKU did not clear the warning; dropping a healthy SKU
did not raise one.

Negative stock was accepted, or the refusal left the old value looking
changed. Returned order BB-1043 was moved back to Packed or Shipped after it
should have stayed Returned.

Payout status changes did not stick after a new sign-in. Approving PAY-303 did
not lift the Dashboard ready-payout figure; marking an Approved payout Paid
left the old total on screen.

The people who are not the Administrator were the worst of it. Nobody could tell
from the screen who they were signed in as. The Operations lead could move
payouts that are none of his business, and the Finance manager was able to
repack an order and reprice stock. When something finally was refused, the
screen either said nothing at all or flashed a message too briefly for anyone to
read, and twice the record had quietly changed anyway.

Finance has stopped trusting the payout screen. The merchant statements showed
tidy round numbers that bore no relation to what we actually owe once our
commission and the processor's cut come off, and there was no way to see how a
figure was arrived at. Orders that were never shipped were being counted, and
one merchant was paid for an order that had come back to us as Returned. The
totals also went stale: ship something and the statement sat where it was until
the whole app was restarted, and the owed figure on the Dashboard never agreed
with the statements underneath it.
