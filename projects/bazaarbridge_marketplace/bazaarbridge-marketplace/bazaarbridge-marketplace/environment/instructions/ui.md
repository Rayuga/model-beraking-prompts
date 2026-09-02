# Interface

Routes, labels, and element identifiers are yours to choose. Everything must be
discoverable by intent; assume nobody tells the person using the product where
to click.

## What people need to reach

The Administrator needs clear routes into Dashboard, Orders, Inventory, and
Payouts. Each destination must show its own meaningful heading and content;
multiple labels pointing to one unchanged screen do not count.

Orders need search and status filtering across the visible collection.
Inventory must show stock and a clear low-stock flag when stock is at or below
reorder level. Payouts must allow status changes and must also show each
merchant's settlement statement, with the commission and processing figures
broken out far enough that a finance person can see where the net came from
rather than having to trust one total. The Dashboard must show gross sales,
order count, ready payout, total owed to merchants, and recent activity.

The signed-in person's name and role must be visible, and it must be obvious
when an action is not theirs to take.

## Theme, layout, and feedback

Provide a useful light and dark theme with a visible control that changes the
rendered presentation while preserving the current workspace.

At a roughly mobile-sized viewport the main content must remain usable without
horizontal page overflow, and the workspaces must stay reachable. On desktop,
use a navigation landmark, a main landmark, meaningful headings, and accessible
names or associated labels for visible buttons, inputs, and selects.

When an action is refused, the person must see that it was refused and receive
a useful reason without leaving the current workflow. The reason has to stay on
screen until they move on — a banner that fades after a second or two is how we
came to miss a refusal in the first place. Interactive controls should have clear
hover or focus feedback. The workspace must remain coherent after opening and
closing any detail or update surface the product uses.
