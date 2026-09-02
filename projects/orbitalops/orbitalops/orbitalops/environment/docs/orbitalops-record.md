# Ground-station console rules — the record and fixed figures

## The record

Once a command has gone out or been pulled, nothing further happens to it —
not authorization, not another uplink, not a second cancellation. Commands
that had already gone out have been sent again in the past, and cancelled
ones authorized, uplinked and cancelled a second time; neither is acceptable
going forward. A command reference identifies exactly one command — a
duplicate reference slipping through and leaving two commands nobody can
tell apart is the exact failure this rules out.

Every authorization, uplink and cancellation is written to the audit record
at the time it happens, with who did it and what it was done to. The record
is append-only: once written, a line is not altered or removed through the
application by any role, including the administrator.

Whatever was true before the process stopped is true when it comes back —
every command and its state, every authorization, every checkout result,
every telemetry reading, every role change and every audit line, exactly as
they stood. State held only in memory does not satisfy this.

## Fixed figures

Two figures above are fixed numbers rather than judgement calls. The
delta-v line above which a burn needs a flight director's authorization is
**50 m/s** — at exactly 50, no second signature is needed. The battery
reserve floor a draw must not cross is **30%** — landing exactly on it is
allowed. Both ends of every stated range are usable values: at the limit is
inside it.
