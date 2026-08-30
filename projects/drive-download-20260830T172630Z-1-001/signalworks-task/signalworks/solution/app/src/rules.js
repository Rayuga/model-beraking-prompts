'use strict';
// Signalworks rule engine. Every gate the control office actually enforces, in
// one place. NOTHING here reads the wall clock: every date decision compares
// STORED values against the stored reference moment in `system_clock`, or
// against another stored timestamp the caller hands in.

const ROLE_AREAS = {
  signaller:   ['incidents', 'assets', 'sections', 'notifications', 'jobs', 'handbacks'],
  teamlead:    ['jobs', 'technicians', 'callouts', 'handbacks', 'notifications', 'assets'],
  maintenance: ['jobs', 'assets', 'inspections', 'technicians', 'notifications'],
  engineer:    ['assets', 'possessions', 'configuration', 'sections', 'notifications'],
  safety:      ['possessions', 'blockages', 'handbacks', 'sections', 'notifications', 'assets'],
  admin:       ['users', 'settlements', 'ledger', 'audit', 'periods', 'notifications'],
};

const ALL_ROLES = Object.keys(ROLE_AREAS);

function can(role, area) {
  return (ROLE_AREAS[role] || []).includes(area);
}

// ------------------------------------------------------------------ the clock
function clock(db) {
  return db.prepare("SELECT * FROM system_clock WHERE id = 'CLOCK'").get()
      || { id: 'CLOCK', reference_at: '1970-01-01T00:00:00Z', reference_date: '1970-01-01' };
}
const dayOf = (iso) => String(iso || '').slice(0, 10);
const DAY_MS = 86400000;
function daysBetween(fromDay, toDay) {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY_MS);
}

// ------------------------------------------------------------------ assets
// An asset is inspection-overdue when its stored due date lies strictly before
// the stored reference date. Never "before today".
function inspectionOverdue(db, asset) {
  const ref = clock(db).reference_date;
  if (!asset) return null;
  if (asset.inspection_due_on >= ref) return null;
  return {
    inspection_due_on: asset.inspection_due_on,
    reference_date: ref,
    overdue_by_days: daysBetween(asset.inspection_due_on, ref),
  };
}

const UNAVAILABLE_STATES = ['FAILED', 'MAINTENANCE', 'WITHDRAWN'];

// Whether an asset may carry work of a given kind right now.
//   - a REPAIR is the remedy for a FAILED or MAINTENANCE asset, so it is allowed
//   - an INSPECTION is the remedy for an overdue inspection, so it is exempt
//     from the overdue hold (otherwise the asset could never be cleared)
//   - a RENEWAL is ordinary planned work and is held by everything
function assetWorkHold(db, asset, jobKind) {
  if (!asset) return { code: 'ASSET_UNKNOWN' };
  if (asset.state === 'WITHDRAWN')
    return { code: 'ASSET_WITHDRAWN', asset_id: asset.id, asset_state: asset.state };
  const od = inspectionOverdue(db, asset);
  if (od && jobKind !== 'INSPECTION')
    return { code: 'INSPECTION_OVERDUE', asset_id: asset.id, asset_state: asset.state, ...od };
  if (UNAVAILABLE_STATES.includes(asset.state) && jobKind === 'RENEWAL')
    return { code: 'ASSET_UNAVAILABLE', asset_id: asset.id, asset_state: asset.state,
             unavailable_states: UNAVAILABLE_STATES };
  return null;
}

// The last inspection recorded on an asset, by insertion order.
function latestInspection(db, assetId) {
  return db.prepare('SELECT * FROM asset_inspections WHERE asset_id = ? ORDER BY seq DESC LIMIT 1').get(assetId) || null;
}

// The completed handback of the work on an asset is the thing that puts it
// back. Signing the job off does not, and neither does marking the maintenance
// finished - so this looks for a COMPLETE handback against the asset.
function completedHandback(db, assetId) {
  return db.prepare("SELECT * FROM handbacks WHERE asset_id = ? AND state = 'COMPLETE' ORDER BY completed_at DESC, id DESC LIMIT 1")
    .get(assetId) || null;
}

