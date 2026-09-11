import { useEffect, useState } from 'react';
import { useSession } from '../App.jsx';
import { Badge, Button, Card, ErrorText, Input, Modal, Select } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/utils.js';

export default function Parts() {
  const { user, notify } = useSession();
  const [parts, setParts] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  async function load() {
    const [p, s, r] = await Promise.all([
      api(`/api/parts${status ? `?status=${status}` : ''}`),
      api('/api/shipments'),
      api('/api/repair-orders')
    ]);
    setParts(p.parts);
    setShipments(s.shipments);
    setOrders(r.repair_orders);
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Parts inventory</h1>
      <Card>
        <div className="mb-3 max-w-xs">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {['IN_STOCK', 'LOW_STOCK', 'BACKORDERED', 'ON_ORDER', 'RESERVED'].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <DataTable
          rows={parts}
          columns={[
            { key: 'part_number', label: 'Part' },
            { key: 'description', label: 'Description' },
            { key: 'quantity_on_hand', label: 'On hand' },
            { key: 'quantity_reserved', label: 'Reserved' },
            { key: 'available', label: 'Available' },
            { key: 'unit_cost_cents', label: 'Cost', render: (p) => money(p.unit_cost_cents) },
            { key: 'status', label: 'Status', render: (p) => <Badge status={p.status} /> },
            { key: 'actions', label: '', render: (p) => (
              <div className="flex gap-1">
                <Button variant="secondary" onClick={() => { setForm({ part: p, repair_order_id: orders[0]?.id, quantity: 1 }); setModal('reserve'); }}>Reserve</Button>
                {['PARTS_MANAGER', 'SHOP_MANAGER'].includes(user.role) && (
                  <Button variant="ghost" onClick={() => { setForm({ part: p, repair_order_id: orders[0]?.id, quantity: 1 }); setModal('consume'); }}>Consume</Button>
                )}
                {['PARTS_MANAGER', 'SHOP_MANAGER'].includes(user.role) && (
                  <Button variant="ghost" onClick={() => { setForm({ part: p, quantity: 1 }); setModal('receive'); }}>Receive</Button>
                )}
              </div>
            ) }
          ]}
        />
      </Card>
      <Card title="Incoming shipments">
        <DataTable
          rows={shipments}
          columns={[
            { key: 'part_number', label: 'Part' },
            { key: 'quantity', label: 'Qty' },
            { key: 'status', label: 'Status', render: (s) => <Badge status={s.status} /> },
            { key: 'expected_on', label: 'Expected' },
            { key: 'id', label: '', render: (s) => s.status === 'INCOMING' && ['PARTS_MANAGER', 'SHOP_MANAGER'].includes(user.role) ? (
              <Button variant="secondary" onClick={() => act(`/api/parts/${s.part_id}/receive`, { shipment_id: s.id }, 'Shipment received')}>Receive</Button>
            ) : null }
          ]}
        />
      </Card>
      {modal === 'reserve' && (
        <Modal title={`Reserve ${form.part.part_number}`} onClose={() => setModal(null)}>
          <Select label="Repair order" value={form.repair_order_id} onChange={(e) => setForm({ ...form, repair_order_id: e.target.value })}>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.make} {o.model}</option>)}
          </Select>
          <Input className="mt-3" label="Quantity" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={() => act(`/api/parts/${form.part.id}/reserve`, form, 'Reservation submitted')}>Reserve</Button>
        </Modal>
      )}
      {modal === 'receive' && (
        <Modal title={`Receive ${form.part.part_number}`} onClose={() => setModal(null)}>
          <Input label="Quantity" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={() => act(`/api/parts/${form.part.id}/receive`, { quantity: form.quantity }, 'Stock received')}>Receive</Button>
        </Modal>
      )}
      {modal === 'consume' && (
        <Modal title={`Consume ${form.part.part_number}`} onClose={() => setModal(null)}>
          <Select label="Repair order" value={form.repair_order_id} onChange={(e) => setForm({ ...form, repair_order_id: e.target.value })}>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.make} {o.model}</option>)}
          </Select>
          <Input className="mt-3" label="Quantity used" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={() => act(`/api/parts/${form.part.id}/usage`, { repair_order_id: form.repair_order_id, quantity: form.quantity }, 'Part usage recorded')}>Record usage</Button>
        </Modal>
      )}
    </div>
  );
}
