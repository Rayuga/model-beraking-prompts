import crypto from 'crypto';
import { db } from './db.js';
import { ROLES } from './ids.js';
import { badRequest, conflict, forbidden, notFound } from './errors.js';

export function id() {
  return crypto.randomUUID();
}

export function money(cents) {
  return Math.round(Number(cents) || 0);
}

export function hoursBetween(start, end) {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) {
    throw badRequest('Window end must be after window start');
  }
  return (b - a) / 36e5;
}

export function sameDay(iso) {
  return String(iso).slice(0, 10);
}

export function coveredDays(start, end) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    throw badRequest('Window end must be after window start');
  }
  const days = [];
  let cursor = new Date(startMs);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() < endMs) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 864e5);
  }
  return days;
}

export function hoursOnDay(start, end, day) {
  const dayStart = new Date(`${day}T00:00:00.000Z`).getTime();
  const dayEnd = dayStart + 864e5;
  const overlapStart = Math.max(new Date(start).getTime(), dayStart);
  const overlapEnd = Math.min(new Date(end).getTime(), dayEnd);
  return Math.max(0, overlapEnd - overlapStart) / 36e5;
}

export function lastCoveredDay(end) {
  const endMs = new Date(end).getTime();
  if (Number.isNaN(endMs)) throw badRequest('Assignment window is invalid');
  return new Date(endMs - 1).toISOString().slice(0, 10);
}

