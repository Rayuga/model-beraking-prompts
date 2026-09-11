import { useEffect, useState } from 'react';
import { useSession } from '../App.jsx';
import { Badge, Button, Card, ErrorText, Input, LoadingState, Modal } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/utils.js';

export default function Invoices() {
  const { user, notify } = useSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ reason: '', new_total_cents: '' });
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { invoices } = await api('/api/invoices');
    setRows(invoices);
    setLoading(false);
  }
  useEffect(() => { load().catch((e) => notify(e.message, 'error')); }, [user.id]);

  async function open(row) {
    const { invoice } = await api(`/api/invoices/${row.id}`);
    setSelected(invoice);
  }

  async function act(path, body, ok, method = 'POST') {
    setError('');
    try {
      await api(path, { method, body });
      notify(ok);
      setModal(null);
      await load();
      if (selected) await open(selected);
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Invoices & ledger</h1>
      <Card>
        {loading ? <LoadingState label="Loading invoices and ledger state…" /> : <DataTable
          rows={rows}
          onRow={open}
          columns={[
            { key: 'number', label: 'Invoice' },
            { key: 'ro_number', label: 'RO' },
            { key: 'customer_name', label: 'Customer' },
            { key: 'total_cents', label: 'Total', render: (r) => money(r.total_cents) },
            { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
          ]}
        />}
      </Card>
      {selected && (
        <Card title={`${selected.number} detail`} action={<Badge status={selected.status} />}>
          <p className="text-sm">{selected.customer_name} · {selected.ro_number} · {money(selected.total_cents)}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {selected.lines.map((l) => <li key={l.id}>{l.description} · {money(l.amount_cents)}</li>)}
          </ul>
          {!!selected.corrections.length && (
            <div className="mt-3 text-sm">
              <strong>Corrections</strong>
              {selected.corrections.map((c) => <p key={c.id}>{money(c.previous_total_cents)} → {money(c.new_total_cents)} · {c.reason}</p>)}
            </div>
          )}
          <ErrorText>{error}</ErrorText>
          {user.role === 'SHOP_MANAGER' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => act(`/api/invoices/${selected.id}/approve`, {}, 'Invoice approved')}>Approve</Button>
              <Button variant="secondary" onClick={() => act(`/api/invoices/${selected.id}/send`, {}, 'Invoice sent')}>Send</Button>
              <Button onClick={() => act(`/api/invoices/${selected.id}/pay`, {}, 'Ledger payment recorded')}>Record payment</Button>
              <Button variant="ghost" onClick={() => { setForm({ reason: '', new_total_cents: selected.total_cents }); setModal('void'); }}>Void</Button>
              <Button variant="ghost" onClick={() => act(`/api/invoices/${selected.id}`, { total_cents: 1 }, 'Direct edit attempted', 'PATCH')}>Try direct edit</Button>
              <Button variant="secondary" onClick={() => { setForm({ reason: '', new_total_cents: selected.total_cents }); setModal('corr'); }}>Correction</Button>
            </div>
          )}
        </Card>
      )}
      {modal === 'corr' && (
        <Modal title="Invoice correction" onClose={() => setModal(null)}>
          <Input label="New total (cents)" type="number" value={form.new_total_cents} onChange={(e) => setForm({ ...form, new_total_cents: e.target.value })} />
          <Input className="mt-3" label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <ErrorText>{error}</ErrorText>
          <Button className="mt-3" onClick={() => act(`/api/invoices/${selected.id}/corrections`, { ...form, new_total_cents: Number(form.new_total_cents) }, 'Correction recorded')}>Save correction</Button>
        </Modal>
      )}
      {modal === 'void' && (
        <Modal title={`Void ${selected.number}?`} onClose={() => setModal(null)}>
          <p className="text-sm text-slate-600">Voiding closes the invoice and cannot be combined with a payment.</p>
          <Input className="mt-3" label="Void reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <ErrorText>{error}</ErrorText>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(null)}>Keep invoice</Button>
            <Button variant="danger" disabled={!form.reason.trim()} onClick={() => act(`/api/invoices/${selected.id}/void`, { reason: form.reason }, 'Invoice voided')}>Confirm void</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