// Returning an asset to service waits on EVERY hold being gone: the overdue
// inspection, and - for an asset that is out of service - the completed
// handback of the work on it. `opts.handback` lets the handback that is being
// completed right now satisfy the second, which is the whole point of it.
function returnToServiceHold(db, asset, opts) {
  if (!asset) return { code: 'ASSET_UNKNOWN' };
  if (asset.state === 'IN_SERVICE')
    return { code: 'ALREADY_IN_SERVICE', asset_id: asset.id, asset_state: asset.state };
  const od = inspectionOverdue(db, asset);
  if (od) return { code: 'INSPECTION_OVERDUE', asset_id: asset.id, asset_state: asset.state, ...od };
  const hb = (opts && opts.handback) || completedHandback(db, asset.id);
  const last = latestInspection(db, asset.id);
  if (UNAVAILABLE_STATES.includes(asset.state) && !hb)
    return {
      code: 'NO_COMPLETED_HANDBACK', asset_id: asset.id, asset_state: asset.state,
      requires: 'the completed handback of the work on this asset',
      completed_handback_id: null,
      latest_inspection_id: last ? last.id : null,
      latest_inspection_result: last ? last.result : null,
    };
  return null;
}

// ------------------------------------------------------------------ blockages
function activeBlockage(db, sectionId) {
  return db.prepare("SELECT * FROM line_blockages WHERE section_id = ? AND state = 'ACTIVE' ORDER BY id LIMIT 1")
    .get(sectionId) || null;
}
function blockageRefusal(b) {
  return {
    code: 'SECTION_BLOCKED', blockage_id: b.id, section_id: b.section_id,
    blockage_state: b.state, placed_by: b.placed_by, reason: b.reason,
  };
}

// ------------------------------------------------------------------ competence
// The distinct competences an asset kind demands. The requirement table lists
// the same pair more than once on purpose; the demand is the SET.
function requiredCompetences(db, assetKind) {
  const rows = db.prepare('SELECT requires FROM competence_requirements WHERE asset_kind = ?').all(assetKind);
  return [...new Set(rows.map((r) => r.requires))];
}
function heldCompetences(tech) {
  return String(tech.competences || '').split(',').filter(Boolean);
}

// The competence check, evaluated AT A MOMENT the caller names. Assignment
// passes the stored reference date; execution passes the moment the work is
// actually done. The two are deliberately different tests.
function competenceCheck(db, tech, asset, atIso, moment) {
  if (!tech) return { ok: false, code: 'TECHNICIAN_UNKNOWN' };
  if (!asset) return { ok: false, code: 'ASSET_UNKNOWN' };
  const required = requiredCompetences(db, asset.kind);
  const held = heldCompetences(tech);
  const missing = required.filter((c) => !held.includes(c));
  if (missing.length) {
    return {
      ok: false, code: 'COMPETENCE_NOT_HELD', moment, technician_id: tech.id, asset_id: asset.id,
      asset_kind: asset.kind, required_competence: required, held_competence: held, missing_competence: missing,
    };
  }
  const at = dayOf(atIso);
  if (tech.competence_expires_on < at) {
    return {
      ok: false, code: moment === 'EXECUTION' ? 'COMPETENCE_EXPIRED_AT_EXECUTION' : 'COMPETENCE_EXPIRED_AT_ASSIGNMENT',
      moment, technician_id: tech.id, asset_id: asset.id, asset_kind: asset.kind,
      required_competence: required, expires_on: tech.competence_expires_on,
      evaluated_at: atIso, evaluated_on: at, expired_by_days: daysBetween(tech.competence_expires_on, at),
    };
  }
  return { ok: true, moment, required_competence: required, expires_on: tech.competence_expires_on, evaluated_at: atIso };
}

// ------------------------------------------------------------------ possessions
const LIVE_POSSESSION_STATES = ['APPROVED', 'EXECUTING'];

// Two plans on one section conflict when their half-open spans overlap.
// Touching endpoints (one ends exactly as the other starts) are fine.
function possessionConflict(db, sectionId, startsAt, endsAt, excludeId, states) {
  const st = states || LIVE_POSSESSION_STATES;
  const rows = db.prepare(
    `SELECT * FROM possession_plans WHERE section_id = ? AND id != ? AND state IN (${st.map(() => '?').join(',')})
       ORDER BY starts_at, id`
  ).all(sectionId, excludeId || '', ...st);
  const aS = Date.parse(startsAt), aE = Date.parse(endsAt);
  for (const r of rows) {
    const bS = Date.parse(r.starts_at), bE = Date.parse(r.ends_at);
    if (aS < bE && bS < aE) {
      return {
        code: 'POSSESSION_CONFLICT', overlaps_with: r.id, overlaps_with_state: r.state,
        section_id: sectionId,
        conflict_starts_at: new Date(Math.max(aS, bS)).toISOString().replace('.000', ''),
        conflict_ends_at: new Date(Math.min(aE, bE)).toISOString().replace('.000', ''),
        requested_starts_at: startsAt, requested_ends_at: endsAt,
        existing_starts_at: r.starts_at, existing_ends_at: r.ends_at,
      };
    }
  }
  return null;
}

