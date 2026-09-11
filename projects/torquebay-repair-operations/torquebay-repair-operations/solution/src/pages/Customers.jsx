import { useEffect, useState } from 'react';
import { useSession } from '../App.jsx';
import { Badge, Button, Card, ErrorText, Input, Modal, Select } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/utils.js';

export default function Customers() {
  const { user, notify } = useSession();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  async function load() {
    const { customers } = await api('/api/customers');
    setRows(customers);
  }
  useEffect(() => { load().catch((e) => notify(e.message, 'error')); }, [user.id]);

  async function open(row) {
    const { customer } = await api(`/api/customers/${row.id}`);
    setSelected(customer);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers & vehicles</h1>
        <Button onClick={() => { setForm({ name: '', contact_name: '', email: '' }); setModal('cust'); }}>New customer</Button>
      </div>
      <Card>
        <DataTable
          rows={rows}
          onRow={open}
          columns={[
            { key: 'name', label: 'Account' },
            { key: 'contact_name', label: 'Contact' },
            { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
            { key: 'outstanding_balance_cents', label: 'Balance', render: (r) => money(r.outstanding_balance_cents) }
          ]}
        />
      </Card>
      {selected && (
        <Card title={selected.name} action={<Badge status={selected.status} />}>
          <p className="text-sm">{selected.contact_name} · {selected.email} · {selected.billing_address}</p>
          <p className="text-sm text-slate-500">{selected.hold_reason || 'No hold reason on file.'}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th>Vehicle</th><th>VIN</th><th>Mi</th><th>Status</th></tr></thead>
              <tbody>
                {selected.vehicles.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="py-2">{v.year} {v.make} {v.model}</td>
                    <td className="font-mono text-xs">{v.vin}</td>
                    <td>{v.mileage}</td>
                    <td><Badge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="mt-3 flex gap-2">
            {user.role === 'SHOP_MANAGER' && (
              <Button variant="secondary" onClick={async () => {
                setError('');
                try {
                  await api(`/api/customers/${selected.id}/hold`, {
                    method: 'POST',
                    body: { hold: selected.status !== 'ON_HOLD', reason: selected.status === 'ON_HOLD' ? 'Hold lifted after review' : 'Financial hold' }
                  });
                  notify('Hold updated');
                  await load();
                  await open(selected);
                } catch (e) { setError(e.message); }
              }}>{selected.status === 'ON_HOLD' ? 'Lift hold' : 'Place hold'}</Button>
            )}
            <Button variant="secondary" onClick={() => { setForm({ customer_id: selected.id, vin: '', make: '', model: '', year: 2022, mileage: '', drivetrain: 'GAS' }); setModal('veh'); }}>Check in vehicle</Button>
          </div>
        </Card>
      )}
      {modal === 'cust' && (
        <Modal title="New customer" onClose={() => setModal(null)}>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input className="mt-3" label="Contact" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          <Input className="mt-3" label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={async () => {
            try {
              await api('/api/customers', { method: 'POST', body: form });
              notify('Customer created');
              setModal(null);
              await load();
            } catch (e) { setError(e.message); }
          }}>Save</Button>
        </Modal>
      )}
      {modal === 'veh' && (
        <Modal title="Check in vehicle" onClose={() => setModal(null)}>
          <Input label="VIN" value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
          <Input className="mt-3" label="Make" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
          <Input className="mt-3" label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <Input className="mt-3" label="Year" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
          <Input className="mt-3" label="Mileage" type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: Number(e.target.value) })} />
          <Select className="mt-3" label="Drivetrain" value={form.drivetrain} onChange={(e) => setForm({ ...form, drivetrain: e.target.value })}>
            <option>GAS</option><option>DIESEL</option><option>HYBRID</option><option>EV</option>
          </Select>
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={async () => {
            try {
              await api('/api/vehicles', { method: 'POST', body: form });
              notify('Vehicle checked in');
              setModal(null);
              await open(selected);
            } catch (e) { setError(e.message); }
          }}>Check in</Button>
        </Modal>
      )}
    </div>
  );
}
