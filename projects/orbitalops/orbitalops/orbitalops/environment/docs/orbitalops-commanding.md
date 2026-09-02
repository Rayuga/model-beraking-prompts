# Ground-station console rules — commanding

Pulled out of the shift paperwork into one place, because these interact and
reading them separately is how the last console ended up wrong. Follow them
exactly — where a value here differs from what a request claims or the UI
guesses, the value here wins.

## Queueing, contact windows and checkout

A command is queued against one spacecraft and only takes effect once
uplinked.

A spacecraft outside its contact window cannot be commanded at all — the
window belongs to the craft the pass was scheduled for, not to whichever
craft the shift meant. The window is checked at execution and not only at
queueing: a command that was legal when it was queued can stop being legal
before it runs. A command that fills its contact window exactly, end to end,
was never the complaint.

A craft that has failed its checkout takes no new work. Pulling a command
back off the craft does not make it fit to fly the next one either — the
checkout is what says whether it can fly, and only a fresh checkout changes
that.

## Propellant and battery budgets

A burn has to be paid for out of what is actually left in the tank after the
last manoeuvre, not the tank's rated size. A burn that spends exactly what is
left was never the complaint.

A heater or other draw comes off the charge the craft actually has, not a
full battery, and must not take it past the reserve floor written on the
craft's own record. A command that lands the battery exactly on the reserve
was never the complaint.

Figures a request sends up for propellant, charge, the window or delta-v are
claims, not authority — the craft's own stored record decides, checked again
at the moment a command executes, not at whatever the client remembered when
it queued the command.
