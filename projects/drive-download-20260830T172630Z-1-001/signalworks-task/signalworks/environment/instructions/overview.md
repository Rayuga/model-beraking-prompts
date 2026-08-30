# Signalworks — what you are building

Signalworks runs the signalling and track assets on one route. The route owns
points, signals, track circuits and level crossings across two interlockings;
it employs competence-carded technicians who work in response teams; it takes
incidents from the control room when something on the line fails, sends a team
out under whatever protection the safety office has put in place, gets the
asset working, hands the line back to the signallers, and then settles the
month — what the train operators are owed for the delay they suffered, and what
the technicians are owed for the nights they worked.

The hard part is not any single screen. It is that an asset's condition, a
technician's competence, a safety blockage on a section, a possession plan, a
handback sequence, a delay settlement and a wage bill all have to agree about
the same piece of work at the same time — and they disagree in ways the route
has learned about the hard way. `behaviour.md` is where those lessons are
written down.

## The people who use it

Every user has exactly one role. All accounts use the password `password123`.

| Role | Sign-in | What they do |
|---|---|---|
| Signaller | `signaller@signalworks.test` (and `signaller2@signalworks.test`) | watches the board, raises and acknowledges incidents, raises jobs, takes the handback and returns the line to normal working |
| Response team lead | `teamlead@signalworks.test` (and `teamlead2@signalworks.test`) | claims jobs for a team, puts technicians on them, records the work, signs handback stages |
| Maintenance planner | `maintenance@signalworks.test` | works the inspection and renewal lists, records what an inspection found, moves assets in and out of maintenance, records callouts |
| Signalling engineer | `engineer@signalworks.test` | plans possessions and approves them, changes the configuration and live state of an asset, puts an asset back into service, settles the round |
| Safety officer | `safety@signalworks.test` | places and lifts line blockages, plans possessions, audits the trail |
| Administrator | `admin@signalworks.test` | manages users, closes the settlement period, posts corrections, reads the audit trail |

`signaller2@` and `teamlead2@` are not decoration. Several of the arguments in
`behaviour.md` are about two desks doing the same thing at the same time, or
about one person being asked to approve their own work, and they need two
accounts on the same side of the fence to happen at all.

## The starting data

`/assets/artifacts/signalworks_seed_data.json` holds the whole roster. **Seed
every record exactly as written, with the ids given, and do not invent parallel
ids.** Nothing in the product should refer to an asset, a job, a technician or
a possession by any code other than the one in that file. It contains:

- **`region`**, **`interlockings`**, **`line_sections`** — the geography. One
  route, two interlockings, two sections. Every asset, incident, blockage and
  possession hangs off a section.
- **`users`** — the eight accounts above, with their roles.
- **`assets`** — fifteen units: points, signals, track circuits and level
  crossings. Each carries its **kind**, its **section**, its **state**
  (in service, failed, under maintenance) and the date its **inspection is next
  due**. One of them, `PTS-R7-EXP`, has an inspection date that went by in 2020.
- **`technicians`** — nine people, each with a **team**, the **competences they
  hold**, the date those competences **expire**, and their own **base rate in
  pence per hour**. `TEC-06`'s competence expired in 2020; `TEC-03`'s expires on
  2026-11-20, in the middle of the work this system covers.
- **`teams`** — five response teams and whether each is **on call**.
- **`competence_requirements`** — which competence each kind of asset demands,
  for repair work and for possession work alike.
- **`operators`** — the three train operators whose services get delayed and
  who therefore get settled with.
- **`incidents`** — ten. Six are live on the board in various states. Four,
  the `INC-SETL-*` rows, are finished and waiting to be settled; each has a
  raised time and a cleared time, and those two stored timestamps are the whole
  of its duration.
- **`delay_records`** — the minutes each operator lost to each of those four
  incidents. Minutes are given; money is not.
- **`jobs`** — sixteen: repairs tied to incidents, inspections, and renewals.
  One, `JOB-RACE-3301`, is deliberately sitting unclaimed where two desks can
  both see it.
- **`handback_stages`** — the six stages, in sequence, that give the line back
  to the signaller, and what **evidence** each one demands.
- **`possession_plans`** — three planned occupations of a section, one already
  approved and two not, with times that were chosen to argue with each other.
- **`line_blockages`** — protection the safety office has placed on a section.
- **`delay_penalty_bands`**, **`major_disruption_windows`**,
  **`mutual_aid_credits`** — the settlement rate card, the storm window, and the
  credits available against particular incidents.
- **`payroll_rules`**, **`callouts`** — the five rules the wage bill runs on,
  and the four callouts already recorded against technicians.
- **`settlement_periods`** — the one open period, `SET-2026-11`.

Money is held in **integer pence** everywhere in that file, and you should hold
it the same way. Display it as pounds and pence. Durations are **integer
minutes**.

Times in the seed are ISO instants in UTC. Every time rule in this system
compares one **stored** timestamp against another **stored** timestamp — an
incident's raised time against a disruption window's edges, a technician's
competence expiry against the moment the work was executed, one possession's
span against another's. Nothing depends on what the clock says now, and there
is no need for a clock you can wind forward.

## What the route expects to see

Screens for the control-room board, the assets, the jobs, the technicians and
their competences, the possession plans, the blockages, the handback of a
piece of work, the settlement round and the wage bill. What each role gets to
reach is in `security.md`; what the screens have to make visible is in
`ui.md`; the rules the route actually runs on are in `behaviour.md`.
