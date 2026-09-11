import { useEffect, useState } from 'react';
import { useSession } from '../App.jsx';
import { Badge, Button, Card, ErrorText, Input, Modal, Select } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/utils.js';

export default function Warranties() {
  const { user, notify } = useSession();
  const [claims, setClaims] = useState([]);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  async function load() {
    const [c, r] = await Promise.all([
      api(`/api/warranty-claims${status ? `?status=${status}` : ''}`),
      api('/api/repair-orders')
    ]);
    setClaims(c.claims);
    const details = [];
    for (const ro of r.repair_orders.slice(0, 12)) {
      const { repair_order } = await api(`/api/repair-orders/${ro.id}`);
      details.push(repair_order);
    }
    setOrders(details);
  }
  useEffect(() => { load().catch((e) => notify(e.message, 'error')); }, [user.id, status]);

  async function act(path, body, ok) {
    setError('');
    try {
      await api(path, { method: 'POST', body });
      notify(ok);
      setModal(null);
      await load();
    } catch (e) { setError(e.message); }
  }

  const lines = orders.flatMap((o) => o.lines.map((l) => ({ ...l, ro_number: o.number, ro_id: o.id })));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Warranty claims</h1>
        {user.role === 'WARRANTY_ADMIN' && <Button onClick={() => { setForm({ repair_order_id: lines[0]?.ro_id, line_item_id: lines[0]?.id, coverage_type: 'MANUFACTURER' }); setModal('file'); }}>File claim</Button>}
      </div>
      <Card>
        <div className="mb-3 max-w-xs">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {['FILED', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'REIMBURSED'].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <DataTable
          rows={claims}
          columns={[
            { key: 'ro_number', label: 'RO' },
            { key: 'customer_name', label: 'Customer' },
            { key: 'line_description', label: 'Line' },
            { key: 'coverage_type', label: 'Coverage' },
            { key: 'claim_amount_cents', label: 'Amount', render: (c) => money(c.claim_amount_cents) },
            { key: 'status', label: 'Status', render: (c) => <Badge status={c.status} /> },
            { key: 'id', label: '', render: (c) => user.role === 'WARRANTY_ADMIN' ? (
              <div className="flex gap-1">
                <Button variant="secondary" onClick={() => act(`/api/warranty-claims/${c.id}/review`, { status: 'APPROVED' }, 'Claim approved')}>Approve</Button>
                <Button variant="ghost" onClick={() => act(`/api/warranty-claims/${c.id}/review`, { status: 'DENIED', notes: 'Denied' }, 'Claim denied')}>Deny</Button>
                <Button variant="ghost" onClick={() => act(`/api/warranty-claims/${c.id}/reimburse`, {}, 'Reimbursed')}>Reimburse</Button>
              </div>
            ) : null }
          ]}
        />
      </Card>
      {modal === 'file' && (
        <Modal title="File warranty claim" onClose={() => setModal(null)}>
          <Select label="Line item" value={`${form.repair_order_id}::${form.line_item_id}`} onChange={(e) => {
            const [repair_order_id, line_item_id] = e.target.value.split('::');
            setForm({ ...form, repair_order_id, line_item_id });
          }}>
            {lines.map((l) => (
              <option key={l.id} value={`${l.ro_id}::${l.id}`}>
                {l.ro_number} · {l.description}{l.warranty_component ? ` · ${l.warranty_component}` : ' · no covered component'}
              </option>
            ))}
          </Select>
          <Select className="mt-3" label="Coverage" value={form.coverage_type} onChange={(e) => setForm({ ...form, coverage_type: e.target.value })}>
            <option>MANUFACTURER</option><option>SHOP</option>
          </Select>
          <Input className="mt-3" label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={() => act('/api/warranty-claims', form, 'Claim filed')}>File</Button>
        </Modal>
      )}
    </div>
  );
}
