import { IDS } from './ids.js';

function isoAt(daysFromToday, hour, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateAt(daysFromToday) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export function seed(db) {
  const already = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (already > 0) return;

  const { users: U, customers: C, vehicles: V, technicians: T, bays: B, parts: P } = IDS;

  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, name, contact_name, email, phone, billing_address, preferred_contact, status, outstanding_balance_cents, hold_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, full_name, role, customer_id, approval_limit_cents)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertVehicle = db.prepare(`
    INSERT INTO vehicles (id, customer_id, vin, make, model, year, license_plate, mileage, drivetrain, engine_family, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTech = db.prepare(`
    INSERT INTO technicians (id, user_id, daily_labor_hour_limit, employment_status, safety_qc_score, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertCert = db.prepare(`
    INSERT INTO certifications (id, technician_id, cert_type, expires_on)
    VALUES (?, ?, ?, ?)
  `);
  const insertBay = db.prepare(`
    INSERT INTO bays (id, number, name, type, equipment, status, version, maintenance_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPart = db.prepare(`
    INSERT INTO parts (id, part_number, description, quantity_on_hand, quantity_reserved, reorder_threshold, unit_cost_cents, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertCompat = db.prepare(`
    INSERT INTO part_compatibilities (id, part_id, make, model, year_from, year_to, drivetrain, engine_family)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertCoverage = db.prepare(`
    INSERT INTO warranty_coverages (id, vehicle_id, coverage_type, component, expires_on, mileage_limit, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRo = db.prepare(`
    INSERT INTO repair_orders (id, number, customer_id, vehicle_id, opened_by, intake_notes, diagnostic_findings, intake_mileage, priority, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEst = db.prepare(`
    INSERT INTO estimates (id, repair_order_id, status, revision, expires_at, created_by, sent_at, staff_approved_by, staff_approved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLine = db.prepare(`
    INSERT INTO estimate_line_items (
      id, estimate_id, repair_order_id, kind, description, required_certification,
      hours, labor_rate_cents, part_id, quantity, unit_cost_cents, amount_cents,
      customer_approval, approved_by, approved_at, created_by, documentation_required, billed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertBooking = db.prepare(`
    INSERT INTO bay_bookings (id, bay_id, repair_order_id, window_start, window_end, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAssign = db.prepare(`
    INSERT INTO technician_assignments (id, technician_id, repair_order_id, window_start, window_end, overtime_override, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRes = db.prepare(`
    INSERT INTO part_reservations (id, part_id, repair_order_id, line_item_id, quantity, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertShip = db.prepare(`
    INSERT INTO shipments (id, part_id, quantity, status, expected_on, received_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertClaim = db.prepare(`
    INSERT INTO warranty_claims (id, repair_order_id, line_item_id, coverage_id, coverage_type, claim_amount_cents, status, filed_by, reviewer_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertInv = db.prepare(`
    INSERT INTO invoices (id, number, customer_id, repair_order_id, subtotal_cents, tax_cents, discount_cents, total_cents, status, created_by, approved_by, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertInvLine = db.prepare(`
    INSERT INTO invoice_line_items (id, invoice_id, estimate_line_item_id, description, amount_cents)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertDoc = db.prepare(`
    INSERT INTO job_documents (id, repair_order_id, line_item_id, doc_type, notes, attached_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAudit = db.prepare(`
    INSERT INTO audit_log (id, actor_id, actor_name, actor_role, action, entity, entity_id, previous_state, new_state, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const txn = db.transaction(() => {
    insertCustomer.run(C.harlow, 'Harlow Freight & Fleet', 'Dana Harlow', 'dana@harlowfreight.example', '555-0101', '1400 Yard Rd, Oakland, CA', 'EMAIL', 'ACTIVE', 42000, null);
    insertCustomer.run(C.nkemdirim, 'Nkemdirim Transit Co.', 'Ife Nkemdirim', 'ife@nkemdirim.example', '555-0102', '88 Harbor Ave, Newark, NJ', 'PHONE', 'ACTIVE', 185000, null);
    insertCustomer.run(C.blueridge, 'Blue Ridge Delivery', 'Sam Whitlock', 'sam@blueridge.example', '555-0103', '12 Ridge Ct, Asheville, NC', 'EMAIL', 'ON_HOLD', 640000, 'Past-due invoices over shop credit limit');
    insertCustomer.run(C.costanza, 'Costanza Rideshare Partners', 'Gina Costanza', 'gina@costanza.example', '555-0104', '501 Market St, Chicago, IL', 'SMS', 'ACTIVE', 0, null);
    insertCustomer.run(C.meridian, 'Meridian Courier Group', 'Omar Farouk', 'omar@meridian.example', '555-0105', '77 Canal St, Houston, TX', 'EMAIL', 'SUSPENDED', 910000, 'Account suspended pending collections');

    insertUser.run(U.nora, 'nora.adler@torquebay.example', 'Nora Adler', 'SERVICE_ADVISOR', null, 250000);
    insertUser.run(U.avery, 'avery.cole@torquebay.example', 'Avery Cole', 'SERVICE_ADVISOR', null, 250000);
    insertUser.run(U.marcus, 'marcus.hale@torquebay.example', 'Marcus Hale', 'TECHNICIAN', null, 0);
    insertUser.run(U.priya, 'priya.okonkwo@torquebay.example', 'Priya Okonkwo', 'TECHNICIAN', null, 0);
    insertUser.run(U.devon, 'devon.ruiz@torquebay.example', 'Devon Ruiz', 'TECHNICIAN', null, 0);
    insertUser.run(U.elena, 'elena.vasquez@torquebay.example', 'Elena Vasquez', 'TECHNICIAN', null, 0);
    insertUser.run(U.jamal, 'jamal.wright@torquebay.example', 'Jamal Wright', 'TECHNICIAN', null, 0);
    insertUser.run(U.theo, 'theo.bergman@torquebay.example', 'Theo Bergman', 'SHOP_FOREMAN', null, 0);
    insertUser.run(U.quinn, 'quinn.patel@torquebay.example', 'Quinn Patel', 'PARTS_MANAGER', null, 0);
    insertUser.run(U.rhea, 'rhea.solis@torquebay.example', 'Rhea Solis', 'SHOP_MANAGER', null, 5000000);
    insertUser.run(U.kenji, 'kenji.morita@torquebay.example', 'Kenji Morita', 'WARRANTY_ADMIN', null, 0);
    insertUser.run(U.lina, 'lina.cho@torquebay.example', 'Lina Cho', 'WARRANTY_ADMIN', null, 0);
    insertUser.run(U.dana, 'dana@harlowfreight.example', 'Dana Harlow', 'CUSTOMER', C.harlow, 0);
    insertUser.run(U.ife, 'ife@nkemdirim.example', 'Ife Nkemdirim', 'CUSTOMER', C.nkemdirim, 0);
    insertUser.run(U.sam, 'sam@blueridge.example', 'Sam Whitlock', 'CUSTOMER', C.blueridge, 0);
    insertUser.run(U.gina, 'gina@costanza.example', 'Gina Costanza', 'CUSTOMER', C.costanza, 0);
    insertUser.run(U.omar, 'omar@meridian.example', 'Omar Farouk', 'CUSTOMER', C.meridian, 0);

    insertVehicle.run(V.f150, C.harlow, '1FTFW1E84NFA00011', 'Ford', 'F-150', 2023, 'CA-HRL-01', 42810, 'GAS', 'COYOTE-5.0', 'CHECKED_IN');
    insertVehicle.run(V.tesla, C.nkemdirim, '5YJYGDEE7NF000022', 'Tesla', 'Model Y', 2022, 'NJ-NKM-22', 31240, 'EV', '3D5-DUAL', 'IN_BAY');
    insertVehicle.run(V.camry, C.blueridge, '4T1K61AK5LU000033', 'Toyota', 'Camry Hybrid', 2020, 'NC-BRD-20', 86720, 'HYBRID', 'A25A-FXS', 'AWAITING_PARTS');
    insertVehicle.run(V.freightliner, C.harlow, '3AKJHHDR8LSLX0044', 'Freightliner', 'Cascadia', 2019, 'CA-HRL-HD', 312800, 'DIESEL', 'DD15', 'AWAITING_APPROVAL');
    insertVehicle.run(V.civic, C.costanza, '2HGFC2F89MH000055', 'Honda', 'Civic', 2021, 'IL-CST-21', 54110, 'GAS', 'L15B7', 'PICKED_UP');
    insertVehicle.run(V.bolt, C.meridian, '1G1SN6S30RU000066', 'Chevrolet', 'Bolt EUV', 2024, 'TX-MRD-24', 8900, 'EV', 'EV-PROP', 'CHECKED_IN');

    insertTech.run(T.marcus, U.marcus, 8, 'ACTIVE', 94, 'AVAILABLE');
    insertTech.run(T.priya, U.priya, 8, 'ACTIVE', 97, 'ON_JOB');
    insertTech.run(T.devon, U.devon, 10, 'ACTIVE', 91, 'AVAILABLE');
    insertTech.run(T.elena, U.elena, 8, 'ACTIVE', 96, 'ASSIGNED');
    insertTech.run(T.jamal, U.jamal, 6, 'ACTIVE', 88, 'AVAILABLE');

    insertCert.run('cert-marcus-general', T.marcus, 'GENERAL', dateAt(400));
    insertCert.run('cert-marcus-align', T.marcus, 'ALIGNMENT', dateAt(200));
    insertCert.run('cert-priya-general', T.priya, 'GENERAL', dateAt(360));
    insertCert.run('cert-priya-ev', T.priya, 'EV_HYBRID', dateAt(1));
    insertCert.run('cert-devon-general', T.devon, 'GENERAL', dateAt(300));
    insertCert.run('cert-devon-epa', T.devon, 'EPA_609', dateAt(180));
    insertCert.run('cert-elena-general', T.elena, 'GENERAL', dateAt(250));
    insertCert.run('cert-elena-align', T.elena, 'ALIGNMENT', dateAt(90));
    insertCert.run('cert-jamal-general', T.jamal, 'GENERAL', dateAt(120));

    insertBay.run(B.bay1, 1, 'Bay 1 · General lift', 'LIFT', '2-post 10k lift', 'AVAILABLE', 1, null);
    insertBay.run(B.bay2, 2, 'Bay 2 · Alignment rack', 'ALIGNMENT', 'Hunter rack + sensors', 'OCCUPIED', 4, null);
    insertBay.run(B.bay3, 3, 'Bay 3 · Diagnostic', 'DIAGNOSTIC', 'Snap-on MODIS Ultra', 'AVAILABLE', 2, null);
    insertBay.run(B.bay4, 4, 'Bay 4 · Heavy-duty lift', 'HEAVY_DUTY', 'Mobile column 18k', 'MAINTENANCE_HOLD', 3, 'Column lock inspection');

    insertPart.run(P.caliper, 'CAL-FRONT-L', 'Front left brake caliper', 1, 0, 2, 18600, 'LOW_STOCK');
    insertPart.run(P.pads, 'PAD-CERAMIC-F', 'Ceramic front brake pads', 12, 0, 4, 6400, 'IN_STOCK');
    insertPart.run(P.hybridBatt, 'HYB-BATT-MOD', 'Hybrid battery module', 1, 0, 1, 128000, 'LOW_STOCK');
    insertPart.run(P.refrigerant, 'R134A-30', 'R-134a refrigerant 30 lb', 0, 0, 2, 9200, 'BACKORDERED');
    insertPart.run(P.transFilter, 'TRANS-FLT-10R80', '10R80 transmission filter', 0, 0, 2, 4800, 'ON_ORDER');
    insertPart.run(P.alignKit, 'ALG-TIE-KIT', 'Outer tie-rod alignment kit', 6, 2, 2, 7400, 'RESERVED');
    insertPart.run(P.evCoolant, 'EV-COOL-1G', 'EV battery coolant 1 gal', 6, 0, 2, 3800, 'IN_STOCK');
    insertPart.run(P.rotor, 'ROTOR-FRONT-L', 'Front left brake rotor', 4, 0, 2, 8900, 'IN_STOCK');

    const compat = [
      ['cmp-cal-ford', P.caliper, 'Ford', 'F-150', 2018, 2024, 'GAS', 'COYOTE-5.0'],
      ['cmp-cal-honda', P.caliper, 'Honda', 'Civic', 2016, 2022, 'GAS', 'L15B7'],
      ['cmp-pads-ford', P.pads, 'Ford', 'F-150', 2018, 2024, 'GAS', 'COYOTE-5.0'],
      ['cmp-pads-honda', P.pads, 'Honda', 'Civic', 2016, 2022, 'GAS', 'L15B7'],
      ['cmp-hyb-toy', P.hybridBatt, 'Toyota', 'Camry Hybrid', 2018, 2022, 'HYBRID', 'A25A-FXS'],
      ['cmp-r134-toy', P.refrigerant, 'Toyota', 'Camry Hybrid', 2018, 2022, 'HYBRID', 'A25A-FXS'],
      ['cmp-r134-ford', P.refrigerant, 'Ford', 'F-150', 2015, 2024, 'GAS', 'COYOTE-5.0'],
      ['cmp-tf-ford', P.transFilter, 'Ford', 'F-150', 2018, 2024, 'GAS', 'COYOTE-5.0'],
      ['cmp-alg-frl', P.alignKit, 'Freightliner', 'Cascadia', 2015, 2022, 'DIESEL', 'DD15'],
      ['cmp-evc-tesla', P.evCoolant, 'Tesla', 'Model Y', 2020, 2024, 'EV', '3D5-DUAL'],
      ['cmp-evc-bolt', P.evCoolant, 'Chevrolet', 'Bolt EUV', 2022, 2025, 'EV', 'EV-PROP'],
      ['cmp-rot-honda', P.rotor, 'Honda', 'Civic', 2016, 2022, 'GAS', 'L15B7']
    ];
    for (const row of compat) insertCompat.run(...row);

    insertCoverage.run('cov-tesla-batt', V.tesla, 'MANUFACTURER', 'BATTERY', dateAt(700), 80000, 1);
    insertCoverage.run('cov-tesla-drive', V.tesla, 'MANUFACTURER', 'DRIVE_UNIT', dateAt(700), 80000, 1);
    insertCoverage.run('cov-f150-shop', V.f150, 'SHOP', 'POWERTRAIN', dateAt(90), 60000, 1);
    insertCoverage.run('cov-bolt-batt', V.bolt, 'MANUFACTURER', 'BATTERY', dateAt(900), 100000, 1);

    const past = isoAt(-12, 14);
    const recent = isoAt(-2, 13);
    const today = isoAt(0, 9);

    insertRo.run('ro-1001', 'RO-1001', C.harlow, V.f150, U.nora, 'Customer reports front-end growl under braking.', null, 42810, 'NORMAL', 'DRAFT', today, today);
    insertEst.run('est-1001-expired', 'ro-1001', 'EXPIRED', 1, dateAt(-8), U.nora, isoAt(-12, 10), null, null);
    insertLine.run('line-1001-expired', 'est-1001-expired', 'ro-1001', 'LABOR', 'Front brake inspection (expired quote)', null, 1, 14500, null, null, null, 14500, 'NONE', null, null, U.nora, 'ROAD_TEST', 0);

    insertRo.run('ro-1002', 'RO-1002', C.costanza, V.civic, U.nora, 'Pulsation on braking, pads near limit.', 'Front pads and rotor wear confirmed.', 54110, 'NORMAL', 'ESTIMATE_PENDING', recent, recent);
    insertEst.run('est-1002', 'ro-1002', 'PENDING_APPROVAL', 1, dateAt(12), U.nora, recent, null, null);
    insertLine.run('line-1002-labor', 'est-1002', 'ro-1002', 'LABOR', 'Front brake job labor', null, 2, 14500, null, null, null, 29000, 'NONE', null, null, U.nora, 'ROAD_TEST', 0);
    insertLine.run('line-1002-pads', 'est-1002', 'ro-1002', 'PARTS', 'Ceramic front brake pads', null, null, null, P.pads, 1, 6400, 6400, 'NONE', null, null, U.nora, null, 0);
    insertLine.run('line-1002-rotor', 'est-1002', 'ro-1002', 'PARTS', 'Front left brake rotor', null, null, null, P.rotor, 1, 8900, 8900, 'NONE', null, null, U.nora, null, 0);

    insertRo.run('ro-1003', 'RO-1003', C.harlow, V.freightliner, U.nora, 'Steering wander after curb strike.', 'Toe out of spec on drive axle.', 312800, 'HIGH', 'ESTIMATE_APPROVED', recent, recent);
    insertEst.run('est-1003', 'ro-1003', 'APPROVED', 1, dateAt(10), U.nora, recent, U.rhea, recent);
    insertLine.run('line-1003-labor', 'est-1003', 'ro-1003', 'LABOR', 'Heavy-duty alignment', 'ALIGNMENT', 3, 16500, null, null, null, 49500, 'APPROVED', U.dana, recent, U.nora, 'TORQUE', 0);
    insertLine.run('line-1003-kit', 'est-1003', 'ro-1003', 'PARTS', 'Outer tie-rod alignment kit', null, null, null, P.alignKit, 2, 7400, 14800, 'APPROVED', U.dana, recent, U.nora, null, 0);
    insertRes.run('res-1003-kit', P.alignKit, 'ro-1003', 'line-1003-kit', 2, 'RESERVED');
    insertAssign.run('asg-1003-elena', T.elena, 'ro-1003', isoAt(1, 8), isoAt(1, 12), 0, 'ACTIVE');

    insertRo.run('ro-1004', 'RO-1004', C.nkemdirim, V.tesla, U.nora, 'Range drop and drive-unit whine.', 'Drive unit bearing noise. Battery coolant service also due.', 31240, 'URGENT', 'IN_PROGRESS', isoAt(-1, 8), isoAt(0, 8));
    insertEst.run('est-1004', 'ro-1004', 'APPROVED', 1, dateAt(8), U.nora, isoAt(-1, 9), U.rhea, isoAt(-1, 10));
    insertLine.run('line-1004-drive', 'est-1004', 'ro-1004', 'LABOR', 'Drive unit inspection and repair', 'EV_HYBRID', 4, 17500, null, null, null, 70000, 'APPROVED', U.ife, isoAt(-1, 11), U.nora, 'PHOTO', 0);
    insertLine.run('line-1004-cool', 'est-1004', 'ro-1004', 'PARTS', 'EV battery coolant 1 gal', 'EV_HYBRID', null, null, P.evCoolant, 1, 3800, 3800, 'APPROVED', U.ife, isoAt(-1, 11), U.nora, null, 0);
    db.prepare('UPDATE estimate_line_items SET warranty_component = ? WHERE id = ?').run('DRIVE_UNIT', 'line-1004-drive');
    insertBooking.run('bk-1004-bay2', B.bay2, 'ro-1004', isoAt(0, 8), isoAt(0, 16), 'ACTIVE');
    insertAssign.run('asg-1004-priya', T.priya, 'ro-1004', isoAt(0, 8), isoAt(0, 16), 0, 'ACTIVE');
    insertClaim.run('wc-1004-review', 'ro-1004', 'line-1004-drive', 'cov-tesla-drive', 'MANUFACTURER', 70000, 'UNDER_REVIEW', U.kenji, null, 'Drive unit noise under OEM powertrain warranty.');

    insertRo.run('ro-1005', 'RO-1005', C.blueridge, V.camry, U.nora, 'No cabin cooling. Hybrid system otherwise normal.', 'Low refrigerant; compressor clutch cycles.', 86720, 'NORMAL', 'AWAITING_PARTS', isoAt(-3, 10), recent);
    insertEst.run('est-1005', 'ro-1005', 'PARTIALLY_APPROVED', 2, dateAt(6), U.nora, isoAt(-3, 12), null, null);
    insertLine.run('line-1005-ac', 'est-1005', 'ro-1005', 'LABOR', 'A/C recovery and recharge', 'EPA_609', 2, 15500, null, null, null, 31000, 'APPROVED', U.sam, isoAt(-3, 14), U.nora, 'PHOTO', 0);
    insertLine.run('line-1005-gas', 'est-1005', 'ro-1005', 'PARTS', 'R-134a refrigerant 30 lb', 'EPA_609', null, null, P.refrigerant, 1, 9200, 9200, 'APPROVED', U.sam, isoAt(-3, 14), U.nora, null, 0);
    insertLine.run('line-1005-extra', 'est-1005', 'ro-1005', 'LABOR', 'Hybrid inverter inspection found mid-repair', 'EV_HYBRID', 1.5, 15500, null, null, null, 23250, 'NONE', null, null, U.devon, 'PHOTO', 0);
    insertRes.run('res-1005-gas', P.refrigerant, 'ro-1005', 'line-1005-gas', 1, 'BACKORDERED');

    insertRo.run('ro-1006', 'RO-1006', C.costanza, V.civic, U.nora, 'Oil service and inspection.', 'Completed without additional findings.', 49880, 'LOW', 'COMPLETED', past, isoAt(-10, 16));
    insertEst.run('est-1006', 'ro-1006', 'APPROVED', 1, dateAt(-1), U.nora, past, U.nora, past);
    insertLine.run('line-1006-labor', 'est-1006', 'ro-1006', 'LABOR', 'Oil service labor', null, 0.8, 12500, null, null, null, 10000, 'APPROVED', U.gina, past, U.nora, 'ROAD_TEST', 1);
    insertDoc.run('doc-1006-road', 'ro-1006', 'line-1006-labor', 'ROAD_TEST', 'Road test passed after oil service.', U.marcus);

    insertRo.run('ro-1007', 'RO-1007', C.harlow, V.f150, U.nora, 'Transmission filter service.', 'Filter and fluid replaced.', 39100, 'NORMAL', 'INVOICED', isoAt(-20, 9), isoAt(-18, 15));
    insertEst.run('est-1007', 'ro-1007', 'APPROVED', 1, dateAt(-5), U.nora, isoAt(-20, 10), U.rhea, isoAt(-20, 11));
    insertLine.run('line-1007-labor', 'est-1007', 'ro-1007', 'LABOR', 'Transmission service labor', null, 2, 14500, null, null, null, 29000, 'APPROVED', U.dana, isoAt(-20, 12), U.nora, 'TORQUE', 1);
    insertLine.run('line-1007-filt', 'est-1007', 'ro-1007', 'PARTS', '10R80 transmission filter (historical)', null, null, null, P.transFilter, 1, 4800, 4800, 'APPROVED', U.dana, isoAt(-20, 12), U.nora, null, 1);
    insertInv.run('inv-1007', 'INV-1007', C.harlow, 'ro-1007', 33800, 2873, 0, 36673, 'SENT', U.rhea, U.rhea, isoAt(-18, 16));
    insertInvLine.run('invl-1007-a', 'inv-1007', 'line-1007-labor', 'Transmission service labor', 29000);
    insertInvLine.run('invl-1007-b', 'inv-1007', 'line-1007-filt', '10R80 transmission filter (historical)', 4800);

    insertRo.run('ro-1008', 'RO-1008', C.costanza, V.civic, U.nora, 'Customer cancelled after check-in.', null, 54000, 'LOW', 'CANCELLED', isoAt(-8, 9), isoAt(-8, 10));

    insertRo.run('ro-1019', 'RO-1019', C.costanza, V.civic, U.nora, 'Wiper-arm chatter on the Civic.', 'Paid historical wiper service.', 49820, 'LOW', 'INVOICED', isoAt(-30, 9), isoAt(-28, 15));
    insertEst.run('est-1019', 'ro-1019', 'APPROVED', 1, dateAt(-20), U.nora, isoAt(-30, 10), U.rhea, isoAt(-30, 11));
    insertLine.run('line-1019-labor', 'est-1019', 'ro-1019', 'LABOR', 'Wiper-arm service labor', null, 0.5, 14400, null, null, null, 7200, 'APPROVED', U.gina, isoAt(-30, 12), U.nora, null, 1);
    insertInv.run('inv-1019', 'INV-1019', C.costanza, 'ro-1019', 7200, 0, 0, 7200, 'PAID', U.rhea, U.rhea, isoAt(-28, 16));
    insertInvLine.run('invl-1019-a', 'inv-1019', 'line-1019-labor', 'Wiper-arm service labor', 7200);

    insertRo.run('ro-1009', 'RO-1009', C.meridian, V.bolt, U.nora, 'Charging fault after rain.', 'Pending isolation test.', 8900, 'HIGH', 'DIAGNOSING', isoAt(-1, 15), isoAt(-1, 16));

    insertRo.run('ro-1010', 'RO-1010', C.harlow, V.f150, U.nora, 'Front brakes still pulling after the last visit.', 'Approved brake follow-up, waiting on a bay.', 42810, 'NORMAL', 'ESTIMATE_APPROVED', recent, recent);
    insertEst.run('est-1010', 'ro-1010', 'APPROVED', 1, dateAt(14), U.nora, recent, U.rhea, recent);
    insertLine.run('line-1010-general', 'est-1010', 'ro-1010', 'LABOR', 'General brake follow-up', 'GENERAL', 2, 14500, null, null, null, 29000, 'APPROVED', U.dana, recent, U.nora, 'ROAD_TEST', 0);

    insertRo.run('ro-1011', 'RO-1011', C.costanza, V.civic, U.nora, 'Road noise from the Civic at highway speed.', 'Approved road-noise check, waiting on a bay.', 54110, 'NORMAL', 'ESTIMATE_APPROVED', recent, recent);
    insertEst.run('est-1011', 'ro-1011', 'APPROVED', 1, dateAt(14), U.nora, recent, U.rhea, recent);
    insertLine.run('line-1011-general', 'est-1011', 'ro-1011', 'LABOR', 'General road-noise inspection', 'GENERAL', 2, 14500, null, null, null, 29000, 'APPROVED', U.gina, recent, U.nora, 'ROAD_TEST', 0);

    insertRo.run('ro-1012', 'RO-1012', C.nkemdirim, V.tesla, U.nora, 'EV coolant follow-up after the range complaint.', 'Approved EV coolant follow-up, not yet scheduled.', 31240, 'NORMAL', 'ESTIMATE_APPROVED', recent, recent);
    insertEst.run('est-1012', 'ro-1012', 'APPROVED', 1, dateAt(14), U.nora, recent, U.rhea, recent);
    insertLine.run('line-1012-ev', 'est-1012', 'ro-1012', 'LABOR', 'EV cooling-system follow-up', 'EV_HYBRID', 2, 17500, null, null, null, 35000, 'APPROVED', U.ife, recent, U.nora, 'PHOTO', 0);
    db.prepare('UPDATE estimate_line_items SET warranty_component = ? WHERE id = ?').run('BATTERY', 'line-1012-ev');

    insertRo.run('ro-1013', 'RO-1013', C.harlow, V.f150, U.nora, 'Inspection after a curb scrape.', 'Approved inspection after a curb scrape.', 42810, 'NORMAL', 'ESTIMATE_APPROVED', recent, recent);
    insertEst.run('est-1013', 'ro-1013', 'APPROVED', 1, dateAt(14), U.nora, recent, U.rhea, recent);
    insertLine.run('line-1013-general', 'est-1013', 'ro-1013', 'LABOR', 'Curb-scrape inspection', 'GENERAL', 2, 14500, null, null, null, 29000, 'APPROVED', U.dana, recent, U.nora, null, 0);

    insertRo.run('ro-1014', 'RO-1014', C.costanza, V.civic, U.nora, 'Rattle under the Civic dash.', 'Approved Civic rattle follow-up.', 54110, 'NORMAL', 'ESTIMATE_APPROVED', recent, recent);
    insertEst.run('est-1014', 'ro-1014', 'APPROVED', 1, dateAt(14), U.nora, recent, U.rhea, recent);
    insertLine.run('line-1014-general', 'est-1014', 'ro-1014', 'LABOR', 'Interior rattle inspection', 'GENERAL', 2, 14500, null, null, null, 29000, 'APPROVED', U.gina, recent, U.nora, null, 0);

    insertRo.run('ro-1015', 'RO-1015', C.harlow, V.f150, U.nora, 'Follow-up inspection before the next haul.', 'Approved general inspection, ready to assign.', 42810, 'NORMAL', 'ESTIMATE_APPROVED', recent, recent);
    insertEst.run('est-1015', 'ro-1015', 'APPROVED', 1, dateAt(14), U.nora, recent, U.rhea, recent);
    insertLine.run('line-1015-general', 'est-1015', 'ro-1015', 'LABOR', 'General follow-up inspection', 'GENERAL', 2, 14500, null, null, null, 29000, 'APPROVED', U.dana, recent, U.nora, null, 0);

    insertRo.run('ro-1016', 'RO-1016', C.costanza, V.civic, U.nora, 'Civic follow-up after the last brake job.', 'Approved Civic inspection, ready to assign.', 54110, 'NORMAL', 'ESTIMATE_APPROVED', recent, recent);
    insertEst.run('est-1016', 'ro-1016', 'APPROVED', 1, dateAt(14), U.nora, recent, U.rhea, recent);
    insertLine.run('line-1016-general', 'est-1016', 'ro-1016', 'LABOR', 'Civic follow-up inspection', 'GENERAL', 2, 14500, null, null, null, 29000, 'APPROVED', U.gina, recent, U.nora, null, 0);

    insertRo.run('ro-1017', 'RO-1017', C.harlow, V.f150, U.nora, 'Full-day service before a long run.', 'Approved full-day service, still unassigned.', 42810, 'NORMAL', 'ESTIMATE_APPROVED', recent, recent);
    insertEst.run('est-1017', 'ro-1017', 'APPROVED', 1, dateAt(14), U.nora, recent, U.rhea, recent);
    insertLine.run('line-1017-general', 'est-1017', 'ro-1017', 'LABOR', 'Eight-hour general service', 'GENERAL', 8, 14500, null, null, null, 116000, 'APPROVED', U.dana, recent, U.nora, null, 0);

    insertRo.run('ro-1018', 'RO-1018', C.harlow, V.f150, U.nora, 'High-value estimate waiting on staff authority.', 'Customer approved; second staff chair required.', 42810, 'HIGH', 'ESTIMATE_PENDING', recent, recent);
    insertEst.run('est-1018', 'ro-1018', 'PENDING_STAFF_APPROVAL', 1, dateAt(14), U.avery, recent, null, null);
    insertLine.run('line-1018-high', 'est-1018', 'ro-1018', 'LABOR', 'Powertrain diagnostic and repair package', 'GENERAL', 20, 20000, null, null, null, 400000, 'APPROVED', U.dana, recent, U.avery, 'PHOTO', 0);

    insertEst.run('est-1006-warranty', 'ro-1006', 'APPROVED', 1, dateAt(-2), U.nora, past, U.rhea, past);
    insertLine.run('line-wc-filed', 'est-1006-warranty', 'ro-1006', 'LABOR', 'Shop courtesy inspection', null, 0.5, 12500, null, null, null, 6250, 'APPROVED', U.gina, past, U.nora, null, 0);
    db.prepare('UPDATE estimate_line_items SET warranty_component = ? WHERE id = ?').run('COURTESY_INSPECTION', 'line-wc-filed');
    insertLine.run('line-wc-approved', 'est-1007', 'ro-1007', 'LABOR', 'Powertrain courtesy related to shop warranty', null, 1, 14500, null, null, null, 14500, 'APPROVED', U.dana, isoAt(-20, 12), U.nora, null, 0);
    insertLine.run('line-wc-denied', 'est-1003', 'ro-1003', 'LABOR', 'Prior alignment claim (denied seed)', 'ALIGNMENT', 1, 16500, null, null, null, 16500, 'APPROVED', U.dana, recent, U.nora, null, 0);

    insertClaim.run('wc-filed', 'ro-1006', 'line-wc-filed', null, 'SHOP', 6250, 'FILED', U.kenji, null, 'Shop courtesy claim awaiting review.');
    insertClaim.run('wc-approved', 'ro-1007', 'line-wc-approved', 'cov-f150-shop', 'SHOP', 14500, 'APPROVED', U.kenji, U.kenji, 'Approved under shop powertrain coverage.');
    insertClaim.run('wc-denied', 'ro-1003', 'line-wc-denied', null, 'MANUFACTURER', 16500, 'DENIED', U.kenji, U.kenji, 'Curb strike is not a warrantable defect.');

    insertShip.run('ship-r134', P.refrigerant, 4, 'INCOMING', dateAt(3), null);
    insertShip.run('ship-tf', P.transFilter, 6, 'INCOMING', dateAt(2), null);
    insertShip.run('ship-pads', P.pads, 8, 'RECEIVED', dateAt(-4), isoAt(-4, 11));

    insertAudit.run('aud-hold-blueridge', U.rhea, 'Rhea Solis', 'SHOP_MANAGER', 'CUSTOMER_HOLD_PLACED', 'customer', C.blueridge, 'ACTIVE', 'ON_HOLD', 'Past-due invoices over shop credit limit');
    insertAudit.run('aud-bay2-book', U.nora, 'Nora Adler', 'SERVICE_ADVISOR', 'BAY_ASSIGNED', 'bay', B.bay2, 'AVAILABLE', 'OCCUPIED', 'Assigned RO-1004 to Bay 2');
    insertAudit.run('aud-priya-asg', U.nora, 'Nora Adler', 'SERVICE_ADVISOR', 'TECHNICIAN_ASSIGNED', 'technician', T.priya, 'AVAILABLE', 'ON_JOB', 'EV drive-unit job');
    insertAudit.run('aud-est-1004', U.ife, 'Ife Nkemdirim', 'CUSTOMER', 'ESTIMATE_APPROVED', 'estimate', 'est-1004', 'PENDING_APPROVAL', 'APPROVED', 'Customer approved Tesla estimate');
    insertAudit.run('aud-wc-1004', U.kenji, 'Kenji Morita', 'WARRANTY_ADMIN', 'WARRANTY_FILED', 'warranty_claim', 'wc-1004-review', null, 'UNDER_REVIEW', 'Manufacturer drive-unit claim');
    insertAudit.run('aud-res-kit', U.quinn, 'Quinn Patel', 'PARTS_MANAGER', 'PARTS_RESERVED', 'part', P.alignKit, 'IN_STOCK', 'RESERVED', 'Reserved 2 alignment kits for RO-1003');
    insertAudit.run('aud-inv-1007', U.rhea, 'Rhea Solis', 'SHOP_MANAGER', 'INVOICE_SENT', 'invoice', 'inv-1007', 'APPROVED', 'SENT', 'Sent INV-1007 to Harlow Freight');
    insertAudit.run('aud-ro-1006', U.theo, 'Theo Bergman', 'SHOP_FOREMAN', 'JOB_COMPLETED', 'repair_order', 'ro-1006', 'IN_PROGRESS', 'COMPLETED', 'Foreman certified completion');
  });

  txn();
}