export function windowsOverlap(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export function getRo(roId) {
  const row = db.prepare(`
    SELECT ro.*, c.name AS customer_name, c.status AS customer_status,
           v.vin, v.make, v.model, v.year, v.mileage AS vehicle_mileage,
           v.drivetrain, v.engine_family, v.status AS vehicle_status, v.license_plate
    FROM repair_orders ro
    JOIN customers c ON c.id = ro.customer_id
    JOIN vehicles v ON v.id = ro.vehicle_id
    WHERE ro.id = ?
  `).get(roId);
  if (!row) throw notFound('Repair order not found');
  return row;
}

export function getEstimate(idValue) {
  const row = db.prepare('SELECT * FROM estimates WHERE id = ?').get(idValue);
  if (!row) throw notFound('Estimate not found');
  return row;
}

export function getBay(idValue) {
  const row = db.prepare('SELECT * FROM bays WHERE id = ?').get(idValue);
  if (!row) throw notFound('Bay not found');
  return row;
}

export function getPart(idValue) {
  const row = db.prepare('SELECT * FROM parts WHERE id = ?').get(idValue);
  if (!row) throw notFound('Part not found');
  return row;
}

export function getTech(idValue) {
  const row = db.prepare(`
    SELECT t.*, u.full_name, u.email
    FROM technicians t
    JOIN users u ON u.id = t.user_id
    WHERE t.id = ?
  `).get(idValue);
  if (!row) throw notFound('Technician not found');
  return row;
}

export function techForUser(user) {
  return db.prepare('SELECT * FROM technicians WHERE user_id = ?').get(user.id);
}

export function requireStaff(user) {
  if (user.role === ROLES.CUSTOMER) throw forbidden('Staff access required');
}

export function assertNotInvoiced(ro) {
  if (ro.status === 'INVOICED' || ro.status === 'CLOSED') {
    throw conflict('Invoiced repair orders cannot be silently altered', 'INVOICED_IMMUTABLE');
  }
}

export function refreshPartStatus(partId) {
  const part = getPart(partId);
  const incoming = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS qty FROM shipments
    WHERE part_id = ? AND status = 'INCOMING'
  `).get(partId).qty;
  const available = part.quantity_on_hand - part.quantity_reserved;
  let status = 'IN_STOCK';
  if (part.quantity_on_hand <= 0 && incoming > 0) status = 'ON_ORDER';
  else if (part.quantity_on_hand <= 0) status = 'BACKORDERED';
  else if (part.quantity_reserved > 0 && available <= 0) status = 'RESERVED';
  else if (part.quantity_on_hand <= part.reorder_threshold) status = 'LOW_STOCK';
  db.prepare('UPDATE parts SET status = ? WHERE id = ?').run(status, partId);
  return getPart(partId);
}

export function partCompatible(partId, vehicle) {
  const rules = db.prepare('SELECT * FROM part_compatibilities WHERE part_id = ?').all(partId);
  if (!rules.length) return true;
  return rules.some((rule) => {
    if (rule.make && rule.make !== vehicle.make) return false;
    if (rule.model && rule.model !== vehicle.model) return false;
    if (rule.drivetrain && rule.drivetrain !== vehicle.drivetrain) return false;
    if (rule.engine_family && rule.engine_family !== vehicle.engine_family) return false;
    if (rule.year_from && vehicle.year < rule.year_from) return false;
    if (rule.year_to && vehicle.year > rule.year_to) return false;
    return true;
  });
}

export function certValid(technicianId, certType, onDate) {
  if (!certType) return true;
  const cert = db.prepare(`
    SELECT * FROM certifications
    WHERE technician_id = ? AND cert_type = ?
  `).get(technicianId, certType);
  if (!cert) return false;
  return cert.expires_on >= String(onDate).slice(0, 10);
}

export function requiredCertsForRo(roId) {
  const rows = db.prepare(`
    SELECT DISTINCT required_certification
    FROM estimate_line_items
    WHERE repair_order_id = ?
      AND required_certification IS NOT NULL
      AND customer_approval = 'APPROVED'
  `).all(roId);
  return rows.map((r) => r.required_certification);
}

export function estimateTotals(estimateId) {
  const rows = db.prepare('SELECT * FROM estimate_line_items WHERE estimate_id = ?').all(estimateId);
  const approved = rows.filter((r) => r.customer_approval === 'APPROVED');
  const declined = rows.filter((r) => r.customer_approval === 'DECLINED');
  const pending = rows.filter((r) => r.customer_approval === 'NONE');
  const sum = (list) => list.reduce((n, r) => n + r.amount_cents, 0);
  return {
    lines: rows,
    approved,
    declined,
    pending,
    total_cents: sum(rows),
    approved_cents: sum(approved),
    pending_cents: sum(pending)
  };
}

export function refreshEstimateStatus(estimateId) {
  const est = getEstimate(estimateId);
  if (est.status === 'EXPIRED' || est.status === 'REJECTED') return est;
  const { lines, approved, declined, pending } = estimateTotals(estimateId);
  let status = est.status;
  if (!lines.length) status = 'DRAFT';
  else if (declined.length === lines.length) status = 'REJECTED';
  else if (approved.length === lines.length && est.staff_approved_by) status = 'APPROVED';
  else if (approved.length === lines.length) status = 'PENDING_STAFF_APPROVAL';
  else if (approved.length && pending.length) status = 'PARTIALLY_APPROVED';
  else if (est.sent_at && pending.length === lines.length) status = 'PENDING_APPROVAL';
  db.prepare('UPDATE estimates SET status = ? WHERE id = ?').run(status, estimateId);
  return getEstimate(estimateId);
}

export function expireEstimates() {
  const today = new Date().toISOString();
  db.prepare(`
    UPDATE estimates
    SET status = 'EXPIRED'
    WHERE expires_at IS NOT NULL
      AND expires_at < ?
      AND status IN ('DRAFT','PENDING_APPROVAL','PARTIALLY_APPROVED','PENDING_STAFF_APPROVAL','APPROVED')
  `).run(today.slice(0, 10));
}

export function activeBooking(roId) {
  return db.prepare(`
    SELECT * FROM bay_bookings
    WHERE repair_order_id = ? AND status = 'ACTIVE'
    ORDER BY created_at DESC
  `).get(roId);
}

export function activeAssignments(roId) {
  return db.prepare(`
    SELECT a.*, t.user_id, u.full_name
    FROM technician_assignments a
    JOIN technicians t ON t.id = a.technician_id
    JOIN users u ON u.id = t.user_id
    WHERE a.repair_order_id = ? AND a.status = 'ACTIVE'
  `).all(roId);
}

export function overlappingBay(bayId, start, end, exceptId) {
  const rows = db.prepare(`
    SELECT * FROM bay_bookings
    WHERE bay_id = ? AND status = 'ACTIVE'
  `).all(bayId);
  return rows.find((row) => row.id !== exceptId && windowsOverlap(start, end, row.window_start, row.window_end));
}

export function overlappingTech(technicianId, start, end, exceptId) {
  const rows = db.prepare(`
    SELECT * FROM technician_assignments
    WHERE technician_id = ? AND status = 'ACTIVE'
  `).all(technicianId);
  return rows.find((row) => row.id !== exceptId && windowsOverlap(start, end, row.window_start, row.window_end));
}

export function techHoursOnDay(technicianId, day) {
  const rows = db.prepare(`
    SELECT * FROM technician_assignments
    WHERE technician_id = ? AND status = 'ACTIVE'
      AND window_start < ? AND window_end > ?
  `).all(technicianId, `${day}T24:00:00.000Z`, `${day}T00:00:00.000Z`);
  return rows.reduce((n, row) => n + hoursOnDay(row.window_start, row.window_end, day), 0);
}

export function openClaims(roId) {
  return db.prepare(`
    SELECT * FROM warranty_claims
    WHERE repair_order_id = ? AND status IN ('FILED','UNDER_REVIEW')
  `).all(roId);
}

export function lineClaim(lineItemId) {
  return db.prepare('SELECT * FROM warranty_claims WHERE line_item_id = ?').get(lineItemId);
}

export function nextNumber(prefix, table, column) {
  const row = db.prepare(`SELECT ${column} AS num FROM ${table} WHERE ${column} LIKE ? ORDER BY ${column} DESC`).get(`${prefix}-%`);
  const last = row?.num ? Number(String(row.num).split('-')[1]) : 1000;
  return `${prefix}-${String(last + 1).padStart(4, '0')}`;
}

export function customerCanSee(user, customerId) {
  if (user.role !== ROLES.CUSTOMER) return true;
  return user.customer_id === customerId;
}

export function assertRoAccess(user, ro) {
  if (user.role === ROLES.CUSTOMER && user.customer_id !== ro.customer_id) {
    throw forbidden('Cannot access another customer\'s repair order');
  }
  if (user.role === ROLES.TECHNICIAN) {
    const tech = techForUser(user);
    if (!tech) throw forbidden('Technician profile missing');
    const assigned = db.prepare(`
      SELECT 1 FROM technician_assignments
      WHERE technician_id = ? AND repair_order_id = ? AND status = 'ACTIVE'
    `).get(tech.id, ro.id);
    const ownOpen = ro.opened_by === user.id;
    if (!assigned && !ownOpen && !['DRAFT', 'DIAGNOSING'].includes(ro.status)) {
      const any = db.prepare(`
        SELECT 1 FROM technician_assignments
        WHERE technician_id = ? AND repair_order_id = ?
      `).get(tech.id, ro.id);
      if (!any) throw forbidden('Technician is not assigned to this repair order');
    }
  }
}

export function docsComplete(roId) {
  const lines = db.prepare(`
    SELECT * FROM estimate_line_items
    WHERE repair_order_id = ?
      AND customer_approval = 'APPROVED'
      AND documentation_required IS NOT NULL
  `).all(roId);
  for (const line of lines) {
    const doc = db.prepare(`
      SELECT 1 FROM job_documents
      WHERE line_item_id = ? AND doc_type = ?
    `).get(line.id, line.documentation_required);
    if (!doc) return { ok: false, line };
  }
  return { ok: true };
}

export function refreshTechStatus(technicianId) {
  const tech = getTech(technicianId);
  if (tech.status === 'SUSPENDED' || tech.status === 'OFF_DUTY') return tech;
  const active = db.prepare(`
    SELECT * FROM technician_assignments
    WHERE technician_id = ? AND status = 'ACTIVE'
  `).all(technicianId);
  const now = Date.now();
  const onJob = active.some((a) => new Date(a.window_start).getTime() <= now && now < new Date(a.window_end).getTime());
  const status = onJob ? 'ON_JOB' : active.length ? 'ASSIGNED' : 'AVAILABLE';
  db.prepare('UPDATE technicians SET status = ? WHERE id = ?').run(status, technicianId);
  return getTech(technicianId);
}

export function customerAccountStatus(customerId) {
  const row = db.prepare('SELECT status FROM customers WHERE id = ?').get(customerId);
  return row?.status || null;
}

export function assertCustomerCanCommitWork(customerOrStatus) {
  const status = customerOrStatus && typeof customerOrStatus === 'object'
    ? (customerOrStatus.status || customerOrStatus.customer_status || customerAccountStatus(customerOrStatus.customer_id))
    : customerOrStatus;
  if (status === 'ON_HOLD') {
    throw conflict('This customer account is on hold and cannot take on new shop commitments.', 'CUSTOMER_HOLD');
  }
  if (status === 'SUSPENDED') {
    throw conflict('Suspended accounts cannot take on new shop commitments.', 'CUSTOMER_SUSPENDED');
  }
}

export function assertRoCustomerCanCommit(ro) {
  if (!ro) throw notFound('Repair order not found');
  assertCustomerCanCommitWork(customerAccountStatus(ro.customer_id));
}

export function syncVehicleFromRo(ro) {
  const map = {
    IN_PROGRESS: 'IN_BAY',
    AWAITING_PARTS: 'AWAITING_PARTS',
    ESTIMATE_PENDING: 'AWAITING_APPROVAL',
    COMPLETED: 'READY_FOR_PICKUP',
    INVOICED: 'READY_FOR_PICKUP',
    CLOSED: 'PICKED_UP',
    CANCELLED: 'CHECKED_IN',
    DRAFT: 'CHECKED_IN',
    DIAGNOSING: 'CHECKED_IN',
    ESTIMATE_APPROVED: 'AWAITING_APPROVAL'
  };
  const status = map[ro.status];
  if (status) {
    db.prepare('UPDATE vehicles SET status = ? WHERE id = ?').run(status, ro.vehicle_id);
  }
}
