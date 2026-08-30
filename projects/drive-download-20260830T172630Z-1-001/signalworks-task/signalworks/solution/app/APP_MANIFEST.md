# Signalworks — application manifest

Single Node process on port 3000 (`PORT` overrides). Express serves both the
JSON API and the static interface from the same origin. Storage is SQLite
(`better-sqlite3`) written to disk under `SIGNALWORKS_DATA_DIR` (default
`../data`); the 35-table schema is created on first boot and the roster is
seeded **once** — if the database already holds users, nothing is re-seeded and
nothing is reset, so state survives a restart.

## Layout

| Path | What it is |
|---|---|
| `src/index.js` | HTTP routes, session handling, role gates, every write path |
| `src/rules.js` | the gates: role areas, the stored clock, inspection/availability holds, blockages, competence at a named moment, possession conflicts and material edits, period state |
| `src/settlement.js` | pure arithmetic in integer pence and integer minutes: marginal penalty bands, major-disruption flat rate, mutual-aid credit offset, callout merge, callout minimum, overtime, night premium, half-up rounding |
| `src/db.js` | schema and the one-time seed |
| `src/seed_data.json` | the golden's own copy of the roster, byte-identical to `/environment/assets/artifacts/signalworks_seed_data.json` |
| `public/` | the interface (no build step) |

## Money, minutes and dates

Money is integer pence and durations integer minutes everywhere; rounding is
half-up to the penny. **No rule reads the wall clock.** The one reference
moment lives in the `system_clock` table, derived once at seed time from the
latest incident in the roster (`2026-11-14T04:00:00Z`, reference date
`2026-11-14`). Every expiry, due-date and overdue test compares stored values
against that stored moment, or against another stored timestamp the caller
names — so results are identical whenever the task is run.

## Identity

Sign-in issues an httpOnly `sw_session` cookie. Every protected route resolves
the caller from that session alone. Request bodies are data, never authority:
`role`, `actor_id`, `planner_id`, `approver_id`, `approved`, `competent`,
`state`, ids of other users and client-chosen amounts are all ignored, and
every figure that matters is recomputed from stored records at the moment of
the decision. A suspended user's sessions are destroyed and their account
cannot sign in.

Every consequential mutation writes an `audit_log` row; every cross-record
consequence (a blockage placed, an approval invalidated, an asset failing
inspection, a credit consumed, a handback that could not return its asset, a
period freezing its settlements) also writes a `notifications` row.

## Refusals carry their figures

Every refusal that turns on a number returns that number in the JSON body, so
the interface can render it without a second call. Examples: `inspection_due_on`
+ `reference_date` + `overdue_by_days`; `blockage_id` + `section_id` +
`placed_by`; `required_competence` + `held_competence` + `missing_competence`;
`expires_on` + `evaluated_on` + `expired_by_days` + `valid_at_assignment`;
`overlaps_with` + `conflict_starts_at` + `conflict_ends_at`;
`expected_stage_id` + `expected_sequence` + `evidence_required`;
`already_claimed_by`; `planner_id` + `approver_id`; `settlement_id` +
`correction_route`; `open_period` + `period_state`.

## Roles and their areas

| Role | Areas reachable |
|---|---|
| `signaller` | incidents, assets, sections, jobs (read), notifications |
| `teamlead` | jobs, technicians, callouts, handbacks, assets (read), notifications |
| `maintenance` | jobs, assets, inspections, technicians, notifications |
| `engineer` | assets, possessions, configuration, sections, notifications |
| `safety` | possessions, blockages, handbacks, sections, assets (read), notifications |
| `admin` | users, settlements, ledger, audit, periods, notifications |

Only `engineer` changes an asset's live configuration or state, and only via
`PATCH /api/assets/:id` (which cannot set `IN_SERVICE`) or
`POST /api/assets/:id/return-to-service` (which re-tests the holds). Only
`safety` places or removes a line blockage, and only `safety` executes a
possession. Only `admin` closes a settlement period or administers users — and
an admin may not change their own role or suspend their own account.

## The gates, in words

