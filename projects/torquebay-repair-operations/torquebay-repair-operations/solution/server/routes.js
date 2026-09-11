import { Router } from 'express';
import { listAudit } from './audit.js';
import { requireUser, sessionPayload } from './auth.js';
import { conflict, forbidden, handleError } from './errors.js';
import * as S from './services.js';

const router = Router();

function wrap(fn) {
  return async (req, res) => {
    try {
      const result = fn(req, res);
      const value = result && typeof result.then === 'function' ? await result : result;
      if (value !== undefined) res.json(value);
    } catch (error) {
      handleError(res, error);
    }
  };
}

router.use(requireUser);

router.get('/session', wrap((req) => sessionPayload(req.user)));

router.get('/demo-users', wrap(() => ({ users: S.listDemoUsers() })));

router.get('/dashboard', wrap((req) => S.dashboard(req.user)));

router.get('/customers', wrap((req) => ({ customers: S.listCustomers(req.user, req.query) })));
router.get('/customers/:id', wrap((req) => ({ customer: S.getCustomer(req.user, req.params.id) })));
router.post('/customers', wrap((req) => ({ customer: S.createCustomer(req.user, req.body) })));
router.post('/customers/:id/hold', wrap((req) => ({ customer: S.setCustomerHold(req.user, req.params.id, req.body) })));

router.get('/vehicles', wrap((req) => ({ vehicles: S.listVehicles(req.user, req.query) })));
router.get('/vehicles/:id', wrap((req) => ({ vehicle: S.getVehicle(req.user, req.params.id) })));
router.post('/vehicles', wrap((req) => ({ vehicle: S.checkInVehicle(req.user, req.body) })));
router.patch('/vehicles/:id', wrap((req) => ({ vehicle: S.updateVehicle(req.user, req.params.id, req.body) })));

router.get('/repair-orders', wrap((req) => ({ repair_orders: S.listRepairOrders(req.user, req.query) })));
router.get('/repair-orders/:id', wrap((req) => ({ repair_order: S.getRepairOrder(req.user, req.params.id) })));
router.post('/repair-orders', wrap((req) => ({ repair_order: S.createRepairOrder(req.user, req.body) })));
router.post('/repair-orders/:id/diagnostics', wrap((req) => ({ repair_order: S.recordDiagnostics(req.user, req.params.id, req.body) })));
router.post('/repair-orders/:id/estimates', wrap((req) => S.createEstimate(req.user, req.params.id, req.body)));
router.post('/repair-orders/:id/additional-issue', wrap((req) => S.flagAdditionalIssue(req.user, req.params.id, req.body)));
router.post('/repair-orders/:id/start', wrap((req) => S.startWork(req.user, req.params.id, req.body)));
router.post('/repair-orders/:id/complete', wrap((req) => S.completeRepairOrder(req.user, req.params.id, req.body)));
router.post('/repair-orders/:id/cancel', wrap((req) => ({ repair_order: S.cancelRepairOrder(req.user, req.params.id, req.body) })));
router.post('/repair-orders/:id/ready-for-pickup', wrap((req) => ({ repair_order: S.markReadyForPickup(req.user, req.params.id, req.body) })));

router.get('/estimates', wrap((req) => ({ estimates: S.listEstimates(req.user, req.query) })));
router.get('/estimates/:id', wrap((req) => S.getEstimateDetail(req.user, req.params.id)));
router.post('/estimates/:id/lines', wrap((req) => S.addEstimateLine(req.user, req.params.id, req.body)));
router.post('/estimates/:id/send', wrap((req) => S.sendEstimate(req.user, req.params.id, req.body)));
router.post('/estimates/:id/approve-lines', wrap((req) => S.approveEstimateLines(req.user, req.params.id, req.body)));
router.post('/estimates/:id/staff-approve', wrap((req) => S.staffApproveEstimate(req.user, req.params.id, req.body)));

router.get('/bays', wrap((req) => {
  if (req.user.role === 'CUSTOMER') throw forbidden('Staff access required');
  return { bays: S.listBays() };
}));
router.post('/bays/:id/book', wrap((req) => S.bookBay(req.user, req.params.id, req.body)));
router.post('/bays/:id/maintenance', wrap((req) => ({ bay: S.setBayMaintenance(req.user, req.params.id, req.body) })));
router.post('/bays/:id/release', wrap((req) => ({ bay: S.releaseBay(req.user, req.params.id, req.body) })));

