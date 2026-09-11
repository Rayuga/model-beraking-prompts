import { db } from './db.js';
import { writeAudit } from './audit.js';
import { ROLES } from './ids.js';
import { badRequest, conflict, forbidden, notFound } from './errors.js';
import {
  activeAssignments,
  activeBooking,
  assertNotInvoiced,
  assertRoAccess,
  certValid,
  customerCanSee,
  coveredDays,
  docsComplete,
  estimateTotals,
  expireEstimates,
  getBay,
  getEstimate,
  getPart,
  getRo,
  getTech,
  hoursOnDay,
  id,
  lineClaim,
  lastCoveredDay,
  nextNumber,
  openClaims,
  overlappingBay,
  overlappingTech,
  partCompatible,
  refreshEstimateStatus,
  refreshPartStatus,
  refreshTechStatus,
  requiredCertsForRo,
  requireStaff,
  sameDay,
  assertCustomerCanCommitWork,
  assertRoCustomerCanCommit,
  syncVehicleFromRo,
  techForUser,
  techHoursOnDay
} from './helpers.js';

const TAX_RATE = 0.085;
const ADVISOR_ROLES = [ROLES.SERVICE_ADVISOR, ROLES.SHOP_MANAGER];
const FLOOR_ROLES = [ROLES.SERVICE_ADVISOR, ROLES.SHOP_FOREMAN, ROLES.SHOP_MANAGER];
const FINANCE_ROLES = [ROLES.SHOP_MANAGER];

function ignoreClientAuth(body) {
  if (!body || typeof body !== 'object') return {};
  const clone = { ...body };
  for (const key of [
    'role', 'userId', 'user_id', 'actorId', 'actorRole',
    'ownerId', 'owner_id',
    'approved', 'approval_status', 'customer_approval', 'staff_approved',
    'available', 'availability', 'bay_available', 'technician_available',
    'total', 'total_cents', 'invoice_total',
    'status', 'paid', 'void', 'payment_status', 'invoice_status'
  ]) {
    delete clone[key];
  }
  return clone;
}

export function listDemoUsers() {
  return db.prepare(`
    SELECT id, email, full_name, role, customer_id
    FROM users
    ORDER BY
      CASE role
        WHEN 'SERVICE_ADVISOR' THEN 0
        WHEN 'SHOP_MANAGER' THEN 1
        WHEN 'SHOP_FOREMAN' THEN 2
        WHEN 'PARTS_MANAGER' THEN 3
        WHEN 'WARRANTY_ADMIN' THEN 4
        WHEN 'TECHNICIAN' THEN 5
        ELSE 6
      END,
      full_name
  `).all();
}