**Availability / inspection holds.** An asset whose `inspection_due_on` lies
strictly before the stored reference date is overdue. A REPAIR or RENEWAL on it
is refused; an INSPECTION is exempt, because an inspection is the remedy. A
FAILED or MAINTENANCE asset refuses RENEWAL work but accepts the REPAIR and the
INSPECTION that would fix it. Returning an asset to service is refused while it
is overdue, and refused for a FAILED/MAINTENANCE asset until the **completed
handback** of the work on it exists (`NO_COMPLETED_HANDBACK`) — signing the job
off does not do it, and neither does marking the maintenance finished.
Completing the last handback stage is what puts the asset back.

**Safety holds.** An ACTIVE `line_blockage` on a section refuses job execution
and possession execution on that section outright. One section carries at most
one active blockage.

**Competence, at two distinct moments.** A technician must hold every
competence the asset kind demands (`competence_requirements`, deduplicated to a
set). Validity is tested **twice, against different moments**:
`POST /api/jobs/:id/assign-technician` tests against the stored reference date
and snapshots `competence_required` + `competence_expires_on` onto the
`job_assignments` row; `POST /api/jobs/:id/start` re-tests against the moment
the work is actually executed (`executed_at`, else the covering possession's
start, else the reference moment). A technician whose competence lapses between
those two moments is accepted at assignment and refused at execution, and the
refusal says so (`valid_at_assignment: true`, `assigned_at`, `expires_on`,
`evaluated_on`).

**Possession & isolation control.** A plan is drafted by the session user and
must be approved by a *different* person; self-approval is refused naming both
ids. Two plans on the same section whose half-open spans overlap conflict —
touching endpoints do not. The conflict is tested at APPROVAL, not at drafting:
a DRAFT may be written across another plan's span (the roster ships POS-5002 in
draft over the approved POS-5003), but two plans cannot both STAND. A **material** edit (`section_id`, `starts_at`,
`ends_at`) to an APPROVED plan invalidates the approval: the plan returns to
DRAFT, its version increments, the `possession_approvals` row is marked
INVALIDATED, and execution is refused until a second person approves again. A
note-only edit changes nothing. Execution additionally re-tests the blockage.

**Incident lifecycle.** OPEN → ACKNOWLEDGED → ASSIGNED → CLEARED → SETTLED,
each transition writing an `incident_events` row. Delay records attach an
operator and a minute count to an incident.

**Immutability & corrections.** A settled incident refuses edits and refuses
new delay records, returning its `settlement_id` and the correction route.
Corrections are APPENDED as `incident_events` of kind `CORRECTION` and never
rewrite anything. The audit trail answers GET and returns **405** to every
other method.

**Concurrency.** `POST /api/jobs/:id/claim` is one atomic conditional UPDATE, so
when two desks reach for the same job exactly one wins and the loser is told
`already_claimed_by`. A job is **held** once it has been claimed off the board
(`claimed_at`) or the work on it is under way — a job a desk has merely planned
onto a team is not yet held. An asset takes one team at a time, so a claim on an
asset another team already holds is refused (`held_by_job_id`); and a technician
is on one held job at a time (`held_job_id`). Both gates read the stored held
job, never the request.

## Settlement

**Delay exposure.** Penalty bands are MARGINAL, like tax bands. An incident
whose whole span lies inside a declared major-disruption window is charged FLAT
at the middle band's rate instead. A mutual-aid credit offsets the PENALTY, not
the minutes, can never take the settlement below zero, and against a zero
penalty is **not consumed** — it stays AVAILABLE.

**Labour.** Callouts by one technician that overlap *or merely touch* are one
callout, so the four-hour minimum applies once to the merged span. Overtime is
on WORKED minutes beyond eight hours at 1.5x; the night premium (22:00–06:00)
is on WORKED night minutes only, never on the minimum's padding.

**Periods.** While the period is OPEN an adjustment EDITS the settlement in
place. Once `POST /api/periods/:id/close` runs, settlements are immutable and
`POST /api/settlements/:id/adjust` APPENDS an OFFSET record pointing back at the
original via `offsets_settlement_id` — the original is never rewritten. Every
ledger posting is double entry, so `GET /api/ledger` always balances.

## Routes

67 route registrations: 65 API routes plus `GET /health` and the SPA fallback.
36 of them are writes.