router.get('/technicians', wrap((req) => {
  if (req.user.role === 'CUSTOMER') throw forbidden('Staff access required');
  return { technicians: S.listTechnicians() };
}));
router.post('/technicians/:id/assign', wrap((req) => S.assignTechnician(req.user, req.params.id, req.body)));
router.post('/technicians/:id/reassign', wrap((req) => S.reassignTechnician(req.user, req.params.id, req.body)));
router.post('/technicians/:id/certifications', wrap((req) => ({ certification: S.upsertTechnicianCertification(req.user, req.params.id, req.body) })));
router.post('/labor-logs', wrap((req) => ({ labor_log: S.logLabor(req.user, req.body) })));

router.get('/parts', wrap((req) => {
  if (req.user.role === 'CUSTOMER') throw forbidden('Staff access required');
  return { parts: S.listParts(req.query) };
}));
router.get('/shipments', wrap((req) => {
  if (req.user.role === 'CUSTOMER') throw forbidden('Staff access required');
  return { shipments: S.listShipments() };
}));
router.post('/parts/:id/reserve', wrap((req) => S.reservePart(req.user, req.params.id, req.body)));
router.post('/parts/:id/receive', wrap((req) => S.receiveShipment(req.user, req.params.id, req.body)));
router.post('/parts/:id/usage', wrap((req) => S.recordPartUsage(req.user, req.params.id, req.body)));

router.get('/warranty-claims', wrap((req) => ({ claims: S.listWarrantyClaims(req.user, req.query) })));
router.post('/warranty-claims', wrap((req) => ({ claim: S.fileWarrantyClaim(req.user, req.body) })));
router.post('/warranty-claims/:id/review', wrap((req) => ({ claim: S.reviewWarrantyClaim(req.user, req.params.id, req.body) })));
router.post('/warranty-claims/:id/reimburse', wrap((req) => ({ claim: S.reimburseWarrantyClaim(req.user, req.params.id) })));

router.get('/invoices', wrap((req) => ({ invoices: S.listInvoices(req.user, req.query) })));
router.get('/invoices/:id', wrap((req) => ({ invoice: S.getInvoice(req.user, req.params.id) })));
router.post('/invoices', wrap((req) => ({ invoice: S.createInvoice(req.user, req.body) })));
router.post('/invoices/:id/approve', wrap((req) => ({ invoice: S.approveInvoice(req.user, req.params.id, req.body) })));
router.post('/invoices/:id/send', wrap((req) => ({ invoice: S.sendInvoice(req.user, req.params.id) })));
router.post('/invoices/:id/pay', wrap((req) => ({ invoice: S.payInvoice(req.user, req.params.id, req.body) })));
router.post('/invoices/:id/void', wrap((req) => ({ invoice: S.voidInvoice(req.user, req.params.id, req.body) })));
router.patch('/invoices/:id', wrap((req) => ({ invoice: S.patchInvoice(req.user, req.params.id, req.body) })));
router.post('/invoices/:id/corrections', wrap((req) => ({ invoice: S.correctInvoice(req.user, req.params.id, req.body) })));

router.post('/job-documents', wrap((req) => ({ document: S.attachDocument(req.user, req.body) })));

router.get('/appointment-requests', wrap((req) => ({ requests: S.listAppointments(req.user) })));
router.post('/appointment-requests', wrap((req) => ({ request: S.requestAppointment(req.user, req.body) })));

router.get('/audit', wrap((req) => {
  if (req.user.role === 'CUSTOMER') throw forbidden('Staff access required');
  return { entries: listAudit(req.query) };
}));

router.patch('/audit/:id', wrap(() => {
  throw conflict('Audit records are append-only and cannot be edited', 'AUDIT_IMMUTABLE');
}));

router.delete('/audit/:id', wrap(() => {
  throw conflict('Audit records are append-only and cannot be deleted', 'AUDIT_IMMUTABLE');
}));

export default router;