const MATERIAL_POSSESSION_FIELDS = ['section_id', 'starts_at', 'ends_at'];

function materialChanges(plan, patch) {
  const changed = [];
  for (const f of MATERIAL_POSSESSION_FIELDS) {
    if (patch[f] !== undefined && String(patch[f]) !== String(plan[f])) changed.push(f);
  }
  return changed;
}

// The possession a job would be executed under, if any: an approved or
// executing plan on the job's asset's section.
function possessionForJob(db, job, asset) {
  return db.prepare(
    `SELECT * FROM possession_plans WHERE section_id = ? AND state IN ('APPROVED','EXECUTING') ORDER BY starts_at LIMIT 1`
  ).get(asset.section_id) || null;
}

// ------------------------------------------------------------------ periods
function openPeriod(db) {
  return db.prepare("SELECT * FROM settlement_periods WHERE state = 'OPEN' ORDER BY id LIMIT 1").get() || null;
}
function periodClosed(db, periodId) {
  const p = db.prepare('SELECT * FROM settlement_periods WHERE id = ?').get(periodId);
  return !!p && p.state === 'CLOSED';
}
function anyPeriodClosed(db) {
  return !!db.prepare("SELECT 1 FROM settlement_periods WHERE state = 'CLOSED' LIMIT 1").get();
}

// ------------------------------------------------------------------ settlement inputs
function bands(db) {
  return db.prepare('SELECT * FROM delay_penalty_bands ORDER BY sequence').all();
}
function windows(db) {
  return db.prepare('SELECT * FROM major_disruption_windows ORDER BY starts_at').all();
}
function delayMinutesFor(db, incidentId) {
  return db.prepare('SELECT COALESCE(SUM(delay_minutes),0) AS m FROM delay_records WHERE incident_id = ?')
    .get(incidentId).m;
}
// A credit earmarked for this incident and still available. A credit with no
// incident is a floating credit and is never auto-applied.
function creditFor(db, incidentId) {
  return db.prepare("SELECT * FROM mutual_aid_credits WHERE incident_id = ? AND state = 'AVAILABLE' ORDER BY id LIMIT 1")
    .get(incidentId) || null;
}

const SETTLEABLE_INCIDENT_STATES = ['CLEARED', 'SETTLE_READY'];


const LIVE_JOB_STATES = ['ASSIGNED', 'IN_PROGRESS'];

// A job is HELD once a team has CLAIMED it off the board, or once the work on
// it is actually under way. A job a desk has merely planned onto a team is not
// yet held: planning is allowed and always has been, and it is holding - the
// claim, or the dispatch - that shuts everybody else out.
const HELD = "(claimed_at IS NOT NULL OR state = 'IN_PROGRESS')";

// "An asset takes one team at a time." Jobs may sit open against the same asset,
// but once one of them is claimed the others cannot be.
function assetClaimedByOtherTeam(db, assetId, teamId, excludeJobId) {
  return db.prepare(
    `SELECT * FROM jobs WHERE asset_id = ? AND id != ? AND team_id IS NOT NULL
       AND team_id != ? AND state IN (${LIVE_JOB_STATES.map(() => '?').join(',')}) AND ${HELD}`
  ).get(assetId, excludeJobId || '', teamId, ...LIVE_JOB_STATES) || null;
}

// "A technician is on one claimed job at a time." Distinct from the callout
// merge on the wage bill - that is money, this is the roster.
function technicianLiveJob(db, technicianId, excludeJobId) {
  return db.prepare(
    `SELECT * FROM jobs WHERE technician_id = ? AND id != ?
       AND state IN (${LIVE_JOB_STATES.map(() => '?').join(',')}) AND ${HELD}`
  ).get(technicianId, excludeJobId || '', ...LIVE_JOB_STATES) || null;
}

module.exports = {
  LIVE_JOB_STATES, assetClaimedByOtherTeam, technicianLiveJob,
  ROLE_AREAS, ALL_ROLES, can, clock, dayOf, daysBetween,
  inspectionOverdue, UNAVAILABLE_STATES, assetWorkHold, latestInspection, completedHandback, returnToServiceHold,
  activeBlockage, blockageRefusal,
  requiredCompetences, heldCompetences, competenceCheck,
  LIVE_POSSESSION_STATES, possessionConflict, MATERIAL_POSSESSION_FIELDS, materialChanges, possessionForJob,
  openPeriod, periodClosed, anyPeriodClosed,
  bands, windows, delayMinutesFor, creditFor, SETTLEABLE_INCIDENT_STATES,
};