### Auth and discovery
| Method | Path | Roles |
|---|---|---|
| GET | `/health` | — |
| POST | `/api/auth/login` | — |
| POST | `/api/auth/logout` | — |
| GET | `/api/auth/me` | any |
| GET | `/api/bootstrap` | any (role-scoped payload) |
| GET | `/api/reference` | any |

### Sections, assets, people
| Method | Path | Roles |
|---|---|---|
| GET | `/api/sections` | any |
| GET | `/api/sections/:id` | any |
| GET | `/api/assets` | any |
| GET | `/api/assets/:id` | any |
| GET | `/api/technicians` | any |
| GET | `/api/technicians/:id` | any |
| GET | `/api/teams` | any |
| POST | `/api/assets/:id/inspections` | maintenance |
| PATCH | `/api/assets/:id` | engineer |
| POST | `/api/assets/:id/return-to-service` | engineer |

### Incidents
| Method | Path | Roles |
|---|---|---|
| GET | `/api/incidents` | any |
| GET | `/api/incidents/:id` | any |
| POST | `/api/incidents` | signaller |
| POST | `/api/incidents/:id/acknowledge` | signaller |
| POST | `/api/incidents/:id/assign` | signaller, teamlead |
| POST | `/api/incidents/:id/clear` | signaller |
| PATCH | `/api/incidents/:id` | signaller |
| POST | `/api/incidents/:id/delays` | signaller |
| POST | `/api/incidents/:id/corrections` | signaller, admin |

### Jobs
| Method | Path | Roles |
|---|---|---|
| GET | `/api/jobs` | any |
| GET | `/api/jobs/:id` | any |
| POST | `/api/jobs` | maintenance, teamlead |
| POST | `/api/jobs/:id/assign-team` | teamlead, maintenance |
| POST | `/api/jobs/:id/assign-technician` | teamlead, maintenance |
| POST | `/api/jobs/:id/claim` | teamlead, maintenance |
| POST | `/api/jobs/:id/start` | teamlead, maintenance |
| POST | `/api/jobs/:id/complete` | teamlead, maintenance |
| POST | `/api/jobs/:id/cancel` | teamlead, maintenance |

### Safety, possessions, handbacks
| Method | Path | Roles |
|---|---|---|
| GET | `/api/blockages` | any |
| POST | `/api/blockages` | safety |
| POST | `/api/blockages/:id/remove` | safety |
| GET | `/api/possessions` | any |
| GET | `/api/possessions/:id` | any |
| POST | `/api/possessions` | safety, engineer |
| PATCH | `/api/possessions/:id` | safety, engineer |
| POST | `/api/possessions/:id/approve` | safety, engineer |
| POST | `/api/possessions/:id/execute` | safety |
| POST | `/api/possessions/:id/cancel` | safety, engineer |
| GET | `/api/handbacks` | any |
| GET | `/api/handbacks/:id` | any |
| POST | `/api/handbacks` | teamlead, safety |
| POST | `/api/handbacks/:id/steps` | teamlead, safety |
| POST | `/api/handbacks/:id/complete` | teamlead, safety |

### Settlement, ledger, admin
| Method | Path | Roles |
|---|---|---|
| GET | `/api/callouts` | any |
| POST | `/api/callouts` | teamlead |
| GET | `/api/periods` | any |
| POST | `/api/periods/:id/close` | admin |
| GET | `/api/settlements` | admin |
| GET | `/api/settlements/incidents/:id/preview` | admin, signaller |
| GET | `/api/settlements/labour/preview` | admin |
| POST | `/api/settlements/incidents/:id` | admin |
| POST | `/api/settlements/labour` | admin |
| POST | `/api/settlements/:id/adjust` | admin |
| GET | `/api/ledger` | admin |
| GET | `/api/audit` | admin |
| ALL | `/api/audit/:id` | admin (GET reads; every other method → 405) |
| GET | `/api/notifications` | any |
| GET | `/api/admin/users` | admin |
| POST | `/api/admin/users/:id/role` | admin |
| POST | `/api/admin/users/:id/suspend` | admin |

## Health

`GET /health` is registered before the database is opened and is never gated
behind seeding or anything external. A database that fails to open is logged
and does not stop the process from listening.

## Third-party services

None. No payment provider, no mapping, no mail, no outbound network calls.
