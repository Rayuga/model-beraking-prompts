# Signalworks

Build **Signalworks**, the back office a rail infrastructure owner runs its
route from: it watches the signalling assets on the line, raises incidents when
they fail, sends response teams out to fix them, takes possession of the track
for planned work, hands the line back to the signallers, and settles what it
owes the train operators and its own technicians.

## Read these first

The brief is in this container under `/instructions/`, split across
`overview.md`, `behaviour.md`, `policy.md`, `security.md` and `ui.md`.
**Read all of them before you write anything.** They are one document split by
topic and none of it is optional.

`behaviour.md` is the route describing how the work really runs — the rates it
settles at, the checks it makes and when it makes them, and the arguments it
has had about the edge cases. Every rate, threshold, band edge and formula
input you need is stated there.

`/assets/artifacts/signalworks_seed_data.json` is the seed roster: every user,
section, asset, technician, team, incident, job, possession plan, handback
stage, callout, penalty band and credit, each with its stable id. **Seed it
exactly as given and do not invent parallel ids.** The figures the office
argues about — gross and net penalties, credits applied, billed labour,
overtime, night premium — are deliberately *not* in that file. Deriving them
is the job.

No HTTP endpoints, URL paths, element ids or status spellings are prescribed
anywhere in this task. Build whatever API shape and wording gets you the
behaviour that is asked for, and describe what you chose in `APP_MANIFEST.md`.
Nothing in the product should need a route or an element id explained before a
person can use it.
