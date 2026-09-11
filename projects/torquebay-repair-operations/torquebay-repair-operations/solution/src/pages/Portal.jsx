import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../App.jsx';
import { Badge, Button, Card, ErrorText, Input, LoadingState, Modal } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/utils.js';

export default function Portal() {
  const { user, notify } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ preferred_date: '', notes: '', vehicle_id: '' });

  async function load() {
    setError('');
    const [vehicles, repair_orders, invoices, estimates] = await Promise.all([
      api('/api/vehicles'),
      api('/api/repair-orders'),
      api('/api/invoices'),
      api('/api/estimates')
    ]);
    setData({
      vehicles: vehicles.vehicles,
      repair_orders: repair_orders.repair_orders,
      invoices: invoices.invoices,
      estimates: estimates.estimates
    });
  }
  useEffect(() => { setData(null); load().catch((e) => setError(e.message)); }, [user.id]);

  if (error && !data) return <ErrorText>{error}</ErrorText>;
  if (!data) return <LoadingState label="Loading your vehicles, estimates, and ledger…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customer portal</h1>
          <p className="text-sm text-slate-500">Only your vehicles, estimates, and invoices are visible. Cross-account IDs are denied server-side.</p>
        </div>
        <Button onClick={() => { setForm({ preferred_date: '', notes: '', vehicle_id: data.vehicles[0]?.id || '' }); setOpen(true); }}>Request appointment</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Vehicles">
          <DataTable rows={data.vehicles} columns={[
            { key: 'model', label: 'Vehicle', render: (v) => `${v.year} ${v.make} ${v.model}` },
            { key: 'status', label: 'Status', render: (v) => <Badge status={v.status} /> }
          ]} />
        </Card>
        <Card title="Repair status">
          <DataTable rows={data.repair_orders} columns={[
            { key: 'number', label: 'RO', render: (r) => <Link className="text-orange-700" to={`/repair-orders/${r.id}`}>{r.number}</Link> },
            { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
          ]} />
        </Card>
        <Card title="Estimates">
          <DataTable rows={data.estimates} columns={[
            { key: 'ro_number', label: 'RO' },
            { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
            { key: 'total_cents', label: 'Total', render: (r) => money(r.total_cents) }
          ]} />
        </Card>
        <Card title="Invoices & ledger">
          <DataTable rows={data.invoices} columns={[
            { key: 'number', label: 'Invoice' },
            { key: 'total_cents', label: 'Total', render: (r) => money(r.total_cents) },
            { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
          ]} />
        </Card>
      </div>
      {open && (
        <Modal title="Request appointment" onClose={() => setOpen(false)}>
          <Input type="date" label="Preferred date" value={form.preferred_date} onChange={(e) => setForm({ ...form, preferred_date: e.target.value })} />
          <Input className="mt-3" label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" disabled={saving || !form.vehicle_id || !form.preferred_date} aria-busy={saving} onClick={async () => {
            setSaving(true);
            setError('');
            try {
              await api('/api/appointment-requests', { method: 'POST', body: form });
              notify('Appointment request saved for your vehicle.');
              setOpen(false);
              await load();
            } catch (e) {
              setError(e.message);
            } finally {
              setSaving(false);
            }
          }}>{saving ? 'Submitting…' : 'Submit request'}</Button>
        </Modal>
      )}
    </div>
  );
}
