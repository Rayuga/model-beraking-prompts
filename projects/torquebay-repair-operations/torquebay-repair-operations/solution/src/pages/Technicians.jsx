import { useEffect, useState } from 'react';
import { useSession } from '../App.jsx';
import { Badge, Button, Card, ErrorText, Input, Modal, Select } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmtDate, toIso } from '../lib/utils.js';

export default function Technicians() {
  const { user, notify } = useSession();
  const [techs, setTechs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  async function load() {
    const [t, r] = await Promise.all([api('/api/technicians'), api('/api/repair-orders')]);
    setTechs(t.technicians);
    setOrders(r.repair_orders);
  }
  useEffect(() => { load().catch((e) => notify(e.message, 'error')); }, [user.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Technicians</h1>
      <p className="text-sm text-slate-500">Dispatch checks the full assignment window, adjacent work, daily load, and certification expiry before committing the schedule.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {techs.map((tech) => (
          <Card key={tech.id} title={`${tech.full_name}`} action={<Badge status={tech.status} />}>
            <p className="text-sm text-slate-500">Daily cap {tech.daily_labor_hour_limit}h · QC {tech.safety_qc_score}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {tech.certifications.map((c) => (
                <Badge key={c.id} status={new Date(c.expires_on) - Date.now() < 14 * 864e5 ? 'URGENT' : 'ACTIVE'}>
                  {c.cert_type} · exp {c.expires_on}
                </Badge>
              ))}
            </div>
            <div className="mt-3 space-y-1 text-sm">
              {tech.assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <span>{a.ro_number}: {fmtDate(a.window_start)} – {fmtDate(a.window_end)}</span>
                  {['SHOP_FOREMAN', 'SHOP_MANAGER'].includes(user.role) && (
                    <Button variant="ghost" onClick={() => {
                      setForm({
                        technician: tech,
                        assignment: a,
                        to_technician_id: techs.find((candidate) => candidate.id !== tech.id)?.id || '',
                        window_start: new Date(a.window_start).toISOString().slice(0, 16),
                        window_end: new Date(a.window_end).toISOString().slice(0, 16)
                      });
                      setModal('reassign');
                    }}>Reassign {a.ro_number}</Button>
                  )}
                </div>
              ))}
            </div>
            {!!tech.daily_loads?.length && (
              <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-600">
                {tech.daily_loads.map((load) => (
                  <p key={load.day}>Load {load.day}: {load.hours}h / {load.limit}h ({load.remaining}h open)</p>
                ))}
              </div>
            )}
            <Button className="mt-3" variant="secondary" aria-label={`Assign ${tech.full_name}`} onClick={() => {
              setForm({ technician: tech, repair_order_id: orders[0]?.id, window_start: '', window_end: '', required_certification: '', overtime_override: false, reason: '' });
              setModal('assign');
            }}>Assign {tech.full_name}</Button>
            {user.role === 'SHOP_MANAGER' && (
              <Button className="ml-2 mt-3" variant="ghost" onClick={() => {
                const existing = tech.certifications.find((cert) => cert.cert_type === 'GENERAL');
                setForm({
                  technician: tech,
                  cert_type: existing?.cert_type || 'GENERAL',
                  expires_on: existing?.expires_on || ''
                });
                setModal('certification');
              }}>Manage certification</Button>
            )}
          </Card>
        ))}
      </div>
      {modal === 'assign' && (
        <Modal title={`Assign ${form.technician.full_name}`} onClose={() => setModal(null)}>
          <Select label="Repair order" value={form.repair_order_id} onChange={(e) => setForm({ ...form, repair_order_id: e.target.value })}>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.status}</option>)}
          </Select>
          <Input className="mt-3" type="datetime-local" label="Start" value={form.window_start} onChange={(e) => setForm({ ...form, window_start: e.target.value })} />
          <Input className="mt-3" type="datetime-local" label="End" value={form.window_end} onChange={(e) => setForm({ ...form, window_end: e.target.value })} />
          <Select className="mt-3" label="Required certification" value={form.required_certification} onChange={(e) => setForm({ ...form, required_certification: e.target.value })}>
            <option value="">Infer from estimate</option>
            <option>EV_HYBRID</option><option>ALIGNMENT</option><option>EPA_609</option>
          </Select>
          {user.role === 'SHOP_MANAGER' && (
            <div className="mt-3 rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={!!form.overtime_override} onChange={(e) => setForm({ ...form, overtime_override: e.target.checked })} />
                Manager overtime override
              </label>
              {form.overtime_override && <Input className="mt-3" label="Override reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />}
            </div>
          )}
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={async () => {
            setError('');
            try {
              await api(`/api/technicians/${form.technician.id}/assign`, {
                method: 'POST',
                body: {
                  repair_order_id: form.repair_order_id,
                  window_start: toIso(form.window_start),
                  window_end: toIso(form.window_end),
                  required_certification: form.required_certification || undefined,
                  overtime_override: !!form.overtime_override,
                  reason: form.reason || undefined
                }
              });
              notify('Assignment submitted');
              setModal(null);
              await load();
            } catch (e) { setError(e.message); }
          }}>Assign {form.technician.full_name}</Button>
        </Modal>
      )}
      {modal === 'reassign' && (
        <Modal title={`Reassign ${form.assignment.ro_number}`} onClose={() => setModal(null)}>
          <Select label="Replacement technician" value={form.to_technician_id} onChange={(e) => setForm({ ...form, to_technician_id: e.target.value })}>
            {techs.filter((candidate) => candidate.id !== form.technician.id).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>
            ))}
          </Select>
          <Input className="mt-3" type="datetime-local" label="Start" value={form.window_start} onChange={(e) => setForm({ ...form, window_start: e.target.value })} />
          <Input className="mt-3" type="datetime-local" label="End" value={form.window_end} onChange={(e) => setForm({ ...form, window_end: e.target.value })} />
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={async () => {
            setError('');
            try {
              await api(`/api/technicians/${form.technician.id}/reassign`, {
                method: 'POST',
                body: {
                  assignment_id: form.assignment.id,
                  to_technician_id: form.to_technician_id,
                  window_start: toIso(form.window_start),
                  window_end: toIso(form.window_end)
                }
              });
              notify('Assignment moved');
              setModal(null);
              await load();
            } catch (e) { setError(e.message); }
          }}>Move assignment</Button>
        </Modal>
      )}
      {modal === 'certification' && (
        <Modal title={`Manage ${form.technician.full_name}'s certification`} onClose={() => setModal(null)}>
          <Select label="Certification" value={form.cert_type} onChange={(e) => {
            const existing = form.technician.certifications.find((cert) => cert.cert_type === e.target.value);
            setForm({ ...form, cert_type: e.target.value, expires_on: existing?.expires_on || '' });
          }}>
            <option>GENERAL</option><option>EV_HYBRID</option><option>ALIGNMENT</option><option>EPA_609</option>
          </Select>
          <Input className="mt-3" type="date" label="Valid through" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
          <p className="mt-2 text-xs text-slate-500">Only the shop manager can add or renew certification records. Dispatch checks the saved expiry across the full assignment window.</p>
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={async () => {
            setError('');
            try {
              await api(`/api/technicians/${form.technician.id}/certifications`, {
                method: 'POST',
                body: { cert_type: form.cert_type, expires_on: form.expires_on }
              });
              notify('Certification saved');
              setModal(null);
              await load();
            } catch (e) { setError(e.message); }
          }}>Save certification</Button>
        </Modal>
      )}
    </div>
  );
}
