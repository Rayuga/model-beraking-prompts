# What the screens have to show

A person finds their way around Signalworks by reading it. Nobody types a URL
and nobody is told an element id. Every area a role can reach is reachable from
the navigation that role sees, and every action they are allowed to take is a
control on a screen — a button, a form, a menu item. Wording is yours; being
able to work out what a control does from the screen is not.

## Figures have to be on the screen

The office argues about numbers, so the numbers have to be visible — not held
in the database and summarised as "calculated", and not rounded into a range.
Show money as pounds and pence and durations as minutes.

A settled incident must show, on the screen:

- the **delay minutes** as recorded, per operator
- the **gross penalty** before any credit, and whether it was **banded** or
  charged flat inside a **major-disruption window** — and which window
- the **credit applied**, and which credit it was
- the **net** settlement

A settled callout must show:

- which **callouts were merged** into it, and the merged span
- its **worked minutes** and its **billed minutes**, so the four-hour minimum
  is visible when it has changed one into the other
- the split into **normal** and **overtime** minutes, and its **night minutes**
- the money against **base**, **overtime** and **night** alongside the total

An asset must show its **kind**, its **section**, its **state** and the date its
**inspection is next due**, and must make an overdue inspection obvious rather
than leaving it to be worked out from a date. A technician must show the
**competences they hold** and the date those **expire**. A job must show the
team holding it. A possession plan must show its **start and end times**, its
**section**, who **planned** it, who **approved** it, and — where an edit has
invalidated an approval — that it is waiting for a signature again. A handback
must show each of the six stages, which are signed, which evidence each demands
and which evidence is on file. A section must show any **blockage** on it and
who placed it.

A settlement period must show whether it is open or closed, and a settlement
that has been corrected after the close must show the **original figure**, each
**offset** against it, and the **current position**.

## The screen must not offer what the rules forbid

If a record's state means an action is not allowed, the screen should not be
offering that action — and if it is offered anyway, the server still refuses it.
A hidden button is not enforcement on its own; it is a courtesy on top of
enforcement.

## Refusals are visible

When the server refuses something, the person who tried it sees why, on the
screen, in words. A refusal that only appears in a network response is a refusal
the crews will not learn from.

**A refusal that turns on a figure has to show that figure.** "Competence not
valid" is no use to a team lead on its own — it needs the competence the asset
wanted and the date the card expired. "Possession clashes" needs the times of
the possession it clashes with. "Inspection overdue" needs the date. "Period
closed" needs to say which period. Without the figure, the desk has nothing to
act on and rings the engineer instead.
