import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../App.jsx';
import { Badge, Button, Card, Empty, ErrorText, Input, LoadingState, Modal, Select, Textarea } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmtDate, money, toIso } from '../lib/utils.js';

export default function RepairOrderDetail() {
  const { id } = useParams();
  const { user, notify } = useSession();
  const [ro, setRo] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [lookups, setLookups] = useState({ bays: [], techs: [], parts: [] });

  async function load() {
    setError('');
    const { repair_order } = await api(`/api/repair-orders/${id}`);
    setRo(repair_order);
  }

  useEffect(() => {
    setRo(null);
    setError('');
    load().catch((e) => setError(e.message));
  }, [id, user.id]);

  async function run(path, body, ok) {
    setError('');
    try {
      await api(path, { method: 'POST', body });
      notify(ok);
      setModal(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!ro && error) return (
    <Card title="Repair order unavailable">
      <ErrorText>{error}</ErrorText>
      <p className="mt-3 text-sm text-slate-600">The requested record may have moved or may not be available to your current role.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => load().catch((e) => setError(e.message))}>Try this record again</Button>
        <Link to="/repair-orders" className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">Return to repair orders</Link>
      </div>
    </Card>
  );
  if (!ro) return <LoadingState label="Loading repair-order details…" />;
  const estimate = ro.estimates[0];

  return (
    <div className="space-y-4">
      <Link to="/repair-orders" className="text-sm text-orange-700">← Repair orders</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{ro.number}</h1>
            <Badge status={ro.status} />
            <Badge status={ro.priority} />
          </div>
          <p className="text-slate-500">{ro.customer_name} · {ro.year} {ro.make} {ro.model} · VIN {ro.vin}</p>
          <p className="text-xs text-slate-500">Intake mileage {ro.intake_mileage} (historical snapshot; later vehicle updates do not change this)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['SERVICE_ADVISOR', 'TECHNICIAN', 'SHOP_FOREMAN', 'SHOP_MANAGER'].includes(user.role) && (
            <Button variant="secondary" onClick={() => { setForm({ findings: ro.diagnostic_findings || '' }); setModal('diag'); }}>Diagnostics</Button>
          )}
          {['SERVICE_ADVISOR', 'SHOP_MANAGER', 'TECHNICIAN'].includes(user.role) && (
            <Button variant="secondary" onClick={() => run(`/api/repair-orders/${ro.id}/estimates`, {}, 'Estimate drafted')}>New estimate</Button>
          )}
          {['SERVICE_ADVISOR', 'SHOP_FOREMAN', 'SHOP_MANAGER'].includes(user.role) && (
            <Button variant="secondary" onClick={async () => {
              const [b, t] = await Promise.all([api('/api/bays'), api('/api/technicians')]);
              setLookups({ bays: b.bays, techs: t.technicians, parts: [] });
              setForm({ bay_id: b.bays[0]?.id, technician_id: t.technicians[0]?.id, window_start: '', window_end: '' });
              setModal('assign');
            }}>Assign bay / tech</Button>
          )}
          {['SERVICE_ADVISOR', 'SHOP_FOREMAN', 'SHOP_MANAGER'].includes(user.role) && (
            <Button onClick={() => run(`/api/repair-orders/${ro.id}/start`, {}, 'Start evaluated')}>Start work</Button>
          )}
          {['TECHNICIAN', 'SHOP_FOREMAN', 'SHOP_MANAGER'].includes(user.role) && (
            <Button onClick={() => run(`/api/repair-orders/${ro.id}/complete`, { idempotency_key: `complete:${ro.id}` }, 'Completion submitted')}>Complete job</Button>
          )}
          {['SERVICE_ADVISOR', 'SHOP_MANAGER', 'SHOP_FOREMAN'].includes(user.role) && (
            <Button variant="danger" onClick={() => { setError(''); setForm({ reason: '' }); setModal('cancel'); }}>Cancel</Button>
          )}
          {['SERVICE_ADVISOR', 'SHOP_MANAGER'].includes(user.role) && (
            <Button variant="secondary" aria-label={`Generate invoice for ${ro.number}`} onClick={() => run('/api/invoices', { repair_order_id: ro.id }, 'Invoice generated')}>Generate invoice for {ro.number}</Button>
          )}
          {['SERVICE_ADVISOR', 'SHOP_MANAGER'].includes(user.role) && ['COMPLETED', 'INVOICED'].includes(ro.status) && (
            <Button variant="secondary" onClick={() => run(`/api/repair-orders/${ro.id}/ready-for-pickup`, { notes: 'Customer pickup may be arranged' }, 'Marked ready for pickup')}>Ready for pickup</Button>
          )}
        </div>
      </div>
      <ErrorText>{error}</ErrorText>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Intake & diagnosis" className="xl:col-span-2">
          <p className="text-sm"><strong>Notes:</strong> {ro.intake_notes || '—'}</p>
          <p className="mt-2 text-sm"><strong>Findings:</strong> {ro.diagnostic_findings || '—'}</p>
        </Card>
        <Card title="Vehicle snapshot">
          <p className="mb-2"><Badge status={ro.vehicle_status} /></p>
          <p className="text-sm">{ro.drivetrain} · {ro.engine_family || 'n/a'}</p>
          <p className="text-sm">Plate {ro.license_plate || '—'}</p>
          <p className="text-sm">Current vehicle mileage {ro.vehicle_mileage}</p>
        </Card>
      </div>

      <Card title="Estimate lines" action={estimate && ['SERVICE_ADVISOR', 'SHOP_MANAGER'].includes(user.role) ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { setForm({ kind: 'LABOR', description: '', hours: 1, required_certification: '' }); setModal('line'); }}>Add line</Button>
          <Button variant="secondary" onClick={() => run(`/api/estimates/${estimate.id}/send`, {}, 'Estimate sent')}>Send for approval</Button>
          <Button variant="secondary" onClick={() => run(`/api/estimates/${estimate.id}/staff-approve`, {}, 'Staff approval recorded')}>Staff approve</Button>
        </div>
      ) : null}>
        {estimate && <p className="mb-2 text-sm">Estimate {estimate.id.slice(0, 8)} · <Badge status={estimate.status} /> · expires {estimate.expires_at || '—'}</p>}
        {ro.lines.length ? (
        <>
        <div className="space-y-2 sm:hidden" aria-label="Estimate line cards">
          {ro.lines.map((line) => (
            <article key={line.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{line.description}</p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Kind</dt><dd>{line.kind}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Cert</dt><dd className="text-right">{line.required_certification || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Amount</dt><dd>{money(line.amount_cents)}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Customer</dt><dd><Badge status={line.customer_approval} /></dd></div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-slate-500">Docs</dt>
                  <dd className="text-right">
                    {line.documentation_required || '—'}
                    {['TECHNICIAN', 'SHOP_FOREMAN'].includes(user.role) && line.documentation_required && (
                      <Button className="ml-2" variant="ghost" aria-label={`Attach ${line.documentation_required} for ${line.description}`} onClick={() => run('/api/job-documents', {
                        repair_order_id: ro.id, line_item_id: line.id, doc_type: line.documentation_required, notes: 'Attached from shop floor'
                      }, 'Documentation attached')}>Attach {line.documentation_required}</Button>
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr><th className="py-2">Kind</th><th>Description</th><th>Cert</th><th>Amount</th><th>Customer</th><th>Docs</th></tr>
            </thead>
            <tbody>
              {ro.lines.map((line) => (
                <tr key={line.id} className="border-t border-slate-100">
                  <td className="py-2">{line.kind}</td>
                  <td>{line.description}</td>
                  <td>{line.required_certification || '—'}</td>
                  <td>{money(line.amount_cents)}</td>
                  <td><Badge status={line.customer_approval} /></td>
                  <td>
                    {line.documentation_required || '—'}
                    {['TECHNICIAN', 'SHOP_FOREMAN'].includes(user.role) && line.documentation_required && (
                      <Button className="ml-2" variant="ghost" aria-label={`Attach ${line.documentation_required} for ${line.description}`} onClick={() => run('/api/job-documents', {
                        repair_order_id: ro.id, line_item_id: line.id, doc_type: line.documentation_required, notes: 'Attached from shop floor'
                      }, 'Documentation attached')}>Attach {line.documentation_required}</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        ) : (
          <Empty title="No estimate lines yet">Quoted labor and parts will appear here after a line is added.</Empty>
        )}
        {user.role === 'CUSTOMER' && estimate && (
          <div className="mt-3">
            <Button onClick={() => run(`/api/estimates/${estimate.id}/approve-lines`, {
              decisions: ro.lines.filter((l) => l.estimate_id === estimate.id && l.customer_approval === 'NONE').map((l) => ({ id: l.id, approval: 'APPROVED' }))
            }, 'Lines approved')}>Approve pending lines</Button>
          </div>
        )}
        {['TECHNICIAN', 'SERVICE_ADVISOR'].includes(user.role) && (
          <div className="mt-3">
            <Button variant="secondary" onClick={() => { setForm({ description: 'Additional issue found mid-repair', hours: 1, required_certification: '' }); setModal('issue'); }}>Flag additional issue</Button>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Bay & technician">
          {ro.bookings.filter((b) => b.status === 'ACTIVE').map((b) => (
            <p key={b.id} className="text-sm">Bay {b.bay_number} <Badge status={b.bay_status} /> {fmtDate(b.window_start)} – {fmtDate(b.window_end)}</p>
          ))}
          {ro.assignments.filter((a) => a.status === 'ACTIVE').map((a) => (
            <p key={a.id} className="text-sm">{a.technician_name} <Badge status={a.technician_status} /> {fmtDate(a.window_start)} – {fmtDate(a.window_end)}</p>
          ))}
          {!ro.bookings.some((b) => b.status === 'ACTIVE') && !ro.assignments.some((a) => a.status === 'ACTIVE') && (
            <Empty title="No bay or technician assigned">A booking and assignment will show here once this job is dispatched.</Empty>
          )}
        </Card>
        <Card title="Parts & warranty">
          {ro.reservations.map((r) => (
            <p key={r.id} className="text-sm">{r.part_number} × {r.quantity} <Badge status={r.status} /></p>
          ))}
          {ro.claims.map((c) => (
            <p key={c.id} className="text-sm">{c.coverage_type} {money(c.claim_amount_cents)} <Badge status={c.status} /></p>
          ))}
          {!ro.reservations.length && !ro.claims.length && (
            <Empty title="No parts or warranty rows">Reservations and claims appear here after they are attached to this repair order.</Empty>
          )}
        </Card>
      </div>

      <Card title="Labor, documents, invoices">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <h4 className="mb-2 text-xs uppercase text-slate-500">Labor</h4>
            {ro.labor.length ? ro.labor.map((l) => <p key={l.id} className="text-sm">{l.technician_name} · {l.hours}h</p>) : <p className="text-sm text-slate-500">No labor logged.</p>}
            {user.role === 'TECHNICIAN' && (
              <Button className="mt-2" variant="secondary" onClick={() => { setForm({ hours: 1, notes: '' }); setModal('labor'); }}>Log labor</Button>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-xs uppercase text-slate-500">Documents</h4>
            {ro.documents.length ? ro.documents.map((d) => <p key={d.id} className="text-sm">{d.doc_type}: {d.notes}</p>) : <p className="text-sm text-slate-500">No documents attached.</p>}
          </div>
          <div>
            <h4 className="mb-2 text-xs uppercase text-slate-500">Invoices</h4>
            {ro.invoices.length ? ro.invoices.map((i) => <p key={i.id} className="text-sm">{i.number} {money(i.total_cents)} <Badge status={i.status} /></p>) : <p className="text-sm text-slate-500">No invoices yet.</p>}
          </div>
        </div>
      </Card>

      {modal === 'diag' && (
        <Modal title="Diagnostic findings" onClose={() => setModal(null)}>
          <Textarea label="Findings" rows={5} value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} />
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={() => run(`/api/repair-orders/${ro.id}/diagnostics`, { findings: form.findings }, 'Diagnostics saved')}>Save</Button>
        </Modal>
      )}
      {modal === 'line' && estimate && (
        <Modal title="Add estimate line" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <Select label="Kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option>LABOR</option><option>PARTS</option>
            </Select>
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label="Hours" type="number" step="0.1" value={form.hours || ''} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
            <Select label="Required certification" value={form.required_certification} onChange={(e) => setForm({ ...form, required_certification: e.target.value })}>
              <option value="">None</option>
              <option>EV_HYBRID</option><option>ALIGNMENT</option><option>EPA_609</option>
            </Select>
            <ErrorText>{error}</ErrorText>
            <Button onClick={() => run(`/api/estimates/${estimate.id}/lines`, form, 'Line added')}>Add line</Button>
          </div>
        </Modal>
      )}
      {modal === 'issue' && (
        <Modal title="Flag additional issue" onClose={() => setModal(null)}>
          <Input label="Issue" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Hours" type="number" className="mt-3" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={() => run(`/api/repair-orders/${ro.id}/additional-issue`, form, 'Unapproved line created')}>Route for approval</Button>
        </Modal>
      )}
      {modal === 'assign' && (
        <Modal title="Assign bay and technician" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <Select label="Bay" value={form.bay_id} onChange={(e) => setForm({ ...form, bay_id: e.target.value })}>
              {lookups.bays.map((b) => <option key={b.id} value={b.id}>Bay {b.number} · {b.status} v{b.version}</option>)}
            </Select>
            <Select label="Technician" value={form.technician_id} onChange={(e) => setForm({ ...form, technician_id: e.target.value })}>
              {lookups.techs.map((t) => <option key={t.id} value={t.id}>{t.full_name} · {t.status}</option>)}
            </Select>
            <Input label="Window start" type="datetime-local" value={form.window_start} onChange={(e) => setForm({ ...form, window_start: e.target.value })} />
            <Input label="Window end" type="datetime-local" value={form.window_end} onChange={(e) => setForm({ ...form, window_end: e.target.value })} />
            <ErrorText>{error}</ErrorText>
            <div className="flex flex-wrap gap-2">
              <Button aria-label={`Book selected bay for ${ro.number}`} onClick={() => {
                const bay = lookups.bays.find((b) => b.id === form.bay_id);
                run(`/api/bays/${form.bay_id}/book`, {
                  repair_order_id: ro.id,
                  window_start: toIso(form.window_start),
                  window_end: toIso(form.window_end),
                  expected_version: bay?.version,
                  expected_status: bay?.status
                }, 'Bay booked');
              }}>Book selected bay for {ro.number}</Button>
              <Button variant="secondary" aria-label={`Assign selected technician to ${ro.number}`} onClick={() => run(`/api/technicians/${form.technician_id}/assign`, {
                repair_order_id: ro.id,
                window_start: toIso(form.window_start),
                window_end: toIso(form.window_end)
              }, 'Technician assigned')}>Assign selected technician to {ro.number}</Button>
            </div>
          </div>
        </Modal>
      )}
      {modal === 'labor' && (
        <Modal title="Log labor" onClose={() => setModal(null)}>
          <Input label="Hours" type="number" step="0.1" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          <Input label="Notes" className="mt-3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Select label="Line item" className="mt-3" value={form.line_item_id || ''} onChange={(e) => setForm({ ...form, line_item_id: e.target.value })}>
            <option value="">Unspecified</option>
            {ro.lines.map((l) => <option key={l.id} value={l.id}>{l.description} ({l.customer_approval})</option>)}
          </Select>
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={() => run('/api/labor-logs', { repair_order_id: ro.id, ...form }, 'Labor logged')}>Save</Button>
        </Modal>
      )}
      {modal === 'cancel' && (
        <Modal title={`Cancel ${ro.number}?`} onClose={() => setModal(null)}>
          <p className="text-sm text-slate-600">Cancellation is a terminal action. The repair order cannot be completed afterward.</p>
          <Input className="mt-3" label="Cancellation reason" value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <ErrorText>{error}</ErrorText>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(null)}>Keep repair order</Button>
            <Button variant="danger" disabled={!form.reason?.trim()} onClick={() => run(`/api/repair-orders/${ro.id}/cancel`, { reason: form.reason }, 'Repair order cancelled')}>Confirm cancellation</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