export function listCustomers(user, query = {}) {
  requireStaffUnlessCustomer(user);
  let rows;
  if (user.role === ROLES.CUSTOMER) {
    rows = db.prepare('SELECT * FROM customers WHERE id = ?').all(user.customer_id);
  } else {
    rows = db.prepare('SELECT * FROM customers ORDER BY name').all();
  }
  const q = String(query.q || '').toLowerCase();
  const status = query.status;
  return rows.filter((c) => {
    if (status && c.status !== status) return false;
    if (q && !`${c.name} ${c.contact_name} ${c.email}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function getCustomer(user, customerId) {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) throw notFound('Customer not found');
  if (!customerCanSee(user, customer.id)) throw forbidden('Cannot access another customer account');
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE customer_id = ?').all(customer.id);
  return { ...customer, vehicles };
}

export function createCustomer(user, body) {
  requireRoles(user, [ROLES.SERVICE_ADVISOR, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  if (!data.name) throw badRequest('Customer name is required');
  const customerId = id();
  db.prepare(`
    INSERT INTO customers (id, name, contact_name, email, phone, billing_address, preferred_contact, status, outstanding_balance_cents)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
  `).run(
    customerId,
    data.name,
    data.contact_name || null,
    data.email || null,
    data.phone || null,
    data.billing_address || null,
    data.preferred_contact || 'EMAIL',
    Number(data.outstanding_balance_cents || 0)
  );
  writeAudit(user, 'CUSTOMER_CREATED', 'customer', customerId, null, 'ACTIVE', data.name);
  return getCustomer(user, customerId);
}

export function setCustomerHold(user, customerId, body) {
  requireRoles(user, [ROLES.SHOP_MANAGER, ROLES.SERVICE_ADVISOR]);
  const data = ignoreClientAuth(body);
  const customer = getCustomer(user, customerId);
  const place = data.hold !== false && data.status !== 'ACTIVE';
  if (user.role === ROLES.SERVICE_ADVISOR && place) {
    throw forbidden('Only a shop manager can place a financial hold');
  }
  const next = place ? 'ON_HOLD' : 'ACTIVE';
  if (next === customer.status) return customer;
  if (next === 'ACTIVE' && !data.reason && user.role === ROLES.SHOP_MANAGER && customer.status === 'ON_HOLD') {
    throw badRequest('Reason is required to lift a hold');
  }
  db.prepare('UPDATE customers SET status = ?, hold_reason = ? WHERE id = ?').run(
    next,
    next === 'ON_HOLD' ? (data.reason || 'Financial hold') : null,
    customerId
  );
  writeAudit(
    user,
    next === 'ON_HOLD' ? 'CUSTOMER_HOLD_PLACED' : 'CUSTOMER_HOLD_REMOVED',
    'customer',
    customerId,
    customer.status,
    next,
    data.reason || null
  );
  return getCustomer(user, customerId);
}

export function listVehicles(user, query = {}) {
  let rows = db.prepare(`
    SELECT v.*, c.name AS customer_name
    FROM vehicles v
    JOIN customers c ON c.id = v.customer_id
    ORDER BY c.name, v.year DESC
  `).all();
  if (user.role === ROLES.CUSTOMER) {
    rows = rows.filter((v) => v.customer_id === user.customer_id);
  }
  const q = String(query.q || '').toLowerCase();
  return rows.filter((v) => {
    if (query.status && v.status !== query.status) return false;
    if (query.customer_id && v.customer_id !== query.customer_id) return false;
    if (q && !`${v.vin} ${v.make} ${v.model} ${v.license_plate} ${v.customer_name}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function getVehicle(user, vehicleId) {
  const vehicle = db.prepare(`
    SELECT v.*, c.name AS customer_name, c.status AS customer_status
    FROM vehicles v JOIN customers c ON c.id = v.customer_id
    WHERE v.id = ?
  `).get(vehicleId);
  if (!vehicle) throw notFound('Vehicle not found');
  if (!customerCanSee(user, vehicle.customer_id)) throw forbidden('Cannot access another customer\'s vehicle');
  const coverages = db.prepare('SELECT * FROM warranty_coverages WHERE vehicle_id = ?').all(vehicleId);
  const history = db.prepare(`
    SELECT id, number, status, intake_mileage, intake_notes, created_at
    FROM repair_orders WHERE vehicle_id = ? ORDER BY created_at DESC
  `).all(vehicleId);
  return { ...vehicle, coverages, service_history: history };
}

export function checkInVehicle(user, body) {
  requireRoles(user, ADVISOR_ROLES);
  const data = ignoreClientAuth(body);
  if (!data.customer_id || !data.vin || !data.make || !data.model || !data.year || data.mileage == null) {
    throw badRequest('Customer, VIN, make, model, year, and mileage are required');
  }
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(data.customer_id);
  if (!customer) throw notFound('Customer not found');
  const existing = db.prepare('SELECT * FROM vehicles WHERE vin = ?').get(data.vin);
  if (existing) {
    if (Number(data.mileage) < existing.mileage) {
      throw badRequest('Odometer regression is not allowed', 'ODOMETER_REGRESSION');
    }
    db.prepare(`
      UPDATE vehicles SET mileage = ?, status = 'CHECKED_IN', license_plate = COALESCE(?, license_plate)
      WHERE id = ?
    `).run(Number(data.mileage), data.license_plate || null, existing.id);
    return getVehicle(user, existing.id);
  }
  const vehicleId = data.id || id();
  db.prepare(`
    INSERT INTO vehicles (id, customer_id, vin, make, model, year, license_plate, mileage, drivetrain, engine_family, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CHECKED_IN')
  `).run(
    vehicleId,
    data.customer_id,
    data.vin,
    data.make,
    data.model,
    Number(data.year),
    data.license_plate || null,
    Number(data.mileage),
    data.drivetrain || 'GAS',
    data.engine_family || null
  );
  writeAudit(user, 'VEHICLE_CHECKED_IN', 'vehicle', vehicleId, null, 'CHECKED_IN', data.vin);
  return getVehicle(user, vehicleId);
}

export function updateVehicle(user, vehicleId, body) {
  requireRoles(user, [ROLES.SERVICE_ADVISOR, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  const vehicle = getVehicle(user, vehicleId);
  if (data.mileage != null && Number(data.mileage) < vehicle.mileage) {
    throw badRequest('Odometer regression is not allowed', 'ODOMETER_REGRESSION');
  }
  db.prepare(`
    UPDATE vehicles
    SET mileage = COALESCE(?, mileage),
        license_plate = COALESCE(?, license_plate),
        engine_family = COALESCE(?, engine_family)
    WHERE id = ?
  `).run(
    data.mileage == null ? null : Number(data.mileage),
    data.license_plate ?? null,
    data.engine_family ?? null,
    vehicleId
  );
  writeAudit(user, 'VEHICLE_UPDATED', 'vehicle', vehicleId, String(vehicle.mileage), String(data.mileage ?? vehicle.mileage), 'Profile update; historical RO intake mileage is unchanged');
  return getVehicle(user, vehicleId);
}

export function listRepairOrders(user, query = {}) {
  expireEstimates();
  let rows = db.prepare(`
    SELECT ro.*, c.name AS customer_name, v.make, v.model, v.year, v.vin, v.license_plate
    FROM repair_orders ro
    JOIN customers c ON c.id = ro.customer_id
    JOIN vehicles v ON v.id = ro.vehicle_id
    ORDER BY ro.created_at DESC
  `).all();
  if (user.role === ROLES.CUSTOMER) {
    rows = rows.filter((r) => r.customer_id === user.customer_id);
  } else if (user.role === ROLES.TECHNICIAN) {
    const tech = techForUser(user);
    const assigned = new Set(
      db.prepare('SELECT repair_order_id FROM technician_assignments WHERE technician_id = ?').all(tech?.id).map((r) => r.repair_order_id)
    );
    rows = rows.filter((r) => assigned.has(r.id));
  }
  const q = String(query.q || '').toLowerCase();
  return rows.filter((r) => {
    if (query.status && r.status !== query.status) return false;
    if (query.customer_id && r.customer_id !== query.customer_id) return false;
    if (query.priority && r.priority !== query.priority) return false;
    if (q && !`${r.number} ${r.customer_name} ${r.vin} ${r.make} ${r.model}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function getRepairOrder(user, roId) {
  expireEstimates();
  const ro = getRo(roId);
  assertRoAccess(user, ro);
  const estimates = db.prepare('SELECT * FROM estimates WHERE repair_order_id = ? ORDER BY revision DESC, created_at DESC').all(roId);
  const lines = db.prepare('SELECT * FROM estimate_line_items WHERE repair_order_id = ? ORDER BY created_at').all(roId);
  const bookings = db.prepare(`
    SELECT b.*, bay.number AS bay_number, bay.name AS bay_name, bay.status AS bay_status, bay.type AS bay_type
    FROM bay_bookings b JOIN bays bay ON bay.id = b.bay_id
    WHERE b.repair_order_id = ? ORDER BY b.created_at DESC
  `).all(roId);
  const assignments = db.prepare(`
    SELECT a.*, u.full_name AS technician_name, t.status AS technician_status
    FROM technician_assignments a
    JOIN technicians t ON t.id = a.technician_id
    JOIN users u ON u.id = t.user_id
    WHERE a.repair_order_id = ? ORDER BY a.created_at DESC
  `).all(roId);
  const reservations = db.prepare(`
    SELECT r.*, p.part_number, p.description
    FROM part_reservations r JOIN parts p ON p.id = r.part_id
    WHERE r.repair_order_id = ?
  `).all(roId);
  const claims = db.prepare('SELECT * FROM warranty_claims WHERE repair_order_id = ?').all(roId);
  const documents = db.prepare('SELECT * FROM job_documents WHERE repair_order_id = ?').all(roId);
  const labor = db.prepare(`
    SELECT l.*, u.full_name AS technician_name
    FROM labor_logs l
    JOIN technicians t ON t.id = l.technician_id
    JOIN users u ON u.id = t.user_id
    WHERE l.repair_order_id = ?
  `).all(roId);
  const invoices = db.prepare('SELECT * FROM invoices WHERE repair_order_id = ?').all(roId);
  return { ...ro, estimates, lines, bookings, assignments, reservations, claims, documents, labor, invoices };
}

export function createRepairOrder(user, body) {
  requireRoles(user, ADVISOR_ROLES);
  const raw = body && typeof body === 'object' ? body : {};
  const data = ignoreClientAuth(raw);
  const customerId = raw.customer_id || raw.customerId || data.customer_id;
  const vehicleId = raw.vehicle_id || raw.vehicleId || data.vehicle_id;
  if (!customerId || !vehicleId) throw badRequest('Customer and vehicle are required');
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) throw notFound('Customer not found');
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
  if (!vehicle || vehicle.customer_id !== customer.id) throw badRequest('Vehicle does not belong to that customer');
  const mileage = data.intake_mileage != null ? Number(data.intake_mileage) : vehicle.mileage;
  if (mileage < vehicle.mileage) throw badRequest('Odometer regression is not allowed', 'ODOMETER_REGRESSION');
  const requestedStatus = raw.status && raw.status !== 'DRAFT' ? raw.status : 'DRAFT';
  if (requestedStatus !== 'DRAFT') {
    assertCustomerCanCommitWork(customer);
  }
  const roId = id();
  const number = nextNumber('RO', 'repair_orders', 'number');
  db.prepare(`
    INSERT INTO repair_orders (
      id, number, customer_id, vehicle_id, opened_by, intake_notes, intake_mileage, priority, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')
  `).run(
    roId,
    number,
    customer.id,
    vehicle.id,
    user.id,
    data.intake_notes || null,
    mileage,
    data.priority || 'NORMAL'
  );
  if (mileage > vehicle.mileage) {
    db.prepare('UPDATE vehicles SET mileage = ? WHERE id = ?').run(mileage, vehicle.id);
  }
  writeAudit(user, 'REPAIR_ORDER_OPENED', 'repair_order', roId, null, 'DRAFT', number);
  return getRepairOrder(user, roId);
}

export function recordDiagnostics(user, roId, body) {
  requireRoles(user, [ROLES.SERVICE_ADVISOR, ROLES.TECHNICIAN, ROLES.SHOP_FOREMAN, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  const ro = getRo(roId);
  assertRoAccess(user, ro);
  assertNotInvoiced(ro);
  if (ro.status === 'CANCELLED' || ro.status === 'COMPLETED') {
    throw conflict('Cannot add diagnostics to a closed repair order');
  }
  if (ro.status === 'DRAFT') {
    assertRoCustomerCanCommit(ro);
  }
  const next = ro.status === 'DRAFT' ? 'DIAGNOSING' : ro.status;
  db.prepare(`
    UPDATE repair_orders
    SET diagnostic_findings = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(data.findings || data.diagnostic_findings || '', next, roId);
  writeAudit(user, 'DIAGNOSTICS_RECORDED', 'repair_order', roId, ro.status, next, data.findings || null);
  return getRepairOrder(user, roId);
}

export function createEstimate(user, roId, body) {
  requireRoles(user, [ROLES.SERVICE_ADVISOR, ROLES.SHOP_MANAGER, ROLES.TECHNICIAN]);
  const ro = getRo(roId);
  assertRoAccess(user, ro);
  assertNotInvoiced(ro);
  assertRoCustomerCanCommit(ro);
  const existing = db.prepare('SELECT COUNT(*) AS n FROM estimates WHERE repair_order_id = ?').get(roId).n;
  const estId = id();
  db.prepare(`
    INSERT INTO estimates (id, repair_order_id, status, revision, created_by)
    VALUES (?, ?, 'DRAFT', ?, ?)
  `).run(estId, roId, existing + 1, user.id);
  if (ro.status === 'DRAFT' || ro.status === 'DIAGNOSING') {
    db.prepare(`UPDATE repair_orders SET status = 'DIAGNOSING', updated_at = datetime('now') WHERE id = ?`).run(roId);
  }
  writeAudit(user, 'ESTIMATE_CREATED', 'estimate', estId, null, 'DRAFT', ro.number);
  return getEstimateDetail(user, estId);
}

export function addEstimateLine(user, estimateId, body) {
  requireRoles(user, [ROLES.SERVICE_ADVISOR, ROLES.TECHNICIAN, ROLES.SHOP_FOREMAN, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  const est = getEstimate(estimateId);
  const ro = getRo(est.repair_order_id);
  assertRoAccess(user, ro);
  assertNotInvoiced(ro);
  assertRoCustomerCanCommit(ro);
  if (!data.kind || !data.description) throw badRequest('Line kind and description are required');
  let amount = Number(data.amount_cents || 0);
  if (data.kind === 'LABOR') {
    const hours = Number(data.hours || 0);
    const rate = Number(data.labor_rate_cents || 14500);
    if (hours <= 0) throw badRequest('Labor hours are required');
    amount = Math.round(hours * rate);
  } else {
    const qty = Number(data.quantity || 1);
    const unit = Number(data.unit_cost_cents || 0);
    if (data.part_id) {
      const part = getPart(data.part_id);
      if (!partCompatible(part.id, ro)) {
        throw badRequest('Part is not compatible with this vehicle', 'INCOMPATIBLE_PART');
      }
      amount = qty * (unit || part.unit_cost_cents);
    } else if (!amount) {
      amount = qty * unit;
    }
    if (amount <= 0) throw badRequest('Parts line amount is required');
  }
  const lineId = id();
  db.prepare(`
    INSERT INTO estimate_line_items (
      id, estimate_id, repair_order_id, kind, description, required_certification,
      hours, labor_rate_cents, part_id, quantity, unit_cost_cents, amount_cents,
      customer_approval, created_by, documentation_required
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NONE', ?, ?)
  `).run(
    lineId,
    estimateId,
    ro.id,
    data.kind,
    data.description,
    data.required_certification || null,
    data.hours ?? null,
    data.labor_rate_cents ?? null,
    data.part_id || null,
    data.quantity ?? null,
    data.unit_cost_cents ?? null,
    amount,
    user.id,
    data.documentation_required || (data.kind === 'LABOR' ? 'ROAD_TEST' : null)
  );
  if (est.status === 'APPROVED' || est.status === 'PARTIALLY_APPROVED') {
    db.prepare(`UPDATE estimates SET status = 'PARTIALLY_APPROVED' WHERE id = ?`).run(estimateId);
  }
  writeAudit(user, 'ESTIMATE_LINE_ADDED', 'estimate_line', lineId, null, 'NONE', data.description);
  return getEstimateDetail(user, estimateId);
}

export function flagAdditionalIssue(user, roId, body) {
  const ro = getRo(roId);
  assertRoAccess(user, ro);
  let estimate = db.prepare(`
    SELECT * FROM estimates WHERE repair_order_id = ? ORDER BY revision DESC
  `).get(roId);
  if (!estimate) {
    createEstimate(user, roId, {});
    estimate = db.prepare('SELECT * FROM estimates WHERE repair_order_id = ? ORDER BY revision DESC').get(roId);
  }
  return addEstimateLine(user, estimate.id, {
    ...body,
    kind: body.kind || 'LABOR',
    description: body.description || body.issue || 'Additional issue found mid-repair'
  });
}

export function sendEstimate(user, estimateId, body) {
  requireRoles(user, ADVISOR_ROLES);
  const data = ignoreClientAuth(body);
  const est = getEstimate(estimateId);
  const ro = getRo(est.repair_order_id);
  assertRoCustomerCanCommit(ro);
  const { lines } = estimateTotals(estimateId);
  if (!lines.length) throw badRequest('Add at least one line before sending');
  const expires = data.expires_at || new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  db.prepare(`
    UPDATE estimates SET status = 'PENDING_APPROVAL', sent_at = datetime('now'), expires_at = ? WHERE id = ?
  `).run(expires, estimateId);
  db.prepare(`
    UPDATE repair_orders SET status = 'ESTIMATE_PENDING', updated_at = datetime('now') WHERE id = ? AND status IN ('DRAFT','DIAGNOSING','ESTIMATE_PENDING')
  `).run(ro.id);
  writeAudit(user, 'ESTIMATE_SENT', 'estimate', estimateId, est.status, 'PENDING_APPROVAL', `Expires ${expires}`);
  return getEstimateDetail(user, estimateId);
}

export function approveEstimateLines(user, estimateId, body) {
  const data = ignoreClientAuth(body);
  const est = getEstimate(estimateId);
  const ro = getRo(est.repair_order_id);
  assertRoCustomerCanCommit(ro);
  if (user.role !== ROLES.CUSTOMER) {
    throw forbidden('Only the customer can approve or decline estimate line items');
  }
  if (user.role === ROLES.CUSTOMER && user.customer_id !== ro.customer_id) {
    throw forbidden('Cannot approve another customer\'s estimate');
  }
  if (est.status === 'EXPIRED') throw conflict('Expired estimate must be re-sent for approval', 'ESTIMATE_EXPIRED');
  const decisions = data.decisions || data.lines || [];
  if (!Array.isArray(decisions) || !decisions.length) throw badRequest('Line decisions are required');
  for (const decision of decisions) {
    const line = db.prepare('SELECT * FROM estimate_line_items WHERE id = ? AND estimate_id = ?').get(decision.id, estimateId);
    if (!line) throw notFound('Line item not found');
    const approval = decision.approval === 'DECLINED' || decision.approved === false ? 'DECLINED' : 'APPROVED';
    db.prepare(`
      UPDATE estimate_line_items
      SET customer_approval = ?, approved_by = ?, approved_at = datetime('now')
      WHERE id = ?
    `).run(approval, user.id, line.id);
  }
  const next = refreshEstimateStatus(estimateId);
  if (next.status === 'APPROVED') {
    db.prepare(`
      UPDATE repair_orders SET status = 'ESTIMATE_APPROVED', updated_at = datetime('now')
      WHERE id = ? AND status IN ('DRAFT','DIAGNOSING','ESTIMATE_PENDING','ESTIMATE_APPROVED')
    `).run(ro.id);
  }
  writeAudit(user, 'ESTIMATE_LINE_DECISION', 'estimate', estimateId, est.status, next.status, data.reason || null);
  return getEstimateDetail(user, estimateId);
}

export function staffApproveEstimate(user, estimateId, body) {
  requireRoles(user, [ROLES.SERVICE_ADVISOR, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  const est = getEstimate(estimateId);
  const ro = getRo(est.repair_order_id);
  assertRoCustomerCanCommit(ro);
  if (est.created_by === user.id) {
    throw forbidden('You cannot approve an estimate you created', 'SELF_APPROVAL');
  }
  const { approved_cents, pending, approved } = estimateTotals(estimateId);
  if (!approved.length || pending.length) {
    throw conflict('Customer approval is required on every billable line before staff sign-off', 'CUSTOMER_APPROVAL_REQUIRED');
  }
  if (est.status === 'EXPIRED') throw conflict('Expired estimate must be re-approved', 'ESTIMATE_EXPIRED');
  if (approved_cents > user.approval_limit_cents && user.role !== ROLES.SHOP_MANAGER) {
    throw forbidden('Estimate exceeds advisor approval authority and requires a shop manager', 'AUTHORITY_CEILING');
  }
  db.prepare(`
    UPDATE estimates SET staff_approved_by = ?, staff_approved_at = datetime('now') WHERE id = ?
  `).run(user.id, estimateId);
  refreshEstimateStatus(estimateId);
  db.prepare(`
    UPDATE repair_orders SET status = 'ESTIMATE_APPROVED', updated_at = datetime('now')
    WHERE id = ? AND status IN ('ESTIMATE_PENDING','ESTIMATE_APPROVED','DIAGNOSING')
  `).run(est.repair_order_id);
  writeAudit(user, 'ESTIMATE_STAFF_APPROVED', 'estimate', estimateId, est.status, 'APPROVED', data.reason || null);
  return getEstimateDetail(user, estimateId);
}

export function getEstimateDetail(user, estimateId) {
  const est = refreshEstimateStatus(estimateId);
  const ro = getRo(est.repair_order_id);
  if (!customerCanSee(user, ro.customer_id) && user.role === ROLES.CUSTOMER) {
    throw forbidden('Cannot access another customer\'s estimate');
  }
  const totals = estimateTotals(estimateId);
  const creator = db.prepare('SELECT full_name FROM users WHERE id = ?').get(est.created_by);
  return { estimate: { ...est, created_by_name: creator?.full_name || est.created_by, ...totals, customer_id: ro.customer_id, ro_number: ro.number, ro_status: ro.status } };
}

export function listEstimates(user, query = {}) {
  expireEstimates();
  let rows = db.prepare(`
    SELECT e.*, ro.number AS ro_number, ro.status AS ro_status, ro.customer_id,
           c.name AS customer_name, u.full_name AS created_by_name
    FROM estimates e
    JOIN repair_orders ro ON ro.id = e.repair_order_id
    JOIN customers c ON c.id = ro.customer_id
    JOIN users u ON u.id = e.created_by
    ORDER BY e.created_at DESC
  `).all();
  if (user.role === ROLES.CUSTOMER) rows = rows.filter((r) => r.customer_id === user.customer_id);
  return rows.filter((r) => !query.status || r.status === query.status).map((row) => ({
    ...row,
    ...estimateTotals(row.id)
  }));
}

export function bookBay(user, bayId, body) {
  requireRoles(user, FLOOR_ROLES);
  const data = ignoreClientAuth(body);
  if (!data.repair_order_id || !data.window_start || !data.window_end) {
    throw badRequest('Repair order and window are required');
  }
  return db.transaction(() => {
    const bay = getBay(bayId);
    if (bay.status === 'MAINTENANCE_HOLD') {
      throw conflict('Bay is under MAINTENANCE_HOLD and cannot accept a repair order', 'BAY_HOLD');
    }
    if (data.expected_version != null && Number(data.expected_version) !== bay.version) {
      throw conflict('Bay state is stale; refresh and try again', 'STALE_BAY');
    }
    if (data.expected_status && data.expected_status !== bay.status) {
      throw conflict('Bay is no longer in the expected state', 'STALE_BAY');
    }
    const ro = getRo(data.repair_order_id);
    assertNotInvoiced(ro);
    assertRoCustomerCanCommit(ro);
    if (ro.status === 'CANCELLED' || ro.status === 'COMPLETED') {
      throw conflict('Cannot book a bay for a closed repair order');
    }
    const clash = overlappingBay(bayId, data.window_start, data.window_end);
    if (clash) {
      throw conflict('Bay is already booked for an overlapping window', 'BAY_CONFLICT');
    }
    const bookingId = id();
    db.prepare(`
      INSERT INTO bay_bookings (id, bay_id, repair_order_id, window_start, window_end, status)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE')
    `).run(bookingId, bayId, ro.id, data.window_start, data.window_end);
    const now = Date.now();
    const bookingIsCurrent = new Date(data.window_start).getTime() <= now
      && now < new Date(data.window_end).getTime();
    const nextStatus = bookingIsCurrent ? 'OCCUPIED' : bay.status;
    db.prepare(`UPDATE bays SET status = ?, version = version + 1 WHERE id = ?`).run(nextStatus, bayId);
    writeAudit(user, 'BAY_ASSIGNED', 'bay', bayId, bay.status, nextStatus, ro.number);
    return {
      booking: db.prepare('SELECT * FROM bay_bookings WHERE id = ?').get(bookingId),
      bay: getBay(bayId)
    };
  })();
}

export function setBayMaintenance(user, bayId, body) {
  requireRoles(user, [ROLES.SHOP_MANAGER, ROLES.SHOP_FOREMAN]);
  const data = ignoreClientAuth(body);
  return db.transaction(() => {
    const bay = getBay(bayId);
    const hold = data.hold !== false;
    if (hold && bay.status === 'OCCUPIED') {
      throw conflict('Release the active repair order before placing a maintenance hold');
    }
    const next = hold ? 'MAINTENANCE_HOLD' : 'AVAILABLE';
    db.prepare(`
      UPDATE bays SET status = ?, maintenance_reason = ?, version = version + 1 WHERE id = ?
    `).run(next, hold ? (data.reason || 'Maintenance hold') : null, bayId);
    writeAudit(user, hold ? 'BAY_MAINTENANCE_HOLD' : 'BAY_MAINTENANCE_LIFTED', 'bay', bayId, bay.status, next, data.reason || null);
    return getBay(bayId);
  })();
}

export function releaseBay(user, bayId, body) {
  requireRoles(user, FLOOR_ROLES);
  const data = ignoreClientAuth(body);
  return db.transaction(() => {
    const bay = getBay(bayId);
    if (!data.booking_id) throw badRequest('Select the booking to release');
    const booking = db.prepare(`
      SELECT * FROM bay_bookings
      WHERE id = ? AND bay_id = ? AND status = 'ACTIVE'
    `).get(data.booking_id, bayId);
    if (!booking) throw notFound('Active bay booking not found');
    db.prepare(`UPDATE bay_bookings SET status = 'RELEASED' WHERE id = ?`).run(booking.id);
    const nowIso = new Date().toISOString();
    const current = db.prepare(`
      SELECT 1 FROM bay_bookings
      WHERE bay_id = ? AND status = 'ACTIVE'
        AND window_start <= ? AND window_end > ?
    `).get(bayId, nowIso, nowIso);
    const nextStatus = current ? 'OCCUPIED' : (
      bay.status === 'MAINTENANCE_HOLD' ? 'MAINTENANCE_HOLD' : 'AVAILABLE'
    );
    db.prepare(`UPDATE bays SET status = ?, version = version + 1 WHERE id = ?`).run(nextStatus, bayId);
    writeAudit(user, 'BAY_RELEASED', 'bay_booking', booking.id, 'ACTIVE', 'RELEASED', data.reason || null);
    return getBay(bayId);
  })();
}

export function listBays() {
  const bays = db.prepare('SELECT * FROM bays ORDER BY number').all();
  return bays.map((bay) => {
    const bookings = db.prepare(`
      SELECT b.*, ro.number AS ro_number, c.name AS customer_name
      FROM bay_bookings b
      JOIN repair_orders ro ON ro.id = b.repair_order_id
      JOIN customers c ON c.id = ro.customer_id
      WHERE b.bay_id = ? AND b.status = 'ACTIVE'
      ORDER BY b.window_start
    `).all(bay.id);
    return { ...bay, booking: bookings[0] || null, bookings };
  });
}

function assignTechnicianRecord(user, technicianId, data, exceptAssignmentId = null) {
  const tech = getTech(technicianId);
  if (tech.status === 'SUSPENDED') throw conflict('Technician is suspended');
  const ro = getRo(data.repair_order_id);
  assertNotInvoiced(ro);
  assertRoCustomerCanCommit(ro);
  const clash = overlappingTech(technicianId, data.window_start, data.window_end, exceptAssignmentId);
  if (clash) throw conflict('Technician is already assigned during that window', 'TECH_DOUBLE_BOOK');
  const days = coveredDays(data.window_start, data.window_end);
  for (const day of days) {
    const scheduled = techHoursOnDay(technicianId, day)
      - (exceptAssignmentId ? (() => {
        const old = db.prepare('SELECT * FROM technician_assignments WHERE id = ?').get(exceptAssignmentId);
        return old ? hoursOnDay(old.window_start, old.window_end, day) : 0;
      })() : 0);
    const proposed = hoursOnDay(data.window_start, data.window_end, day);
    if (scheduled + proposed > tech.daily_labor_hour_limit) {
      if (!(data.overtime_override && user.role === ROLES.SHOP_MANAGER && data.reason)) {
        throw conflict('Assignment exceeds the technician daily labor-hour limit', 'LABOR_HOUR_CAP');
      }
    }
  }
  const certs = [...new Set([
    ...requiredCertsForRo(ro.id),
    ...(data.required_certification ? [data.required_certification] : [])
  ])];
  for (const cert of certs) {
    if (!certValid(technicianId, cert, sameDay(data.window_start))
      || !certValid(technicianId, cert, lastCoveredDay(data.window_end))) {
      throw conflict(`Technician lacks a valid ${cert} certification for the full assignment window`, 'CERTIFICATION');
    }
  }
  const asgId = id();
  db.prepare(`
    INSERT INTO technician_assignments (
      id, technician_id, repair_order_id, window_start, window_end,
      overtime_override, override_reason, override_by, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `).run(
    asgId,
    technicianId,
    ro.id,
    data.window_start,
    data.window_end,
    data.overtime_override ? 1 : 0,
    data.reason || null,
    data.overtime_override ? user.id : null
  );
  refreshTechStatus(technicianId);
  writeAudit(user, 'TECHNICIAN_ASSIGNED', 'technician', technicianId, tech.status, 'ASSIGNED', ro.number);
  return {
    assignment: db.prepare('SELECT * FROM technician_assignments WHERE id = ?').get(asgId),
    technician: getTech(technicianId)
  };
}

export function assignTechnician(user, technicianId, body) {
  requireRoles(user, [ROLES.SERVICE_ADVISOR, ROLES.SHOP_FOREMAN, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  if (!data.repair_order_id || !data.window_start || !data.window_end) {
    throw badRequest('Repair order and window are required');
  }
  return db.transaction(() => assignTechnicianRecord(user, technicianId, data))();
}

export function reassignTechnician(user, technicianId, body) {
  requireRoles(user, [ROLES.SHOP_FOREMAN, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  if (!data.assignment_id || !data.to_technician_id) throw badRequest('assignment_id and to_technician_id are required');
  return db.transaction(() => {
    const current = db.prepare('SELECT * FROM technician_assignments WHERE id = ?').get(data.assignment_id);
    if (!current || current.technician_id !== technicianId || current.status !== 'ACTIVE') {
      throw notFound('Active assignment not found');
    }
    const next = {
      repair_order_id: current.repair_order_id,
      window_start: data.window_start || current.window_start,
      window_end: data.window_end || current.window_end,
      overtime_override: data.overtime_override,
      reason: data.reason
    };
    const result = assignTechnicianRecord(user, data.to_technician_id, next);
    db.prepare(`UPDATE technician_assignments SET status = 'RELEASED' WHERE id = ?`).run(current.id);
    refreshTechStatus(technicianId);
    writeAudit(user, 'TECHNICIAN_REASSIGNED', 'technician_assignment', current.id, technicianId, data.to_technician_id, data.reason || null);
    return result;
  })();
}

export function listTechnicians() {
  const techs = db.prepare(`
    SELECT t.*, u.full_name, u.email
    FROM technicians t JOIN users u ON u.id = t.user_id
    ORDER BY u.full_name
  `).all();
  return techs.map((tech) => {
    const assignments = db.prepare(`
      SELECT a.*, ro.number AS ro_number
      FROM technician_assignments a
      JOIN repair_orders ro ON ro.id = a.repair_order_id
      WHERE a.technician_id = ? AND a.status = 'ACTIVE'
      ORDER BY a.window_start
    `).all(tech.id);
    const loadByDay = {};
    for (const assignment of assignments) {
      for (const day of coveredDays(assignment.window_start, assignment.window_end)) {
        loadByDay[day] = (loadByDay[day] || 0)
          + hoursOnDay(assignment.window_start, assignment.window_end, day);
      }
    }
    return {
      ...tech,
      certifications: db.prepare('SELECT * FROM certifications WHERE technician_id = ?').all(tech.id),
      assignments,
      daily_loads: Object.entries(loadByDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, hours]) => ({
        day,
        hours,
        limit: tech.daily_labor_hour_limit,
        remaining: Math.max(0, tech.daily_labor_hour_limit - hours)
      }))
    };
  });
}

export function upsertTechnicianCertification(user, technicianId, body) {
  requireRoles(user, [ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  const tech = getTech(technicianId);
  const certType = String(data.cert_type || '').toUpperCase();
  const expiresOn = String(data.expires_on || '');
  if (!['GENERAL', 'EV_HYBRID', 'ALIGNMENT', 'EPA_609'].includes(certType)) {
    throw badRequest('Choose a supported certification type');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || Number.isNaN(Date.parse(`${expiresOn}T00:00:00Z`))) {
    throw badRequest('A valid certification expiry date is required');
  }
  return db.transaction(() => {
    const existing = db.prepare(`
      SELECT * FROM certifications WHERE technician_id = ? AND cert_type = ?
    `).get(technicianId, certType);
    const certId = existing?.id || id();
    db.prepare(`
      INSERT INTO certifications (id, technician_id, cert_type, expires_on)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(technician_id, cert_type)
      DO UPDATE SET expires_on = excluded.expires_on
    `).run(certId, technicianId, certType, expiresOn);
    writeAudit(
      user,
      existing ? 'CERTIFICATION_RENEWED' : 'CERTIFICATION_ADDED',
      'certification',
      certId,
      existing?.expires_on || null,
      expiresOn,
      `${tech.id}:${certType}`
    );
    return db.prepare('SELECT * FROM certifications WHERE id = ?').get(certId);
  })();
}

export function logLabor(user, body) {
  const data = ignoreClientAuth(body);
  if (!data.repair_order_id || !data.hours) throw badRequest('Repair order and hours are required');
  const ro = getRo(data.repair_order_id);
  assertNotInvoiced(ro);
  const tech = user.role === ROLES.TECHNICIAN
    ? techForUser(user)
    : data.technician_id
      ? getTech(data.technician_id)
      : null;
  if (!tech) throw forbidden('Technician identity required');
  if (user.role === ROLES.TECHNICIAN && tech.user_id !== user.id) {
    throw forbidden('Cannot log labor as another technician');
  }
  if (user.role === ROLES.TECHNICIAN) {
    const assigned = db.prepare(`
      SELECT 1 FROM technician_assignments
      WHERE technician_id = ? AND repair_order_id = ? AND status = 'ACTIVE'
    `).get(tech.id, ro.id);
    if (!assigned) throw forbidden('Technician is not assigned to this repair order', 'NOT_ASSIGNED');
  } else {
    requireRoles(user, [ROLES.SHOP_FOREMAN, ROLES.SHOP_MANAGER]);
  }
  if (data.line_item_id) {
    const line = db.prepare('SELECT * FROM estimate_line_items WHERE id = ?').get(data.line_item_id);
    if (!line || line.repair_order_id !== ro.id) throw notFound('Line item not found');
    if (line.customer_approval !== 'APPROVED') {
      throw conflict('Unapproved line items cannot be worked or billed', 'UNAPPROVED_LINE');
    }
    if (line.required_certification && !certValid(tech.id, line.required_certification, new Date().toISOString())) {
      throw conflict('Technician certification is no longer valid for this line', 'CERTIFICATION');
    }
  }
  const logId = id();
  db.prepare(`
    INSERT INTO labor_logs (id, technician_id, repair_order_id, line_item_id, hours, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(logId, tech.id, ro.id, data.line_item_id || null, Number(data.hours), data.notes || null);
  writeAudit(user, 'LABOR_LOGGED', 'labor_log', logId, null, String(data.hours), ro.number);
  return db.prepare('SELECT * FROM labor_logs WHERE id = ?').get(logId);
}

export function reservePart(user, partId, body) {
  requireRoles(user, [ROLES.PARTS_MANAGER, ROLES.SERVICE_ADVISOR, ROLES.SHOP_MANAGER, ROLES.TECHNICIAN]);
  const data = ignoreClientAuth(body);
  if (!data.repair_order_id || !data.quantity) throw badRequest('Repair order and quantity are required');
  return db.transaction(() => {
    const part = getPart(partId);
    const ro = getRo(data.repair_order_id);
    assertNotInvoiced(ro);
    assertRoCustomerCanCommit(ro);
    if (!partCompatible(part.id, ro)) {
      throw badRequest('Part is not compatible with this vehicle', 'INCOMPATIBLE_PART');
    }
    const qty = Number(data.quantity);
    const available = Math.max(0, part.quantity_on_hand - part.quantity_reserved);
    if (qty > available) {
      const reserveQty = available;
      const backorderQty = qty - reserveQty;
      let resId = null;
      if (reserveQty > 0) {
        db.prepare('UPDATE parts SET quantity_reserved = quantity_reserved + ? WHERE id = ?').run(reserveQty, partId);
        resId = id();
        db.prepare(`
          INSERT INTO part_reservations (id, part_id, repair_order_id, line_item_id, quantity, status)
          VALUES (?, ?, ?, ?, ?, 'RESERVED')
        `).run(resId, partId, ro.id, data.line_item_id || null, reserveQty);
      }
      if (backorderQty > 0) {
        db.prepare(`
          INSERT INTO part_reservations (id, part_id, repair_order_id, line_item_id, quantity, status)
          VALUES (?, ?, ?, ?, ?, 'BACKORDERED')
        `).run(id(), partId, ro.id, data.line_item_id || null, backorderQty);
      }
      const updated = refreshPartStatus(partId);
      if (backorderQty > 0) {
        writeAudit(user, 'PARTS_BACKORDERED', 'part', partId, part.status, updated.status, ro.number);
      } else if (reserveQty > 0) {
        writeAudit(user, 'PARTS_RESERVED', 'part', partId, part.status, updated.status, ro.number);
      }
      return {
        reservation: resId
          ? db.prepare('SELECT * FROM part_reservations WHERE id = ?').get(resId)
          : db.prepare(`
              SELECT * FROM part_reservations
              WHERE part_id = ? AND repair_order_id = ? AND status = 'BACKORDERED'
              ORDER BY created_at DESC
            `).get(partId, ro.id),
        part: updated,
        backordered: backorderQty > 0,
        reserved_quantity: reserveQty,
        backordered_quantity: backorderQty
      };
    }
    db.prepare('UPDATE parts SET quantity_reserved = quantity_reserved + ? WHERE id = ?').run(qty, partId);
    const resId = id();
    db.prepare(`
      INSERT INTO part_reservations (id, part_id, repair_order_id, line_item_id, quantity, status)
      VALUES (?, ?, ?, ?, ?, 'RESERVED')
    `).run(resId, partId, ro.id, data.line_item_id || null, qty);
    const updated = refreshPartStatus(partId);
    writeAudit(user, 'PARTS_RESERVED', 'part', partId, part.status, updated.status, ro.number);
    return {
      reservation: db.prepare('SELECT * FROM part_reservations WHERE id = ?').get(resId),
      part: updated,
      backordered: false
    };
  })();
}

export function receiveShipment(user, partId, body) {
  requireRoles(user, [ROLES.PARTS_MANAGER, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  const qty = Number(data.quantity || 0);
  if (qty <= 0 && !data.shipment_id) throw badRequest('Quantity is required');
  return db.transaction(() => {
    const part = getPart(partId);
    let incomingQty = qty;
    if (data.shipment_id) {
      const ship = db.prepare('SELECT * FROM shipments WHERE id = ? AND part_id = ?').get(data.shipment_id, partId);
      if (!ship) throw notFound('Shipment not found');
      if (ship.status === 'RECEIVED') throw conflict('Shipment already received');
      incomingQty = ship.quantity;
      db.prepare(`UPDATE shipments SET status = 'RECEIVED', received_at = datetime('now') WHERE id = ?`).run(ship.id);
    } else {
      db.prepare(`
        INSERT INTO shipments (id, part_id, quantity, status, received_at)
        VALUES (?, ?, ?, 'RECEIVED', datetime('now'))
      `).run(id(), partId, incomingQty);
    }
    db.prepare('UPDATE parts SET quantity_on_hand = quantity_on_hand + ? WHERE id = ?').run(incomingQty, partId);
    const backorders = db.prepare(`
      SELECT * FROM part_reservations
      WHERE part_id = ? AND status = 'BACKORDERED'
      ORDER BY created_at
    `).all(partId);
    for (const row of backorders) {
      const current = getPart(partId);
      const available = current.quantity_on_hand - current.quantity_reserved;
      if (available >= row.quantity) {
        db.prepare('UPDATE parts SET quantity_reserved = quantity_reserved + ? WHERE id = ?').run(row.quantity, partId);
        db.prepare(`UPDATE part_reservations SET status = 'RESERVED' WHERE id = ?`).run(row.id);
      }
    }
    const updated = refreshPartStatus(partId);
    writeAudit(user, 'SHIPMENT_RECEIVED', 'part', partId, part.status, updated.status, `+${incomingQty}`);
    return { part: updated };
  })();
}

export function recordPartUsage(user, partId, body) {
  requireRoles(user, [ROLES.TECHNICIAN, ROLES.PARTS_MANAGER, ROLES.SHOP_FOREMAN, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  const qty = Number(data.quantity || 0);
  if (!data.repair_order_id || qty <= 0) throw badRequest('Repair order and quantity are required');
  return db.transaction(() => {
    const part = getPart(partId);
    const reserved = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) AS qty FROM part_reservations
      WHERE part_id = ? AND repair_order_id = ? AND status = 'RESERVED'
    `).get(partId, data.repair_order_id).qty;
    const consumed = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) AS qty FROM part_reservations
      WHERE part_id = ? AND repair_order_id = ? AND status = 'CONSUMED'
    `).get(partId, data.repair_order_id).qty;
    if (consumed + qty > reserved) {
      throw conflict('Usage exceeds the quantity reserved against this repair order', 'OVER_USAGE');
    }
    db.prepare('UPDATE parts SET quantity_on_hand = quantity_on_hand - ?, quantity_reserved = quantity_reserved - ? WHERE id = ?')
      .run(qty, qty, partId);
    const remaining = reserved - consumed - qty;
    let left = qty;
    const rows = db.prepare(`
      SELECT * FROM part_reservations
      WHERE part_id = ? AND repair_order_id = ? AND status = 'RESERVED'
      ORDER BY created_at
    `).all(partId, data.repair_order_id);
    for (const row of rows) {
      if (left <= 0) break;
      if (row.quantity <= left) {
        db.prepare(`UPDATE part_reservations SET status = 'CONSUMED' WHERE id = ?`).run(row.id);
        left -= row.quantity;
      } else {
        db.prepare(`UPDATE part_reservations SET quantity = ? WHERE id = ?`).run(row.quantity - left, row.id);
        db.prepare(`
          INSERT INTO part_reservations (id, part_id, repair_order_id, line_item_id, quantity, status)
          VALUES (?, ?, ?, ?, ?, 'CONSUMED')
        `).run(id(), partId, data.repair_order_id, row.line_item_id, left);
        left = 0;
      }
    }
    const updated = refreshPartStatus(partId);
    writeAudit(user, 'PARTS_USED', 'part', partId, String(part.quantity_on_hand), String(updated.quantity_on_hand), data.repair_order_id);
    return { part: updated, remaining_reserved: remaining };
  })();
}

export function listParts(query = {}) {
  const rows = db.prepare('SELECT * FROM parts ORDER BY part_number').all().map((p) => ({
    ...p,
    available: p.quantity_on_hand - p.quantity_reserved,
    compat: db.prepare('SELECT * FROM part_compatibilities WHERE part_id = ?').all(p.id),
    reservations: db.prepare(`
      SELECT r.*, ro.number AS ro_number
      FROM part_reservations r JOIN repair_orders ro ON ro.id = r.repair_order_id
      WHERE r.part_id = ? AND r.status IN ('RESERVED','BACKORDERED')
    `).all(p.id)
  }));
  const q = String(query.q || '').toLowerCase();
  return rows.filter((p) => {
    if (query.status && p.status !== query.status) return false;
    if (q && !`${p.part_number} ${p.description}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function listShipments() {
  return db.prepare(`
    SELECT s.*, p.part_number, p.description
    FROM shipments s JOIN parts p ON p.id = s.part_id
    ORDER BY s.created_at DESC
  `).all();
}

export function startWork(user, roId, body) {
  requireRoles(user, FLOOR_ROLES);
  const data = ignoreClientAuth(body);
  return db.transaction(() => {
    expireEstimates();
    const ro = getRo(roId);
    assertNotInvoiced(ro);
    assertRoCustomerCanCommit(ro);
    if (ro.status === 'CANCELLED') throw conflict('Cancelled repair orders cannot start');
    const estimate = db.prepare(`
      SELECT * FROM estimates WHERE repair_order_id = ? ORDER BY revision DESC
    `).get(roId);
    if (!estimate) throw conflict('An approved estimate is required before work can start');
    if (estimate.status === 'EXPIRED') throw conflict('Expired estimate must be re-approved before work starts', 'ESTIMATE_EXPIRED');
    const { approved, pending, lines } = estimateTotals(estimate.id);
    if (!approved.length) throw conflict('No customer-approved line items are ready to work');
    if (pending.length) {
      throw conflict('Customer approval is required on every billable line before work can start', 'UNAPPROVED_LINE');
    }
    const booking = activeBooking(roId);
    if (!booking) throw conflict('Repair order must be bound to an available bay before IN_PROGRESS', 'BAY_REQUIRED');
    const bay = getBay(booking.bay_id);
    if (bay.status === 'MAINTENANCE_HOLD') throw conflict('Assigned bay is under MAINTENANCE_HOLD', 'BAY_HOLD');
    const assignments = activeAssignments(roId);
    if (!assignments.length) throw conflict('A certified technician must be assigned before work starts');
    const today = new Date().toISOString();
    for (const asg of assignments) {
      for (const cert of requiredCertsForRo(roId)) {
        if (!certValid(asg.technician_id, cert, asg.window_start || today)
          || !certValid(asg.technician_id, cert, lastCoveredDay(asg.window_end || today))) {
          throw conflict('A technician certification has lapsed; reassign a certified technician', 'CERTIFICATION');
        }
      }
    }
    const backordered = db.prepare(`
      SELECT r.*, p.part_number FROM part_reservations r
      JOIN parts p ON p.id = r.part_id
      WHERE r.repair_order_id = ? AND r.status = 'BACKORDERED'
    `).all(roId);
    const approvedPartLines = lines.filter((l) => l.kind === 'PARTS' && l.customer_approval === 'APPROVED');
    const blockedParts = approvedPartLines.filter((line) =>
      backordered.some((b) => b.line_item_id === line.id || b.part_id === line.part_id)
    );
    const next = blockedParts.length && blockedParts.length === approvedPartLines.length && approvedPartLines.length
      ? 'AWAITING_PARTS'
      : blockedParts.length
        ? 'AWAITING_PARTS'
        : 'IN_PROGRESS';
    if (data?.force_full && blockedParts.length) {
      throw conflict('Backordered lines cannot move to IN_PROGRESS; only lines with available parts may proceed', 'BACKORDERED_PART');
    }
    db.prepare(`UPDATE repair_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(next, roId);
    const updated = getRo(roId);
    syncVehicleFromRo(updated);
    writeAudit(user, 'WORK_STARTED', 'repair_order', roId, ro.status, next, blockedParts.length ? 'Partial start; backordered lines remain blocked' : null);
    return {
      repair_order: getRepairOrder(user, roId),
      blocked_lines: blockedParts,
      started: next === 'IN_PROGRESS'
    };
  })();
}

export function attachDocument(user, body) {
  requireRoles(user, [ROLES.TECHNICIAN, ROLES.SHOP_FOREMAN, ROLES.SERVICE_ADVISOR, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  if (!data.repair_order_id || !data.line_item_id || !data.doc_type) {
    throw badRequest('Repair order, line item, and document type are required');
  }
  const ro = getRo(data.repair_order_id);
  assertRoAccess(user, ro);
  const line = db.prepare('SELECT * FROM estimate_line_items WHERE id = ?').get(data.line_item_id);
  if (!line) throw notFound('Line item not found');
  const docId = id();
  try {
    db.prepare(`
      INSERT INTO job_documents (id, repair_order_id, line_item_id, doc_type, notes, attached_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(docId, ro.id, line.id, data.doc_type, data.notes || '', user.id);
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      return db.prepare('SELECT * FROM job_documents WHERE line_item_id = ? AND doc_type = ?').get(line.id, data.doc_type);
    }
    throw error;
  }
  writeAudit(user, 'DOCUMENT_ATTACHED', 'job_document', docId, null, data.doc_type, ro.number);
  return db.prepare('SELECT * FROM job_documents WHERE id = ?').get(docId);
}

export function completeRepairOrder(user, roId, body) {
  requireRoles(user, [ROLES.TECHNICIAN, ROLES.SHOP_FOREMAN, ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  return db.transaction(() => {
    const ro = getRo(roId);
    if (ro.status === 'CANCELLED') throw conflict('A cancelled repair order cannot be completed', 'TERMINAL_RACE');
    if (ro.status === 'COMPLETED' || ro.status === 'INVOICED' || ro.status === 'CLOSED') {
      return { repair_order: getRepairOrder(user, roId), duplicate: true };
    }
    const docs = docsComplete(roId);
    if (!docs.ok) {
      throw conflict(
        `Completion documentation is required for "${docs.line.description}" (${docs.line.documentation_required})`,
        'DOCS_REQUIRED'
      );
    }
    const key = data.idempotency_key || `complete:${roId}`;
    try {
      db.prepare(`
        UPDATE repair_orders
        SET status = 'COMPLETED', completion_key = ?, updated_at = datetime('now')
        WHERE id = ? AND status NOT IN ('CANCELLED','COMPLETED','INVOICED','CLOSED')
      `).run(key, roId);
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE')) {
        return { repair_order: getRepairOrder(user, roId), duplicate: true };
      }
      throw error;
    }
    const updated = getRo(roId);
    if (updated.status !== 'COMPLETED') {
      throw conflict('Repair order could not be completed', 'TERMINAL_RACE');
    }
    syncVehicleFromRo(updated);
    writeAudit(user, 'JOB_COMPLETED', 'repair_order', roId, ro.status, 'COMPLETED', data.reason || null);
    return { repair_order: getRepairOrder(user, roId), duplicate: false };
  })();
}

export function cancelRepairOrder(user, roId, body) {
  requireRoles(user, [ROLES.SERVICE_ADVISOR, ROLES.SHOP_MANAGER, ROLES.SHOP_FOREMAN]);
  const data = ignoreClientAuth(body);
  return db.transaction(() => {
    const ro = getRo(roId);
    if (ro.status === 'COMPLETED' || ro.status === 'INVOICED' || ro.status === 'CLOSED') {
      throw conflict('A completed or invoiced repair order cannot be cancelled', 'TERMINAL_RACE');
    }
    if (ro.status === 'CANCELLED') return getRepairOrder(user, roId);
    db.prepare(`
      UPDATE repair_orders SET status = 'CANCELLED', updated_at = datetime('now')
      WHERE id = ? AND status NOT IN ('COMPLETED','INVOICED','CLOSED','CANCELLED')
    `).run(roId);
    const updated = getRo(roId);
    if (updated.status !== 'CANCELLED') {
      throw conflict('Repair order could not be cancelled', 'TERMINAL_RACE');
    }
    for (const booking of db.prepare(`SELECT * FROM bay_bookings WHERE repair_order_id = ? AND status = 'ACTIVE'`).all(roId)) {
      db.prepare(`UPDATE bay_bookings SET status = 'RELEASED' WHERE id = ?`).run(booking.id);
      db.prepare(`UPDATE bays SET status = 'AVAILABLE', version = version + 1 WHERE id = ? AND status = 'OCCUPIED'`).run(booking.bay_id);
    }
    for (const asg of db.prepare(`SELECT * FROM technician_assignments WHERE repair_order_id = ? AND status = 'ACTIVE'`).all(roId)) {
      db.prepare(`UPDATE technician_assignments SET status = 'RELEASED' WHERE id = ?`).run(asg.id);
      refreshTechStatus(asg.technician_id);
    }
    syncVehicleFromRo(updated);
    writeAudit(user, 'REPAIR_ORDER_CANCELLED', 'repair_order', roId, ro.status, 'CANCELLED', data.reason || null);
    return getRepairOrder(user, roId);
  })();
}

export function markReadyForPickup(user, roId, body) {
  requireRoles(user, ADVISOR_ROLES);
  const ro = getRo(roId);
  if (!['COMPLETED', 'INVOICED'].includes(ro.status)) {
    throw conflict('Only completed work can be scheduled for pickup');
  }
  db.prepare(`UPDATE vehicles SET status = 'READY_FOR_PICKUP' WHERE id = ?`).run(ro.vehicle_id);
  writeAudit(user, 'PICKUP_SCHEDULED', 'repair_order', roId, ro.vehicle_status, 'READY_FOR_PICKUP', body?.notes || null);
  return getRepairOrder(user, roId);
}

export function fileWarrantyClaim(user, body) {
  requireRoles(user, [ROLES.WARRANTY_ADMIN]);
  const data = ignoreClientAuth(body);
  if (!data.repair_order_id || !data.line_item_id) throw badRequest('Repair order and line item are required');
  return db.transaction(() => {
    const ro = getRo(data.repair_order_id);
    const line = db.prepare('SELECT * FROM estimate_line_items WHERE id = ?').get(data.line_item_id);
    if (!line || line.repair_order_id !== ro.id) throw notFound('Line item not found');
    const existing = lineClaim(line.id);
    if (existing) throw conflict('A warranty claim already exists for this line item', 'DUPLICATE_CLAIM');
    const coverages = db.prepare(`
      SELECT * FROM warranty_coverages
      WHERE vehicle_id = ? AND active = 1 AND expires_on >= date('now')
        AND (mileage_limit IS NULL OR mileage_limit >= ?)
    `).all(ro.vehicle_id, ro.intake_mileage);
    const coverageType = data.coverage_type || 'MANUFACTURER';
    const component = line.warranty_component;
    const coverage = component && coverages.find((c) => (
      c.coverage_type === coverageType
      && (c.component === component || c.component === 'ALL')
    ));
    if (!coverage) {
      throw conflict('No active warranty coverage verifies this line item and component', 'NO_COVERAGE');
    }
    const claimId = id();
    try {
      db.prepare(`
        INSERT INTO warranty_claims (
          id, repair_order_id, line_item_id, coverage_id, coverage_type,
          claim_amount_cents, status, filed_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, 'UNDER_REVIEW', ?, ?)
      `).run(
        claimId,
        ro.id,
        line.id,
        coverage.id,
        coverage.coverage_type,
        Number(data.claim_amount_cents || line.amount_cents),
        user.id,
        data.notes || null
      );
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE')) {
        throw conflict('A warranty claim already exists for this line item', 'DUPLICATE_CLAIM');
      }
      throw error;
    }
    writeAudit(user, 'WARRANTY_FILED', 'warranty_claim', claimId, null, 'UNDER_REVIEW', ro.number);
    return db.prepare('SELECT * FROM warranty_claims WHERE id = ?').get(claimId);
  })();
}

export function reviewWarrantyClaim(user, claimId, body) {
  requireRoles(user, [ROLES.WARRANTY_ADMIN]);
  const data = ignoreClientAuth(body);
  const claim = db.prepare('SELECT * FROM warranty_claims WHERE id = ?').get(claimId);
  if (!claim) throw notFound('Warranty claim not found');
  const raw = body && typeof body === 'object' ? body : {};
  const nextStatus = String(raw.status || raw.decision || data.decision || '').toUpperCase();
  if (claim.filed_by === user.id && (nextStatus === 'APPROVED' || nextStatus === 'DENIED')) {
    throw forbidden('You cannot approve or deny a claim you filed', 'SELF_APPROVAL');
  }
  if (!['APPROVED', 'DENIED', 'UNDER_REVIEW'].includes(nextStatus)) {
    throw badRequest('Status must be APPROVED, DENIED, or UNDER_REVIEW');
  }
  db.prepare(`
    UPDATE warranty_claims SET status = ?, reviewer_id = ?, notes = COALESCE(?, notes) WHERE id = ?
  `).run(nextStatus, user.id, data.notes || raw.notes || null, claimId);
  writeAudit(user, 'WARRANTY_REVIEWED', 'warranty_claim', claimId, claim.status, nextStatus, data.notes || raw.notes || null);
  return db.prepare('SELECT * FROM warranty_claims WHERE id = ?').get(claimId);
}

export function reimburseWarrantyClaim(user, claimId) {
  requireRoles(user, [ROLES.WARRANTY_ADMIN, ROLES.SHOP_MANAGER]);
  const claim = db.prepare('SELECT * FROM warranty_claims WHERE id = ?').get(claimId);
  if (!claim) throw notFound('Warranty claim not found');
  if (claim.status !== 'APPROVED') throw conflict('Only approved claims can be reimbursed');
  db.prepare(`UPDATE warranty_claims SET status = 'REIMBURSED' WHERE id = ?`).run(claimId);
  writeAudit(user, 'WARRANTY_REIMBURSED', 'warranty_claim', claimId, claim.status, 'REIMBURSED', null);
  return db.prepare('SELECT * FROM warranty_claims WHERE id = ?').get(claimId);
}

export function listWarrantyClaims(user, query = {}) {
  let rows = db.prepare(`
    SELECT w.*, ro.number AS ro_number, c.name AS customer_name, e.description AS line_description
    FROM warranty_claims w
    JOIN repair_orders ro ON ro.id = w.repair_order_id
    JOIN customers c ON c.id = ro.customer_id
    JOIN estimate_line_items e ON e.id = w.line_item_id
    ORDER BY w.created_at DESC
  `).all();
  if (user.role === ROLES.CUSTOMER) rows = rows.filter((r) => {
    const ro = getRo(r.repair_order_id);
    return ro.customer_id === user.customer_id;
  });
  return rows.filter((r) => !query.status || r.status === query.status);
}

export function createInvoice(user, body) {
  requireRoles(user, [ROLES.SHOP_MANAGER, ROLES.SERVICE_ADVISOR]);
  const data = ignoreClientAuth(body);
  if (!data.repair_order_id) throw badRequest('Repair order is required');
  return db.transaction(() => {
    const ro = getRo(data.repair_order_id);
    if (ro.status === 'CANCELLED') throw conflict('Cannot invoice a cancelled repair order');
    if (openClaims(ro.id).length) {
      throw conflict('Cannot invoice while a linked warranty claim is under review', 'WARRANTY_OPEN');
    }
    if (ro.status !== 'COMPLETED' && ro.status !== 'INVOICED') {
      throw conflict('Repair order must be COMPLETED before invoicing');
    }
    const existing = db.prepare('SELECT * FROM invoices WHERE repair_order_id = ? AND status != \'VOID\'').get(ro.id);
    if (existing) return getInvoice(user, existing.id);
    const lines = db.prepare(`
      SELECT * FROM estimate_line_items
      WHERE repair_order_id = ? AND customer_approval = 'APPROVED'
    `).all(ro.id);
    const billable = [];
    for (const line of lines) {
      const claim = lineClaim(line.id);
      if (claim && claim.status === 'APPROVED') continue;
      if (claim && ['FILED', 'UNDER_REVIEW'].includes(claim.status)) {
        throw conflict('Cannot invoice while a linked warranty claim is under review', 'WARRANTY_OPEN');
      }
      billable.push(line);
    }
    if (!billable.length) throw conflict('No billable customer-approved lines remain after warranty determination');
    const subtotal = billable.reduce((n, l) => n + l.amount_cents, 0);
    const tax = Math.round(subtotal * TAX_RATE);
    const total = subtotal + tax - Number(data.discount_cents || 0);
    const invId = id();
    const number = nextNumber('INV', 'invoices', 'number');
    db.prepare(`
      INSERT INTO invoices (
        id, number, customer_id, repair_order_id, subtotal_cents, tax_cents,
        discount_cents, total_cents, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)
    `).run(invId, number, ro.customer_id, ro.id, subtotal, tax, Number(data.discount_cents || 0), total, user.id);
    for (const line of billable) {
      db.prepare(`
        INSERT INTO invoice_line_items (id, invoice_id, estimate_line_item_id, description, amount_cents)
        VALUES (?, ?, ?, ?, ?)
      `).run(id(), invId, line.id, line.description, line.amount_cents);
      db.prepare('UPDATE estimate_line_items SET billed = 1 WHERE id = ?').run(line.id);
    }
    db.prepare(`UPDATE repair_orders SET status = 'INVOICED', updated_at = datetime('now') WHERE id = ?`).run(ro.id);
    writeAudit(user, 'INVOICE_CREATED', 'invoice', invId, ro.status, 'DRAFT', number);
    return getInvoice(user, invId);
  })();
}

export function getInvoice(user, invoiceId) {
  const invoice = db.prepare(`
    SELECT i.*, c.name AS customer_name, ro.number AS ro_number
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    JOIN repair_orders ro ON ro.id = i.repair_order_id
    WHERE i.id = ?
  `).get(invoiceId);
  if (!invoice) throw notFound('Invoice not found');
  if (!customerCanSee(user, invoice.customer_id)) throw forbidden('Cannot access another customer\'s invoice');
  const lines = db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ?').all(invoiceId);
  const corrections = db.prepare('SELECT * FROM invoice_corrections WHERE invoice_id = ?').all(invoiceId);
  const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ?').all(invoiceId);
  return { ...invoice, lines, corrections, payments };
}

export function listInvoices(user, query = {}) {
  let rows = db.prepare(`
    SELECT i.*, c.name AS customer_name, ro.number AS ro_number
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    JOIN repair_orders ro ON ro.id = i.repair_order_id
    ORDER BY i.created_at DESC
  `).all();
  if (user.role === ROLES.CUSTOMER) rows = rows.filter((r) => r.customer_id === user.customer_id);
  return rows.filter((r) => {
    if (query.status && r.status !== query.status) return false;
    return true;
  });
}

export function approveInvoice(user, invoiceId, body) {
  requireRoles(user, FINANCE_ROLES);
  const invoice = getInvoice(user, invoiceId);
  if (invoice.created_by === user.id) throw forbidden('You cannot approve an invoice you created', 'SELF_APPROVAL');
  if (invoice.status === 'VOID') throw conflict('A void invoice cannot be approved');
  db.prepare(`UPDATE invoices SET status = 'APPROVED', approved_by = ? WHERE id = ?`).run(user.id, invoiceId);
  writeAudit(user, 'INVOICE_APPROVED', 'invoice', invoiceId, invoice.status, 'APPROVED', body?.reason || null);
  return getInvoice(user, invoiceId);
}

export function sendInvoice(user, invoiceId) {
  requireRoles(user, FINANCE_ROLES);
  const invoice = getInvoice(user, invoiceId);
  if (!['APPROVED', 'SENT'].includes(invoice.status) && invoice.status !== 'DRAFT') {
    if (invoice.status !== 'APPROVED') throw conflict('Invoice must be approved before it is sent');
  }
  if (invoice.status === 'DRAFT') throw conflict('Invoice must be approved before it is sent');
  db.prepare(`UPDATE invoices SET status = 'SENT', sent_at = datetime('now') WHERE id = ?`).run(invoiceId);
  writeAudit(user, 'INVOICE_SENT', 'invoice', invoiceId, invoice.status, 'SENT', invoice.number);
  return getInvoice(user, invoiceId);
}

export function payInvoice(user, invoiceId, body) {
  requireRoles(user, [ROLES.SHOP_MANAGER]);
  const data = ignoreClientAuth(body);
  const invoice = getInvoice(user, invoiceId);
  if (invoice.status === 'VOID') throw conflict('A void invoice cannot be marked paid', 'INVALID_FINANCIAL_STATE');
  if (invoice.status === 'PAID') throw conflict('Invoice is already paid', 'INVOICE_ALREADY_PAID');
  if (!['SENT', 'APPROVED'].includes(invoice.status)) {
    throw conflict('Invoice must be sent before payment is recorded');
  }
  const amount = Number(data.amount_cents || invoice.total_cents);
  db.prepare(`
    INSERT INTO payments (id, invoice_id, customer_id, amount_cents, method)
    VALUES (?, ?, ?, ?, ?)
  `).run(id(), invoiceId, invoice.customer_id, amount, data.method || 'LEDGER');
  db.prepare(`UPDATE invoices SET status = 'PAID' WHERE id = ?`).run(invoiceId);
  db.prepare(`UPDATE repair_orders SET status = 'CLOSED', updated_at = datetime('now') WHERE id = ?`).run(invoice.repair_order_id);
  db.prepare('UPDATE customers SET outstanding_balance_cents = MAX(0, outstanding_balance_cents - ?) WHERE id = ?')
    .run(amount, invoice.customer_id);
  writeAudit(user, 'INVOICE_PAID', 'invoice', invoiceId, invoice.status, 'PAID', null);
  return getInvoice(user, invoiceId);
}

export function voidInvoice(user, invoiceId, body) {
  requireRoles(user, FINANCE_ROLES);
  ignoreClientAuth(body);
  const invoice = getInvoice(user, invoiceId);
  if (invoice.status === 'VOID') throw conflict('Invoice is already void', 'INVOICE_ALREADY_VOID');
  if (invoice.status === 'PAID') throw conflict('A paid invoice cannot also be void', 'INVALID_FINANCIAL_STATE');
  if (invoice.status === 'SENT') {
    throw conflict('A sent invoice cannot be voided; use the correction workflow', 'INVOICE_LOCKED');
  }
  db.prepare(`UPDATE invoices SET status = 'VOID' WHERE id = ?`).run(invoiceId);
  writeAudit(user, 'INVOICE_VOIDED', 'invoice', invoiceId, invoice.status, 'VOID', body?.reason || null);
  return getInvoice(user, invoiceId);
}

export function patchInvoice(user, invoiceId, body) {
  requireRoles(user, FINANCE_ROLES);
  const invoice = getInvoice(user, invoiceId);
  if (['SENT', 'PAID', 'VOID'].includes(invoice.status)) {
    throw conflict('A sent invoice cannot be directly edited; use the correction workflow', 'INVOICE_LOCKED');
  }
  ignoreClientAuth(body);
  throw conflict('A sent invoice cannot be directly edited; use the correction workflow', 'INVOICE_LOCKED');
}

export function correctInvoice(user, invoiceId, body) {
  requireRoles(user, FINANCE_ROLES);
  const data = ignoreClientAuth(body);
  const invoice = getInvoice(user, invoiceId);
  if (!data.reason || data.new_total_cents == null) throw badRequest('Correction reason and new total are required');
  const corrId = id();
  db.prepare(`
    INSERT INTO invoice_corrections (id, invoice_id, previous_total_cents, new_total_cents, reason, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(corrId, invoiceId, invoice.total_cents, Number(data.new_total_cents), data.reason, user.id);
  db.prepare('UPDATE invoices SET total_cents = ? WHERE id = ?').run(Number(data.new_total_cents), invoiceId);
  writeAudit(user, 'INVOICE_CORRECTED', 'invoice', invoiceId, String(invoice.total_cents), String(data.new_total_cents), data.reason);
  return getInvoice(user, invoiceId);
}

export function requestAppointment(user, body) {
  const raw = body && typeof body === 'object' ? body : {};
  const data = ignoreClientAuth(raw);
  const decoyCustomer = raw.customer_id || raw.customerId;
  const customerId = user.role === ROLES.CUSTOMER
    ? user.customer_id
    : (decoyCustomer || data.customer_id);
  if (!customerId) throw badRequest('Customer is required');
  if (user.role === ROLES.CUSTOMER && decoyCustomer && decoyCustomer !== user.customer_id) {
    throw forbidden('Cannot request an appointment for another customer');
  }
  const vehicleId = raw.vehicle_id || raw.vehicleId || data.vehicle_id;
  if (user.role === ROLES.CUSTOMER && !vehicleId) {
    throw badRequest('Vehicle is required');
  }
  if (vehicleId) {
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
    if (!vehicle) throw notFound('Vehicle not found');
    if (vehicle.customer_id !== customerId) {
      throw forbidden('Vehicle does not belong to this customer');
    }
  }
  const reqId = id();
  db.prepare(`
    INSERT INTO appointment_requests (id, customer_id, vehicle_id, preferred_date, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(reqId, customerId, vehicleId || null, data.preferred_date || raw.preferred_date || null, data.notes || raw.notes || null);
  writeAudit(
    user,
    'APPOINTMENT_REQUESTED',
    'appointment_request',
    reqId,
    null,
    'REQUESTED',
    data.preferred_date || raw.preferred_date || null
  );
  return db.prepare('SELECT * FROM appointment_requests WHERE id = ?').get(reqId);
}

export function listAppointments(user) {
  let rows = db.prepare(`
    SELECT a.*, c.name AS customer_name, v.make, v.model
    FROM appointment_requests a
    JOIN customers c ON c.id = a.customer_id
    LEFT JOIN vehicles v ON v.id = a.vehicle_id
    ORDER BY a.created_at DESC
  `).all();
  if (user.role === ROLES.CUSTOMER) rows = rows.filter((r) => r.customer_id === user.customer_id);
  return rows;
}

export function dashboard(user) {
  expireEstimates();
  const role = user.role;
  if (role === ROLES.CUSTOMER) {
    return {
      role,
      repair_orders: listRepairOrders(user),
      invoices: listInvoices(user),
      vehicles: listVehicles(user),
      estimates: listEstimates(user, { status: 'PENDING_APPROVAL' })
    };
  }
  const ros = db.prepare('SELECT status, COUNT(*) AS n FROM repair_orders GROUP BY status').all();
  const bays = listBays();
  const parts = listParts();
  const claims = listWarrantyClaims(user);
  const invoices = listInvoices(user);
  const techs = listTechnicians();
  const estimates = listEstimates(user);
  return {
    role,
    counts: Object.fromEntries(ros.map((r) => [r.status, r.n])),
    awaiting_estimate: listRepairOrders(user, { status: 'DIAGNOSING' }),
    pending_customer_approval: estimates.filter((e) => e.status === 'PENDING_APPROVAL'),
    high_value_pending: estimates.filter((e) => e.approved_cents > 250000 || e.total_cents > 250000),
    ready_for_pickup: listVehicles(user, { status: 'READY_FOR_PICKUP' }),
    bays,
    bay_utilization: {
      occupied: bays.filter((b) => b.status === 'OCCUPIED').length,
      available: bays.filter((b) => b.status === 'AVAILABLE').length,
      hold: bays.filter((b) => b.status === 'MAINTENANCE_HOLD').length
    },
    low_stock: parts.filter((p) => ['LOW_STOCK', 'BACKORDERED', 'ON_ORDER'].includes(p.status)),
    parts_attention: parts.filter((p) => ['LOW_STOCK', 'BACKORDERED', 'ON_ORDER', 'RESERVED'].includes(p.status)),
    reservations: parts.flatMap((p) => p.reservations),
    shipments: listShipments().filter((s) => s.status === 'INCOMING'),
    claims,
    claims_open: claims.filter((c) => ['FILED', 'UNDER_REVIEW'].includes(c.status)),
    invoices,
    pending_invoices: invoices.filter((i) => ['DRAFT', 'PENDING_APPROVAL'].includes(i.status)),
    appointment_requests: [ROLES.SERVICE_ADVISOR, ROLES.SHOP_MANAGER, ROLES.SHOP_FOREMAN].includes(role)
      ? listAppointments(user)
      : [],
    technicians: techs,
    cert_alerts: techs.flatMap((t) => t.certifications.filter((c) => {
      const days = (new Date(c.expires_on) - new Date()) / 864e5;
      return days <= 14;
    }).map((c) => ({ ...c, technician_name: t.full_name }))),
    assigned_work: user.role === ROLES.TECHNICIAN
      ? listRepairOrders(user)
      : []
  };
}

function requireStaffUnlessCustomer(user) {
  if (!user) throw forbidden();
}

function requireRoles(user, roles) {
  if (!roles.includes(user.role)) throw forbidden(`${roles.join(' or ')} access required`);
}

export { ignoreClientAuth, requireRoles };
