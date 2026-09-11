import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../App.jsx';
import { Badge, Button, Card, ErrorText, Input, LoadingState, Modal, Select } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { api } from '../lib/api.js';

const STATUSES = ['', 'DRAFT', 'DIAGNOSING', 'ESTIMATE_PENDING', 'ESTIMATE_APPROVED', 'IN_PROGRESS', 'AWAITING_PARTS', 'COMPLETED', 'INVOICED', 'CLOSED', 'CANCELLED'];

export default function RepairOrders() {
  const { user, notify } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ customer_id: '', vehicle_id: '', intake_notes: '', intake_mileage: '', priority: 'NORMAL' });
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const data = await api(`/api/repair-orders${status ? `?status=${status}` : ''}`);
    setRows(data.repair_orders);
    setLoading(false);
  }

  useEffect(() => { load().catch((e) => notify(e.message, 'error')); }, [user.id, status]);

  async function startCreate() {
    const [c, v] = await Promise.all([api('/api/customers'), api('/api/vehicles')]);
    setCustomers(c.customers);
    setVehicles(v.vehicles);
    setForm({ customer_id: c.customers[0]?.id || '', vehicle_id: '', intake_notes: '', intake_mileage: '', priority: 'NORMAL' });
    setError('');
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...form, intake_mileage: form.intake_mileage ? Number(form.intake_mileage) : undefined };
      const { repair_order } = await api('/api/repair-orders', { method: 'POST', body: payload });
      notify(`Opened ${repair_order.number}`);
      setOpen(false);
      navigate(`/repair-orders/${repair_order.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredVehicles = vehicles.filter((v) => v.customer_id === form.customer_id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Repair orders</h1>
          <p className="text-sm text-slate-500">Lifecycle, approvals, and shop-floor state for every job.</p>
        </div>
        {['SERVICE_ADVISOR', 'SHOP_MANAGER'].includes(user.role) && (
          <Button onClick={startCreate}>Open repair order</Button>
        )}
      </div>
      <Card>
        <div className="mb-3 max-w-xs">
          <Select label="Status filter" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </Select>
        </div>
        {loading ? <LoadingState label="Loading repair orders…" /> : <DataTable
          rows={rows}
          empty={status ? `No repair orders currently have ${status} status. Choose All statuses to restore the full register` : 'No repair orders are in the register'}
          onRow={(r) => navigate(`/repair-orders/${r.id}`)}
          columns={[
            { key: 'number', label: 'RO', render: (r) => <Link className="font-medium text-orange-700" to={`/repair-orders/${r.id}`}>{r.number}</Link> },
            { key: 'customer_name', label: 'Customer' },
            { key: 'make', label: 'Vehicle', render: (r) => `${r.year} ${r.make} ${r.model}` },
            { key: 'priority', label: 'Priority', render: (r) => <Badge status={r.priority} /> },
            { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
            { key: 'intake_mileage', label: 'Intake mi' }
          ]}
        />}
      </Card>
      {open && (
        <Modal title="Open repair order" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={submit}>
            <Select label="Customer" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value, vehicle_id: '' })}>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
            </Select>
            <Select label="Vehicle" value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} required>
              <option value="">Select vehicle</option>
              {filteredVehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} · {v.vin}</option>)}
            </Select>
            <Input label="Intake mileage" type="number" value={form.intake_mileage} onChange={(e) => setForm({ ...form, intake_mileage: e.target.value })} />
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => <option key={p}>{p}</option>)}
            </Select>
            <Input label="Intake notes" value={form.intake_notes} onChange={(e) => setForm({ ...form, intake_notes: e.target.value })} />
            <ErrorText>{error}</ErrorText>
            <Button className="w-full" onClick={submit}>Create draft</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
